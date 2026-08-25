"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Circle } from "lucide-react";
import { useOwnerAuth } from "@/lib/owner-auth-store";
import { getSocialLoginUrl, type SocialProvider } from "@/lib/api";

export default function OwnerLoginPage() {
  const router = useRouter();
  const { ownerLogin, ownerAuthLoading } = useOwnerAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const result = await ownerLogin(email, password);
    if (result.ok) {
      router.push("/owner");
    } else {
      setError(result.error);
    }
  };

  const handleSocialLogin = (provider: SocialProvider) => {
    setError(null);
    // 백엔드가 카카오/구글/네이버 로그인 페이지로 보내주고,
    // 끝나면 /owner/login/callback 으로 다시 돌아와요.
    window.location.href = getSocialLoginUrl(provider, "owner");
  };

  return (
    <div className="flex min-h-dvh flex-col bg-cream px-6 pb-10">
      <div className="flex h-14 items-center">
        <button
          onClick={() => router.back()}
          aria-label="뒤로가기"
          className="text-ink"
        >
          <ChevronLeft size={24} />
        </button>
      </div>

      <Image
        src="/images/logo.png"
        alt="CafeOn"
        width={144}
        height={28}
        priority
        className="mx-auto mt-12 h-7 w-auto object-contain"
      />
      <p className="mt-2 text-center text-[14px] text-ink-secondary">
        CafeON 사장님 계정으로 로그인
      </p>

      <form className="mt-8 flex flex-col gap-3" onSubmit={handleLogin}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일 주소"
          autoComplete="email"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-trust/30"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          autoComplete="current-password"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-trust/30"
        />
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <div className="mt-2">
          <button
            type="submit"
            disabled={ownerAuthLoading}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-trust text-[16px] font-bold text-white active:bg-trust-dark disabled:opacity-60"
          >
            {ownerAuthLoading ? "로그인 중..." : "로그인"}
          </button>
        </div>
      </form>

      <div className="my-6 flex items-center gap-3 text-[13px] text-ink-muted">
        <div className="h-px flex-1 bg-border" />
        또는
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => handleSocialLogin("kakao")}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-white text-[15px] font-medium text-ink"
        >
          <Circle size={16} className="fill-[#FEE500] text-[#FEE500]" />
          카카오로 로그인
        </button>
        {/* ⚠️ 2026-08-25: 네이버 로그인 버튼은 요청에 따라 화면에서만 잠시
            뺐어요. handleSocialLogin("naver") 호출부와 api.ts의
            SocialProvider="naver" 타입/로직은 그대로 남겨뒀으니, 나중에
            네이버 로그인을 다시 켤 땐 이 버튼만 복원하면 돼요. */}
        <button
          type="button"
          onClick={() => handleSocialLogin("google")}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-white text-[15px] font-medium text-ink"
        >
          <span className="font-extrabold text-trust">G</span>
          구글로 로그인
        </button>
      </div>

      <p className="mt-auto pt-10 text-center text-[13px] text-ink-secondary">
        계정이 없으신가요?{" "}
        <Link href="/owner/signup" className="font-bold text-trust">
          회원가입
        </Link>
      </p>
    </div>
  );
}
