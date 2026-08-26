"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Circle } from "lucide-react";
import { useOwnerAuth } from "@/lib/owner-auth-store";
import { getSocialLoginUrl, type SocialProvider } from "@/lib/api";

export default function OwnerSignupPage() {
  const router = useRouter();
  const { ownerSignup, ownerAuthLoading } = useOwnerAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 손님쪽 회원가입 화면과 동일하게, 사장님쪽도 로그인 화면(owner/login)과 같은
  // 소셜 시작하기 진입점을 회원가입 화면에도 제공해요. 소셜 계정이 처음이면
  // 백엔드가 계정을 만들고, 기존 계정이면 바로 로그인시켜줘요.
  const handleSocialSignup = (provider: SocialProvider) => {
    setError(null);
    window.location.href = getSocialLoginUrl(provider, "owner");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("비밀번호가 일치하지 않아요.");
      return;
    }

    const result = await ownerSignup({
      name,
      email,
      password,
      passwordConfirmation: passwordConfirm,
      phone,
      storeName,
    });
    if (result.ok) {
      router.push("/owner");
    } else {
      setError(result.error);
    }
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
        CafeON 사장님 계정으로 시작해요
      </p>

      <form className="mt-8 flex flex-col gap-3" onSubmit={handleSubmit}>
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
          autoComplete="new-password"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-trust/30"
        />
        <input
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="비밀번호 확인"
          autoComplete="new-password"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-trust/30"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          autoComplete="name"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-trust/30"
        />
        <input
          type="text"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          placeholder="매장명"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-trust/30"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="휴대폰 번호"
          autoComplete="tel"
          className="h-14 rounded-2xl border border-border bg-white px-5 text-[15px] placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-trust/30"
        />

        {error && <p className="text-[13px] text-danger">{error}</p>}

        <div className="mt-4">
          <button
            type="submit"
            disabled={ownerAuthLoading}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-trust text-[16px] font-bold text-white active:bg-trust-dark disabled:opacity-60"
          >
            {ownerAuthLoading ? "가입 중..." : "회원가입"}
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
          <span className="font-extrabold text-trust">G</span>
          구글로 시작하기
        </button>
      </div>

      <p className="mt-auto pt-10 text-center text-[13px] text-ink-secondary">
        이미 계정이 있으신가요?{" "}
        <Link href="/owner/login" className="font-bold text-trust">
          로그인
        </Link>
      </p>
    </div>
  );
}
