import type { Task } from '../types';

/** Only recorded task state is used; absence is never treated as laziness or failure. */
export function todayPresentation(tasks: Task[]) {
  const active = tasks.some((t) => t.status === 'in_progress');
  const needsReview = tasks.some((t) => !t.fixed && t.status !== 'done' &&
    (t.missedCheckIn || ['partial_done', 'failed', 'recovery_pending'].includes(t.status)));
  if (active) return { mode: 'active', title: '이어서 할 일', subtitle: '진행 중인 작업부터 이어가세요.' };
  if (needsReview) return { mode: 'restart', title: '하나씩 다시 시작', subtitle: '남은 일 전체를 고칠 필요 없이, 한 항목부터.' };
  if (!tasks.length) return { mode: 'empty', title: '오늘', subtitle: '계획을 추가하고 첫 행동을 정해보세요.' };
  if (tasks.every((t) => t.status === 'done')) return { mode: 'done', title: '오늘의 기록', subtitle: '완료한 일을 확인하고 다음 계획을 살펴보세요.' };
  return { mode: 'ready', title: '오늘 할 일', subtitle: '지금 시작할 한 가지에 집중하세요.' };
}
