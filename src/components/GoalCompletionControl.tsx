import { useRef, useState } from 'react';
import { ApiError, friendlyError, goalsApi } from '../lib/api';
import type { ApiGoal } from '../types/api';
import { ReButton } from './ReButton';

export function GoalCompletionControl({ goalId, title, completed, onChanged }: {
  goalId: string; title: string; completed: boolean; onChanged: (goal: ApiGoal) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try { const goal = await goalsApi.complete(goalId, !completed); onChanged(goal); setConfirm(false); }
    catch (err) { setError(err instanceof ApiError && err.status === 422 ? err.message : friendlyError(err, '목표 상태를 바꾸지 못했어요.')); }
    finally { lock.current = false; setBusy(false); }
  };
  return <div>
    {completed && <span>완료한 목표 · </span>}
    {!confirm && <ReButton size="sm" variant="ghost" onClick={() => setConfirm(true)}>{completed ? '완료 되돌리기' : '목표 완료'}</ReButton>}
    {confirm && <div role="group" aria-label="목표 완료 확인">
      <p>{title}</p>
      <p>{completed ? '완료를 되돌려도 정리된 일정은 복구되지 않아요. 다시 계획을 만들어 주세요. 집중·유지 목표 한도를 다시 확인해요.' : '남은 예정 카드와 일정이 정리돼요. 이미 시작했거나 완료·실패한 실행과 직접 옮긴 일정은 보존돼요.'}</p>
      <ReButton size="sm" disabled={busy} onClick={() => void save()}>확인</ReButton>
      <ReButton size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(false)}>취소</ReButton>
    </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
