"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import OwnerTopBar from "@/components/owner/OwnerTopBar";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import { useOwner, type SalesPoint } from "@/lib/owner-store";
import { congestionStyle, remainingMessage } from "@/lib/seat-congestion";

const stateStyle: Record<string, string> = {
  결제대기: "bg-border text-ink-muted",
  주문접수: "bg-amber-tint text-amber-dark",
  준비중: "bg-brand-tint text-brand-dark",
  준비완료: "bg-trust-tint text-trust",
  완료: "bg-sage-tint text-sage-dark",
  취소됨: "bg-border text-ink-muted",
};

export default function OwnerHomePage() {
  const {
    store,
    seats,
    congestion,
    orders,
    menu,
    todaySales,
    salesChangePct,
    todaySalesByHour,
    salesLoading,
    salesError,
  } = useOwner();

  const lowStockCount = menu.filter(
    (m) => m.stock !== null && m.stock <= 3
  ).length;
  const pendingCount = orders.filter((o) => o.status === "주문접수").length;
  const alertCount = lowStockCount + pendingCount;

  // 좌석 관리 화면에서 설정한 좌석(총 좌석 수 / 남은 좌석 수)을 그대로 다시
  // 계산해서 보여줘요 — 좌석 관리에서 서버에 저장한 값이 곧 여기 혼잡도예요.
  // (서버에 실제로 저장된 좌석 상태를 그대로 쓰기 때문에, 손님이 지도/검색에서
  // 보는 혼잡도와도 같은 값이에요.)
  const seatTotal = seats.length;
  const seatOccupied = seats.filter((s) => s.status !== "비어있음").length;
  const seatRemaining = seatTotal - seatOccupied;

  const recent = orders.slice(0, 2);

  // ⚠️ orders.length는 지금까지 불러온 주문 전체(누적)라서, 매장을 오래
  // 운영할수록 "주문 건수"가 하루 접수량과 상관없이 계속 커지기만 했어요.
  // 주문 카드의 date는 이미 "YYYY.MM.DD" 형식으로 정규화돼 있어서, 오늘
  // 날짜 문자열과 그대로 비교하면 오늘 접수된 주문만 셀 수 있어요.
  const todayLabel = (() => {
    const now = new Date();
    return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(
      now.getDate(),
    ).padStart(2, "0")}`;
  })();
  const todayOrderCount = orders.filter((o) => o.date === todayLabel).length;

  return (
    <div className="flex flex-col pb-8">
      <OwnerTopBar />

      <div className="px-6 pt-5">
        <h1 className="text-[22px] font-bold text-ink">
          {store.name}
        </h1>
        <p className="mt-1.5 text-[14px] text-ink-secondary">
          카페ON과 함께 매장을 더 스마트하게 운영하세요.
        </p>
      </div>

      <div className="mt-5 px-6">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-card">
          <p className="text-[14px] font-medium text-ink-muted">오늘 매출</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p
                className={
                  "whitespace-nowrap text-[26px] font-extrabold text-ink transition-opacity " +
                  (salesLoading ? "opacity-50" : "opacity-100")
                }
              >
                {todaySales.toLocaleString()}원
              </p>
              <p
                className={
                  "mt-1 flex items-center gap-1 text-[13px] font-bold " +
                  (salesChangePct < 0 ? "text-danger" : "text-sage-dark")
                }
              >
                {salesChangePct < 0 ? (
                  <TrendingDown size={14} strokeWidth={2.5} />
                ) : (
                  <TrendingUp size={14} strokeWidth={2.5} />
                )}
                {salesChangePct}% 어제 대비
              </p>
            </div>
            {/* ⚠️ 이 스파크라인은 "어제 대비 %"와는 다른 지표예요 — 옆 배지는
                오늘 총매출을 어제 총매출과 비교한 값이고, 이 그래프는
                todaySalesByHour(오늘 하루 안에서 시간이 지날수록 쌓이는
                누적 매출)를 그린 거예요. 누적값은 성격상 시간이 지날수록
                줄어들 수 없어서 우상향 모양으로 보이는 게 정상이고, 그게
                "어제보다 매출이 늘고 있다"는 뜻은 아니에요. 즉 오늘 매출 데이터만
                반영되고, 어제 값과는 비교하지 않아요. */}
            <SalesSparkline data={todaySalesByHour} />
          </div>
          {salesError && (
            <p className="mt-3 text-[11.5px] text-amber-dark">
              {salesError}
            </p>
          )}
        </div>
      </div>

      {seatTotal > 0 && (
        <div className="mt-4 px-6">
          <Link
            href="/owner/store"
            className="flex items-center justify-between rounded-2xl border border-border bg-white p-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={
                    "shrink-0 rounded-lg px-2.5 py-1 text-[12.5px] font-bold " +
                    congestionStyle[congestion].bg +
                    " " +
                    congestionStyle[congestion].text
                  }
                >
                  {congestion}
                </span>
                <p className="truncate text-[13px] font-medium text-ink-secondary">
                  {remainingMessage(seatRemaining, seatTotal, congestion)}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-ink-muted" />
          </Link>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 px-6">
        <StatCard label="좌석 수" value={`${seatTotal}`} unit="석" />
        <StatCard
          label="주문 건수"
          value={`${todayOrderCount}`}
          unit="건"
        />
        <StatCard label="운영 알림" value={`${alertCount}`} unit="건" />
      </div>

      <div className="mt-8 px-6">
        <div className="flex items-center justify-between">
          <h2 className="text-[17px] font-bold text-ink">최근 주문</h2>
          <Link
            href="/owner/reserve"
            className="text-[13px] font-medium text-ink-muted"
          >
            더보기 &gt;
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {recent.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-white p-4"
            >
              <ImagePlaceholder
                className="h-14 w-14 shrink-0"
                rounded="rounded-full"
                src={o.customerImageUrl}
                alt={o.customerName}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-ink">
                  {o.customerName} 고객님
                </p>
                <p className="mt-0.5 truncate text-[13px] text-ink-secondary">
                  {o.items.map((it) => `${it.name} ${it.quantity}개`).join(", ")}
                </p>
              </div>
              <span
                className={
                  "shrink-0 rounded-full px-3 py-1 text-[12.5px] font-bold " +
                  stateStyle[o.status]
                }
              >
                {o.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-white px-3 py-4 text-center">
      <p className="text-[13px] text-ink-muted">{label}</p>
      <p className="mt-1.5 text-[20px] font-extrabold text-ink">
        {value}
        <span className="ml-0.5 text-[14px] font-bold text-ink-secondary">
          {unit}
        </span>
      </p>
    </div>
  );
}

function SalesSparkline({ data }: { data: SalesPoint[] }) {
  const width = 110;
  const height = 50;

  // ⚠️ "오늘 매출 1건인데 그래프에 반영이 안 된다"는 문제의 실제 원인:
  // 서버(/dashboard)는 실제로 매출이 찍힌 시간대만 배열에 담아 내려줘요(예:
  // 오늘 주문이 오후 2시 1건뿐이면 sales/hours 배열 길이가 1). 그런데 이 아래
  // 로직은 "점 2개 이상 있어야 선을 그릴 수 있다"는 이유로 데이터가 1개면
  // 아예 빈 SVG(장식용 여백)만 그려서, 매출이 있어도 그래프엔 아무것도 안 보였어요.
  // 데이터가 1개뿐일 때는 "영업 시작 시각(09시, 0원)"을 가상의 시작점으로
  // 앞에 붙여서 최소 2개의 점으로 만들어 실제 매출을 반영한 선이 그려지게 해요.
  const points0 =
    data.length === 1
      ? [{ hour: String(Math.min(9, Number(data[0].hour))).padStart(2, "0"), amount: 0 }, data[0]]
      : data;

  if (points0.length < 2) {
    return <svg viewBox={`0 0 ${width} ${height}`} className="h-[46px] w-[110px] shrink-0" />;
  }

  const data2 = points0;
  const amounts = data2.map((d) => d.amount);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const range = max - min || 1;

  // 실제 시간대별 매출 데이터를 좌표로 변환해서 선을 그려요.
  // (더 이상 하드코딩된 장식용 경로가 아니라, todaySalesByHour 값이 바뀌면
  //  그래프도 함께 바뀌어요.)
  const points = data2.map((d, i) => {
    const x = (i / (data2.length - 1)) * width;
    const y = height - 4 - ((d.amount - min) / range) * (height - 8);
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L${width} ${height} L0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[46px] w-[110px] shrink-0"
      fill="none"
    >
      <defs>
        <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D85A30" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#D85A30" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#salesFill)" />
      <path
        d={linePath}
        stroke="#D85A30"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
