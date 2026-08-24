"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchTodaySales,
  apiOwnerListMenus,
  apiOwnerCreateMenu,
  apiOwnerCreateMenuCategory,
  apiOwnerUpdateMenu,
  apiOwnerDeleteMenu,
  apiOwnerListStoreOrders,
  apiOwnerUpdateOrderStatus,
  type ApiOrderDetail,
  apiOwnerReplyToReview,
  apiOwnerUpdateReviewReply,
  apiOwnerDeleteReviewReply,
  apiOwnerListSeats,
  apiOwnerCreateSeat,
  apiOwnerDeleteSeat,
  apiOwnerUpdateSeat,
  apiGetStore,
  apiGetStoreReviews,
  apiOwnerUpdateBusinessStatus,
  apiOwnerUpdateStoreProfile,
  apiGetStoreCongestion,
  isApiConfigured,
  type ApiStore,
  type ApiStoreTag,
  type ApiStoreBusinessHour,
  type ApiSeat,
  type ApiReview,
  extractReplyContent,
  extractReplyId,
  extractReviewImageUrls,
} from "@/lib/api";
import { useOwnerAuth } from "@/lib/owner-auth-store";
import { geocodeAddress } from "@/lib/kakao-map-sdk";
import {
  CONGESTION_API_TO_LEVEL,
  estimateCongestionFromRatio,
  type CongestionLevel,
} from "@/lib/seat-congestion";

/* ------------------------------- Types ------------------------------- */

export type SeatState = "사용중" | "비어있음" | "대기";

export type OwnerSeat = {
  id: string;
  label: string;
  status: SeatState;
};

export type OrderState = "결제대기" | "주문접수" | "준비중" | "준비완료" | "완료" | "취소됨";

export type OwnerOrderItem = {
  name: string;
  quantity: number;
  price: number;
};

export type OwnerOrder = {
  id: string;
  customerName: string;
  /** 손님이 자기 프로필에 등록한 사진. 없으면 null이고, 화면에서는
   * ImagePlaceholder가 기존 회색 아이콘으로 자동 폴백해요. */
  customerImageUrl: string | null;
  date: string;
  status: OrderState;
  amount: number;
  items: OwnerOrderItem[];
};

export type MenuCategory = "커피" | "음료" | "디저트";

export type OwnerMenuItem = {
  id: string;
  name: string;
  price: number;
  category: MenuCategory;
  stock: number | null; // null = 무제한
  imageUrl: string | null;
};

export type OwnerReview = {
  id: string;
  customerName: string;
  rating: number;
  content: string;
  date: string;
  reply: string | null;
  /** 이 리뷰에 남긴 내 답글의 서버 id. PUT/DELETE /api/owner/review-replies/{reply}에
   * 필요해요. 답글을 아직 안 남겼거나, 남겼지만 서버 응답에서 id를 못 찾았으면
   * null이에요(그런 경우엔 새로 POST해서 등록해요 — 중복 답글은 서버가 422로
   * 막아줄 거예요). */
  replyId: string | null;
  /** 손님이 리뷰에 첨부한 사진(있는 경우). 서버 응답 스키마가 문서화돼 있지
   * 않아서 흔한 필드명을 후보로 시도해요. */
  images: string[];
};

/** 매장 태그(카테고리)로 고를 수 있는 항목들. 매장 프로필 화면과 아래
 * mapApiStoreToProfile이 같은 목록을 참조해야, 서버에 남아있는 다른 이름의
 * 태그(예: 테스트 계정에 붙어있던 "테스트 태그" 같은 검증용 데이터)가 화면에
 * 섞여 보이지 않아요. */
export const STORE_TAG_OPTIONS = [
  "커피",
  "음료",
  "디저트",
  "베이커리",
  "브런치",
  "로스터리",
  "티(차)",
  "스터디카페",
] as const;

export type StoreProfile = {
  name: string;
  category: string;
  /** 실제 서버에 저장된 태그 목록(알려진 태그만). 추가/삭제 시 서버의 태그 id가
   * 필요해서 문자열(category)과 별도로 들고 있어요. */
  tags: ApiStoreTag[];
  description: string;
  address: string;
  phone: string;
  hours: string;
  isOpen: boolean;
  imageUrl: string | null;
};

export type SettingsState = {
  orderAlert: boolean;
  reviewAlert: boolean;
  inquiryAlert: boolean;
  marketingAlert: boolean;
  operationAlert: boolean;
};

export type OwnerInquiry = {
  id: string;
  content: string;
  createdAt: string;
  status: "접수됨" | "답변 완료";
};

export type SalesPoint = {
  hour: string; // "09" ~ "21"
  amount: number; // 해당 시간대 누적 매출(원)
};

/* ------------------------------ 초기값(mock 아님) ------------------------------ */
// 아래는 전부 "빈 상태" 기본값이에요. 예전에는 특정 카페("온기 로스터스")를 흉내 낸
// 가짜 데모 데이터가 여기 들어있었는데, 로그인/가입한 사장님과 무관한 남의 정보가
// 화면에 계속 보이는 문제가 있어서 전부 지웠어요. 실제 값은 아래 OwnerProvider의
// useEffect들이 서버(GET /api/owner/stores/{store}/... 등)에서 불러와 채워요.

const initialSeats: OwnerSeat[] = [];
const initialOrders: OwnerOrder[] = [];
const initialMenu: OwnerMenuItem[] = [];
const initialReviews: OwnerReview[] = [];

const initialStore: StoreProfile = {
  name: "",
  category: "",
  tags: [],
  description: "",
  address: "",
  phone: "",
  hours: "-",
  isOpen: true,
  imageUrl: null,
};

const initialSettings: SettingsState = {
  orderAlert: true,
  reviewAlert: true,
  inquiryAlert: false,
  marketingAlert: true,
  operationAlert: false,
};

const initialInquiries: OwnerInquiry[] = [];

// 오늘 시간대별 누적 매출. 실제 값이 없으면 빈 배열(0원)로 시작하고,
// ownerStoreId가 생기면 아래 useEffect가 fetchTodaySales로 실제 값을 채워요.
const initialTodaySalesByHour: SalesPoint[] = [];

// 어제 매출 총액. 실제 값이 없으면 0으로 시작하고, 서버 응답으로 대체돼요.
const initialYesterdayTotalSales = 0;

/** 백엔드 메뉴 카테고리 문자열/카테고리 id가 화면의 3분류와 다를 수 있어서
 * 최대한 이름으로 추정해서 매핑하고, 못 맞추면 "음료"로 기본 분류해요. */
function guessMenuCategory(name?: string | null): MenuCategory {
  const n = (name ?? "").toLowerCase();
  if (n.includes("디저트") || n.includes("케이크") || n.includes("빵")) return "디저트";
  if (n.includes("커피") || n.includes("에스프레소") || n.includes("라떼") || n.includes("아메리카노"))
    return "커피";
  return "음료";
}

/** 서버가 내려준 카테고리 이름 문자열을 화면의 3분류(커피/음료/디저트)로 맞춰요.
 * 서버 카테고리명이 정확히 일치하지 않으면(예: "베이커리") 메뉴 이름으로 다시 추측해요. */
function normalizeMenuCategory(category: string): MenuCategory {
  if (category === "커피" || category === "음료" || category === "디저트") return category;
  return guessMenuCategory(category);
}

/** 서버 좌석 status(AVAILABLE/UNAVAILABLE/MAINTENANCE) ↔ 화면 표시(비어있음/사용중/대기) 매핑.
 * setSeatStatus에서 쓰던 반대 방향 매핑과 짝을 맞췄어요. */
function apiSeatStatusToState(status: ApiSeat["status"]): SeatState {
  if (status === "UNAVAILABLE") return "사용중";
  if (status === "MAINTENANCE") return "대기";
  return "비어있음";
}
function seatStateToApiStatus(status: SeatState): "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE" {
  if (status === "사용중") return "UNAVAILABLE";
  if (status === "대기") return "MAINTENANCE";
  return "AVAILABLE";
}
/** 임시 좌석 id / seat_code 생성용 고유 문자열. 시간(ms) + 임의값을 섞어서,
 * 같은 밀리초 안에 여러 번 호출돼도(예: "총 좌석 수 12개" 초기 설정처럼
 * addSeat을 반복문으로 연달아 부를 때) 절대 겹치지 않게 해요.
 * ⚠️ 예전엔 `seat-${Date.now()}` / `S${Date.now()}`만 썼는데, 반복문 안에서는
 * Date.now()가 같은 값을 여러 번 돌려주는 경우가 흔해서, 좌석 여러 개를 한 번에
 * 만들면 화면(임시 id)과 서버(seat_code 중복으로 일부만 실제 생성됨)가 서로
 * 어긋나 버렸어요 — 이게 "좌석 수가 꼬여 보이는" 문제의 진짜 원인이었어요. */
function makeUniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function mapApiSeatToOwnerSeat(seat: ApiSeat): OwnerSeat {
  return {
    id: String(seat.id),
    label: seat.seat_name || seat.seat_code,
    status: apiSeatStatusToState(seat.status),
  };
}

const DOW_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 요일별 영업시간(business_hours)을 "매일 09:00-22:00" 또는 요일별 표시로 요약해요.
 * 정보가 없으면 "-"를 돌려줘요. */
function summarizeBusinessHours(store: ApiStore): string {
  const hours = store.business_hours;
  if (!hours || hours.length === 0) return "-";
  const open = hours.filter((h) => !h.is_closed && h.opening_time && h.closing_time);
  if (open.length === 0) return "휴무";
  const sameEveryDay = open.every(
    (h) => h.opening_time === open[0].opening_time && h.closing_time === open[0].closing_time
  );
  if (sameEveryDay && open.length >= 7) {
    return `매일 ${open[0].opening_time!.slice(0, 5)}-${open[0].closing_time!.slice(0, 5)}`;
  }
  return open
    .slice()
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map(
      (h) =>
        `${DOW_LABEL[h.day_of_week] ?? ""} ${h.opening_time!.slice(0, 5)}-${h.closing_time!.slice(0, 5)}`
    )
    .join(", ");
}

/** "매일 HH:mm-HH:mm" 형식의 요약 문자열을 요일별 business_hours 배열로 되돌려요.
 * 매장 프로필 화면의 "영업시간"은 아직 요일별로 따로 입력하는 UI가 없고 하나의
 * 텍스트 칸이라, 가장 흔한 "매일 같은 시간" 패턴만 안전하게 서버로 되돌려 보내요.
 * 패턴이 다르면(요일별로 다르게 적었거나 "휴무" 등) null을 돌려주고, 이 경우
 * 호출하는 쪽에서 business_hours를 아예 보내지 않아서 서버에 저장된 기존 값을
 * 실수로 덮어쓰지 않게 해요. */
function parseHoursSummary(text: string): ApiStoreBusinessHour[] | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^매일\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, oh, om, ch, cm] = match;
  const opening = `${oh.padStart(2, "0")}:${om}`;
  const closing = `${ch.padStart(2, "0")}:${cm}`;
  return Array.from({ length: 7 }, (_, day_of_week) => ({
    day_of_week,
    opening_time: opening,
    closing_time: closing,
    is_closed: false,
  }));
}

/** 서버 매장 정보를 화면용 StoreProfile로 변환해요.
 * 필드가 응답에 아예 없을 때(undefined)만 이전 값을 쓰고, 서버가 명시적으로
 * null/빈 값을 준 경우엔 그 값을 그대로 반영해요.
 * "영업 중" 표시는 is_open(현재 영업 중 여부)을 우선 쓰고, 구버전 응답이라
 * is_open이 없으면 is_active(매장 활성 여부)로 대체해요. */
function mapApiStoreToProfile(store: ApiStore, prev: StoreProfile): StoreProfile {
  // 서버에는 화면에서 고를 수 있는 목록(STORE_TAG_OPTIONS)에 없는 태그가 남아있을
  // 수 있어요(예: 테스트 계정에 붙어있던 "테스트 태그"). 그런 태그는 화면 상태에서
  // 아예 제외해서, 사용자가 뭘 선택하든 항상 사라지지 않고 남아있는 것처럼
  // 보이는 문제가 생기지 않게 해요. (실제 삭제는 이 값을 불러오는 쪽에서 처리해요.)
  const knownTags = (store.tags ?? []).filter(
    (t): t is ApiStoreTag =>
      Boolean(t.name) && (STORE_TAG_OPTIONS as readonly string[]).includes(t.name as string)
  );
  const category = knownTags.map((t) => t.name).join(" · ");
  return {
    name: store.name ?? prev.name,
    category,
    tags: knownTags,
    // "??"는 서버가 일부러 null(값 지움)을 돌려줘도 그걸 무시하고 이전 값을
    // 유지해버려서, 사진/설명 등을 지우고 저장해도 화면엔 예전 값이 계속 보이는
    // 버그가 있었어요. 필드가 응답에 아예 없을 때(undefined)만 이전 값을 쓰고,
    // 서버가 명시적으로 null/빈 값을 준 경우엔 그 값을 그대로 반영해요.
    description: store.description !== undefined ? store.description ?? "" : prev.description,
    address:
      store.address !== undefined || store.detail_address !== undefined
        ? [store.address, store.detail_address].filter(Boolean).join(" ")
        : prev.address,
    phone: store.phone !== undefined ? store.phone ?? "" : prev.phone,
    hours: summarizeBusinessHours(store),
    isOpen: store.is_open ?? store.is_active,
    imageUrl: store.thumbnail_url !== undefined ? store.thumbnail_url : prev.imageUrl,
  };
}

/** GET /api/stores/{store}/reviews 결과(이제 api.ts에서 답글/작성자/사진까지
 * 정규화해서 내려줘요)를 사장님 화면 모델로 그대로 옮겨요. */
function mapApiReviewToOwnerReview(review: ApiReview): OwnerReview {
  return {
    id: String(review.id),
    customerName: review.customer_name ?? "고객",
    rating: review.rating,
    content: review.content,
    date: review.created_at?.slice(0, 10).replace(/-/g, ".") ?? "",
    // ⚠️ review.reply는 문자열이 아니라 {id, review_id, author_id, content,
    // created_at, updated_at, author} 객체로 내려와요. 객체를 그대로 넣으면
    // 화면에서 그대로 렌더링될 때 "Objects are not valid as a React child"
    // 런타임 에러가 나서, 반드시 extractReplyContent로 본문만 꺼내요.
    reply: extractReplyContent(review.reply),
    replyId: extractReplyId(review),
    // ⚠️ review.images는 문자열 배열이 아니라 {id, review_id, image_url,
    // alt_text, sort_order} 객체 배열로 내려와요. 그대로 넣으면 사진이 안
    // 뜨고 타입도 어긋나서, extractReviewImageUrls로 실제 URL만 꺼내요.
    images: extractReviewImageUrls(review.images),
  };
}

/** 서버 주문 status 문자열 → 화면 상태. 손님 화면(orders-store.tsx)의
 * toOrderStatus와 동일한 기준으로 맞춰서, 손님/사장님 화면에 같은 주문이
 * 서로 다른 문구로 보이지 않게 해요. */
function apiOrderStatusToState(status: string): OrderState {
  switch (status) {
    // ⚠️ "접수/거절을 눌러도 계속 주문접수로 뜬다"는 문제의 진짜 원인:
    // PENDING_PAYMENT(아직 손님이 결제를 끝내지 않은 주문)까지 전부 "주문접수"로
    // 표시돼서 "접수 대기" 탭에 같이 섞여 있었어요. 손님이 결제를 마치지 않은
    // 주문은 사장님이 접수/거절할 수 있는 상태가 아니라서(서버가 상태 변경
    // 자체를 거부해요 — PATCH .../status가 422 "선택한 상태가 유효하지
    // 않습니다"로 실패), 눌러도 항상 실패하고 화면은 원래 상태(주문접수)로
    // 되돌아가는 것처럼 보였어요. 이제 결제 전 주문은 "결제대기"로 따로
    // 표시해서 접수 대기 목록/배지 카운트에서 빠지고, 접수·거절 버튼도
    // 뜨지 않아요.
    case "PENDING_PAYMENT":
      return "결제대기";
    case "CONFIRMED":
    case "PREPARING":
      return "준비중";
    case "READY":
      return "준비완료";
    case "COMPLETED":
      return "완료";
    case "CANCELLED":
    case "REJECTED":
    case "REFUNDED":
      return "취소됨";
    default:
      return "주문접수";
  }
}

function mapApiOrderToOwnerOrder(o: ApiOrderDetail): OwnerOrder {
  return {
    id: String(o.id),
    customerName: o.customerName ?? "고객",
    customerImageUrl: o.customerImageUrl,
    date: o.createdAt?.slice(0, 10).replace(/-/g, ".") ?? "",
    status: apiOrderStatusToState(o.status),
    amount: o.totalAmount,
    items: o.items.map((it) => ({ name: it.name, quantity: it.quantity, price: it.price })),
  };
}

/* ------------------------------- Context ------------------------------- */

type OwnerContextValue = {
  store: StoreProfile;
  /** 매장 프로필을 수정해요. 화면엔 즉시 반영되지만, 서버 저장 성공 여부를
   * 알아야 하는 화면(저장 버튼 등)을 위해 결과를 돌려줘요. */
  setStore: (patch: Partial<StoreProfile>) => Promise<{ ok: boolean; error?: string }>;
  /** 매장 태그를 켜고/끄고 해요. 저장 버튼과 별개로, 누르는 즉시 서버에도
   * 반영돼요(태그는 프로필 PATCH가 아니라 전용 태그 추가/삭제 API를 써요). */
  toggleStoreTag: (tagName: string) => void;

  seats: OwnerSeat[];
  setSeatStatus: (id: string, status: SeatState) => void;
  addSeat: (label: string) => void;
  removeSeat: (id: string) => void;
  /** 좌석 전체 삭제(중복 정리용). 서버에 실제로 지워진 좌석만 화면에서
   * 지워요 — 자세한 이유는 아래 resetAllSeats 구현부 주석 참고. */
  resetAllSeats: () => void;
  /** 좌석 목록을 서버에서 불러오는 중인지 / 마지막 시도가 실패했는지. 실패
   * 상태에선 "좌석이 진짜 0개인지 못 불러온 건지" 알 수 없으니, 화면이
   * "좌석 만들기"를 섣불리 보여주지 않게 하는 데 써요. */
  seatsLoading: boolean;
  seatsLoadFailed: boolean;
  retrySeatsLoad: () => void;
  /** 좌석 전체 초기화(resetAllSeats)가 서버 응답을 기다리는 중인지예요.
   * 이 동안엔 "총 좌석 수"가 실제로 몇 개인지 아직 확정되지 않은 상태라서,
   * 화면이 섣불리 0개로 보여주며 "좌석 만들기"를 띄우면 안 돼요 — 그러면
   * 아직 안 지워진(또는 삭제 실패한) 서버 좌석과 번호가 겹치는 새 좌석이
   * 만들어져서 "1 1 1 1"처럼 중복 좌석이 쌓이는 사고로 이어져요. */
  seatsResetting: boolean;
  /** 좌석 추가/상태변경/삭제를 서버에 저장하려다 실패했을 때의 안내 문구.
   * 화면에 보이는 좌석은 항상 낙관적으로 먼저 바뀌지만, 저장이 실패하면
   * 원래 상태로 되돌리면서 이 메시지를 채워요 — "눌러도 반영이 안 되는" 것처럼
   * 보이지 않고 왜 안 됐는지 알 수 있게요. 성공하면 다시 null이 돼요. */
  seatSyncError: string | null;
  /** 손님 화면(지도/검색/카페 상세)과 정확히 같은 값이에요 — 둘 다 서버
   * GET /api/stores/{store}/congestion 값을 그대로 써요(seat-congestion.ts).
   * 아직 못 불러왔을 때만 좌석 수로 추정한 값을 잠깐 보여줘요. */
  congestion: CongestionLevel;

  orders: OwnerOrder[];
  /** 주문을 접수하고 준비를 시작해요("주문접수"에서 "준비중"으로). */
  acceptOrder: (id: string) => void;
  /** 아직 준비를 시작하지 않은 주문을 거절해요. */
  rejectOrder: (id: string) => void;
  /** 준비가 끝나 손님이 픽업할 수 있는 상태로 바꿔요. */
  markOrderReady: (id: string) => void;
  /** 손님이 픽업을 완료해서 주문을 마무리해요. */
  completeOrder: (id: string) => void;
  /** 이미 접수된 주문을 취소해요. */
  cancelOrder: (id: string) => void;

  menu: OwnerMenuItem[];
  /** 메뉴를 추가해요. 서버 저장에 실패하면(예: 이 매장에 해당 카테고리가 아직
   * 없어서) 화면에 붙였던 항목을 다시 지우고 실패를 알려줘요 — 저장 안 된
   * 메뉴가 화면에만 남아있다가 재로그인 시 사라지는 것처럼 보이지 않게 해요. */
  addMenuItem: (item: Omit<OwnerMenuItem, "id">) => Promise<{ ok: boolean; error?: string }>;
  updateMenuItem: (id: string, patch: Partial<OwnerMenuItem>) => void;
  removeMenuItem: (id: string) => void;

  reviews: OwnerReview[];
  /** 답글을 새로 남기거나(POST) 이미 남긴 답글을 수정해요(PUT). 어느 쪽인지는
   * 해당 리뷰의 replyId 유무로 자동 판단해요. */
  replyToReview: (id: string, reply: string) => void;
  /** 남긴 답글을 삭제해요(DELETE /api/owner/review-replies/{reply}). 손님이
   * 작성한 리뷰 자체는 사장님이 지울 수 있는 API가 없어서(문서화된 엔드포인트
   * 없음), 답글만 지워요. */
  deleteReviewReply: (id: string) => void;

  settings: SettingsState;
  setSettings: (patch: Partial<SettingsState>) => void;

  inquiries: OwnerInquiry[];
  addInquiry: (content: string) => void;

  todaySalesByHour: SalesPoint[];
  addSalesPoint: (point: SalesPoint) => void;
  todaySales: number;
  salesChangePct: number;
  /** true인 동안은 서버에서 매출 데이터를 불러오는 중이에요 (그래프/카드에 로딩 표시용) */
  salesLoading: boolean;
  /** 서버 연동에 실패했을 때만 채워져요. 실패해도 화면은 기존 데이터로 계속 동작해요 */
  salesError: string | null;
  /** 새로고침 버튼 등에서 수동으로 다시 불러오고 싶을 때 사용 */
  refetchSales: () => void;
};

const OwnerContext = createContext<OwnerContextValue | null>(null);

export function OwnerProvider({ children }: { children: ReactNode }) {
  // 로그인/회원가입 때 저장된 실제 백엔드 매장 ID. 아직 로그인 전이거나 조회
  // 못했으면 null이고, 이 경우 아래 모든 서버 연동은 자동으로 건너뛰어져서
  // 화면은 빈 상태(등록된 정보 없음)로 안전하게 유지돼요.
  const { ownerStoreId, isOwnerLoggedIn } = useOwnerAuth();

  const [store, setStoreState] = useState<StoreProfile>(initialStore);
  // 2026-08-19 백엔드 변경사항 문서로 좌석 목록 조회(GET .../seats)가 추가돼서,
  // 이제 메뉴/예약과 동일하게 서버에서 실제 좌석 목록을 불러와요.
  const [seats, setSeats] = useState<OwnerSeat[]>(initialSeats);
  const [seatSyncError, setSeatSyncError] = useState<string | null>(null);
  // ⚠️ 예전엔 좌석 목록을 못 불러와도(서버 연결 실패 등) 그냥 seats가 빈
  // 배열로 남아서, 화면은 "아직 등록된 좌석이 없어요"라고 보여줬어요. 근데
  // 실제로는 서버에 이미 좌석이 있는데 "못 불러온 것"과 "진짜 0개인 것"을
  // 구분할 수 없어서, 사장님이 그 화면만 보고 "좌석 만들기"를 다시 눌러
  // 서버에 중복된 좌석이 쌓이는 사고(예: 1,2,3...이 여러 번 겹쳐 생김)가
  // 있었어요. 이제 "불러오는 중" / "불러오기 실패" / "진짜 0개 확인됨"을
  // 구분해서, 실패했을 땐 새로 만들기 버튼 대신 원인 안내를 보여줘요.
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [seatsResetting, setSeatsResetting] = useState(false);
  const [seatsLoadFailed, setSeatsLoadFailed] = useState(false);
  const [seatsRefreshKey, setSeatsRefreshKey] = useState(0);
  // 서버에서 불러온 실제 혼잡도(손님 화면과 동일한 값). 아직 못 불러왔으면
  // null이고, 그동안은 좌석 수로 추정한 값을 화면에 보여줘요.
  const [serverCongestion, setServerCongestion] = useState<CongestionLevel | null>(null);
  const [orders, setOrders] = useState<OwnerOrder[]>(initialOrders);
  // ⚠️ 8초 폴링 응답이 도착 순서를 보장하지 않아서, 방금 접수/취소한 주문을
  // "그 전에 이미 나가 있던" 낡은 폴링 응답이 되돌려버리는 문제가 있었어요
  // (=사장님이 분명 취소했는데 화면에 계속 뜨는 문제의 실제 원인). 요청마다
  // 번호를 매겨서, 최신 요청의 응답만 반영하고 낡은 응답은 버려요.
  const ordersRequestIdRef = useRef(0);
  const [menu, setMenu] = useState<OwnerMenuItem[]>(initialMenu);
  const [reviews, setReviews] = useState<OwnerReview[]>(initialReviews);
  const [settings, setSettingsState] = useState<SettingsState>(initialSettings);
  const [inquiries, setInquiries] = useState<OwnerInquiry[]>(initialInquiries);
  const [todaySalesByHour, setTodaySalesByHour] = useState<SalesPoint[]>(
    initialTodaySalesByHour
  );
  const [yesterdayTotalSales, setYesterdayTotalSales] = useState<number>(
    initialYesterdayTotalSales
  );
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);
  const [salesRefreshKey, setSalesRefreshKey] = useState(0);

  // 실제 storeId가 생기면(로그인/가입 완료) 오늘 매출 데이터를 서버에서 가져와요.
  // NEXT_PUBLIC_API_BASE_URL이 아직 없거나 storeId를 모르면 fetchTodaySales가
  // 바로 null을 돌려주기 때문에 이 시점엔 네트워크 요청 없이 기존 mock 데이터가
  // 그대로 화면에 남아요.
  // ⚠️ 예전엔 storeId가 생기는 시점에 딱 한 번만 불러오고 끝이라(salesRefreshKey도
  // 아무도 바꾸지 않아서 사실상 미사용 변수였어요), 그 뒤에 손님이 실제로 결제를
  // 완료해도 "오늘 매출" 카드는 로그인 시점 값에 계속 멈춰 있었어요. 주문/좌석과
  // 똑같이 8초마다 다시 불러오고, 다른 탭을 보다가 이 화면으로 돌아오면(포커스/
  // 가시성 복귀) 즉시 한 번 더 불러오도록 해서 실제 결제 내역이 반영되게 해요.
  useEffect(() => {
    if (!ownerStoreId) return;
    let cancelled = false;
    const load = () => {
      setSalesLoading(true);
      setSalesError(null);
      fetchTodaySales(ownerStoreId)
        .then((result) => {
          if (cancelled) return;
          if (result) {
            setTodaySalesByHour(result.hourly);
            setYesterdayTotalSales(result.yesterdayTotal);
          }
          // result가 null이면(연동 전이거나 일시적 오류) 기존 값을 그대로 유지해요.
        })
        .catch(() => {
          if (cancelled) return;
          setSalesError("매출 데이터를 불러오지 못했어요.");
        })
        .finally(() => {
          if (!cancelled) setSalesLoading(false);
        });
    };
    load();
    const interval = setInterval(load, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [ownerStoreId, salesRefreshKey]);

  // 매장 좌석 목록을 서버에서 불러와요.
  // ⚠️ 메뉴·예약과 동일하게 `/api/owner/seats`는 storeId를 URL에 안 넣는 경로예요
  // (문서 섹션 11-4, 서버가 토큰으로 활성 OWNER 매장을 자동 선택해요). 그래서
  // ownerStoreId 캐시 여부와 상관없이 로그인만 돼 있으면 항상 불러올 수 있어요.
  useEffect(() => {
    if (!isOwnerLoggedIn) return;
    if (!isApiConfigured()) return; // 목데이터 모드 — "못 불러온 것"이 아니라 애초에 서버가 없는 상태예요.
    let cancelled = false;
    setSeatsLoading(true);
    apiOwnerListSeats().then((rows) => {
      if (cancelled) return;
      setSeatsLoading(false);
      if (!rows) {
        setSeatsLoadFailed(true);
        return;
      }
      setSeatsLoadFailed(false);
      setSeats(rows.map(mapApiSeatToOwnerSeat));
    });
    return () => {
      cancelled = true;
    };
  }, [isOwnerLoggedIn, seatsRefreshKey]);

  const retrySeatsLoad = () => setSeatsRefreshKey((k) => k + 1);

  // 매장 메뉴 목록을 서버에서 불러와요.
  // ⚠️ 다른 화면(좌석/매출/매장 프로필)과 달리 메뉴 조회·등록은 storeId를 URL에
  // 넣지 않는 `/api/owner/menus` 경로예요(문서 섹션 11-3, 서버가 토큰으로 매장을
  // 자동 선택해요). 그래서 ownerStoreId 캐시 여부와 상관없이 로그인만 돼 있으면
  // 항상 불러올 수 있어요 — ownerStoreId를 기다리다 못 구하면(구버전 흔적 등)
  // 메뉴 목록 자체를 영영 못 불러오는 문제를 피할 수 있어요.
  useEffect(() => {
    if (!isOwnerLoggedIn) return;
    let cancelled = false;
    apiOwnerListMenus().then((rows) => {
      if (cancelled || !rows) return;
      setMenu(
        rows.map((m) => ({
          id: String(m.id),
          name: m.name,
          price: Math.round(Number(m.price)),
          category: m.category
            ? normalizeMenuCategory(m.category)
            : guessMenuCategory(m.name),
          stock: null,
          imageUrl: m.image_url ?? null,
        }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isOwnerLoggedIn]);

  // 매장 주문 목록을 서버에서 불러와요.
  // ⚠️ 예약과 달리 이 경로(GET /api/owner/stores/{store}/orders)는 storeId를
  // URL에 직접 넣어야 해서, 다른 오너 API들과 달리 ownerStoreId가 필요해요.
  // ⚠️ 예전엔 최초 1번만 불러오고 끝이라, 손님이 새로 주문을 넣거나 상태가
  // 바뀌어도 사장님 화면은 탭을 새로고침하기 전까진 그대로였어요("실시간 반영이
  // 안 된다"는 문제). 진짜 웹소켓 없이도 체감상 실시간처럼 보이도록 8초마다
  // 다시 불러오고, 다른 탭을 보다가 이 화면으로 돌아오면(포커스/가시성 복귀)
  // 즉시 한 번 더 불러와요.
  // 이미 "완료"로 확인한 주문 id들. 폴링으로 새로 "완료" 상태인 주문을
  // 발견하면(이 화면의 완료 버튼이 아니라 다른 기기나 Swagger 등 다른 경로로
  // 완료 처리된 경우 포함) 오늘 매출을 바로 다시 불러와요 — 그래야 "분명
  // 주문을 완료 처리했는데 사장님 메인의 오늘 매출엔 반영이 안 된다"는 문제가
  // (다음 8초 폴링을 기다리지 않고) 바로 해결돼요.
  const knownCompletedOrderIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!ownerStoreId) return;
    let cancelled = false;
    const load = () => {
      const reqId = ++ordersRequestIdRef.current;
      apiOwnerListStoreOrders(ownerStoreId).then((rows) => {
        if (cancelled || !rows || reqId !== ordersRequestIdRef.current) return;
        const mapped = rows.map(mapApiOrderToOwnerOrder);
        setOrders(mapped);
        const newlyCompleted = mapped.some(
          (o) => o.status === "완료" && !knownCompletedOrderIdsRef.current.has(o.id),
        );
        knownCompletedOrderIdsRef.current = new Set(
          mapped.filter((o) => o.status === "완료").map((o) => o.id),
        );
        if (newlyCompleted) refetchSales();
      });
    };
    load();
    const interval = setInterval(load, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [ownerStoreId]);

  // 혼잡도(여유/주의/혼잡)를 서버에서 불러와요.
  // ⚠️ "사장님 화면엔 주의인데 손님 화면엔 여유로 뜬다"는 문제의 원인은 두
  // 화면이 서로 다른 계산식을 썼기 때문이었어요(seat-congestion.ts 상단 설명
  // 참고). 이제 손님 화면과 완전히 같은 엔드포인트(GET
  // /api/stores/{store}/congestion)를 그대로 불러와서 항상 같은 값을 보여줘요.
  // 주문/좌석과 마찬가지로 8초마다 다시 불러오고, 탭 복귀 시에도 즉시 갱신해요.
  useEffect(() => {
    if (!ownerStoreId) return;
    let cancelled = false;
    const load = () => {
      apiGetStoreCongestion(ownerStoreId).then((res) => {
        if (cancelled || !res) return;
        setServerCongestion(CONGESTION_API_TO_LEVEL[res.congestion]);
      });
    };
    load();
    const interval = setInterval(load, 8000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
    };
  }, [ownerStoreId]);

  // 매장 프로필(이름/설명/주소/전화/영업시간/영업상태/대표이미지)을 서버에서 불러와요.
  // 회원가입 응답에도 store 정보가 함께 오지만, 로그인으로 들어온 경우나 새로고침한
  // 경우까지 항상 최신값으로 채우기 위해 ownerStoreId가 생길 때마다 다시 조회해요.
  useEffect(() => {
    if (!ownerStoreId) return;
    let cancelled = false;
    apiGetStore(ownerStoreId).then((res) => {
      if (cancelled || !res) return;
      setStoreState((prev) => mapApiStoreToProfile(res.store, prev));

      // 화면에서 고를 수 있는 목록(STORE_TAG_OPTIONS)에 없는 태그(예: 테스트 계정에
      // 남아있던 "테스트 태그")는 서버에서도 정리해요. 그대로 두면 화면에는 안 보여도
      // 다음에 매장 프로필을 불러올 때마다 계속 남아있게 돼요.
      // ⚠️ 태그 1개만 지우는 전용 삭제 API는 실제로 없어서(2026-08-19 백엔드
      // 변경사항 문서 기준), 알려진 태그만 남긴 전체 목록을 PATCH .../stores/{store}로
      // 다시 동기화하는 방식으로 정리해요(toggleStoreTag와 동일한 방식).
      const knownTags = (res.store.tags ?? []).filter(
        (t) => t.name && (STORE_TAG_OPTIONS as readonly string[]).includes(t.name)
      );
      const hasUnknownTags = (res.store.tags ?? []).length !== knownTags.length;
      if (hasUnknownTags) {
        void apiOwnerUpdateStoreProfile(ownerStoreId, {
          tags: knownTags.map((t) => ({ name: t.name ?? "", ...(t.slug ? { slug: t.slug } : {}) })),
        }).then((updated) => {
          if (!cancelled && updated) setStoreState((prev) => mapApiStoreToProfile(updated, prev));
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ownerStoreId]);

  // 매장 리뷰 목록을 서버에서 불러와요.
  useEffect(() => {
    if (!ownerStoreId) return;
    let cancelled = false;
    apiGetStoreReviews(ownerStoreId).then((rows) => {
      if (cancelled || !rows) return;
      setReviews(rows.map(mapApiReviewToOwnerReview));
    });
    return () => {
      cancelled = true;
    };
  }, [ownerStoreId]);

  // 서버 값이 아직 없으면(로딩 중/API 미설정) 좌석 수로 추정한 값을 대신 써요.
  // 서버 값이 오면 항상 그 값이 우선이라 손님 화면과 어긋나지 않아요.
  const congestion =
    serverCongestion ??
    estimateCongestionFromRatio(
      seats.filter((s) => s.status === "비어있음").length,
      seats.length
    );

  const refetchSales = () => setSalesRefreshKey((k) => k + 1);

  const setStore = async (patch: Partial<StoreProfile>): Promise<{ ok: boolean; error?: string }> => {
    setStoreState((prev) => ({ ...prev, ...patch }));
    // ⚠️ 예전엔 ownerStoreId가 없을 때 여기서 그냥 { ok: true }를 돌려줘서,
    // 실제로는 서버에 아무것도 저장 안 됐는데 화면엔 "저장 완료!" 토스트가 떠서
    // 로그아웃 후 재로그인하면 감쪽같이 사라진 것처럼 보였어요. 이제 매장 ID가
    // 없으면 저장이 안 됐다는 걸 화면에 그대로 알려요.
    if (!ownerStoreId) {
      return {
        ok: false,
        error: "로그인한 계정에 연결된 매장을 찾지 못해 저장하지 못했어요. 다시 로그인해주세요.",
      };
    }

    // 영업 중/마감 상태는 PATCH .../business-status + is_open으로 보내요.
    // (2026-08-19 백엔드 변경사항 문서로 확정된 경로/필드명이에요)
    if (typeof patch.isOpen === "boolean") {
      void apiOwnerUpdateBusinessStatus(ownerStoreId, patch.isOpen);
    }

    // 나머지 프로필 항목(이름/설명/주소/전화/이미지/영업시간)은
    // PATCH /api/owner/stores/{store}로 저장해요. 응답의 최신 store 값으로
    // 화면을 다시 맞춰서, 서버가 실제로 저장한 값과 화면이 어긋나지 않게 해요.
    // (사업자 정보는 화면에서 입력받지 않아서 여기서 보내지 않아요 — 서버에 남아있는
    // 기존 값은 이 PATCH가 부분 수정이라 그대로 유지돼요.)
    const { name, description, address, phone, imageUrl, hours } = patch;
    // ⚠️ 예전엔 영업시간(hours)을 서버로 전혀 보내지 않아서, 화면에는 저장된
    // 것처럼 보여도 실제로는 이 기기에만 남아있었어요. 그래서 로그아웃 후 다시
    // 로그인하면(서버 값으로 새로 덮어써지면서) 감쪽같이 사라진 것처럼 보였어요.
    // 이제 실제로 서버에 실어 보내요.
    const businessHours = hours !== undefined ? parseHoursSummary(hours) : undefined;

    // ⚠️ 지도에 매장 핀이 뜨지 않던 원인: 주소를 저장할 때 latitude/longitude를
    // 전혀 서버로 보내지 않았어요. 그래서 서버 좌표가 계속 null로 남고, 지도
    // 화면은 그걸 (0,0)으로 취급해 핀을 걸러버렸어요(기니만 앞바다라 실제 위치가
    // 아니라서). 이제 주소가 바뀌면 카카오 지오코더로 좌표를 구해서 함께 보내요.
    let geocoded: { lat: number; lng: number } | null = null;
    if (address !== undefined && address.trim()) {
      geocoded = await geocodeAddress(
        address,
        process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? ""
      );
    }

    if (
      name !== undefined ||
      description !== undefined ||
      address !== undefined ||
      phone !== undefined ||
      imageUrl !== undefined ||
      businessHours
    ) {
      const updated = await apiOwnerUpdateStoreProfile(ownerStoreId, {
        name,
        description,
        address,
        phone,
        thumbnail_url: imageUrl,
        ...(geocoded ? { latitude: geocoded.lat, longitude: geocoded.lng } : {}),
        ...(businessHours ? { business_hours: businessHours } : {}),
      });
      if (!updated) {
        return {
          ok: false,
          error: "매장 정보를 서버에 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
        };
      }
      setStoreState((prev) => mapApiStoreToProfile(updated, prev));
    }
    return { ok: true };
  };

  const toggleStoreTag = (tagName: string) => {
    const existing = store.tags.find((t) => t.name === tagName);
    const prevTags = store.tags;

    // ⚠️ 예전엔 태그 1개를 서버에 추가/삭제하는 전용 API(POST .../tags,
    // DELETE /api/tags/{id})가 있는 줄 알고 그걸 호출했는데, 2026-08-19
    // 백엔드 변경사항 문서를 보면 그런 엔드포인트가 없고, 태그는 매장 프로필
    // PATCH(/api/owner/stores/{store})에 "현재 선택된 태그 전체 배열"을 실어
    // 보내면 서버가 그 값으로 통째로 동기화하는 방식이에요. 예전 방식은 실제로는
    // 없는 API를 호출하다 실패해서, 태그를 눌러도 화면에 잠깐 붙었다가(낙관적 업데이트)
    // 곧바로 실패 처리로 다시 사라지는 것처럼 보였어요.
    const nextTags = existing
      ? prevTags.filter((t) => t.id !== existing.id)
      : [...prevTags, { id: -Date.now(), name: tagName } as ApiStoreTag];

    // 화면엔 먼저 낙관적으로 반영해요.
    setStoreState((prev) => ({
      ...prev,
      tags: nextTags,
      category: nextTags.map((t) => t.name).join(" · "),
    }));

    if (!ownerStoreId) return;

    void apiOwnerUpdateStoreProfile(ownerStoreId, {
      tags: nextTags.map((t) => ({ name: t.name ?? "", ...(t.slug ? { slug: t.slug } : {}) })),
    }).then((updated) => {
      if (updated) {
        // 서버가 실제로 저장한 태그(실제 id 포함)로 화면을 맞춰요.
        setStoreState((prev) => mapApiStoreToProfile(updated, prev));
        return;
      }
      // 저장에 실패했으면 누르기 전 상태로 되돌려요.
      setStoreState((prev) => ({
        ...prev,
        tags: prevTags,
        category: prevTags.map((t) => t.name).join(" · "),
      }));
    });
  };

  // addSeat이 서버 응답을 기다리는 동안에는 좌석 id가 아직 "seat-"로 시작하는
  // 임시값이에요(서버가 실제 id를 내려주면 그걸로 교체돼요). 이 임시 id로
  // 상태변경/삭제 API를 호출하면 서버엔 존재하지 않는 좌석이라 조용히
  // 실패하기만 해서, 여기서 미리 걸러서 화면-서버가 어긋나지 않게 해요.
  const isTempSeatId = (id: string) => id.startsWith("seat-");

  // 좌석 상태를 바꿀 때마다(총 좌석 수 스테퍼, 남은 좌석 수 숫자판 포함) 서버에도
  // 즉시 반영해요. 이 좌석 상태(AVAILABLE/UNAVAILABLE)가 카페 상세·지도의
  // "잔여 좌석" 계산(GET /api/stores/{store}/congestion)의 원본 데이터라서,
  // 여기서 저장이 안 되면 손님 화면도 절대 실시간으로 안 바뀌어요.
  const setSeatStatus = (id: string, status: SeatState) => {
    const prevStatus = seats.find((s) => s.id === id)?.status;
    setSeats((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    if (!isOwnerLoggedIn || isTempSeatId(id) || !isApiConfigured()) return;
    void apiOwnerUpdateSeat(id, seatStateToApiStatus(status)).then((ok) => {
      if (ok) {
        setSeatSyncError(null);
        return;
      }
      // 저장 실패 — 화면이 실제로 저장된 상태와 다르게 보이지 않도록 원래
      // 상태로 되돌리고, 왜 안 됐는지 안내해요("눌러도 반영이 안 되는 것
      // 같다"는 혼란의 원인이 바로 이 조용한 실패였어요).
      if (prevStatus) {
        setSeats((prev) => prev.map((s) => (s.id === id ? { ...s, status: prevStatus } : s)));
      }
      setSeatSyncError(
        "좌석 상태 저장에 실패했어요. 백엔드 서버 주소(192.168.x.x)에 지금 이 기기에서 접속할 수 있는지 확인해주세요.",
      );
    });
  };

  const addSeat = (label: string) => {
    const tempId = `seat-${makeUniqueSuffix()}`;
    setSeats((prev) => [...prev, { id: tempId, label, status: "비어있음" }]);

    if (!isOwnerLoggedIn || !isApiConfigured()) return;
    // seat_code/seat_type/capacity/floor_number는 화면에 입력칸이 없어서
    // 합리적인 기본값으로 채워요(좌석 이름만 실제로 사장님이 입력한 값이에요).
    // seat_code는 매장 안에서 고유해야 해서 makeUniqueSuffix()로 만들어요.
    apiOwnerCreateSeat({
      seat_code: `S${makeUniqueSuffix()}`,
      seat_name: label,
      seat_type: "NORMAL",
      capacity: 1,
      floor_number: 1,
    }).then((created) => {
      if (!created) {
        // ⚠️ 서버 저장에 실패했는데 화면엔 임시 좌석이 그대로 남아있으면,
        // 그 좌석은 실제로 존재하지 않는데도(가짜 id) 이후 +/-·상태변경·삭제를
        // 시도할 때마다 서버 요청이 조용히 실패하는 "꼬인" 상태가 계속돼요.
        // 실패한 임시 좌석은 화면에서도 지워서 항상 서버와 같은 상태를 보여주고,
        // 대신 왜 사라졌는지 안내를 남겨요(예전엔 여기서 조용히 사라지기만
        // 해서 "숫자를 입력해도 아무 반응이 없다"는 것처럼 보였어요).
        setSeats((prev) => prev.filter((s) => s.id !== tempId));
        setSeatSyncError(
          "좌석 저장에 실패했어요. 백엔드 서버 주소(192.168.x.x)에 지금 이 기기에서 접속할 수 있는지 확인해주세요.",
        );
        return;
      }
      setSeatSyncError(null);
      // 서버가 발급한 진짜 id로 교체해요. (이후 상태변경/삭제가 서버에도 반영되도록)
      setSeats((prev) =>
        prev.map((s) => (s.id === tempId ? { ...s, id: String(created.id) } : s))
      );
    });
  };

  const removeSeat = (id: string) => {
    const removed = seats.find((s) => s.id === id);
    setSeats((prev) => prev.filter((s) => s.id !== id));
    if (!isOwnerLoggedIn || isTempSeatId(id) || !isApiConfigured()) return;
    void apiOwnerDeleteSeat(id).then((ok) => {
      if (ok) {
        setSeatSyncError(null);
        return;
      }
      // 삭제 실패 — 되돌려서 서버와 다시 맞추고 안내해요.
      if (removed) setSeats((prev) => [...prev, removed]);
      setSeatSyncError(
        "좌석 삭제에 실패했어요. 백엔드 서버 주소(192.168.x.x)에 지금 이 기기에서 접속할 수 있는지 확인해주세요.",
      );
    });
  };

  /** 좌석을 전부 지워요. 서버 연결이 끊긴 동안 "좌석 만들기"를 여러 번 눌러
   * 번호가 겹치는 좌석이 쌓였을 때, 하나씩 지우는 대신 한 번에 정리하고 맨
   * 위 "전체 좌석 수"로 다시 깔끔하게 만들 수 있게 하는 용도예요.
   *
   * ⚠️ 예전엔 이 함수가 seats를 순회하며 removeSeat()을 하나씩 불렀는데,
   * removeSeat은 "먼저 화면에서 지우고, 서버 삭제가 실패하면 되돌리는"
   * 낙관적 업데이트 방식이었어요. 그래서 백엔드에 접속이 안 되는 상황(예:
   * 192.168.x.x가 지금 이 기기에서 응답이 없을 때)에서 "초기화"를 누르면:
   *   1) 좌석들이 화면에서 일단 전부(0개로) 사라지고,
   *   2) 화면이 total===0으로 판단해 "아직 좌석이 없어요 + 좌석 만들기"
   *      입력칸을 바로 띄우고,
   *   3) 그 사이 사장님이 그 입력칸에 숫자를 넣고 "좌석 만들기"를 누르면
   *      새 좌석(1, 2, 3...)이 만들어지는데,
   *   4) 뒤늦게 아까 그 삭제 요청들이 전부 실패로 돌아오면서 removeSeat이
   *      "삭제 안 됐다"며 원래 좌석들을 다시 화면에 되살려서,
   *   5) 결국 새로 만든 좌석 + 되살아난 옛 좌석이 뒤섞여 번호(라벨)가
   *      겹치는 좌석들(예: "1"이 여러 개)이 함께 보이는 사고로 이어졌어요.
   *
   * 지금은 모든 삭제 요청을 먼저 다 보내고 "결과가 전부 돌아올 때까지"
   * 기다린 다음, 실제로 서버에서 지워진 좌석만 화면에서도 지워요. 하나라도
   * 실패하면 그 좌석은 화면에도 그대로 남겨서 "총 좌석 수"가 실제와 다르게
   * (섣불리 0으로) 보이지 않게 하고, 그래서 "좌석 만들기" 화면도 뜨지 않아
   * 위 3)번 같은 중복 생성 자체가 아예 불가능해요. 진행 중엔 seatsResetting을
   * true로 둬서 화면(초기화 버튼 등)이 중복 클릭을 막을 수 있게 해요. */
  const resetAllSeats = () => {
    if (seatsResetting || seats.length === 0) return;
    const targets = seats;
    setSeatsResetting(true);
    setSeatSyncError(null);

    Promise.all(
      targets.map(async (seat) => {
        // 임시 id(서버 응답을 기다리는 중 생성된 좌석)는 서버에 아직 없으니
        // API 호출 없이 그냥 화면에서 지워도 안전해요.
        if (isTempSeatId(seat.id) || !isOwnerLoggedIn || !isApiConfigured()) {
          return { seat, ok: true };
        }
        const ok = await apiOwnerDeleteSeat(seat.id);
        return { seat, ok };
      }),
    ).then((outcomes) => {
      const failedIds = new Set(
        outcomes.filter((o) => !o.ok).map((o) => o.seat.id),
      );
      setSeats((prev) => prev.filter((s) => failedIds.has(s.id)));
      setSeatsResetting(false);
      if (failedIds.size > 0) {
        setSeatSyncError(
          `좌석 ${failedIds.size}개는 삭제하지 못했어요. 백엔드 서버 주소(192.168.x.x)에 지금 이 기기에서 접속할 수 있는지 확인한 뒤 다시 시도해주세요.`,
        );
      } else {
        setSeatSyncError(null);
      }
    });
  };

  // ⚠️ 예전엔 서버 응답 성공 여부를 확인하지 않고(fire-and-forget) 화면만 먼저
  // 바꿔버려서, PATCH가 실제로는 422 등으로 실패해도 사장님 눈에는 "접수완료"로
  // 보였어요. 그 상태로 로그아웃했다가 다시 들어오면 서버엔 원래 상태(주문접수)가
  // 그대로 남아있어서 "분명 접수했는데 다시 접수 대기로 뜬다"는 문제가 생겼어요.
  // 이제 서버 응답을 기다렸다가, 실패하면 화면도 원래 상태로 되돌리고 콘솔에
  // 이유를 남겨서 "화면과 서버가 서로 다른 상태"가 되지 않게 해요.
  const updateOrderStatus = async (
    id: string,
    nextStatus: OrderState,
    apiStatus: "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "REJECTED" | "CANCELLED",
  ) => {
    let prevStatus: OrderState | undefined;
    // 지금 이 순간 이전에 이미 나가 있던 폴링 응답은(도착이 늦어도) 더 이상
    // 반영되지 않도록 번호를 올려요 — 그래야 그 응답이 이 낙관적 업데이트를
    // 덮어쓰지 않아요.
    ordersRequestIdRef.current++;
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        prevStatus = o.status;
        return { ...o, status: nextStatus };
      }),
    );
    if (!isOwnerLoggedIn) return;
    const ok = await apiOwnerUpdateOrderStatus(id, apiStatus);
    // 서버 응답을 기다리는 동안 이미 새로운 폴링/다른 상태변경이 시작됐을 수
    // 있으니, 다시 한번 번호를 올려서 이 요청보다 먼저 나간 응답이 뒤늦게
    // 와도 무시되게 해요.
    ordersRequestIdRef.current++;
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(
        `[updateOrderStatus] 주문 #${id} 상태를 ${apiStatus}(으)로 저장하지 못했어요. 화면을 원래 상태로 되돌려요.`,
      );
      if (prevStatus) {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: prevStatus! } : o)));
      }
      return;
    }
    // ⚠️ 주문을 "완료"로 바꾸면 그게 곧 실제 매출이 발생한 시점인데, 홈 화면의
    // "오늘 매출" 카드는 8초 폴링이나 페이지 재방문 전까지는 갱신되지 않았어요.
    // 그래서 방금 완료 처리한 주문 금액이 매출에 안 잡힌 것처럼 보였어요.
    // 완료 처리가 서버에 성공하자마자 매출을 바로 다시 불러와요.
    if (nextStatus === "완료") refetchSales();
  };

  const acceptOrder = (id: string) => void updateOrderStatus(id, "준비중", "CONFIRMED");
  const rejectOrder = (id: string) => void updateOrderStatus(id, "취소됨", "REJECTED");
  const markOrderReady = (id: string) => void updateOrderStatus(id, "준비완료", "READY");
  const completeOrder = (id: string) => void updateOrderStatus(id, "완료", "COMPLETED");
  const cancelOrder = (id: string) => void updateOrderStatus(id, "취소됨", "CANCELLED");

  const addMenuItem = async (
    item: Omit<OwnerMenuItem, "id">
  ): Promise<{ ok: boolean; error?: string }> => {
    const tempId = `menu-${Date.now()}`;
    setMenu((prev) => [...prev, { ...item, id: tempId }]);

    // ⚠️ storeId 없이도(로그인만 돼 있으면) 호출 가능한 경로예요 — 이전에는
    // ownerStoreId가 없으면 여기서 그냥 return 해버려서 서버 저장 자체를
    // 건너뛰었어요(=화면엔 보이지만 실제로는 저장 안 된 상태). isApiConfigured
    // 체크는 apiOwnerCreateMenu 내부에서 이미 하기 때문에 여기선 바로 호출해요.
    const payload = {
      name: item.name,
      price: item.price,
      category: item.category,
      image_url: item.imageUrl,
      is_available: true,
    };

    let created = await apiOwnerCreateMenu(payload);

    // ⚠️ 첫 시도가 실패하면(가장 흔한 원인: 이 매장에 해당 카테고리가 아직
    // 하나도 없어서 서버가 "카테고리를 못 찾음") 카테고리를 먼저 만들고 한 번
    // 더 시도해요. 카테고리가 이미 있어서 생성 자체가 실패해도 상관없어요 —
    // 그 경우엔 어차피 카테고리가 존재한다는 뜻이라 재시도가 성공해요.
    if (!created) {
      await apiOwnerCreateMenuCategory(item.category);
      created = await apiOwnerCreateMenu(payload);
    }

    if (!created) {
      // 서버에 실제로 저장되지 않았으니 화면에 붙였던 낙관적 항목도 지워서,
      // "저장된 것처럼 보이다가 재로그인하면 사라지는" 문제가 재발하지 않게 해요.
      setMenu((prev) => prev.filter((m) => m.id !== tempId));
      return {
        ok: false,
        error: "메뉴를 서버에 저장하지 못했어요. 잠시 후 다시 시도해주세요.",
      };
    }

    // 서버가 발급한 진짜 id로 교체해요. (이후 수정/삭제가 서버에도 반영되도록)
    setMenu((prev) =>
      prev.map((m) => (m.id === tempId ? { ...m, id: String(created!.id) } : m))
    );
    return { ok: true };
  };

  const updateMenuItem = (id: string, patch: Partial<OwnerMenuItem>) => {
    setMenu((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m))
    );
    void apiOwnerUpdateMenu(id, {
      name: patch.name,
      price: patch.price,
      category: patch.category,
      image_url: patch.imageUrl,
    });
  };

  const removeMenuItem = (id: string) => {
    setMenu((prev) => prev.filter((m) => m.id !== id));
    void apiOwnerDeleteMenu(id);
  };

  const replyToReview = (id: string, reply: string) => {
    const trimmed = reply.trim();
    const target = reviews.find((r) => r.id === id);
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, reply: trimmed } : r)));
    if (!ownerStoreId) return;
    if (target?.replyId) {
      // 이미 서버에 답글이 있으면(=replyId를 알고 있으면) 새로 만들지 않고
      // 그 답글을 수정해요. 안 그러면 POST가 "이미 답글이 있다"고 422를
      // 돌려주거나, 리뷰당 답글이 여러 개 쌓일 수 있어요.
      void apiOwnerUpdateReviewReply(target.replyId, trimmed);
    } else {
      void apiOwnerReplyToReview(id, trimmed).then((res) => {
        if (res.ok && res.replyId) {
          setReviews((prev) =>
            prev.map((r) => (r.id === id ? { ...r, replyId: res.replyId } : r))
          );
        }
      });
    }
  };

  const deleteReviewReply = (id: string) => {
    const target = reviews.find((r) => r.id === id);
    setReviews((prev) =>
      prev.map((r) => (r.id === id ? { ...r, reply: null, replyId: null } : r))
    );
    if (ownerStoreId && target?.replyId) {
      void apiOwnerDeleteReviewReply(target.replyId);
    }
  };

  const setSettings = (patch: Partial<SettingsState>) =>
    setSettingsState((prev) => ({ ...prev, ...patch }));

  const addInquiry = (content: string) =>
    setInquiries((prev) => [
      {
        id: `inq-${Date.now()}`,
        content,
        createdAt: new Date().toLocaleDateString("ko-KR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }),
        status: "접수됨",
      },
      ...prev,
    ]);

  const addSalesPoint = (point: SalesPoint) =>
    setTodaySalesByHour((prev) => [...prev, point]);

  // todaySalesByHour는 "그 시간대까지의 누적 매출"이라서(api.ts에서 시간
  // 순서로 정렬해 내려줘요), 가장 늦은 시간대(=배열 마지막 값)가 곧 오늘
  // 지금까지의 총 매출이에요.
  const todaySales =
    todaySalesByHour.length > 0
      ? todaySalesByHour[todaySalesByHour.length - 1].amount
      : 0;
  const salesChangePct =
    yesterdayTotalSales > 0
      ? Math.round(((todaySales - yesterdayTotalSales) / yesterdayTotalSales) * 100)
      : 0;

  const value = useMemo<OwnerContextValue>(
    () => ({
      store,
      setStore,
      toggleStoreTag,
      seats,
      setSeatStatus,
      addSeat,
      removeSeat,
      resetAllSeats,
      seatsLoading,
      seatsLoadFailed,
      seatsResetting,
      retrySeatsLoad,
      seatSyncError,
      congestion,
      orders,
      acceptOrder,
      rejectOrder,
      markOrderReady,
      completeOrder,
      cancelOrder,
      menu,
      addMenuItem,
      updateMenuItem,
      removeMenuItem,
      reviews,
      replyToReview,
      deleteReviewReply,
      settings,
      setSettings,
      inquiries,
      addInquiry,
      todaySalesByHour,
      addSalesPoint,
      todaySales,
      salesChangePct,
      salesLoading,
      salesError,
      refetchSales,
    }),
    [
      store,
      seats,
      seatSyncError,
      seatsLoading,
      seatsLoadFailed,
      seatsResetting,
      serverCongestion,
      orders,
      menu,
      reviews,
      settings,
      inquiries,
      todaySalesByHour,
      yesterdayTotalSales,
      salesLoading,
      salesError,
      ownerStoreId,
    ]
  );

  return (
    <OwnerContext.Provider value={value}>{children}</OwnerContext.Provider>
  );
}

export function useOwner() {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used within OwnerProvider");
  return ctx;
}
