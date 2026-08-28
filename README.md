# CafeOn — 실시간 좌석 혼잡도 기반 카페 탐색 · 주문 결제 모바일 웹앱

카페온(CafeOn)은 지도에서 카페 좌석 혼잡도를 바로 확인하고, 그 자리에서 메뉴 주문 · 결제까지
끝내는 손님용 앱과, 매장을 관리하는 사장님용 대시보드로 구성된 투사이드(two-sided) 서비스입니다.
Next.js(App Router) + Tailwind CSS로 구현했고, 카카오맵 SDK · 토스페이먼츠 · `CafeOn Backend API
v2.0.0`(REST, Sanctum 인증)과 연동합니다.

- **TEAM NextWave**

## 화면 목록

### 손님용

| 경로                                            | 화면                                              |
| ----------------------------------------------- | ------------------------------------------------- |
| `/`                                             | 스플래시                                          |
| `/start`                                        | 계정 선택 (손님/사장님)                           |
| `/login`, `/signup`                             | 손님 로그인 / 회원가입                            |
| `/login/callback`                               | 소셜 로그인(카카오·구글) 콜백                     |
| `/map`                                          | 지도 (홈, 하단 탭)                                |
| `/search`                                       | 카페 검색                                         |
| `/cafe/[id]`                                    | 카페 상세 (메뉴/리뷰/사진 탭, 장바구니 담기)      |
| `/cafe/[id]/route`                              | 길찾기 · 경로 안내                                |
| `/order/cart`                                   | 장바구니                                          |
| `/order/checkout`                               | 주문 · 결제 준비 (토스페이먼츠 결제창 호출)       |
| `/order/payment/success`, `/order/payment/fail` | 토스페이먼츠 결제 리다이렉트 처리                 |
| `/order/complete`                               | 주문 완료                                         |
| `/reserve`                                      | 주문내역 (하단 탭 — 예약이 아니라 주문 상태 목록) |
| `/wishlist`                                     | 찜한 카페 (하단 탭)                               |
| `/benefits`                                     | 혜택 · 포인트 · 쿠폰 (하단 탭, 추후 수정 예정)    |
| `/my`                                           | MY (하단 탭)                                      |
| `/my/profile`                                   | 프로필 관리                                       |
| `/my/reviews`, `/my/reviews/write?cafeId=`      | 리뷰 관리 / 작성                                  |
| `/my/settings`                                  | 설정                                              |
| `/my/support`                                   | 고객센터                                          |

### 사장님용 (`/owner/**`, 작업 중)

| 경로                                                    | 화면                                        |
| ------------------------------------------------------- | ------------------------------------------- |
| `/owner/login`, `/owner/signup`                         | 사장님 로그인 / 회원가입                    |
| `/owner/(shell)`                                        | 오늘 매출 대시보드 · 그래프                 |
| `/owner/(shell)/store`                                  | 매장 정보 · 좌석 상태 관리                  |
| `/owner/(shell)/menu`                                   | 메뉴 CRUD · 이미지 업로드                   |
| `/owner/(shell)/reserve`, `/owner/(shell)/reserve/[id]` | 주문 접수 · 수락/거절, 상태 동기화          |
| `/owner/(shell)/my/**`                                  | 사장님 프로필 · 리뷰 답글 · 설정 · 고객센터 |

## 구조

```
src/
  app/                    App Router 페이지
    (shell)/              손님용, 하단 탭바가 붙는 화면 그룹 (지도/찜/주문내역/혜택/MY 및 order/* 하위 화면)
    owner/(shell)/         사장님용 대시보드 화면 그룹
  components/             재사용 컴포넌트 (BottomNav, Header, CafeListCard, MapPlaceholder 등)
  lib/
    data.ts               목업 데이터 (카페, 메뉴, 리뷰, 쿠폰)
    api.ts                백엔드 API 호출 + 토스페이먼츠 pending 저장(로컬 스토리지)
    cart-store.tsx         장바구니 · 최근 주문(lastOrder) 상태
    orders-store.tsx        주문내역 상태
    auth-store.tsx / owner-auth-store.tsx   손님 / 사장님 인증 상태
    toss-payments.ts        토스페이먼츠 SDK 연동
    kakao-map-sdk.ts        카카오맵 SDK 연동
    seat-congestion.ts       좌석 혼잡도(여유·주의·혼잡) 계산
```

## 에셋 처리

- 실제 이미지 파일이 없어 사진이 들어가는 모든 자리는 비율에 맞는 회색 박스(`ImagePlaceholder` 컴포넌트)로 처리했습니다.
- 지도 영역은 추후 카카오맵/구글맵 SDK 연동을 염두에 두고 스키매틱 도로 격자 + 상태별 색상 핀으로 임시 표현했습니다(`MapPlaceholder`).
- 아이콘은 전부 `lucide-react`를 사용했습니다.

## 디자인 토큰 (기본\_색상가이드.html 기준)

`tailwind.config.js`에 등록되어 있습니다.

- brand `#D85A30` / brand-dark `#993C1D` / brand-tint `#FAECE7`
- cream(배경) `#F5F1E8`
- trust(사장님 전용) `#185FA5`
- sage(여유/포인트) `#639922`
- amber(주의) `#BA7517`
- danger(오류 전용) `#A32D2D`
- ink `#2C2C2A` / ink-secondary `#5F5E5A` / ink-muted `#888780`
- border `#E3DECE`

> 참고: 색상가이드 v2 업데이트에 따라 좌석 "혼잡" 상태는 danger(레드)가 아닌 brand-dark를 사용했습니다.

## 백엔드 연동 현황 (`CafeOn Backend API v2.0.0` 기준)

`.env.local`의 `NEXT_PUBLIC_API_BASE_URL`을 채우면 아래 기능들이 실제 서버와
통신해요. 값이 비어있으면 지금까지처럼 mock 데이터로 동작해서 화면 확인에는
문제가 없어요. 연동 로직은 전부 `src/lib/api.ts` + 각 `*-store.tsx`에 있어요.

- **로그인/회원가입/로그아웃** (손님 `/api/auth/customer/login`, `/api/auth/signup`,
  사장님 `/api/auth/owner/login`, `/api/auth/owner/signup`, 소셜 로그인
  `/api/auth/social/exchange`) — Sanctum 토큰을 브라우저에 저장하고, 이후 요청에
  `Authorization: Bearer` 헤더로 실어요.
- **찜(favorite)**, **리뷰 작성**, **쿠폰/포인트 조회**
  (`/api/stores/{store}/favorite`, `/api/stores/{store}/reviews`, `/api/users/me/*`)
- **주문 · 결제**: 주문 생성 `/api/orders`, 결제 준비 `/api/payments/orders/{order}/checkout`,
  결제 승인 `/api/payments/confirm`, 주문내역 조회 `/api/users/me/orders`, 주문 취소
  `/api/users/me/orders/{order}/cancel`
- **사장님 대시보드**: 오늘 매출 카드/그래프(`/api/owner/stores/{store}/dashboard`,
  `/api/owner/stores/{store}/sales`), 메뉴 CRUD(`/api/owner/menus`), 좌석 관리
  (`/api/owner/seats`), 주문 수락/거절 및 상태 변경(`/api/owner/stores/{store}/orders`,
  `/api/owner/orders/{order}/status`), 리뷰 답글(`/api/owner/reviews/{review}/reply`)

### ⚠️ 알아야 할 제약 (다음 작업으로 이어가면 좋아요)

이 화면들의 카페 목록(`src/lib/data.ts`의 `cafes`)은 아직 실제 API가 아니라
프론트에 있는 목업 데이터예요. 그래서 카페 id가 `"onki-roasters"`같은 문자열이고,
백엔드가 기대하는 숫자 매장 id와 달라요. 찜/리뷰/예약 등 "쓰기" 요청은 이미
전부 연결해뒀지만, 실제 서버에 정확히 반영되려면 **카페 목록 자체를
`GET /api/stores`(지도/검색), `GET /api/stores/{store}`(상세)로 교체**해서
진짜 숫자 id가 화면에 흐르도록 해주는 작업이 이어져야 해요. 그 전까지는
요청이 조용히 실패하고(404 등) 화면은 기존처럼 로컬 상태로만 동작해요
(에러로 화면이 깨지지 않도록 설계했어요).

같은 이유로 사장님 좌석/메뉴도, 서버에서 새로 만든 항목은 서버가 준 진짜 id로
교체되지만 처음 seed된 mock 항목들은 실제 서버의 좌석/메뉴와 매칭되지 않아요.

## 진행 현황 (발표자료 기준)

- **완료** — 손님용 화면: 지도 · 검색 · 카페 상세 탐색, 실시간 좌석 혼잡도 3단계 표시,
  영업시간 · 메뉴 정보, 장바구니 · 토스페이먼츠 결제, 찜 · 리뷰(혜택은 추후 수정 예정)
- **작업 중** — 사장님 전용 관리 화면: 오늘 매출 대시보드 · 그래프, 메뉴 CRUD · 이미지 업로드,
  주문 수락 · 거절 및 상태 동기화

## 다음 단계

1. 실제 데이터 연동 확대 — 목업 데이터(`src/lib/data.ts`)를 실제 카페 데이터(`GET /api/stores`,
   `GET /api/stores/{store}`)로 전환
2. 서비스 데이터 안정화 — 주문 · 리뷰 · 찜 기능의 데이터 연결 구조 개선
3. 사장님 서비스 고도화 — 매출 · 좌석 · 메뉴 관리 기능 확장 (오너 화면은 이어서 별도로 작업)
