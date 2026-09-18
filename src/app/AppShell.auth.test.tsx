import { useContext } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { NavigationContext } from '../contexts/NavigationContext';
import { clearSession, setSession } from '../lib/tokenStore';

vi.mock('./ReActionMerged', () => ({ ReActionMerged: () => {
  const navigation = useContext(NavigationContext);
  return <button onClick={() => navigation?.logout()}>로그아웃 테스트</button>;
} }));
vi.mock('./DesktopSidebar', () => ({ DesktopSidebar: () => null }));
vi.mock('../screens/LoginScreen', () => ({ LoginScreen: () => <div>로그인 화면</div> }));
vi.mock('../components/IosInstallCard', () => ({ IosInstallCard: () => null }));
vi.mock('../lib/push', () => ({ markNotificationOpenedFromLaunch: vi.fn() }));

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const unauthorized = () => json({ code: 'AUTH_INVALID_TOKEN', message: 'expired' }, 401);
const fetchMock = vi.fn();
beforeEach(() => {
  clearSession();
  fetchMock.mockReset();
  vi.stubEnv('VITE_ALLOW_STUB_LOGIN', 'false');
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { clearSession(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('access 없이 부팅해 쿠키로 복원한 뒤 로그아웃하고 재방문하면 로그인 화면을 보여준다', async () => {
  let loggedOut = false;
  let meCalls = 0;
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith('/auth/refresh')) return Promise.resolve(loggedOut ? unauthorized() : json({ accessToken: 'renewed' }));
    if (url.endsWith('/auth/logout')) { loggedOut = true; return Promise.resolve(new Response(null, { status: 204 })); }
    if (url.endsWith('/auth/me')) return Promise.resolve(loggedOut || ++meCalls === 1 ? unauthorized() : json({ userId: 'user', onboardingState: 'ACTIVE' }));
    return Promise.resolve(json({ currentState: 'ACTIVE' }));
  });
  const view = render(<AppShell />);
  expect(screen.queryByText('로그인 화면')).not.toBeInTheDocument();
  fireEvent.click(await screen.findByText('로그아웃 테스트'));
  await screen.findByText('로그인 화면');
  expect(fetchMock.mock.calls.find(([url]) => url.endsWith('/auth/logout'))?.[1]).toMatchObject({ body: '{}', credentials: 'include' });
  view.unmount();
  render(<AppShell />);
  await screen.findByText('로그인 화면');
  expect(screen.queryByText('로그아웃 테스트')).not.toBeInTheDocument();
});

it('실제 세션 만료가 개발용 자동 데모 로그인으로 바뀌지 않는다', async () => {
  setSession({ accessToken: 'expired' }, 'real');
  vi.stubEnv('VITE_ALLOW_STUB_LOGIN', 'true');
  fetchMock.mockImplementation(() => Promise.resolve(unauthorized()));
  render(<AppShell />);
  await waitFor(() => expect(screen.getByText('로그인 화면')).toBeInTheDocument());
  expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/auth/google'))).toBe(false);
});
