"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * 사장님 화면(좌석 관리/주문/메뉴/MY 등) 렌더링 중 예외가 나면 이 화면을
 * 대신 보여줘요. 손님 쪽 (shell)/error.tsx와 같은 이유로 추가했어요 — 자세한
 * 설명은 그 파일 주석을 참고하세요.
 */
export default function OwnerShellError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[사장님 화면 오류]", error);
  }, [error]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-8 py-16 text-center">
      <AlertTriangle size={32} className="text-danger" />
      <p className="text-[15px] font-bold text-ink">
        화면을 불러오는 중 문제가 생겼어요.
      </p>
      <p className="text-[13.5px] text-ink-secondary">
        잠시 후 다시 시도해주세요. 계속되면 개발자도구 콘솔(F12)의
        &quot;[사장님 화면 오류]&quot; 로그를 확인해주세요.
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
