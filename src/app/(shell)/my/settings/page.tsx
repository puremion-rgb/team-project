"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import Header from "@/components/Header";
import ListRow from "@/components/ListRow";
import ToggleSwitch from "@/components/ToggleSwitch";
import { useAuth } from "@/lib/auth-store";

export default function SettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [notif, setNotif] = useState(true);
  const [push, setPush] = useState(true);
  const [eventNotif, setEventNotif] = useState(false);
  const [location, setLocation] = useState(true);

  // ⚠️ 회원 탈퇴: 아직 백엔드에 실제 탈퇴 API(예: DELETE /api/users/me)가
  // 있는지 확인 전이라, 지금은 "확인 모달 → 로그아웃과 동일한 흐름"까지만
  // 보여주는 화면 목업이에요(발표용, 흐름만 보여줌). 백엔드 연동이 정해지면
  // 아래 handleWithdraw 맨 앞에서 실제 탈퇴 API를 먼저 호출하고, 성공했을
  // 때만 로그아웃 처리로 넘어가도록 바꾸면 돼요.
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const handleWithdraw = () => {
    setShowWithdrawConfirm(false);
    logout();
    router.push("/map");
  };

  return (
    <div className="flex flex-col">
      <Header title="설정" />

      <div className="flex flex-col px-6 pb-8">
        <h2 className="mt-6 text-[16px] font-bold text-ink">앱 설정</h2>
        <div className="mt-3 flex flex-col gap-3">
          <Row label="알림 설정">
            <ToggleSwitch checked={notif} onChange={setNotif} />
          </Row>
          <Row label="푸시 알림">
            <ToggleSwitch checked={push} onChange={setPush} />
          </Row>
          <Row label="이벤트/혜택 알림">
            <ToggleSwitch checked={eventNotif} onChange={setEventNotif} />
          </Row>
          <Row label="위치 권한">
            <ToggleSwitch checked={location} onChange={setLocation} />
          </Row>
          <Row label="언어">
            <span className="text-[14px] text-ink-muted">한국어</span>
          </Row>
        </div>

        <h2 className="mt-8 text-[16px] font-bold text-ink">계정</h2>
        <div className="mt-3 flex flex-col gap-3">
          <ListRow href="/map" label="로그아웃" danger onClick={() => logout()} />

          {/* ListRow는 클릭 즉시 href로 이동해서 확인 모달을 띄울 수 없어요.
              탈퇴는 먼저 확인을 받아야 해서 같은 스타일의 버튼으로 따로 뒀어요. */}
          <button
            type="button"
            onClick={() => setShowWithdrawConfirm(true)}
            className="flex h-16 items-center justify-between rounded-2xl border border-border bg-white px-5"
          >
            <span className="text-[15px] font-medium text-ink-muted">회원 탈퇴</span>
            <ChevronRight size={18} className="text-ink-muted" />
          </button>
        </div>
      </div>

      {/* 회원 탈퇴 확인 모달. my/reviews의 리뷰 삭제 확인 모달과 같은 스타일로
          맞췄어요. 아직 실제 탈퇴 API 연동 전이라 "탈퇴하기"를 누르면 지금은
          로그아웃과 같은 흐름으로 처리해요(위 handleWithdraw 주석 참고). */}
      {showWithdrawConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-8">
          <div className="w-full max-w-[320px] rounded-2xl bg-white p-6">
            <p className="text-[16px] font-bold text-ink">정말 탈퇴하시겠어요?</p>
            <p className="mt-1.5 text-[13.5px] text-ink-secondary">
              탈퇴하면 계정 정보와 이용 내역이 모두 사라지고,
              다시 되돌릴 수 없어요.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setShowWithdrawConfirm(false)}
                className="h-11 flex-1 rounded-xl border border-border text-[14px] font-bold text-ink-secondary"
              >
                취소
              </button>
              <button
                onClick={handleWithdraw}
                className="h-11 flex-1 rounded-xl bg-brand text-[14px] font-bold text-white"
              >
                탈퇴하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-16 items-center justify-between rounded-2xl border border-border bg-white px-5">
      <span className="text-[15px] text-ink">{label}</span>
      {children}
    </div>
  );
}
