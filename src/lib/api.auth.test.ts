import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ native: false }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => platform.native } }));
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const unauthorized = () => json({ code: 'AUTH_INVALID_TOKEN', message: 'expired' }, 401);
let api: typeof import('./api');
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules();
  platform.native = false;
  localStorage.clear();
  vi.stubEnv('VITE_ALLOW_STUB_LOGIN', 'false');
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  api = await import('./api');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it.each([true, false])('웹 access 유무(%s)에 관계없이 쿠키 갱신 후 원 요청을 재시도한다', async (hasAccess) => {
  if (hasAccess) api.setSession({ accessToken: 'expired' }, 'real');
  fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(json({ accessToken: 'renewed' })).mockResolvedValueOnce(json({ userId: 'user' }));
  expect(await api.authApi.me()).toEqual({ userId: 'user' });
  expect(fetchMock.mock.calls[1]).toEqual(['/api/auth/refresh', expect.objectContaining({ body: '{}', credentials: 'include' })]);
  expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer renewed');
  expect(localStorage.getItem('reaction.refreshToken')).toBeNull();
});

it('동시에 401을 받은 요청은 refresh 한 번을 공유한다', async () => {
  let finish!: (response: Response) => void;
  let meCalls = 0;
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith('/refresh')) return new Promise<Response>((resolve) => { finish = resolve; });
    return Promise.resolve(++meCalls <= 2 ? unauthorized() : json({ userId: 'user' }));
  });
  const requests = Promise.all([api.authApi.me(), api.authApi.me()]);
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  finish(json({ accessToken: 'renewed' }));
  await requests;
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/refresh'))).toHaveLength(1);
});

it('쿠키가 없거나 만료되면 갱신을 반복하지 않고 인증 실패를 반환한다', async () => {
  api.setSession({ accessToken: 'expired' }, 'real');
  const expired = vi.fn();
  api.onAuthExpired(expired);
  fetchMock.mockImplementation(() => Promise.resolve(unauthorized()));
  await expect(api.authApi.me()).rejects.toMatchObject({ status: 401 });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(expired).toHaveBeenCalledOnce();
  expect(api.getAccessToken()).toBeNull();
});

it('로그아웃은 access 토큰 없이 쿠키로 호출하며 401에도 refresh하지 않는다', async () => {
  fetchMock.mockResolvedValueOnce(unauthorized());
  await expect(api.authApi.logout()).rejects.toMatchObject({ status: 401 });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ body: '{}', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }));
});

it.each([true, false])('네이티브는 저장된 refresh 토큰(%s)만 사용한다', async (hasRefresh) => {
  platform.native = true;
  vi.resetModules();
  // 실제 Keychain을 변경하지 않고 네이티브에서 읽어 온 메모리 값을 제공한다.
  vi.doMock('./tokenStore', () => ({ getRefreshToken: () => hasRefresh ? 'secure-refresh' : null, getAccessToken: () => 'expired', getAuthKind: () => 'real', setSession: vi.fn(), clearSession: vi.fn(), initTokenStore: vi.fn() }));
  const nativeApi = await import('./api');
  fetchMock.mockResolvedValueOnce(unauthorized()).mockResolvedValueOnce(json({ accessToken: 'renewed' })).mockResolvedValueOnce(json({ userId: 'user' }));
  if (hasRefresh) {
    await nativeApi.authApi.me();
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ body: '{"refreshToken":"secure-refresh"}', credentials: 'same-origin' });
  } else {
    await expect(nativeApi.authApi.me()).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }
  vi.doUnmock('./tokenStore');
});
