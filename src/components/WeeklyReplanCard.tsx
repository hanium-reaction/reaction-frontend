import { useRef, useState } from 'react';
import { ApiError, friendlyError, plansApi } from '../lib/api';
import type { WeeklyReplanResponse } from '../types/api';
import { ReButton } from './ReButton';

export function WeeklyReplanCard({ onApproved }: { onApproved: () => void }) {
  const [draft, setDraft] = useState<WeeklyReplanResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (approve: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (approve && draft) {
        await plansApi.approveReplan(draft.planId, `weekly-replan-${draft.planId}`);
        setDraft(null); onApproved();
      } else if (!approve) {
        setDraft(await plansApi.generateReplan());
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 410) {
        setDraft(null); setError('초안이 만료됐어요. 남은 일 다시 배치를 눌러 새로 만들어 주세요.');
      } else if (err instanceof ApiError && err.status === 409) {
        setError('다른 계획 작업이 진행 중이에요. 잠시 후 다시 시도해 주세요.');
      } else if (err instanceof ApiError && err.status === 429) {
        setError('오늘의 생성 한도에 도달했어요. 잠시 쉬었다 다시 시도해 주세요.');
      } else setError(friendlyError(err, '계획을 처리하지 못했어요. 다시 시도해 주세요.'));
    } finally { lock.current = false; setBusy(false); }
  };
  return <section aria-label="남은 일 다시 배치" style={{ padding: 12, borderRadius: 12, background: 'var(--surface-raised)' }}>
    {!draft && <ReButton size="sm" disabled={busy} onClick={() => void run(false)}>{busy ? '초안 만드는 중…' : '남은 일 다시 배치'}</ReButton>}
    {error && <p role="alert">{error}</p>}
    {draft && <>
      <h2 style={{ fontSize: 16 }}>남은 일정 미리보기</h2>
      <p>적용하기 전에는 일정이 바뀌지 않아요. 기준일: {draft.windowStart}</p>
      {draft.warnings?.map((warning, index) => <p key={index} role="status">{warning}</p>)}
      <ul style={{ maxHeight: 240, overflow: 'auto' }}>{draft.blocks.map((block, index) => <li key={`${block.actionId}-${index}`}>
        <b>{block.title}</b> · {new Date(block.start).toLocaleString('ko-KR')} ~ {new Date(block.end).toLocaleTimeString('ko-KR')}
        {block.replacesBlockId && <span> · 기존 일정 교체 ({block.replacesBlockId})</span>}
      </li>)}</ul>
      {!draft.blocks.length && <p>다시 배치할 일정이 없어요.</p>}
      <ReButton disabled={busy} onClick={() => void run(true)}>확인하고 적용</ReButton>
      <ReButton variant="ghost" disabled={busy} onClick={() => setDraft(null)}>취소</ReButton>
    </>}
  </section>;
}
