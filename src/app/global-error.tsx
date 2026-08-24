"use client";

import { useEffect } from "react";

/**
 * 루트 레이아웃(src/app/layout.tsx) 자체나 그보다 바깥에서 에러가 나는,
 * 아주 드문 경우를 위한 최후의 안전망이에요. (shell)/error.tsx,
 * owner/(shell)/error.tsx는 각 화면 영역 안에서 난 에러만 잡아주기 때문에,
 * 그보다 더 바깥(레이아웃/프로바이더 초기화 등)에서 문제가 생기면 이 파일이
 * 대신 떠요. global-error는 Next.js 규칙상 <html>/<body>까지 직접 그려야 해요.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[앱 전체 오류]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100dvh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "32px",
            textAlign: "center",
            fontFamily: "sans-serif",
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 700 }}>
            앱을 불러오는 중 문제가 생겼어요.
          </p>
          <p style={{ fontSize: 13.5, color: "#6b6b6b" }}>
            잠시 후 다시 시도해주세요. 계속되면 개발자도구 콘솔(F12)의
            &quot;[앱 전체 오류]&quot; 로그를 확인해주세요.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 8,
              height: 44,
              borderRadius: 12,
              padding: "0 24px",
              fontSize: 14,
              fontWeight: 700,
              color: "white",
              background: "#2F6FED",
              border: "none",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}
