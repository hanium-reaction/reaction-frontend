import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CalendarConnectCard } from './CalendarConnectCard';
import { ApiError, calendarApi } from '../lib/api';
import { CalendarConsentCancelled, requestCalendarCode } from '../lib/googleIdentity';
import { ToastProvider } from '../contexts/ToastContext';

vi.mock('../lib/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/api')>();
  return {
    ...original,
    calendarApi: { ...original.calendarApi, status: vi.fn(), connect: vi.fn(), disconnect: vi.fn() },
  };
});

vi.mock('../lib/googleIdentity', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/googleIdentity')>();
  return {
    ...original,
    GOOGLE_CLIENT_ID: 'test-client',
    calendarConsentReady: () => true,
    requestCalendarCode: vi.fn(),
  };
});

const api = calendarApi as unknown as {
  status: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};
const consent = requestCalendarCode as unknown as ReturnType<typeof vi.fn>;

const off = { provider: 'google', connected: false, scopes: [] };
const on = { provider: 'google', connected: true, scopes: ['https://www.googleapis.com/auth/calendar.freebusy'] };

function view() {
  return render(
    <ToastProvider>
      <CalendarConnectCard />
    </ToastProvider>,
  );
}

describe('CalendarConnectCard', () => {
  beforeEach(() => {
    api.status.mockReset();
    api.connect.mockReset();
    api.disconnect.mockReset();
    consent.mockReset();
  });

  it('서버 설정 전(501)이면 준비 중으로 두고 연결 버튼을 주지 않는다', async () => {
    api.status.mockRejectedValue(new ApiError('COMMON_NOT_IMPLEMENTED', '준비 중', 501));
    view();
    expect(await screen.findByText('준비 중')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '연결' })).not.toBeInTheDocument();
  });

  it('동의 팝업에서 받은 code 를 서버로 보내고 연결됨으로 바뀐다', async () => {
    api.status.mockResolvedValue(off);
    consent.mockResolvedValue('code-1');
    api.connect.mockResolvedValue(on);
    view();

    fireEvent.click(await screen.findByRole('button', { name: '연결' }));

    expect(await screen.findByText('Google 캘린더 연결됨')).toBeInTheDocument();
    expect(api.connect).toHaveBeenCalledWith('code-1');
  });

  it('팝업을 닫으면 서버를 부르지 않고 오류도 띄우지 않는다', async () => {
    api.status.mockResolvedValue(off);
    consent.mockRejectedValue(new CalendarConsentCancelled());
    view();

    fireEvent.click(await screen.findByRole('button', { name: '연결' }));

    await waitFor(() => expect(screen.getByRole('button', { name: '연결' })).not.toBeDisabled());
    expect(api.connect).not.toHaveBeenCalled();
    expect(screen.queryByText(/연결하지 못했어요/)).not.toBeInTheDocument();
  });

  it('422 는 서버가 준 안내 문구를 그대로 보여준다 (캘린더 체크 해제 등)', async () => {
    api.status.mockResolvedValue(off);
    consent.mockResolvedValue('code-1');
    api.connect.mockRejectedValue(
      new ApiError('COMMON_VALIDATION_ERROR', '캘린더 권한이 허용되지 않았어요. 연결할 때 캘린더 항목을 체크해 주세요.', 422),
    );
    view();

    fireEvent.click(await screen.findByRole('button', { name: '연결' }));

    expect(await screen.findByText(/캘린더 항목을 체크해 주세요/)).toBeInTheDocument();
    expect(screen.getByText('Google 캘린더 연결')).toBeInTheDocument();
  });

  it('연결된 상태에서 해제하면 다시 연결 버튼이 나온다', async () => {
    api.status.mockResolvedValue(on);
    api.disconnect.mockResolvedValue(undefined);
    view();

    fireEvent.click(await screen.findByRole('button', { name: '해제' }));

    expect(await screen.findByRole('button', { name: '연결' })).toBeInTheDocument();
    expect(api.disconnect).toHaveBeenCalledTimes(1);
  });
});
