import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyReplanCard } from './WeeklyReplanCard';
import { ApiError, plansApi } from '../lib/api';
import type { components } from '../types/openapi';

vi.mock('../lib/api', async (original) => {
  const api = await original<typeof import('../lib/api')>();
  return { ...api, plansApi: { ...api.plansApi, generateReplan: vi.fn(), approveReplan: vi.fn() } };
});
const draft = { aiSource: 'rule' as const, isDraft: true, planId: 'draft-1', windowStart: '2026-09-21', horizon: null, generatedAt: '2026-09-18T00:00:00Z', blocks: [{ actionId: 'a', title: '다시 배치할 일', category: 'study', start: '2026-09-21T09:00:00+09:00', end: '2026-09-21T09:30:00+09:00', replacesBlockId: 'old' }], warnings: ['캘린더 확인 범위 안내'] } satisfies components['schemas']['ReplanResponse'];
describe('주간 재계획 명시 승인 (#342)', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(plansApi.generateReplan).mockResolvedValue(draft); });
  it('초안만 만들면 승인하지 않고, 사용자 확인 후에만 적용한다', async () => {
    vi.mocked(plansApi.approveReplan).mockResolvedValue({ planId: 'draft-1', cancelledBlocks: 1, createdBlocks: 1, skippedBlocks: 0, activatedAt: '' });
    const done = vi.fn(); render(<WeeklyReplanCard onApproved={done} />);
    fireEvent.click(screen.getByText('남은 일 다시 배치'));
    expect(await screen.findByText('다시 배치할 일')).toBeInTheDocument();
    expect(screen.getByText('캘린더 확인 범위 안내')).toBeInTheDocument();
    expect(plansApi.approveReplan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('확인하고 적용'));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    expect(plansApi.approveReplan).toHaveBeenCalledWith('draft-1', 'weekly-replan-draft-1');
  });
  it.each([409, 429, 410, 503])('승인 %s 오류는 성공으로 넘기지 않는다', async (status) => {
    vi.mocked(plansApi.approveReplan).mockRejectedValue(new ApiError('FAIL', '저장 실패', status));
    const done = vi.fn(); render(<WeeklyReplanCard onApproved={done} />);
    fireEvent.click(screen.getByText('남은 일 다시 배치'));
    fireEvent.click(await screen.findByText('확인하고 적용'));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(done).not.toHaveBeenCalled();
  });
  it('취소하면 승인 요청을 보내지 않는다', async () => {
    render(<WeeklyReplanCard onApproved={vi.fn()} />);
    fireEvent.click(screen.getByText('남은 일 다시 배치'));
    fireEvent.click(await screen.findByText('취소'));
    expect(plansApi.approveReplan).not.toHaveBeenCalled();
  });
});
