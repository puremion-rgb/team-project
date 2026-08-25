"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useCart } from "@/lib/cart-store";
import { useOrders } from "@/lib/orders-store";
import { apiConfirmPayment, isApiConfigured, getPendingTossPayment, clearPendingTossPayment } from "@/lib/api";

/**
 * 토스 결제창에서 성공하면 브라우저가 통째로 이 주소(successUrl)로 이동해요.
 * ⚠️ 페이지가 완전히 새로 열리는 거라(브라우저 새로고침과 같아요), 결제 화면에
 * 있던 장바구니 React 상태는 전부 사라져요. 그래서 "이 결제가 어떤
 * 주문/금액/매장이었는지"는 checkout 화면이 결제창을 열기 직전에 저장해둔
 * localStorage 값(pendingTossPayment)에서 다시 읽어와요.
 */
export default function OrderPaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cart = useCart();
  const { refetchOrders } = useOrders();
  const [status, setStatus] = useState<"confirming" | "error">("confirming");
  // ⚠️ 예전엔 실패 이유를 화면에 전혀 보여주지 못했어요("승인에 실패했다"는
  // 문구만 고정으로 떴어요). apiConfirmPayment가 이제 실제 HTTP 상태코드와
  // 서버 메시지를 돌려주므로, 그 값을 그대로 저장해서 화면에 보여줘요 —
  // 422(입력값/금액 불일치), 401(로그인 만료), 404(주문 없음), 500(서버 오류)
  // 등 원인에 따라 사용자가 뭘 해야 할지 바로 알 수 있어요.
  const [errorDetail, setErrorDetail] = useState<{ status?: number; message?: string } | null>(
    null,
  );
  const startedRef = useRef(false);

  const confirm = (orderId: string, tossOrderId: string, amount: number, paymentKey?: string) => {
    setStatus("confirming");
    setErrorDetail(null);
    // ⚠️ 예전엔 apiConfirmPayment의 성공 여부를 확인하지 않고 무조건 완료
    // 화면으로 넘어갔어요. 토스 결제창은 분명 성공했지만(브라우저가 이
    // 페이지로 돌아왔다는 것 자체가 그 증거) 우리 백엔드의 POST
    // /api/payments/confirm이 어떤 이유로든 실패하면(네트워크 오류, 422 등)
    // 서버 쪽 주문은 계속 "결제대기(PENDING_PAYMENT)"에 멈춰 있는데도 화면은
    // "주문 완료"로 보여줬어요. 그래서 사장님 쪽엔 결제 금액 0원짜리
    // "결제대기" 주문만 계속 쌓이고, 손님은 결제가 잘 된 줄 알고 다시
    // 주문해서 같은 문제가 반복됐어요. 이제 승인 성공 여부를 반드시 확인해서,
    // 실패하면 완료 화면으로 넘어가지 않고 재시도할 수 있게 해요.
    apiConfirmPayment({ orderId, tossOrderId, amount, paymentKey }).then((result) => {
      if (!result.ok && isApiConfigured()) {
        setErrorDetail({ status: result.status, message: result.message });
        setStatus("error");
        return;
      }
      clearPendingTossPayment();
      const pending = getPendingTossPayment();
      cart.setLastOrder({
        orderId,
        cafeName: pending?.cafeName ?? cart.cafeName,
        items: (pending?.items ?? []).map((it, idx) => ({
          id: `success-${idx}`,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
        })),
        amount,
      });
      cart.clear();
      refetchOrders();
      router.replace("/order/complete");
    });
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const tossOrderIdParam = searchParams.get("orderId");
    const amountParam = searchParams.get("amount");
    const paymentKey = searchParams.get("paymentKey") ?? undefined;

    const pending = getPendingTossPayment();
    if (!pending || (tossOrderIdParam && pending.tossOrderId !== tossOrderIdParam)) {
      setStatus("error");
      return;
    }

    const amount = amountParam ? Number(amountParam) : pending.amount;
    confirm(pending.orderId, pending.tossOrderId, amount, paymentKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryConfirm = () => {
    const pending = getPendingTossPayment();
    if (!pending) {
      setStatus("error");
      setErrorDetail(null);
      return;
    }
    const amountParam = searchParams.get("amount");
    const paymentKey = searchParams.get("paymentKey") ?? undefined;
    const amount = amountParam ? Number(amountParam) : pending.amount;
    confirm(pending.orderId, pending.tossOrderId, amount, paymentKey);
  };

  // 상태코드별로 무슨 일이 있었는지 짐작 가는 안내를 붙여줘요. 정확한 원인은
  // 결국 서버 로그/응답 바디를 봐야 확실하지만, 흔한 원인 후보를 먼저 보여주면
  // 개발자 도구를 뒤지지 않고도 방향을 잡을 수 있어요.
  const statusHint = (() => {
    switch (errorDetail?.status) {
      case 401:
        return "로그인이 만료됐을 수 있어요. 다시 로그인한 뒤 시도해주세요.";
      case 404:
        return "서버가 이 주문을 찾지 못했어요. 주문이 실제로 생성됐는지 확인해주세요.";
      case 422:
        return "서버가 보낸 금액/주문번호를 검증하다 거부했을 가능성이 커요(예: 결제 금액 불일치). 아래 메시지를 확인해주세요.";
      case 0:
      case undefined:
        return "서버에 연결하지 못했을 수 있어요(네트워크 또는 서버 다운).";
      default:
        return undefined;
    }
  })();

  return (
    <div className="flex min-h-full flex-col bg-cream">
      <Header title="결제 확인" />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-ink-muted">
        {status === "confirming" ? (
          <>
            <LoadingIndicator label="결제를 확인하는 중이에요…" />
          </>
        ) : (
          <>
            <p className="text-[14px] font-bold text-danger">
              결제 승인 확인에 실패했어요.
            </p>
            <p className="text-[13px]">
              토스 결제 자체는 완료됐지만, 서버가 승인 요청을 거부하거나 응답하지 않았어요.
            </p>
            {errorDetail && (
              <div className="mt-1 w-full rounded-xl border border-border bg-white p-3 text-left text-[12.5px] text-ink-secondary">
                <p>
                  상태코드: <span className="font-bold text-ink">{errorDetail.status ?? "없음(네트워크 오류)"}</span>
                </p>
                {errorDetail.message && (
                  <p className="mt-1 break-words">서버 메시지: {errorDetail.message}</p>
                )}
                {statusHint && <p className="mt-1 text-ink-muted">{statusHint}</p>}
              </div>
            )}
            <div className="mt-2 flex items-center gap-4">
              <button
                onClick={retryConfirm}
                className="text-[14px] font-bold text-trust underline underline-offset-2"
              >
                승인 다시 시도
              </button>
              <button
                onClick={() => router.replace("/reserve")}
                className="text-[14px] font-bold text-ink-secondary underline underline-offset-2"
              >
                주문내역으로 이동
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
