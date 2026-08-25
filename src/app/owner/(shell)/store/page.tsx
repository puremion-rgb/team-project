"use client";

import { useEffect, useMemo, useState } from "react";
import { Armchair } from "lucide-react";
import Header from "@/components/Header";
import { useOwner, sortSeatsByNumber, type OwnerSeat } from "@/lib/owner-store";
import { congestionStyle, remainingMessage } from "@/lib/seat-congestion";

export default function OwnerStorePage() {
  const {
    seats,
    congestion,
    setSeatStatus,
    seatSyncError,
    seatsLoading,
    seatsLoadFailed,
    seatsResetting,
    seatsBatchBusy,
    applySeatsTotal,
    retrySeatsLoad,
  } = useOwner();
  const [setupCount, setSetupCount] = useState("");

  const sortedSeats = useMemo(() => sortSeatsByNumber(seats), [seats]);
  const total = seats.length;
  const occupied = seats.filter((s) => s.status !== "비어있음").length;
  const remaining = total - occupied;

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
  // ⚠️ 좌석을 여러 개 한꺼번에 추가/삭제할 때(총 좌석 수 조정) 서버 요청을
  // 순서대로(직렬로) 처리해야 번호가 꼬이지 않아요 — 자세한 이유는
  // owner-store.tsx의 applySeatsTotal 주석 참고. 그 처리가 끝나기 전까지는
  // (seatsBatchBusy) 여기서 새로 조정 요청을 보내지 않아요.
  const commitEditTotal = () => {
    setEditingTotal(false);
    if (seatsBatchBusy) return;
    const n = Number(totalDraft);
    if (Number.isFinite(n) && n >= 0) void applySeatsTotal(n);
  };

  const handleSetup = () => {
    if (seatsBatchBusy) return;
    const n = Number(setupCount);
    if (!Number.isFinite(n) || n <= 0) return;
    void applySeatsTotal(n);
    setSetupCount("");
  };

  /** 좌석 하나를 탭하면 바로 상태가 바뀌어요 — 별도 "확인" 저장 단계 없이
   * 비어있음 ↔ 사용중을 즉시 토글해요.
   * ⚠️ 총 좌석 수를 조정하는 중(seatsBatchBusy)이거나 초기화하는 중
   * (seatsResetting)에는 좌석 칸이 실시간으로 늘어나거나 사라지면서 화면
   * 배치가 계속 바뀌어요. 이 동안 좌석 칸이 계속 클릭 가능한 상태로 남아있으면,
   * 사용자가 같은 자리를 다시 누르는 순간 그 자리에 다른 좌석이 들어와 있어서
   * "누른 적 없는 좌석"이 한꺼번에 토글되고, 그 상태변경 요청들이 지금 한창
   * 진행 중인 추가/삭제 요청과 겹치면서 저장 실패("좌석 상태 저장에 실패했어요")
   * 경고까지 함께 뜨는 문제로 이어졌어요. 조정이 끝날 때까지는 탭을 무시해요. */
  const toggleSeat = (seat: OwnerSeat) => {
    if (seatsBatchBusy || seatsResetting || seatsLoading) return;
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

      {/* 총 좌석 수 조정(추가/삭제)이 서버와 순서대로 처리되는 중이에요. 이
          동안 다시 숫자를 바꾸면 아직 처리 중인 이전 변경과 겹쳐 좌석 번호가
          꼬일 수 있어서, 끝날 때까지 입력을 잠깐 막아요. */}
      {seatsBatchBusy && (
        <div className="mx-6 mt-4 rounded-xl bg-amber-tint px-4 py-3 text-[13px] font-medium text-amber-dark">
          좌석 수를 반영하는 중이에요. 잠시 후 다시 시도해주세요...
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
              disabled={seatsBatchBusy}
              onChange={(e) => setSetupCount(e.target.value)}
              placeholder="예: 12"
              className="h-12 flex-1 rounded-xl border border-border bg-white px-4 text-[14.5px] text-ink outline-none focus:border-trust disabled:opacity-60"
            />
            <button
              onClick={handleSetup}
              disabled={seatsBatchBusy}
              className="h-12 shrink-0 rounded-xl bg-trust px-5 text-[14.5px] font-bold text-white disabled:opacity-60"
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
                  disabled={seatsBatchBusy}
                  className="rounded-lg px-1.5 py-0.5 text-[20px] font-extrabold text-trust disabled:opacity-60"
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
                disabled={seatsBatchBusy || seatsResetting || seatsLoading}
                aria-label={`좌석 ${seat.label} · ${seat.status} · 눌러서 상태 변경`}
                className={
                  "flex aspect-square items-center justify-center rounded-2xl text-[22px] font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-50 disabled:active:scale-100 " +
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
