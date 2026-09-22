import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MandalaDraftScreen } from './MandalaDraftScreen';
import { ApiError, goalsApi, plansApi } from '../lib/api';
import { ToastProvider } from '../contexts/ToastContext';
import type { components } from '../types/openapi';

vi.mock('../lib/api', async (original) => { const api = await original<typeof import('../lib/api')>(); return { ...api, goalsApi: { ...api.goalsApi, rebuildPreflight: vi.fn() }, plansApi: { ...api.plansApi, mandalaSubgoals: vi.fn(), mandalaGet: vi.fn(), mandalaApprove: vi.fn() } }; });
const preflight = { goalId: 'g', rootNodeId: 'root', statement: '장기 목표', hasTree: true, totalCells: 73, completedCells: 3, liveActionItems: 2, promotedAxes: [{ orderIndex: 0, axisTitle: '학업', goalId: 'child', goalTitle: '졸업', goalStatus: 'active', goalTier: 'focus' as const }], linkedHabits: [], warnings: ['같은 제목의 자리만 연결이 이어집니다.'] } satisfies components['schemas']['MandalaRebuildPreflightResponse'];
describe('만다라 다시 세우기 사전 확인 (#310)', () => {
  beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear();
    vi.mocked(goalsApi.rebuildPreflight).mockResolvedValue(preflight);
    vi.mocked(plansApi.mandalaSubgoals).mockReturnValue(new Promise(() => {}));
  });
  it('만료된 만다라트는 확정과 부분 재생성을 막고 새 초안으로 안내한다', async () => {
    localStorage.setItem('reaction.mandalaPlanId.g', 'old');
    vi.mocked(goalsApi.rebuildPreflight).mockResolvedValue({ ...preflight, hasTree: false });
    vi.mocked(plansApi.mandalaGet).mockResolvedValue({
      planId: 'old', goalId: 'g', center: { title: '장기 목표' },
      subgoals: Array.from({ length: 8 }, (_, orderIndex) => ({ orderIndex, title: '학업' })),
      cells: [], gaps: [], generatedAt: '', aiSource: 'rule', isDraft: true,
    });
    vi.mocked(plansApi.mandalaApprove).mockRejectedValue(new ApiError('PLAN_DRAFT_EXPIRED', '만료', 410));
    view();
    fireEvent.click(await screen.findByRole('button', { name: /이대로 확정하기/ }));
    await screen.findByText(/초안이 만료됐어요/);
    expect(screen.getByRole('button', { name: /이대로 확정하기/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /이 축의 8칸만 다시 만들기/ })).toBeDisabled();
    vi.mocked(plansApi.mandalaSubgoals).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: '다시 만들기' }));
    await waitFor(() => expect(plansApi.mandalaSubgoals).toHaveBeenCalledTimes(1));
    await screen.findByText('하위 목표를 만들지 못했어요.');
    expect(screen.getByRole('button', { name: /이대로 확정하기/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다시 만들기' })).toBeEnabled();
  });
  const view = () => render(<ToastProvider><MandalaDraftScreen goalId="g" onApproved={vi.fn()} onLeave={vi.fn()} /></ToastProvider>);
  it('경고와 승격한 목표를 보여주고 확인 전에는 생성하지 않는다', async () => {
    view();
    expect(await screen.findByText('같은 제목의 자리만 연결이 이어집니다.')).toBeInTheDocument();
    expect(screen.getByText('승격한 축: 학업 → 졸업')).toBeInTheDocument();
    expect(plansApi.mandalaSubgoals).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('확인하고 초안 만들기'));
    await waitFor(() => expect(plansApi.mandalaSubgoals).toHaveBeenCalledWith({ goalId: 'g' }));
  });
  it('처음 세울 때는 사전 확인 시트를 건너뛴다', async () => {
    vi.mocked(goalsApi.rebuildPreflight).mockResolvedValue({ ...preflight, hasTree: false });
    view();
    await waitFor(() => expect(plansApi.mandalaSubgoals).toHaveBeenCalledTimes(1));
  });
  it('영향 조회 실패 시 생성하지 않는다', async () => {
    vi.mocked(goalsApi.rebuildPreflight).mockRejectedValue(new Error('offline'));
    view();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(plansApi.mandalaSubgoals).not.toHaveBeenCalled();
  });
});
