import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { MilestoneConfirmScreen } from './MilestoneConfirmScreen';
import { GoalClassificationScreen } from './GoalClassificationScreen';
import { plansApi, goalsApi } from '../lib/api';
import { useNavigation } from '../contexts/NavigationContext';

vi.mock('../contexts/NavigationContext', () => ({ useNavigation: vi.fn() }));
vi.mock('../lib/api', async (original) => {
  const api = await original<typeof import('../lib/api')>();
  return { ...api, goalsApi: { ...api.goalsApi, list: vi.fn(), update: vi.fn() }, plansApi: { ...api.plansApi, milestones: vi.fn() } };
});
const nav = { interviewSessionId: null, setScreen: vi.fn(), setPlannedMilestones: vi.fn() };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(useNavigation).mockReturnValue(nav as unknown as ReturnType<typeof useNavigation>); });

it('중간 목표를 키보드로 재정렬하고 수정한 순서로 확정한다', async () => {
  vi.mocked(plansApi.milestones).mockResolvedValue({ milestones: [{ title: '첫 단계', summary: '기초' }, { title: '두 번째 단계', summary: '응용' }] });
  render(<MilestoneConfirmScreen />);
  await screen.findByDisplayValue('첫 단계');
  fireEvent.keyDown(screen.getByRole('button', { name: /2번째 중간 목표/ }), { key: 'ArrowUp' });
  fireEvent.change(screen.getByDisplayValue('두 번째 단계'), { target: { value: '먼저 할 단계' } });
  fireEvent.click(screen.getByRole('button', { name: /이대로 계획 세우기/ }));
  expect(nav.setPlannedMilestones).toHaveBeenCalledWith([{ title: '먼저 할 단계', summary: '응용' }, { title: '첫 단계', summary: '기초' }]);
});

it('분류를 변경하고 사용자가 승인할 때만 다음 단계로 이동한다', async () => {
  vi.mocked(goalsApi.list).mockResolvedValue({ focus: [{ goalId: 'goal-1', title: '학습 목표', category: 'study', goalTier: 'focus', status: 'active', priorityLevel: 1, deadline: null, estimatedMinutes: 30 }], maintain: [], parked: [] });
  const next = vi.fn();
  render(<GoalClassificationScreen onNext={next} />);
  fireEvent.click(await screen.findByRole('button', { name: /학습 목표, 현재/ }));
  fireEvent.click(screen.getByRole('button', { name: '유지' }));
  await waitFor(() => expect(goalsApi.update).toHaveBeenCalledWith('goal-1', { goalTier: 'maintain' }));
  expect(next).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: '주간 계획 생성' }));
  expect(next).toHaveBeenCalledTimes(1);
});
