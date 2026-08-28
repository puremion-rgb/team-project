"use client";

import { useEffect, useRef, useState } from "react";
import { Locate, Plus, Minus } from "lucide-react";
import type { SeatStatus } from "@/lib/data";
import { loadKakaoMapSdk } from "@/lib/kakao-map-sdk";

/**
 * 카카오맵 SDK 기반 지도 컴포넌트 (임시 스키매틱 지도를 대체).
 *
 * 사용하려면 .env.local 에 아래 값이 있어야 해요:
 *   NEXT_PUBLIC_KAKAO_MAP_KEY=카카오 디벨로퍼스에서 발급받은 JavaScript 키
 *
 * 카카오 디벨로퍼스(https://developers.kakao.com) → 내 애플리케이션 → 앱 키의
 * "JavaScript 키"를 쓰면 되고, 플랫폼 설정에 실제 배포 도메인(및 localhost:3000)을
 * 등록해둬야 지도가 정상적으로 로드돼요.
 *
 * SDK 로드는 src/lib/kakao-map-sdk.ts의 공용 로더를 써요 — 매장 프로필의
 * 주소→좌표 변환(geocodeAddress)도 같은 SDK 인스턴스를 쓰기 때문에, 두 곳이
 * 각자 <script>를 따로 넣지 않고 하나만 공유해요.
 */

const pinColorHex: Record<SeatStatus, string> = {
  여유: "#639922", // sage
  주의: "#BA7517", // amber
  혼잡: "#993C1D", // brand-dark
};

export type MapPin = {
  id: string;
  /** CafeOn에 등록된 매장(기본값)인지, 카카오맵에서만 조회되는 일반 카페인지.
   * 지도에서 두 종류를 시각적으로 구분해야 해요(카카오지도_카페나오기.txt 참고). */
  source?: "CAFEON" | "KAKAO";
  status: SeatStatus;
  lat: number;
  lng: number;
  filled?: number;
};

export type MapBounds = {
  sw_lat: number;
  sw_lng: number;
  ne_lat: number;
  ne_lng: number;
};

const DEFAULT_CENTER = {
  // ⚠️ 예전엔 이 좌표가 강남역(서울)으로 고정돼 있었어요. 내 위치(geolocation)를
  // 못 구했을 때만 쓰이는 "기본값"인데, 실제로는 이 기본값이 자주 노출됐어요:
  // 브라우저의 위치 정보 API(Geolocation)는 "보안 컨텍스트"(HTTPS 또는
  // localhost)에서만 동작해서, http://192.168.x.x:3000 같은 사설 IP 주소로
  // 컴퓨터에서 접속하면 대부분의 브라우저가 위치 요청 자체를 차단해요(권한
  // 팝업도 안 뜨고 조용히 실패). 그 결과 컴퓨터로 접속했을 때는 항상 이 기본
  // 좌표(서울)로 지도가 뜨고, 실제 위치(대구)로는 절대 안 움직이는 것처럼
  // 보였어요. 근본적인 해결은 HTTPS로 서빙하는 거지만(아래 NEXT_PUBLIC_MAP_*
  // 주석 및 답변 참고), 그와 별개로 이 기본 좌표 자체를 .env.local에서 원하는
  // 지역으로 바꿀 수 있게 했어요 — 값이 없으면 대구 시청 인근으로 기본값을 둬요.
  lat: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT) || 35.8714,
  lng: Number(process.env.NEXT_PUBLIC_MAP_DEFAULT_LNG) || 128.6014,
};

export default function MapPlaceholder({
  pins = [],
  activePinId,
  routeTo,
  onPinClick,
  onBoundsChanged,
  onMyLocation,
  onMyLocationError,
  showZoomControls = false,
}: {
  pins?: MapPin[];
  activePinId?: string;
  routeTo?: MapPin;
  onPinClick?: (id: string) => void;
  /** 지도 이동/확대가 끝날 때(카카오맵 idle 이벤트)마다 현재 화면에 보이는
   * 지도 범위를 알려줘요. GET /api/map/kakao-cafes 호출에 필요한
   * sw_lat/sw_lng/ne_lat/ne_lng를 이 콜백으로 넘겨받아 쓰면 돼요. */
  onBoundsChanged?: (bounds: MapBounds) => void;
  /** 내 실제 위치(위경도)를 가져오는 데 성공하면 한 번 알려줘요. 목록보기의
   * "거리순" 정렬처럼 지도 바깥(부모 화면)에서도 내 위치가 필요한 경우에 써요. */
  onMyLocation?: (loc: { lat: number; lng: number }) => void;
  /** 위치 권한 거부, 시간 초과, 또는 이 브라우저가 geolocation 자체를 지원하지
   * 않아서 내 위치를 가져오지 못했을 때 한 번 알려줘요. 부모 화면(길찾기 등)이
   * "현재 위치"라는 확정 문구 대신 "출발 위치 미확인" 안내를 보여줄 때 써요. */
  onMyLocationError?: () => void;
  /** 우측 하단에 명시적 확대/축소(+/−) 버튼을 보여줄지 여부. 핀치/스크롤로만
   * 확대축소가 가능해 데스크톱에서 불편하다는 피드백으로 추가했어요. */
  showZoomControls?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const meOverlayRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const myLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  // 내 위치로 지도를 처음 한 번만 자동으로 이동시키기 위한 플래그. 이후에는
  // pins가 바뀌어도(카카오카페 재검색 등) 지도를 임의로 다시 옮기지 않아요.
  const hasCenteredOnMeRef = useRef(false);

  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);

  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";

  // idle/onMyLocation 리스너는 지도 생성 시(useEffect 1회) 한 번만 등록하므로,
  // 매 렌더마다 바뀔 수 있는 콜백들은 ref로 최신값만 참조하게 해요.
  const onBoundsChangedRef = useRef(onBoundsChanged);
  useEffect(() => {
    onBoundsChangedRef.current = onBoundsChanged;
  }, [onBoundsChanged]);

  const onMyLocationRef = useRef(onMyLocation);
  useEffect(() => {
    onMyLocationRef.current = onMyLocation;
  }, [onMyLocation]);

  const onMyLocationErrorRef = useRef(onMyLocationError);
  useEffect(() => {
    onMyLocationErrorRef.current = onMyLocationError;
  }, [onMyLocationError]);

  // 1) SDK 로드 + 지도 최초 생성
  useEffect(() => {
    if (!appKey) {
      setSdkError("NEXT_PUBLIC_KAKAO_MAP_KEY가 설정되지 않았어요.");
      return;
    }
    if (!containerRef.current) return;

    let cancelled = false;

    loadKakaoMapSdk(appKey)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        const { kakao } = window;
        const center = new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng);
        mapRef.current = new kakao.maps.Map(containerRef.current, {
          center,
          level: 4,
        });
        setSdkReady(true);

        // 지도 이동/확대가 끝날 때마다(카카오맵 idle 이벤트) 현재 bounds를
        // 부모(지도 화면)에 알려줘요. 부모는 이 bounds로 GET /api/map/kakao-cafes를
        // 호출해서 그 범위 안의 실제 카페들을 가져와요.
        const reportBounds = () => {
          if (!mapRef.current || !onBoundsChangedRef.current) return;
          const bounds = mapRef.current.getBounds();
          const sw = bounds.getSouthWest();
          const ne = bounds.getNorthEast();
          onBoundsChangedRef.current({
            sw_lat: sw.getLat(),
            sw_lng: sw.getLng(),
            ne_lat: ne.getLat(),
            ne_lng: ne.getLng(),
          });
        };
        kakao.maps.event.addListener(mapRef.current, "idle", reportBounds);
        reportBounds();
      })
      .catch((err) => {
        if (!cancelled) setSdkError(err.message ?? "카카오맵 로드 중 오류가 발생했어요.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey]);

  // 1-1) 지도 컨테이너 크기에 맞춰 다시 그리기(relayout).
  // ⚠️ 카카오맵은 최초 생성 시점의 픽셀 크기로 지도를 그리고, 그 뒤 컨테이너의
  // CSS 크기(예: flex-1로 계산되는 높이)가 바뀌어도 스스로 다시 맞추지 않아요.
  // 이 페이지는 폰트가 늦게 로드되며 헤더 높이가 살짝 바뀌거나(Pretendard
  // 웹폰트), 화면 진입 직후 레이아웃이 한 번 더 정리되는 경우가 있는데, 그때
  // relayout()을 호출하지 않으면 실제 지도 타일은 예전 크기로 남아서 컨테이너
  // 안에 빈 공간이 생긴 것처럼 보여요(특히 화면 위쪽). ResizeObserver로 컨테이너
  // 크기가 바뀔 때마다 relayout()을 호출해서 항상 꽉 차게 유지해요.
  useEffect(() => {
    if (!sdkReady || !containerRef.current) return;
    const el = containerRef.current;

    const relayout = () => {
      if (!mapRef.current) return;
      const center = mapRef.current.getCenter();
      mapRef.current.relayout();
      // relayout()이 중심 좌표를 흐트러뜨릴 수 있어서, 되돌려놔요.
      mapRef.current.setCenter(center);
    };

    // 최초 진입 직후(폰트 로드/레이아웃 안정화 이후) 한 번 더 맞춰줘요.
    const initialTimer = window.setTimeout(relayout, 150);

    const observer = new ResizeObserver(() => relayout());
    observer.observe(el);

    return () => {
      window.clearTimeout(initialTimer);
      observer.disconnect();
    };
  }, [sdkReady]);

  // 2) 내 위치 가져오기 (지도가 준비된 후 1회)
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;
    const { kakao } = window;

    const placeMeOverlay = (lat: number, lng: number, recenter: boolean) => {
      myLocationRef.current = { lat, lng };
      const position = new kakao.maps.LatLng(lat, lng);

      if (meOverlayRef.current) meOverlayRef.current.setMap(null);
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="position:relative;width:16px;height:16px;">
          <div style="position:absolute;inset:-8px;border-radius:9999px;background:rgba(24,95,165,0.2);"></div>
          <div style="width:16px;height:16px;border-radius:9999px;border:2px solid white;background:#185FA5;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
        </div>`;
      meOverlayRef.current = new kakao.maps.CustomOverlay({
        position,
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 5,
      });
      meOverlayRef.current.setMap(mapRef.current);

      // ⚠️ 예전에는 내 위치를 구해도 지도 중심은 그대로 두고 마커만 찍었어요.
      // 그 상태에서 아래 3번 효과(핀 렌더링)가 CafeOn 매장 핀들에 맞춰 지도를
      // 강제로 다시 확대/축소(setBounds)하다 보니, 실제로는 대구에 있어도
      // 매장 mock 데이터가 몰려있는 서울(강남) 쪽으로 지도가 계속 끌려갔어요.
      // 이제 핀 기준 강제 이동 로직 자체를 없애고, 대신 내 위치를 구하는 데
      // 성공하면(최초 1회) 지도를 실제 내 위치로 중심 이동시켜요.
      if (recenter) {
        mapRef.current.setCenter(position);
        hasCenteredOnMeRef.current = true;
      }
      onMyLocationRef.current?.({ lat, lng });
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          placeMeOverlay(pos.coords.latitude, pos.coords.longitude, !hasCenteredOnMeRef.current),
        () => {
          // 위치 권한 거부/실패 시: 기본 좌표(DEFAULT_CENTER)에 그대로 머물러요.
          // 핀들의 위치로 지도를 억지로 맞추지 않아요 — mock/시드 데이터가
          // 특정 지역(서울)에 몰려 있으면 사용자의 실제 위치와 무관하게 지도가
          // 그쪽으로 옮겨가 버리는 원인이 되기 때문이에요.
          onMyLocationErrorRef.current?.();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      // 이 브라우저가 geolocation 자체를 지원하지 않는 경우예요.
      onMyLocationErrorRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady]);

  // 3) 핀(카페 마커) 렌더링 — pins가 바뀔 때마다 다시 그림
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;
    const { kakao } = window;

    overlaysRef.current.forEach((ov) => ov.setMap(null));
    overlaysRef.current = [];

    // 좌표가 없는(0,0) 핀은 그려도 의미가 없을 뿐 아니라, 아래 bounds 계산에
    // 섞이면 지도가 극단적으로 축소돼 실제 마커들이 거의 안 보이는 빈 화면처럼
    // 보이는 원인이 돼요. 호출하는 쪽에서 이미 걸러도, 여기서도 한 번 더 막아요.
    const validPins = pins.filter((p) => (p.lat !== 0 || p.lng !== 0) && Number.isFinite(p.lat) && Number.isFinite(p.lng));

    validPins.forEach((pin) => {
      const position = new kakao.maps.LatLng(pin.lat, pin.lng);
      const el = document.createElement("div");
      const isActive = activePinId === pin.id;
      const isKakao = pin.source === "KAKAO";
      el.style.cursor = "pointer";
      // CafeOn 등록 매장: 좌석 현황 색(여유/주의/혼잡) + 남은 좌석 수 원형 핀.
      // 카카오맵 일반 카페: CafeOn 매장과 헷갈리지 않도록 회색 계열의 작은 핀으로
      // 시각적으로 구분해요(카카오지도_카페나오기.txt "시각적으로 구분" 요구사항).
      el.innerHTML = isKakao
        ? `
        <div style="
          display:flex;align-items:center;justify-content:center;
          width:26px;height:26px;border-radius:9999px;
          border:2px solid white;color:white;font-size:13px;
          background:#8C8171;
          box-shadow:0 2px 5px rgba(0,0,0,0.22);
          transform:${isActive ? "scale(1.15)" : "scale(1)"};
          transition:transform 0.15s;
        ">☕</div>`
        : `
        <div style="
          display:flex;align-items:center;justify-content:center;
          width:36px;height:36px;border-radius:9999px;
          border:3px solid white;color:white;font-size:11px;font-weight:700;
          background:${pinColorHex[pin.status]};
          box-shadow:0 2px 6px rgba(0,0,0,0.25);
          transform:${isActive ? "scale(1.1)" : "scale(1)"};
          transition:transform 0.15s;
        ">${pin.filled ?? ""}</div>`;
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onPinClick?.(pin.id);
      });

      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: el,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: isActive ? 4 : 3,
      });
      overlay.setMap(mapRef.current);
      overlaysRef.current.push(overlay);
    });

    // ⚠️ 예전엔 여기서 핀이 바뀔 때마다 지도를 그 핀들에 맞춰 강제로
    // 재확대/이동(setBounds)했어요. 그런데 "이 지역 재검색" 버튼 도입으로
    // 카카오카페를 불러올 때마다 pins가 갱신되고, 그때마다 지도가 스스로
    // 움직이면 그게 다시 "지도 이동"(idle)으로 감지돼 또 새로 검색하는
    // 무한 루프에 빠질 수 있었고, 서울에 몰린 매장 mock 데이터 쪽으로 지도가
    // 계속 끌려가는 원인이기도 했어요. 이제 핀은 그리기만 하고, 지도 중심/확대는
    // 사용자의 실제 위치(2번 효과)와 사용자의 직접 조작(스크롤/버튼)에만 맡겨요.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, pins, activePinId]);

  // 4) 경로선(routeTo) — 내 위치 → 목적지 직선 경로
  useEffect(() => {
    if (!sdkReady || !mapRef.current) return;
    const { kakao } = window;

    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (!routeTo) return;

    const from = myLocationRef.current ?? DEFAULT_CENTER;
    const path = [
      new kakao.maps.LatLng(from.lat, from.lng),
      new kakao.maps.LatLng(routeTo.lat, routeTo.lng),
    ];
    polylineRef.current = new kakao.maps.Polyline({
      path,
      strokeWeight: 6,
      strokeColor: "#185FA5",
      strokeOpacity: 0.9,
      strokeStyle: "solid",
    });
    polylineRef.current.setMap(mapRef.current);

    const bounds = new kakao.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    mapRef.current.setBounds(bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady, routeTo]);

  const handleZoomClick = (direction: 1 | -1) => {
    if (!mapRef.current) return;
    // 카카오맵은 숫자가 작을수록 더 확대된 상태예요. 1(가장 확대)~14(가장 축소)
    // 범위 밖으로는 나가지 않게 막아요.
    const nextLevel = mapRef.current.getLevel() + direction;
    mapRef.current.setLevel(Math.min(14, Math.max(1, nextLevel)));
  };

  const handleLocateClick = () => {
    if (!mapRef.current || !window.kakao) return;
    if (myLocationRef.current) {
      const { kakao } = window;
      mapRef.current.panTo(
        new kakao.maps.LatLng(myLocationRef.current.lat, myLocationRef.current.lng)
      );
      return;
    }
    navigator.geolocation?.getCurrentPosition((pos) => {
      const { kakao } = window;
      const latlng = new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
      myLocationRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      mapRef.current.panTo(latlng);
    });
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#E4E9DA]">
      {/* ⚠️ 지도(+/-) 확대축소 버튼과 "현재 위치로" 버튼이 스크롤할 때만 잠깐
          보였다 사라지는 문제 수정: 카카오맵 SDK는 지도 내부에 자기 타일/마커
          레이어를 z-index를 명시해서 그려요(우리 핀 CustomOverlay에도
          zIndex: 3~5를 직접 주고 있어요). 그런데 이 컨테이너(containerRef)
          자체는 그동안 position이 지정돼 있지 않아서 별도의 stacking context를
          만들지 못했고, 그 결과 카카오맵 내부 레이어들의 z-index가 이
          컴포넌트 바깥의 형제 요소(확대축소 버튼 등, z-index 없음)와 직접
          경쟁하면서 버튼들이 지도 아래로 깔려버렸어요(스크롤 시 브라우저가
          다시 그리는 순간에만 DOM 순서대로 잠깐 보였다 사라진 것도 같은
          원인이에요). relative + z-0을 줘서 지도 내부 레이어를 이 안에
          완전히 가둬요. */}
      <div ref={containerRef} className="relative z-0 h-full w-full" />

      {sdkError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#E4E9DA] p-6 text-center text-[13px] text-ink-secondary">
          지도를 불러오지 못했어요.
          <br />
          {sdkError}
        </div>
      )}

      {showZoomControls && (
        <div className="absolute bottom-20 right-4 z-10 flex flex-col overflow-hidden rounded-2xl bg-white shadow-card">
          <button
            aria-label="확대"
            onClick={() => handleZoomClick(-1)}
            className="flex h-11 w-11 items-center justify-center border-b border-border text-ink-secondary"
          >
            <Plus size={18} />
          </button>
          <button
            aria-label="축소"
            onClick={() => handleZoomClick(1)}
            className="flex h-11 w-11 items-center justify-center text-ink-secondary"
          >
            <Minus size={18} />
          </button>
        </div>
      )}

      <button
        aria-label="현재 위치로"
        onClick={handleLocateClick}
        className="absolute bottom-5 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-card"
      >
        <Locate size={19} className="text-ink-secondary" />
      </button>
    </div>
  );
}
