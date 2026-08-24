/** 사장님 화면(좌석 관리 / 홈 대시보드)과 손님 화면(지도/검색/카페 상세)이 공통으로 쓰는
 * 혼잡도 계산/표시 로직을 한 곳으로 모았어요.
 *
 * ⚠️ 예전엔 두 화면이 완전히 다른 방식으로 혼잡도를 계산했어요:
 *  - 사장님 화면: 이 파일의 getCongestion(remaining, total)로 프론트에서 자체적으로
 *    비율을 계산(여유/주의/부족/만석, 4단계)
 *  - 손님 화면(stores-store.tsx): 서버 GET /api/stores/{store}/congestion 응답의
 *    congestion 값(RELAXED/NORMAL/BUSY/NEAR_FULL/UNAVAILABLE)을 여유/주의/혼잡
 *    3단계로 변환
 * 두 계산식의 경계값이 서로 달라서, 똑같은 좌석 상황인데도 사장님 화면엔 "주의"로,
 * 손님 화면엔 "여유"로 다르게 보이는 문제가 있었어요.
 *
 * 이제 두 화면 모두 서버 값(CONGESTION_API_TO_LEVEL로 변환)을 "같은 값"으로
 * 사용해요. estimateCongestionFromRatio는 서버 연동 전(API 미설정)이거나 아직 값을
 * 못 불러왔을 때만 쓰는 대체용 추정치예요 — 실제 값이 오면 항상 서버 값이 우선해요. */

import type { ApiAvailability } from "@/lib/api";

/** 손님 화면(SeatStatus, data.ts)과 동일한 3단계. 사장님 화면도 이제 같은 값을 써요. */
export type CongestionLevel = "여유" | "주의" | "혼잡";

/** 손님 화면(StatusBadge/FilterChips/MapPlaceholder)과 동일한 색상 체계예요. */
export const congestionStyle: Record<CongestionLevel, { bg: string; text: string }> = {
  여유: { bg: "bg-sage-tint", text: "text-sage-dark" },
  주의: { bg: "bg-amber-tint", text: "text-amber-dark" },
  혼잡: { bg: "bg-brand-tint", text: "text-brand-dark" },
};

/** 서버 congestion 값 → 화면 3단계.
 * ⚠️ 2026-08-24 조정: 예전엔 RELAXED/NORMAL→여유, BUSY→주의, NEAR_FULL/UNAVAILABLE→혼잡
 * 이었는데, 이 경계값대로면 "총 12석 중 3석(25%)만 남은" 것처럼 꽤 빠듯한
 * 상황도 BUSY로 분류돼 "주의"로만 표시되고 "혼잡"까지는 좀처럼 안 떴어요.
 * (실제로 estimateCongestionFromRatio 같은 비율 계산으로는 25% 남았으면 이미
 * "혼잡" 구간이에요 — 아래 함수 참고.) 남은 자리가 적을수록 더 엄격하게
 * "혼잡"로 보이도록 BUSY를 혼잡 쪽으로 옮겼어요: 이제 RELAXED만 여유,
 * NORMAL만 주의, BUSY부터는(NEAR_FULL·UNAVAILABLE 포함) 혼잡으로 표시해요.
 * 이 값 자체(RELAXED/NORMAL/BUSY/NEAR_FULL/UNAVAILABLE 판정 기준)는 백엔드가
 * 정하는 값이라 프론트에서 그 경계(예: 몇 %가 BUSY인지)까지는 못 바꿔요 —
 * 화면에 "몇 단계로 보여줄지"만 아래 매핑에서 조정할 수 있어요. */
export const CONGESTION_API_TO_LEVEL: Record<ApiAvailability["congestion"], CongestionLevel> = {
  RELAXED: "여유",
  NORMAL: "주의",
  BUSY: "혼잡",
  NEAR_FULL: "혼잡",
  UNAVAILABLE: "혼잡",
};

/** 서버 값을 아직 못 불러왔을 때(로딩 중 / API 미설정)만 쓰는 대체 추정치예요.
 * 실제 서버 값이 오면 이 함수 대신 CONGESTION_API_TO_LEVEL을 써야 손님 화면과
 * 어긋나지 않아요. */
export function estimateCongestionFromRatio(remaining: number, total: number): CongestionLevel {
  if (total <= 0 || remaining <= 0) return "혼잡";
  const ratio = remaining / total;
  if (ratio < 1 / 3) return "혼잡";
  if (ratio < 2 / 3) return "주의";
  return "여유";
}

/** 잔여 좌석 상황을 "총 12석 중 3석 남았어요 · 주의" 같은 문장으로 보여줘요. */
export function remainingMessage(
  remaining: number,
  total: number,
  level: CongestionLevel
): string {
  if (total === 0) return "";
  if (remaining === 0) return `총 ${total}석 모두 사용 중이에요 · 좌석 없음`;
  return `총 ${total}석 중 ${remaining}석 남았어요 · 좌석 ${level}`;
}
