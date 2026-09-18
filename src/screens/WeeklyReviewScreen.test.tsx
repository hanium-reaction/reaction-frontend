import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WeeklyReviewScreenV2 } from './WeeklyReviewScreen';
import { reviewsApi } from '../lib/api';
import { useNavigation } from '../contexts/NavigationContext';

vi.mock('../contexts/NavigationContext', () => ({ useNavigation: vi.fn() }));
vi.mock('../lib/api', async (original) => {
  const api = await original<typeof import('../lib/api')>();
  return { ...api, reviewsApi: { ...api.reviewsApi, weekly: vi.fn(), habitPenalty: vi.fn() } };
});

describe('주간 리뷰 실제 기록과 목표 선택', () => {
  const navigate = { setScreen: vi.fn(), setTab: vi.fn(), setWeekOffset: vi.fn(), setInterviewSessionId: vi.fn(), setPlannedMilestones: vi.fn(), setPlanGoalId: vi.fn(), setPlanAxisId: vi.fn() };
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useNavigation).mockReturnValue(navigate as unknown as ReturnType<typeof useNavigation>);
    vi.mocked(reviewsApi.habitPenalty).mockResolvedValue({ candidates: [] });
  });
  it('서버 실패를 오류로 표시하고 재시도 성공 후에만 지표를 보여준다 (#343)', async () => {
    vi.mocked(reviewsApi.weekly).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ adherenceRate: 0.5 } as Awaited<ReturnType<typeof reviewsApi.weekly>>);
    render(<WeeklyReviewScreenV2 />);
    expect(await screen.findByRole('alert')).toHaveTextContent('주간 리뷰를 불러오지 못했어요');
    expect(screen.queryByText('주간 점수')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('다시 시도'));
    expect(await screen.findByText('주간 점수')).toBeInTheDocument();
    expect(reviewsApi.weekly).toHaveBeenCalledTimes(2);
  });
  it('다음 주기에서 사용자가 고른 목표 ID를 넘기고 이전 마일스톤을 비운다 (#340)', async () => {
    vi.mocked(reviewsApi.weekly).mockResolvedValue({ nextCycleProposals: [{ goalId: 'goal-b', goalTitle: '두 번째 목표' }] } as Awaited<ReturnType<typeof reviewsApi.weekly>>);
    render(<WeeklyReviewScreenV2 />);
    fireEvent.click(await screen.findByText('다음 주기 초안 보기'));
    expect(navigate.setPlanGoalId).toHaveBeenCalledWith('goal-b');
    expect(navigate.setPlannedMilestones).toHaveBeenCalledWith(null);
    expect(navigate.setInterviewSessionId).toHaveBeenCalledWith(null);
    expect(navigate.setScreen).toHaveBeenCalledWith('weekly-plan');
  });
});
