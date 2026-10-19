import './reentry.css';
import React, { useEffect, useRef, useState } from 'react';
import { friendlyError, workContextApi } from '../lib/api';
import type { ActionDetail } from '../types/api';
export function QuickStart({ userId, goalId, onStart, onDetailed, onBack }: { userId: string; goalId?: string; onStart: (a: ActionDetail) => void; onDetailed: () => void; onBack?: () => void }) {
  const key = `reaction.quick-start.${userId}.${goalId ?? ''}`;
  const initial = useRef<{ title: string; firstStep: string; attemptMinutes: number; requestId: string }>();
  if (!initial.current) { try { const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null'); if (saved && typeof saved.title === 'string' && typeof saved.firstStep === 'string' && [5,10,20,30].includes(saved.attemptMinutes) && typeof saved.requestId === 'string' && /^[0-9a-f-]{36}$/i.test(saved.requestId)) initial.current = saved; } catch {} initial.current ??= { title: '', firstStep: '', attemptMinutes: 10, requestId: crypto.randomUUID() }; }
  const [draft, setDraft] = useState(initial.current);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''); const lock = useRef(false);
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(draft)); } catch { /* Storage can be unavailable; current form remains usable. */ } }, [draft, key]);
  const submit = async () => { if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const action = await workContextApi.quickAction({ ...draft, ...(goalId ? { goalId: goalId.replace(/^goal_/, '') } : {}) }); sessionStorage.removeItem(key); onStart(action); }
    catch (e) { setError(friendlyError(e, '작업을 저장하지 못했어요. 입력을 유지했으니 다시 시도해 주세요.')); }
    finally { lock.current = false; setBusy(false); }
  };
  const update = (patch: Partial<typeof draft>) => setDraft(d => ({ ...d, ...patch, requestId: crypto.randomUUID() }));
  return <div className="reentry-page work-context"><div className="reentry-page-inner">{onBack && <button className="reentry-secondary" onClick={onBack} disabled={busy}>나중에 이어서 하기</button>}<h1>진행 중인 일 하나부터</h1><p>전체 계획은 나중에 만들고, 지금 할 행동만 확인해요.</p>
    <label>진행 중인 일<input value={draft.title} maxLength={300} onChange={e => update({ title: e.target.value })} /></label>
    <label>지금 할 행동 하나<input value={draft.firstStep} maxLength={500} onChange={e => update({ firstStep: e.target.value })} placeholder="예: 첫 문장 하나 쓰기" /></label>
    <label>이번에 써 볼 시간<select value={draft.attemptMinutes} onChange={e => update({ attemptMinutes: Number(e.target.value) })}>{[5,10,20,30].map(n => <option key={n} value={n}>{n}분</option>)}</select></label><p>전체 과제의 예상 시간이나 마감일을 정하는 것은 아니에요.</p>
    {error && <p role="alert">{error}</p>}<button className="reentry-primary" disabled={busy || !draft.title.trim() || !draft.firstStep.trim()} onClick={() => void submit()}>{busy ? '저장 중…' : '이 행동으로 시작 준비'}</button><button className="reentry-secondary" disabled={busy} onClick={onDetailed}>상세 계획 이어서 만들기</button>
  </div></div>;
}
