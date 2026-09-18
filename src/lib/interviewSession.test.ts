import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, interviewApi } from './api';
import { openInterview, requestInterviewRestart } from './interviewSession';
import type { InterviewSession } from '../types/api';

vi.mock('./api', async (original) => {
  const api = await original<typeof import('./api')>();
  return { ...api, interviewApi: { get: vi.fn(), start: vi.fn(), finish: vi.fn() } };
});
const saved: InterviewSession = { sessionId: 'saved', totalTurns: 3, ambiguityScore: 8, endReason: null, currentQuestion: null };
describe('인터뷰 세션 보존', () => {
  beforeEach(() => {
    vi.resetAllMocks(); localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('reaction.interviewSessionId', 'saved');
    vi.mocked(interviewApi.get).mockResolvedValue(saved);
    vi.mocked(interviewApi.start).mockResolvedValue({ ...saved, sessionId: 'fresh' });
  });
  it.each([401, 403, 500])('조회 %s에서 세션을 지우거나 새로 만들지 않는다', async (status) => {
    vi.mocked(interviewApi.get).mockRejectedValue(new ApiError('FAIL', '조회 실패', status));
    await expect(openInterview(null)).rejects.toThrow();
    expect(localStorage.getItem('reaction.interviewSessionId')).toBe('saved');
    expect(interviewApi.start).not.toHaveBeenCalled();
    expect(interviewApi.finish).not.toHaveBeenCalled();
  });
  it('404로 없어진 세션만 새 세션으로 대체한다', async () => {
    vi.mocked(interviewApi.get).mockRejectedValue(new ApiError('NOT_FOUND', '없음', 404));
    await expect(openInterview(null)).resolves.toHaveProperty('sessionId', 'fresh');
    expect(interviewApi.finish).not.toHaveBeenCalled();
  });
  it('명시적 초기화의 종료 실패도 삼키지 않으며 재시도 때만 교체한다', async () => {
    requestInterviewRestart();
    vi.mocked(interviewApi.finish).mockRejectedValueOnce(new Error('저장 실패')).mockResolvedValueOnce({ ...saved, endReason: 'early_user' });
    await expect(openInterview(null)).rejects.toThrow('저장 실패');
    expect(localStorage.getItem('reaction.interviewSessionId')).toBe('saved');
    expect(interviewApi.start).not.toHaveBeenCalled();
    await expect(openInterview(null)).resolves.toHaveProperty('sessionId', 'fresh');
    expect(interviewApi.start).toHaveBeenCalledTimes(1);
  });
  it('다른 목표 진입 시 기존 답변을 섞거나 임의 초기화하지 않는다', async () => {
    localStorage.setItem('reaction.interviewSessionGoalId', 'goal-a');
    await expect(openInterview('goal-b')).rejects.toThrow('다른 목표');
    expect(interviewApi.start).not.toHaveBeenCalled();
    expect(interviewApi.finish).not.toHaveBeenCalled();
  });
});
