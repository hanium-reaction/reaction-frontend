import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ReentryScreen } from './ReentryScreen';
import { FocusScreen } from './FocusScreen';
import { reentryApi, todayApi } from '../lib/api';
import type { ReentryState } from '../types/api';

vi.mock('../lib/api', async original => ({
  ...await original<typeof import('../lib/api')>(),
  reentryApi: { prepare: vi.fn(), start: vi.fn(), event: vi.fn() },
  todayApi: { start: vi.fn(), pause: vi.fn(), resume: vi.fn(), checkIn: vi.fn() },
}));
const task = { id: 'action_test', title: '자료 작성', status: 'todo' as const };
const state: ReentryState = {
  attemptId: 'attempt', actionId: task.id, title: task.title, actionStatus: 'planned', entryKind: 'restart',
  firstStep: '문장 하나 쓰기', executionId: null, executionStatus: null, startedAt: null,
  stepCompletedAt: null, endedAt: null, elapsedSeconds: 0, canStart: true, blockedReason: null,
};
beforeEach(() => {
  vi.clearAllMocks(); sessionStorage.clear();
  vi.mocked(reentryApi.prepare).mockResolvedValue(state);
  vi.mocked(reentryApi.event).mockResolvedValue(state);
});
it('renders a real proposal and waits for server start before opening focus', async () => {
  const onStart = vi.fn();
  vi.mocked(reentryApi.start).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...state, executionId: 'exec_real' });
  render(<ReentryScreen task={task} onStart={onStart} onBack={vi.fn()} />);
  await screen.findByDisplayValue('문장 하나 쓰기');
  fireEvent.click(screen.getByText('이 행동 시작하기'));
  await screen.findByRole('alert');
  expect(onStart).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('이 행동 시작하기'));
  await waitFor(() => expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ executionId: 'exec_real' })));
  expect(reentryApi.event).toHaveBeenCalledWith('attempt', 'viewed');
  expect(reentryApi.event).toHaveBeenCalledWith('attempt', 'start_clicked');
  expect(reentryApi.event).toHaveBeenCalledWith('attempt', 'start_failed');
});
it('requires a user action when no first step exists, without inventing history', async () => {
  vi.mocked(reentryApi.prepare).mockResolvedValue({ ...state, firstStep: null });
  render(<ReentryScreen task={task} onStart={vi.fn()} onBack={vi.fn()} />);
  await screen.findByText(/저장된 첫 행동이 없어요/);
  expect(screen.getByText('이 행동 시작하기')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('이번에 할 행동 하나'), { target: { value: '자료 열기' } });
  expect(screen.getByText('이 행동 시작하기')).toBeEnabled();
});
it('does not offer starting a blocked future action', async () => {
  vi.mocked(reentryApi.prepare).mockResolvedValue({ ...state, canStart: false, blockedReason: '미래 작업' });
  render(<ReentryScreen task={task} onStart={vi.fn()} onBack={vi.fn()} />);
  await screen.findByText('미래 작업');
  expect(screen.getByText('이 행동 시작하기')).toBeDisabled();
});
it('records only the first step and restores the server execution', async () => {
  const complete = vi.fn();
  vi.mocked(reentryApi.event).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(state);
  render(<FocusScreen task={task} reentry={{ ...state, executionId: 'exec_server', startedAt: new Date().toISOString() }}
    elapsedMin={0} totalMin={30} onPause={vi.fn()} onComplete={complete} onBack={vi.fn()} onStopWithResult={vi.fn()} />);
  fireEvent.click(screen.getByText('첫 행동 했어요'));
  await screen.findByRole('alert');
  expect(screen.queryByText(/첫 행동을 기록했어요/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('첫 행동 했어요'));
  await screen.findByText(/첫 행동을 기록했어요/);
  expect(todayApi.start).not.toHaveBeenCalled();
  expect(todayApi.checkIn).not.toHaveBeenCalled();
  expect(complete).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /전체 과제 완료/ })).toBeInTheDocument();
});

it('쉬기 저장 실패는 화면을 유지하고 저장 후에만 돌아간다', async () => {
  const back = vi.fn();
  vi.mocked(reentryApi.event).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(state);
  render(<FocusScreen task={task} reentry={{ ...state, executionId: 'exec_server', startedAt: new Date().toISOString(), stepCompletedAt: new Date().toISOString() }}
    elapsedMin={0} totalMin={30} onPause={vi.fn()} onComplete={vi.fn()} onBack={back} onStopWithResult={vi.fn()} />);
  fireEvent.click(screen.getByText('여기까지 하고 쉬기'));
  await screen.findByRole('alert');
  expect(back).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('여기까지 하고 쉬기'));
  await waitFor(() => expect(back).toHaveBeenCalledOnce());
  expect(todayApi.pause).not.toHaveBeenCalled();
});
