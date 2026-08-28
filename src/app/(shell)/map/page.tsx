"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RotateCw, SearchX, Star } from "lucide-react";
import SearchBar from "@/components/SearchBar";
import FilterChips, { FilterKey } from "@/components/FilterChips";
import SortDropdown from "@/components/SortDropdown";
import MapPlaceholder, { MapBounds, MapPin } from "@/components/MapPlaceholder";
import StatusBadge from "@/components/StatusBadge";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import CafeListCard from "@/components/CafeListCard";
import CustomerTopBar from "@/components/CustomerTopBar";
import SponsoredCafeCard from "@/components/SponsoredCafeCard";
import { useWishlist } from "@/lib/wishlist-store";
import { useStores } from "@/lib/stores-store";
import { type SeatStatus } from "@/lib/data";
import { apiGetKakaoCafes, type ApiKakaoCafe } from "@/lib/api";

type ViewMode = "map" | "list";
type SortKey = "거리순" | "평점순" | "혼잡도순";
const SORT_OPTIONS: readonly SortKey[] = ["거리순", "평점순", "혼잡도순"];

const CONGESTION_RANK: Record<SeatStatus, number> = { 여유: 0, 주의: 1, 혼잡: 2 };

// 두 좌표 사이의 실제 거리(m). 잡아바처럼 "거리순" 정렬이 진짜 내 위치 기준으로
// 동작하게 하려고 추가했어요 (기존 mock의 distance 문자열은 서버 실 데이터에는
// 아예 없어서("-") 정렬에 쓸 수 없었어요).
function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDistance(m: number | null): string {
  if (m === null) return "거리 정보 없음";
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

// ⚠️ 광고 팝업 X버튼: 예전엔 adDismissed가 useState뿐이라서 지도 화면을
// 벗어났다가 돌아오면(컴포넌트가 새로 마운트되며) 초기화돼 광고가 다시
// 떴어요. localStorage에 "언제까지 숨길지"(만료 시각, ms)를 저장해두고,
// 그 시각이 지나기 전까지는 다시 마운트돼도 계속 숨겨진 상태로 시작하게
// 해요. 체크박스 없이 X만 눌러도 24시간 동안 안 뜨는 방식이라 화면/상태가
// 늘지 않아서 발표 전 수정 범위를 최소로 유지했어요.
const AD_DISMISS_STORAGE_KEY = "cafeon_ad_dismissed_until";
const AD_DISMISS_HOURS = 24;

function readAdDismissedUntil(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AD_DISMISS_STORAGE_KEY);
    if (!raw) return null;
    const until = Number(raw);
    return Number.isFinite(until) ? until : null;
  } catch {
    // 시크릿 모드 등 localStorage를 못 쓰는 환경이면 매번 새로 떠도 그냥 무시해요.
    return null;
  }
}

function writeAdDismissedUntil(until: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(AD_DISMISS_STORAGE_KEY, String(until));
  } catch {
    // 저장 실패해도 화면 동작에는 지장 없게 조용히 무시해요.
  }
}

export default function MapPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("전체");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("map");
  const [sortKey, setSortKey] = useState<SortKey>("거리순");

  // ⚠️ 광고(스폰서 카페) 팝업 — 교수님 피드백으로 나온 "카페 사장님이 비용을
  // 내면 지도에 노출되는 광고" 수익모델 컨셉을 보여주기 위한 프론트 목업이에요.
  // 실제 광고 신청/결제/서버 연동은 없고, 지금 지도에 있는 카페 중 하나를
  // "광고"로 보여줘요.
  // - X만 누르면(체크박스 안 누르고): 지금 보고 있는 이 화면에서는 바로
  //   닫혀요. localStorage엔 아무것도 저장하지 않아서, 다른 화면 갔다가 지도로
  //   돌아오면(이 컴포넌트가 새로 마운트되며 adDismissed가 false로 초기화돼)
  //   광고가 다시 떠요.
  // - "24시간 안 보기"를 체크하고 X를 누르면: localStorage에 만료 시각을
  //   저장해서, 24시간 동안은 지도 화면에 새로 들어와도 광고 자체가 안 떠요
  //   (아래 readAdDismissedUntil/writeAdDismissedUntil 참고).
  const [adDismissed, setAdDismissed] = useState(false);

  useEffect(() => {
    const until = readAdDismissedUntil();
    if (until !== null && until > Date.now()) {
      setAdDismissed(true);
    }
  }, []);

  // ⚠️ 예전엔 여기서 @/lib/data의 하드코딩된 mock 카페 배열을 그대로 썼어요.
  // 그래서 지도 배경(카카오맵)은 실제 지도가 뜨는데도, 그 위의 핀은 항상 가짜
  // 위치/데이터만 보였어요. useWishlist()는 검색/찜 화면과 동일하게
  // useStores()(GET /api/stores + 매장별 실시간 좌석 현황)를 원본으로 쓰기
  // 때문에, 여기서도 이걸 쓰면 실제 등록된 매장이 실제 좌표에 찍혀요.
  const { cafes } = useWishlist();
  // CafeOn 매장 목록이 아직 서버에서 로딩 중인지 여부. 아래 "빈 상태" 안내(이
  // 지역엔 표시할 카페가 없어요)가 데이터를 받아오기도 전에 잠깐 번쩍이는 걸
  // 막는 데 써요.
  const { loading: storesLoading } = useStores();

  // 지도에 실제로 보이는 카카오맵 일반 카페들(CafeOn 미등록). GET
  // /api/map/kakao-cafes 결과를 여기 담아요.
  const [kakaoCafes, setKakaoCafes] = useState<ApiKakaoCafe[]>([]);
  const [activeKakaoId, setActiveKakaoId] = useState<string | null>(null);

  // 내 실제 위치(위경도). MapPlaceholder가 geolocation을 성공적으로 가져오면
  // 알려줘요 — 목록보기의 "거리순" 정렬에 써요.
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  // "이 지역에서 검색" 버튼(잡아바 참고) 관련 상태. 지도를 움직여도 자동으로
  // 카카오카페를 다시 불러오지 않고, 사용자가 버튼을 눌렀을 때만 검색해요.
  // ⚠️ 예전엔 idle(지도 정지) 이벤트마다 자동으로 검색했는데, 핀이 새로 생기면
  // 지도가 그 핀들에 맞춰 스스로 다시 확대/축소되고 그게 또 "지도 이동"으로
  // 감지돼 무한히 재검색을 반복할 수 있었어요(화면이 계속 흔들리다 이상해짐).
  // MapPlaceholder에서 그 자동 재확대 로직 자체를 없앤 것과 별개로, 여기서도
  // "지도를 움직였다"와 "지금 이 범위로 검색한다"를 분리해서 이중으로 막아요.
  const [showResearch, setShowResearch] = useState(false);
  const [researching, setResearching] = useState(false);
  // 카카오카페를 한 번이라도 실제로 불러왔는지. 이 값이 true가 되기 전까지는
  // "이 지역엔 표시할 카페가 없어요" 빈 상태 안내를 보여주지 않아요(아래 설명 참고).
  const [initialSearchDone, setInitialSearchDone] = useState(false);
  const hasSearchedOnceRef = useRef(false);
  const lastBoundsKey = useRef<string | null>(null);
  const pendingBoundsRef = useRef<MapBounds | null>(null);
  // 내 위치를 방금 구해서 지도가 그 위치로 자동 재중심(recenter)된 직후인지
  // 표시하는 플래그. MapPlaceholder의 onMyLocation → onBoundsChanged 순서로
  // 콜백이 오는 걸 이용해요(아래 handleMyLocation 참고).
  const justGeolocatedRef = useRef(false);

  const searchBounds = useCallback((bounds: MapBounds, opts?: { fromButton?: boolean }) => {
    setResearching(true);
    apiGetKakaoCafes({ ...bounds, page: 1, size: 15 })
      .then((res) => {
        if (!res) return;
        setKakaoCafes(res.data);
      })
      .finally(() => {
        setResearching(false);
        setInitialSearchDone(true);
        // 버튼을 눌러서 시작한 검색만 여기서 버튼을 숨겨요(검색이 끝난 뒤).
        // ⚠️ 예전엔 버튼을 누르는 즉시(아래 handleResearchClick에서) 버튼을
        // 숨겼는데, 그러면 "검색 중..." 상태를 보여줄 새도 없이 버튼 자체가
        // 바로 사라져버려서 눌러도 아무 반응이 없는 것처럼 보였어요.
        if (opts?.fromButton) setShowResearch(false);
      });
  }, []);

  const handleBoundsChanged = useCallback(
    (bounds: MapBounds) => {
      // 소수점 3자리(대략 100m 단위)로 반올림해 같은 범위로 다시 호출하는 걸
      // 막아요. 지도가 미세하게만 움직여도(예: 마커 클릭 시 지도가 살짝 리레이아웃)
      // 매번 새로 요청/버튼표시하면 번거로워요.
      const key = [bounds.sw_lat, bounds.sw_lng, bounds.ne_lat, bounds.ne_lng]
        .map((n) => n.toFixed(3))
        .join(",");
      if (key === lastBoundsKey.current) return;
      lastBoundsKey.current = key;
      pendingBoundsRef.current = bounds;

      // ⚠️ 예전엔 "최초 1회"만 자동 검색하고, 그 이후 발생하는 모든 지도 이동은
      // (사용자가 직접 움직였든 아니든) 전부 버튼을 눌러야만 재검색했어요. 문제는
      // 최초 자동 검색이 실제로는 내 위치를 구하기 전(기본 좌표)에 한 번 먼저
      // 일어나고, 잠시 후 geolocation이 성공하면 지도가 실제 내 위치로 다시
      // 자동 이동(recenter)한다는 점이었어요. 이 recenter도 "이후 이동"으로
      // 취급돼 버튼만 나타나고 카카오카페는 다시 불러오지 않았고, 그 결과 화면엔
      // 엉뚱한 지역(기본 좌표)의 핀들이 잠깐 보였다가 내 위치로 지도가 이동하며
      // 화면 밖으로 사라지는 것처럼 보였어요(번쩍하고 사라지는 원인). 사용자가
      // 직접 스크롤/드래그한 게 아니라 "내 위치로 자동 재중심"된 경우엔 여기서도
      // 자동으로 다시 검색해요 — 무한 재검색 루프는 justGeolocatedRef가 매번
      // 딱 한 번만(내 위치를 처음 구했을 때만) true가 되므로 발생하지 않아요.
      if (!hasSearchedOnceRef.current || justGeolocatedRef.current) {
        hasSearchedOnceRef.current = true;
        justGeolocatedRef.current = false;
        searchBounds(bounds);
      } else {
        // 이후로는(사용자가 직접 지도를 움직였을 때만) 버튼을 눌러야만 재검색해요.
        setShowResearch(true);
      }
    },
    [searchBounds]
  );

  const handleResearchClick = () => {
    if (!pendingBoundsRef.current) return;
    searchBounds(pendingBoundsRef.current, { fromButton: true });
  };

  const handleMyLocation = useCallback((loc: { lat: number; lng: number }) => {
    justGeolocatedRef.current = true;
    setMyLocation(loc);
  }, []);

  // 카페 데이터에 들어있는 실제 위도/경도(lat/lng)를 그대로 핀 좌표로 사용해요.
  // ⚠️ 실서버 매장 중에는 아직 주소를 좌표로 변환(지오코딩)하지 않아서
  // latitude/longitude가 비어있는(=stores-store.tsx에서 0으로 채워지는) 매장이
  // 섞여 있을 수 있어요. (0, 0)은 기니만 한복판이라 실제 카페 위치가 아니에요.
  // 이런 핀까지 지도 범위(bounds)에 포함시키면 지도가 지구 반대편까지 포함하도록
  // 극단적으로 축소돼서, 정작 서울 시내 마커들은 한 점으로 뭉개져 거의 안 보이는
  // 하얀(빈) 지도처럼 보이는 원인이 됐어요. 좌표가 없는 매장은 지도에서 제외해요.
  const visibleCafes = useMemo(
    () =>
      cafes
        .filter((c) => c.lat !== 0 && c.lng !== 0)
        .filter((c) => filter === "전체" || c.status === filter),
    [cafes, filter]
  );

  const cafeOnPins: MapPin[] = useMemo(
    () =>
      visibleCafes.map((c) => ({
        id: c.id,
        source: "CAFEON",
        status: c.status,
        lat: c.lat,
        lng: c.lng,
        filled: c.seatsTotal - c.seatsFilled, // 마커 안 숫자는 남은 좌석 수
      })),
    [visibleCafes]
  );

  // 카카오맵 카페는 CafeOn처럼 실시간 좌석 현황이 없어서 혼잡도 필터(여유/주의/혼잡)
  // 대상이 아니에요. "전체"일 때만 함께 보여주고, 특정 혼잡도로 필터링 중에는
  // CafeOn 등록 매장만 남겨서 필터가 실제로 의미 있게 동작하게 해요.
  const visibleKakaoCafes = useMemo(
    () => (filter === "전체" ? kakaoCafes : []),
    [kakaoCafes, filter]
  );

  const kakaoPins: MapPin[] = useMemo(
    () =>
      visibleKakaoCafes.map((c) => ({
        id: `kakao-${c.kakao_place_id}`,
        source: "KAKAO",
        status: "여유",
        lat: c.latitude,
        lng: c.longitude,
      })),
    [visibleKakaoCafes]
  );

  const activeCafe = useMemo(
    () => (activeId ? cafes.find((c) => c.id === activeId) : undefined),
    [activeId, cafes]
  );

  const activeKakaoCafe = useMemo(
    () =>
      activeKakaoId
        ? kakaoCafes.find((c) => `kakao-${c.kakao_place_id}` === activeKakaoId)
        : undefined,
    [activeKakaoId, kakaoCafes]
  );

  // ⚠️ 예전엔 이 배열을 매 렌더마다 새로 만들었어요(.concat을 렌더 본문에서
  // 바로 호출). cafeOnPins/kakaoPins 내용이 안 바뀌었어도 activeId 등 다른
  // state가 바뀔 때마다(예: 마커를 클릭한 직후) 매번 새 배열 참조가 만들어져서,
  // MapPlaceholder의 마커 렌더링 effect(pins가 바뀔 때마다 마커를 전부 지웠다가
  // 다시 그림)가 클릭할 때마다 불필요하게 다시 실행됐어요. useMemo로 실제
  // cafeOnPins/kakaoPins가 바뀔 때만 새 배열을 만들게 해요.
  const visiblePins = useMemo(
    () => cafeOnPins.concat(kakaoPins),
    [cafeOnPins, kakaoPins]
  );
  const isEmpty = visiblePins.length === 0;

  const handlePinClick = (id: string) => {
    if (id.startsWith("kakao-")) {
      setActiveKakaoId(id);
      setActiveId(null);
    } else {
      setActiveId(id);
      setActiveKakaoId(null);
    }
  };

  // 목록보기 정렬용 항목. CafeOn 매장 + 카카오맵 카페를 한 목록으로 합치고,
  // 내 위치가 있으면 실제 직선 거리(m)를 계산해요.
  const sortedListItems = useMemo(() => {
    type Item =
      | { kind: "cafeon"; id: string; distance: number | null }
      | { kind: "kakao"; id: string; distance: number | null };

    const cafeonItems: Item[] = visibleCafes.map((c) => ({
      kind: "cafeon" as const,
      id: c.id,
      distance: myLocation ? distanceMeters(myLocation, { lat: c.lat, lng: c.lng }) : null,
    }));
    const kakaoItems: Item[] = visibleKakaoCafes.map((c) => ({
      kind: "kakao" as const,
      id: `kakao-${c.kakao_place_id}`,
      distance: myLocation
        ? distanceMeters(myLocation, { lat: c.latitude, lng: c.longitude })
        : null,
    }));

    const items = [...cafeonItems, ...kakaoItems];

    if (sortKey === "거리순") {
      items.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else if (sortKey === "평점순") {
      // 카카오맵 카페는 평점 데이터가 없어서 목록 맨 아래로 보내요.
      items.sort((a, b) => {
        const ar = a.kind === "cafeon" ? cafes.find((c) => c.id === a.id)?.rating ?? -1 : -1;
        const br = b.kind === "cafeon" ? cafes.find((c) => c.id === b.id)?.rating ?? -1 : -1;
        return br - ar;
      });
    } else {
      // 혼잡도순: 여유 → 주의 → 혼잡. 카카오맵 카페는 실시간 혼잡도가 없어서
      // 맨 아래로 보내요.
      items.sort((a, b) => {
        const ar =
          a.kind === "cafeon"
            ? CONGESTION_RANK[cafes.find((c) => c.id === a.id)?.status ?? "여유"]
            : 99;
        const br =
          b.kind === "cafeon"
            ? CONGESTION_RANK[cafes.find((c) => c.id === b.id)?.status ?? "여유"]
            : 99;
        return ar - br;
      });
    }
    return items;
  }, [visibleCafes, visibleKakaoCafes, myLocation, sortKey, cafes]);

  // ⚠️ "현재 내 위치에 있는 카페" 광고 컨셉: 내 위치를 구했으면 그 위치에서
  // 가장 가까운(=지금 지도에 보이는) CafeOn 등록 카페를, 못 구했으면 그냥 첫
  // 번째 카페를 광고로 보여줘요. 실제 서비스라면 "광고비를 낸 매장"을
  // 서버에서 받아와야 하지만, 지금은 프론트 목업이라 이렇게 대체해요.
  const sponsoredCafe = useMemo(() => {
    if (visibleCafes.length === 0) return null;
    if (!myLocation) return visibleCafes[0];
    let nearest = visibleCafes[0];
    let nearestDist = distanceMeters(myLocation, { lat: nearest.lat, lng: nearest.lng });
    for (const c of visibleCafes.slice(1)) {
      const d = distanceMeters(myLocation, { lat: c.lat, lng: c.lng });
      if (d < nearestDist) {
        nearest = c;
        nearestDist = d;
      }
    }
    return nearest;
  }, [visibleCafes, myLocation]);

  const sponsoredDistanceLabel = useMemo(() => {
    if (!sponsoredCafe) return "";
    if (!myLocation) return "내 주변";
    return formatDistance(
      distanceMeters(myLocation, { lat: sponsoredCafe.lat, lng: sponsoredCafe.lng })
    );
  }, [sponsoredCafe, myLocation]);

  // X를 누르면 체크박스 여부와 상관없이 지금 화면에서는 바로 닫혀요.
  // "24시간 안 보기"를 체크했을 때만 localStorage에 만료 시각을 남겨서,
  // 다음에 지도 화면에 새로 들어와도(컴포넌트가 다시 마운트돼도) 24시간
  // 동안 계속 숨겨져 있게 해요. 체크 안 했으면 아무것도 저장하지 않으니
  // 다른 화면 갔다가 지도로 돌아오면 광고가 다시 떠요.
  const handleCloseAd = useCallback((dontShowForDay: boolean) => {
    if (dontShowForDay) {
      writeAdDismissedUntil(Date.now() + AD_DISMISS_HOURS * 60 * 60 * 1000);
    }
    setAdDismissed(true);
  }, []);


  return (
    // ⚠️ min-h-0이 없으면 이 페이지가 부모(overflow-y-auto인 셸 레이아웃)보다
    // 살짝 더 커질 수 있어서, 지도 화면 전체가 스크롤 가능한 상태가 돼버려요.
    // 그러면 화면 위쪽에 빈 공간이 보이거나(스크롤이 살짝 밀린 상태로 시작),
    // 스크롤을 굴릴 때 우측 하단 +/− 버튼이 잠깐 다른 위치에 보였다 사라지는
    // 것처럼 보이는 원인이 돼요. 지도 화면은 페이지 자체가 스크롤되면 안 되고
    // 지도 내부(카카오맵)만 움직여야 해서, 아래로 min-h-0을 계속 내려줘요.
    // ⚠️ 예전엔 검색창/필터 줄이 일반 문서 흐름(bg-cream 배경의 고정 높이 블록)에
    // 있어서 그만큼 지도가 아래로 밀려났고, 그래서 지도가 상단바(CafeOn 로고) 바로
    // 아래까지 안 올라오고 중간에 빈 여백이 생긴 것처럼 보였어요. 이제 지도를
    // 상단바 바로 아래부터 화면 전체(absolute inset-0)로 깔고, 검색창/필터는 그
    // 위에 떠 있는 오버레이로 바꿔서 지도가 실제로 화면을 꽉 채우게 했어요.
    <div className="flex h-full min-h-0 flex-col">
      <CustomerTopBar />

      <div className="relative flex-1 min-h-0">
        {/* 검색창 + 필터 칩은 지도(또는 목록) 위에 항상 떠 있는 오버레이예요.
            지도가 이 오버레이 뒤까지 화면 전체를 채우도록(absolute inset-0)
            분리했어요 — 그래야 지도가 상단바 바로 아래까지 꽉 차 보여요. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-0">
          <div className="pointer-events-auto px-4 pt-4">
            <SearchBar
              value={query}
              onChange={setQuery}
              onSubmit={() => {
                router.push(`/search?q=${encodeURIComponent(query)}`);
              }}
            />
          </div>

          <div className="pointer-events-auto flex items-center justify-between gap-1">
            {/* ⚠️ 예전엔 이 래퍼에 overflow-hidden이 있었는데, "이 지역에서
                검색" 버튼(shrink-0)이 오른쪽 자리를 차지하면서 필터 칩 줄
                너비가 줄어들면 마지막 "혼잡" 칩이 스크롤 안내 없이 딱
                잘려나가 글자가 깨진 것처럼 보였어요. FilterChips 내부에
                이미 overflow-x-auto(가로 스크롤)가 있으니 바깥은
                overflow-visible로 두고, 실제로 옆으로 넘겨볼 수 있게 했어요. */}
            <div className="min-w-0 flex-1 overflow-visible">
              <FilterChips
                options={["전체", "여유", "주의", "혼잡"]}
                value={filter}
                onChange={setFilter}
              />
            </div>

            <div className="flex shrink-0 items-center gap-2 pb-3 pl-1 pr-4 pt-4">
              {view === "list" && (
                <SortDropdown value={sortKey} options={SORT_OPTIONS} onChange={setSortKey} />
              )}
              {/* ⚠️ 예전엔 여기에 "목록보기" 토글 버튼이 있었는데, 지도 화면에서
                  필터 줄 오른쪽을 가려서 답답하다는 피드백으로 없앴어요. 대신 그
                  자리에 "이 지역에서 검색" 버튼을 둬서, 지도를 옮긴 뒤 다시
                  검색할 때 이 위치에서 바로 누를 수 있게 했어요. 필터 칩(h-9,
                  text-[13.5px])과 높이/글자 크기를 맞춰서 나란히 놔도 어색하지
                  않게 했어요.
                  ⚠️ 색상: 예전엔 bg-ink(진한 남색/검정) + 흰 글씨였는데, 다른
                  칩/버튼들이 전부 흰 바탕이라 이 버튼만 시커멓게 튀어 보였어요.
                  FilterChips의 "idle" 스타일(흰 배경 + border)과 맞춰서 흰 바탕에
                  검정 글씨로 바꿨어요.
                  ⚠️ 정렬: 이 버튼을 감싼 바깥 div에 FilterChips 쪽(px-4 pb-3 pt-4)과
                  달리 pt-4가 빠져 있어서, 같은 h-9 버튼인데도 두 줄의 세로 위치가
                  서로 어긋나 보였어요. pt-4를 맞춰서 필터 칩과 같은 줄에 나란히
                  놓이게 했어요. */}
              {/* ⚠️ "이 지역에서 검색"이 너무 길어서 필터 칩과 한 줄에 나란히
                  있을 때 칩 영역을 심하게 좁혔어요("재검색"으로 줄여서 칩이
                  잘리지 않게 여유를 더 줬어요). */}
              {view === "map" && showResearch && (
                <button
                  type="button"
                  onClick={handleResearchClick}
                  disabled={researching}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border bg-white px-3.5 text-[13.5px] font-bold text-ink shadow-card disabled:opacity-60"
                >
                  <RotateCw size={14} className={researching ? "animate-spin" : ""} />
                  {researching ? "검색 중..." : "재검색"}
                </button>
              )}
            </div>
          </div>

          {/* 광고(스폰서 카페) 팝업. 지도보기에서만, 아직 닫지 않았고 보여줄
              카페가 있을 때만 떠요. X를 누르면 이 화면을 보는 동안은 다시
              안 떠요(아래 onClose). */}
          {view === "map" && sponsoredCafe && !adDismissed && (
            <div className="pointer-events-auto px-4 pt-2">
              <SponsoredCafeCard
                cafe={{
                  id: sponsoredCafe.id,
                  name: sponsoredCafe.name,
                  imageUrl: sponsoredCafe.imageUrl,
                  rating: sponsoredCafe.rating,
                  reviewCount: sponsoredCafe.reviewCount,
                  distanceLabel: sponsoredDistanceLabel,
                }}
                onClick={() => router.push(`/cafe/${sponsoredCafe.id}`)}
                onClose={handleCloseAd}
              />
            </div>
          )}
        </div>

        {view === "map" ? (
          <>
            <div
              className="absolute inset-0"
              onClick={() => {
                setActiveId(null);
                setActiveKakaoId(null);
              }}
            >
              <MapPlaceholder
                pins={visiblePins}
                activePinId={activeId ?? activeKakaoId ?? undefined}
                onPinClick={handlePinClick}
                onBoundsChanged={handleBoundsChanged}
                onMyLocation={handleMyLocation}
                showZoomControls
              />
            </div>

            {/* 빈 상태: 카카오카페/CafeOn 매장이 이 범위에 하나도 없을 때 안내해요.
                ⚠️ 예전엔 initialSearchDone/storesLoading을 확인하지 않아서, 화면에
                갓 들어왔을 때(아직 CafeOn 매장도, 카카오카페도 서버에서 도착하기 전,
                핀이 하나도 없는 그 짧은 순간) isEmpty가 잠깐 true였다가 데이터가
                도착하면 바로 false가 됐어요. 그 사이에 이 안내 카드가 화면 가운데
                번쩍 나타났다 사라지는 것처럼 보였어요. 이제 최초 카카오카페 검색이
                끝나고, CafeOn 매장 목록도 로딩이 끝난 뒤에만 이 안내를 보여줘요. */}
            {isEmpty && !researching && initialSearchDone && !storesLoading && (
              <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-8">
                <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/95 px-6 py-5 text-center shadow-card">
                  <SearchX size={28} className="text-ink-muted" />
                  <p className="text-[14px] font-bold text-ink">
                    이 지역엔 표시할 카페가 없어요
                  </p>
                  <p className="text-[12.5px] text-ink-secondary">
                    지도를 이동하거나 조건을 변경해보세요
                  </p>
                </div>
              </div>
            )}

            {/* ⚠️ 마커를 눌렀을 때 뜨는 이 카드들(카카오카페/CafeOn 매장 정보)이
                스크롤할 때만 잠깐 보였다 사라지는 문제 수정: MapPlaceholder
                내부의 카카오맵 레이어가 z-index 없는 형제 요소들 위로
                깔리던 것과 같은 원인이에요. z-10을 명시해서 지도(자식 stacking
                context 안에 갇힌) 위로 항상 뜨게 해요. */}
            {activeKakaoCafe && (
              <a
                href={activeKakaoCafe.place_url ?? undefined}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => {
                  if (!activeKakaoCafe.place_url) e.preventDefault();
                }}
                className="absolute inset-x-4 bottom-6 z-10 flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-white p-3 shadow-card"
              >
                <ImagePlaceholder className="w-24 h-24 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-[17px] font-bold text-ink">
                      {activeKakaoCafe.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-ink-secondary">
                      카카오맵
                    </span>
                  </div>
                  <p className="truncate text-[13px] text-ink-secondary">
                    {activeKakaoCafe.road_address || activeKakaoCafe.address || "-"}
                  </p>
                  <p className="text-[12px] text-ink-muted">
                    CafeOn에 등록되지 않은 카페예요 · 실시간 좌석 정보 없음
                  </p>
                </div>
              </a>
            )}

            {activeCafe && (
              <div
                onClick={() => router.push(`/cafe/${activeCafe.id}`)}
                className="absolute inset-x-4 bottom-6 z-10 flex cursor-pointer items-center gap-4 rounded-2xl border border-border bg-white p-3 shadow-card"
              >
                {/* 사장님이 매장 프로필에서 등록한 대표 이미지(thumbnail_url)를
                    그대로 보여줘요. stores-store가 이미 resolveImageUrl로
                    절대주소로 바꿔서 cafe.imageUrl에 넣어둬요 — 없으면 기존
                    회색 플레이스홀더로 자동 폴백돼요. */}
                <ImagePlaceholder
                  className="w-24 h-24 shrink-0"
                  src={activeCafe.imageUrl}
                  alt={activeCafe.name}
                />
                <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate text-[17px] font-bold text-ink">
                      {activeCafe.name}
                    </h3>
                    <Link
                      href={`/cafe/${activeCafe.id}/route`}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0 text-[13px] font-bold text-brand"
                    >
                      길찾기 ›
                    </Link>
                  </div>
                  <p className="flex items-center gap-1 text-[13px] text-ink-secondary">
                    <Star size={13} className="fill-amber text-amber" />
                    {activeCafe.rating} ({activeCafe.reviewCount})
                  </p>
                  <div>
                    <StatusBadge
                      status={activeCafe.status}
                      filled={activeCafe.seatsFilled}
                      total={activeCafe.seatsTotal}
                    />
                  </div>
                  <p className="text-[12px] text-ink-muted">{activeCafe.updatedAgo}</p>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 overflow-y-auto pb-6 pt-28">
            {sortedListItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-8 py-16 text-center">
                <SearchX size={28} className="text-ink-muted" />
                <p className="text-[14px] font-bold text-ink">표시할 카페가 없어요</p>
                <p className="text-[12.5px] text-ink-secondary">
                  지도를 이동하거나 조건을 변경해보세요
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 px-4">
                {sortedListItems.map((item) => {
                  if (item.kind === "cafeon") {
                    const cafe = visibleCafes.find((c) => c.id === item.id);
                    if (!cafe) return null;
                    return (
                      <CafeListCard
                        key={item.id}
                        cafe={{ ...cafe, distance: formatDistance(item.distance) }}
                        showUpdatedAt
                      />
                    );
                  }
                  const cafe = visibleKakaoCafes.find(
                    (c) => `kakao-${c.kakao_place_id}` === item.id
                  );
                  if (!cafe) return null;
                  return (
                    <a
                      key={item.id}
                      href={cafe.place_url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => {
                        if (!cafe.place_url) e.preventDefault();
                      }}
                      className="flex items-center gap-4 rounded-2xl border border-border bg-white p-3 shadow-card"
                    >
                      <ImagePlaceholder className="w-24 h-24 shrink-0" />
                      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate text-[17px] font-bold text-ink">
                            {cafe.name}
                          </h3>
                          <span className="shrink-0 rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-ink-secondary">
                            카카오맵
                          </span>
                        </div>
                        <p className="truncate text-[13px] text-ink-secondary">
                          {formatDistance(item.distance)} ·{" "}
                          {cafe.road_address || cafe.address || "-"}
                        </p>
                        <p className="text-[12px] text-ink-muted">
                          CafeOn 미등록 · 실시간 좌석 정보 없음
                        </p>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
