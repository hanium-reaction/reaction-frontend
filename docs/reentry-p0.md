# P0 재실행 연결

백엔드 PR: https://github.com/hanium-reaction/reaction-backend/pull/501

기존 Today/RestartCard → 다음 행동 확인 → Focus → 첫 행동 보고/쉬기 흐름을 연결한다.
Recovery의 기존 선택·승인 API를 유지하고 승인된 작업을 조회한 뒤 동일한 시작 화면을 연다.
미래 일정은 주간 계획으로 보내며 첫 행동 보고는 전체 완료 체크인을 호출하지 않는다.
선택적 저녁 에너지 입력과 불필요한 회복 지연을 제거한다.

## 활성화

백엔드 추가 migration/API가 준비된 환경에서 VITE_REENTRY_P0=true로 빌드한다.
기본 false이며 롤백은 플래그를 끈 빌드로 가능하다. 배포·운영 데이터 변경은 수행하지 않았다.

## 연결 검증

백엔드 docs/reentry-p0.md의 테스트 서버를 8019에서 실행한 후 PowerShell에서:

```powershell
$env:REACTION_API_TARGET='http://127.0.0.1:8019'
$env:VITE_REENTRY_P0='true'
npm run dev -- --host 127.0.0.1 --port 5179
```

/tests/integration/reentry.html은 실제 화면과 HTTP 클라이언트를 이용하는 개발 전용 진입점이다.
백엔드는 실제 라우터와 메모리 저장소를 사용한다. PostgreSQL 지속성은 별도 백엔드 CI로 검증한다.
테스트 HTML은 production build 진입점에 포함되지 않는다.

계측은 서버의 준비/노출/착수/첫 행동 기록과 기존 실행 결과를 연결한다.
선택·시작 클릭·시작 오류·명시적 이탈을 별도 사건으로 연결한다. 분석용 자유 입력은 전송하지 않는다. 무작위 실험 배정은 아직 포함하지 않으며 단일 파일럿이다.
