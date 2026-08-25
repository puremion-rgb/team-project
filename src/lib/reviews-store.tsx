"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Review } from "@/lib/data";
import {
  apiCreateReview,
  apiUpdateReview,
  apiDeleteReview,
  apiGetMyReviews,
  extractReviewImageUrls,
  isApiConfigured,
  type MyApiReview,
} from "@/lib/api";

type ReviewsContextValue = {
  reviews: Review[];
  getReview: (id: string) => Review | undefined;
  /** 특정 주문에 이미 남긴 리뷰가 있으면 돌려줘요. 주문 상세 화면이 "리뷰
   * 남기기"와 "내가 남긴 리뷰 보기·수정" 버튼 중 뭘 보여줄지 여기로 판단해요. */
  getReviewByOrderId: (orderId: string) => Review | undefined;
  addReview: (input: {
    cafeId: string;
    cafeName: string;
    rating: number;
    content: string;
    /** 리뷰 작성 화면에서 이미 POST /api/uploads/images로 업로드해 받은 실제
     * 이미지 URL들. (서버의 리뷰 생성 API는 이미지 필드를 문서화하고 있지 않아서,
     * 카페 상세 "사진" 탭에서 쓸 수 있도록 이 기기에 함께 저장해둬요.) */
    images?: string[];
    /** 이 리뷰가 인증하는 완료된 주문의 id. 있으면 서버에 order_id로 함께
     * 보내서, "실제로 주문한 손님만 리뷰를 남긴다"는 걸 서버도 알 수 있어요. */
    orderId?: string;
    /** 리뷰를 쓰는 지금 이 순간의 내 프로필 닉네임. 카페 상세 화면이 "방금
     * 쓴 내 리뷰"를 서버 목록을 기다리는 동안에도 곧바로 실제 이름으로
     * 보여줄 수 있도록, 매번 새로 계산하지 않고 리뷰에 그대로 저장해둬요. */
    authorName?: string;
  }) => void;
  updateReview: (
    id: string,
    patch: { rating: number; content: string; images?: string[] }
  ) => void;
  removeReview: (id: string) => void;
};

const ReviewsContext = createContext<ReviewsContextValue | null>(null);

const REVIEWS_STORAGE_KEY = "cafeon_my_reviews";

function readReviewsStorage(): Review[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REVIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Review[]) : [];
  } catch {
    return [];
  }
}

function writeReviewsStorage(reviews: Review[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
  } catch {
    // 시크릿 모드 등 localStorage를 못 쓰는 환경이면 조용히 무시해요.
  }
}

/** 서버가 실제로 만들어준 리뷰 id인지(=숫자) 판별해요. 서버 id가 있어야
 * PUT/DELETE /api/reviews/{review}로 수정·삭제가 가능해요. 이 앱에서 직접
 * 등록한 게 아닌 리뷰(로컬 임시 id, 예: "r-1734...")는 화면에만 있는 상태예요. */
function isServerReviewId(id: string): boolean {
  return /^\d+$/.test(id);
}

/** 서버 리뷰(user_id로 이미 "내 리뷰"임이 확인된 것)를 화면이 쓰는 Review
 * 모양으로 바꿔요. created_at("2026-08-21T09:00:00Z" 등)을 화면 표기 형식
 * ("2026.08.21")으로 바꾸고, images는 URL 문자열 배열로 펼쳐요. */
function fromApiReview(r: MyApiReview): Review {
  const created = r.created_at ? new Date(r.created_at) : null;
  const date =
    created && !Number.isNaN(created.getTime())
      ? `${created.getFullYear()}.${String(created.getMonth() + 1).padStart(2, "0")}.${String(
          created.getDate()
        ).padStart(2, "0")}`
      : "";
  return {
    id: String(r.id),
    cafeId: String(r.store_id),
    cafeName: r.store_name ?? "카페",
    rating: r.rating,
    content: r.content,
    date,
    images: extractReviewImageUrls(r.images),
    // ⚠️ 서버 리뷰 목록 응답엔 이 리뷰가 어느 주문을 인증으로 썼는지가 안 내려와서
    // orderId는 비워둬요. "이미 리뷰를 남긴 주문인지" 판단은 지금 세션에서 직접
    // 작성한 리뷰(orderId 있음)에 한해서만 동작해요.
  };
}

/**
 * 손님이 작성한 리뷰 목록을 관리하는 컨텍스트.
 * 리뷰 관리 목록(/my/reviews)과 작성/수정 화면(/my/reviews/write)이
 * 같은 데이터를 공유해서, 실제로 "수정"이 반영되도록 해요.
 *
 * ⚠️ api-docs.json 스웨거에는 "내가 쓴 리뷰 목록 전체 조회" 전용 API가 없어요
 * (GET /api/stores/{store}/reviews처럼 매장 단위 조회만 있어요). 그래서 화면이
 * 뜰 때는 일단 이 기기의 로컬 캐시(localStorage)로 먼저 보여준 뒤, 곧바로
 * apiGetMyReviews()(내가 주문한 매장들의 리뷰를 모아 내 user_id로 걸러낸 결과)로
 * 다시 채워요. 이렇게 서버 기준으로 다시 채우기 전에는, 같은 계정이라도
 * localhost/IP 등 접속 주소가 다르면(=localStorage가 서로 다른 저장공간이라)
 * 리뷰가 안 보이는 문제가 있었어요. 새로 작성한 리뷰는 즉시 화면에 반영하고
 * 뒤에서 POST /api/stores/{store}/reviews로 서버 등록도 시도해요(성공하면 서버가
 * 준 진짜 id로 교체돼서 이후 수정·삭제도 서버에 반영돼요). 백엔드에 전용
 * "내 리뷰 목록" API가 추가되면 apiGetMyReviews() 내부만 바꾸면 돼요.
 */
export function ReviewsProvider({ children }: { children: ReactNode }) {
  const [reviews, setReviews] = useState<Review[]>(() => readReviewsStorage());

  const persist = (next: Review[]) => {
    writeReviewsStorage(next);
    return next;
  };

  // 화면이 뜰 때 서버 기준 "내 리뷰"를 불러와서 목록을 맞춰요. 이러면
  // localhost/IP 등 접속 주소나 기기가 달라도(=localStorage가 비어 있어도)
  // 같은 계정이면 항상 같은 리뷰가 보여요. 아직 서버에 안 올라간(방금 작성해서
  // 서버 응답을 기다리는 중인) 로컬 임시 항목은 그대로 앞에 남겨둬요.
  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    void apiGetMyReviews().then((serverReviews) => {
      if (cancelled || !serverReviews) return;
      const mapped = serverReviews.map(fromApiReview);
      setReviews((prev) => {
        const localOnly = prev.filter((r) => !isServerReviewId(r.id));
        return persist([...localOnly, ...mapped]);
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ReviewsContextValue>(
    () => ({
      reviews,
      getReview: (id) => reviews.find((r) => r.id === id),
      getReviewByOrderId: (orderId) => reviews.find((r) => r.orderId === orderId),
      addReview: ({ cafeId, cafeName, rating, content, images, orderId, authorName }) => {
        const now = new Date();
        const date = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(
          now.getDate()
        ).padStart(2, "0")}`;
        const localId = `r-${Date.now()}`;
        setReviews((prev) =>
          persist([
            { id: localId, cafeId, cafeName, rating, content, date, images, orderId, authorName },
            ...prev,
          ])
        );

        if (!isApiConfigured()) return;
        const orderIdNum = orderId && /^\d+$/.test(orderId) ? Number(orderId) : undefined;
        // ⚠️ images를 서버로도 함께 보내요. 안 보내면 이 기기(이 브라우저+주소)의
        // 로컬 저장소에만 사진이 남아서, 다른 손님은 물론 같은 사람이라도 다른
        // 주소(예: localhost 대신 IP)로 접속하면 사진이 아예 안 보여요.
        void apiCreateReview(cafeId, {
          rating,
          content,
          order_id: orderIdNum,
          images: images && images.length > 0 ? images : undefined,
        }).then((created) => {
          if (!created) return;
          // 서버가 실제로 발급해준 id로 바꿔서, 이후 수정·삭제가 서버에도 반영되게 해요.
          setReviews((prev) =>
            persist(prev.map((r) => (r.id === localId ? { ...r, id: String(created.id) } : r)))
          );
        });
      },
      updateReview: (id, patch) => {
        setReviews((prev) => persist(prev.map((r) => (r.id === id ? { ...r, ...patch } : r))));
        if (isApiConfigured() && isServerReviewId(id)) {
          // images도 함께 보내요(서버가 이 필드를 지원하면 다른 기기·다른 손님도
          // 수정된 사진을 볼 수 있어요. 지원하지 않으면 서버가 조용히 무시해요).
          void apiUpdateReview(id, {
            rating: patch.rating,
            content: patch.content,
            images: patch.images && patch.images.length > 0 ? patch.images : undefined,
          });
        }
      },
      removeReview: (id) => {
        setReviews((prev) => persist(prev.filter((r) => r.id !== id)));
        if (isApiConfigured() && isServerReviewId(id)) {
          void apiDeleteReview(id);
        }
      },
    }),
    [reviews]
  );

  return (
    <ReviewsContext.Provider value={value}>
      {children}
    </ReviewsContext.Provider>
  );
}

export function useReviews() {
  const ctx = useContext(ReviewsContext);
  if (!ctx) throw new Error("useReviews must be used within ReviewsProvider");
  return ctx;
}
