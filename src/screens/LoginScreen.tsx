import { useEffect, useRef, useState } from 'react';
import { Sparkle } from '@phosphor-icons/react';
import { ErrorBanner } from '../components/ErrorBanner';
import { stubDemoAvailable } from '../lib/api';
import { GOOGLE_CLIENT_ID } from '../lib/googleIdentity';
import '../styles/guided-redesign.css';

// 모듈 지역 const 로 받아야 아래 콜백 안에서 `if (!CLIENT_ID) return` 좁히기가 유지된다.
const CLIENT_ID = GOOGLE_CLIENT_ID;

interface LoginScreenProps {
  onGoogleCredential: (idToken: string) => void;
  onDemoLogin: () => void;
  isBusy: boolean;
  error?: string | null;
}

// 실제 로그인 화면 — Google Identity Services 버튼 + (부가) 데모 체험 진입.
// 백엔드가 아직 stub 모드(AUTH_STUB_MODE=true)면 실제 계정으로 로그인해도
// 서버가 데모 유저로 응답할 수 있다 — 그건 백엔드 설정이 반영되면 자동으로 해결된다.
export function LoginScreen({ onGoogleCredential, onDemoLogin, isBusy, error }: LoginScreenProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [buttonReady, setButtonReady] = useState(false);
  // 데모 진입 가능 여부는 빌드 설정에서 온다(프로덕션 기본은 차단).
  const demoAllowed = stubDemoAvailable();

  useEffect(() => {
    if (!CLIENT_ID) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    // index.html 의 GSI 스크립트가 async 라 로드 시점을 보장할 수 없다 — 준비될 때까지 짧게 폴링.
    const tryInit = () => {
      if (cancelled) return;
      const id = window.google?.accounts?.id;
      if (!id || !buttonRef.current) {
        timer = setTimeout(tryInit, 150);
        return;
      }
      id.initialize({
        client_id: CLIENT_ID,
        callback: (r) => onGoogleCredential(r.credential),
      });
      id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: Math.min(280, buttonRef.current.clientWidth || 280),
      });
      setButtonReady(true);
    };
    tryInit();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [onGoogleCredential]);

  return (
    <div className="guided-surface guided-login">
      <section className="guided-login-story" aria-label="Re:Action 소개">
        <div className="guided-wordmark"><Sparkle size={26} weight="fill" /> Re:Action</div>
        <span className="guided-kicker">계획의 다음은, 다시 행동.</span>
        <h1>완벽한 하루보다<br /><span>다시 시작하는 힘.</span></h1>
        <p>목표를 작은 실행으로 나누고,<br />계획이 흔들리면 지금에 맞게 조정해요.</p>
        <ol className="guided-product-path">
          <li><span>01</span><div><strong>하고 싶은 일에서 출발</strong><p>대화로 목표와 상황을 정리해요.</p></div></li>
          <li><span>02</span><div><strong>지금 할 한 가지에 집중</strong><p>작은 실행부터 하나씩 이어가요.</p></div></li>
          <li><span>03</span><div><strong>멈춰도 다시 계획</strong><p>변경 내용을 확인하고 직접 승인해요.</p></div></li>
        </ol>
      </section>

      <section className="guided-login-access" aria-label="로그인">
        <span className="guided-kicker">나의 다음 한 걸음</span>
        <h2>여기서 이어가세요.</h2>
        <p>로그인하고 나에게 맞는 계획을 시작해요.</p>
        <div className="guided-login-buttons">
        {CLIENT_ID ? (
          <>
            <div ref={buttonRef} style={{ minHeight: 44, width: '100%' }} />
            {!buttonReady && (
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                Google 로그인 준비 중…
              </span>
            )}
          </>
        ) : (
          // CLIENT_ID 가 없으면 버튼 자체가 뜨지 않는다 — 왜 못 들어가는지 알려준다.
          <div style={{ fontSize: 12, color: 'var(--text-2)', padding: '12px 14px', border: '1px dashed var(--sand-300)', borderRadius: 12, lineHeight: 1.6, textAlign: 'center' }}>
            Google 로그인이 아직 설정되지 않았어요.
            {!demoAllowed && (
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>
                관리자가 설정을 마치면 들어올 수 있어요.
              </div>
            )}
          </div>
        )}

        {error && (
          <ErrorBanner>{error}</ErrorBanner>
        )}

        {/* stub 이 꺼져 있으면(프로덕션 기본) 눌러도 백엔드가 거부한다 — 버튼을 두지 않는다.
            예전엔 항상 보여서, 배포본에서 누르면 "로그인 정보가 올바르지 않아요" 만 떴다. */}
        {demoAllowed && (
        <button
          onClick={onDemoLogin}
          disabled={isBusy}
          style={{
            marginTop: 4,
            background: 'transparent',
            border: 'none',
            color: 'var(--text-3)',
            fontSize: 12,
            letterSpacing: '0.04em',
            textDecoration: 'underline',
            cursor: isBusy ? 'wait' : 'pointer',
            opacity: isBusy ? 0.6 : 1,
          }}
        >
          {isBusy ? '로그인 중…' : '데모 계정으로 체험하기'}
        </button>
        )}
        </div>
      </section>
    </div>
  );
}
