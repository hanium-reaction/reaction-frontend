import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    vi.mocked(plansApi.generateReplan).mockResolvedValue(draft);
  });
  it('초안만 만들면 승인하지 않고, 사용자 확인 후에만 적용한다', async () => {
    vi.mocked(plansApi.approveReplan).mockResolvedValue({ planId: 'draft-1', cancelledBlocks: 1, createdBlocks: 1, skippedBlocks: 2, activatedAt: '' });
    const done = vi.fn(); render(<WeeklyReplanCard onApproved={done} />);
    fireEvent.click(screen.getByText('남은 일 다시 배치'));
    expect(await screen.findByText('다시 배치할 일')).toBeInTheDocument();
    fireEvent.click(screen.getByText('적용 전 확인할 내용 1개'));
    expect(screen.getByText('캘린더 확인 범위 안내')).toBeInTheDocument();
    expect(plansApi.approveReplan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('확인하고 적용'));
    await waitFor(() => expect(done).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/변경된 일정 2개는 보존/)).toBeInTheDocument();
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
  it('여러 날짜의 긴 일정을 날짜순으로 묶고 내부 ID 없이 한국 시간으로 표시한다', async () => {
    vi.mocked(plansApi.generateReplan).mockResolvedValue({ ...draft, blocks: [
      { ...draft.blocks[0], actionId: 'next', title: '다음 날 검토', start: '2026-09-22T00:00:00Z', end: '2026-09-22T00:30:00Z', replacesBlockId: null },
      { ...draft.blocks[0], title: '전날 자료 정리', replacesBlockId: 'block_private-123' },
      { ...draft.blocks[0], actionId: 'late', title: '밤 작업', start: '2026-09-21T14:45:00Z', end: '2026-09-21T15:15:00Z' },
    ] });
    render(<WeeklyReplanCard onApproved={vi.fn()} />);
    fireEvent.click(screen.getByText('남은 일 다시 배치'));
    const modal = await screen.findByRole('dialog', { name: '남은 일정 미리보기' });
    expect(within(modal).getByText('전체 3개')).toBeInTheDocument();
    expect(within(modal).getByText('재배치 2개')).toBeInTheDocument();
    expect(within(modal).getByText('새 일정 1개')).toBeInTheDocument();
    expect(modal).not.toHaveTextContent('block_private-123');
    const groups = modal.querySelectorAll('.weekly-replan-day');
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('전날 자료 정리');
    expect(groups[0]).toHaveTextContent('09:00–09:30');
    expect(groups[0]).toHaveTextContent(/23:45–2026년 9월 22일.*00:15/);
    expect(groups[1]).toHaveTextContent('다음 날 검토');
    fireEvent(modal, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(plansApi.approveReplan).not.toHaveBeenCalled();
  });
  it('빈 초안은 적용할 수 없다', async () => {
    vi.mocked(plansApi.generateReplan).mockResolvedValue({ ...draft, blocks: [] });
    render(<WeeklyReplanCard onApproved={vi.fn()} />);
    fireEvent.click(screen.getByText('남은 일 다시 배치'));
    expect(await screen.findByText('다시 배치할 일정이 없어요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '확인하고 적용' })).toBeDisabled();
  });
  it('적용 중에는 중복 승인과 닫기를 막는다', async () => {
    vi.mocked(plansApi.approveReplan).mockReturnValue(new Promise(() => {}));
    render(<WeeklyReplanCard onApproved={vi.fn()} />);
    fireEvent.click(screen.getByText('남은 일 다시 배치'));
    fireEvent.click(await screen.findByText('확인하고 적용'));
    expect(screen.getByRole('button', { name: '적용하는 중…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '미리보기 닫기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    const modal = screen.getByRole('dialog');
    fireEvent(modal, new Event('cancel', { cancelable: true }));
    expect(modal).toBeInTheDocument();
    expect(plansApi.approveReplan).toHaveBeenCalledTimes(1);
  });
});
