"use client";

import { useEffect, useMemo, useState } from "react";
import { Armchair } from "lucide-react";
import Header from "@/components/Header";
import { useOwner, type OwnerSeat } from "@/lib/owner-store";
import { congestionStyle, remainingMessage } from "@/lib/seat-congestion";

/** 좌석 라벨(문자열)을 숫자로 정렬하기 위한 비교 함수. 예전 데이터에 A1처럼
 * 숫자가 아닌 라벨이 남아있어도(마이그레이션 이전 매장) 에러 없이 뒤로 보내요. */
function sortByNumber(seats: OwnerSeat[]) {
  return [...seats].sort((a, b) => {
    const na = Number(a.label);
    const nb = Number(b.label);
    if (Number.isNaN(na) && Number.isNaN(nb)) return a.label.localeCompare(b.label);
    if (Number.isNaN(na)) return 1;
    if (Number.isNaN(nb)) return -1;
    return na - nb;
  });
}

export default function OwnerStorePage() {
  const {
    seats,
    congestion,
    setSeatStatus,
    addSeat,
    removeSeat,
    seatSyncError,
    seatsLoading,
    seatsLoadFailed,
    seatsResetting,
    retrySeatsLoad,
  } = useOwner();
  const [setupCount, setSetupCount] = useState("");

  const sortedSeats = useMemo(() => sortByNumber(seats), [seats]);
  const total = seats.length;
  const occupied = seats.filter((s) => s.status !== "비어있음").length;
  const remaining = total - occupied;

  /** 총 좌석 수를 원하는 값으로 직접 맞춰요(맨 위 "전체 좌석 수" 입력칸에 새
   * 숫자를 넣고 확정하면 호출돼요).
   * ⚠️ 여러 석을 한 번에 조정할 수 있어야 해서, 컴포넌트의 `seats` state가
   * 아직 갱신되지 않은(리렌더 전) 시점에도 정확히 동작하도록 새 좌석 번호와
   * 제거할 좌석 목록을 이 함수 안에서 한 번에 미리 계산해요(반복문 안에서
   * addSeat/removeSeat을 여러 번 부르면서 매번 최신 `seats`를 읽으려고 하면,
   * 리액트가 상태 갱신을 몰아서 처리하는 동안 계속 같은(오래된) `seats`를
   * 참조하게 돼 번호가 겹치는 등 오동작할 수 있어요). */
  const applyTotalTarget = (rawNewTotal: number) => {
    const newTotal = Math.max(0, Math.round(rawNewTotal));
    if (!Number.isFinite(newTotal) || newTotal === total) return;

    if (newTotal > total) {
      // 새 좌석은 항상 "비어있음" 상태로, 현재 가장 큰 번호 다음부터 순서대로 추가해요.
      const numericLabels = seats.map((s) => Number(s.label)).filter((n) => Number.isFinite(n));
      let nextLabel = Math.max(total, numericLabels.length > 0 ? Math.max(...numericLabels) : 0);
      const addCount = newTotal - total;
      for (let i = 0; i < addCount; i++) {
        nextLabel += 1;
        const label = String(nextLabel);
        // handleSetup과 같은 이유로 살짝 시간차를 둬서 순차적으로 저장해요.
        setTimeout(() => addSeat(label), i * 120);
      }
      return;
    }

    // 줄일 때: 비어있는 좌석 중 번호가 큰 것부터 먼저 없애고, 그래도 목표에
    // 못 미치면(전부 사용 중이면) 사용 중인 좌석도 번호가 큰 것부터 없애요.
    const removeCount = total - newTotal;
    const emptyDesc = sortedSeats.filter((s) => s.status === "비어있음").slice().reverse();
    const occupiedDesc = [...sortedSeats].reverse().filter((s) => s.status !== "비어있음");
    const removalOrder = [...emptyDesc, ...occupiedDesc].slice(0, removeCount);
    removalOrder.forEach((seat) => removeSeat(seat.id));
  };

  // 맨 위 "전체 좌석 수"는 평소엔 숫자만 보여주다가, 탭하면 그 자리에서 바로
  // 수정할 수 있는 입력칸으로 바뀌어요. 서버에서 좌석 수가 바뀌어 들어오면
  // (다른 기기에서 수정한 경우 등) 편집 중이 아닐 때는 이 값도 같이 맞춰줘요.
  const [editingTotal, setEditingTotal] = useState(false);
  const [totalDraft, setTotalDraft] = useState(String(total));
  useEffect(() => {
    if (!editingTotal) setTotalDraft(String(total));
  }, [total, editingTotal]);

  const startEditTotal = () => {
    setTotalDraft(String(total));
    setEditingTotal(true);
  };
  const commitEditTotal = () => {
    setEditingTotal(false);
    const n = Number(totalDraft);
    if (Number.isFinite(n) && n >= 0) applyTotalTarget(n);
  };

  const handleSetup = () => {
    const n = Number(setupCount);
    if (!Number.isFinite(n) || n <= 0) return;
    // ⚠️ 좌석을 한꺼번에 여러 개(예: 12개) 만들 때 POST 요청을 전부 동시에
    // 쏘면, 개발용 백엔드가 한 번에 하나씩만 처리하다가 뒤로 밀린 요청들이
    // 타임아웃/요청 제한(429)에 걸리기 쉬워요. 살짝(120ms씩) 시간차를 둬서
    // 서버가 순서대로 처리할 여유를 줘요 — 화면에는 즉시 전부 보이고, 서버
    // 저장만 약간 순차적으로 이어져요.
    for (let i = 1; i <= n; i++) {
      setTimeout(() => addSeat(String(i)), (i - 1) * 120);
    }
    setSetupCount("");
  };

  /** 좌석 하나를 탭하면 바로 상태가 바뀌어요 — 별도 "확인" 저장 단계 없이
   * 비어있음 ↔ 사용중을 즉시 토글해요. */
  const toggleSeat = (seat: OwnerSeat) => {
    setSeatStatus(seat.id, seat.status === "비어있음" ? "사용중" : "비어있음");
  };

  return (
    <div className="flex flex-col">
      <Header title="좌석 관리" />

      {/* 저장이 서버에 실패하면(주로 백엔드 주소에 접속이 안 될 때) 화면이
          조용히 원래대로 되돌아가는 대신 이유를 알려줘요. */}
      {seatSyncError && (
        <div className="mx-6 mt-4 rounded-xl bg-danger-tint px-4 py-3 text-[13px] font-medium text-danger">
          {seatSyncError}
        </div>
      )}

      {/* 초기화(전체 삭제) 요청이 서버 응답을 기다리는 중이에요. 이 동안엔
          "총 좌석 수"가 실제로 몇 개인지 아직 확정되지 않았기 때문에, 화면이
          섣불리 0개로 바뀌며 "좌석 만들기"를 보여주지 않아요. */}
      {seatsResetting && (
        <div className="mx-6 mt-4 rounded-xl bg-amber-tint px-4 py-3 text-[13px] font-medium text-amber-dark">
          좌석을 초기화하는 중이에요. 서버 응답을 기다리는 동안 잠시만 기다려주세요...
        </div>
      )}

      {total === 0 && seatsLoading ? (
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="text-[14px] text-ink-muted">좌석 정보를 불러오는 중이에요...</p>
        </div>
      ) : total === 0 && seatsLoadFailed ? (
        // ⚠️ 여기서 "아직 좌석이 없어요 + 좌석 만들기"를 보여주면, 실제로는
        // 서버에 이미 좌석이 있는데 이번엔 못 불러온 것뿐인데도 사장님이 다시
        // "좌석 만들기"를 눌러 번호가 겹치는 좌석이 쌓이는 사고로 이어졌어요.
        // 그래서 "0개인지 확실치 않을 땐" 새로 만들기 대신 재시도를 안내해요.
        <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <div className="rounded-xl bg-danger-tint px-4 py-3 text-[13px] font-medium text-danger">
            좌석 정보를 불러오지 못했어요. 이미 등록된 좌석이 있을 수 있어요 —
            서버 연결을 확인한 뒤 다시 시도해주세요. (여기서 "좌석 만들기"를
            누르면 기존 좌석과 번호가 겹칠 수 있어 잠시 막아뒀어요)
          </div>
          <button
            onClick={retrySeatsLoad}
            className="h-11 rounded-xl bg-trust px-5 text-[14px] font-bold text-white"
          >
            다시 시도
          </button>
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <Armchair size={28} className="text-ink-muted" />
          <p className="text-[14.5px] text-ink-secondary">
            아직 등록된 좌석이 없어요.
            <br />
            매장의 총 좌석 수를 입력하면 번호대로 좌석이 만들어져요.
          </p>
          <div className="mt-2 flex w-full gap-2">
            <input
              type="number"
              min={1}
              value={setupCount}
              onChange={(e) => setSetupCount(e.target.value)}
              placeholder="예: 12"
              className="h-12 flex-1 rounded-xl border border-border bg-white px-4 text-[14.5px] text-ink outline-none focus:border-trust"
            />
            <button
              onClick={handleSetup}
              className="h-12 shrink-0 rounded-xl bg-trust px-5 text-[14.5px] font-bold text-white"
            >
              좌석 만들기
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5 px-6 py-6">
          {/* 카드 1: 아래 "현재 좌석 현황" 카드와 좌우 위치를 맞춰요.
              - "전체 좌석 수" 라벨은 카드 왼쪽 끝(px-5)에 둬서, 아래 카드의
                "현재 좌석 현황" 라벨과 같은 x 위치에 오게 해요.
              - "12석"은 카드 정중앙에 오도록 절대 위치로 따로 띄워요(예전엔
                라벨과 한 그룹으로 묶여 있어서 라벨 폭만큼 오른쪽으로 밀려
                있었어요).
              - 오른쪽에 있던 "초기화" 버튼은 요청에 따라 없앴어요. */}
          <div className="relative flex items-center justify-between rounded-2xl border border-border bg-white px-5 py-4">
            <span className="text-[13.5px] font-medium text-ink-muted">전체 좌석 수</span>
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              {editingTotal ? (
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={totalDraft}
                  onChange={(e) => setTotalDraft(e.target.value)}
                  onBlur={commitEditTotal}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                      setTotalDraft(String(total));
                      setEditingTotal(false);
                    }
                  }}
                  className="h-9 w-16 rounded-lg border border-trust text-center text-[18px] font-extrabold text-ink outline-none"
                />
              ) : (
                <button
                  onClick={startEditTotal}
                  className="rounded-lg px-1.5 py-0.5 text-[20px] font-extrabold text-trust"
                >
                  {total}석
                </button>
              )}
            </span>
          </div>

          {/* 카드 2: "현재 좌석 현황"과 그 아래 상세 정보(남은 좌석/비어있음·
              이용중/안내 문구)는 지금까지처럼 한 카드 안에 같이 둬요. */}
          <div className="rounded-2xl border border-border bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-medium text-ink-muted">현재 좌석 현황</span>
              <span
                className={
                  "rounded-lg px-2.5 py-1 text-[12px] font-bold " +
                  congestionStyle[congestion].bg +
                  " " +
                  congestionStyle[congestion].text
                }
              >
                {congestion}
              </span>
            </div>

            <div className="mt-5 flex flex-col items-center gap-1">
              <span className="text-[13px] text-ink-muted">남은 좌석</span>
              <span
                className={
                  "text-[42px] font-extrabold leading-none " + congestionStyle[congestion].text
                }
              >
                {remaining}석
              </span>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <span className="flex items-center gap-1.5 rounded-full bg-sage-tint px-3 py-1.5 text-[13px] font-bold text-sage-dark">
                <span className="h-2 w-2 rounded-full bg-sage" />
                {total - occupied} 비어있음
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-danger-tint px-3 py-1.5 text-[13px] font-bold text-danger">
                <span className="h-2 w-2 rounded-full bg-danger" />
                {occupied} 이용 중
              </span>
            </div>

            <p className="mt-4 text-center text-[12.5px] text-ink-muted">
              {remainingMessage(remaining, total, congestion)}
            </p>
          </div>

          {/* 안내 문구 */}
          <p className="text-center text-[12.5px] text-ink-muted">
            좌석을 탭하면 상태가 바로 바뀌어요. 변경 내용은 실시간으로 반영돼요.
          </p>

          {/* 좌석 칸: 크게, 눌러서 즉시 토글 */}
          <div className="grid grid-cols-4 gap-3">
            {sortedSeats.map((seat) => (
              <button
                key={seat.id}
                type="button"
                onClick={() => toggleSeat(seat)}
                aria-label={`좌석 ${seat.label} · ${seat.status} · 눌러서 상태 변경`}
                className={
                  "flex aspect-square items-center justify-center rounded-2xl text-[22px] font-extrabold text-white shadow-sm transition active:scale-95 " +
                  (seat.status === "비어있음" ? "bg-sage" : "bg-danger")
                }
              >
                {seat.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
