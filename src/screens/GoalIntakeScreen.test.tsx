import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalIntakeScreen } from './GoalIntakeScreen';
import { interviewApi } from '../lib/api';
import { useNavigation } from '../contexts/NavigationContext';
import type { InterviewSession } from '../types/api';

vi.mock('../contexts/NavigationContext', () => ({ useNavigation: vi.fn() }));
vi.mock('../lib/api', async (original) => {
  const api = await original<typeof import('../lib/api')>();
  return { ...api, interviewApi: { ...api.interviewApi, start: vi.fn(), get: vi.fn(), finish: vi.fn(), slotCatalog: vi.fn(), nextQuestion: vi.fn(), submitAnswer: vi.fn() } };
});
vi.mock('../components/MaterialsResearch', () => ({
  MaterialsResearch: ({ onSaved, onConfirmed }: { onSaved: () => void; onConfirmed: () => Promise<void> }) => <>
    <button onClick={onSaved}>자료 저장 테스트</button>
    <button onClick={() => void onConfirmed()}>자료로 계속 테스트</button>
  </>,
}));
const session: InterviewSession = { sessionId: 's', ambiguityScore: 1, totalTurns: 10, endReason: null, currentQuestion: { slotKey: 'goals.materials', text: '사용할 자료는요?', answerType: 'text', options: [] } };
describe('인터뷰 자료 확정 후 이동', () => {
  beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
    vi.mocked(useNavigation).mockReturnValue({ setInterviewSessionId: vi.fn(), setPlanGoalId: vi.fn(), setPlanAxisId: vi.fn() } as unknown as ReturnType<typeof useNavigation>);
    vi.mocked(interviewApi.start).mockResolvedValue(session);
    vi.mocked(interviewApi.get).mockResolvedValue(session);
    vi.mocked(interviewApi.finish).mockResolvedValue({ ...session, endReason: 'early_user' });
    vi.mocked(interviewApi.slotCatalog).mockResolvedValue([]);
    vi.mocked(interviewApi.nextQuestion).mockResolvedValue({ ...session, endReason: 'completed', currentQuestion: null });
  });
  afterEach(() => vi.restoreAllMocks());
  it('StrictMode 재마운트에도 세션을 한 번만 생성하고 다시 들어오면 서버 질문을 복구한다', async () => {
    const first = render(<StrictMode><GoalIntakeScreen onDone={vi.fn()} /></StrictMode>);
    await screen.findByText('사용할 자료는요?');
    expect(interviewApi.start).toHaveBeenCalledTimes(1);
    first.unmount();
    vi.mocked(interviewApi.get).mockResolvedValue({ ...session, totalTurns: 11, currentQuestion: { ...session.currentQuestion!, text: '다음 질문이에요' } });
    render(<GoalIntakeScreen onDone={vi.fn()} />);
    await screen.findByText('다음 질문이에요');
    expect(interviewApi.start).toHaveBeenCalledTimes(1);
    expect(interviewApi.finish).not.toHaveBeenCalled();
    expect(interviewApi.submitAnswer).not.toHaveBeenCalled();
  });
  it('완료된 인터뷰는 outcome을 복구하고 새 목표를 생성하지 않는다', async () => {
    localStorage.setItem('reaction.interviewSessionId', 's');
    const outcome = { sessionId: 's', endReason: 'completed' as const, ambiguityFinal: 0, coreGoals: [] };
    vi.mocked(interviewApi.get).mockResolvedValue({ ...session, endReason: 'completed', currentQuestion: null, outcome });
    const onOutcome = vi.fn();
    render(<GoalIntakeScreen onDone={vi.fn()} onOutcome={onOutcome} />);
    await waitFor(() => expect(onOutcome).toHaveBeenCalledWith(outcome));
    expect(interviewApi.start).not.toHaveBeenCalled();
    expect(interviewApi.finish).not.toHaveBeenCalled();
  });
  it('새로 시작 확인 취소 시 보존하고 확인한 경우에만 세션을 교체한다', async () => {
    localStorage.setItem('reaction.interviewSessionId', 's');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<GoalIntakeScreen onDone={vi.fn()} />);
    await screen.findByText('사용할 자료는요?');
    fireEvent.click(screen.getByText('새로 시작'));
    expect(interviewApi.finish).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    vi.mocked(interviewApi.start).mockResolvedValue({ ...session, sessionId: 'new', currentQuestion: { ...session.currentQuestion!, text: '첫 질문이에요' } });
    fireEvent.click(screen.getByText('새로 시작'));
    await screen.findByText('첫 질문이에요');
    expect(interviewApi.finish).toHaveBeenCalledTimes(1);
    expect(interviewApi.finish).toHaveBeenCalledWith('s');
    expect(localStorage.getItem('reaction.interviewSessionId')).toBe('new');
  });
  it('조회 오류에서 성공 화면으로 우회하지 않고 기존 세션으로 재시도한다', async () => {
    localStorage.setItem('reaction.interviewSessionId', 's');
    vi.mocked(interviewApi.get).mockRejectedValueOnce(new Error('연결 실패'));
    const done = vi.fn();
    render(<GoalIntakeScreen onDone={done} />);
    await screen.findByText('연결 실패');
    expect(localStorage.getItem('reaction.interviewSessionId')).toBe('s');
    fireEvent.click(screen.getByText('저장된 인터뷰 다시 불러오기'));
    await screen.findByText('사용할 자료는요?');
    expect(done).not.toHaveBeenCalled();
    expect(interviewApi.start).not.toHaveBeenCalled();
  });
  it('저장한 spec을 문자열 답변으로 덮어쓰지 않고 다음 질문을 요청한다', async () => {
    render(<GoalIntakeScreen onDone={vi.fn()} />);
    fireEvent.click(await screen.findByText('자료 저장 테스트'));
    fireEvent.click(screen.getByText('자료로 계속 테스트'));
    await waitFor(() => expect(interviewApi.nextQuestion).toHaveBeenCalledWith('s'));
    expect(interviewApi.submitAnswer).not.toHaveBeenCalled();
    expect(await screen.findByText('완벽해요. 정리됐어요. 다음 단계로 넘어갈게요.')).toBeInTheDocument();
  });
  it('다음 질문 요청 실패 시 확정 자료를 유지하고 재시도한다', async () => {
    vi.mocked(interviewApi.nextQuestion).mockRejectedValueOnce(new Error('offline'));
    render(<GoalIntakeScreen onDone={vi.fn()} />);
    fireEvent.click(await screen.findByText('자료 저장 테스트'));
    fireEvent.click(screen.getByText('자료로 계속 테스트'));
    await screen.findByText('검색에서 확정한 자료가 저장됐어요. 위의 ‘확정한 자료로 인터뷰 계속하기’를 눌러 주세요.');
    await waitFor(() => expect(screen.getByText('자료로 계속 테스트')).toBeInTheDocument());
    await screen.findByText('요청 처리 중 오류가 발생했어요.');
    fireEvent.click(screen.getByText('자료로 계속 테스트'));
    await waitFor(() => expect(interviewApi.nextQuestion).toHaveBeenCalledTimes(2));
    expect(interviewApi.submitAnswer).not.toHaveBeenCalled();
  });
});
