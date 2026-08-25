"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, MapPin as MapPinIcon } from "lucide-react";
import MapPlaceholder from "@/components/MapPlaceholder";
import { useStores } from "@/lib/stores-store";

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
  // 자동으로 알려줘요(map/page.tsx와 동일한 방식). 화면에는 이 값을 더 이상
  // 보여주지 않지만(요청에 따라 도보 거리/시간 표시를 없앴어요), 카카오맵
  // 딥링크의 출발지("내 위치 → 목적지")를 채우는 데는 계속 써요 — 값이 아직
  // 없으면 목적지만 있는 링크로 자연스럽게 대체돼요.
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);

  // ⚠️ 이 화면은 실제 도로를 따라가는 길 안내는 하지 않아요(직선 거리로 도보
  // 시간을 추정만 할 뿐이라 카카오 실제 경로와 값이 안 맞을 수 있어서, 요청에
  // 따라 그 표시 자체를 지웠어요). 실제 도로 기반 경로(꺾이는 길, 건물
  // 진입로 등)를 우리 앱 지도 위에 그대로 그리려면 카카오모빌리티 "도보
  // 길찾기 API"가 필요한데, 이 API는 제휴 파트너 전용이라 사전 제휴 계약이
  // 있어야 키가 열리고, REST 키를 서버에서만 써야 해서(브라우저 노출 불가)
  // 백엔드에 별도 프록시 엔드포인트도 있어야 해요 — 지금 전달받은 API
  // 문서엔 그런 엔드포인트가 없어요. 그래서 실제 경로는 카카오맵 앱/웹으로
  // 바로 넘겨서(딥링크) 보여줘요.
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
    // 아래로 스크롤해야 나머지가 보이는 상태가 돼요. map/page.tsx에 적용한 것과
    // 같은 방식으로 고정해요 — 이 화면도 지도 홈 화면처럼 화면 전체(inset-0)를
    // 지도가 꽉 채워요.
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="absolute inset-0">
        <MapPlaceholder
          pins={pins}
          activePinId={cafe.id}
          // ⚠️ 예전엔 여기서 routeTo로 출발지→목적지 직선을 지도 위에 그렸는데,
          // 실제 도로를 따라가는 경로가 아니라 건물·도로를 무시하고 가로지르는
          // 직선이라 "진짜 경로처럼 보이지만 실제로는 안 맞는" 오해를 줬어요.
          // 실제 경로는 아래 "실제 경로 보기" 버튼(카카오맵)으로만 보여줘요.
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
        <div className="flex h-11 flex-1 items-center rounded-full border-2 border-sage bg-sage-tint px-5 text-[14px] font-bold text-sage-dark shadow-card">
          <span className="truncate">현재 위치 → {cafe.name}</span>
        </div>
      </div>

      {/* 요청에 따라 도보 거리/소요시간 표시(카카오 실제 경로와 값이 안 맞을 수
          있어요)는 없애고, 가게 이름·주소와 "실제 경로 보기" 버튼만 남겼어요.
          이 카드가 스크롤할 때만 잠깐 보였다 사라지던 문제도 지도 화면과
          동일한 원인이었어요(z-index 없는 형제 요소가 카카오맵 내부 레이어
          아래로 깔림). z-10을 명시해서 항상 지도 위에 뜨게 해요. */}
      <div className="absolute inset-x-4 bottom-6 z-10 rounded-2xl bg-white p-5 shadow-sheet">
        <p className="text-[16px] font-bold text-ink">{cafe.name}</p>
        <p className="mt-1 text-[13px] text-ink-secondary">{cafe.address}</p>
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
      </div>
    </div>
  );
}
