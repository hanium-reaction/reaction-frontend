import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyPlanGenerationScreen } from './WeeklyPlanGenerationScreen';
import { ApiError, plansApi } from '../lib/api';
import { useNavigation } from '../contexts/NavigationContext';
import type { components } from '../types/openapi';

vi.mock('../contexts/NavigationContext', () => ({ useNavigation: vi.fn() }));
vi.mock('../components/WeekGrid', () => ({ WeekGrid: () => <div>시간표</div>, scrollColIntoView: vi.fn() }));
vi.mock('../lib/api', async (original) => { const api = await original<typeof import('../lib/api')>(); return { ...api, plansApi: { ...api.plansApi, weekly: vi.fn(), generate: vi.fn(), approve: vi.fn(), mandalaNextCycle: vi.fn() } }; });
const draft = { aiSource: 'rule' as const, isDraft: true, planId: 'plan-b', targetDate: '2026-10-01', horizon: null, goalNodes: [], actionItems: [], generatedAt: '', blocks: [{ title: '목표 B 실행', start: '2026-09-21T09:00:00+09:00', end: '2026-09-21T09:30:00+09:00', category: 'study', origin: 'goal' as const, originId: 'b' }] } satisfies components['schemas']['FirstPlanResponse'];
describe('계획 생성·승인 계약 (#340 #285)', () => {
  const nav = { interviewSessionId: null, plannedMilestones: null, planGoalId: 'goal-b', planAxisId: null, setScreen: vi.fn(), setPlanGoalId: vi.fn(), setPlanAxisId: vi.fn() };
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    vi.mocked(useNavigation).mockReturnValue(nav as unknown as ReturnType<typeof useNavigation>);
    vi.mocked(plansApi.weekly).mockResolvedValue({ planId: '', days: [], weekStart: '', weekEnd: '' });
    vi.mocked(plansApi.generate).mockResolvedValue(draft);
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('410 만료 후에는 같은 초안을 승인할 수 없고 재생성해야 한다', async () => {
    vi.mocked(plansApi.approve).mockRejectedValue(new ApiError('PLAN_DRAFT_EXPIRED', '만료', 410));
    const done = vi.fn();
    render(<WeeklyPlanGenerationScreen onContinue={done} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '이대로 시작' })); });
    expect(screen.getByRole('button', { name: '이대로 시작' })).toBeDisabled();
    expect(done).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '재생성' })); await vi.advanceTimersByTimeAsync(1500); });
    expect(screen.getByRole('button', { name: '이대로 시작' })).not.toBeDisabled();
  });
  it.each([
    ['GOAL_TIER_LIMIT_EXCEEDED', '목표 화면에서 Focus·Maintain 개수 정리하기', 'goals'],
    ['COMMON_VALIDATION_ERROR', '설정에서 활동 시간대 확인', 'settings'],
  ])('축 계획의 %s 오류에 필요한 화면으로 안내한다', async (code, label, target) => {
    vi.mocked(useNavigation).mockReturnValue({ ...nav, planGoalId: null, planAxisId: 'axis-a' } as unknown as ReturnType<typeof useNavigation>);
    vi.mocked(plansApi.mandalaNextCycle).mockRejectedValue(new ApiError(code, '입력을 확인하세요', 422));
    render(<WeeklyPlanGenerationScreen onContinue={vi.fn()} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    fireEvent.click(screen.getByText(label));
    expect(nav.setScreen).toHaveBeenCalledWith(target);
    expect(plansApi.generate).not.toHaveBeenCalled();
    expect(plansApi.mandalaNextCycle).toHaveBeenCalledTimes(1);
  });
  it.each([409, 422, 503])('승인 %s 실패 시 성공 이동 없이 동일 키로 재시도한다', async (status) => {
    vi.mocked(plansApi.approve).mockRejectedValueOnce(new ApiError('FAIL', '승인 실패', status)).mockResolvedValueOnce({ planId: 'plan-b' } as Awaited<ReturnType<typeof plansApi.approve>>);
    const done = vi.fn(); render(<WeeklyPlanGenerationScreen onContinue={done} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(plansApi.generate).toHaveBeenCalledWith(expect.objectContaining({ goalId: 'goal-b' }), expect.any(String));
    expect(plansApi.approve).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '이대로 시작' })); });
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('승인 실패');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '이대로 시작' })); });
    expect(done).toHaveBeenCalledTimes(1);
    expect(plansApi.approve).toHaveBeenNthCalledWith(1, 'plan-b', 'approve-plan-b');
    expect(plansApi.approve).toHaveBeenNthCalledWith(2, 'plan-b', 'approve-plan-b');
  });
});
