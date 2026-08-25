import type { SalesPoint } from "@/lib/owner-store";

/**
 * 백엔드 API 연동 설정 (CafeOn Backend API v2.0.0, Laravel + Sanctum)
 * ------------------------------------------------------------------
 * .env.local 에 NEXT_PUBLIC_API_BASE_URL 을 넣으면 실제 서버로 요청을 보내요.
 *   예) NEXT_PUBLIC_API_BASE_URL=https://api.cafeon.app
 *
 * 아직 이 값이 없으면(백엔드 URL을 못 받은 상태) 네트워크 요청 자체를
 * 시도하지 않고 프론트가 갖고 있는 임시(mock) 데이터를 그대로 보여줘요.
 * 그래서 URL만 채워 넣으면 별도 코드 수정 없이 바로 연동돼요.
 *
 * 인증: Laravel Sanctum Bearer Token.
 * - 손님 토큰과 사장님 토큰은 별개로 보관해요(한 브라우저에서 손님/사장님 화면을
 *   각각 "로그인 상태"로 유지하는 이 앱의 화면 구조에 맞춘 설계예요).
 * - 이 파일의 모든 함수는 실패해도 절대 예외를 던지지 않고(내부에서 잡아서)
 *   null / 기본값을 돌려줘요. 그래야 호출하는 쪽 store들이 항상 기존 화면을
 *   유지한 채로 동작할 수 있어요 (백엔드 미기동·네트워크 오류에도 화면이 안 깨짐).
 *
 * ⚠️ 운영 배포 안내 문서(CafeON_프론트엔드_운영_배포_안내.docx)에 "핵심 원칙:
 * API 기본 주소에 /api가 이미 포함되어 있으므로 개별 요청 경로에는 /api를
 * 다시 붙이지 않는다"고 돼 있어요. 그런데 이 프로젝트의 모든 요청 함수는
 * apiFetch("/api/...")처럼 각 경로 앞에 이미 /api를 붙이고 있어요(파일 전체에
 * 일관되게 이렇게 돼 있어서, 요청 경로 쪽을 바꾸는 대신 base URL 쪽을 맞춰요).
 * 그 문서대로 NEXT_PUBLIC_API_BASE_URL에 https://wa26b01.yjjob.kr/api 처럼
 * /api까지 포함해서 넣으면, 실제 요청 주소가 …/api/api/users/me 처럼 겹쳐서
 * 전부 404가 나요 — 로그인 여부 확인, 매장/메뉴 조회 등 백엔드를 부르는 모든
 * 기능이 조용히 실패해요(이 파일의 함수들은 실패를 삼키고 null을 돌려주도록
 * 설계돼 있어서 화면이 깨지는 대신 "안 되는 상태"로 조용히 남아요 — 로그아웃
 * 후에도 사장님 로그인 버튼이 안 보이거나 새로고침 후 사라지는 것도 이렇게
 * 배경 요청이 계속 실패하면서 상태 판단이 꼬여 생길 수 있는 증상 중 하나예요).
 * 아래에서 실수로 붙어 들어온 뒤쪽 /api를 한 번 더 방어적으로 제거해서, 문서의
 * 값을 그대로 넣어도(예: https://wa26b01.yjjob.kr/api) 이중 /api가 되지
 * 않게 해요.
 *
 * ⚠️ 또 하나 중요: 이 프로젝트는 Next.js라서 환경변수 이름이 NEXT_PUBLIC_로
 * 시작해야 브라우저 코드에 포함돼요. 운영 배포 안내 문서는 VITE_API_BASE_URL을
 * 쓰라고 안내하는데, 그건 Vite 프로젝트용 접두어라 Next.js에서는 아예 읽히지
 * 않아요(값이 없는 것과 같아서 isApiConfigured()가 false가 되고, 로그인·매장
 * 조회 등 모든 API 연동이 꺼진 채로 배포돼요). 운영 배포 시에는 반드시
 * NEXT_PUBLIC_API_BASE_URL 이름으로 값을 넣고, **빌드 전에** 설정한 뒤
 * npm run build를 실행해야 해요(Next.js는 NEXT_PUBLIC_ 값을 빌드 시점에
 * 결과물 안에 그대로 굳혀 넣기 때문에, 빌드가 끝난 뒤 서버에서 환경변수만
 * 바꿔치기해서는 반영되지 않아요).
 */
const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "").replace(/\/api$/i, "");

export function isApiConfigured() {
  return API_BASE_URL.length > 0;
}

/**
 * 서버가 돌려주는 이미지 경로를 화면에서 실제로 열 수 있는 절대 URL로 바꿔줘요.
 * ------------------------------------------------------------------
 * 백엔드(Laravel)는 업로드 응답이나 프로필/매장/메뉴 이미지 필드에
 * "/storage/xxx.jpg" 같은 "상대 경로"를 돌려줘요. 이 문자열을 <img src>에
 * 그대로 넣으면 브라우저는 이걸 프론트 앱 자신의 주소(예: http://localhost:3000/storage/xxx.jpg)
 * 기준으로 풀어버려서 이미지가 깨져요(요청한 서버에는 그 경로가 없으니까요).
 * 그래서 "/"로 시작하는 상대 경로는 API_BASE_URL을 붙여 절대 주소로 만들어줘요.
 * data:(로컬 미리보기)나 http(s):(이미 절대 주소)로 시작하면 그대로 둬요.
 */
export function resolveImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(data:|blob:)/i.test(url)) return url;
  if (!API_BASE_URL) return url;
  const base = API_BASE_URL.replace(/\/$/, "");

  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      const baseParsed = new URL(base);
      if (parsed.origin !== baseParsed.origin) {
        return `${base}${parsed.pathname}${parsed.search}`;
      }
      return url;
    } catch {
      return url;
    }
  }

  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

/* ------------------------------ 토큰 저장소 ------------------------------ */

const CUSTOMER_TOKEN_KEY = "cafeon_token";
const OWNER_TOKEN_KEY = "cafeon_owner_token";
const OWNER_STORE_ID_KEY = "cafeon_owner_store_id";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // 시크릿 모드 등 localStorage를 못 쓰는 환경이면 조용히 무시해요.
  }
}

export function getCustomerToken() {
  return readStorage(CUSTOMER_TOKEN_KEY);
}
export function setCustomerToken(token: string | null) {
  writeStorage(CUSTOMER_TOKEN_KEY, token);
}

export function getOwnerToken() {
  return readStorage(OWNER_TOKEN_KEY);
}
export function setOwnerToken(token: string | null) {
  writeStorage(OWNER_TOKEN_KEY, token);
}

/** 사장님 계정에 연결된 매장 ID. owner/signup 응답에만 store가 포함돼 있어서
 * 최초 가입 시 저장해두고, 이후 로그인 때도 재사용해요. */
export function getOwnerStoreId(): number | null {
  const raw = readStorage(OWNER_STORE_ID_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
export function setOwnerStoreId(storeId: number | null) {
  writeStorage(OWNER_STORE_ID_KEY, storeId === null ? null : String(storeId));
}

/* -------------------------------- 공통 fetch -------------------------------- */

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;
  constructor(
    message: string,
    status: number,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type AuthAs = "customer" | "owner" | "none";

/**
 * ⚠️ 이전엔 fetch()에 타임아웃이 전혀 없어서, 서버가 응답을 안 주거나(개발용
 * `php artisan serve`는 요청을 한 번에 하나씩만 처리하는 단일 스레드라, 화면에
 * 떠 있는 8~15초 폴링들이 겹치면 뒤에 보낸 요청이 한참 대기할 수 있어요)
 * 네트워크가 중간에 끊기면 화면이 "주문을 생성하는 중이에요…"처럼 영원히
 * 멈춰 보였어요(스피너만 돌고 성공도 실패도 안 뜸). 일정 시간 안에 응답이 없으면
 * 스스로 요청을 취소하고 명확한 에러로 실패 처리해서, 호출한 쪽 화면이 항상
 * "성공" 아니면 "실패(재시도 가능)" 둘 중 하나로 끝나게 해요.
 */
const DEFAULT_TIMEOUT_MS = 15000;

/** 그냥 잠깐 기다렸다가 요청 함수를 다시 부르는 헬퍼. */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function apiFetch<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
    query?: Record<string, string | number | boolean | undefined>;
    authAs?: AuthAs;
    timeoutMs?: number;
    /** 내부 재시도 호출에서만 써요 — 바깥에서 넘기지 마세요. */
    _retryCount?: number;
  } = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    query,
    authAs = "none",
    timeoutMs = DEFAULT_TIMEOUT_MS,
    _retryCount = 0,
  } = options;

  let url = `${API_BASE_URL}${path}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
      )
      .join("&");
    if (qs) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const token =
    authAs === "customer"
      ? getCustomerToken()
      : authAs === "owner"
        ? getOwnerToken()
        : null;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(
        `서버 응답이 ${Math.round(timeoutMs / 1000)}초 안에 오지 않았어요. 네트워크나 서버 상태를 확인해주세요.`,
        0,
      );
    }
    throw new ApiError("서버에 연결할 수 없어요. 네트워크 상태를 확인해주세요.", 0);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    // ⚠️ "초기화 후 좌석을 눌러도 오류가 난다"는 문제의 실제 원인 중 하나:
    // 초기화(좌석 여러 개 DELETE) → 좌석 만들기(좌석 여러 개 POST)를 짧은
    // 시간 안에 연달아 보내면, 개발용 백엔드(`php artisan serve`는 요청을
    // 한 번에 하나씩만 처리하는 단일 스레드예요)나 Laravel의 기본 요청 제한
    // (throttle) 미들웨어에 걸려 그 사이에 낀 요청 하나가 429(너무 많은 요청)나
    // 502/503/504(그 순간 서버가 응답을 못 만들어 냄)로 실패할 수 있어요.
    // 이런 상태는 "고장"이 아니라 "일시적으로 바쁨"이라서, 몇백 ms만 있다가
    // 다시 보내면 대부분 성공해요(로그아웃 후 재시도하면 된다던 것도 사실
    // 그 사이에 시간이 지나 서버가 밀린 요청을 다 처리했기 때문일 뿐이에요).
    // GET처럼 여러 번 반복해도 안전한 요청은 물론, PATCH/DELETE/POST도 이런
    // "요청 자체가 서버에 도달하지 못하고 거절된" 상황에서는 다시 보내도
    // 안전해서(서버가 실제로 처리를 시작한 뒤 응답만 못 준 경우와는 달라요),
    // 최대 2번까지 짧게 기다렸다가 자동으로 재시도해요.
    const isTransient = res.status === 429 || (res.status >= 502 && res.status <= 504);
    if (isTransient && _retryCount < 2) {
      await delay(400 * (_retryCount + 1));
      return apiFetch<T>(path, { ...options, _retryCount: _retryCount + 1 });
    }

    const d = (data ?? {}) as {
      message?: string;
      errors?: Record<string, string[]>;
    };
    throw new ApiError(
      d.message ?? `요청에 실패했어요 (${res.status})`,
      res.status,
      d.errors,
    );
  }

  return data as T;
}

/* ---------------------------------- 인증 ---------------------------------- */

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  profile_image_url?: string | null;
  /** 2026-08-19 백엔드 변경사항 문서로 추가됨: 손님 생년월일(YYYY-MM-DD).
   * 저장 후에는 로그인 응답과 GET /api/users/me 양쪽에서 이 필드로 내려와요. */
  birth_date?: string | null;
  role: "CUSTOMER" | "OWNER" | "ADMIN";
};

export type ApiStoreBusinessHour = {
  day_of_week: number;
  opening_time?: string | null;
  closing_time?: string | null;
  is_closed?: boolean;
};

export type ApiStoreTag = {
  id?: number;
  slug?: string | null;
  name?: string | null;
};

/** 2026-08-19 백엔드 변경사항 문서(카카오지도_카페나오기.txt)로 추가됨: 사업자 정보.
 * 공개 매장 API에는 노출되지 않고, 사장님 전용 조회/수정 응답에만 포함돼요. */
export type ApiStoreBusinessInfo = {
  business_registration_number?: string | null;
  representative_name?: string | null;
  company_name?: string | null;
  business_type?: string | null;
  business_item?: string | null;
  business_address?: string | null;
};

export type ApiStore = {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  address?: string | null;
  detail_address?: string | null;
  phone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  thumbnail_url?: string | null;
  reservation_enabled: boolean;
  is_active: boolean;
  /** 2026-08-19 백엔드 변경사항 문서로 추가됨: "현재 영업 중" 여부.
   * is_active(매장 게시·활성 여부)와는 다른 개념이에요 — 매장은 활성 상태(is_active)이면서도
   * 지금은 영업 종료(is_open=false)일 수 있어요. 구버전 응답엔 없을 수 있어서 optional. */
  is_open?: boolean;
  /** 요일별 영업시간. api-docs.json 스웨거에는 상세 스키마가 안 나와있어서
   * 실제 응답을 보고 채워 넣은 타입이에요 — 필드명이 다르면 카페 상세/지도 화면의
   * 영업시간 표시가 "-"로 폴백돼요(에러는 안 나요). */
  business_hours?: ApiStoreBusinessHour[] | null;
  /** 편의시설 등 매장 태그. slug만 사용해요(wifi/outlet/parking/pet). */
  tags?: ApiStoreTag[] | null;
  /** 사업자 정보(사업자등록번호 등). 공개 매장 API에는 노출되지 않아요. */
  business_info?: ApiStoreBusinessInfo | null;
};

/** POST /api/auth/customer/login — 손님 전용 로그인.
 * 백엔드가 CUSTOMER 권한 계정만 통과시켜요(사장님 계정으로 시도하면 403). */
export async function apiCustomerLogin(email: string, password: string) {
  return apiFetch<{ token: string; token_type: string; user: ApiUser }>(
    "/api/auth/customer/login",
    { method: "POST", body: { email, password } },
  );
}

/** POST /api/auth/owner/login — 사장님 전용 로그인.
 * 백엔드가 ADMIN 권한 계정만 통과시켜요(손님 계정으로 시도하면 403). */
export async function apiOwnerLogin(email: string, password: string) {
  return apiFetch<{
    token: string;
    token_type: string;
    user: ApiUser;
    /** 2026-08-19 백엔드 변경사항 문서(사장님 프로필 로그아웃 후 복원)로 추가됨:
     * 로그인한 사장님이 실제 OWNER로 연결된 매장 정보가 로그인 응답에도 함께 와요.
     * store_id 또는 store.id를 ownerStoreId로 저장해서 써요.
     * store는 첫 번째 소유 매장, stores는 소유 매장 전체 목록이에요. */
    store_id?: number;
    store?: ApiStore;
    stores?: ApiStore[];
  }>("/api/auth/owner/login", { method: "POST", body: { email, password } });
}

/** GET /api/owner/store — 로그인한 사장님의 대표 매장을 조회해요.
 * 2026-08-19 백엔드 변경사항 문서(사장님 프로필 로그아웃 후 복원)로 추가됨.
 * 로그인/소셜로그인 응답에 store_id·store가 안 실려 있을 때(구버전 응답 등)나,
 * 새로고침으로 앱을 다시 열었는데 저장해둔 ownerStoreId가 없을 때, 로그인한
 * 계정에 실제 연결된 매장 ID를 서버에서 다시 찾아오는 용도로 써요. 응답 형태가
 * 스웨거에 상세히 안 나와있어서 { store: ApiStore } 형태와 매장 객체를 바로
 * 주는 형태를 모두 시도해요. */
export async function apiOwnerGetMyStore(): Promise<ApiStore | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<Record<string, unknown>>("/api/owner/store", {
      authAs: "owner",
    });
    const store = (res?.["store"] ?? res) as ApiStore | undefined;
    return store && typeof store.id === "number" ? store : null;
  } catch {
    return null;
  }
}

/** POST /api/auth/signup — 손님 회원가입 */
export async function apiSignup(input: {
  name: string;
  email: string;
  password: string;
  terms_accepted: boolean;
}) {
  return apiFetch<{
    message: string;
    token: string;
    token_type: string;
    user: ApiUser;
  }>("/api/auth/signup", { method: "POST", body: input });
}

/** POST /api/auth/owner/signup — 사장님(점주) 회원가입. 응답에 store가 함께 와요. */
export async function apiOwnerSignup(input: {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  phone: string;
  store_name: string;
  store_address?: string;
  store_detail_address?: string;
  store_phone?: string;
  terms_accepted: boolean;
}) {
  return apiFetch<{
    message: string;
    token: string;
    token_type: string;
    user: ApiUser;
    store: ApiStore;
  }>("/api/auth/owner/signup", { method: "POST", body: input });
}

/** 소셜 로그인(카카오/구글/네이버) 시작 URL.
 * 이 URL로 이동(location.href)하면 백엔드가 각 소셜 로그인 페이지로 리다이렉트해요.
 * 로그인이 끝나면 백엔드가 손님은 FRONTEND_SOCIAL_CALLBACK_URL(=/login/callback),
 * 사장님은 /owner/login/callback 으로 ?code=...(또는 실패 시 ?error=...)와 함께
 * 다시 리다이렉트해줘요. */
export type SocialProvider = "kakao" | "google" | "naver";
/** 손님/사장님 중 어떤 계정으로 소셜 로그인을 시작하는지 구분해요. */
export type SocialAuthAs = "customer" | "owner";

/**
 * ⚠️ 백엔드 확인 필요: 로그인이 /api/auth/customer/login, /api/auth/owner/login 으로
 * 분리된 것과 맞춰서 소셜 로그인도 role 파라미터로 구분해서 보내도록 만들어뒀어요.
 * 다만 api-docs.json(스웨거)에는 이 리다이렉트 경로 자체가 명세돼 있지 않아서,
 * 백엔드가 실제로 이 role 파라미터명을 그대로 쓰는지, 아니면 콜백 URL을 아예
 * 다르게 분리하는 방식(FRONTEND_SOCIAL_CALLBACK_URL을 손님/사장님용으로 각각 설정)을
 * 쓰는지는 백엔드 팀에 꼭 확인해주세요.
 *
 * ⚠️ 2026-08-25 "운영 API로 바꾸니 소셜 로그인이 안 돼요" 조사 결과 메모:
 * 이 함수(getSocialLoginUrl)와 API_BASE_URL 계산(파일 상단)은 문제 없어요 —
 * 백엔드가 전달한 "프론트엔드 운영 배포 안내" 문서(6번 표)의 콜백 주소가
 *   https://wa26b01.yjjob.kr/auth/social/{google|kakao|naver}/callback
 * 처럼 "/api" 없이 시작하는 것과 정확히 같은 패턴(/auth/social/{provider}/redirect)
 * 으로 URL을 만들고 있어서, API_BASE_URL만 https://wa26b01.yjjob.kr/api로
 * 바꾸면(파일 상단에서 끝의 "/api"는 자동으로 떼어내요) 이 함수는 그대로
 * 잘 동작해요.
 *
 * 실제 원인은 이 리다이렉트 URL이 아니라, 로그인이 끝난 뒤 "어디로 돌아올지"를
 * 정하는 백엔드 .env의 FRONTEND_SOCIAL_CALLBACK_URL(손님)/사장님용 값이에요.
 * 이 값은 운영 백엔드(wa26b01.yjjob.kr)에는 보통 배포된 운영 프론트 주소로
 * 맞춰져 있어서, 로컬(http://localhost:3000)에서 프론트만 띄워놓고 운영
 * 백엔드로 소셜 로그인을 시도하면 로그인이 끝나도 로컬 화면으론 절대 안
 * 돌아와요(다른 주소로 리다이렉트되니까요) — 이건 프론트 코드로 고칠 수
 * 없고, 백엔드 팀에 "지금 테스트 중인 프론트 주소로 FRONTEND_SOCIAL_CALLBACK_URL이
 * 맞춰져 있는지" 확인을 요청해야 해요. (자세한 설명: src/app/login/callback/page.tsx,
 * src/app/owner/login/callback/page.tsx 상단 주석 참고)
 */
export function getSocialLoginUrl(provider: SocialProvider, as: SocialAuthAs) {
  return `${API_BASE_URL}/auth/social/${provider}/redirect?role=${as}`;
}

/** POST /api/auth/social/exchange — 소셜 로그인 콜백에서 받은 1회용 code를
 * 실제 Sanctum 토큰으로 교환해요. role은 위 getSocialLoginUrl과 같은 이유로 함께
 * 보내요(백엔드가 이 필드를 쓰는지는 확인 필요, 안 쓰더라도 무시되므로 안전해요). */
export async function apiSocialExchange(code: string, as: SocialAuthAs) {
  return apiFetch<{
    token: string;
    token_type: string;
    user: ApiUser;
    /** 2026-08-19 백엔드 변경사항 문서로 추가됨: 사장님 계정 소셜 로그인 시
     * 일반 로그인과 동일하게 store_id/store가 함께 와요(손님 계정이면 없어요). */
    store_id?: number;
    store?: ApiStore;
    stores?: ApiStore[];
  }>("/api/auth/social/exchange", { method: "POST", body: { code, role: as } });
}

/** POST /api/logout */
export async function apiLogout(authAs: AuthAs) {
  try {
    await apiFetch<void>("/api/logout", { method: "POST", authAs });
  } catch {
    // 서버 로그아웃이 실패해도 클라이언트 쪽 토큰은 어차피 지울 거라 무시해요.
  }
}

/** GET /api/users/me */
export async function apiGetMe(authAs: AuthAs): Promise<ApiUser | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<{ user: ApiUser }>("/api/users/me", { authAs });
    return res.user;
  } catch {
    return null;
  }
}

/** PUT /api/users/me — 손님 프로필 수정(이름/연락처/프로필사진/생년월일 등).
 * 로그인/회원가입과 달리 사용자가 직접 "저장하기"를 눌러서 호출하는 동작이라,
 * 실패 사유(중복된 번호, 미래 날짜의 birth_date는 422 등)를 화면에 보여줄 수 있도록
 * 에러를 삼키지 않고 그대로 던져요.
 * 2026-08-19 백엔드 변경사항 문서로 birth_date(YYYY-MM-DD) 필드가 확정됐어요. */
export async function apiUpdateMe(input: {
  name?: string;
  phone?: string | null;
  profile_image_url?: string | null;
  birth_date?: string | null;
}): Promise<ApiUser> {
  const res = await apiFetch<{ user: ApiUser }>("/api/users/me", {
    method: "PUT",
    body: input,
    authAs: "customer",
  });
  return res.user;
}

/** POST /api/uploads/images — 이미지 업로드(프로필 사진 등 공용 업로드).
 * 2026-08-19 백엔드 변경사항 문서로 응답 형식이 확정됐어요:
 *   { "path": "blog/example.jpg", "url": "http://.../storage/blog/example.jpg" }
 * 프론트에서는 이 url을 그대로 쓰면 돼요(이미 절대 주소라 resolveImageUrl도
 * 그대로 통과시켜요). 혹시 모를 다른 응답 형태에 대비해 image_url/path 및
 * data로 감싼 형태도 순서상 후순위로 계속 지원해요. */
export async function apiUploadImage(
  file: File,
  authAs: AuthAs = "customer",
): Promise<string | null> {
  if (!isApiConfigured()) return null;
  try {
    const form = new FormData();
    form.append("image", file);

    const token =
      authAs === "customer"
        ? getCustomerToken()
        : authAs === "owner"
          ? getOwnerToken()
          : null;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/uploads/images`, {
      method: "POST",
      headers,
      body: form,
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      // eslint-disable-next-line no-console
      console.error(
        `[apiUploadImage] 업로드 실패 (${res.status} ${res.statusText}) authAs=${authAs} token=${token ? "있음" : "없음"}`,
        bodyText,
      );
      return null;
    }

    const data = (await res.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!data) {
      // eslint-disable-next-line no-console
      console.error("[apiUploadImage] 응답 본문을 JSON으로 읽지 못했어요.");
      return null;
    }
    const nested =
      data["data"] && typeof data["data"] === "object"
        ? (data["data"] as Record<string, unknown>)
        : null;
    const url =
      data["url"] ??
      data["image_url"] ??
      data["path"] ??
      nested?.["url"] ??
      nested?.["image_url"];
    if (typeof url !== "string") {
      // eslint-disable-next-line no-console
      console.error(
        "[apiUploadImage] 응답에서 이미지 URL 필드를 못 찾았어요. 실제 응답 형태를 확인해주세요:",
        data,
      );
      return null;
    }
    return url;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[apiUploadImage] 네트워크 오류로 업로드에 실패했어요:", err);
    return null;
  }
}

/* ------------------------------ 카페(매장) 조회 ------------------------------ */

/** GET /api/stores — 지도/검색 화면용 매장 목록 */
export async function apiListStores(params?: {
  keyword?: string;
  reservation_available?: boolean;
  tag?: string;
}): Promise<ApiStore[] | null> {
  if (!isApiConfigured()) return null;
  try {
    return await apiFetch<ApiStore[]>("/api/stores", { query: params });
  } catch {
    return null;
  }
}

export type ApiAvailability = {
  store_id: number;
  total_capacity: number;
  occupied_capacity: number;
  available_capacity: number;
  occupancy_rate: number;
  congestion: "UNAVAILABLE" | "NEAR_FULL" | "BUSY" | "NORMAL" | "RELAXED";
  congestion_label: string;
  reservation_enabled: boolean;
  /** 좌석 현황이 마지막으로 갱신된 시각(ISO). 카페 상세/지도 카드의
   * "n분 전 업데이트" 표시에 써요. */
  availability_updated_at?: string | null;
};

/** GET /api/stores/{store}/congestion — 매장의 실시간 좌석 가용성(혼잡도)만 조회.
 * 지도/검색처럼 여러 매장을 한 번에 불러온 뒤, 매장별 혼잡도를 별도로 채워 넣을 때 써요. */
export async function apiGetStoreCongestion(
  storeId: string | number,
): Promise<ApiAvailability | null> {
  if (!isApiConfigured()) return null;
  try {
    return await apiFetch<ApiAvailability>(
      `/api/stores/${encodeURIComponent(String(storeId))}/congestion`,
    );
  } catch {
    return null;
  }
}

/** GET /api/stores/{store} — 카페 상세 + 실시간 좌석 가용성 */
export async function apiGetStore(
  storeId: string | number,
): Promise<{ store: ApiStore; availability: ApiAvailability } | null> {
  if (!isApiConfigured()) return null;
  try {
    return await apiFetch(`/api/stores/${encodeURIComponent(String(storeId))}`);
  } catch {
    return null;
  }
}

/** GET /api/stores/{store}/menus — 손님용 카페 상세 화면의 "메뉴" 탭에서 사용.
 * 사장님 전용(/api/owner/stores/{store}/menus)과 별개의 공개 엔드포인트예요.
 * 응답 형태가 스웨거에 명세돼 있지 않아서, 흔히 쓰이는 형태들을 순서대로 시도해요. */
export async function apiGetStoreMenus(
  storeId: string | number,
): Promise<ApiMenu[] | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<unknown>(
      `/api/stores/${encodeURIComponent(String(storeId))}/menus`,
    );
    if (Array.isArray(res)) return res as ApiMenu[];
    if (res && typeof res === "object") {
      const obj = res as Record<string, unknown>;
      if (Array.isArray(obj["data"])) return obj["data"] as ApiMenu[];
      const menus = obj["menus"] as Record<string, unknown> | undefined;
      if (menus && Array.isArray(menus["data"]))
        return menus["data"] as ApiMenu[];
    }
    return [];
  } catch {
    return null;
  }
}

/* ---------------------------------- 찜(favorite) ---------------------------------- */

/** POST /api/stores/{store}/favorite */
export async function apiFavoriteStore(
  storeId: string | number,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(
      `/api/stores/${encodeURIComponent(String(storeId))}/favorite`,
      {
        method: "POST",
        authAs: "customer",
      },
    );
    return true;
  } catch {
    return false;
  }
}

/** DELETE /api/stores/{store}/favorite */
export async function apiUnfavoriteStore(
  storeId: string | number,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(
      `/api/stores/${encodeURIComponent(String(storeId))}/favorite`,
      {
        method: "DELETE",
        authAs: "customer",
      },
    );
    return true;
  } catch {
    return false;
  }
}

/** GET /api/users/me/favorites — 찜한 매장 id 목록을 뽑아내요. */
export async function apiGetMyFavoriteStoreIds(): Promise<string[] | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<unknown>("/api/users/me/favorites", {
      authAs: "customer",
    });
    const rows: Array<Record<string, unknown>> = Array.isArray(res)
      ? res
      : res &&
          typeof res === "object" &&
          Array.isArray((res as { data?: unknown }).data)
        ? (res as { data: Array<Record<string, unknown>> }).data
        : [];
    return rows
      .map((r) => r["store_id"] ?? r["id"])
      .filter((v): v is string | number => v !== undefined && v !== null)
      .map((v) => String(v));
  } catch {
    return null;
  }
}

/* ---------------------------------- 리뷰 ---------------------------------- */

export type ApiReviewReply = {
  id: number;
  review_id: number;
  author_id: number;
  content: string;
  created_at: string;
  updated_at?: string;
  author?: { id?: number; name?: string | null } | string | null;
};

export type ApiReviewImage = {
  id: number;
  review_id: number;
  image_url: string;
  alt_text?: string | null;
  sort_order?: number;
};

export type ApiReview = {
  id: number;
  user_id: number;
  store_id: number;
  rating: number;
  content: string;
  created_at: string;
  updated_at?: string;
  /** 리뷰 작성자 표시 이름. 필드명이 문서화돼 있지 않아 응답에 없을 수 있어요. */
  customer_name?: string | null;
  /** 리뷰에 첨부된 사진. ⚠️ 스웨거 확인 결과 문자열 배열이 아니라
   * {id, review_id, image_url, alt_text, sort_order} 객체 배열로 내려와요.
   * 화면에서 실제 사진 URL만 꺼낼 땐 아래 extractReviewImageUrls()를 써요. */
  images?: ApiReviewImage[] | null;
  /** 사장님 답글. ⚠️ 2026-08 백엔드 변경으로 답글이 더 이상 문자열이 아니라
   * {id, review_id, author_id, content, created_at, updated_at, author} 형태의
   * 객체로 내려와요. 이 값을 화면에 그대로 렌더링하면(예: `{review.reply}`)
   * "Objects are not valid as a React child" 런타임 에러가 나요 — 반드시
   * extractReplyContent()로 답글 "본문 문자열"만 꺼내서 써야 해요. 예전
   * 백엔드와의 호환을 위해 문자열로 오는 경우도 함께 허용해요. */
  reply?: ApiReviewReply | string | null;
  /** 답글의 서버 id. 백엔드에 따라 이 필드로 바로 내려주기도 하고(reply_id),
   * reply 객체 안의 id로만 내려주기도 해요 — extractReplyId()가 둘 다 봐요. */
  reply_id?: number | string | null;
};

/** review.reply가 문자열(예전 백엔드)이든 객체(현재 백엔드,
 * {id, review_id, author_id, content, created_at, updated_at, author})든
 * 상관없이 답글 "본문 문자열"만 안전하게 꺼내요. 이 함수를 거치지 않고
 * review.reply를 화면에 직접 렌더링하면 리액트가 "Objects are not valid as
 * a React child" 런타임 에러를 던져요. */
export function extractReplyContent(reply: ApiReview["reply"]): string | null {
  if (!reply) return null;
  if (typeof reply === "string") return reply.length > 0 ? reply : null;
  return reply.content && reply.content.length > 0 ? reply.content : null;
}

/** 답글의 서버 id를 문자열로 꺼내요(PUT/DELETE /api/owner/review-replies/{reply}에
 * 필요해요). reply_id 필드가 있으면 그걸 쓰고, 없으면 reply 객체 안의 id를 써요. */
export function extractReplyId(review: ApiReview): string | null {
  if (review.reply_id !== undefined && review.reply_id !== null) {
    return String(review.reply_id);
  }
  if (review.reply && typeof review.reply === "object") {
    return String(review.reply.id);
  }
  return null;
}

/** review.images(서버 객체 배열: {id, review_id, image_url, alt_text, sort_order})에서
 * 실제 사진 URL 문자열만 sort_order 순서대로 꺼내요. 화면(카페 상세의 리뷰/사진 탭)은
 * 문자열 배열을 기대하므로, 이 함수를 거치지 않고 review.images를 그대로 쓰면 안 돼요. */
export function extractReviewImageUrls(
  images: ApiReview["images"],
): string[] {
  if (!images || images.length === 0) return [];
  return [...images]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((img) => img.image_url)
    .filter((url): url is string => !!url);
}

/** 리뷰 작성자 표시 이름을 최대한 넓게 찾아봐요. 스웨거에 이 응답의 정확한
 * 스키마가 없어서(200만 명시), 실제 필드명이 customer_name이 아닐 수 있어요.
 * 흔히 쓰이는 후보 필드명과, user/author/customer/reviewer처럼 중첩된 객체
 * 안의 이름까지 넓게 시도해서 찾아요. 그래도 못 찾으면 null을 돌려주고,
 * 화면(mapApiReviewToOwnerReview / 카페 상세 리뷰 탭)에서 review.user_id로
 * "손님 #123" 같은 최소 구분 표시로 대체해요("그냥 고객이라고만 나오고 누가
 * 썼는지 구분이 안 된다"는 문제의 대응책이에요). */
function extractReviewerName(raw: Record<string, unknown>): string | null {
  const direct = pick<string>(raw, [
    "customer_name",
    "user_name",
    "reviewer_name",
    "author_name",
    "nickname",
    "display_name",
    "name",
  ]);
  if (direct && String(direct).trim().length > 0) return String(direct);

  for (const key of ["user", "author", "customer", "reviewer"]) {
    const nested = raw[key];
    if (nested && typeof nested === "object") {
      const nestedName = pick<string>(nested as Record<string, unknown>, [
        "name",
        "nickname",
        "display_name",
      ]);
      if (nestedName && String(nestedName).trim().length > 0) return String(nestedName);
    }
  }
  return null;
}

function parseReview(raw: Record<string, unknown>): ApiReview {
  return {
    id: Number(pick(raw, ["id"]) ?? 0),
    user_id: Number(pick(raw, ["user_id", "customer_id"]) ?? 0),
    store_id: Number(pick(raw, ["store_id"]) ?? 0),
    rating: Number(pick(raw, ["rating"]) ?? 0),
    content: String(pick(raw, ["content"]) ?? ""),
    created_at: String(pick(raw, ["created_at"]) ?? ""),
    updated_at: pick<string>(raw, ["updated_at"]),
    customer_name: extractReviewerName(raw),
    images: (pick(raw, ["images"]) as ApiReviewImage[] | undefined) ?? null,
    reply: pick(raw, ["reply"]) as ApiReview["reply"],
    reply_id: pick(raw, ["reply_id"]) as number | string | undefined,
  };
}

/** 리뷰 작성자를 화면에 표시할 최종 문구. 이름을 못 찾았을 때도 "고객"
 * 하나로만 뭉뚱그리지 않고 user_id로 서로 다른 사람인지는 구분되게 해요. */
export function reviewerDisplayName(review: ApiReview): string {
  if (review.customer_name && review.customer_name.trim().length > 0) {
    return review.customer_name;
  }
  if (review.user_id) return `손님 #${review.user_id}`;
  return "고객";
}

/** GET /api/stores/{store}/reviews */
export async function apiGetStoreReviews(
  storeId: string | number,
): Promise<ApiReview[] | null> {
  if (!isApiConfigured()) return null;
  try {
    // ⚠️ 이 엔드포인트도 스웨거에 응답 스키마가 없어서(200만 명시), 배열을
    // {data:[...]}로 감싸서 줄 수도, 그냥 배열 자체를 줄 수도 있어요. 둘 다
    // 처리해서 응답 모양이 예상과 다르다는 이유만으로 리뷰가 안 보이는 일이
    // 없게 해요. 로그인한 손님으로 요청해야만 리뷰를 내려주는 서버일 수도
    // 있어서 authAs도 함께 보내요(비로그인이어도 서버가 무시하면 그만이에요).
    const res = await apiFetch<unknown>(
      `/api/stores/${encodeURIComponent(String(storeId))}/reviews`,
      { authAs: "customer" },
    );
    const rows: unknown[] = Array.isArray(res)
      ? res
      : res && typeof res === "object" && Array.isArray((res as { data?: unknown }).data)
        ? (res as { data: unknown[] }).data
        : [];
    // ⚠️ 작성자 이름 필드명이 문서화돼 있지 않아서(customer_name 하나만 믿고
    // 있었어요) 실제 서버 필드명이 다르면 전부 "고객"으로만 보였어요. 이제
    // parseReview가 여러 후보 필드명을 넓게 시도해서 최대한 실제 이름을
    // 찾아내요.
    return rows.map((r) => parseReview(r as Record<string, unknown>));
  } catch {
    return null;
  }
}

export type StoreRatingSummary = { rating: number; reviewCount: number };

/** 지도/검색/찜 목록 카드에 쓸 평균 별점·리뷰 수를 계산해요.
 * ------------------------------------------------------------------
 * ⚠️ GET /api/stores (매장 목록)는 평균 별점을 내려주지 않아서(카페 상세
 * 화면만 GET /api/stores/{store}/reviews로 직접 계산하고 있었어요), 예전엔
 * 지도 마커·검색 결과·찜 목록 카드가 전부 하드코딩된 0점으로 보였어요.
 * 매장별 평균 별점 전용 API가 따로 없어서, 카페 상세 화면과 똑같이
 * GET /api/stores/{store}/reviews 결과를 이 화면들에서도 직접 계산해요. */
export async function apiGetStoreRating(
  storeId: string | number,
): Promise<StoreRatingSummary> {
  const reviews = await apiGetStoreReviews(storeId);
  if (!reviews || reviews.length === 0) return { rating: 0, reviewCount: 0 };
  const sum = reviews.reduce((acc, r) => acc + (r.rating ?? 0), 0);
  return {
    rating: Math.round((sum / reviews.length) * 10) / 10,
    reviewCount: reviews.length,
  };
}

/** POST /api/stores/{store}/reviews — 등록된 리뷰(서버 id 포함)를 그대로 돌려줘요.
 * 이 id가 있어야 나중에 PUT/DELETE /api/reviews/{review} 로 수정·삭제할 수 있어요. */
export async function apiCreateReview(
  storeId: string | number,
  input: {
    rating: number;
    content: string;
    order_id?: number;
    reservation_id?: number;
    /** 리뷰 작성 화면에서 POST /api/uploads/images로 먼저 업로드해 받은 실제
     * 이미지 URL들. 스웨거 확인 결과 서버는 이 필드를 `image_urls`라는 이름으로
     * 받아요(아래 apiFetch 호출 시 image_urls로 변환해서 보내요). 이전에는
     * 이 URL들이 이 기기의 로컬 저장소에만 남아서, 같은 컴퓨터라도 localhost와
     * IP 주소로 접속하면 서로 다른 저장공간이라 사진이 안 보였어요. 이제
     * 서버에도 실제로 저장돼서 모든 손님·모든 기기에서 리뷰 사진이 보여요. */
    images?: string[];
  },
): Promise<ApiReview | null> {
  if (!isApiConfigured()) return null;
  try {
    const { images, ...rest } = input;
    const body = {
      ...rest,
      ...(images && images.length > 0 ? { image_urls: images } : {}),
    };
    const res = await apiFetch<{ review?: ApiReview } | ApiReview>(
      `/api/stores/${encodeURIComponent(String(storeId))}/reviews`,
      { method: "POST", body, authAs: "customer" },
    );
    if (res && typeof res === "object" && "review" in res && res.review)
      return res.review;
    if (res && typeof res === "object" && "id" in res) return res as ApiReview;
    return null;
  } catch {
    return null;
  }
}

/** PUT /api/reviews/{review} — 내 리뷰·사진 수정 */
export async function apiUpdateReview(
  reviewId: string | number,
  input: { rating: number; content: string; images?: string[] },
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    const { images, ...rest } = input;
    const body = {
      ...rest,
      ...(images && images.length > 0 ? { image_urls: images } : {}),
    };
    await apiFetch(`/api/reviews/${encodeURIComponent(String(reviewId))}`, {
      method: "PUT",
      body,
      authAs: "customer",
    });
    return true;
  } catch {
    return false;
  }
}

/** DELETE /api/reviews/{review} */
export async function apiDeleteReview(
  reviewId: string | number,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(`/api/reviews/${encodeURIComponent(String(reviewId))}`, {
      method: "DELETE",
      authAs: "customer",
    });
    return true;
  } catch {
    return false;
  }
}

export type MyApiReview = ApiReview & {
  /** 이 리뷰가 달린 매장 이름. ApiReview 자체엔 매장 이름이 없어서, 아래
   * apiGetMyReviews()가 주문 내역(GET /api/users/me/orders)에서 매장 이름을
   * 함께 가져와 붙여줘요. */
  store_name: string | null;
};

/** "내가 쓴 리뷰 전체 목록"을 서버 기준으로 계산해요.
 * ------------------------------------------------------------------
 * ⚠️ api-docs.json 스웨거에는 "내 리뷰 목록 전체 조회" 전용 API가 없어요
 * (GET /api/stores/{store}/reviews처럼 매장 단위 조회만 있어요). 그래서
 * /my/reviews 화면이 지금까지 이 기기의 localStorage만 보고 있었는데, 이게
 * localhost와 IP 주소(예: 192.168.0.70)를 서로 다른 저장공간으로 취급하는
 * 브라우저 특성 때문에 "같은 계정인데 접속 주소에 따라 리뷰가 보였다 안 보였다"
 * 하는 버그의 원인이었어요(같은 계정과 실제로 연결이 안 된 게 아니라, 애초에
 * 서버에서 안 불러오고 있었던 거예요).
 *
 * 여기서는 내가 주문한 매장 목록(GET /api/users/me/orders)을 먼저 가져온 뒤,
 * 그 매장들의 리뷰(GET /api/stores/{store}/reviews)를 각각 조회해서 내
 * user_id로 걸러 모아요. 이러면 어느 기기·어느 주소로 접속해도 같은 계정이면
 * 항상 같은 리뷰 목록이 보여요. 백엔드에 전용 "내 리뷰 목록" API가 추가되면
 * 이 함수 내부만 그 API 호출로 바꾸면 돼요.
 */
export async function apiGetMyReviews(): Promise<MyApiReview[] | null> {
  if (!isApiConfigured()) return null;
  try {
    const me = await apiGetMe("customer");
    if (!me) return null;

    const orders = await apiGetMyOrders();
    if (!orders) return null;

    const storeNameById = new Map<number, string | null>();
    for (const order of orders) {
      if (order.storeId != null && !storeNameById.has(order.storeId)) {
        storeNameById.set(order.storeId, order.storeName);
      }
    }
    const storeIds = Array.from(storeNameById.keys());

    const perStore = await Promise.all(
      storeIds.map((storeId) => apiGetStoreReviews(storeId))
    );

    const seen = new Set<number>();
    const mine: MyApiReview[] = [];
    perStore.forEach((reviews, idx) => {
      if (!reviews) return;
      const storeId = storeIds[idx];
      for (const review of reviews) {
        // ⚠️ "리뷰가 분명 있는데 /my/reviews엔 하나도 안 보인다"는 문제의
        // 실제 원인: review.user_id/me.id를 TS 타입으로는 둘 다 number라고
        // 선언했지만, 실제 서버 응답은 검증되지 않은 raw JSON이라 한쪽이
        // 문자열("5")로 오면 숫자(5)와 `!==` 비교에서 항상 다르다고 판정돼
        // 리뷰가 전부 걸러졌어요. 문자열로 바꿔서 비교해 이 타입 불일치를
        // 흡수해요.
        if (String(review.user_id) !== String(me.id)) continue;
        if (seen.has(review.id)) continue;
        seen.add(review.id);
        mine.push({ ...review, store_name: storeNameById.get(storeId) ?? null });
      }
    });

    mine.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    return mine;
  } catch {
    return null;
  }
}

/* --------------------------------- 혜택(포인트/쿠폰) --------------------------------- */

/** GET /api/users/me/coupons */
export async function apiGetMyCoupons(): Promise<Array<
  Record<string, unknown>
> | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<unknown>("/api/users/me/coupons", {
      authAs: "customer",
    });
    if (Array.isArray(res)) return res;
    if (
      res &&
      typeof res === "object" &&
      Array.isArray((res as { data?: unknown }).data)
    ) {
      return (res as { data: Array<Record<string, unknown>> }).data;
    }
    return [];
  } catch {
    return null;
  }
}

/** GET /api/users/me/membership — 포인트 등 멤버십 정보 */
export async function apiGetMyMembership(): Promise<Record<
  string,
  unknown
> | null> {
  if (!isApiConfigured()) return null;
  try {
    return await apiFetch<Record<string, unknown>>("/api/users/me/membership", {
      authAs: "customer",
    });
  } catch {
    return null;
  }
}

/* ------------------------------ 주문 힌트 캐시 ------------------------------ */
/**
 * 주문 목록/상세 응답에 결제 금액(total_amount)이나 손님 프로필 사진이 비어서
 * 오는 문제(스웨거에 응답 스키마가 없어서 서버가 실제로 어떤 필드를 채워
 * 주는지 확정할 수 없어요)를 보완하기 위한 "같은 브라우저 안에서만 쓰는" 보정
 * 캐시예요. 주문을 만든 바로 그 화면(결제 화면)은 장바구니에 담긴 메뉴
 * 이름/가격/수량과 최종 결제 금액을 이미 정확히 알고 있으니, 주문 생성 직후
 * 그 값을 orderId 기준으로 저장해두고, 이후 그 주문을 다시 조회할 때 서버
 * 응답에 값이 없으면(0원 등) 이 캐시로 채워요.
 * ⚠️ 사장님 화면은 손님과 다른 브라우저/기기라서 이 캐시를 공유하지 못해요.
 * 그래서 손님 프로필 사진처럼 "사장님 화면에서만 보이면 되는" 값은 이 캐시로
 * 완전히 해결되지 않고, 서버 응답 자체에 해당 필드가 내려와야만 보여요
 * (parseOrder의 넓은 후보 필드명 탐색이 그 역할이에요).
 */
export type OrderHint = {
  amount: number;
  items: { name: string; quantity: number; price: number }[];
};

function orderHintKey(orderId: string | number) {
  return `cafeon_order_hint_${orderId}`;
}

export function setOrderHint(orderId: string | number, hint: OrderHint) {
  writeStorage(orderHintKey(orderId), JSON.stringify(hint));
}

function getOrderHint(orderId: string | number): OrderHint | null {
  const raw = readStorage(orderHintKey(orderId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OrderHint;
    if (typeof parsed?.amount === "number" && Array.isArray(parsed.items)) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** 토스 결제창으로 넘어가는 동안(성공/실패 페이지로 브라우저가 완전히
 * 새로고침돼요) 손님/장바구니 React 상태가 전부 초기화되니, 결제창을 열기
 * 직전에 "이 결제가 어떤 주문/금액/매장이었는지"를 로컬에 잠깐 저장해두고,
 * 결제 성공 페이지가 돌아와서 이 값을 읽어 결제 승인 + 완료 화면 표시에 써요. */
const PENDING_TOSS_PAYMENT_KEY = "cafeon_pending_toss_payment";

export type PendingTossPayment = {
  tossOrderId: string;
  orderId: string;
  amount: number;
  cafeName: string;
  items: { name: string; quantity: number; price: number }[];
};

export function setPendingTossPayment(payment: PendingTossPayment) {
  writeStorage(PENDING_TOSS_PAYMENT_KEY, JSON.stringify(payment));
}

export function getPendingTossPayment(): PendingTossPayment | null {
  const raw = readStorage(PENDING_TOSS_PAYMENT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingTossPayment;
  } catch {
    return null;
  }
}

export function clearPendingTossPayment() {
  writeStorage(PENDING_TOSS_PAYMENT_KEY, null);
}

/* -------------------------------- 주문 · 결제(테스트) -------------------------------- */
/**
 * ⚠️ 지금 단계는 "결제가 실제로 되는지"가 아니라 "주문 → 결제창 → 완료" 흐름이
 * 화면과 API에 자연스럽게 이어지는지가 목적이라, 결제 승인은 진짜 카드 결제창
 * (토스 SDK)을 띄우지 않고 앱 안에서 결제창처럼 보이는 화면으로 대신해요.
 * 대신 아래 세 함수는 실제 백엔드 엔드포인트(POST /api/orders,
 * GET /api/payments/orders/{order}/checkout, POST /api/payments/confirm)를
 * 그대로 호출해서, 나중에 진짜 토스 결제위젯으로 바꿔도 이 함수들의 시그니처는
 * 그대로 재사용할 수 있게 해뒀어요.
 * 요청/응답 스키마가 스웨거에 상세히 없어서(응답 200만 명시) 흔히 쓰는 필드명으로
 * 보내고, 응답에서도 여러 후보 필드명을 순서대로 시도해요.
 */

export type ApiOrderItemInput = {
  menu_id: number;
  quantity: number;
};

export type ApiOrder = {
  id: number;
  store_id: number;
  status?: string;
  total_amount?: number;
  point_used?: number;
};

/** POST /api/orders — 장바구니 내용을 주문으로 등록해요.
 * point_used/user_coupon_id는 0819기능수정사항.txt에 나온 대로 별도 API 없이
 * 주문 생성 시 함께 보내요. */
/** apiCreateOrder가 null을 돌려준 "진짜 이유"를 호출부(체크아웃 화면)가 사람이
 * 읽을 수 있는 메시지로 보여줄 수 있게 마지막 실패 사유를 기록해둬요.
 * ⚠️ 이전 코드는 실패하면 원인(401/403/422 등 서버 응답이었는지, 아니면 200은
 * 왔는데 우리가 기대한 필드가 없었는지)을 통째로 삼키고 항상 catch에서 null만
 * 돌려줬어요. 그래서 화면엔 매번 "주문을 생성하지 못했어요. 네트워크나 서버
 * 상태를 확인해주세요"라는 뭉뚱그린 문구만 떴고, 이번처럼 결제 시작 전(주문
 * 생성 단계)부터 막히는 경우엔 원인 파악이 아예 불가능했어요. 이제 실제 실패
 * 사유를 남기고, 서버가 준 응답 원본도 콘솔에 남겨요.
 */
export let lastCreateOrderError: string | null = null;

export async function apiCreateOrder(input: {
  store_id: number;
  items: ApiOrderItemInput[];
  point_used?: number;
  user_coupon_id?: number;
}): Promise<ApiOrder | null> {
  lastCreateOrderError = null;
  if (!isApiConfigured()) {
    lastCreateOrderError = "백엔드 서버 주소(NEXT_PUBLIC_API_BASE_URL)가 설정돼 있지 않아요.";
    return null;
  }
  try {
    const res = await apiFetch<Record<string, unknown>>("/api/orders", {
      method: "POST",
      body: input,
      authAs: "customer",
    });
    // eslint-disable-next-line no-console
    console.debug("[주문 생성] 서버 응답 원본:", res);
    const raw = (res?.["order"] as Record<string, unknown> | undefined) ?? res;
    const id = raw?.["id"];
    if (typeof id !== "number") {
      lastCreateOrderError =
        "주문 생성은 됐지만 응답에서 주문 id를 찾지 못했어요. 브라우저 콘솔의 " +
        "'[주문 생성] 서버 응답 원본'을 확인해서 실제 필드명을 알려주시면 매칭시켜 드릴게요.";
      return null;
    }
    return {
      id,
      store_id: Number(raw["store_id"] ?? input.store_id),
      status: raw["status"] as string | undefined,
      total_amount:
        typeof raw["total_amount"] === "number"
          ? (raw["total_amount"] as number)
          : typeof raw["amount"] === "number"
            ? (raw["amount"] as number)
            : undefined,
      point_used:
        typeof raw["point_used"] === "number"
          ? (raw["point_used"] as number)
          : undefined,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      const fieldMsg = err.fieldErrors
        ? " " +
          Object.entries(err.fieldErrors)
            .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
            .join(" / ")
        : "";
      lastCreateOrderError = `주문 생성 요청이 서버에서 거부됐어요 (${err.status}): ${err.message}${fieldMsg}`;
    } else {
      lastCreateOrderError =
        err instanceof Error ? err.message : "주문 생성 요청 중 알 수 없는 오류가 발생했어요.";
    }
    // eslint-disable-next-line no-console
    console.error("[주문 생성] 실패:", err);
    return null;
  }
}

/** GET /api/payments/orders/{order}/checkout — 결제 준비.
 * ⚠️ 진짜 원인: "결제 주문번호가 일치하지 않습니다"(422) — 프론트가
 * `cafeon${orderId}${timestamp}` 같은 임의의 문자열을 스스로 만들어서 토스
 * 결제창에도 쓰고 승인 요청에도 그대로 보내면, 서버가 이 주문에 대해 이미
 * 발급/기록해둔 토스 주문번호와 다르다며 거부해요. 한 번 이 호출을 아예
 * 빼버린 적이 있었는데(그 시점엔 이 API가 다른 이유로 실패하고 있었고, 그
 * 원인을 못 밝힌 채로 걷어냈어요) — 그랬더니 정확히 이 "주문번호 불일치"
 * 422가 재현됐어요. 즉 이 API는 선택이 아니라 필수예요: 결제창을 열기 전에
 * 반드시 호출해서 서버가 발급한 토스 주문번호를 받아오고, 그 값을 토스
 * 결제창과 이후 승인 요청 양쪽에 그대로 써야 해요.
 * 스웨거에 응답 스키마가 없어서(성공 200만 명시), 흔히 쓰는 후보 필드명들을
 * 순서대로 시도해서 서버가 발급한 토스 주문번호를 뽑아내요. 실패하면(이
 * API 자체가 401/403/404/422/500을 주거나, 200인데 필드를 못 찾으면) 원인을
 * lastPaymentCheckoutError에 남기고 응답 원본을 콘솔에 남겨서, 다음에 실패해도
 * 이유를 바로 알 수 있게 해요. */
export type ApiPaymentCheckout = {
  tossOrderId: string;
  amount: number | null;
  clientKey: string | null;
};

export let lastPaymentCheckoutError: string | null = null;

export async function apiGetPaymentCheckout(
  orderId: string | number,
): Promise<ApiPaymentCheckout | null> {
  lastPaymentCheckoutError = null;
  if (!isApiConfigured()) {
    lastPaymentCheckoutError = "백엔드 서버 주소(NEXT_PUBLIC_API_BASE_URL)가 설정돼 있지 않아요.";
    return null;
  }
  try {
    const raw = await apiFetch<Record<string, unknown>>(
      `/api/payments/orders/${encodeURIComponent(String(orderId))}/checkout`,
      { authAs: "customer" },
    );
    // ⚠️ 응답 스키마가 문서화돼 있지 않아서, 실패하든 성공하든 원본을 그대로
    // 콘솔에 남겨요. 성공했는데 필드를 못 찾는 경우 이 로그로 실제 필드명을
    // 바로 확인할 수 있어요.
    // eslint-disable-next-line no-console
    console.debug("[결제 준비] 서버 응답 원본:", raw);

    const payment =
      (raw?.["payment"] as Record<string, unknown> | undefined) ??
      (raw?.["data"] as Record<string, unknown> | undefined) ??
      (raw?.["checkout"] as Record<string, unknown> | undefined) ??
      raw;
    const tossOrderId = pick<string>(payment, [
      "toss_order_id",
      "tossOrderId",
      "toss_order_no",
      "tossOrderNo",
      "order_id",
      "orderId",
      "order_no",
      "orderNo",
      "merchant_uid",
    ]);
    if (!tossOrderId) {
      lastPaymentCheckoutError =
        "결제 준비 API는 성공(200)했지만 응답에서 토스 주문번호를 찾지 못했어요. 브라우저 " +
        "콘솔에 찍힌 '[결제 준비] 서버 응답 원본'을 확인해서 실제 필드명을 알려주시면 " +
        "매칭시켜 드릴게요.";
      return null;
    }
    const amount = pick<number>(payment, ["amount", "total_amount"]);
    const clientKey = pick<string>(payment, ["client_key", "clientKey"]);
    return {
      tossOrderId: String(tossOrderId),
      amount: typeof amount === "number" ? amount : null,
      clientKey: clientKey ?? null,
    };
  } catch (err) {
    if (err instanceof ApiError) {
      lastPaymentCheckoutError = `결제 준비 요청이 서버에서 거부됐어요 (${err.status}): ${err.message}`;
    } else {
      lastPaymentCheckoutError =
        err instanceof Error ? err.message : "결제 준비 요청 중 알 수 없는 오류가 발생했어요.";
    }
    // eslint-disable-next-line no-console
    console.error("[결제 준비] 실패:", err);
    return null;
  }
}

/** POST /api/payments/confirm — 결제 승인.
 * 토스페이먼츠 결제위젯이 성공 시 돌려주는 paymentKey/orderId/amount 값을
 * 백엔드에 전달해서 최종 승인하는 구조예요.
 * ⚠️ 실제로 호출해서 받은 에러로 필드명을 확정해나간 이력:
 * 1차: "The order id field is required. (and 2 more errors)" — orderId/
 *      paymentKey(카멜케이스)를 서버가 아예 못 읽어서, 이 문서의 다른 모든
 *      엔드포인트처럼 스네이크케이스(order_id/payment_key)로 바꿈.
 * 2차: "The toss order id field is required." (단일 에러) — order_id/amount/
 *      payment_key는 통과했지만, 서버는 우리 내부 DB의 주문 번호(order_id)가
 *      아니라 "토스 결제창에 실제로 넘겼던 그 주문번호"(toss_order_id, 예:
 *      cafeon123abc...)를 별도로 요구했어요. 그동안 그 값을 아예 안 보내고
 *      있었어요. 그래서 toss_order_id 필드를 추가하고, 거기에 checkout
 *      화면이 토스에 넘겼던 문자열(pendingTossPayment.tossOrderId)을 그대로
 *      실어 보내요. order_id(내부 숫자 id)는 계속 함께 보내요 — 이전 호출까지
 *      통과했던 필드라 굳이 뺄 이유가 없어요. */
export async function apiConfirmPayment(input: {
  orderId: string | number;
  tossOrderId: string;
  amount: number;
  paymentKey?: string;
}): Promise<{ ok: boolean; status?: number; message?: string }> {
  if (!isApiConfigured()) return { ok: false };
  try {
    const numericOrderId = Number(input.orderId);
    await apiFetch("/api/payments/confirm", {
      method: "POST",
      body: {
        order_id: Number.isFinite(numericOrderId) ? numericOrderId : input.orderId,
        toss_order_id: input.tossOrderId,
        amount: input.amount,
        payment_key: input.paymentKey ?? `demo_${Date.now()}`,
      },
      authAs: "customer",
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, status: err.status, message: err.message };
    }
    return { ok: false, message: err instanceof Error ? err.message : undefined };
  }
}

/** 주문 1건에 담긴 메뉴 한 줄. 목록/상세 응답 모두 스웨거에 필드 스키마가 없어서
 * (성공 200만 명시) 흔히 쓰는 후보 필드명을 순서대로 시도해서 채워요. */
export type ApiOrderItemDetail = {
  menuId: number | null;
  name: string;
  quantity: number;
  price: number;
};

/** 손님 화면(주문내역)에서 쓰는 주문 1건. status는 서버가 실제로 내려주는 값을
 * 그대로 담아두고(예: PENDING/PREPARING/READY/COMPLETED/CANCELLED 등으로 추정),
 * 화면에서 알려진 값이면 배지 문구로 바꾸고 모르는 값이어도 그 문자열을 그대로
 * 보여줘서 화면이 깨지지 않게 해요. */
export type ApiOrderDetail = {
  id: number;
  storeId: number | null;
  storeName: string | null;
  /** 사장님 화면(주문 목록)에서만 의미 있는 값이에요. 손님 본인 주문 조회
   * 응답에는 보통 없거나 본인 이름이라 화면에서 굳이 안 써요. */
  customerName: string | null;
  /** 주문한 손님이 자기 프로필에 등록한 사진(ApiUser.profile_image_url과 동일한
   * 값). 사장님 화면(최근 주문/주문 목록/상세)에서 회색 아이콘 대신 실제 손님
   * 사진을 보여줄 때 써요. resolveImageUrl로 이미 절대 URL로 변환돼 있어서
   * ImagePlaceholder의 src에 바로 넣으면 돼요(없으면 null → 자동 폴백). */
  customerImageUrl: string | null;
  status: string;
  totalAmount: number;
  pointUsed: number;
  createdAt: string | null;
  items: ApiOrderItemDetail[];
};

/** 여러 후보 필드명 중 처음으로 발견되는 값을 돌려줘요(스웨거에 응답 스키마가
 * 없는 엔드포인트가 많아서 목록/상세 파싱에서 공통으로 재사용해요). */
function pick<T = unknown>(raw: Record<string, unknown>, keys: string[]): T | undefined {
  for (const k of keys) {
    if (raw[k] !== undefined && raw[k] !== null) return raw[k] as T;
  }
  return undefined;
}

function parseOrderItem(raw: Record<string, unknown>): ApiOrderItemDetail {
  const menu = pick<Record<string, unknown>>(raw, ["menu"]);
  const quantity = Number(pick(raw, ["quantity", "qty", "count"]) ?? 1);
  const unitPrice = Number(
    pick(raw, ["price", "unit_price", "menu_price"]) ?? (menu ? pick(menu, ["price"]) : undefined) ?? 0
  );
  return {
    menuId: (() => {
      const id = pick<number>(raw, ["menu_id"]) ?? (menu ? pick<number>(menu, ["id"]) : undefined);
      return typeof id === "number" ? id : null;
    })(),
    name:
      pick<string>(raw, ["menu_name", "name"]) ??
      (menu ? pick<string>(menu, ["name"]) : undefined) ??
      "메뉴",
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    price: Number.isFinite(unitPrice) ? unitPrice : 0,
  };
}

function parseOrder(raw: Record<string, unknown>): ApiOrderDetail {
  const store = pick<Record<string, unknown>>(raw, ["store"]);
  const user = pick<Record<string, unknown>>(raw, ["user", "customer", "buyer", "orderer"]);
  const itemsRaw = pick<unknown[]>(raw, ["items", "order_items", "orderItems"]) ?? [];
  const id = Number(pick(raw, ["id"]) ?? 0);
  const storeId = pick<number>(raw, ["store_id"]) ?? (store ? pick<number>(store, ["id"]) : undefined);

  // ⚠️ "결제 금액이 0원으로 뜬다"는 문제의 진짜 원인(브라우저 콘솔/서버 스웨거로
  // 직접 확인됨): 서버가 각 메뉴 줄의 가격(item.price)은 정확히 채워서 내려주지만
  // (그래서 메뉴별 줄은 "국민커피 × 3 6,300원"처럼 항상 맞게 보였어요), 주문
  // 전체의 total_amount/amount 필드 자체를 계산해서 채워주지 않아요(0 또는
  // 없음) — 이건 프론트가 아니라 서버(주문 생성 시 합계를 저장하지 않음) 쪽
  // 문제라, 백엔드 팀에 "주문 저장 시 total_amount = Σ(메뉴가격×수량) 계산"을
  // 요청해야 근본적으로 고쳐져요. 그때까지는 프론트에서 같은 계산을 대신 해서
  // 화면엔 항상 올바른 결제 금액이 보이게 해요.
  // ⚠️ 예전의 hint(주문 생성 화면이 저장해둔 캐시) 방식은 "내가 우리 앱 결제
  // 화면으로 직접 주문한 경우"에만 동작해요 — 사장님 화면(다른 브라우저/기기)이나
  // 스웨거로 직접 만든 테스트 주문에는 애초에 hint가 없어서 0원이 그대로
  // 보였어요(스크린샷의 사장님 화면·주문내역·서버 응답 모두 0원인 이유). 메뉴
  // 줄 가격은 서버가 항상 정확히 주므로, hint보다 먼저 "메뉴 줄 합계"로
  // 우선 계산하고, 그마저 없을 때만 hint/서버값 순으로 내려가요.
  const hint = id ? getOrderHint(id) : null;
  let totalAmount = Number(pick(raw, ["total_amount", "amount"]) ?? 0);
  let items = Array.isArray(itemsRaw)
    ? itemsRaw.map((it) => parseOrderItem(it as Record<string, unknown>))
    : [];
  if ((items.length === 0 || items.every((it) => !it.price)) && hint?.items?.length) {
    items = hint.items.map((h, idx) => ({
      menuId: items[idx]?.menuId ?? null,
      name: h.name,
      quantity: h.quantity,
      price: h.price,
    }));
  }
  const pointUsed = Number(pick(raw, ["point_used"]) ?? 0);
  if (!totalAmount || Number.isNaN(totalAmount)) {
    const itemsSum = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
    if (itemsSum > 0) {
      totalAmount = Math.max(0, itemsSum - pointUsed);
    } else if (hint) {
      totalAmount = hint.amount;
    }
  }

  return {
    id,
    storeId: typeof storeId === "number" ? storeId : null,
    storeName: pick<string>(raw, ["store_name"]) ?? (store ? pick<string>(store, ["name"]) : undefined) ?? null,
    customerName:
      pick<string>(raw, ["customer_name", "user_name"]) ??
      (user ? pick<string>(user, ["name"]) : undefined) ??
      null,
    // ⚠️ 주문 목록/상세 응답 스키마가 스웨거에 없어서(성공 200만 명시), 손님
    // 프로필(ApiUser)과 같은 후보 필드명들(profile_image_url 우선)을 최대한
    // 넓게 순서대로 시도해요. user/customer 객체 안, 최상위 raw 둘 다 찾아봐요.
    // ⚠️ 그래도 안 뜨면 필드명이 안 맞아서가 아니라, 이 목록 API 응답 자체에
    // 손님 관계(user/customer)가 아예 포함 안 돼 있을 가능성이 커요 — 그땐
    // 실제 응답 JSON을 확인해서 정확한 키로 다시 맞춰야 해요.
    customerImageUrl: resolveImageUrl(
      (user
        ? pick<string>(user, [
            "profile_image_url",
            "profileImageUrl",
            "image_url",
            "imageUrl",
            "avatar_url",
            "avatarUrl",
            "photo_url",
            "photoUrl",
          ])
        : undefined) ??
        pick<string>(raw, [
          "customer_image_url",
          "customerImageUrl",
          "profile_image_url",
          "user_profile_image_url",
        ])
    ),
    status: String(pick(raw, ["status"]) ?? "PENDING"),
    totalAmount,
    pointUsed,
    createdAt: pick<string>(raw, ["created_at"]) ?? null,
    items,
  };
}

/** GET /api/users/me/orders — 손님 본인의 주문 내역 전체 조회. */
export async function apiGetMyOrders(): Promise<ApiOrderDetail[] | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<unknown>("/api/users/me/orders", { authAs: "customer" });
    const rows = Array.isArray(res)
      ? res
      : (res as { data?: unknown[] })?.data ?? [];
    return Array.isArray(rows) ? rows.map((r) => parseOrder(r as Record<string, unknown>)) : [];
  } catch {
    return null;
  }
}

/** GET /api/users/me/orders/{order} — 주문 1건 상세(메뉴 구성 포함) 조회. */
export async function apiGetMyOrderDetail(id: string | number): Promise<ApiOrderDetail | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<Record<string, unknown>>(
      `/api/users/me/orders/${encodeURIComponent(String(id))}`,
      { authAs: "customer" }
    );
    const raw = (res?.["order"] as Record<string, unknown> | undefined) ?? res;
    return parseOrder(raw);
  } catch {
    return null;
  }
}

/** POST /api/users/me/orders/{order}/cancel — 주문 취소(매장이 아직 접수 전일 때만
 * 서버가 허용할 것으로 예상돼요. 서버가 422로 거절하면 false를 돌려줘서, 호출한
 * 쪽에서 "이미 준비 중이라 취소할 수 없어요" 같은 안내를 보여줄 수 있어요). */
export async function apiCancelMyOrder(id: string | number): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(`/api/users/me/orders/${encodeURIComponent(String(id))}/cancel`, {
      method: "POST",
      authAs: "customer",
    });
    return true;
  } catch {
    return false;
  }
}

/* ===================================================================== */
/* 사장님(오너) 전용 API                                                    */
/* ===================================================================== */

export type TodaySalesResponse = {
  /** 오늘 09시부터 현재 시간대까지, 시간대별 "누적" 매출액 */
  hourly: SalesPoint[];
  /** 어제 하루 총 매출액 (전일 대비 증감률 계산용) */
  yesterdayTotal: number;
};

/**
 * 사장님 홈 화면의 "오늘 매출" 카드 + 그래프에 쓰일 데이터를 가져와요.
 *
 * 실제 백엔드에는 "오늘 매출"만 딱 주는 전용 엔드포인트가 없어서, 두 엔드포인트를
 * 조합해서 만들어요:
 *  - GET /api/owner/stores/{store}/dashboard 의 `sales`(시간대별 누적 매출)와
 *    `sales_meta.hours`(각 포인트가 몇 시인지)를 그래프 포인트로 변환해요.
 *    2026-08-19 백엔드 변경사항 문서로 sales_meta가 추가돼서, 더 이상 09시부터
 *    라고 추측하지 않고 실제 hours 배열을 그대로 X축에 써요.
 *  - GET /api/owner/stores/{store}/sales?from=어제&to=어제 의
 *    summary.total_sales 를 전일 총 매출로 사용해요.
 *
 * ⚠️ "결제까지 끝낸 주문이 있는데 매출이 0원으로 뜬다"는 문제의 진짜 원인(서버
 * 응답/스웨거 직접 확인됨): 주문 자체의 total_amount가 서버에 계산·저장되지
 * 않아요(주문 상세의 "결제 금액 0원" 문제와 동일한 원인). dashboard의 sales
 * 배열도 결국 이 total_amount를 합산해서 만드는 값이라, 원인이 같으면 여기도
 * 항상 0으로 나와요. parseOrder에서 이미 "메뉴 줄 가격 합계"로 주문별 결제
 * 금액을 보정해뒀으니, dashboard 응답이 전부 0이면 같은 매장의 주문 목록(GET
 * /api/owner/stores/{store}/orders)을 가져와 오늘 날짜의 결제 완료 주문들을
 * 시간대별로 직접 누적 합산해서 그래프를 채워요. 서버가 나중에 total_amount를
 * 제대로 계산해 주기 시작하면 dashboard 값이 0이 아니게 되고, 그 순간부터는
 * 자동으로 서버 값을 그대로 써요(이 보정은 "0일 때만" 개입해요).
 */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

// 결제가 실제로 이뤄진(취소/거절/결제전 제외) 주문만 매출로 쳐요.
const UNPAID_ORDER_STATUSES = new Set(["PENDING_PAYMENT", "CANCELLED", "REJECTED", "REFUNDED"]);

function computeHourlySalesFromOrders(orders: ApiOrderDetail[], dateKey: string): SalesPoint[] {
  const todays = orders.filter(
    (o) => o.createdAt && o.createdAt.slice(0, 10) === dateKey && !UNPAID_ORDER_STATUSES.has(o.status),
  );
  if (todays.length === 0) return [];
  todays.sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
  const byHour = new Map<string, number>();
  let running = 0;
  for (const o of todays) {
    const hour = (o.createdAt ?? "").slice(11, 13) || "09";
    running += o.totalAmount;
    byHour.set(hour, running);
  }
  return Array.from(byHour.entries())
    .map(([hour, amount]) => ({ hour, amount }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}

function sumOrdersAmount(orders: ApiOrderDetail[], dateKey: string): number {
  return orders
    .filter((o) => o.createdAt && o.createdAt.slice(0, 10) === dateKey && !UNPAID_ORDER_STATUSES.has(o.status))
    .reduce((sum, o) => sum + o.totalAmount, 0);
}

export async function fetchTodaySales(
  storeId: string | number,
): Promise<TodaySalesResponse | null> {
  if (!isApiConfigured()) return null;

  // ⚠️ 예전엔 아래 세 요청을 Promise.all로 한 번에 묶어서 보냈어요. 그런데
  // 문서에도 없는 추측성 엔드포인트(/api/owner/stores/{id}/sales)가 실서버엔
  // 없어서 항상 실패하고, Promise.all은 하나만 실패해도 전부 reject시켜서
  // dashboard/orders가 멀쩡히 성공했어도 catch로 빠져 null을 돌려줬어요.
  // 그러면 화면은 "어제 매출"을 계속 0으로 유지해서 "0% 어제 대비"로 보였어요
  // (오늘 매출 13,100원처럼 실제 값이 있어도 마찬가지). Promise.allSettled로
  // 바꿔서 일부가 실패해도 성공한 나머지는 그대로 반영해요.
  const [dashboardResult, yesterdayResult, ordersResult] = await Promise.allSettled([
    apiFetch<{
      sales: number[];
      sales_meta?: { hours?: number[] };
    }>(`/api/owner/stores/${encodeURIComponent(String(storeId))}/dashboard`, {
      authAs: "owner",
    }),
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      // ⚠️ toISOString()은 UTC 기준 날짜를 잘라서, 한국 시간 자정 근처에는
      // 실제 "어제"와 하루 어긋날 수 있었어요. 로컬 날짜로 계산해요.
      const iso = localDateKey(d);
      return apiFetch<{ summary: { total_sales: number } }>(
        `/api/owner/stores/${encodeURIComponent(String(storeId))}/sales`,
        { authAs: "owner", query: { from: iso, to: iso } },
      );
    })(),
    apiOwnerListStoreOrders(storeId),
  ]);

  const dashboard = dashboardResult.status === "fulfilled" ? dashboardResult.value : null;
  const yesterday = yesterdayResult.status === "fulfilled" ? yesterdayResult.value : null;
  const orders = ordersResult.status === "fulfilled" ? ordersResult.value : null;

  // 대시보드도, 주문 목록도 둘 다 못 가져왔을 때만 진짜 실패로 보고 null을
  // 돌려줘요(화면이 이전 값을 그대로 유지). 하나라도 성공했으면 그 값으로
  // 최대한 정확하게 계산해요.
  if (!dashboard && !orders) {
    console.warn("[sales] 매출 데이터를 불러오지 못했어요.");
    return null;
  }

  const sales = dashboard?.sales ?? [];
  // sales_meta.hours가 있으면 그대로 쓰고(백엔드가 실제 시간대를 알려줌),
  // 혹시 없는 옛 응답이 오더라도 09시부터 순서대로라고 가정해 화면이 안 깨지게 해요.
  const hours = dashboard?.sales_meta?.hours ?? sales.map((_, i) => 9 + i);
  // ⚠️ "방금 주문 하나를 완료 처리했는데 오늘 매출에 안 뜬다"는 문제의 원인
  // 하나: 응답이 항상 시간 순서대로 온다는 보장이 없는데(예: 백엔드가 시간대별
  // 집계를 만드는 순서가 insert 순서를 따르는 경우), 화면(owner-store.tsx)은
  // 그냥 배열의 "마지막 값"을 오늘 총 매출로 써요. 시간 순서가 뒤섞여 오면
  // 실제로는 있는 매출이 배열 중간에 있는데 마지막(더 이른 시간대) 값을
  // "오늘 매출"로 보여줘서 0원이거나 낮은 금액으로 보일 수 있었어요. 여기서
  // 시간(hour) 기준으로 정렬해 배열을 넘겨줘서, 화면의 "마지막 값 = 가장
  // 늦은 시간대(=지금까지의 누적 총액)"라는 가정이 항상 맞게 해요.
  let hourly: SalesPoint[] = sales
    .map((amount, i) => ({
      hour: String(hours[i] ?? 9 + i).padStart(2, "0"),
      amount,
    }))
    .sort((a, b) => a.hour.localeCompare(b.hour));

  // ⚠️ "/sales" 엔드포인트는 실제 API 문서(Swagger)에 없는 추측성 경로라
  // 대부분 404가 나요. 그래서 어제 매출은 이미 다른 곳에서도 검증된 "주문
  // 목록"에서 직접 합산하는 걸 1순위로 쓰고, 추측성 엔드포인트 응답은 혹시
  // 있을 때만 보조로 써요(우선순위를 뒤집었던 게 "4천원 매출이 있는데도
  // 0%로 뜨는" 문제의 직접 원인이었어요).
  let yesterdayTotal = 0;
  if (orders) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    yesterdayTotal = sumOrdersAmount(orders, localDateKey(y));
  }
  if (!yesterdayTotal && yesterday?.summary?.total_sales) {
    yesterdayTotal = yesterday.summary.total_sales;
  }

  if (orders) {
    const todayKey = localDateKey(new Date());
    const dashboardIsAllZero = hourly.length === 0 || hourly.every((p) => p.amount === 0);
    if (dashboardIsAllZero) {
      const fallback = computeHourlySalesFromOrders(orders, todayKey);
      if (fallback.length > 0) hourly = fallback;
    }
  }

  return { hourly, yesterdayTotal };
}

export type ApiMenu = {
  id: number;
  store_id: number;
  category_id: number | null;
  /** 카테고리 이름. 서버가 문자열로 함께 내려주면 이 필드로 와요(없으면 undefined). */
  category?: string | null;
  name: string;
  description?: string | null;
  price: string;
  image_url?: string | null;
  is_available: boolean;
};

/** GET /api/owner/menus — "사장님 운영정보 재로그인 복원" 문서(섹션 11-3)로 확정된 경로.
 * ⚠️ 예전엔 `/api/owner/stores/{store}/menus`를 썼는데, 그 경로는 이 문서
 * 어디에도 정의돼 있지 않은(존재하지 않는) 엔드포인트였어요. 그래서 메뉴를
 * 추가해도 서버에는 저장되지 않고(호출은 조용히 실패 → catch에서 null 반환),
 * 화면에만 임시로 붙어 있다가 로그아웃 후 재로그인하면(=목록을 다시 불러오면)
 * 사라지는 것처럼 보였어요. 이 경로는 storeId를 안 받고, 로그인한 사장님
 * 계정의 활성 OWNER 매장을 서버가 토큰으로 자동 선택해요. */
export async function apiOwnerListMenus(): Promise<ApiMenu[] | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<unknown>("/api/owner/menus", {
      authAs: "owner",
    });
    if (Array.isArray(res)) return res as ApiMenu[];
    if (res && typeof res === "object") {
      const obj = res as Record<string, unknown>;
      if (Array.isArray(obj["data"])) return obj["data"] as ApiMenu[];
      const menus = obj["menus"] as Record<string, unknown> | undefined;
      if (menus && Array.isArray(menus["data"]))
        return menus["data"] as ApiMenu[];
    }
    return [];
  } catch {
    return null;
  }
}

/** POST /api/owner/menus — 문서(섹션 11-3)로 확정된 경로.
 * category_id 대신 category(예: "커피")를 문자열로 보내면 서버가 해당 매장의
 * 카테고리를 찾아 자동으로 연결해줘요(카테고리를 미리 안 만들어도 됨). */
export async function apiOwnerCreateMenu(input: {
  name: string;
  price: number;
  category?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_available?: boolean;
}): Promise<ApiMenu | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<{ menu?: ApiMenu; data?: ApiMenu }>(
      "/api/owner/menus",
      { method: "POST", body: input, authAs: "owner" },
    );
    return res.menu ?? res.data ?? null;
  } catch {
    return null;
  }
}

/** POST /api/owner/menu-categories — 카테고리 생성(문서 섹션 11-3).
 * ⚠️ apiOwnerCreateMenu에 category(이름 문자열)를 보내면 서버가 "해당 매장의
 * 카테고리를 찾아" 연결하는 방식이라, 그 매장에 아직 그 이름의 카테고리가 하나도
 * 없으면(특히 매장을 막 만든 직후) 못 찾아서 메뉴 생성 자체가 실패해요. 이때
 * apiOwnerCreateMenu는 실패를 조용히 삼키고 null만 돌려줘서(호출부 어디서도
 * 예외를 안 던지는 설계), 화면엔 메뉴가 추가된 것처럼 보이지만(낙관적 업데이트)
 * 실제로는 저장되지 않고, 로그아웃 후 재로그인(=목록 다시 불러오기)하면 사라지는
 *것처럼 보였어요. 이 함수로 카테고리를 먼저 만들어두면 그 문제를 막을 수 있어요.
 * 이미 같은 이름의 카테고리가 있어서 이 호출이 실패해도(중복 등) 문제 없어요 —
 * 어차피 그 경우엔 카테고리가 이미 있다는 뜻이라 메뉴 생성 재시도가 성공해요. */
export async function apiOwnerCreateMenuCategory(
  name: string,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch("/api/owner/menu-categories", {
      method: "POST",
      body: { name },
      authAs: "owner",
    });
    return true;
  } catch {
    return false;
  }
}

/** PUT /api/owner/menus/{menu} */
export async function apiOwnerUpdateMenu(
  menuId: string | number,
  input: Partial<{
    name: string;
    price: number;
    category: string | null;
    category_id: number | null;
    description: string | null;
    image_url: string | null;
    is_available: boolean;
  }>,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(`/api/owner/menus/${encodeURIComponent(String(menuId))}`, {
      method: "PUT",
      body: input,
      authAs: "owner",
    });
    return true;
  } catch {
    return false;
  }
}

/** DELETE /api/owner/menus/{menu} */
export async function apiOwnerDeleteMenu(
  menuId: string | number,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(`/api/owner/menus/${encodeURIComponent(String(menuId))}`, {
      method: "DELETE",
      authAs: "owner",
    });
    return true;
  } catch {
    return false;
  }
}

/** PATCH /api/owner/menus/{menu}/availability */
export async function apiOwnerSetMenuAvailability(
  menuId: string | number,
  isAvailable: boolean,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(
      `/api/owner/menus/${encodeURIComponent(String(menuId))}/availability`,
      {
        method: "PATCH",
        body: { is_available: isAvailable },
        authAs: "owner",
      },
    );
    return true;
  } catch {
    return false;
  }
}

/** GET /api/owner/stores/{store}/orders — 사장님 화면에서 매장 주문 목록 조회.
 * ⚠️ 메뉴·좌석과 달리 이 경로는 storeId를 URL에 그대로 넣어야 해요(스웨거 기준
 * /api/owner/stores/{store}/orders). ownerStoreId가 없으면 호출하지 않아요. */
export async function apiOwnerListStoreOrders(
  storeId: string | number,
): Promise<ApiOrderDetail[] | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<unknown>(
      `/api/owner/stores/${encodeURIComponent(String(storeId))}/orders`,
      { authAs: "owner" },
    );
    const rows = Array.isArray(res) ? res : (res as { data?: unknown[] })?.data ?? [];
    return Array.isArray(rows) ? rows.map((r) => parseOrder(r as Record<string, unknown>)) : [];
  } catch {
    return null;
  }
}

/** 상태값 하나당 서버가 실제로 받아줄 만한 후보 문자열들. 스웨거에 enum이
 * 없어서(422 "상태 검증 실패"만 명시) 정확한 값을 확정할 수 없어요. 예약 상태
 * API가 "ACCEPTED/APPROVED/수락/승인"도 CONFIRMED로 알아서 바꿔주는 것처럼
 * 이 백엔드는 동의어를 넓게 받아주는 편이라, 대표값이 422로 거절되면 흔한
 * 동의어로 한 번 더 시도해요.
 * ⚠️ 주문 상세 응답(예: GET /api/owner/stores/{store}/orders)에 paid_at /
 * preparing_at / ready_at / completed_at / cancelled_at / refunded_at 같은
 * 타임스탬프 컬럼이 있고 confirmed_at/accepted_at/rejected_at 컬럼은 없는 걸로
 * 봐서, 실제 enum은 예약(reservations) 쪽과 달리 CONFIRMED/ACCEPTED 단계 없이
 * 바로 PREPARING으로, 거절은 REJECTED 없이 바로 CANCELLED로 넘어갈 가능성이
 * 커요. 그래서 그 값들을 각 후보 목록의 맨 앞으로 두되, 확실하지 않으니 기존
 * 후보들도 계속 순서대로 시도해요. 그래도 전부 422로 실패하면(=이 목록에 진짜
 * 값이 없다는 뜻) 정확한 enum은 백엔드 소스코드(OrderStatus 관련 enum/상수)를
 * 직접 확인해야 알 수 있어요 — 스웨거/전달받은 변경사항 문서 어디에도 이
 * 엔드포인트의 상태값 목록이 명시돼 있지 않아요. */
const ORDER_STATUS_CANDIDATES: Record<string, string[]> = {
  CONFIRMED: ["PREPARING", "CONFIRMED", "ACCEPTED", "APPROVED"],
  REJECTED: ["CANCELLED", "REJECTED", "DECLINED"],
  READY: ["READY", "PREPARED", "COMPLETED"],
  COMPLETED: ["COMPLETED", "DONE", "PICKED_UP"],
  CANCELLED: ["CANCELLED", "CANCELED", "REJECTED"],
};

/** PATCH /api/owner/orders/{order}/status — 사장님이 주문 상태를 바꿔요
 * (접수/준비완료/취소 등). 정확한 상태값 목록이 스웨거에 없어서, 예약 상태값과
 * 비슷한 체계(대문자 스네이크)로 추정해서 보내고, 422(상태 검증 실패)가 오면
 * 흔한 동의어로 재시도해요. ⚠️ 이 요청이 실제로 성공해야만 사장님이 로그아웃 후
 * 다시 들어와도 상태가 유지돼요 — 실패했는데도 화면만 바뀐 것처럼 보이면
 * (예전 방식: 결과를 확인 안 하고 그냥 fire-and-forget), 재로그인 시 서버에
 * 남아있는 원래 상태(예: 주문접수)로 되돌아온 것처럼 보이는 문제가 생겨요.
 *
 * ⚠️ 예전엔 성공 여부만 boolean으로 돌려줘서, 실패해도 "왜" 실패했는지(422
 * 검증 실패인지, 인증 문제인지, 서버가 아예 응답을 안 하는지) 화면에서 전혀
 * 알 수 없었어요. 특히 "결제대기" 주문 취소처럼 후보 상태값 전부가 거절될
 * 수 있는 경우, 실패해도 조용히 원래 상태로 되돌아가기만 해서 사장님은 취소가
 * 됐다고 착각하고 넘어갔다가 나중에(재로그인 후) 다시 "결제대기"로 보이는
 * 원인을 알 수 없었어요. 이제 서버가 실제로 돌려준 상태코드·메시지를 그대로
 * 보존해서, 실패했을 때 그 이유를 화면에 보여줄 수 있게 해요. */
export async function apiOwnerUpdateOrderStatus(
  orderId: string | number,
  status: "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "REJECTED" | "CANCELLED",
): Promise<{ ok: boolean; httpStatus?: number; message?: string }> {
  if (!isApiConfigured()) {
    return { ok: false, message: "백엔드 서버 주소가 설정되어 있지 않아요." };
  }
  const candidates = ORDER_STATUS_CANDIDATES[status] ?? [status];
  let lastError: { httpStatus?: number; message?: string } = {};
  for (const candidate of candidates) {
    try {
      await apiFetch(`/api/owner/orders/${encodeURIComponent(String(orderId))}/status`, {
        method: "PATCH",
        body: { status: candidate },
        authAs: "owner",
      });
      return { ok: true };
    } catch (err) {
      // 422(상태 검증 실패)면 다음 후보로 재시도하고, 그 외 오류(인증/권한/네트워크)면
      // 재시도해도 어차피 안 되니 바로 포기해요. 어느 쪽이든 실제 오류 내용은
      // 남겨서 호출부가 화면에 보여줄 수 있게 해요.
      if (err instanceof ApiError) {
        lastError = { httpStatus: err.status, message: err.message };
        if (err.status === 422) continue;
      } else {
        lastError = { message: "네트워크 오류로 서버에 연결하지 못했어요." };
      }
      return { ok: false, ...lastError };
    }
  }
  // eslint-disable-next-line no-console
  console.error(
    `[apiOwnerUpdateOrderStatus] 주문 #${orderId}: "${status}"로 시도한 후보값(${candidates.join(
      ", ",
    )}) 전부 422로 거절됐어요. 이 주문이 이미 취소/완료된 상태이거나(먼저 GET .../orders로 현재 status를 확인해보세요), 이 목록에 실제 enum 값이 없을 수 있어요 — 백엔드에 이 엔드포인트가 실제로 받는 status 값을 문의해주세요.`,
  );
  return { ok: false, ...lastError };
}

/** POST /api/owner/reviews/{review}/reply
 * ⚠️ 스웨거에 성공 응답 스키마가 없어서(설명만 "성공"), 생성된 답글의 id를
 * 응답에서 알아낼 수 있을지는 서버 구현에 달려있어요. 흔히 쓰는 후보 필드명을
 * 순서대로 시도해서 있으면 replyId로 돌려주고, 없으면 null이에요(그래도 답글
 * 등록 자체는 성공한 상태 — 이후 수정/삭제만 이 화면 새로고침 전까진 못 함). */
export async function apiOwnerReplyToReview(
  reviewId: string | number,
  content: string,
): Promise<{ ok: true; replyId: string | null } | { ok: false }> {
  if (!isApiConfigured()) return { ok: false };
  try {
    const res = await apiFetch<Record<string, unknown>>(
      `/api/owner/reviews/${encodeURIComponent(String(reviewId))}/reply`,
      {
        method: "POST",
        body: { content },
        authAs: "owner",
      },
    );
    const raw =
      res && typeof res === "object" && "reply" in res
        ? ((res as { reply?: Record<string, unknown> }).reply ?? {})
        : (res ?? {});
    const id = (raw as Record<string, unknown>)["id"];
    return { ok: true, replyId: id !== undefined && id !== null ? String(id) : null };
  } catch {
    return { ok: false };
  }
}

/** PUT /api/owner/review-replies/{reply} — 이미 등록한 답글 내용 수정 */
export async function apiOwnerUpdateReviewReply(
  replyId: string | number,
  content: string,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(
      `/api/owner/review-replies/${encodeURIComponent(String(replyId))}`,
      {
        method: "PUT",
        body: { content },
        authAs: "owner",
      },
    );
    return true;
  } catch {
    return false;
  }
}

/** DELETE /api/owner/review-replies/{reply} — 등록한 답글 삭제 */
export async function apiOwnerDeleteReviewReply(
  replyId: string | number,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(
      `/api/owner/review-replies/${encodeURIComponent(String(replyId))}`,
      {
        method: "DELETE",
        authAs: "owner",
      },
    );
    return true;
  } catch {
    return false;
  }
}

/** PATCH /api/owner/stores/{store}/business-status — 매장 영업중/영업마감 상태 변경.
 * 2026-08-19 백엔드 변경사항 문서로 필드명이 확정됐어요: is_open.
 * (예전 PATCH .../availability + is_active 방식은 당분간 계속 동작하지만,
 * store.is_active(매장 게시·활성 여부)와 store.is_open(현재 영업 중 여부)은
 * 서로 다른 개념이라 신규 코드는 여기(is_open)를 써야 해요.) */
export async function apiOwnerUpdateBusinessStatus(
  storeId: string | number,
  isOpen: boolean,
): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(
      `/api/owner/stores/${encodeURIComponent(String(storeId))}/business-status`,
      {
        method: "PATCH",
        body: { is_open: isOpen },
        authAs: "owner",
      },
    );
    return true;
  } catch {
    return false;
  }
}

/** 매장 프로필(이름/설명/주소/전화/대표이미지 등) 수정.
 * 2026-08-19 백엔드 변경사항 문서로 확정됐어요: PATCH /api/owner/stores/{store}.
 * 응답은 { message, store }로 오므로, 저장 직후 서버가 실제로 반영한 값을
 * 그대로 돌려줘서 화면 상태를 서버와 동기화할 수 있게 해요(추측으로 로컬 상태만
 * 유지하지 않아도 돼요). */
export async function apiOwnerUpdateStoreProfile(
  storeId: string | number,
  input: Partial<{
    name: string;
    description: string | null;
    address: string | null;
    detail_address: string | null;
    phone: string | null;
    thumbnail_url: string | null;
    latitude: number;
    longitude: number;
    reservation_enabled: boolean;
    /** 2026-08-19 백엔드 변경사항 문서로 추가됨. 보낼 때는 알고 있는 필드만 채워서
     * 보내요(사업자등록번호만 입력하는 화면이라도 나머지 필드는 undefined로 두면
     * 서버에서 기존 값을 덮어쓰지 않아요 — PATCH이므로 부분 수정이에요). */
    business_info: ApiStoreBusinessInfo;
    /** 요일별 영업시간 전체 배열. tags와 마찬가지로 보내면 해당 매장의 영업시간
     * 전체가 이 값으로 동기화돼요(부분 요일만 보내면 안 돼요). */
    business_hours: ApiStoreBusinessHour[];
    /** 2026-08-19 백엔드 변경사항 문서로 확정됨: 매장 태그 전체 목록.
     * ⚠️ 예전엔 POST /api/stores/{store}/tags(태그 1개 추가) / DELETE /api/tags/{tag}
     * (태그 1개 삭제) 전용 엔드포인트가 있는 줄 알고 그걸 썼는데, 실제로는 그런
     * 엔드포인트가 없어서(404) 태그를 누르면 화면에 잠깐 붙었다가 실패 처리로
     * 다시 사라지는 문제가 있었어요. 태그는 여기(PATCH .../stores/{store})로
     * "현재 선택된 태그 전체 배열"을 보내면 서버가 그 값으로 통째로 동기화해요
     * (부분 태그만 보내면 안 되고 항상 전체 목록을 보내야 해요).
     */
    tags: Array<{ name: string; slug?: string }>;
  }>,
): Promise<ApiStore | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<{ message: string; store: ApiStore }>(
      `/api/owner/stores/${encodeURIComponent(String(storeId))}`,
      { method: "PATCH", body: input, authAs: "owner" },
    );
    return res.store;
  } catch {
    return null;
  }
}

/** POST /api/stores/{store}/tags — 매장에 태그를 하나 추가해요.
 * 스웨거 문서에 요청/응답 본문 스키마가 안 나와있어서(라라벨 자동 생성 문서라
 * 필드 설명이 없어요), 가장 흔히 쓰이는 필드명(name)으로 보내고, 응답도
 * { data: {...} } / { tag: {...} } / 태그 객체 그대로, 세 형태를 모두 시도해요.
 * 생성된 태그의 id를 못 찾으면(응답 형태가 다르면) null을 돌려주고, 호출한 쪽에서
 * 화면에 낙관적으로 추가했던 항목을 되돌려요. */
export async function apiAddStoreTag(
  storeId: string | number,
  name: string,
): Promise<ApiStoreTag | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<Record<string, unknown>>(
      `/api/stores/${encodeURIComponent(String(storeId))}/tags`,
      { method: "POST", body: { name }, authAs: "owner" },
    );
    const raw =
      (res?.["data"] as Record<string, unknown> | undefined) ??
      (res?.["tag"] as Record<string, unknown> | undefined) ??
      res;
    const id = raw?.["id"];
    if (typeof id !== "number") {
      // eslint-disable-next-line no-console
      console.error(
        "[apiAddStoreTag] 응답에서 태그 id를 못 찾았어요. 실제 응답:",
        res,
      );
      return null;
    }
    return {
      id,
      name: (raw["name"] as string | undefined) ?? name,
      slug: (raw["slug"] as string | undefined) ?? null,
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[apiAddStoreTag] 태그 추가에 실패했어요:", err);
    return null;
  }
}

/** DELETE /api/tags/{tag} — 태그를 하나 삭제해요(id 기준). */
export async function apiDeleteTag(tagId: number): Promise<boolean> {
  if (!isApiConfigured()) return false;
  try {
    await apiFetch(`/api/tags/${encodeURIComponent(String(tagId))}`, {
      method: "DELETE",
      authAs: "owner",
    });
    return true;
  } catch {
    return false;
  }
}

export type ApiSeat = {
  id: number;
  seat_code: string;
  seat_name: string;
  seat_type: "WINDOW" | "NORMAL" | "GROUP" | "OUTDOOR";
  capacity: number;
  floor_number: number;
  status: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE";
  is_active: boolean;
};

/** 좌석 생성/삭제/상태변경/일괄변경이 실패했을 때 "진짜 이유"를 남겨둬요.
 * ⚠️ 예전엔 이 네 함수가 성공 여부(boolean)만 돌려주고 실패 사유는 그냥
 * catch에서 삼켜버렸어요. 그래서 owner-store.tsx는 실패 원인이 진짜
 * 네트워크 단절이든, 422 검증 실패(예: 중복된 좌석 번호, 잘못된 상태값)든
 * 상관없이 항상 "백엔드 서버 주소(192.168.x.x)에 지금 이 기기에서 접속할
 * 수 있는지 확인해주세요"라는 네트워크 문제 안내만 보여줬어요. 실제로는
 * 서버에 연결은 됐지만 요청 내용이 거부된 경우에도 같은 문구가 떠서, 원인
 * 파악이 안 되는 문제로 이어졌어요(예: 화면의 "16개 전부 사용중으로 보이는데
 * 저장이 실패한다" 같은 증상을 조사할 때도 이 네트워크 문구만으로는 진짜
 * 원인을 알 수 없었어요). apiCreateOrder(lastCreateOrderError)와 같은
 * 패턴으로, 실제 HTTP 상태코드/서버 메시지를 여기 남겨서 owner-store.tsx가
 * 더 정확한 안내를 보여줄 수 있게 해요. */
export let lastSeatError: string | null = null;

/** ⚠️ (5번째 수정 — "두 번째로 숫자를 바꾸면 실패한다" 원인)
 * status===0(네트워크 오류/AbortController 타임아웃)은 "서버가 요청을
 * 거절했다"는 게 아니라 "응답을 못 받았다"는 뜻일 뿐이에요. 개발용
 * `php artisan serve`는 요청을 한 번에 하나씩만 처리하는 단일 스레드라서,
 * 화면에 떠 있는 8초 폴링(매출/주문/메뉴/예약 등)이 여러 개 겹친 상태에서
 * 좌석 총 개수를 다시 조정하면(=addSeat/removeSeat이 병렬로 여러 번 나감)
 * 요청 자체는 서버에 이미 도착해서 처리(좌석 생성/삭제)까지 끝났는데,
 * 그 결과를 브라우저로 돌려주는 게 우리 쪽 15초 타임아웃보다 늦어질 수
 * 있어요. 이 경우 프론트는 "실패"로 보고 방금 만든/지운 좌석을 화면에서
 * 되돌리는데, 서버는 이미 처리를 끝낸 상태라 실제로는 "성공"이에요.
 * → 손님 화면(지도)은 서버 값을 그대로 보여주니 새 좌석 수(예: 16)가
 * 바로 반영되는데, 사장님 화면은 되돌아간 옛날 값 + 실패 안내만 보여줘서
 * "사장님 화면에서는 안 바뀌는데 손님 화면에서는 바뀌어 있다"는 정확히
 * 이 증상으로 이어졌어요.
 * status===0일 때만 "결과를 확실히 알 수 없음(ambiguous)"으로 표시해서,
 * 호출부(owner-store.tsx)가 이럴 때는 낙관적 화면을 억지로 되돌리는 대신
 * 서버에서 좌석 목록을 다시 불러와(재동기화) 실제 상태로 맞추게 해요.
 * 반대로 422 같은 진짜 거절(status>0)은 서버가 명확히 거부한 거라 그대로
 * 되돌리는 게 맞아요 — 그 경우는 계속 false로 둬요. */
export let lastSeatErrorAmbiguous = false;

function describeSeatApiError(err: unknown): string {
  lastSeatErrorAmbiguous = false;
  if (err instanceof ApiError) {
    const fieldMsg = err.fieldErrors
      ? " " +
        Object.entries(err.fieldErrors)
          .map(([field, msgs]) => `${field}: ${msgs.join(", ")}`)
          .join(" / ")
      : "";
    if (err.status === 0) {
      // apiFetch가 fetch 자체(네트워크 오류/타임아웃)에서 실패한 경우에만
      // status가 0이에요 — 이때만 "기기 접속 확인" 안내가 실제로 맞고,
      // 동시에 "서버가 실제로 처리했는지 우리는 모른다"는 뜻이기도 해요.
      lastSeatErrorAmbiguous = true;
      return err.message;
    }
    return `서버가 요청을 거부했어요 (${err.status}): ${err.message}${fieldMsg}`;
  }
  return err instanceof Error ? err.message : "알 수 없는 오류가 발생했어요.";
}

/** GET /api/owner/seats — 좌석 목록 조회.
 * 2026-08-19 "사장님 운영정보 재로그인 복원" 문서(섹션 11-4)로 확정된 경로.
 * ⚠️ 예전엔 `/api/owner/stores/{store}/seats`(storeId를 URL에 넣는 경로)를 썼는데,
 * 메뉴(apiOwnerListMenus)·예약(apiOwnerListReservations)과 똑같은 문제가 있었어요:
 * ownerStoreId 캐시가 비어있거나 재로그인 직후 아직 안 채워졌으면 storeId가
 * "undefined" 문자열로 URL에 그대로 박혀서 요청이 조용히 실패했어요(catch에서
 * null 반환). 그 결과 좌석 상태를 바꿔도 서버엔 반영이 안 됐는데 화면(로컬 상태)엔
 * 바뀐 것처럼 보여서, 카페 상세/지도의 실시간 잔여 좌석 수가 안 바뀌는 것처럼
 * 보이는 원인 중 하나였어요. 이 경로는 storeId를 안 받고, 로그인한 사장님 계정의
 * 활성 OWNER 매장을 서버가 토큰으로 자동 선택해요(메뉴/예약과 동일한 패턴). */
export async function apiOwnerListSeats(): Promise<ApiSeat[] | null> {
  if (!isApiConfigured()) return null;
  try {
    const res = await apiFetch<{ data: ApiSeat[] }>("/api/owner/seats", {
      authAs: "owner",
    });
    return res.data ?? [];
  } catch {
    return null;
  }
}

/** POST /api/owner/seats — 좌석 생성(문서 섹션 11-4로 확정된 경로. storeId 불필요). */
export async function apiOwnerCreateSeat(input: {
  seat_code: string;
  seat_name: string;
  seat_type: "WINDOW" | "NORMAL" | "GROUP" | "OUTDOOR";
  capacity: number;
  floor_number: number;
}): Promise<ApiSeat | null> {
  lastSeatError = null;
  if (!isApiConfigured()) {
    lastSeatError = "백엔드 서버 주소(NEXT_PUBLIC_API_BASE_URL)가 설정돼 있지 않아요.";
    return null;
  }
  try {
    // ⚠️ (진짜 원인 발견) 이 API의 실제 응답은 좌석 객체를 바로 돌려주지
    // 않고, apiOwnerCreateMenu(메뉴 생성)와 같은 패턴으로 { seat: {...} }
    // 또는 { data: {...} }로 한 번 감싸서 와요. 예전엔 응답을 그대로
    // ApiSeat이라고 가정해서 created.id를 읽었는데, 실제로는 최상위에
    // id가 없어서 항상 undefined였고, owner-store.tsx가 이걸
    // String(created.id)로 만들면서 새로 만든 좌석마다 전부 문자열
    // "undefined"가 id로 붙어버렸어요. 그 결과:
    //   - 새로 만든 좌석이 여러 개면 전부 같은 id("undefined")를 갖게 돼서,
    //     그중 하나를 눌러도 상태변경(setSeats의 id 매칭)이 전부 다
    //     함께 걸려 "여러 개가 한꺼번에 선택되는" 것처럼 보였고,
    //   - 그 좌석을 다시 누르면 PATCH /api/owner/seats/undefined로
    //     요청이 나가 404("No query results ... undefined")로 실패했고,
    //   - 여러 좌석 상태를 한 번에 복원하는 일괄 PATCH에서도 id가 전부
    //     "undefined"로 겹쳐서 422("has a duplicate value")로 실패했어요.
    // 이제 응답이 어떤 모양으로 오든(감싸져 있든 아니든) 실제 좌석
    // 객체를 찾아내고, 그래도 id가 숫자가 아니면 "생성은 됐지만 응답을
    // 알 수 없는" 상태로 보고 실패 처리해서 "undefined" id가 화면에
    // 절대 남지 않게 해요.
    // ⚠️ 총 좌석 수를 늘릴 때는 이 요청이 최대 SEAT_BATCH_CONCURRENCY(4)개까지
    // 동시에 나가고, 그 사이 화면의 8초 폴링(매출/주문/메뉴/예약)까지 겹칠 수
    // 있어요. 개발용 `php artisan serve`(단일 스레드)에서는 이 요청들이 줄줄이
    // 밀려 처리되면서 기본 15초 타임아웃을 넘기기 쉬워요(특히 방금 한 번 더
    // 좌석 수를 바꾼 "두 번째" 요청에서). 처리 자체는 결국 끝나는데 응답만
    // 늦는 상황이라, 좌석 생성처럼 무거워질 수 있는 요청에는 여유 시간을 더 줘요.
    const res = await apiFetch<{ seat?: ApiSeat; data?: ApiSeat } & Partial<ApiSeat>>(
      "/api/owner/seats",
      {
        method: "POST",
        body: input,
        authAs: "owner",
        timeoutMs: 30000,
      },
    );
    const seat = (res.seat ?? res.data ?? (res as ApiSeat)) as ApiSeat | undefined;
    if (!seat || typeof seat.id !== "number") {
      lastSeatError =
        "좌석이 서버에 만들어졌는지 확인하지 못했어요(응답 형식이 예상과 달라요). 새로고침 후 다시 확인해주세요.";
      return null;
    }
    return seat;
  } catch (err) {
    lastSeatError = describeSeatApiError(err);
    return null;
  }
}

/** DELETE /api/owner/seats/{seat} — 좌석 삭제(문서 섹션 11-4로 확정된 경로. storeId 불필요). */
export async function apiOwnerDeleteSeat(
  seatId: string | number,
): Promise<boolean> {
  lastSeatError = null;
  if (!isApiConfigured()) {
    lastSeatError = "백엔드 서버 주소(NEXT_PUBLIC_API_BASE_URL)가 설정돼 있지 않아요.";
    return false;
  }
  try {
    // apiOwnerCreateSeat과 같은 이유(위 주석 참고)로 여유 시간을 더 줘요.
    await apiFetch(`/api/owner/seats/${encodeURIComponent(String(seatId))}`, {
      method: "DELETE",
      authAs: "owner",
      timeoutMs: 30000,
    });
    return true;
  } catch (err) {
    lastSeatError = describeSeatApiError(err);
    return false;
  }
}

/** PATCH /api/owner/seats/availability — 좌석 상태 일괄 변경(문서 섹션 11-4).
 * "총 좌석 수" 스테퍼처럼 여러 좌석 상태를 한 번에 바꿀 때, 좌석마다 PATCH를
 * 여러 번 보내는 대신 한 번의 요청으로 묶어서 보낼 수 있어요(네트워크 지연으로
 * 인해 카페 상세/지도의 잔여 좌석 수 반영이 늦어지는 걸 줄여줘요). */
export async function apiOwnerBulkUpdateSeats(
  updates: Array<{
    id: string | number;
    status: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE";
  }>,
): Promise<boolean> {
  lastSeatError = null;
  if (!isApiConfigured()) {
    lastSeatError = "백엔드 서버 주소(NEXT_PUBLIC_API_BASE_URL)가 설정돼 있지 않아요.";
    return false;
  }
  if (updates.length === 0) return false;
  try {
    // apiOwnerCreateSeat과 같은 이유(위 주석 참고)로 여유 시간을 더 줘요.
    await apiFetch("/api/owner/seats/availability", {
      method: "PATCH",
      body: { seats: updates.map((u) => ({ id: u.id, status: u.status })) },
      authAs: "owner",
      timeoutMs: 30000,
    });
    return true;
  } catch (err) {
    lastSeatError = describeSeatApiError(err);
    return false;
  }
}

/* ------------------------------ 카카오맵 주변 카페 ------------------------------ */

/** 카카오맵 API가 돌려주는 주변 카페(CE7) 정보. CafeOn에 등록되지 않은, 카카오맵
 * 상의 일반 카페들이에요. source가 항상 "KAKAO"라서 CafeOn 등록 매장(ApiStore)과
 * 지도에서 시각적으로 구분해요. */
export type ApiKakaoCafe = {
  source: "KAKAO";
  kakao_place_id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string | null;
  road_address?: string | null;
  phone?: string | null;
  place_url?: string | null;
  category_name?: string | null;
  distance?: number | string | null;
};

export type ApiKakaoCafesResponse = {
  data: ApiKakaoCafe[];
  meta: {
    page: number;
    size: number;
    count: number;
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
};

/** GET /api/map/kakao-cafes — 현재 지도 범위(bounds) 안의 카카오맵 카페(CE7)를
 * 전부 조회해요. 2026-08-19 백엔드 변경사항 문서로 추가됐어요.
 * - 지도 이동/확대가 끝날 때마다(예: 카카오맵 idle 이벤트) 현재 bounds로 호출해요.
 * - 백엔드가 카카오 REST API 키를 아직 설정하지 않았으면 503을 돌려줄 수 있어요
 *   (프론트에는 카카오 REST API 키를 절대 넣지 않아요 — JavaScript 키와는 달라요).
 * - 이 API는 카카오 CE7(카페) 결과만 반환하고, CafeOn 등록 매장은 별도로
 *   GET /api/map/stores(=apiListStores)에서 조회해요. */
export async function apiGetKakaoCafes(params: {
  sw_lat: number;
  sw_lng: number;
  ne_lat: number;
  ne_lng: number;
  page?: number;
  size?: number;
}): Promise<ApiKakaoCafesResponse | null> {
  if (!isApiConfigured()) return null;
  try {
    return await apiFetch<ApiKakaoCafesResponse>("/api/map/kakao-cafes", {
      query: params,
    });
  } catch {
    return null;
  }
}

/** PATCH /api/owner/seats/{seat} — 좌석 상태 변경(문서 섹션 11-4로 확정된 경로. storeId 불필요). */
export async function apiOwnerUpdateSeat(
  seatId: string | number,
  status: "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE",
): Promise<boolean> {
  lastSeatError = null;
  if (!isApiConfigured()) {
    lastSeatError = "백엔드 서버 주소(NEXT_PUBLIC_API_BASE_URL)가 설정돼 있지 않아요.";
    return false;
  }
  try {
    await apiFetch(`/api/owner/seats/${encodeURIComponent(String(seatId))}`, {
      method: "PATCH",
      body: { status },
      authAs: "owner",
      timeoutMs: 20000,
    });
    return true;
  } catch (err) {
    lastSeatError = describeSeatApiError(err);
    return false;
  }
}
