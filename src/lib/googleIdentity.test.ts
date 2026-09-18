import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// GOOGLE_CLIENT_ID 를 모듈 로드 시점에 읽으므로 env 를 먼저 심고 새로 import 한다.
async function load() {
  vi.resetModules();
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client');
  return import('./googleIdentity');
}

type CodeConfig = {
  client_id: string;
  scope: string;
  ux_mode: string;
  callback: (r: { code?: string; error?: string }) => void;
  error_callback?: (e: { type: string }) => void;
};

function stubGis(onRequest: (cfg: CodeConfig) => void) {
  const initCodeClient = vi.fn((cfg: CodeConfig) => ({ requestCode: () => onRequest(cfg) }));
  (window as unknown as { google: unknown }).google = { accounts: { oauth2: { initCodeClient } } };
  return initCodeClient;
}

describe('requestCalendarCode', () => {
  beforeEach(() => {
    delete (window as unknown as { google?: unknown }).google;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('freebusy 스코프 하나로 popup 코드 흐름을 연다 — 백엔드가 postmessage 로 교환한다', async () => {
    const initCodeClient = stubGis((cfg) => cfg.callback({ code: 'abc' }));
    const gis = await load();

    await expect(gis.requestCalendarCode()).resolves.toBe('abc');
    expect(initCodeClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client_id: 'test-client',
        scope: 'https://www.googleapis.com/auth/calendar.freebusy',
        ux_mode: 'popup',
      }),
    );
  });

  it.each([
    ['팝업을 닫음', (cfg: CodeConfig) => cfg.error_callback?.({ type: 'popup_closed' })],
    ['동의 거부', (cfg: CodeConfig) => cfg.callback({ error: 'access_denied' })],
  ])('%s → 취소로 구분한다 (오류 안내를 띄우지 않게)', async (_label, act) => {
    stubGis(act);
    const gis = await load();

    await expect(gis.requestCalendarCode()).rejects.toBeInstanceOf(gis.CalendarConsentCancelled);
  });

  it('GIS 스크립트가 아직 없으면 준비 안 됨', async () => {
    const gis = await load();
    expect(gis.calendarConsentReady()).toBe(false);
    await expect(gis.requestCalendarCode()).rejects.toThrow();
  });
});
