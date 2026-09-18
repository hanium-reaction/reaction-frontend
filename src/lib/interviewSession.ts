import { ApiError, interviewApi } from './api';
import type { InterviewSession } from '../types/api';

const SESSION = 'reaction.interviewSessionId';
const GOAL = 'reaction.interviewSessionGoalId';
const RESTART = 'reaction.interviewRestart';
const pending = new Map<string, Promise<InterviewSession>>();

/** 확인 UI에서만 호출한다. 실패한 재시도에도 명시적 의도를 보존한다. */
export function requestInterviewRestart() {
  sessionStorage.setItem(RESTART, 'yes');
}

/** StrictMode 및 빠른 재마운트에서 생성/종료 요청을 공유한다. */
export function openInterview(goalId: string | null, userId = ''): Promise<InterviewSession> {
  const key = JSON.stringify([userId, goalId]);
  const existing = pending.get(key);
  if (existing) return existing;
  const operation = (async () => {
    const restart = sessionStorage.getItem(RESTART) === 'yes';
    const sid = localStorage.getItem(SESSION);
    if (sid) {
      let saved: InterviewSession | null = null;
      try { saved = await interviewApi.get(sid); }
      catch (err) {
        // 일시 장애나 인증 실패는 세션 유실이 아니다.
        if (!(err instanceof ApiError) || err.status !== 404) throw err;
        localStorage.removeItem(SESSION);
        localStorage.removeItem(GOAL);
      }
      if (saved && !restart) {
        const storedGoal = localStorage.getItem(GOAL);
        if (goalId && goalId !== storedGoal) {
          throw new Error('다른 목표의 인터뷰가 저장돼 있어요. 이 목표로 바꾸려면 ‘새로 시작’을 눌러 주세요.');
        }
        return saved;
      }
      if (saved && restart) {
        if (saved.endReason === null) await interviewApi.finish(sid);
        // 종료 실패 시 여기까지 오지 않으므로 ID와 재시작 의도가 유지된다.
        localStorage.removeItem(SESSION);
        localStorage.removeItem(GOAL);
      }
    }
    const fresh = await interviewApi.start(undefined, goalId ?? undefined);
    localStorage.setItem(SESSION, fresh.sessionId);
    if (goalId) localStorage.setItem(GOAL, goalId);
    else localStorage.removeItem(GOAL);
    sessionStorage.removeItem(RESTART);
    return fresh;
  })();
  pending.set(key, operation);
  void operation.then(() => pending.delete(key), () => pending.delete(key));
  return operation;
}
