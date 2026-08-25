"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { type Cafe } from "@/lib/data";
import { useStores } from "@/lib/stores-store";
import { useAuth } from "@/lib/auth-store";
import {
  apiFavoriteStore,
  apiUnfavoriteStore,
  apiGetMyFavoriteStoreIds,
  isApiConfigured,
} from "@/lib/api";

type WishlistContextValue = {
  /** 카페 상세/검색/찜 목록에서 공통으로 쓰는 "찜 여부가 반영된" 전체 카페 목록 */
  cafes: Cafe[];
  isLiked: (cafeId: string) => boolean;
  toggleLike: (cafeId: string) => void;
  /** 로그인은 돼 있는데(isLoggedIn=true) 서버에서 찜 목록을 못 받아왔을 때 true.
   * "같은 계정인데 이 기기/주소에서는 찜한 카페가 안 보인다"는 문제를 조사할 때,
   * 화면에서 "0개라서 진짜 안 보이는 건지" "애초에 못 불러온 건지"를 구분할 수
   * 있게 해요. */
  favoritesLoadFailed: boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

/**
 * 찜(하트) 상태를 앱 전체에서 공유하는 컨텍스트.
 * 예전에는 카페 상세 / 검색 / 찜 목록 화면이 각자 자기만의 로컬 state로
 * liked 값을 들고 있어서, 한 화면에서 하트를 눌러도 다른 화면엔 반영이
 * 안 됐어요. 이제 이 store 하나만 liked 상태의 "진짜 출처(source of truth)"로
 * 쓰고, 나머지 화면들은 여기서 읽고 여기로만 토글해요.
 *
 * 백엔드 연동: NEXT_PUBLIC_API_BASE_URL이 설정돼 있으면 화면이 열릴 때
 * GET /api/users/me/favorites 로 실제 찜 목록을 불러와서 초기 상태에 반영하고,
 * 하트를 누를 때마다 POST/DELETE /api/stores/{store}/favorite 을 호출해요.
 * 요청이 실패해도(비로그인, 네트워크 오류 등) 화면의 하트는 낙관적으로 토글된
 * 상태를 유지해서 사용성이 끊기지 않게 했어요.
 *
 * ⚠️ 카페 목록 자체은 여기서 만들지 않고 useStores()(stores-store.tsx)에서 그대로
 * 가져와요. 예전에는 이 파일이 data.ts의 mock 카페 4개를 직접 들고 있어서,
 * 실제 등록된 매장이 없어도(검색 결과가 비어 있어야 하는 상황에도) 항상 그
 * mock 데이터가 화면에 나오는 문제가 있었어요(검색어를 지웠을 때 특히 눈에 띔).
 */
export function WishlistProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { cafes: storeCafes } = useStores();
  const { isLoggedIn } = useAuth();
  const [likedIds, setLikedIds] = useState<Set<string>>(
    () => new Set(storeCafes.filter((c) => c.liked).map((c) => c.id))
  );
  const [favoritesLoadFailed, setFavoritesLoadFailed] = useState(false);

  // ⚠️ 예전엔 이 useEffect가 컴포넌트가 처음 마운트될 때 딱 한 번만
  // 실행됐어요(deps: []). 그래서 로그인 상태로 찜 목록을 불러온 뒤 로그아웃해도
  // likedIds(하트가 채워진 카페 id 목록)가 그대로 남아서, 로그아웃한 채로
  // 같은 카페를 봐도(심지어 완전히 다른 사람이 같은 기기로 로그인해도) 예전
  // 계정이 찜했던 하트가 계속 채워진 채로 보이는 문제가 있었어요. 이제
  // isLoggedIn이 바뀔 때마다(로그인/로그아웃/계정 전환) 다시 실행돼요:
  // 로그아웃 상태면 즉시 likedIds를 비우고, 로그인 상태면 그 계정의 실제
  // 찜 목록을 서버에서 새로 받아와요.
  useEffect(() => {
    if (!isLoggedIn) {
      setLikedIds(new Set());
      setFavoritesLoadFailed(false);
      return;
    }
    if (!isApiConfigured()) return;
    let cancelled = false;
    // ⚠️ "localhost에서는 찜한 카페가 뜨는데 다른 주소(예: 192.168.x.x)로
    // 들어가면 안 보인다"는 문제 조사용: 로그인 토큰은 브라우저 localStorage에
    // 저장되는데, 이건 주소(origin)마다 완전히 분리된 저장소예요. 즉
    // localhost:3000과 192.168.x.x:3000은 브라우저 입장에서는 "다른 사이트"라서,
    // 같은 계정으로 로그인했더라도 이 기기·이 주소에서 실제로 로그인 토큰이
    // 정상 저장돼 있는지부터 다시 확인이 필요해요. 예전엔 ids가 null이면(=요청
    // 실패, 대부분 401/토큰 문제) 조용히 무시하고 넘어가서 "찜한 카페가 없어요"
    // 빈 화면과 "불러오길 실패했어요"를 구분할 수 없었어요. 이제 실패를 따로
    // 기록해서 화면(찜 목록 페이지)이 서로 다른 안내를 보여줄 수 있게 해요.
    apiGetMyFavoriteStoreIds().then((ids) => {
      if (cancelled) return;
      if (!ids) {
        setFavoritesLoadFailed(true);
        return;
      }
      setFavoritesLoadFailed(false);
      setLikedIds(new Set(ids));
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const toggleLike = (cafeId: string) => {
    // 찜하기는 회원만 할 수 있는 행동이에요(지도/카페 상세는 비로그인으로도 볼 수
    // 있지만, 하트를 누르는 순간은 로그인이 필요해요). 예전엔 여기서 로그인
    // 여부를 확인하지 않아서, 비로그인 상태에서 눌러도 화면에서는 하트가
    // 낙관적으로 채워졌다가(실제 서버 저장은 401로 실패) 다음 새로고침에만
    // 조용히 사라졌어요. 이제 비로그인이면 앱 공통 로그인 안내 화면(/reserve)으로
    // 안내해요. 카페 상세에서만 곧바로 로그인 폼으로 이동하면 다른 보호 기능과
    // 경험이 달라지고, 회원가입 선택지도 놓치기 쉬워요.
    if (!isLoggedIn) {
      router.push("/reserve");
      return;
    }
    const willLike = !likedIds.has(cafeId);

    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cafeId)) {
        next.delete(cafeId);
      } else {
        next.add(cafeId);
      }
      return next;
    });

    if (isApiConfigured()) {
      const request = willLike ? apiFavoriteStore(cafeId) : apiUnfavoriteStore(cafeId);
      request.then((success) => {
        if (success) return;
        // 서버 반영에 실패하면 화면 상태를 원래대로 되돌려요.
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (willLike) next.delete(cafeId);
          else next.add(cafeId);
          return next;
        });
      });
    }
  };

  const value = useMemo<WishlistContextValue>(() => {
    const cafes = storeCafes.map((c) => ({ ...c, liked: likedIds.has(c.id) }));
    return {
      cafes,
      isLiked: (cafeId: string) => likedIds.has(cafeId),
      toggleLike,
      favoritesLoadFailed,
    };
  }, [storeCafes, likedIds, favoritesLoadFailed]);

  return (
    <WishlistContext.Provider value={value}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
