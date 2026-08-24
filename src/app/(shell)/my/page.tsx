"use client";

import Header from "@/components/Header";
import ListRow from "@/components/ListRow";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { useAuth } from "@/lib/auth-store";
import { resolveImageUrl } from "@/lib/api";

export default function MyPage() {
  const { profile, profileLoading, logout } = useAuth();
  const displayName = profile.name.trim() ? `${profile.name}님` : "회원님";
  const avatarUrl = resolveImageUrl(profile.profileImageUrl);

  return (
    <div className="flex flex-col">
      <Header title="MY" />

      <div className="px-6 pt-5">
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-white p-5">
          {/* ⚠️ 예전엔 avatarUrl이 있으면 무조건 <img>로 바로 그렸는데, 그
              주소가 실제로는 안 열리는 경우(백엔드 접속 불가 등) 브라우저
              기본 "깨진 이미지" 아이콘이 그대로 보였어요. ImagePlaceholder는
              로드에 실패하면 자동으로 회색 아이콘으로 대체해줘서 더 안전해요. */}
          <ImagePlaceholder
            className="h-16 w-16 shrink-0"
            rounded="rounded-full"
            src={avatarUrl}
            alt="프로필 사진"
          />
          <div>
            <p className="text-[18px] font-bold text-ink">
              {profileLoading ? "불러오는 중..." : displayName}
            </p>
            {profile.email && (
              <p className="mt-0.5 text-[13px] text-ink-muted">{profile.email}</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 px-6 pb-8">
        <ListRow href="/my/profile" label="프로필 관리" />
        <ListRow href="/my/reviews" label="리뷰 관리" />
        <ListRow href="/my/settings" label="설정" />
        <ListRow href="/my/support" label="고객센터" />
        <ListRow href="/map" label="로그아웃" danger onClick={() => logout()} />
      </div>
    </div>
  );
}
