export type SeatStatus = "여유" | "주의" | "혼잡";

export type Cafe = {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  distance: string;
  status: SeatStatus;
  seatsFilled: number;
  seatsTotal: number;
  isOpen: boolean;
  hours: string;
  address: string;
  /** 카카오맵에 표시할 실제 좌표 (위도/경도). 백엔드 연동 후에는 API에서
   * 받아온 store.latitude / store.longitude 값으로 대체하면 돼요. */
  lat: number;
  lng: number;
  updatedAgo: string;
  amenities: ("wifi" | "outlet" | "parking" | "pet")[];
  liked: boolean;
  /** 사장님이 매장 프로필에서 저장한 대표 이미지(썸네일) URL. 없으면(아직
   * 등록 안 한 매장) null이고, 화면에서는 ImagePlaceholder로 폴백해요. */
  imageUrl?: string | null;
  /** 사장님이 매장 프로필의 태그 관리에서 지정한 태그 이름 전체(예: "와이파이",
   * "24시간"). amenities는 그중 아이콘이 있는 몇 개(wifi/outlet/parking/pet)만
   * 골라낸 값이라, 사장님이 직접 붙인 커스텀 태그까지 보여주려면 이 필드를 써요. */
  tags?: string[];
  /** 매장 소개글(사장님이 매장 프로필에서 작성). 없으면 화면에서 그 영역을
   * 아예 숨겨요. */
  description?: string | null;
  /** 요일별 영업시간 전체(오늘 요일만 보여주는 hours와 달리, "영업시간 더보기"를
   * 눌렀을 때 전체 요일을 보여주는 데 써요). */
  businessHours?: {
    day_of_week: number;
    is_closed?: boolean;
    opening_time?: string | null;
    closing_time?: string | null;
  }[];
};

export const cafes: Cafe[] = [
  {
    id: "onki-roasters",
    name: "온기 로스터스",
    rating: 4.8,
    reviewCount: 132,
    distance: "120m",
    status: "여유",
    seatsFilled: 12,
    seatsTotal: 30,
    isOpen: true,
    hours: "08:00~22:00",
    address: "서울 강남구 테헤란로 123",
    lat: 37.4996,
    lng: 127.0334,
    updatedAgo: "1분 전 업데이트",
    amenities: ["wifi", "outlet", "parking", "pet"],
    liked: true,
  },
  {
    id: "brewfix",
    name: "브루픽스",
    rating: 4.8,
    reviewCount: 98,
    distance: "240m",
    status: "주의",
    seatsFilled: 18,
    seatsTotal: 30,
    isOpen: true,
    hours: "09:00~21:00",
    address: "서울 강남구 역삼로 45",
    lat: 37.5006,
    lng: 127.0365,
    updatedAgo: "2분 전 업데이트",
    amenities: ["wifi", "outlet"],
    liked: true,
  },
  {
    id: "terrarosa",
    name: "테라로사",
    rating: 4.8,
    reviewCount: 210,
    distance: "300m",
    status: "혼잡",
    seatsFilled: 28,
    seatsTotal: 30,
    isOpen: true,
    hours: "08:00~23:00",
    address: "서울 강남구 선릉로 88",
    lat: 37.5044,
    lng: 127.0479,
    updatedAgo: "3분 전 업데이트",
    amenities: ["wifi", "parking"],
    liked: true,
  },
  {
    id: "cafe-green",
    name: "카페 그린",
    rating: 4.8,
    reviewCount: 64,
    distance: "450m",
    status: "여유",
    seatsFilled: 8,
    seatsTotal: 30,
    isOpen: true,
    hours: "08:00~22:00",
    address: "서울 강남구 도곡로 12",
    lat: 37.4913,
    lng: 127.0344,
    updatedAgo: "5분 전 업데이트",
    amenities: ["wifi", "outlet", "pet"],
    liked: false,
  },
];

export function getCafe(id: string): Cafe | undefined {
  return cafes.find((c) => c.id === id);
}

export type MenuItem = {
  id: string;
  name: string;
  price: number;
  category: "대표 메뉴" | "커피" | "음료" | "디저트";
};

export const menuByCafe: Record<string, MenuItem[]> = {
  "onki-roasters": [
    { id: "americano", name: "아메리카노", price: 4500, category: "대표 메뉴" },
    { id: "latte", name: "카페라떼", price: 5000, category: "대표 메뉴" },
    { id: "flat-white", name: "플랫화이트", price: 5500, category: "커피" },
    { id: "citron-tea", name: "유자차", price: 5500, category: "음료" },
    { id: "cheesecake", name: "바스크 치즈케이크", price: 6500, category: "디저트" },
  ],
};

export type Review = {
  id: string;
  cafeId: string;
  cafeName: string;
  rating: number;
  content: string;
  date: string;
  /** 리뷰에 첨부한 사진들의 실제 업로드 URL(POST /api/uploads/images 결과).
   * 카페 상세 화면의 "사진" 탭이 카페별 리뷰를 모아 이 이미지들을 보여줘요. */
  images?: string[];
  /** 이 리뷰가 어느 주문을 인증으로 남겨졌는지(주문내역 > 주문 상세 > 리뷰
   * 남기기). 방문하지 않은 손님이 임의로 리뷰를 쓰지 못하도록, 리뷰는 항상
   * 완료된 주문 하나에 연결돼요. 주문 상세 화면이 이 값으로 "이미 리뷰를
   * 남긴 주문인지" 판단해요. */
  orderId?: string;
  /** 이 리뷰를 쓴 시점의 내 프로필 닉네임(있으면). 카페 상세 화면이 아직
   * 서버 목록에 안 잡힌 "방금 쓴 내 리뷰"를 보여줄 때, 그때그때 바뀔 수 있는
   * 실시간 로그인 프로필 대신 이 값을 먼저 써요 — 로그인 프로필이 아직
   * 서버에서 안 불러와진 순간(앱을 막 켰을 때 등)에 잠깐 "나"로 보였다가
   * 몇 초 뒤 실제 이름으로 바뀌는 깜빡임을 없애기 위해서예요. */
  authorName?: string | null;
};
