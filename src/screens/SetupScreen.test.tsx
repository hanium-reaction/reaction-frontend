import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {SetupScreen} from './SetupScreen';
import {fixedSchedulesApi,timePoliciesApi,notificationsApi} from '../lib/api';
import {subscribePush} from '../lib/push';
vi.mock('../contexts/ToastContext',()=>({useToast:()=>({success:vi.fn(),error:vi.fn()})}));
vi.mock('../components/CalendarConnectCard',()=>({CalendarConnectCard:()=>null}));
vi.mock('../lib/push',()=>({subscribePush:vi.fn()}));
vi.mock('../lib/api',async original=>({...await original<typeof import('../lib/api')>(),fixedSchedulesApi:{list:vi.fn()},timePoliciesApi:{list:vi.fn()},notificationsApi:{getSettings:vi.fn(),subscribe:vi.fn(),updateSettings:vi.fn()}}));
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('VITE_REENTRY_P0','true');
 vi.mocked(fixedSchedulesApi.list).mockResolvedValue([]);vi.mocked(timePoliciesApi.list).mockResolvedValue([]);
 vi.mocked(notificationsApi.getSettings).mockResolvedValue({pushSubscribed:false} as never);
});
afterEach(()=>vi.unstubAllEnvs());
it('설정을 건너뛰면 알림 권한이나 서버 설정을 변경하지 않는다',async()=>{
 const done=vi.fn();render(<SetupScreen onDone={done}/>);
 fireEvent.click(await screen.findByText('나중에 설정하고 계속'));
 expect(done).toHaveBeenCalledOnce();expect(subscribePush).not.toHaveBeenCalled();expect(notificationsApi.updateSettings).not.toHaveBeenCalled();
});
it('권한 거부나 미지원이면 예약 완료로 표시하지 않고 계속 진행할 수 있다',async()=>{
 vi.mocked(subscribePush).mockResolvedValue(null);const done=vi.fn();render(<SetupScreen onDone={done}/>);
 await waitFor(()=>expect(screen.getByText('원할 때만 알림 연결')).toBeEnabled());
 fireEvent.click(screen.getByText('원할 때만 알림 연결'));
 await screen.findByText(/이 기기에서 알림을 연결하지 못했어요/);
 expect(notificationsApi.subscribe).not.toHaveBeenCalled();fireEvent.click(screen.getByText('나중에 설정하고 계속'));expect(done).toHaveBeenCalledOnce();
});
it('서버 구독 저장 실패를 연결 성공으로 표시하지 않는다',async()=>{
 vi.mocked(subscribePush).mockResolvedValue({endpoint:'https://push.example',keys:{auth:'a',p256dh:'b'}});
 vi.mocked(notificationsApi.subscribe).mockRejectedValue(new Error('offline'));render(<SetupScreen onDone={vi.fn()}/>);
 await waitFor(()=>expect(screen.getByText('원할 때만 알림 연결')).toBeEnabled());fireEvent.click(screen.getByText('원할 때만 알림 연결'));
 await screen.findByText(/알림 구독을 저장하지 못했어요/);expect(screen.getByText(/서버 구독:/)).toHaveTextContent('확인되지 않음');
});
