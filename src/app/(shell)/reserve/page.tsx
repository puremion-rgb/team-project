"use client";

import Link from "next/link";
import Header from "@/components/Header";
import LoadingIndicator from "@/components/LoadingIndicator";
import { useOrders } from "@/lib/orders-store";
import type { OrderStatus } from "@/lib/orders-store";

const stateStyle: Record<OrderStatus, string> = {
  결제대기: "bg-border text-ink-muted",
  주문접수: "bg-amber-tint text-amber-dark",
  준비중: "bg-brand-tint text-brand-dark",
  준비완료: "bg-trust-tint text-trust",
  완료: "bg-sage-tint text-sage-dark",
  취소됨: "bg-border text-ink-muted",
};

/**
 * ⚠️ 예전엔 이 화면(/reserve)이 "자리 예약" 목록이었어요. 이제는 매장에서
 * 자리를 예약하는 기능 자체가 없고, 카페 상세에서 메뉴를 담아 주문하면
 * (POST /api/orders → 결제 완료) 그 주문이 바로 여기(주문내역)에 나타나요.
 * 라우트 경로(/reserve)와 하단 탭 위치는 그대로 두고 화면 내용만 바꿨어요.
 */
export default function ReservePage() {
  const { orders, loading } = useOrders();

  return (
    <div className="flex flex-col">
      <Header title="주문내역" />

      <div className="flex flex-col px-6 py-6">
        {loading ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-ink-muted">
            <LoadingIndicator label="주문 내역을 불러오는 중이에요…" />
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-10 flex flex-col items-center">
            <p className="text-center text-[20px] font-bold leading-snug text-ink">
              아직 주문 내역이 없어요
              <br />
              카페를 둘러보고 메뉴를 주문해보세요
            </p>
            <div className="mt-6 w-full">
              <Link
                href="/map"
                className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand text-[16px] font-bold text-white"
              >
                지도에서 카페 찾기
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((o) => (
              <Link
                key={o.id}
                href={`/reserve/${o.id}`}
                className="rounded-2xl border border-border bg-white p-5"
              >
                <p className="text-[13px] text-ink-secondary">{o.date}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[17px] font-bold text-ink">{o.cafeName}</p>
                  <span
                    className={
                      "rounded-full px-3 py-1 text-[12.5px] font-bold " + stateStyle[o.status]
                    }
                  >
                    {o.status}
                  </span>
                </div>
                <p className="mt-2 truncate text-[13.5px] text-ink-secondary">
                  {o.items.map((it) => `${it.name} ${it.quantity}개`).join(", ")}
                </p>
                <p className="mt-1 text-[14px] font-bold text-ink">
                  {o.amount.toLocaleString()}원
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
