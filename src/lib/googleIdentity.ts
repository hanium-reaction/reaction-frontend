// Google Identity Services(GIS) — index.html 의 CDN 스크립트가 window.google 을 채운다.
// 공식 타입 패키지 없이 실제로 쓰는 최소 shape 만 선언한다. 로그인(accounts.id)과
// 캘린더 연결(accounts.oauth2)이 같은 전역을 쓰므로 선언은 여기 한 곳에만 둔다 —
// 화면마다 `declare global` 을 두면 Window.google 타입이 서로 충돌한다.

export interface GoogleIdCredentialResponse {
  credential: string; // Google ID token (JWT) — 그대로 백엔드 POST /auth/google 로 전달
}

interface GoogleAccountsId {
  initialize: (config: { client_id: string; callback: (r: GoogleIdCredentialResponse) => void }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}

interface GoogleCodeResponse {
  code?: string;
  scope?: string;
  error?: string;
}

interface GoogleCodeClientError {
  type: 'popup_closed' | 'popup_failed_to_open' | 'unknown';
}

interface GoogleCodeClient {
  requestCode: () => void;
}

interface GoogleAccountsOAuth2 {
  initCodeClient: (config: {
    client_id: string;
    scope: string;
    ux_mode: 'popup';
    callback: (r: GoogleCodeResponse) => void;
    error_callback?: (e: GoogleCodeClientError) => void;
  }) => GoogleCodeClient;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId; oauth2?: GoogleAccountsOAuth2 } };
  }
}

export const GOOGLE_CLIENT_ID: string | undefined = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// 백엔드 integrations/google_calendar/oauth.py 의 CALENDAR_SCOPE 와 같아야 한다.
// 읽기 전용 freebusy — 일정의 제목·장소는 읽지 않는다(ADR-0009 D4).
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy';

/** 사용자가 스스로 멈춘 경우 — 오류 안내를 띄우지 않는다. */
export class CalendarConsentCancelled extends Error {
  constructor() {
    super('calendar consent cancelled');
    this.name = 'CalendarConsentCancelled';
  }
}

/** GIS 스크립트가 아직 안 올라왔는지. 팝업은 클릭 직후에 동기로 열어야 해서 기다릴 수 없다. */
export function calendarConsentReady(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && window.google?.accounts?.oauth2);
}

/**
 * 캘린더 동의 팝업을 띄워 authorization code 를 받는다.
 *
 * **클릭 핸들러 안에서 동기로 불러야 한다** — 중간에 await 가 끼면 브라우저가 사용자
 * 제스처가 끝났다고 보고 팝업을 막는다. 그래서 준비 여부는 `calendarConsentReady()` 로
 * 먼저 확인하고, 이 함수는 기다리지 않는다.
 *
 * code 는 popup 모드라 리디렉션 없이 돌아오고, 백엔드가 `redirect_uri=postmessage` 로 교환한다.
 */
export function requestCalendarCode(): Promise<string> {
  const oauth2 = window.google?.accounts?.oauth2;
  if (!GOOGLE_CLIENT_ID || !oauth2) {
    return Promise.reject(new Error('google identity services not ready'));
  }
  return new Promise((resolve, reject) => {
    const client = oauth2.initCodeClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: CALENDAR_SCOPE,
      ux_mode: 'popup',
      callback: (r) => {
        if (r.code) resolve(r.code);
        else if (r.error === 'access_denied') reject(new CalendarConsentCancelled());
        else reject(new Error(r.error ?? 'no code'));
      },
      error_callback: (e) => {
        if (e.type === 'popup_closed') reject(new CalendarConsentCancelled());
        else reject(new Error(e.type));
      },
    });
    client.requestCode();
  });
}
