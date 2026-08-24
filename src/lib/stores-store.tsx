"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { type Cafe, type SeatStatus } from "@/lib/data";
import {
  apiListStores,
  apiGetStore,
  apiGetStoreCongestion,
  apiGetStoreRating,
  isApiConfigured,
  resolveImageUrl,
  type ApiStore,
  type ApiAvailability,
} from "@/lib/api";
import { usePathname } from "next/navigation";
import { geocodeAddress } from "@/lib/kakao-map-sdk";
import { CONGESTION_API_TO_LEVEL } from "@/lib/seat-congestion";

type StoresContextValue = {
  /** 지도/검색/찜 목록에서 공통으로 쓰는 카페(매장) 목록.
   * 백엔드 연동 전에는 화면 확인용 mock 데이터를, 연동 후에는 실제
   * GET /api/stores + 매장별 혼잡도 데이터를 합쳐서 보여줘요. */
  cafes: Cafe[];
  loading: boolean;
  /** mock 데이터로 보여주고 있는 중인지 여부. 실제 서버 연동 여부를 화면에서
   * 확인하고 싶을 때 써요. */
  isMock: boolean;
  getCafe: (id: string) => Cafe | undefined;
  /** 상세 화면에 들어갈 때 해당 매장만 최신 정보로 다시 불러와요
   * (목록 조회 이후 좌석 상황이 바뀌었을 수 있어서). */
  refreshCafe: (id: string) => void;
};

const StoresContext = createContext<StoresContextValue | null>(null);

// ⚠️ 예전엔 이 매핑을 여기서 따로 정의했는데, 사장님 화면(owner-store.tsx)은
// 서버 값 대신 좌석 수로 직접 계산하는 별도 로직을 써서 두 화면이 다른 값을
// 보여줬어요. 이제 손님/사장님 화면 모두 seat-congestion.ts의 이 매핑
// 하나만 사용해서 항상 같은 값을 보여줘요.
const CONGESTION_TO_STATUS: Record<ApiAvailability["congestion"], SeatStatus> =
  CONGESTION_API_TO_LEVEL;

const KNOWN_AMENITY_SLUGS = ["wifi", "outlet", "parking", "pet"] as const;

function formatUpdatedAgo(iso?: string | null): string {
  if (!iso) return "업데이트 정보 없음";
  const updated = new Date(iso).getTime();
  if (Number.isNaN(updated)) return "업데이트 정보 없음";
  const minutes = Math.max(0, Math.round((Date.now() - updated) / 60000));
  if (minutes < 1) return "방금 업데이트";
  if (minutes < 60) return `${minutes}분 전 업데이트`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간 전 업데이트`;
  return `${Math.round(hours / 24)}일 전 업데이트`;
}

function todayHours(store: ApiStore): string {
  const hours = store.business_hours;
  if (!hours || hours.length === 0) return "-";
  const dow = new Date().getDay();
  const today = hours.find((h) => h.day_of_week === dow);
  if (!today || today.is_closed || !today.opening_time || !today.closing_time)
    return "-";
  return `${today.opening_time.slice(0, 5)}~${today.closing_time.slice(0, 5)}`;
}

function isOpenNow(store: ApiStore): boolean {
  const hours = store.business_hours;
  if (!hours || hours.length === 0) return store.is_active;
  const now = new Date();
  const today = hours.find((h) => h.day_of_week === now.getDay());
  if (!today || today.is_closed || !today.opening_time || !today.closing_time)
    return false;
  const [oh, om] = today.opening_time.split(":").map(Number);
  const [ch, cm] = today.closing_time.split(":").map(Number);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes >= oh * 60 + om && nowMinutes <= ch * 60 + cm;
}

function amenitiesFromTags(store: ApiStore): Cafe["amenities"] {
  const tags = store.tags;
  if (!tags) return [];
  return tags
    .map((t) => (t.slug ?? "").toLowerCase())
    .filter((slug): slug is (typeof KNOWN_AMENITY_SLUGS)[number] =>
      (KNOWN_AMENITY_SLUGS as readonly string[]).includes(slug),
    );
}

/** 사장님이 매장 프로필의 태그 관리에서 지정한 태그 이름 전체를 그대로 뽑아요.
 * amenitiesFromTags와 달리 wifi/outlet/parking/pet로 걸러내지 않아서, 아이콘이
 * 없는 커스텀 태그(예: "24시간", "노트북 작업")도 카페 상세 화면에서 보여줄 수
 * 있어요. */
function tagNamesFromTags(store: ApiStore): string[] {
  const tags = store.tags;
  if (!tags) return [];
  return tags
    .map((t) => t.name?.trim())
    .filter((name): name is string => !!name);
}

export function mapStoreToCafe(
  store: ApiStore,
  availability?: ApiAvailability | null,
  likedIds?: Set<string>,
  rating?: { rating: number; reviewCount: number } | null,
): Cafe {
  const id = String(store.id);
  return {
    id,
    name: store.name,
    rating: rating?.rating ?? 0,
    reviewCount: rating?.reviewCount ?? 0,
    distance: "-",
    status: availability
      ? CONGESTION_TO_STATUS[availability.congestion]
      : "여유",
    seatsFilled: availability?.occupied_capacity ?? 0,
    seatsTotal: availability?.total_capacity ?? 0,
    isOpen: isOpenNow(store),
    hours: todayHours(store),
    address: store.address ?? "-",
    lat: store.latitude != null ? Number(store.latitude) : 0,
    lng: store.longitude != null ? Number(store.longitude) : 0,
    updatedAgo: formatUpdatedAgo(availability?.availability_updated_at),
    amenities: amenitiesFromTags(store),
    tags: tagNamesFromTags(store),
    liked: likedIds?.has(id) ?? false,
    // 사장님이 매장 프로필에서 저장한 대표 이미지. 서버가 상대 경로("/storage/...")를
    // 줄 수도 있어서 resolveImageUrl로 절대 URL로 바꿔둬요(그래야 img src가 바로 동작해요).
    imageUrl: resolveImageUrl(store.thumbnail_url),
    description: store.description ?? null,
    businessHours: store.business_hours ?? undefined,
  };
}

/**
 * 매장 프로필에 "주소"만 있고 좌표(latitude/longitude)는 아직 없는 매장의
 * 좌표를 클라이언트에서 보완해요.
 * ------------------------------------------------------------------
 * ⚠️ 매장 프로필을 저장할 때 주소→좌표 변환(지오코딩)을 하도록 만들어놨지만,
 * 그건 "사장님이 프로필을 다시 저장"해야만 서버 좌표가 채워지는 방식이에요.
 * 그래서 그 기능이 생기기 전에 이미 저장된 매장은 서버 좌표가 계속 null(=0)로
 * 남아있어요. 여기서 store.address만 갖고 클라이언트에서 좌표를 구해 화면에서만
 * 보완해요(서버에는 저장 안 됨 — 그건 사장님이 프로필을 다시 저장해야 해요).
 *
 * ⚠️ 예전엔 이 보완을 최초 매장 목록 조회(위 useEffect)에서만 했어요. 그런데
 * 카페 상세 화면(cafe/[id]/page.tsx)이 열릴 때마다 호출하는 refreshCafe가
 * 서버 원본 값(mapStoreToCafe(res.store, ...), 좌표는 여전히 0)으로 그 카페의
 * 항목을 통째로 덮어써서, 상세 화면을 한 번 보고 지도로 돌아오면 방금 보완했던
 * 좌표가 다시 사라졌어요(지도 핀이 없어짐 + 길찾기 화면 거리가 지구 반대편
 * 기준으로 계산되는 원인이었어요). 이제 이 geocodeCafeIfNeeded 함수를
 * 목록 조회와 refreshCafe 양쪽에서 공통으로 써서, 상세 화면을 다녀와도 좌표가
 * 유지돼요.
 */
function geocodeCafeIfNeeded(
  store: ApiStore,
  setCafes: (updater: (prev: Cafe[]) => Cafe[]) => void,
  isCancelled: () => boolean,
): void {
  const kakaoKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
  if (!kakaoKey) return;
  if (store.latitude && store.longitude) return;
  if (!store.address?.trim()) return;

  geocodeAddress(store.address, kakaoKey).then((coords) => {
    if (isCancelled() || !coords) return;
    const id = String(store.id);
    setCafes((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, lat: coords.lat, lng: coords.lng } : c,
      ),
    );
  });
}

/**
 * 카페(매장) 목록/상세의 "진짜 출처(source of truth)".
 * 지도, 검색, 찜 목록, 카페 상세, 예약, 리뷰 작성 화면이 전부 여기서
 * 카페 데이터를 읽어요.
 *
 * 백엔드 연동: NEXT_PUBLIC_API_BASE_URL이 설정돼 있으면 GET /api/stores로
 * 매장 목록을 불러오고, 각 매장의 실시간 좌석 현황을 GET
 * /api/stores/{store}/congestion으로 합쳐서 화면에 필요한 형태로 변환해요.
 *
 * ⚠️ 예전엔 여기 초기값이 data.ts의 가짜(mock) 카페 4개(온기 로스터스/브루픽스/
 * 테라로사/카페 그린)였어요. 그래서 실제 서버 요청이 끝나기 전이거나, 요청이
 * 실패하면 그 가짜 데이터가 그대로 화면에 계속 남아있었어요 — 특히 검색 화면은
 * 이 목록을 그대로 필터링만 하는 구조라서, 검색어를 입력했다가 지우면(필터가
 * 풀리면서) 가짜 카페 4개가 통째로 다시 드러나 보였던 거예요. 이제 서버 응답을
 * 받기 전까지는 빈 목록으로 시작해서, 실제로 등록된 매장만 화면에 나와요.
 */
export function StoresProvider({ children }: { children: ReactNode }) {
  const [cafes, setCafes] = useState<Cafe[]>([]);
  const [loading, setLoading] = useState(false);
  const [isMock, setIsMock] = useState(false);
  const pathname = usePathname();
  // ⚠️ 주문 생성/결제 화면에서는 이 매장 목록 혼잡도 폴링(15초마다 매장 전체를
  // Promise.all로 조회)도 잠깐 멈춰요. 개발 서버가 요청을 한 번에 하나씩만
  // 처리해서, 지금 이 순간 가장 중요한 "주문 생성" 요청과 자원을 다투지 않게 해요.
  const isCheckoutBusy =
    pathname?.startsWith("/order/checkout") || pathname?.startsWith("/order/payment");

  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    setLoading(true);

    apiListStores()
      .then(async (stores) => {
        if (cancelled || !stores) return;
        // ⚠️ GET /api/stores는 평균 별점을 안 내려줘서, 예전엔 지도/검색/찜
        // 목록의 별점이 항상 0으로 고정돼 보였어요(리뷰가 실제로 달려도 반영
        // 안 됨). 카페 상세 화면과 똑같이 매장별 리뷰를 불러와서 평균 별점·
        // 리뷰 수를 직접 계산해요.
        const [availabilities, ratings] = await Promise.all([
          Promise.all(stores.map((s) => apiGetStoreCongestion(s.id))),
          Promise.all(stores.map((s) => apiGetStoreRating(s.id))),
        ]);
        if (cancelled) return;
        const mapped = stores.map((s, i) =>
          mapStoreToCafe(s, availabilities[i], undefined, ratings[i]),
        );
        setCafes(mapped);
        setIsMock(false);

        // 주소만 있고 좌표가 없는 매장은 여기서 클라이언트 지오코딩으로 보완해요.
        stores.forEach((s) =>
          geocodeCafeIfNeeded(s, setCafes, () => cancelled),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // ⚠️ 사장님이 좌석 관리 화면에서 좌석 상태를 바꾸면 서버(GET
  // /api/stores/{store}/congestion)에는 바로 저장돼요. 하지만 그걸 보는 손님의
  // 카페 상세/지도 화면은 처음 한 번 불러온 뒤로는 다시 요청을 보내지 않는
  // "완전히 다른 브라우저 세션"이라서, 새로고침하기 전까진 잔여 좌석 수가 그대로
  // 멈춰 보였어요(=owner 화면에서 저장은 잘 되는데 손님 화면에 "실시간 반영"이
  // 안 되는 문제의 원인). 이 백엔드엔 실시간 알림(웹소켓/SSE)이 명세돼 있지
  // 않아서, 화면이 열려 있는 동안 주기적으로 혼잡도만 가볍게 다시 조회해서
  // "거의 실시간"으로 갱신되게 해요.
  const cafeIdsRef = useRef<string[]>([]);
  useEffect(() => {
    cafeIdsRef.current = cafes.map((c) => c.id);
  }, [cafes]);

  useEffect(() => {
    if (!isApiConfigured() || isCheckoutBusy) return;
    const POLL_INTERVAL_MS = 15000;
    const interval = setInterval(() => {
      const ids = cafeIdsRef.current;
      if (ids.length === 0) return;
      Promise.all(ids.map((id) => apiGetStoreCongestion(id))).then(
        (results) => {
          setCafes((prev) =>
            prev.map((c) => {
              const idx = ids.indexOf(c.id);
              const availability = idx >= 0 ? results[idx] : null;
              if (!availability) return c;
              return {
                ...c,
                status: CONGESTION_TO_STATUS[availability.congestion],
                seatsFilled: availability.occupied_capacity,
                seatsTotal: availability.total_capacity,
                updatedAgo: formatUpdatedAgo(
                  availability.availability_updated_at,
                ),
              };
            }),
          );
        },
      );
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isCheckoutBusy]);

  const getCafe = useCallback(
    (id: string) => cafes.find((c) => c.id === id),
    [cafes],
  );

  const refreshCafe = useCallback((id: string) => {
    if (!isApiConfigured()) return;
    // 매장 상세와 함께 평균 별점도 같이 다시 불러와요(카페 상세를 한 번
    // 열었다 지도/찜 목록으로 돌아왔을 때도 별점이 반영되게 해요).
    Promise.all([apiGetStore(id), apiGetStoreRating(id)]).then(([res, rating]) => {
      if (!res) return;
      setCafes((prev) => {
        const fresh = mapStoreToCafe(res.store, res.availability, undefined, rating);
        const exists = prev.some((c) => c.id === id);
        if (!exists) return [...prev, { ...fresh, liked: false }];
        return prev.map((c) =>
          c.id === id ? { ...fresh, liked: c.liked } : c,
        );
      });
      // ⚠️ 위에서 res.store의 서버 원본 좌표(없으면 0)로 덮어썼기 때문에, 목록
      // 조회 때와 마찬가지로 여기서도 주소 기반 보완을 다시 해줘야 해요. 이걸
      // 빼먹으면 카페 상세 화면을 한 번 열었다 지도로 돌아왔을 때 그 카페만
      // 다시 (0,0) 취급돼서 핀이 사라지고, 길찾기 화면의 거리 계산도 어긋나요.
      geocodeCafeIfNeeded(res.store, setCafes, () => false);
    });
  }, []);

  const value = useMemo<StoresContextValue>(
    () => ({ cafes, loading, isMock, getCafe, refreshCafe }),
    [cafes, loading, isMock, getCafe, refreshCafe],
  );

  return (
    <StoresContext.Provider value={value}>{children}</StoresContext.Provider>
  );
}

export function useStores() {
  const ctx = useContext(StoresContext);
  if (!ctx) throw new Error("useStores must be used within StoresProvider");
  return ctx;
}
