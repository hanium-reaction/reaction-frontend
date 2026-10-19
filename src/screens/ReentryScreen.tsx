import React, { useEffect, useRef, useState } from 'react';
import { friendlyError, reentryApi } from '../lib/api';
import type { ReentryState } from '../types/api';
import type { Task } from '../types';
import '../components/reentry.css';
import '../styles/guided-redesign.css';

export function ReentryScreen({ task, onStart, onBack }: {
  task: Task | null;
  onStart: (state: ReentryState) => void;
  onBack: () => void;
}) {
  const requestId = useRef(crypto.randomUUID());
  const busy = useRef(false);
  const [state, setState] = useState<ReentryState | null>(null);
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!task) return;
    let cancelled = false;
    setError(null);
    reentryApi.prepare(task.id, requestId.current).then(async value => {
      if (cancelled) return;
      setState(value); setStep(value.firstStep ?? '');
      try { await reentryApi.event(value.attemptId, 'viewed'); }
      catch { if (!cancelled) setError('화면 확인 기록을 저장하지 못했어요. 다시 불러와 주세요.'); }
    }, err => { if (!cancelled) setError(friendlyError(err, '작업 상태를 불러오지 못했어요.')); });
    return () => { cancelled = true; };
  }, [task?.id, retry]);
  const start = async () => {
    if (!state || busy.current || !step.trim() || !state.canStart) return;
    busy.current = true; setSaving(true); setError(null);
    try {
      await reentryApi.event(state.attemptId, 'selected').catch(() => undefined);
      await reentryApi.event(state.attemptId, 'start_clicked').catch(() => undefined);
      const value = await reentryApi.start(state.attemptId, step.trim());
      onStart(value);
    } catch (err) { void reentryApi.event(state.attemptId, 'start_failed').catch(() => undefined); setError(friendlyError(err, '시작 기록을 저장하지 못했어요. 다시 시도해 주세요.')); }
    finally { busy.current = false; setSaving(false); }
  };
  const leave = async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError(null);
    try {
      if (state) await reentryApi.event(state.attemptId, 'leave');
      onBack();
    } catch (err) { setError(friendlyError(err, '쉬기 상태를 저장하지 못했어요. 다시 시도해 주세요.')); }
    finally { busy.current = false; setSaving(false); }
  };
  return <div className="reentry-page guided-surface"><div className="reentry-page-inner">
    <button className="reentry-secondary" onClick={leave} disabled={saving}>오늘로 돌아가기</button>
    <header className="guided-page-heading">
      <span className="guided-kicker">RE:ACTION / 다음 행동</span>
      <h1>{!!state?.executionId ? '하던 일을 이어가요' : state?.entryKind === 'restart' ? '다시, 한 행동부터' : '한 행동부터 시작해요'}</h1>
      <h2>{state?.title ?? task?.title ?? '작업을 선택해 주세요'}</h2>
      {state && <p>{!!state.executionId ? '서버에 남아 있는 실행을 이어갑니다.' : state.entryKind === 'restart' ? '이전 기록은 보존하고 새로 시도합니다.' : '이번에 할 행동을 확인해 주세요.'}</p>}
    </header>
    {!state && !error && <p role="status">현재 작업 상태를 확인하는 중…</p>}
    {state && <section className="guided-approval">
      <label htmlFor="reentry-step"><strong>이번에 할 행동 하나</strong></label>
      <textarea id="reentry-step" value={step} maxLength={500} rows={3}
        disabled={saving || (!!state.startedAt && !!state.firstStep)}
        onChange={e => setStep(e.target.value)}
        placeholder="예: 첫 문장 하나 적기"
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 16, marginTop: 12, borderRadius: 12, font: 'inherit' }} />
      <p>이 행동을 했는지만 먼저 확인해요. 전체 과제 완료와는 별도로 기록합니다.</p>
      {!state.firstStep && <p>저장된 첫 행동이 없어요. 지금 할 행동을 한 줄로 적어 주세요.</p>}
      {state.blockedReason && <p role="status">{state.blockedReason}</p>}
      <button className="reentry-primary" disabled={saving || !state.canStart || !step.trim()} onClick={() => void start()}>
        {saving ? '시작 기록 저장 중…' : state.executionStatus === 'paused' ? '이 행동 이어 하기' : '이 행동 시작하기'}
      </button>
      <button className="reentry-secondary" disabled={saving} onClick={leave}>지금은 쉬기</button>
    </section>}
    {error && <div role="alert"><p>{error}</p><button className="reentry-secondary" disabled={saving} onClick={() => setRetry(x => x + 1)}>상태 다시 불러오기</button></div>}
  </div></div>;
}
