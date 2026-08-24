"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin as MapPinIcon, Locate } from "lucide-react";
import MapPlaceholder from "@/components/MapPlaceholder";
import { useStores } from "@/lib/stores-store";

// 두 좌표 사이의 실제 직선 거리(m). map/page.tsx의 "거리순" 정렬과 동일한 공식이에요
// (Haversine). 예전엔 이 화면이 cafe.distance("-" 문자열, 실서버 데이터엔 애초에 값이
// 없어요)에서 숫자만 뽑아 쓰려고 해서 항상 NaN → "도보 1분"으로 고정 표시됐어요.
// 실제 내 위치와 카페 좌표로 직접 계산해야 맞는 거리/시간이 나와요.
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

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

// 성인 평균 도보 속도 기준 약 75m/분.
function estimateWalkMinutes(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 1;
  return Math.max(1, Math.round(meters / 75));
}

export default function CafeRoutePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  // ⚠️ 예전엔 @/lib/data의 mock cafes/getCafe를 그대로 썼어요. 이제 실제 서버
  // 매장 목록(useStores)에서 찾아요.
  const { getCafe } = useStores();
  const cafe = getCafe(params.id);
  // ⚠️ 예전엔 지도 전체 카페 목록(cafes)을 그대로 pins로 넘겨서, 길찾기로
  // 들어온 화면인데도 다른 카페 마커가 다 같이 찍혔어요. 이 화면은 "이
  // 카페까지 가는 길"만 보여주면 되니, 목적지 카페 하나만 pin으로 넘겨요.
  const destPin = cafe ? { id: cafe.id, status: cafe.status, lat: cafe.lat, lng: cafe.lng } : null;
  const pins = useMemo(() => (destPin ? [destPin] : []), [destPin]);

  // 내 실제 위치(위경도). MapPlaceholder가 geolocation을 성공적으로 가져오면
  // 알려줘요(map/page.tsx와 동일한 방식). 이 값이 오기 전까지는 경로선을 그리지
  // 않아요.
  // ⚠️ 예전엔 내 위치를 몰라도 MapPlaceholder 내부에서 곧바로 "기본 좌표(강남역
  // 인근)"를 출발점 삼아 목적지까지 직선을 그렸어요. 카페가 대구 등 강남과 먼
  // 지역이면 두 지점을 모두 담으려고 지도가 남한 전체가 보일 정도로 축소돼서,
  // "화면 위쪽엔 작은 지도, 아래쪽엔 한반도 전체" 처럼 보이는 원인이었어요.
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  // 6초가 지나도 위치를 못 받아오면(권한 거부/GPS 실패) "확인하는 중이에요"
  // 문구가 영원히 떠 있지 않도록 안내 문구+재시도 버튼으로 전환해요.
  useEffect(() => {
    if (myLocation) return;
    const timer = window.setTimeout(() => setLocationDenied(true), 6000);
    return () => window.clearTimeout(timer);
  }, [myLocation]);

  // ⚠️ 이 화면은 (Haversine) 직선 거리로 도보 시간을 "추정"만 할 뿐, 실제
  // 도로를 따라가는 길 안내는 하지 않아요. 예전엔 지도 위에 출발지→목적지
  // 직선을 그리고 "경로 안내 시작" 버튼으로 마치 실시간 안내를 하는 것처럼
  // 보여줬는데, 실제로는 건물·도로를 무시하고 가로지르는 직선이라 오해를
  // 줄 수 있어서(요청하신 대로) 지웠어요. 실제 도로 기반 경로(꺾이는 길,
  // 건물 진입로 등)를 우리 앱 지도 위에 그대로 그리려면 카카오모빌리티
  // "도보 길찾기 API"가 필요한데, 이 API는 제휴 파트너 전용이라 사전
  // 제휴 계약이 있어야 키가 열리고, REST 키를 서버에서만 써야 해서(브라우저
  // 노출 불가) 백엔드에 별도 프록시 엔드포인트도 있어야 해요 — 지금 전달받은
  // API 문서엔 그런 엔드포인트가 없어요. 그래서 지금은 "현재 위치 → 목적지"
  // 정도의 정직한 정보만 보여주고, 실제 경로는 카카오맵 앱/웹으로 바로
  // 넘겨서(딥링크) 보여줘요.
  const kakaoDirectionsUrl = useMemo(() => {
    if (!cafe) return null;
    const destName = encodeURIComponent(cafe.name);
    const to = `${destName},${cafe.lat},${cafe.lng}`;
    if (myLocation) {
      const from = `${encodeURIComponent("내 위치")},${myLocation.lat},${myLocation.lng}`;
      return `https://map.kakao.com/link/from/${from}/to/${to}`;
    }
    return `https://map.kakao.com/link/to/${to}`;
  }, [cafe, myLocation]);

  const distanceM = useMemo(
    () => (myLocation && destPin ? distanceMeters(myLocation, destPin) : null),
    [myLocation, destPin]
  );
  const walkMinutes = distanceM !== null ? estimateWalkMinutes(distanceM) : null;
  const distanceLabel = distanceM !== null ? formatDistance(distanceM) : null;

  if (!cafe) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] text-ink-secondary">
          카페 정보를 불러오는 중이거나, 존재하지 않는 카페예요.
        </p>
        <button onClick={() => router.back()} className="text-[14px] font-bold text-brand">
          뒤로가기
        </button>
      </div>
    );
  }

  return (
    // ⚠️ min-h-0이 없으면 이 화면이 부모(overflow-y-auto인 셸 레이아웃)보다
    // 커질 수 있어서 페이지 자체가 스크롤되고, 지도가 상단바 높이만큼만 보이다가
    // 아래로 스크롤해야 나머지가 보이는 상태가 돼요(전달주신 스크린샷의 증상과
    // 동일해요). map/page.tsx에 적용한 것과 같은 방식으로 고정해요 — 이제 이
    // 화면도 지도 홈 화면처럼 화면 전체(inset-0)를 지도가 꽉 채워요.
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="absolute inset-0">
        <MapPlaceholder
          pins={pins}
          activePinId={cafe.id}
          // ⚠️ 예전엔 여기서 routeTo로 출발지→목적지 직선을 지도 위에 그렸는데,
          // 실제 도로를 따라가는 경로가 아니라 건물·도로를 무시하고 가로지르는
          // 직선이라 "진짜 경로처럼 보이지만 실제로는 안 맞는" 오해를 줬어요.
          // 실제 경로는 아래 "카카오맵에서 실제 경로 보기"로만 보여줘요.
          onMyLocation={setMyLocation}
          showZoomControls
        />
      </div>

      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pt-5">
        <button
          aria-label="뒤로가기"
          onClick={() => router.back()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-card"
        >
          <ChevronLeft size={22} />
        </button>
        {/* ⚠️ 예전엔 여기(초록 배지)에 "877m · 도보 12분"처럼 거리/시간을
            보여줬는데, 요청에 따라 그 대신 "현재 위치 → 목적지" 형태로
            바꿨어요. 거리/시간은 아래 카드에 그대로 남겨둬요. */}
        <div className="flex h-11 flex-1 items-center rounded-full border-2 border-sage bg-sage-tint px-5 text-[14px] font-bold text-sage-dark shadow-card">
          <span className="truncate">현재 위치 → {cafe.name}</span>
        </div>
      </div>

      {/* ⚠️ 이 카드가 스크롤할 때만 잠깐 보였다 사라지던 문제도 지도 화면과
          동일한 원인이었어요(z-index 없는 형제 요소가 카카오맵 내부 레이어
          아래로 깔림). z-10을 명시해서 항상 지도 위에 뜨게 해요. */}
      <div className="absolute inset-x-4 bottom-6 z-10 rounded-2xl bg-white p-5 shadow-sheet">
        {distanceLabel && walkMinutes !== null ? (
          <>
            <p className="text-[18px] font-bold text-ink">도보 {distanceLabel}</p>
            <p className="mt-1 text-[13px] text-ink-secondary">
              약 {walkMinutes}분 소요 · 직선 거리 기준
            </p>
          </>
        ) : locationDenied ? (
          <>
            <p className="text-[18px] font-bold text-ink">내 위치를 확인할 수 없어요</p>
            <p className="mt-1 text-[13px] text-ink-secondary">
              위치 권한을 허용하면 카페까지 거리/시간을 계산해드려요
            </p>
          </>
        ) : (
          <p className="text-[15px] font-bold text-ink">내 위치를 확인하는 중이에요...</p>
        )}
        {/* 요청에 따라 목적지 이름 + 주소를 함께 보여줘요(예전엔 이름만
            있었어요). */}
        <p className="mt-1 text-[14px] font-bold text-ink">{cafe.name}</p>
        <p className="mt-0.5 text-[13px] text-ink-secondary">{cafe.address}</p>
        {/* 이 화면 자체는 실제 도로 기반 길 안내를 하지 않기 때문에(위 주석
            참고), "경로 안내 시작" 같은 실시간 안내를 흉내 내는 버튼은 없애고
            실제 도보/대중교통/자동차 경로를 계산해주는 카카오맵으로 바로
            넘기는 버튼 하나만 남겼어요. 버튼 문구는 요청대로 "실제 경로
            보기"로 줄였어요. */}
        {kakaoDirectionsUrl && (
          <a
            href={kakaoDirectionsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[15px] font-bold text-white"
          >
            <MapPinIcon size={17} />
            실제 경로 보기
          </a>
        )}
        {!myLocation && !locationDenied && (
          <button
            onClick={() => {
              navigator.geolocation?.getCurrentPosition(
                (pos) => setMyLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => setLocationDenied(true),
                { enableHighAccuracy: true, timeout: 5000 }
              );
            }}
            className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-[13px] font-bold text-ink-secondary"
          >
            <Locate size={14} />
            위치 다시 확인하기
          </button>
        )}
      </div>
    </div>
  );
}
