"use client";

import { useState } from "react";
import Header from "@/components/Header";
import FilterChips, { FilterKey } from "@/components/FilterChips";
import CafeListCard from "@/components/CafeListCard";
import { useWishlist } from "@/lib/wishlist-store";

export default function WishlistPage() {
  const [filter, setFilter] = useState<FilterKey>("전체");
  const { cafes, toggleLike, favoritesLoadFailed } = useWishlist();

  const filtered = cafes
    .filter((c) => c.liked)
    .filter((c) => filter === "전체" || c.status === filter);

  return (
    <div className="flex flex-col">
      <Header title="찜한 카페" />
      <FilterChips
        options={["전체", "여유", "주의", "혼잡"]}
        value={filter}
        onChange={setFilter}
      />
      <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
        {/* ⚠️ 찜 목록을 서버에서 아예 못 불러왔을 때(주로 로그인 토큰 문제)와
            "정말로 찜한 카페가 0개"를 구분해서 보여줘요. 예전엔 둘 다 똑같이
            "찜한 카페가 없어요"로만 보여서, 다른 주소(예: 192.168.x.x)로 접속했을
            때 로그인이 실제로 안 돼 있는 상태인데도 그냥 "0개"로만 보였어요. */}
        {filtered.length === 0 && favoritesLoadFailed && (
          <p className="mt-16 text-center text-[14px] text-ink-muted">
            찜한 카페 목록을 불러오지 못했어요.
            <br />이 기기·이 주소에서 로그인이 돼 있는지 확인한 뒤 다시
            시도해주세요.
          </p>
        )}
        {filtered.length === 0 && !favoritesLoadFailed && (
          <p className="mt-16 text-center text-[14px] text-ink-muted">
            찜한 카페가 없어요.
          </p>
        )}
        {filtered.map((cafe) => (
          <CafeListCard key={cafe.id} cafe={cafe} onToggleLike={toggleLike} showUpdatedAt />
        ))}
      </div>
    </div>
  );
}
