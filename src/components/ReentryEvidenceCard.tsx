import './reentry.css';
import React, { useEffect, useState } from 'react';
import { friendlyError, workContextApi, type ReentryEvidence, type ReentryPreference } from '../lib/api';
const labels = { smaller_step: '행동을 더 작게 정하기', context_first: '자료를 먼저 열어 보기', rest: '쉬고 나서 다시 확인하기' };
export function ReentryEvidenceCard({ weekStart }: { weekStart: string }) {
  const [data, setData] = useState<ReentryEvidence | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { let cancelled = false; setData(null); setError(''); workContextApi.evidence(weekStart).then(d => { if (!cancelled) setData(d); }, e => { if (!cancelled) setError(friendlyError(e, '재실행 기록을 불러오지 못했어요.')); }); return () => { cancelled = true; }; }, [weekStart, retry]);
  const save = async (preference: ReentryPreference) => { if (busy) return; setBusy(true); setError(''); try { const r = await workContextApi.savePreference(preference); setData(d => d ? { ...d, preference: r.preference } : d); } catch(e) { setError(friendlyError(e, '선호를 저장하지 못했어요.')); } finally { setBusy(false); } };
  return <section className="guided-approval work-context"><h2>다시 시작한 기록, 다음에 바꿀 한 가지</h2>{error && <p role="alert">{error}<button onClick={() => setRetry(x => x + 1)}>다시 조회</button></p>}
    {data ? <><p>{data.weekStart} ~ {data.weekEnd}에 재개 화면을 확인한 시도 {data.attempts}건</p><p>시작 {data.started}건 · 첫 행동 수행 보고 {data.firstStepsReported}건 · 전체 과제 완료 {data.tasksCompleted}건</p><p>{data.attempts < 5 ? '기록이 적어 어떤 방법이 더 효과적인지 판단하기 어려워요.' : '자기 보고 기록이며, 이 기능의 효과를 증명하는 수치는 아니에요.'}</p><p>다음에 먼저 보여 줄 안내를 직접 골라 주세요. 일정을 자동 변경하지 않아요.</p>
    {(Object.keys(labels) as Array<keyof typeof labels>).map(p => <button className="reentry-secondary" key={p} disabled={busy} aria-pressed={data.preference === p} onClick={() => void save(p)}>{labels[p]}</button>)}{data.preference && <button className="reentry-secondary" disabled={busy} onClick={() => void save(null)}>선호 해제</button>}</> : !error && <p>기록 확인 중…</p>}
  </section>;
}
export function ReentryPreferenceHint() {
  const [preference, setPreference] = useState<ReentryPreference>(null);
  useEffect(() => { let cancelled = false; workContextApi.preference().then(r => { if (!cancelled) setPreference(r.preference); }).catch(() => {}); return () => { cancelled = true; }; }, []);
  return preference ? <p>내가 선택한 방식: {labels[preference]}. 지금 상황에 맞지 않으면 다른 방법을 선택해도 괜찮아요.</p> : null;
}
