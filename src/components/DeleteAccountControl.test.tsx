import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeleteAccountControl } from './DeleteAccountControl';
import { settingsApi } from '../lib/api';

vi.mock('../lib/api', async (original) => { const api = await original<typeof import('../lib/api')>(); return { ...api, settingsApi: { ...api.settingsApi, deleteAccount: vi.fn() } }; });
describe('계정 삭제 2단계 확인 (#237)', () => {
  beforeEach(() => vi.clearAllMocks());
  it('안내 요청 후에는 삭제하지 않고 명시 확인 후에만 토큰을 보내고 로그아웃한다', async () => {
    vi.mocked(settingsApi.deleteAccount).mockResolvedValueOnce({ status: 'confirmation_required', message: '서버의 삭제 범위 안내', confirmationToken: 'confirmation-only' }).mockResolvedValueOnce({ status: 'deleted', message: '삭제 완료' });
    const deleted = vi.fn(); render(<DeleteAccountControl onDeleted={deleted} />);
    fireEvent.click(screen.getByText('계정 삭제 안내 확인'));
    expect(await screen.findByText('서버의 삭제 범위 안내')).toBeInTheDocument();
    expect(deleted).not.toHaveBeenCalled();
    expect(settingsApi.deleteAccount).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('확인했어요. 계정 삭제'));
    await waitFor(() => expect(deleted).toHaveBeenCalledTimes(1));
    expect(settingsApi.deleteAccount).toHaveBeenLastCalledWith('confirmation-only');
  });
  it('취소하면 최종 삭제 요청을 보내지 않는다', async () => {
    vi.mocked(settingsApi.deleteAccount).mockResolvedValue({ status: 'confirmation_required', message: '안내', confirmationToken: 'token' });
    const deleted = vi.fn(); render(<DeleteAccountControl onDeleted={deleted} />);
    fireEvent.click(screen.getByText('계정 삭제 안내 확인'));
    fireEvent.click(await screen.findByText('취소'));
    expect(settingsApi.deleteAccount).toHaveBeenCalledTimes(1);
    expect(deleted).not.toHaveBeenCalled();
  });
});
