# Re:Action

> 계획을 못 지킨 뒤, 다음 행동으로 돌아오도록 돕는 AI 실행 회복 코치

Re:Action은 목표를 세우는 데서 끝나지 않습니다. 실행이 끊긴 이유를 기록하고, 더 작게 하기·시간 바꾸기·다음 날 이어가기·잠시 보류하기 중 적절한 회복안을 선택해 다시 실행하도록 돕습니다.

이 저장소는 한이음 프로젝트의 **프론트엔드 결과물**입니다. AI 인터뷰·계획·회복 제안을 화면으로 연결하며, 판단과 영구 저장은 별도 백엔드가 담당합니다. 웹과 PWA를 제공하고, 같은 웹 코드를 담는 iOS·Android Capacitor 프로젝트를 포함합니다. 앱 프로젝트가 있다는 것이 스토어 출시 완료를 의미하지는 않습니다.

- [웹 서비스](https://reaction-frontend.vercel.app/)
- [백엔드 저장소](https://github.com/hanium-reaction/reaction-backend)
- [핵심 흐름 검증 안내](docs/core-flow-verification.md)
- [Android 출시 준비](docs/android-release.md)

## 핵심 사용자 흐름

1. **목표 구체화** — 목표 관리에서 목표를 추가하고, 딥 인터뷰로 현재 수준·가능한 시간·마감일·성공 기준을 정합니다. 진행 중인 인터뷰는 이어서 진행하고, 새로 시작은 명시적으로 선택합니다.
2. **계획 승인** — 목표 분류와 마일스톤, 자료와 시간 조건을 검토합니다. 생성된 계획은 초안이며 사용자가 승인해야 일정으로 저장됩니다.
3. **실행 기록** — 오늘 실행에서 행동을 시작합니다. 집중 화면에서 완료하거나, 중단 시 일부 완료·실패를 구분해 기록합니다. 잠시 멈추고 나가는 것은 실패 처리가 아닙니다.
4. **복구 코치** — 실패 사유를 기록하면 회복 제안을 받습니다. 오늘 화면의 실패·부분 완료 기록에서도 다시 들어갈 수 있습니다. 실제 실행 기록이 없거나 저장에 실패한 경우에는 성공한 것처럼 진행하지 않습니다.
5. **복구안 확인과 반영** — 선택 저장 후 변경 내용을 확인합니다. 새 회복 행동이 생긴 경우에는 실제 일정 변경안을 조회하고 `일정 반영하기`로 승인합니다. 보류 등 새 행동이 없는 선택은 저장 결과를 안내하며, 직접 시간 변경이 필요한 경우 주간 계획으로 연결합니다.
6. **리뷰와 목표 완료** — 주간 리뷰로 실행 결과와 실패 맥락을 돌아봅니다. 마일스톤을 모두 완료한 목표에는 완료 제안이 나타납니다. 목표 완료는 남은 예정 일정을 정리하므로 확인 절차를 거칩니다.

화면 이름인 **‘회복 완료’는 회복 행동을 실제로 수행했다는 뜻이 아닙니다.** 회복안 선택 저장과 일정 승인, 이후의 실행 완료를 구분합니다. 회복안 수락만으로 원래 실패한 행동을 완료로 바꾸지 않습니다.

## 구현 범위와 남은 확인

현재 코드는 다음 기능을 포함합니다.

- 목표 인터뷰, 집중·유지·보류 분류, 마일스톤·자료 검토, 계획 생성·승인
- 홈 타임라인과 다음 할 일 안내, 집중 타이머, 실행·부분 완료·실패 기록
- 실패 사유, 회복 제안·선택 저장, 일정 변경 미리보기·승인
- 주간 캘린더 편집, 재계획 초안·승인, 주간 리뷰
- 목표·마일스톤 완료와 되돌리기, 만다라트 초안·재구성 진입
- Google 로그인, Google 캘린더 연결·해제 UI와 겹침 표시
- Inbox, 습관, 설정, PWA 설치 안내와 Web Push 연동

**구현과 운영 검증은 다릅니다.** 캘린더 권한 동의·실제 일정 충돌, 여러 목표의 자료·계획 분리, 네이티브 배포는 별도의 환경과 검증이 필요합니다. [열린 이슈](https://github.com/hanium-reaction/reaction-frontend/issues)는 구현 누락뿐 아니라 미검증 조건과 외부 의존성도 관리합니다.

현재 제한 사항:

- Google 캘린더 연결은 별도 동의가 필요합니다. 로그인만으로 연결되지는 않습니다.
- 개별 일정 삭제, 대화로 기존 계획 수정, 여러 목표 분리의 일부는 백엔드 계약·연동 확인이 남아 있습니다.
- 오프라인 실행을 보장하지 않습니다. 로컬 실행 상태 보존과 저장 재시도는 서버 동기화 완료와 다릅니다.
- 네이티브 푸시 발송과 스토어 출시는 완료로 주장하지 않습니다. Android 서명·콘솔·기기 검증은 별도 절차입니다.
- 실제 사용자 수, 회복률 개선, 토큰·메모리 절감 효과를 이 저장소의 화면만으로 입증할 수 없습니다. 보고서에는 측정한 결과만 사용합니다.

## 시연하기

운영 시연은 [고정 배포 도메인](https://reaction-frontend.vercel.app/)에서 Google 로그인 후 진행합니다. 일회성 Vercel 배포 주소는 OAuth 허용 원본에 등록되어 있지 않으면 `origin_mismatch`가 발생할 수 있습니다.

테스트 전용 계정 또는 명확하게 구분한 `검증용` 목표를 사용하세요. 기존 사용자 일정에서 실패 기록·완료·재계획 승인을 시험하지 마세요.

1. 검증용 목표를 만들고 짧은 계획을 생성·승인합니다.
2. 검증용 행동을 시작하고 `중단 → 잘 안됐어요 → 사유 선택 → 기록하고 복구안 보기`로 이동합니다.
3. 회복안을 선택하고 저장 결과를 확인합니다. 새 행동이 생기면 변경 미리보기 확인 후 승인합니다.
4. 오늘·주간 화면으로 돌아가 서버에서 불러온 결과를 확인합니다. 선택 저장을 실제 행동 완료나 회복률 상승으로 설명하지 않습니다.

Google 동의, AI 응답 시간, 서버 상태에 따라 시연 시간이 달라집니다. 화면 강제 진입이나 API 응답을 대체한 테스트는 실제 사용자 흐름 검증과 구분해서 표기하세요.

## 기술 구성

React 18 · TypeScript 5 · Vite 5 · React Router 7 · CSS 변수/Tailwind CSS 3 · Phosphor Icons · Capacitor 8을 사용합니다. 테스트는 Vitest와 React Testing Library, 배포와 자동 검사는 Vercel과 GitHub Actions로 구성합니다. 정확한 설치 버전은 [package-lock.json](package-lock.json)을 기준으로 합니다.

- [AppShell](src/app/AppShell.tsx): 인증과 온보딩 진입, 화면 크기별 앱 구성
- [ReActionMerged](src/app/ReActionMerged.tsx): 화면 전환, 실행 저장과 회복 연결
- [api.ts](src/lib/api.ts): 기능별 API, 인증 갱신, 오류 문구, 멱등성 키
- [screens](src/screens): 목표·계획·실행·회복·리뷰 화면
- [index.css](src/index.css): 색·간격·상태 표현 등 공통 스타일
- [openapi.json](openapi.json): 백엔드 API 명세 사본

주소 라우팅과 별개로 제품 내부 화면은 `ScreenId` 상태로 전환합니다. 웹은 기본 `/api` 요청을 Vite 개발 프록시 또는 Vercel rewrite로 전달합니다. `VITE_API_BASE_URL`을 지정하면 그 주소를 직접 사용합니다. 네이티브 앱은 별도의 절대 HTTPS API 주소를 사용합니다.

## 로컬 실행

Node.js 22와 npm을 사용합니다. 서버 연동에는 실행 중인 백엔드가 필요합니다.

```bash
npm ci
cp .env.example .env
npm run dev
```

PowerShell에서는 복사 명령을 `Copy-Item .env.example .env`로 바꿉니다. 기본 접속 주소는 `http://localhost:5173`입니다.

`.env.example`의 `VITE_API_BASE_URL=http://localhost:8000`은 로컬 백엔드를 직접 호출합니다. `/api` 프록시를 사용하려면 이 값을 제거하고 [vite.config.ts](vite.config.ts)의 대상 서버를 확인하세요. 테스트 데이터가 운영 서버로 전송되지 않도록 개발 전에 연결 대상을 확인해야 합니다.

환경 변수:

- `VITE_API_BASE_URL`: 웹 API 주소. 미설정 시 `/api`
- `VITE_GOOGLE_CLIENT_ID`: Google 로그인용 클라이언트 ID. 사용하는 웹 원본을 OAuth 설정에 등록해야 함
- `VITE_VAPID_PUBLIC_KEY`: Web Push 공개키. 실제 발송에는 백엔드의 대응 키·구독 설정 필요
- `VITE_ALLOW_STUB_LOGIN`: 개발용 임시 로그인 허용. 미설정 시 개발 빌드에서만 허용, 운영에서는 차단
- `VITE_NATIVE_API_BASE_URL`: 네이티브 API 절대 HTTPS 주소. 기본값은 고정 웹 배포 도메인의 `/api`

개발용 `?demo=stub` 로그인에는 백엔드 `AUTH_STUB_MODE`도 필요합니다. `?force=<ScreenId>`는 화면을 강제로 여는 개발 보조 수단일 뿐 필요한 실행 ID·초안·인증을 생성하지 않습니다. 정상 시연은 실제 진입 버튼을 이용하세요.

`VITE_*` 값은 브라우저 번들에 노출됩니다. 서버 비밀키·토큰을 넣거나 개인 `.env`를 커밋하지 마세요. 운영 인증 문제를 우회하려고 임시 로그인을 켜지 마세요.

## 검증과 빌드

```bash
npm test
npm run check:api
npm run check:fields
npm run build
```

[CI](.github/workflows/ci.yml)는 위 네 검사를 수행합니다. 테스트는 jsdom과 대체 API 응답으로 실행하며 실제 운영 데이터를 수정하지 않습니다. 인증 오류·저장 실패·재시도·초안 승인·실행 및 회복 상태를 검증합니다. 통과 결과가 실제 Google 동의나 운영 백엔드의 모든 동작을 보장하지는 않습니다.

`check:api`의 `WARN`은 명세에 없는 경로, `GONE`은 명세와 맞지 않는 호출 방식(실패), `NEW`는 아직 사용하지 않는 서버 경로를 뜻합니다. 경고가 있다면 내용과 영향까지 확인하세요.

추가 명령:

```bash
npm run test:watch    # 수정 중 테스트
npm run preview       # 빌드 결과 확인
npm run cap:sync      # 웹 빌드 후 네이티브 프로젝트 동기화
npm run ios          # 동기화 후 Xcode 열기(macOS 필요)
npm run android      # 동기화 후 Android Studio 열기
```

OpenAPI 타입을 다시 만들 때는 저장소의 명세를 기준으로 아래 명령을 사용합니다. 생성 후 검사와 빌드를 다시 실행하세요.

```bash
npx openapi-typescript openapi.json -o src/types/openapi.d.ts
```

## 제출물과 실험 기록

제출용 설명은 ‘실패 이후의 복귀 경로’와 ‘서버에 저장되기 전에는 성공으로 표시하지 않는 경계’에 초점을 둡니다. 화면 수나 근거 없는 성능 수치로 효과를 대신하지 않습니다.

- **시연**: 목표 생성부터 회복 선택·일정 반영까지 정상 버튼으로 진행한 영상. 실행 환경과 대체 응답 사용 여부를 명시
- **검증 기록**: [핵심 흐름 체크리스트](docs/core-flow-verification.md)에 버전, 조건, 기대 결과, 관찰 결과 기록
- **실험**: 할루시네이션·출력 형식 준수·회복 성공률은 분모와 판정 기준을 먼저 정의. 토큰·메모리·SQL 지연 시간은 백엔드 측정 자료와 연결

이 항목들은 결과물 정리 기준이며, 영상 제작이나 효과 측정이 모두 끝났다는 뜻은 아닙니다.

## 관련 문서

- [백엔드 API 계약](https://github.com/hanium-reaction/reaction-backend/blob/main/docs/api-contract.md)
- [백엔드 아키텍처](https://github.com/hanium-reaction/reaction-backend/blob/main/docs/architecture.md)
- [참여자](https://github.com/hanium-reaction/reaction-frontend/graphs/contributors)

별도 라이선스 파일이 없는 상태에서는 외부 재사용·재배포 전에 팀의 정책을 확인하세요.
