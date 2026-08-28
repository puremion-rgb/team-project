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
  const { orders, acceptOrder, rejectOrder, markOrderReady, completeOrder } = useOwner();
  const order = orders.find((o) => o.id === params.id);
  // ⚠️ 예전엔 거절 버튼을 누르면 서버 응답을 기다리지 않고 바로
  // router.back()으로 화면을 닫아버려서, 실패해도 사장님은 알 수 없었고
  // (원래 상태로 되돌려진 주문이 접수 대기 목록에 다시 나타나는 것만 보임)
  // "거절이 안 되고 주문창이 다시 뜬다"처럼 느껴졌어요. 이제 서버 응답을
  // 기다려서, 성공했을 때만 화면을 닫고 실패하면 이유를 여기 보여줘요.
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const handleReject = async () => {
    if (!order || rejecting) return;
    setRejecting(true);
    setRejectError(null);
    const result = await rejectOrder(order.id);
    setRejecting(false);
    if (result.ok) {
      router.back();
    } else {
      setRejectError(result.message ?? "거절 처리에 실패했어요. 잠시 후 다시 시도해주세요.");
    }
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
              손님이 아직 결제를 완료하지 않은 주문이에요. 결제가 끝나면 여기서
              접수/거절할 수 있어요.
            </p>
            {/* ⚠️ 서버 API 문서(Orders & Payments)를 확인해보니, "결제대기" 주문을
                취소할 수 있는 경로가 손님 쪽(POST /api/users/me/orders/{order}/cancel)
                에만 있고 사장님 쪽엔 없어요. 사장님 상태변경 API(PATCH
                /api/owner/orders/{order}/status)는 결제대기 주문에 대해 어떤
                상태값을 보내도 "The selected status is invalid."로 거절돼요 —
                즉 서버가 의도적으로 "결제 전 주문은 사장님이 손댈 수 없고,
                손님만 취소할 수 있다"로 설계돼 있는 것으로 보여요. 그래서 여기
                취소 버튼은 항상 실패할 수밖에 없어 없앴어요. 손님이 취소하거나
                결제를 마치면, 이미 돌고 있는 8초 자동 새로고침으로 이 화면도
                곧 알아서 반영돼요. */}
          </div>
        )}


        {order.status === "주문접수" && (
          <div className="mt-6">
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border text-[14px] font-bold text-ink-secondary active:bg-cream disabled:opacity-60"
              >
                <X size={16} strokeWidth={2.4} />
                {rejecting ? "거절 처리 중..." : "거절"}
              </button>
              <button
                onClick={() => acceptOrder(order.id)}
                className="flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-trust text-[14px] font-bold text-white active:bg-trust-dark"
              >
                <Check size={16} strokeWidth={2.4} />
                접수
              </button>
            </div>
            {rejectError && (
              <p className="mt-2 text-center text-[13px] font-bold text-danger">
                {rejectError}
              </p>
            )}
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

        {/* ⚠️ 준비완료 상태에서 "주문취소" 버튼을 누르면 오류가 났던 문제 —
            준비완료까지 진행된 주문은 취소하는 경우가 실질적으로 없어서, 버튼
            자체를 없애고 픽업완료 처리만 남겼어요. */}
        {order.status === "준비완료" && (
          <div className="mt-6">
            <button
              onClick={() => {
                completeOrder(order.id);
                router.back();
              }}
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-trust text-[14px] font-bold text-white active:bg-trust-dark"
            >
              <Check size={16} strokeWidth={2.4} />
              픽업완료
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
