"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Circle } from "lucide-react";
import Button from "@/components/Button";
import { useAuth } from "@/lib/auth-store";
import { getSocialLoginUrl, type SocialProvider } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const { signup, authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 소셜 계정이 처음이면 백엔드가 계정을 생성하고, 기존 계정이면 바로 로그인해요.
  // 로그인과 회원가입 화면 모두에서 같은 진입점을 제공해 사용자가 "가입 화면에서는
  // 소셜 로그인을 못 하나?"라고 혼란스럽지 않도록 해요.
  const handleSocialSignup = (provider: SocialProvider) => {
    setError(null);
    window.location.href = getSocialLoginUrl(provider, "customer");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요.");
      return;
    }

    const result = await signup({ name, email, password });
    if (result.ok) {
      router.push("/map");
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-cream px-6 pb-10">
      <div className="flex h-14 items-center">
        <button onClick={() => router.back()} aria-label="뒤로가기" className="text-ink">
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
        CafeON 손님 계정으로 시작해요
      </p>

      <form className="mt-8 flex flex-col gap-3" onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일 주소"
          autoComplete="email"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호 (8자 이상)"
          autoComplete="new-password"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="비밀번호 확인"
          autoComplete="new-password"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          autoComplete="name"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30"
        />


        {error && <p className="text-[13px] text-danger">{error}</p>}

        <div className="mt-4">
          <Button type="submit" disabled={authLoading}>
            {authLoading ? "가입 중..." : "회원가입"}
          </Button>
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
          onClick={() => handleSocialSignup("kakao")}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-white text-[15px] font-medium text-ink"
        >
          <Circle size={16} className="fill-[#FEE500] text-[#FEE500]" />
          카카오로 시작하기
        </button>
        <button
          type="button"
          onClick={() => handleSocialSignup("google")}
          className="flex h-14 items-center justify-center gap-2 rounded-2xl border border-border bg-white text-[15px] font-medium text-ink"
        >
          <span className="font-extrabold text-brand">G</span>
          구글로 시작하기
        </button>
      </div>

      <p className="mt-auto pt-10 text-center text-[13px] text-ink-secondary">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="font-bold text-brand">
          로그인
        </Link>
      </p>
    </div>
  );
}
