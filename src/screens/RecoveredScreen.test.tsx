import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { RecoveredScreen } from './RecoveredScreen';
import { replanApi } from '../lib/api';

vi.mock('../lib/api', async (original) => ({
  ...await original<typeof import('../lib/api')>(),
  replanApi: { diff: vi.fn(), approve: vi.fn() },
}));
const applied = { taskTitle: '공부', failReason: '', proposalTitle: '회복', proposalDesc: '', proposalTime: '' };
beforeEach(() => vi.clearAllMocks());

it('회복 기록 없이 진입하면 일정 승인이나 알림을 약속하지 않는다', () => {
  const onDone = vi.fn();
  render(<RecoveredScreen recoveryCount={0} onDone={onDone} />);
  expect(screen.getByText('확인할 회복 기록이 없어요')).toBeInTheDocument();
  expect(screen.queryByText(/10분 뒤에 알려드릴게요/)).not.toBeInTheDocument();
  expect(screen.queryByText('일정 반영하기')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('오늘로 돌아가기'));
  expect(onDone).toHaveBeenCalledOnce();
  expect(replanApi.approve).not.toHaveBeenCalled();
});

it('일정 변경 내용이 비어 있으면 승인을 막고 다시 조회한다', async () => {
  vi.mocked(replanApi.diff).mockResolvedValueOnce({} as never).mockResolvedValueOnce({ before: { title: '공부' }, after: { title: '10분 공부', startAt: '2026-09-22T10:00:00+09:00', endAt: '2026-09-22T10:10:00+09:00' } } as never);
  render(<RecoveredScreen recoveryCount={1} executionId="exec-1" applied={applied} onDone={vi.fn()} />);
  await screen.findByText('일정 변경 내용이 비어 있어요. 다시 불러와 주세요.');
  expect(screen.getByRole('button', { name: '일정 반영하기' })).toBeDisabled();
  fireEvent.click(screen.getByText('변경 내용 다시 불러오기'));
  await screen.findByText('10분 공부');
  expect(screen.getByRole('button', { name: '일정 반영하기' })).toBeEnabled();
});

it.each(['PARK', 'RESCHEDULE'])('%s 수락은 재계획 API 없이 완료하고 선택에 맞게 안내한다', async (proposalType) => {
  const onDone = vi.fn();
  const onOpenWeekly = vi.fn();
  render(<RecoveredScreen recoveryCount={1} executionId="exec-1" applied={{ ...applied, proposalType, requiresReplan: false }} onDone={onDone} onOpenWeekly={onOpenWeekly} />);
  expect(replanApi.diff).not.toHaveBeenCalled();
  if (proposalType === 'RESCHEDULE') {
    fireEvent.click(screen.getByText('주간 계획 열기'));
    expect(onOpenWeekly).toHaveBeenCalledOnce();
  } else {
    expect(screen.getByText(/잠시 보류하고/)).toBeInTheDocument();
    expect(screen.queryByText('주간 계획 열기')).not.toBeInTheDocument();
  }
  fireEvent.click(screen.getByText('오늘로 돌아가기'));
  expect(onDone).toHaveBeenCalledOnce();
  expect(replanApi.approve).not.toHaveBeenCalled();
});

it('미리보기는 승인 전 상태이며 승인 실패 시 화면을 유지한다', async () => {
  vi.mocked(replanApi.diff).mockResolvedValue({ before: { title: '공부' }, after: { title: '10분 공부', startAt: '2026-09-05T10:00:00+09:00', endAt: '2026-09-05T10:10:00+09:00' } } as Awaited<ReturnType<typeof replanApi.diff>>);
  vi.mocked(replanApi.approve).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined as never);
  const onDone = vi.fn();
  render(<RecoveredScreen recoveryCount={1} executionId="exec-1" applied={{ ...applied, requiresReplan: true }} onDone={onDone} />);
  await screen.findByText(/변경 예정이에요/);
  expect(screen.queryByText('실제 일정에 반영됐어요')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('일정 반영하기'));
  await screen.findByText('다시 시도');
  expect(onDone).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('다시 시도'));
  await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
});
