"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAuth, isPublicPath } from "@/lib/auth-store";

function LoginRequiredGate() {
  const router = useRouter();

  return (
    // ⚠️ 바로 전 수정(이미지가 "남는 공간을 전부" 채우는 flex-1 방식)은
    // 화면이 큰 일반 폰에서는 이미지가 화면 절반 넘게 차지할 만큼 과하게
    // 커져버렸어요. 그래서 "화면 높이의 일정 비율(32%)"로 고정하되
    // min-h/max-h로 위아래 한계를 둬서, 화면이 작은 폰이든 큰 폰이든
    // 일반적인 폰 크기 범위 안에서는 늘 비슷하게 "적당한" 크기로 보이고,
    // 아래 로그인/회원가입/나중에 할게요 버튼까지 스크롤 없이 들어오게 했어요.
    <div className="flex min-h-dvh flex-col">
      <div className="flex h-14 items-center px-4">
        <button onClick={() => router.back()} aria-label="뒤로가기" className="text-ink">
          <ChevronLeft size={24} />
        </button>
      </div>

      <div className="px-6">
        <Image
          src="/images/login-required.png"
          alt=""
          width={491}
          height={546}
          className="h-[32vh] min-h-[180px] max-h-64 w-full rounded-2xl object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col px-6">
        <h2 className="mt-6 text-center text-[22px] font-bold leading-snug text-ink">
          해당 기능을 이용하려면
          <br />
          로그인이 필요해요
        </h2>
        <p className="mt-3 text-center text-[14px] text-ink-secondary">
          로그인하면 주문하고 포인트도 적립할 수 있어요.
        </p>

        <div className="mt-6 flex flex-col gap-3 pb-6">
          <Link
            href="/login"
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-[16px] font-bold text-white"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="flex h-14 w-full items-center justify-center rounded-2xl border border-brand text-[16px] font-bold text-brand"
          >
            회원가입
          </Link>
          <button
            onClick={() => router.push("/map")}
            className="text-center text-[13.5px] text-ink-secondary"
          >
            나중에 할게요
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, authReady } = useAuth();
  const pathname = usePathname();

  // 지도/검색/카페상세처럼 원래 로그인 없이도 보이는 화면은 로그인 확인을
  // 기다릴 필요 없이 바로 보여줘요(기존 동작 그대로).
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  // ⚠️ 로그인 여부를 아직 확인 중(authReady === false)일 때는 "로그인이
  // 필요해요" 화면을 보여주지 않아요. 여기서 바로 판단해버리면 실제로는
  // 로그인된 사용자에게도 그 화면이 잠깐 나타났다 사라지는 깜빡임이
  // 생겨요(결제 화면 등에서 보고된 문제의 원인). 확인이 끝날 때까지는
  // 빈 화면으로 잠깐 대기해요.
  if (!authReady) {
    return null;
  }

  if (!isLoggedIn) {
    return <LoginRequiredGate />;
  }

  return <>{children}</>;
}
