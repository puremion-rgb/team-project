"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * 손님 화면(이 (shell) 그룹 아래 전부: 지도/카페 상세/MY/프로필 관리 등)
 * 어딘가에서 렌더링 중 예외가 나면 Next.js가 이 화면을 대신 보여줘요.
 * ------------------------------------------------------------------
 * ⚠️ 이 파일이 없으면(원래 프로젝트엔 없었어요) 렌더링 중 처리되지 않은
 * 에러가 나는 순간 화면이 통째로 하얗게 비어버려요 — "프로필 관리 화면이
 * 하얗게 뜬다"처럼 보고된 증상과 정확히 일치하는 동작이에요. 진짜 원인(어떤
 * 값이 왜 잘못됐는지)은 매번 다를 수 있지만, 이 파일을 추가해두면 최소한
 * "하얀 화면" 대신 이유를 알 수 있는 안내와 "다시 시도" 버튼이 떠요.
 * 브라우저 콘솔(F12)에는 실제 에러 메시지/스택트레이스가 그대로 남으니,
 * 재현되면 콘솔 내용을 같이 확인해서 정확한 원인을 잡을 수 있어요.
 */
export default function ShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[손님 화면 오류]", error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <AlertTriangle size={32} className="text-danger" />
      <p className="text-[15px] font-bold text-ink">
        화면을 불러오는 중 문제가 생겼어요.
      </p>
      <p className="text-[13.5px] text-ink-secondary">
        잠시 후 다시 시도해주세요. 계속되면 개발자도구 콘솔(F12)의
        &quot;[손님 화면 오류]&quot; 로그를 확인해주세요.
      </p>
      {process.env.NODE_ENV !== "production" && (
        <p className="max-w-full break-words rounded-xl bg-danger-tint px-4 py-3 text-[12px] text-danger">
          {error.message}
        </p>
      )}
      <button
        onClick={reset}
        className="mt-2 h-11 rounded-xl bg-trust px-6 text-[14px] font-bold text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
