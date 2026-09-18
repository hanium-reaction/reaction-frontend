import type { Task } from '../types';

export interface UncheckedBlock { actionId: string; title: string }

// 시간·유예·상태 판정은 서버가 담당한다. 필드가 없는 이전 응답은 미표시한다.
export function findUncheckedBlocks(tasks: Task[]): UncheckedBlock[] {
  return tasks.filter((task) => task.missedCheckIn === true)
    .map((task) => ({ actionId: task.id, title: task.title }));
}

// ── 로컬 dismiss 상태 ────────────────────────────────────────────
// 위 판정 함수는 순수하지만, "한 번 확인한 건 다시 안 뜬다"(반복 노출 방지)는 세션을
// 넘어 남아야 하므로 localStorage 에 actionId 를 쌓는다. IosInstallCard(#11) 와 같은
// 패턴 — 서버 상태가 아니라 기기 로컬 플래그다(기기를 바꾸면 다시 보일 수 있음).
const DISMISSED_KEY = 'reaction.uncheckedNudgeDismissed';
// 무한정 쌓이지 않도록 최근 N개만 보존.
const DISMISSED_MAX = 200;

function readDismissed(): Set<string> {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

/** dismiss 되지 않은 것만 남긴다 — 배지·배너 렌더 직전에 판정 결과에 걸어 쓴다. */
export function filterDismissedBlocks(blocks: UncheckedBlock[]): UncheckedBlock[] {
  if (blocks.length === 0) return blocks;
  const dismissed = readDismissed();
  if (dismissed.size === 0) return blocks;
  return blocks.filter((b) => !dismissed.has(b.actionId));
}

/** 사용자가 넛지를 닫으면(또는 확인하면) 같은 블록이 다시 뜨지 않게 기록한다. */
export function dismissUncheckedBlocks(actionIds: string[]): void {
  if (actionIds.length === 0) return;
  try {
    const dismissed = readDismissed();
    for (const id of actionIds) dismissed.add(id);
    const trimmed = Array.from(dismissed).slice(-DISMISSED_MAX);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(trimmed));
  } catch {
    /* localStorage 없음/쿼터 초과 — 이번 세션만 다시 뜨는 정도라 무시해도 안전 */
  }
}
