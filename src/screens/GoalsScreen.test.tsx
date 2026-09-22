import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { GoalsScreen } from './GoalsScreen';
import { goalsApi } from '../lib/api';
import type { ApiGoal } from '../types/api';

vi.mock('../contexts/NavigationContext', () => ({ useNavigation: () => ({}) }));
vi.mock('../lib/api', async (original) => {
  const api = await original<typeof import('../lib/api')>();
  return { ...api, goalsApi: { ...api.goalsApi, list: vi.fn(), complete: vi.fn() } };
});
it('완료 성공 후 목록 재조회 실패에도 완료 배지를 유지한다 (#344)', async () => {
  const goal: ApiGoal = { goalId: 'goal-1', title: '테스트 목표', category: 'study', goalTier: 'focus', status: 'active', priorityLevel: 1, deadline: null, estimatedMinutes: 30 };
  vi.mocked(goalsApi.list).mockResolvedValueOnce({ focus: [goal], maintain: [], parked: [] }).mockRejectedValueOnce(new Error('offline'));
  vi.mocked(goalsApi.complete).mockResolvedValue({ ...goal, status: 'completed' });
  render(<GoalsScreen />);
  fireEvent.click(await screen.findByText('테스트 목표'));
  fireEvent.click(screen.getByText('목표 완료'));
  fireEvent.click(screen.getByText('확인'));
  expect(await screen.findByText('테스트 목표 · 완료')).toBeInTheDocument();
  expect(await screen.findByText('목표를 불러오지 못했어요.')).toBeInTheDocument();
  expect(goalsApi.complete).toHaveBeenCalledWith('goal-1', true);
});
