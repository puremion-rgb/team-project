"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import LoadingIndicator from "@/components/LoadingIndicator";
import Button from "@/components/Button";
import { useCart } from "@/lib/cart-store";
import {
  apiCreateOrder,
  apiGetPaymentCheckout,
  apiValidateCustomerSession,
  isApiConfigured,
  setCustomerToken,
  lastCreateOrderError,
  lastPaymentCheckoutError,
  setOrderHint,
  setPendingTossPayment,
} from "@/lib/api";
import { requestTossPayment } from "@/lib/toss-payments";

/**
 * 결제 흐름: 주문 생성(POST /api/orders) → 토스 결제창(테스트 모드) → 성공 시
 * /order/payment/success로 리다이렉트 → 결제 승인(POST /api/payments/confirm) →
 * 완료 화면.
 * ⚠️ 과제 요구사항이 "실제 결제가 되는 게 아니라 토스페이먼츠 테스트 계정으로
 * 흐름만 보이면 됨"이라, 진짜 카드사 결제창이 아니라 토스의 테스트 클라이언트
 * 키로 뜨는 결제창(테스트 모드 — 실제 매출이 절대 발생하지 않아요)을 그대로 써요.
 * 예전에 있던 카드/카카오페이/네이버페이/토스페이 4개 중 고르는 가짜 UI는
 * 전부 지우고 토스 결제 버튼 하나만 남겨요.
 */
export default function OrderCheckoutPage() {
  const router = useRouter();
  const cart = useCart();

  const [orderId, setOrderId] = useState<string | null>(null);
  const [creating, setCreating] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalAmount = Math.max(0, cart.subtotal - cart.pointUsed);

  // ⚠️ 주문이 2개씩 생기던 버그의 원인: next.config.js의 reactStrictMode가
  // 켜져 있어서(개발 모드) React가 이 화면의 useEffect를 일부러 두 번
  // 실행해요. 의존성 배열이 []이라 "한 번만 돈다"고 생각하기 쉽지만, 실제로는
  // 마운트 → 클린업 → 재마운트가 즉시 일어나면서 apiCreateOrder(POST
  // /api/orders)가 두 번 호출됐어요. hasCreatedRef로 "이미 시작했으면 다시
  // 시작하지 않는다"를 보장해서, StrictMode의 이중 실행에도 주문은 정확히
  // 1번만 생성돼요.
  const hasCreatedRef = useRef(false);

  // ⚠️ 위 hasCreatedRef로 "중복 주문"은 막았지만, 그 부작용으로 "생성하는
  // 중…"에서 멈춰버리는 새 버그가 생겼었어요(주문은 201로 실제 생성됐는데
  // 화면만 안 넘어감). 원인: 예전 코드는 createOrder 안에서 매번 새
  // `let cancelled = false`를 만들고, 그 effect가 반환하는 cleanup에서만
  // cancelled를 true로 바꿨어요. StrictMode는 첫 번째 마운트 직후 그
  // cleanup을 곧바로 실행하는데(진짜 언마운트가 아니라 검사용 가짜
  // 언마운트예요), 이때 아직 서버 응답이 오기 전인 요청의 cancelled가
  // true가 돼버렸고, hasCreatedRef 때문에 재마운트 시엔 새 cleanup이 다시
  // 등록되지도 않았어요. 그래서 나중에 실제 201 응답이 도착해도
  // "cancelled === true"라 화면 갱신을 건너뛰었던 거예요.
  // 고친 방법: cancelled 여부를 effect마다 새로 만드는 지역 변수가 아니라,
  // 컴포넌트가 "진짜로" 화면에서 사라질 때만 false가 되는 mountedRef 하나로
  // 통일했어요. StrictMode의 마운트→클린업→재마운트는 응답이 오기 훨씬 전에
  // 동기적으로 다 끝나므로, 재마운트 시점에 mountedRef.current가 다시 true로
  // 돌아와 있어서 실제 201 응답이 왔을 때 정상적으로 화면을 갱신해요. 반대로
  // 사용자가 결제 화면을 벗어나는 "진짜" 언마운트에서는 계속 false로 남아있어
  // 이미 떠난 화면의 state를 건드리지 않아요.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const createOrder = async () => {
    setCreating(true);
    setCreateError(null);

    // 주문 API와 결제 API는 모두 Bearer 인증이 필수예요. 예전 로그인 응답의
    // 토큰이 없거나 만료됐는데도 주문 생성부터 호출하면 401만 보였어요. 먼저
    // 서버에서 세션을 검증하고, 실패한 토큰은 지운 뒤 로그인 화면으로 보냅니다.
    const session = await apiValidateCustomerSession();
    if (!mountedRef.current) return;
    if (session !== "valid") {
      if (session === "invalid") setCustomerToken(null);
      setCreating(false);
      setCreateError(
        session === "missing"
          ? "로그인이 필요해요. 다시 로그인한 뒤 결제를 진행해주세요."
          : "로그인 세션이 만료되었거나 서버가 토큰을 확인하지 못했어요. 다시 로그인해주세요.",
      );
      return;
    }

    const snapshotItems = cart.items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
    }));
    const snapshotAmount = finalAmount;

    const order = await apiCreateOrder({
      store_id: Number(cart.cafeId),
      items: cart.items.map((i) => ({ menu_id: Number(i.id), quantity: i.quantity })),
      point_used: cart.pointUsed || undefined,
      user_coupon_id: cart.couponId ? Number(cart.couponId) : undefined,
    });
    if (!mountedRef.current) return;
      // ⚠️ 예전엔 백엔드가 연동돼 있어도(isApiConfigured() === true) 주문
      // 생성이 실패하면 조용히 "demo-<시각>" 같은 가짜 주문번호를 만들어서
      // 결제 화면을 그대로 진행시켰어요. 그러면 손님은 실제로 존재하지 않는
      // 주문에 결제를 시도하게 되고(결제 승인 API가 그 주문을 못 찾음),
      // "결제는 했는데 주문내역엔 없어요" 같은 문제가 생겨요. 이제 API가
      // 연동된 상태에서 생성이 실패하면 데모로 얼버무리지 않고 에러를 보여주고
      // 재시도할 수 있게 해요. (API 미연동일 때만 데모 흐름을 써요.)
      if (!order && isApiConfigured()) {
        setCreating(false);
        // ⚠️ 예전엔 원인과 상관없이 항상 같은 안내문만 보여줘서 디버깅이
        // 어려웠어요. 이제 apiCreateOrder가 남긴 실제 실패 사유
        // (lastCreateOrderError)를 그대로 보여줘요 — 브라우저 콘솔의
        // '[주문 생성] 서버 응답 원본' 로그와 같이 보면 원인을 바로 알 수 있어요.
        setCreateError(
          lastCreateOrderError ??
            "주문을 생성하지 못했어요. 네트워크나 서버 상태를 확인한 뒤 다시 시도해주세요.",
        );
        return;
      }
      const id = order ? String(order.id) : `demo-${Date.now()}`;
      // ⚠️ 결제 금액/메뉴 구성이 0원으로 뜨던 문제 보정: 서버 응답에 이 값들이
      // 없거나 0으로 와도, 지금 이 화면이 정확히 알고 있는 금액/구성을 주문 id
      // 기준으로 저장해둬요. 이후 주문내역(손님/사장님)에서 서버 값이 비어있으면
      // 이 캐시로 채워요.
      setOrderHint(id, { amount: snapshotAmount, items: snapshotItems });
    setOrderId(id);
    setCreating(false);
  };

  useEffect(() => {
    if (cart.items.length === 0) {
      router.replace("/order/cart");
      return;
    }
    if (hasCreatedRef.current) return;
    hasCreatedRef.current = true;
    void createOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    if (!orderId) return;
    setPaying(true);
    setError(null);

    if (!isApiConfigured()) {
      // 백엔드 연동 전이면 결제창을 띄울 수 없으니(승인 API가 없어요), 데모로만
      // 완료 처리해요.
      cart.setLastOrder({
        orderId,
        cafeName: cart.cafeName,
        items: cart.items,
        amount: finalAmount,
      });
      cart.clear();
      router.replace("/order/complete");
      return;
    }

    // ⚠️ 진짜 원인 확인됨: "결제 주문번호가 일치하지 않습니다"(422) — 프론트가
    // 임의로 만든 문자열은 서버가 이 주문에 대해 발급/기록해둔 토스 주문번호와
    // 달라서 항상 거부돼요. 결제창을 열기 전에 반드시 "결제 준비" API를 먼저
    // 불러서 서버가 발급한 토스 주문번호를 받아오고, 그 값을 토스 결제창과
    // 이후 승인 요청 양쪽에 그대로 써야 해요.
    const checkout = await apiGetPaymentCheckout(orderId);
    if (!checkout) {
      setPaying(false);
      // ⚠️ 원인과 상관없이 항상 같은 안내문만 보여주면 디버깅이 어려워요.
      // apiGetPaymentCheckout이 남긴 실제 실패 사유(lastPaymentCheckoutError)를
      // 그대로 보여줘요 — 브라우저 콘솔의 원본 응답 로그와 같이 보면 원인을
      // 바로 알 수 있어요.
      setError(
        lastPaymentCheckoutError ?? "결제 준비에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
      return;
    }
    const tossOrderId = checkout.tossOrderId;
    // 서버가 결제 준비 응답에 금액을 함께 내려주면 그 값을 우선 써요(승인 때도
    // 결국 서버가 이 금액과 비교할 가능성이 크니까요). 없으면 화면이 계산한
    // finalAmount를 그대로 써요.
    const payAmount = checkout.amount ?? finalAmount;
    setPendingTossPayment({
      tossOrderId,
      orderId,
      amount: payAmount,
      cafeName: cart.cafeName,
      items: cart.items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price })),
    });

    const orderName =
      cart.items.length > 1
        ? `${cart.items[0].name} 외 ${cart.items.length - 1}건`
        : cart.items[0]?.name ?? cart.cafeName;

    try {
      const origin = window.location.origin;
      await requestTossPayment({
        orderId: tossOrderId,
        orderName,
        amount: payAmount,
        successUrl: `${origin}/order/payment/success`,
        failUrl: `${origin}/order/payment/fail`,
      });
      // requestPayment가 성공하면 브라우저가 successUrl로 이동하면서 이 화면은
      // 사라져요 — 여기 이후 코드는 보통 실행되지 않아요.
    } catch (err) {
      // 사용자가 결제창을 닫거나(취소) 오류가 나면 여기로 돌아와요.
      setPaying(false);
      setError(
        err instanceof Error && err.message
          ? err.message
          : "결제가 취소됐어요. 다시 시도해주세요.",
      );
    }
  };

  return (
    <div className="flex min-h-full flex-col bg-cream">
      <Header title="결제" />

      <div className="flex flex-1 flex-col px-6 pt-4">
        {creating ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-muted">
            <LoadingIndicator label="주문을 생성하는 중이에요…" />
          </div>
        ) : createError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="text-[14px] font-medium text-danger">{createError}</p>
            <Button onClick={createOrder} className="w-auto px-6">
              다시 시도
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-white p-5">
              <p className="text-[12.5px] font-bold text-trust">토스페이먼츠 테스트 결제</p>
              <p className="mt-1 text-[13px] text-ink-muted">
                토스 테스트 계정으로 결제 흐름만 확인해요. 실제로 결제(매출)되지 않아요.
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="text-[14px] text-ink-secondary">{cart.cafeName}</span>
                <span className="text-[20px] font-bold text-ink">
                  {finalAmount.toLocaleString()}원
                </span>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-trust bg-trust-tint px-5 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-trust text-[13px] font-extrabold text-white">
                toss
              </span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-trust">토스페이먼츠</p>
                <p className="text-[12.5px] text-ink-secondary">카드 결제 (테스트 모드)</p>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-[13px] font-medium text-danger">{error}</p>
            )}

            <div className="mt-auto mb-8 pt-8">
              <Button onClick={handlePay} disabled={paying}>
                {paying ? "결제창을 여는 중…" : `${finalAmount.toLocaleString()}원 토스로 결제하기`}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
