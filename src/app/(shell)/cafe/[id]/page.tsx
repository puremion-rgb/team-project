"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Navigation,
  Share2,
  Star,
  X,
} from "lucide-react";
import ImagePlaceholder from "@/components/ImagePlaceholder";
import StatusBadge from "@/components/StatusBadge";
import AmenityIcon from "@/components/AmenityIcon";
import StarRating from "@/components/StarRating";
import { useReviews } from "@/lib/reviews-store";
import { useWishlist } from "@/lib/wishlist-store";
import { useStores } from "@/lib/stores-store";
import { useAuth } from "@/lib/auth-store";
import {
  apiGetStoreMenus,
  apiGetStoreReviews,
  isApiConfigured,
  resolveImageUrl,
  extractReplyContent,
  extractReviewImageUrls,
  reviewerDisplayName,
  type ApiMenu,
  type ApiReview,
} from "@/lib/api";
import { useCart } from "@/lib/cart-store";

/** 화면에 보여줄 리뷰 한 건. 서버 리뷰(모든 손님이 씀)와 이 기기에 남아있는
 * 로컬 리뷰(방금 등록해서 아직 서버 목록에 안 잡혔을 수 있는 내 리뷰)를
 * 합쳐서 같은 모양으로 다뤄요. */
type DisplayReview = {
  id: string;
  rating: number;
  content: string;
  date: string;
  reply: string | null;
  images: string[];
  // ⚠️ "일반 카페 리뷰도 누가 쓴지 확인이 안 된다"는 문제 대응: 서버 리뷰는
  // reviewerDisplayName(이름을 못 찾으면 "손님 #123")으로 채우고, 아직 서버
  // 목록에 안 잡힌 내 로컬 리뷰는 내 프로필 이름(없으면 "나")으로 표시해요.
  reviewerName: string;
};

export default function CafeDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const cart = useCart();
  // 이 화면(/cafe/[id])은 비로그인 상태로도 볼 수 있어요(auth-store.ts의
  // isPublicPath 참고). 하지만 찜하기/장바구니 담기는 회원만 가능한 행동이라,
  // 비로그인 상태에서 눌렀을 땐 로그인 화면으로 안내해요.
  const { isLoggedIn, profile } = useAuth();
  // ⚠️ 예전엔 @/lib/data의 하드코딩된 mock 카페(getCafe)만 참조해서, 지도/검색에서
  // 실제 서버 매장(id가 mock 목록에 없는 숫자 id)을 눌러 들어오면 화면이 늘 같은
  // mock 카페("온기 로스터스")로 대체돼서 보였어요. 이제 useStores()(실제
  // GET /api/stores 결과)에서 실제 매장을 찾아요.
  const { getCafe, refreshCafe } = useStores();
  const cafe = getCafe(params.id);

  useEffect(() => {
    refreshCafe(params.id);
    // 이 화면을 보고 있는 동안엔(=사장님이 지금 좌석을 바꾸고 있을 수도 있는
    // 시점) stores-store의 전역 폴링(15초)보다 조금 더 자주 이 매장만 다시
    // 불러와서, 잔여 좌석 수가 화면에 뜬 채로 최대한 빨리 갱신되게 해요.
    const interval = setInterval(() => refreshCafe(params.id), 8000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const [menu, setMenu] = useState<ApiMenu[] | null>(null);
  useEffect(() => {
    if (!isApiConfigured()) return;
    let cancelled = false;
    apiGetStoreMenus(params.id).then((rows) => {
      if (!cancelled) setMenu(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const [tab, setTab] = useState<"메뉴" | "리뷰" | "사진">("메뉴");
  const { isLiked, toggleLike } = useWishlist();
  const cafeId = cafe?.id ?? params.id;
  const liked = isLiked(cafeId);

  // ⚠️ 예전엔 이 "리뷰" 탭이 reviews-store(이 기기에서 이 앱으로 작성한 리뷰
  // 캐시)만 보고 있었어요. 그래서 (1) 다른 손님이 쓴 리뷰는 전혀 안 보이고,
  // (2) 카페 상세 상단 "리뷰 0" 배지·탭 숫자는 항상 cafe.reviewCount(서버가
  // 아직 안 내려주는 값이라 고정 0)를 써서 실제로 리뷰를 등록해도 계속 0으로
  // 보였어요. 이제 GET /api/stores/{store}/reviews로 이 매장에 달린 진짜 리뷰
  // 전체를 불러와서 개수·평균 별점·목록을 모두 여기서 직접 계산해요.
  const { reviews: myLocalReviews } = useReviews();
  const myCafeReviews = myLocalReviews.filter((r) => r.cafeId === cafeId);

  const [serverReviews, setServerReviews] = useState<ApiReview[] | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  useEffect(() => {
    if (!isApiConfigured()) {
      setServerReviews(null);
      return;
    }
    let cancelled = false;
    setReviewsLoading(true);
    apiGetStoreReviews(cafeId).then((rows) => {
      if (cancelled) return;
      setServerReviews(rows);
      setReviewsLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cafeId]);

  const displayReviews = useMemo<DisplayReview[]>(() => {
    const localById = new Map(myCafeReviews.map((r) => [r.id, r]));
    const serverIds = new Set((serverReviews ?? []).map((r) => String(r.id)));

    const fromServer: DisplayReview[] = (serverReviews ?? []).map((r) => {
      const localMatch = localById.get(String(r.id));
      return {
        id: String(r.id),
        rating: r.rating,
        content: r.content,
        date: r.created_at ? r.created_at.slice(0, 10).replace(/-/g, ".") : (localMatch?.date ?? ""),
        // ⚠️ r.reply는 문자열이 아니라 {id, review_id, author_id, content,
        // created_at, updated_at, author} 객체로 내려와요. 객체를 그대로
        // 렌더링하면 "Objects are not valid as a React child" 런타임 에러가
        // 나서, 반드시 extractReplyContent로 답글 본문 문자열만 꺼내요.
        reply: extractReplyContent(r.reply),
        // ⚠️ r.images는 문자열 배열이 아니라 {id, review_id, image_url,
        // alt_text, sort_order} 객체 배열로 내려와요. extractReviewImageUrls로
        // 실제 사진 URL 문자열만 꺼내요. 서버가 아직 이 리뷰의 사진을 못
        // 내려주는 경우(구버전 응답 등)엔 이 기기에 남아있는 내 리뷰의 로컬
        // 업로드 사진으로 대신 보여줘요.
        images:
          localMatch?.images && localMatch.images.length > 0
            ? localMatch.images
            : extractReviewImageUrls(r.images),
        reviewerName: reviewerDisplayName(r),
      };
    });

    // 방금 등록해서 아직 서버 목록에 안 잡힌(=폴링 지연) 내 리뷰만 추가해요.
    // ⚠️ 예전엔 여기서 무조건 "나"로 표시하다가, 잠시 뒤 서버 목록이 이 리뷰를
    // 따라잡으면(fromServer로 넘어가면) 그제서야 reviewerDisplayName이 계산해준
    // 실제 닉네임으로 바뀌었어요. 그 다음엔 로그인한 내 프로필 이름(profile.name)을
    // 바로 쓰도록 고쳤지만, profile.name 자체가 로그인 직후엔 비어있다가 서버
    // GET /api/users/me 응답이 오고 나서야(몇 초 걸릴 수 있음) 채워지는
    // 타이밍이라, 여전히 "나"로 잠깐 보였다가 이름으로 바뀌는 문제가 남아있었어요.
    // 이제 리뷰를 쓸 때 그 순간의 닉네임을 리뷰 자체(r.authorName)에 저장해두고,
    // 그 값을 최우선으로 써요 — 그러면 실시간 profile.name이 아직 로딩 중이어도
    // 처음부터 바로 맞는 이름이 보여요. (이 필드가 없는 옛날 로컬 리뷰만 예전처럼
    // profile.name → "나" 순서로 대체해요.)
    const myDisplayName = profile.name.trim().length > 0 ? profile.name : "나";
    const localOnly: DisplayReview[] = myCafeReviews
      .filter((r) => !serverIds.has(r.id))
      .map((r) => ({
        id: r.id,
        rating: r.rating,
        content: r.content,
        date: r.date,
        reply: null,
        images: r.images ?? [],
        reviewerName:
          r.authorName && r.authorName.trim().length > 0 ? r.authorName : myDisplayName,
      }));

    return [...fromServer, ...localOnly].sort((a, b) => b.date.localeCompare(a.date));
  }, [serverReviews, myCafeReviews, profile.name]);

  // API 연동이 아직 안 됐거나(개발 초기) 응답을 못 받아온 동안에는 이 기기의
  // 로컬 리뷰 개수로라도 보여줘서 화면이 항상 "0"으로 굳어 보이지 않게 해요.
  const reviewCount = serverReviews !== null ? displayReviews.length : myCafeReviews.length;
  const avgRating =
    displayReviews.length > 0
      ? Math.round(
          (displayReviews.reduce((sum, r) => sum + r.rating, 0) / displayReviews.length) * 10,
        ) / 10
      : 0;

  const cafePhotos = displayReviews.flatMap((r) => r.images);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ⚠️ 예전엔 상단 캐러셀이 매장 대표 이미지 + 손님 리뷰 사진들을 이어붙여서
  // 보여줬어요. 그런데 사장님이 프로필에 등록한 사진이 아닌 손님이 남긴 리뷰
  // 사진까지 대표 캐러셀에 섞여 보이는 게 어색해서, 이제 매장 대표 이미지
  // 하나만 보여줘요(리뷰 사진은 "사진" 탭에서만 보여요).
  const heroSlides = useMemo(() => {
    return cafe?.imageUrl ? [cafe.imageUrl] : [];
  }, [cafe?.imageUrl]);
  const [heroIndex, setHeroIndex] = useState(0);
  useEffect(() => {
    if (heroIndex >= heroSlides.length) setHeroIndex(0);
  }, [heroSlides.length, heroIndex]);

  const [tagsExpanded, setTagsExpanded] = useState(false);
  // ⚠️ "태그 4개인데 왜 접혀서 나오냐(펼치면 한 줄에 다 들어가는데)"라는 문제의
  // 원인: 예전엔 태그가 4개보다 많으면 무조건 앞 4개만 보여주고 나머지를
  // 접어버렸어요(개수만 보고 판단). 그런데 태그 글자 길이가 짧으면 5개, 6개도
  // 실제로는 한 줄에 다 들어가는데도 똑같이 접혀서, 펼쳐보면 "어차피 한 줄에
  // 다 들어가는데 왜 접었지?"처럼 보였어요. 이제는 개수 대신 "실제로 한 줄
  // 폭을 넘치는지"를 직접 측정해서, 진짜로 넘칠 때만 더보기 버튼을 보여줘요.
  const tagsRowRef = useRef<HTMLDivElement>(null);
  const [tagsOverflow, setTagsOverflow] = useState(false);
  const [tagsLineHeight, setTagsLineHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = tagsRowRef.current;
    if (!el || !cafe?.tags || cafe.tags.length === 0) return;
    const measure = () => {
      const firstChild = el.firstElementChild as HTMLElement | null;
      const lineHeight = firstChild?.getBoundingClientRect().height ?? 0;
      if (lineHeight > 0) setTagsLineHeight(lineHeight);
      // scrollHeight가 한 줄 높이보다 눈에 띄게 크면(줄바꿈 발생) 실제로 넘친 것.
      setTagsOverflow(lineHeight > 0 && el.scrollHeight > lineHeight * 1.5);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [cafe?.tags]);

  const handleShare = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: cafe?.name, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  // 서버에서 아직 목록을 못 받아왔거나(로딩 중) 존재하지 않는 id면 안내만 보여줘요.
  // (예전처럼 엉뚱한 mock 카페로 조용히 대체하지 않아요.)
  if (!cafe) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-[15px] text-ink-secondary">
          카페 정보를 불러오는 중이거나, 존재하지 않는 카페예요.
        </p>
        <button
          onClick={() => router.back()}
          className="text-[14px] font-bold text-brand"
        >
          뒤로가기
        </button>
      </div>
    );
  }

  // ⚠️ 예전엔 서버 메뉴가 비어있으면 data.ts의 가짜(mock) 메뉴(아메리카노/카페라떼 등)로
  // 화면을 채웠어요. 그래서 사장님이 실제로 메뉴를 하나도 등록하지 않았거나, 서버
  // 저장이 실패한 매장도 마치 메뉴가 있는 것처럼 손님에게 보여서 혼란을 줬어요.
  // 이제 서버가 준 실제 메뉴만 쓰고, 없으면 빈/로딩 상태를 그대로 보여줘요.
  const menuLoading = isApiConfigured() && menu === null;
  const menuItems = (menu ?? []).map((m) => ({
    id: String(m.id),
    name: m.name,
    price: Math.round(Number(m.price)),
    // 사장님이 메뉴 등록 시 올린 사진(image_url)을 그대로 써요. 상대경로면
    // resolveImageUrl이 API 서버 절대주소로 바꿔줘요(없으면 회색 플레이스홀더로
    // 자동 폴백).
    imageUrl: resolveImageUrl(m.image_url),
  }));

  const handleAddToCart = (m: { id: string; name: string; price: number }) => {
    // ⚠️ 예전엔 비로그인 상태로 "담기"를 누르면 곧장 /login(로그인 입력 폼)으로
    // 보냈는데, "예약하기"를 누를 때는 다른 화면이 떠요 — /reserve/new는
    // isPublicPath에 없어서 AuthGate가 가로채 "로그인이 필요해요" 안내 화면을
    // 보여줘요(로그인/회원가입 버튼 + 나중에 할게요). 두 버튼의 비로그인 경험이
    // 서로 달라서 어색했어요. 장바구니(/order/cart)도 이미 isPublicPath에
    // 없으므로, 여기로 보내면 AuthGate가 예약하기와 똑같은 "로그인이 필요해요"
    // 화면을 띄워줘요 — 굳이 로그인 폼으로 직행시키지 않아도 돼요.
    if (!isLoggedIn) {
      router.push("/order/cart");
      return;
    }
    cart.addItem(cafe.id, cafe.name, m);
  };

  return (
    <div className="flex min-h-full flex-col">
      <div className="relative">
        {heroSlides.length > 0 ? (
          <div
            className="flex h-64 w-full snap-x snap-mandatory overflow-x-auto"
            onScroll={(e) => {
              const el = e.currentTarget;
              const i = Math.round(el.scrollLeft / el.clientWidth);
              if (i !== heroIndex) setHeroIndex(i);
            }}
          >
            {heroSlides.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${src}-${i}`}
                src={src}
                alt={`${cafe.name} 사진 ${i + 1}`}
                className="h-64 w-full shrink-0 snap-center bg-[#DDD9CC] object-cover"
              />
            ))}
          </div>
        ) : (
          <ImagePlaceholder
            rounded="rounded-none"
            className="h-64 w-full"
            iconSize={30}
            src={null}
            alt={cafe.name}
          />
        )}

        <button
          aria-label="뒤로가기"
          onClick={() => router.back()}
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink"
        >
          <ChevronLeft size={22} />
        </button>

        <div className="absolute right-4 top-4 flex items-center gap-2">
          <button
            aria-label="찜하기"
            onClick={() => toggleLike(cafe.id)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90"
          >
            <Heart
              size={18}
              className={liked ? "fill-brand text-brand" : "text-ink"}
              strokeWidth={1.8}
            />
          </button>
          {/* ⚠️ 예전엔 여기가 점 세개(더보기) 버튼이었고, 눌러야 나오는 메뉴
              안에 "공유하기" 하나만 들어있었어요. 항목이 하나뿐이라 한 번 더
              누르게 만들 이유가 없어서, 바로 공유하기 아이콘 버튼으로 바꿨어요. */}
          <button
            aria-label="공유하기"
            onClick={handleShare}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink"
          >
            <Share2 size={16} strokeWidth={1.8} />
          </button>
        </div>

        {heroSlides.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white">
            {heroIndex + 1} / {heroSlides.length}
          </span>
        )}
      </div>

      <div className="px-6 pt-5">
        <div className="flex items-start justify-between">
          <h1 className="text-[22px] font-bold text-ink">{cafe.name}</h1>
          <p className="flex items-center gap-1 text-[13.5px] font-bold text-ink-secondary">
            <Star size={14} className="fill-amber text-amber" />
            {avgRating} ({reviewCount})
          </p>
        </div>

        {cafe.description && (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">
            {cafe.description}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={cafe.status} filled={cafe.seatsFilled} total={cafe.seatsTotal} />
            <span className="text-[12.5px] text-ink-muted">{cafe.updatedAgo}</span>
          </div>
          {/* 하단의 큰 "길찾기/메뉴 보고 주문하기" 버튼 두 개를 없애면서, 길찾기는
              여기 상태 배지 옆 작은 pill 버튼으로 옮겨왔어요. */}
          <Link
            href={`/cafe/${cafe.id}/route`}
            aria-label="길찾기"
            className="flex shrink-0 items-center gap-1 rounded-full bg-brand px-3 py-1.5 text-[12.5px] font-bold text-white"
          >
            <Navigation size={12} />
            길찾기
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2.5">
          {cafe.amenities.map((a) => (
            <AmenityIcon key={a} type={a} />
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 text-[14px] text-ink-secondary">
          <p>📍 {cafe.address}</p>
          <p>🕐 평일 {cafe.hours}</p>
        </div>

        {/* 사장님이 매장 프로필에서 지정한 태그. amenities 아이콘과 달리 커스텀
            태그까지 이름 그대로 보여줘요(없으면 아예 표시 안 함). 태그 전체가
            한 줄 폭을 실제로 넘칠 때만 접어두고 화살표로 펼칠 수 있게 해요. */}
        {cafe.tags && cafe.tags.length > 0 && (
          <div className="mt-4 flex items-start gap-1.5">
            <div
              ref={tagsRowRef}
              style={
                !tagsExpanded && tagsOverflow && tagsLineHeight
                  ? { maxHeight: tagsLineHeight, overflow: "hidden" }
                  : undefined
              }
              className="flex flex-1 flex-wrap items-center gap-1.5"
            >
              {cafe.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-cream px-3 py-1 text-[12.5px] font-medium text-ink-secondary"
                >
                  #{tag}
                </span>
              ))}
            </div>
            {tagsOverflow && (
              <button
                aria-label={tagsExpanded ? "태그 접기" : "태그 더보기"}
                onClick={() => setTagsExpanded((v) => !v)}
                className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-muted"
              >
                <ChevronDown
                  size={16}
                  className={tagsExpanded ? "rotate-180 transition-transform" : "transition-transform"}
                />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 flex border-b border-border px-6">
        {(["메뉴", "리뷰", "사진"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              "flex-1 border-b-2 py-3 text-[15px] font-bold " +
              (tab === t ? "border-brand text-brand" : "border-transparent text-ink-muted")
            }
          >
            {t === "리뷰" ? `리뷰 ${reviewCount}` : t === "사진" ? `사진 ${cafePhotos.length}` : t}
          </button>
        ))}
      </div>

      {tab === "메뉴" && (
        <div className="px-6 pb-6 pt-4">
          {menuLoading ? (
            <p className="mt-8 text-center text-[14px] text-ink-muted">메뉴를 불러오는 중이에요...</p>
          ) : menuItems.length === 0 ? (
            <p className="mt-8 text-center text-[14px] text-ink-muted">
              아직 등록된 메뉴가 없어요.
            </p>
          ) : (
          <div className="flex flex-col gap-4">
            {menuItems.map((m) => (
              <div key={m.id} className="flex items-center gap-4">
                <ImagePlaceholder
                  className="h-14 w-14 shrink-0"
                  rounded="rounded-full"
                  iconSize={16}
                  src={m.imageUrl}
                  alt={m.name}
                />
                <div className="flex-1">
                  <p className="text-[15px] text-ink">{m.name}</p>
                  <p className="mt-0.5 text-[14px] font-bold text-ink">
                    {m.price.toLocaleString()}원
                  </p>
                </div>
                <button
                  onClick={() => handleAddToCart(m)}
                  className="flex h-9 items-center rounded-full border border-brand px-4 text-[13px] font-bold text-brand"
                >
                  담기
                </button>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {tab === "리뷰" && (
        // ⚠️ 예전엔 여기 "리뷰 작성하기" 버튼으로 아무나(실제로 주문/방문하지
        // 않은 손님도) 이 카페에 리뷰를 남길 수 있었어요. 이제 리뷰는 항상
        // 완료된 주문 하나를 인증으로 남겨야 해서(주문내역 > 주문 상세 >
        // 리뷰 남기기), 여기서는 작성 진입점 없이 리뷰만 보여줘요.
        <div className="flex flex-col gap-4 px-6 py-6">
          {reviewsLoading && displayReviews.length === 0 ? (
            <p className="mt-8 text-center text-[14px] text-ink-muted">
              리뷰를 불러오는 중이에요...
            </p>
          ) : displayReviews.length === 0 ? (
            <p className="mt-8 text-center text-[14px] text-ink-muted">
              아직 작성된 리뷰가 없어요.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {displayReviews.map((r) => (
                <div key={r.id} className="rounded-2xl border border-border bg-white p-5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-ink">{r.reviewerName}</span>
                    <span className="text-[12.5px] text-ink-muted">{r.date}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <StarRating rating={r.rating} />
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
                    {r.content}
                  </p>
                  {r.images.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {r.images.map((src, i) => {
                        const globalIndex = cafePhotos.indexOf(src);
                        return (
                          <button
                            key={`${src}-${i}`}
                            type="button"
                            onClick={() => setLightboxIndex(globalIndex >= 0 ? globalIndex : 0)}
                            className="shrink-0"
                          >
                            <ImagePlaceholder
                              className="h-16 w-16"
                              iconSize={14}
                              src={resolveImageUrl(src)}
                              alt={`리뷰 사진 ${i + 1}`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {/* 사장님이 답글을 남기면 손님 쪽 리뷰 화면에도 그대로 보여요. */}
                  {r.reply && (
                    <div className="mt-3 rounded-xl bg-cream p-3">
                      <p className="text-[12.5px] font-bold text-brand">사장님 답글</p>
                      <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">
                        {r.reply}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-[12.5px] text-ink-muted">
            이 카페에서 주문을 완료하면 주문내역에서 리뷰를 남길 수 있어요.
          </p>
        </div>
      )}

      {tab === "사진" && (
        // ⚠️ 예전엔 여기가 항상 회색 아이콘 6칸짜리 가짜 그리드였어요(리뷰 사진과
        // 전혀 연결이 안 돼 있었어요). 이제 이 카페에 달린 리뷰들에서 실제로 첨부된
        // 사진만 모아서 보여주고, 탭하면 크게 하나씩 볼 수 있어요.
        cafePhotos.length === 0 ? (
          <p className="mt-8 text-center text-[14px] text-ink-muted">
            아직 등록된 사진이 없어요. 리뷰에 사진을 첨부해보세요!
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 px-6 py-6">
            {cafePhotos.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                onClick={() => setLightboxIndex(i)}
                className="aspect-square"
              >
                <ImagePlaceholder
                  className="h-full w-full"
                  iconSize={16}
                  src={resolveImageUrl(src)}
                  alt={`${cafe.name} 리뷰 사진 ${i + 1}`}
                />
              </button>
            ))}
          </div>
        )
      )}

      {/* 사진 하나씩 크게 보기(라이트박스). 이전/다음으로 넘기고, 바깥이나 X를
          누르면 닫혀요. */}
      {lightboxIndex !== null && cafePhotos.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="text-[13px] font-bold text-white/80">
              {lightboxIndex + 1} / {cafePhotos.length}
            </span>
            <button
              aria-label="닫기"
              onClick={() => setLightboxIndex(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
            >
              <X size={20} />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4">
            {lightboxIndex > 0 && (
              <button
                aria-label="이전 사진"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i !== null ? i - 1 : i));
                }}
                className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveImageUrl(cafePhotos[lightboxIndex]) ?? cafePhotos[lightboxIndex]}
              alt={`리뷰 사진 ${lightboxIndex + 1}`}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[75vh] max-w-full rounded-xl object-contain"
            />
            {lightboxIndex < cafePhotos.length - 1 && (
              <button
                aria-label="다음 사진"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((i) => (i !== null ? i + 1 : i));
                }}
                className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white"
              >
                <ChevronRight size={22} />
              </button>
            )}
          </div>
        </div>
      )}

      {cart.cafeId === cafe.id && cart.totalCount > 0 && (
        <div className="sticky bottom-0 z-20 px-6 pb-6 pt-3">
          <Link
            href="/order/cart"
            className="flex h-14 w-full items-center justify-between rounded-2xl bg-brand px-5 text-[15px] font-bold text-white shadow-sheet"
          >
            <span>장바구니 {cart.totalCount}개</span>
            <span>{cart.subtotal.toLocaleString()}원 · 주문하기 ›</span>
          </Link>
        </div>
      )}

      <div className="pb-4" />
    </div>
  );
}
