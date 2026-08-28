"use client";

import { useState } from "react";
import { Check, Megaphone, Star, X } from "lucide-react";
import ImagePlaceholder from "@/components/ImagePlaceholder";

/**
 * 지도 화면에 뜨는 "광고" 팝업 카드예요. 교수님 피드백으로 논의된 수익모델
 * (카페 사장님이 비용을 내면 지도에서 노출되는 광고) 컨셉을 화면으로 보여주기
 * 위한 프론트엔드 목업이에요 — 실제 결제/광고 신청 기능이나 광고 서버 연동은
 * 없고, 지금 지도에 표시 중인 카페 중 하나를 "광고"로 골라서 보여줘요.
 *
 * ⚠️ X를 누르면 일단 이 화면에서는 바로 닫혀요. "24시간 안 보기"를 체크하지
 * 않았으면 map/page.tsx가 localStorage에 아무것도 남기지 않아서, 다른 화면
 * 갔다가 지도로 돌아오면(컴포넌트가 새로 마운트되며) 광고가 다시 떠요.
 * 체크하고 닫으면 24시간 동안 계속 숨겨져 있어요.
 */
export type SponsoredCafeInfo = {
  id: string;
  name: string;
  imageUrl?: string | null;
  rating: number;
  reviewCount: number;
  distanceLabel: string;
};

export default function SponsoredCafeCard({
  cafe,
  onClick,
  onClose,
}: {
  cafe: SponsoredCafeInfo;
  onClick: () => void;
  /** dontShowForDay가 true면 24시간 동안 광고를 계속 숨기고, false면 지금
   * 화면에서만 닫혀요(map/page.tsx에서 처리). */
  onClose: (dontShowForDay: boolean) => void;
}) {
  const [dontShowForDay, setDontShowForDay] = useState(false);

  return (
    <div className="pointer-events-auto relative flex items-center gap-3 rounded-2xl border border-amber/50 bg-white p-3 pr-9 shadow-card">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose(dontShowForDay);
        }}
        aria-label="광고 닫기"
        className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-cream text-ink-muted"
      >
        <X size={14} />
      </button>

      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <ImagePlaceholder
          className="h-16 w-16 shrink-0"
          src={cafe.imageUrl}
          alt={cafe.name}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-tint px-2 py-0.5 text-[10.5px] font-bold text-amber-dark">
              <Megaphone size={10} strokeWidth={2.5} />
              광고
            </span>
            <span className="truncate text-[13.5px] font-bold text-ink">{cafe.name}</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[12px] text-ink-secondary">
            <Star size={12} className="fill-amber text-amber" />
            {cafe.rating} ({cafe.reviewCount}) · {cafe.distanceLabel}
          </p>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[11.5px] text-ink-muted">
              지금 내 주변에서 추천하는 카페예요
            </p>
            {/* ⚠️ 카드 안의 클릭 가능한 버튼(카페 상세로 이동)과 겹쳐 있어서,
                실수로 상세 화면으로 안 넘어가게 stopPropagation을 꼭 해줘요. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDontShowForDay((v) => !v);
              }}
              className="flex shrink-0 items-center gap-1 text-[10.5px] text-ink-muted"
            >
              <span
                className={
                  "flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border " +
                  (dontShowForDay ? "border-amber-dark bg-amber-dark" : "border-border bg-white")
                }
              >
                {dontShowForDay && <Check size={9} strokeWidth={3.2} className="text-white" />}
              </span>
              24시간 안 보기
            </button>
          </div>
        </div>
      </button>
    </div>
  );
}
