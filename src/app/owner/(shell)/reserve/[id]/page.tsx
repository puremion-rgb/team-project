"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, X } from "lucide-react";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { useOwner } from "@/lib/owner-store";

const stateStyle: Record<string, string> = {
  결제대기: "bg-border text-ink-muted",
  주문접수: "bg-amber-tint text-amber-dark",
  준비중: "bg-brand-tint text-brand-dark",
  준비완료: "bg-trust-tint text-trust",
  완료: "bg-sage-tint text-sage-dark",
  취소됨: "bg-border text-ink-muted",
};

export default function OwnerOrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { orders, acceptOrder, rejectOrder, markOrderReady, completeOrder, cancelOrder } =
    useOwner();
  const order = orders.find((o) => o.id === params.id);

  // ⚠️ 예전엔 취소 버튼을 누르자마자 결과를 기다리지 않고 바로 router.back()으로
  // 이전 화면으로 넘어갔어요. 그래서 서버 저장이 실제로는 실패해도(예: 이
  // 주문 상태에서는 취소가 허용되지 않는 경우) 사장님은 그 실패 안내를 볼 새도
  // 없이 화면을 떠났고, 나중에(재로그인 후) 다시 "결제대기"로 보이는 걸 보고
  // 나서야 취소가 안 됐다는 걸 알게 됐어요. 이제 서버 응답을 기다렸다가,
  // 성공했을 때만 이전 화면으로 돌아가고, 실패하면 이유를 이 화면에 남겨요.
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleCancelOrder = async () => {
    if (cancelling || !order) return;
    setCancelling(true);
    setCancelError(null);
    const result = await cancelOrder(order.id);
    if (result.ok) {
      router.back();
      return;
    }
    setCancelling(false);
    setCancelError(result.message ?? "주문 취소에 실패했어요. 잠시 후 다시 시도해주세요.");
  };

  if (!order) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6">
        <p className="text-[14px] text-ink-muted">주문 정보를 찾을 수 없어요.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-[14px] font-bold text-trust"
        >
          뒤로가기
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex h-14 items-center gap-3 px-4">
        <button onClick={() => router.back()} aria-label="뒤로가기" className="text-ink">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[17px] font-bold text-ink">주문 상세</h1>
      </div>

      <div className="px-6 pt-2">
        <div className="flex items-center gap-4">
          <ImagePlaceholder
            className="h-14 w-14 shrink-0"
            rounded="rounded-full"
            src={order.customerImageUrl}
            alt={order.customerName}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[18px] font-bold text-ink">{order.customerName} 고객님</p>
            <span
              className={
                "mt-1 inline-flex rounded-full px-3 py-1 text-[12.5px] font-bold " +
                stateStyle[order.status]
              }
            >
              {order.status}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-border bg-white p-5">
          {order.items.map((it, i) => (
            <div key={i} className="flex justify-between text-[14px] text-ink-secondary">
              <span>
                {it.name} × {it.quantity}
              </span>
              <span>{(it.price * it.quantity).toLocaleString()}원</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border pt-3 text-[15px] font-bold text-ink">
            <span>결제 금액</span>
            <span>{order.amount.toLocaleString()}원</span>
          </div>
        </div>

        {order.status === "결제대기" && (
          <div className="mt-6">
            <p className="text-center text-[13px] text-ink-muted">
              손님이 아직 결제를 완료하지 않은 주문이에요. 결제가 끝나면 여기서 접수/거절할 수 있어요.
            </p>
            {/* ⚠️ 결제 중 오류 등으로 결제가 끝나지 않은 채 남아버린 테스트성
                주문은, 손님이 다시 결제를 마치지 않는 한 영원히 "결제대기"로
                남아있었어요. 사장님이 직접 정리할 수 있게 취소 버튼을 둬요. */}
            {cancelError && (
              <div className="mt-4 rounded-xl bg-danger-tint px-4 py-3 text-[13px] font-medium text-danger">
                {cancelError}
              </div>
            )}
            <button
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-[14px] font-bold text-ink-secondary active:bg-cream disabled:opacity-60"
            >
              <X size={16} strokeWidth={2.4} />
              {cancelling ? "취소 처리 중..." : "결제대기 주문 취소"}
            </button>
          </div>
        )}

        {order.status === "주문접수" && (
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => {
                rejectOrder(order.id);
                router.back();
              }}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-[14px] font-bold text-ink-secondary active:bg-cream"
            >
              <X size={16} strokeWidth={2.4} />
              거절
            </button>
            <button
              onClick={() => acceptOrder(order.id)}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-trust text-[14px] font-bold text-white active:bg-trust-dark"
            >
              <Check size={16} strokeWidth={2.4} />
              접수
            </button>
          </div>
        )}

        {order.status === "준비중" && (
          <div className="mt-6">
            <button
              onClick={() => markOrderReady(order.id)}
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-trust text-[14px] font-bold text-white active:bg-trust-dark"
            >
              <Check size={16} strokeWidth={2.4} />
              준비완료 처리
            </button>
          </div>
        )}

        {order.status === "준비완료" && (
          <div className="mt-6 flex flex-col gap-2">
            {cancelError && (
              <div className="rounded-xl bg-danger-tint px-4 py-3 text-[13px] font-medium text-danger">
                {cancelError}
              </div>
            )}
            <div className="flex gap-2">
            <button
              onClick={handleCancelOrder}
              disabled={cancelling}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-[14px] font-bold text-ink-secondary active:bg-cream disabled:opacity-60"
            >
              <X size={16} strokeWidth={2.4} />
              {cancelling ? "취소 처리 중..." : "주문 취소"}
            </button>
            <button
              onClick={() => {
                completeOrder(order.id);
                router.back();
              }}
              className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-trust text-[14px] font-bold text-white active:bg-trust-dark"
            >
              <Check size={16} strokeWidth={2.4} />
              픽업완료
            </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
