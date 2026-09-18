import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalCompletionControl } from './GoalCompletionControl';
import { ApiError, goalsApi } from '../lib/api';

vi.mock('../lib/api', async (original) => { const api = await original<typeof import('../lib/api')>(); return { ...api, goalsApi: { ...api.goalsApi, complete: vi.fn() } }; });
describe('목표 완료 확인 (#344)', () => {
  beforeEach(() => vi.clearAllMocks());
  it('정리 범위를 확인하기 전에는 완료 요청을 보내지 않는다', async () => {
    vi.mocked(goalsApi.complete).mockResolvedValue({ goalId: 'g', title: '목표', status: 'completed' } as Awaited<ReturnType<typeof goalsApi.complete>>);
    const changed = vi.fn(); render(<GoalCompletionControl goalId="g" title="목표" completed={false} onChanged={changed} />);
    fireEvent.click(screen.getByText('목표 완료'));
    expect(screen.getByText(/남은 예정 카드와 일정이 정리/)).toBeInTheDocument();
    expect(goalsApi.complete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('확인'));
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(goalsApi.complete).toHaveBeenCalledWith('g', true);
  });
  it('되돌리기 한도 오류는 완료 상태를 그대로 유지한다', async () => {
    vi.mocked(goalsApi.complete).mockRejectedValue(new ApiError('GOAL_TIER_LIMIT_EXCEEDED', '집중 목표를 먼저 정리해 주세요.', 422));
    const changed = vi.fn(); render(<GoalCompletionControl goalId="g" title="목표" completed onChanged={changed} />);
    fireEvent.click(screen.getByText('완료 되돌리기')); fireEvent.click(screen.getByText('확인'));
    expect(await screen.findByRole('alert')).toHaveTextContent('집중 목표를 먼저 정리');
    expect(changed).not.toHaveBeenCalled();
    expect(goalsApi.complete).toHaveBeenCalledWith('g', false);
  });
});
