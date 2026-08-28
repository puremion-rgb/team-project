"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  apiOwnerLogin,
  apiOwnerSignup,
  apiOwnerGetMyStore,
  apiLogout,
  apiSocialExchange,
  ApiError,
  isApiConfigured,
  setOwnerToken,
  getOwnerToken,
  getOwnerStoreId,
  setOwnerStoreId,
} from "@/lib/api";

type AuthResult = { ok: true } | { ok: false; error: string };

export type OwnerSignupInput = {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  phone: string;
  storeName: string;
};

type OwnerAuthContextValue = {
  isOwnerLoggedIn: boolean;
  /** ⚠️ isOwnerLoggedIn은 항상 false로 시작해서(하이드레이션 오류 방지) 마운트
   * 직후 useEffect에서 실제 저장값으로 바뀌어요. OwnerAuthGate가 그 찰나에
   * "아직 확인 전"을 "로그인 안 됨"으로 착각하면, 실제로는 로그인된 사장님도
   * 화면 전환 중 잠깐 로그인 화면으로 튕겨나가는(그리고 곧바로 원래 화면으로
   * 돌아오는) 깜빡임이 생겨요. ownerAuthReady가 true가 되기 전까지는 리다이렉트
   * 판단을 미뤄야 해요. */
  ownerAuthReady: boolean;
  /** 실제 백엔드에 연동된 사장님 매장 ID (연동 전이거나 조회 실패 시 null) */
  ownerStoreId: number | null;
  ownerLogin: (email?: string, password?: string) => Promise<AuthResult>;
  ownerSignup: (input: OwnerSignupInput) => Promise<AuthResult>;
  /** 사장님 소셜 로그인 콜백(/owner/login/callback)에서 받은 1회용 code로 로그인을 완료해요. */
  ownerLoginWithSocialCode: (code: string) => Promise<AuthResult>;
  ownerLogout: () => void;
  ownerAuthLoading: boolean;
};

const OwnerAuthContext = createContext<OwnerAuthContextValue | null>(null);

/**
 * 사장님 로그인 상태를 관리하는 컨텍스트.
 * - 사장님 화면(/owner/*)은 로그인이 필요해요.
 * - /owner/login, /owner/signup은 로그인 없이 접근 가능해요.
 *
 * NEXT_PUBLIC_API_BASE_URL이 설정돼 있으면 /api/auth/owner/login, /api/auth/owner/signup을
 * 호출해요. 회원가입 응답에는 매장(store) 정보가 함께 오기 때문에, 여기서
 * storeId를 저장해두고 이후 owner-store(대시보드/매출/메뉴 등)에서 재사용해요.
 * 아직 URL이 없으면 이전처럼 데모용으로 바로 로그인 처리돼요.
 */
export function OwnerAuthProvider({ children }: { children: ReactNode }) {
  // ⚠️ 손님 쪽과 동일한 이유로(로그인 여부는 localStorage에만 있어 서버는 모름),
  // 초기값을 서버와 다르게 즉시 읽어오면 "Hydration failed" 오류가 났어요.
  // 서버/클라이언트 첫 렌더는 항상 false/null로 동일하게 시작하고, 마운트된 뒤에만
  // (아래 useEffect) 실제 저장값으로 바꿔요.
  const [isOwnerLoggedIn, setIsOwnerLoggedIn] = useState(false);
  // ⚠️ "아직 확인 전"과 "확인 결과 비로그인"을 구분하기 위한 플래그예요.
  // OwnerAuthGate는 이 값이 true가 되기 전까지 로그인 화면으로 리다이렉트하지
  // 않아요(그전에 판단하면 로그인된 사장님도 화면 전환마다 로그인 화면으로
  // 잠깐 튕겨나가는 버그가 생겨요).
  const [ownerAuthReady, setOwnerAuthReady] = useState(false);
  const [ownerStoreId, setOwnerStoreIdState] = useState<number | null>(null);
  const [ownerAuthLoading, setOwnerAuthLoading] = useState(false);

  useEffect(() => {
    const hasToken = Boolean(getOwnerToken());
    setIsOwnerLoggedIn(hasToken);
    setOwnerAuthReady(true);

    const cachedStoreId = getOwnerStoreId();
    if (cachedStoreId !== null) {
      setOwnerStoreIdState(cachedStoreId);
      return;
    }
    // ⚠️ 저장된 매장 ID가 없는 경우(예: 이 수정 이전에 로그인해서 storeId를
    // 저장할 기회가 없었던 세션, 또는 로그인은 했지만 storeId 저장이 누락됐던
    // 이전 버전의 흔적). 토큰은 유효하니 서버에 다시 물어봐서 되찾아와요.
    // 이걸 안 하면 화면엔 로그인된 것처럼 보여도 매장 프로필 저장/조회가 전부
    // 조용히 건너뛰어져서(ownerStoreId가 없으면 저장 API를 아예 호출하지 않음),
    // "저장했는데 로그아웃하면 사라지는" 것처럼 보이는 문제가 생겨요.
    if (!hasToken || !isApiConfigured()) return;
    apiOwnerGetMyStore().then((store) => {
      if (!store) return;
      setOwnerStoreId(store.id);
      setOwnerStoreIdState(store.id);
    });
  }, []);

  /** 로그인/소셜로그인 응답에 store_id·store가 실려 있으면 그대로 쓰고, 없으면
   * (구버전 응답, 스웨거와 실제 응답이 다른 경우 등) GET /api/owner/store로
   * 실제 연결된 매장 ID를 서버에서 다시 찾아와요. */
  const resolveOwnerStoreId = async (candidate?: number | null): Promise<number | null> => {
    if (typeof candidate === "number") return candidate;
    const store = await apiOwnerGetMyStore();
    return store ? store.id : null;
  };

  const ownerLogin = async (email?: string, password?: string): Promise<AuthResult> => {
    if (!isApiConfigured()) {
      // 백엔드 URL이 아직 설정 안 된 상태(연동 전)에서만 데모용으로 통과시켜요.
      // ⚠️ 예전엔 여기서 setIsOwnerLoggedIn(true)만 하고 아무것도 저장하지
      // 않아서, 새로고침하면(마운트 시 Boolean(getOwnerToken())로 다시 판단)
      // 로그인 상태가 원인 없이 사라졌어요. 데모 토큰을 실제로 저장해서
      // 새로고침해도 상태가 그대로 유지되게 해요.
      setOwnerToken("demo");
      setIsOwnerLoggedIn(true);
      return { ok: true };
    }
    if (!email || !password) {
      return { ok: false, error: "이메일과 비밀번호를 입력해주세요." };
    }
    setOwnerAuthLoading(true);
    try {
      const res = await apiOwnerLogin(email, password);
      setOwnerToken(res.token);
      setIsOwnerLoggedIn(true);
      // 2026-08-19 백엔드 변경사항 문서로 로그인 응답에도 store_id/store가 함께
      // 오게 됐어요. 이걸 저장해둬야 매장 프로필 조회/저장, 매출, 메뉴, 좌석,
      // 예약 등 사장님 화면 전체가 정상 동작해요(ownerStoreId가 없으면 이 모든
      // 서버 연동이 조용히 건너뛰어지도록 설계돼 있어요).
      const storeId = await resolveOwnerStoreId(res.store_id ?? res.store?.id ?? null);
      setOwnerStoreId(storeId);
      setOwnerStoreIdState(storeId);
      return { ok: true };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "로그인에 실패했어요. 다시 시도해주세요.";
      return { ok: false, error: message };
    } finally {
      setOwnerAuthLoading(false);
    }
  };

  /** 사장님 소셜 로그인 완료 처리. 일반 로그인과 동일하게 응답에 store_id/store가
   * 함께 오면 그대로 쓰고, 없으면 GET /api/owner/store로 다시 찾아와요. */
  const ownerLoginWithSocialCode = async (code: string): Promise<AuthResult> => {
    if (!isApiConfigured()) {
      setOwnerToken("demo");
      setIsOwnerLoggedIn(true);
      return { ok: true };
    }
    setOwnerAuthLoading(true);
    try {
      const res = await apiSocialExchange(code, "owner");
      setOwnerToken(res.token);
      setIsOwnerLoggedIn(true);
      const storeId = await resolveOwnerStoreId(res.store_id ?? res.store?.id ?? null);
      setOwnerStoreId(storeId);
      setOwnerStoreIdState(storeId);
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "소셜 로그인에 실패했어요. 다시 시도해주세요.";
      return { ok: false, error: message };
    } finally {
      setOwnerAuthLoading(false);
    }
  };

  const ownerSignup = async (input: OwnerSignupInput): Promise<AuthResult> => {
    if (!isApiConfigured()) {
      setOwnerToken("demo");
      setIsOwnerLoggedIn(true);
      return { ok: true };
    }
    setOwnerAuthLoading(true);
    try {
      const res = await apiOwnerSignup({
        name: input.name,
        email: input.email,
        password: input.password,
        password_confirmation: input.passwordConfirmation,
        phone: input.phone,
        store_name: input.storeName,
        terms_accepted: true,
      });
      setOwnerToken(res.token);
      setOwnerStoreId(res.store.id);
      setOwnerStoreIdState(res.store.id);
      setIsOwnerLoggedIn(true);
      return { ok: true };
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "회원가입에 실패했어요. 다시 시도해주세요.";
      return { ok: false, error: message };
    } finally {
      setOwnerAuthLoading(false);
    }
  };

  const ownerLogout = () => {
    if (isApiConfigured()) {
      void apiLogout("owner");
    }
    setOwnerToken(null);
    setIsOwnerLoggedIn(false);
  };

  const value = useMemo<OwnerAuthContextValue>(
    () => ({
      isOwnerLoggedIn,
      ownerAuthReady,
      ownerStoreId,
      ownerLogin,
      ownerSignup,
      ownerLoginWithSocialCode,
      ownerLogout,
      ownerAuthLoading,
    }),
    [isOwnerLoggedIn, ownerAuthReady, ownerStoreId, ownerAuthLoading]
  );

  return (
    <OwnerAuthContext.Provider value={value}>
      {children}
    </OwnerAuthContext.Provider>
  );
}

export function useOwnerAuth() {
  const ctx = useContext(OwnerAuthContext);
  if (!ctx)
    throw new Error("useOwnerAuth must be used within OwnerAuthProvider");
  return ctx;
}
