"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-store";

/**
 * 소셜 로그인(카카오/구글/네이버) 완료 후 백엔드가 리다이렉트하는 페이지.
 * 백엔드가 붙여주는 쿼리:
 *   - 성공: ?code=...&provider=...
 *   - 실패: ?error=social_login_failed&message=...
 *
 * 백엔드 .env 의 FRONTEND_SOCIAL_CALLBACK_URL 이 이 페이지 주소
 * (예: http://localhost:3000/login/callback) 로 설정돼 있어야 해요.
 *
 * ⚠️ (운영 API 전환 후 "소셜 로그인이 안 돼요" 문제 원인 중 하나) 예전엔
 * 이 페이지가 ?code만 확인하고 ?error는 아예 안 봤어요. 그래서 구글/카카오
 * 콘솔의 리디렉션 URI가 실제 백엔드 콜백 주소와 안 맞거나, 백엔드가 소셜
 * 로그인 자체를 거부하면 백엔드는 ?error=...로 돌려보내는데, 이 화면은
 * code가 없으니 아무 처리도 안 하고 "로그인 처리 중이에요..."만 계속
 * 떠 있었어요 — 실제로는 이미 실패했는데 사용자에겐 그냥 멈춘 것처럼
 * 보였던 원인이에요. 사장님 콜백 화면(owner/login/callback)과 같은
 * 방식으로 error/message를 읽어서 실제 실패 사유를 보여주고, code도 없고
 * error도 없는 경우("잘못된 접근")도 구분해요.
 *
 * ⚠️ 그런데 이 화면에 ?error도 ?code도 전혀 없이 그냥 스피너만 계속 도는
 * 상태로 남아있다면(=이 페이지에 아예 진입은 됐는데 파라미터가 안 붙어
 * 오는 경우), 원인은 프론트 코드가 아니라 백엔드 쪽 FRONTEND_SOCIAL_CALLBACK_URL
 * 설정일 가능성이 높아요 — 지금 접속 중인 프론트 주소(예: 개발 중이면
 * http://localhost:3000/login/callback, 배포된 화면이면
 * https://wa26b01.yjjob.kr/login/callback)와 백엔드에 등록된 콜백 주소가
 * 다르면, 소셜 로그인이 끝나도 지금 보고 있는 이 화면으로는 아예 안
 * 돌아와요(다른 주소로 리다이렉트되니까요). 이건 구글/카카오/네이버 콘솔의
 * "승인된 리디렉션 URI"(백엔드 주소, 예: https://wa26b01.yjjob.kr/auth/social/google/callback)
 * 와는 별개의 설정이라, 콘솔 쪽을 다 맞게 등록했어도 이 값이 안 맞으면
 * 여전히 안 돼요 — 백엔드 팀에 "지금 테스트 중인 프론트 주소"로
 * FRONTEND_SOCIAL_CALLBACK_URL이 맞춰져 있는지 확인해주세요.
 */
function SocialLoginCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithSocialCode } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const errorParam = searchParams.get("error");
    const message = searchParams.get("message");
    const code = searchParams.get("code");

    if (errorParam) {
      setError(message || "소셜 로그인에 실패했어요. 다시 시도해주세요.");
      return;
    }

    if (!code) {
      setError("잘못된 접근이에요. 다시 로그인해주세요.");
      return;
    }

    (async () => {
      const result = await loginWithSocialCode(code);

      if (result.ok) {
        router.replace("/map");
      } else {
        setError(result.error);
      }
    })();
  }, [searchParams]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      {error ? (
        <>
          <p className="text-[15px] text-danger">{error}</p>
          <Link href="/login" className="text-[14px] font-bold text-brand">
            로그인 화면으로 돌아가기
          </Link>
        </>
      ) : (
        <p className="text-[15px] text-ink-secondary">
          로그인 처리 중이에요...
        </p>
      )}
    </div>
  );
}

export default function SocialLoginCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center bg-cream">
          <p className="text-[15px] text-ink-secondary">
            로그인 처리 중이에요...
          </p>
        </div>
      }
    >
      <SocialLoginCallback />
    </Suspense>
  );
}
