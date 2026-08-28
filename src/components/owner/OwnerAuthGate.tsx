"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOwnerAuth } from "@/lib/owner-auth-store";

export default function OwnerAuthGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isOwnerLoggedIn, ownerAuthReady } = useOwnerAuth();
  const router = useRouter();

  useEffect(() => {
    // ⚠️ ownerAuthReady가 true가 되기 전(=아직 저장된 로그인 정보를 확인하기
    // 전)에는 리다이렉트하면 안 돼요. 예전엔 isOwnerLoggedIn의 초기값(false)만
    // 보고 판단해서, 실제로는 로그인된 사장님도 화면에 들어올 때마다 아주
    // 잠깐 /owner/login으로 튕겨나갔다가 곧바로 원래 화면으로 돌아오는(또는
    // 로그인 화면이 깜빡이는) 문제가 있었어요.
    if (ownerAuthReady && !isOwnerLoggedIn) {
      router.replace("/owner/login");
    }
  }, [isOwnerLoggedIn, ownerAuthReady, router]);

  if (!ownerAuthReady) return null;
  if (!isOwnerLoggedIn) return null;

  return <>{children}</>;
}
