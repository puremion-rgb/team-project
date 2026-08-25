"use client";

import Link from "next/link";
import { Star } from "lucide-react";
import type { Cafe } from "@/lib/data";
import ImagePlaceholder from "./ImagePlaceholder";
import StatusBadge from "./StatusBadge";
import FavoriteButton from "./FavoriteButton";

export default function CafeListCard({
  cafe,
  onToggleLike,
  showUpdatedAt = false,
  rightAction = "like",
  href,
  onClick,
}: {
  cafe: Cafe;
  onToggleLike?: (id: string) => void;
  showUpdatedAt?: boolean;
  /** "like": 찜 하트 버튼 (기본) / "route": 길찾기 링크 */
  rightAction?: "like" | "route";
  /** 기본은 카페 상세로 이동하는 링크. 지도 카드처럼 다른 동작이 필요하면 전달 */
  href?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href ?? `/cafe/${cafe.id}`}
      onClick={onClick}
      className="flex items-center gap-4 rounded-2xl border border-border bg-white p-3 shadow-card"
    >
      {/* 사장님이 매장 프로필에서 등록한 대표 이미지가 있으면 보여주고,
          없으면 기존 회색 플레이스홀더로 자동 폴백해요.
          ⚠️ items-center를 안 주면 찜한 카페처럼 showUpdatedAt으로 텍스트
          줄이 하나 더 있는 카드에서는 오른쪽 글줄이 이미지보다 길어져서
          카드가 더 커지고, 이미지(96px 정사각형 고정)는 위쪽에 붙은 채
          아래에 빈 공간이 남아 마치 정사각형이 아닌 것처럼 보였어요.
          세로 중앙 정렬로 바꿔서 텍스트 줄 수와 상관없이 이미지가 항상
          카드 한가운데의 정사각형으로 보이게 해요. */}
      <ImagePlaceholder className="w-24 h-24 shrink-0" src={cafe.imageUrl} alt={cafe.name} />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[17px] font-bold text-ink">
            {cafe.name}
          </h3>
          {rightAction === "route" ? (
            <Link
              href={`/cafe/${cafe.id}/route`}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 text-[13px] font-bold text-brand"
            >
              길찾기 ›
            </Link>
          ) : (
            <span
              className="shrink-0"
              onClick={(event) => event.preventDefault()}
            >
              <FavoriteButton
                liked={cafe.liked}
                onToggle={() => onToggleLike?.(cafe.id)}
              />
            </span>
          )}
        </div>
        <p className="flex items-center gap-1 text-[13px] text-ink-secondary">
          <Star size={13} className="fill-amber text-amber" />
          {cafe.rating} ({cafe.reviewCount})
          {cafe.distance && cafe.distance !== "-" && ` · ${cafe.distance}`}
        </p>
        <div>
          <StatusBadge status={cafe.status} filled={cafe.seatsFilled} total={cafe.seatsTotal} />
        </div>
        {showUpdatedAt && (
          <p className="text-[12px] text-ink-muted">{cafe.updatedAgo}</p>
        )}
      </div>
    </Link>
  );
}
