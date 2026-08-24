"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useOrders } from "@/lib/orders-store";
import type { OrderStatus } from "@/lib/orders-store";
import { useReviews } from "@/lib/reviews-store";
import StarRating from "@/components/StarRating";

const stateStyle: Record<OrderStatus, string> = {
  결제대기: "bg-border text-ink-muted",
  주문접수: "bg-amber-tint text-amber-dark",
  준비중: "bg-brand-tint text-brand-dark",
  준비완료: "bg-trust-tint text-trust",
  완료: "bg-sage-tint text-sage-dark",
  취소됨: "bg-border text-ink-muted",
};

export default function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { orders, cancelOrder } = useOrders();
  const order = orders.find((o) => o.id === params.id);
  const [cancelling, setCancelling] = useState(false);
  // ⚠️ 리뷰는 이제 카페 상세가 아니라 여기(완료된 주문)에서만 남길 수 있어요.
  // 이미 이 주문으로 리뷰를 남겼으면 "리뷰 남기기" 대신 내가 쓴 리뷰를
  // 보여주고, 아직이면 작성 화면으로 보내요.
  const { getReviewByOrderId } = useReviews();
  const myReview = order ? getReviewByOrderId(order.id) : undefined;

  if (!order) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-6">
        <p className="text-[14px] text-ink-muted">주문 정보를 찾을 수 없어요.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 text-[14px] font-bold text-brand"
        >
          뒤로가기
        </button>
      </div>
    );
  }

  const canCancel = order.status === "주문접수";

  const handleCancel = async () => {
    setCancelling(true);
    await cancelOrder(order.id);
    setCancelling(false);
  };

  return (
    <div className="flex flex-col">
      <div className="flex h-14 items-center gap-3 px-4">
        <button onClick={() => router.back()} aria-label="뒤로가기" className="text-ink">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-[17px] font-bold text-ink">주문 상세</h1>
      </div>

      <div className="px-6 pt-2">
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-bold text-ink">{order.cafeName}</p>
          <span
            className={
              "inline-flex rounded-full px-3 py-1 text-[12.5px] font-bold " +
              stateStyle[order.status]
            }
          >
            {order.status}
          </span>
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
          {order.pointUsed > 0 && (
            <div className="flex justify-between border-t border-border pt-2 text-[13.5px] text-ink-secondary">
              <span>포인트 사용</span>
              <span>-{order.pointUsed.toLocaleString()}원</span>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-3 text-[15px] font-bold text-ink">
            <span>결제 금액</span>
            <span>{order.amount.toLocaleString()}원</span>
          </div>
        </div>

        {canCancel && (
          <div className="mt-6">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex h-12 w-full items-center justify-center rounded-xl border border-border text-[14px] font-bold text-ink-secondary active:bg-cream disabled:opacity-60"
            >
              {cancelling ? "취소하는 중…" : "주문 취소"}
            </button>
          </div>
        )}

        {order.status === "완료" &&
          (myReview ? (
            <Link
              href={`/my/reviews/write?reviewId=${myReview.id}`}
              className="mt-6 flex flex-col gap-2 rounded-2xl border border-border bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-[13.5px] font-bold text-ink">내가 남긴 리뷰</p>
                <span className="flex items-center gap-1 text-[12.5px] font-bold text-brand">
                  수정하기 <ChevronRight size={14} />
                </span>
              </div>
              <StarRating rating={myReview.rating} />
              <p className="line-clamp-2 text-[13.5px] leading-relaxed text-ink-secondary">
                {myReview.content}
              </p>
            </Link>
          ) : (
            <Link
              href={`/my/reviews/write?cafeId=${order.cafeId ?? ""}&cafeName=${encodeURIComponent(
                order.cafeName,
              )}&orderId=${order.id}`}
              className="mt-6 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-brand text-[14px] font-bold text-white"
            >
              <Star size={15} className="fill-white" />
              리뷰 남기기
            </Link>
          ))}
      </div>
    </div>
  );
}
