import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalIntakeScreen } from './GoalIntakeScreen';
import { interviewApi } from '../lib/api';
import { useNavigation } from '../contexts/NavigationContext';
import type { InterviewSession } from '../types/api';

vi.mock('../contexts/NavigationContext', () => ({ useNavigation: vi.fn() }));
vi.mock('../lib/api', async (original) => {
  const api = await original<typeof import('../lib/api')>();
  return { ...api, interviewApi: { ...api.interviewApi, start: vi.fn(), slotCatalog: vi.fn(), nextQuestion: vi.fn(), submitAnswer: vi.fn() } };
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
    vi.clearAllMocks(); localStorage.clear();
    vi.mocked(useNavigation).mockReturnValue({ setInterviewSessionId: vi.fn(), setPlanGoalId: vi.fn(), setPlanAxisId: vi.fn() } as unknown as ReturnType<typeof useNavigation>);
    vi.mocked(interviewApi.start).mockResolvedValue(session);
    vi.mocked(interviewApi.slotCatalog).mockResolvedValue([]);
    vi.mocked(interviewApi.nextQuestion).mockResolvedValue({ ...session, endReason: 'completed', currentQuestion: null });
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
