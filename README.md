# Re:Action Frontend

> 계획이 무너진 뒤의 다음 행동을 설계하는 AI 실행 회복 코치

Re:Action은 청년 대학생이 목표를 구체화하고, 현실적인 주간 계획을 세우고, 실행이 끊긴 이유를 기록한 뒤 다시 계획으로 돌아오도록 돕는 서비스입니다. 이 저장소는 웹/PWA와 iOS·Android용 Capacitor 셸을 포함한 프론트엔드입니다.

- 웹: React + TypeScript + Vite
- 모바일 웹앱: Web App Manifest + Web Push
- 네이티브 셸: Capacitor 8 기반 iOS/Android 프로젝트
- 백엔드 계약: OpenAPI 스냅샷에서 타입을 생성하고 API 호출을 정적 검사
- 백엔드 저장소: [hanium-reaction/reaction-backend](https://github.com/hanium-reaction/reaction-backend)

## 제품이 해결하는 문제

일반적인 플래너는 목표와 일정을 만드는 데 집중하지만, 계획을 지키지 못한 다음의 행동은 사용자에게 맡기는 경우가 많습니다. Re:Action은 이 공백을 다음 흐름으로 다룹니다.

```text
목표 파악 → 계획 초안 → 오늘의 한 행동 → 실행 기록
                                      ↓
                       실패 사유 → 회복안 선택 → 재계획
                                      ↓
                               주간 리뷰와 다음 계획
```

AI 결과는 확정값이 아니라 초안으로 제시됩니다. 사용자가 수락·수정·거절한 뒤에만 계획과 회복 행동이 확정되는 Human-in-the-loop 방식을 사용합니다.

## 핵심 사용자 흐름

### 1. 목표를 대화로 구체화

- 슬롯 카탈로그 기반 AI 인터뷰
- 빠른 선택과 직접 입력
- 모호한 답변을 다시 묻고 목표·가용 시간·선호 리듬을 정리
- 목표를 집중·유지·보류로 분류한 초안을 사용자가 직접 조정

### 2. 현실 제약을 반영한 첫 계획 생성

- 고정 일정, 활동 가능 시간, 시간 정책, 알림 설정 확인
- 마일스톤 순서와 계획 밀도 조정
- 7일 시간표에서 블록 확인·드래그·편집
- AI 초안을 검토한 뒤 승인

### 3. 오늘의 한 행동에 집중

- 모닝 브리프와 오늘의 우선 행동 표시
- `왜 지금인지`, `첫 걸음`, 예상 소요 시간 제공
- 집중 타이머 시작·일시정지·재개
- 완료·부분 완료·잘 안됨을 구분해 기록

### 4. 실패를 회복 행동으로 전환

- 실패 사유를 최대 2개까지 선택하고 메모
- 더 작게 하기, 일정 변경, 이월, 보류 등의 if-then 회복안 제안
- 사용자가 회복안을 선택한 뒤 before/after 재계획 확인

### 5. 한 주의 패턴을 다음 계획에 반영

- 준수율·회복률·재시작률과 시간대/카테고리별 패턴 확인
- 습관 조정 제안 검토
- 다음 주 계획으로 연결

### 보조 흐름

- Life Inbox: 떠오른 생각을 기록하고 목표 또는 오늘 할 일로 승격
- 추천 자료: 자료 안의 `한 걸음`을 오늘 할 일로 채택
- 습관: 주간 습관 생성·수정과 실행 체크
- 내 정보: 활동 시간, 집중 시간, 회복 선호 등 사용자 리듬 확인

## 구현 상태

| 영역 | 상태 | 현재 범위 |
| --- | --- | --- |
| AI 인터뷰·목표 분류 | 구현 | 질문/답변, 추천 답변, 분류 초안, 사용자 확인 |
| 마일스톤·첫 계획 | 구현 | 마일스톤 순서, 계획 밀도, 생성·검토·승인 |
| Today·Focus | 구현 | 아젠다, 상세, 시작, 일시정지, 재개, 체크인 |
| 회고·회복·재계획 | 구현 | 실패 사유, 회복안, 사용자 결정, 재계획 승인 |
| 주간 캘린더·리뷰 | 구현 | 기존 블록 편집·드래그, 주간 지표, 습관 조정 |
| Inbox·습관·설정 | 구현/부분 구현 | 서버 계약과 화면에 따라 일부 로컬·데모 폴백 존재 |
| Google 로그인 | 구현 | 실제 GIS 로그인 또는 개발용 stub 로그인 |
| PWA·Web Push | 구현 | 설치 안내와 웹 푸시. 오프라인 캐시는 제공하지 않음 |
| Capacitor iOS/Android | 셸 구현 | 빌드·동기화 가능. 네이티브 푸시는 준비 중 |
| Google Calendar 자동 연동 | 준비 중 | 고정 일정 직접 입력을 지원하며 자동 연동 UI는 준비 중 안내 |

성과 수치, 사용자 수, 완료율 개선 효과는 이 저장소만으로 입증할 수 없습니다. 발표나 보고서에는 별도의 실험·운영 데이터가 있을 때만 수치로 사용하세요.

## 디자인 시스템

실제 화면에서 사용하는 디자인 토큰은 [`src/index.css`](src/index.css)에, 공개 UI 컴포넌트 목록은 [`src/design-system.ts`](src/design-system.ts)에 있습니다.

- 배경: Sand 50 `#FAF6EE`
- 표면: `#FFFCF6`, Sand 100 `#F4EEE2`
- 본문: Sand 900 `#1A1714`
- 브랜드: Coral 500 `#E26D4E`
- 대비가 필요한 CTA: Coral 700 `#9E472F`
- 글꼴: Pretendard Variable
- 형태: 6/12/18/28px 반경, 4px 기반 간격 체계
- 의미 규칙: 점선은 AI 초안·미확정, 실선은 확정, 코랄은 핵심 행동·회복

색만으로 상태를 구분하지 않고 라벨과 아이콘을 함께 사용합니다. 공용 컴포넌트는 화면에서 실제로 사용하는 구성요소만 `src/design-system.ts`를 통해 노출합니다.

## 기술 스택

| 구분 | 기술 |
| --- | --- |
| UI | React 18, TypeScript 5.x |
| 빌드 | Vite 5.x |
| 라우팅 | React Router 7 |
| 스타일 | CSS Custom Properties, Tailwind CSS 3.x |
| 아이콘 | Phosphor Icons |
| 마크다운 | react-markdown, remark-gfm |
| PWA | Web App Manifest, Service Worker, Web Push |
| 네이티브 | Capacitor 8, iOS, Android |
| API 계약 | openapi-typescript 7, 자체 계약/필드 검사기 |
| 배포 | Vercel, GitHub Actions |

세부 패치 버전은 [`package-lock.json`](package-lock.json)을 기준으로 합니다.

## 아키텍처

### 화면 전환

React Router는 `/` 진입점을 제공하고, 실제 제품 화면 전환은 `AppShell`과 `NavigationContext`의 `ScreenId` 상태로 관리합니다. 로그인 화면을 제외한 `ScreenId`는 18개이며, 백엔드의 `onboardingState`가 초기 진입 화면의 진실 소스입니다.

```text
src/App.tsx
└─ AppShell
   ├─ DesktopSidebar     1024px 이상
   └─ ReActionMerged     모바일·태블릿
      └─ screens/*       ScreenId 기반 화면 전환
```

뷰포트에 맞는 트리 하나만 마운트해 숨겨진 데스크톱/모바일 트리의 API 요청이 중복되지 않게 합니다.

### API 호출

웹에서는 기본적으로 same-origin `/api/*`를 호출합니다.

```text
브라우저 → /api/* ─┬─ 개발: Vite proxy
                   └─ 배포: Vercel rewrite → reaction-backend
```

`src/lib/api.ts`의 공통 요청 래퍼가 다음을 담당합니다.

- Bearer access token 첨부
- 필요한 호출의 `Idempotency-Key` 생성
- 오류 코드의 사용자용 한국어 메시지 변환
- 개발 환경에서 허용된 경우에만 stub 로그인 복구
- 19개 도메인 API 네임스페이스 제공

Capacitor 네이티브 빌드는 현재 운영 웹 도메인의 `/api`를 기본값으로 사용합니다. 운영 도메인을 바꿀 때는 [`src/lib/api.ts`](src/lib/api.ts)의 네이티브 base URL 정책도 함께 검토해야 합니다.

### OpenAPI 동기화

```text
reaction-backend OpenAPI
        ↓
openapi.json
        ├─ npm run gen:api      → src/types/openapi.d.ts
        ├─ npm run check:api    → 메서드·경로 대조
        └─ npm run check:fields → 주요 요청·응답 필드 대조
```

GitHub Actions의 `sync-api.yml`이 백엔드 스키마 동기화를 담당합니다. 현재 `ci.yml`은 `npm ci`와 `npm run build`를 실행하며, `check:api`와 `check:fields`는 로컬 또는 별도 동기화 흐름에서 실행해야 합니다.

## 로컬 개발

### 요구 사항

- Node.js 22 권장(CI 기준)
- 연동 기능을 확인하려면 실행 중인 `reaction-backend`

### 설치와 실행

```bash
npm ci
cp .env.example .env
npm run dev
```

Windows PowerShell:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

개발 서버는 기본적으로 `http://localhost:5173`에서 열립니다.

### 환경 변수

| 변수 | 필요 조건 | 설명 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 웹 연동 시 | 웹의 API base URL. 로컬 백엔드는 보통 `http://localhost:8000` |
| `VITE_VAPID_PUBLIC_KEY` | 실제 Web Push 사용 시 | 백엔드 VAPID 키쌍의 공개키 |
| `VITE_GOOGLE_CLIENT_ID` | 실제 Google 로그인 사용 시 | Google OAuth 웹 클라이언트 ID |
| `VITE_ALLOW_STUB_LOGIN` | 개발/데모 선택 | 미설정 시 개발 빌드만 허용하고 프로덕션에서는 차단 |

실제 키나 토큰이 들어 있는 `.env`는 커밋하지 마세요.

### 명령어

```bash
npm run dev          # Vite 개발 서버
npm run build        # TypeScript 검사 + 프로덕션 빌드
npm run preview      # 빌드 결과 확인
npm run gen:api      # openapi.json에서 타입 재생성
npm run check:api    # API 메서드·경로 계약 검사
npm run check:fields # 주요 요청·응답 필드 계약 검사
npm run cap:sync     # 웹 빌드 후 전체 네이티브 프로젝트 동기화
npm run ios          # iOS 동기화 후 Xcode 열기
npm run android      # Android 동기화 후 Android Studio 열기
```

### 개발용 진입 파라미터

| 파라미터 | 동작 |
| --- | --- |
| `?force=<screenId>` | 온보딩 상태와 무관하게 특정 제품 화면으로 진입 |
| `?demo=stub` | 발표용 시드 데모 계정 사용 |
| `?login=1` | 자동 stub 로그인 대신 로그인 화면 표시 |

stub 로그인은 개발·데모용입니다. 프론트의 `VITE_ALLOW_STUB_LOGIN`과 백엔드의 `AUTH_STUB_MODE`가 모두 허용된 환경에서만 사용하세요.

## 프로젝트 구조

```text
reaction-frontend/
├─ .github/workflows/     CI, API 동기화
├─ android/               Capacitor Android 프로젝트
├─ ios/                   Capacitor iOS 프로젝트
├─ public/                Manifest, Service Worker, 앱 아이콘
├─ scripts/               OpenAPI 계약·필드 검사
├─ src/
│  ├─ app/                부팅, 인증, 반응형 셸
│  ├─ components/         공용 UI 컴포넌트
│  ├─ contexts/           화면 전환과 전역 토스트 상태
│  ├─ lib/                API, Web Push, 네이티브, 날짜 유틸리티
│  ├─ screens/            제품 화면
│  ├─ types/              수기 타입과 OpenAPI 생성 타입
│  ├─ design-system.ts    디자인 시스템 공개 진입점
│  └─ index.css           디자인 토큰과 전역 스타일
├─ capacitor.config.ts
├─ openapi.json           백엔드 OpenAPI 스냅샷
├─ vite.config.ts         개발 API 프록시
└─ vercel.json            배포 API rewrite
```

## 검증

README 또는 코드 변경 전후에 최소한 다음을 실행하세요.

```bash
npm run build
npm run check:api
npm run check:fields
```

`check:api`의 `WARN`은 스펙에 없는 호출, `GONE`은 경로는 있지만 메서드가 맞지 않는 호출, `NEW`는 프론트 래퍼가 없는 백엔드 경로를 뜻합니다. `GONE`은 실패로 처리됩니다.

## 현재 제한 사항

- Google Calendar 자동 가져오기는 아직 제품 화면에서 준비 중입니다.
- Service Worker는 푸시 이벤트를 처리하지만 오프라인 캐시 전략은 제공하지 않습니다.
- 네이티브 푸시는 준비 중이며 웹 푸시와 동일한 완료 상태로 보지 않습니다.
- 주간 캘린더의 일부 추가·삭제 동작에는 로컬 임시 저장 폴백이 있습니다.
- 설정·동의·익명화 일부는 백엔드 상태에 따라 데모/로컬 폴백이 나타날 수 있습니다.
- `public/icon.svg`와 앱의 `Re:Action` 워드마크는 현재 서로 다른 타이포그래피를 사용합니다.

## 관련 문서와 저장소

- [reaction-backend](https://github.com/hanium-reaction/reaction-backend)
- [백엔드 API 계약](https://github.com/hanium-reaction/reaction-backend/blob/main/docs/api-contract.md)
- [백엔드 아키텍처](https://github.com/hanium-reaction/reaction-backend/blob/main/docs/architecture.md)
- [GitHub contributors](https://github.com/hanium-reaction/reaction-frontend/graphs/contributors)

현재 저장소에는 별도 라이선스 파일이 없습니다. 외부 공개·배포·재사용 전에 팀의 라이선스 정책을 확인하세요.
