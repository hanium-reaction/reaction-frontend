import './reentry.css';
import React, { useEffect, useRef, useState } from 'react';
import { friendlyError, workContextApi, type LinkedResource } from '../lib/api';
export function ActionResourcePanel({ actionId }: { actionId: string }) {
  const [resource, setResource] = useState<LinkedResource | null>(null);
  const [url, setUrl] = useState(''), [label, setLabel] = useState('');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const lock = useRef(false);
  useEffect(() => { let cancelled = false; setLoading(true);
    workContextApi.resource(actionId).then(r => { if (!cancelled) { setResource(r.resource); setUrl(r.resource?.url ?? ''); setLabel(r.resource?.label ?? ''); setError(''); } }, e => { if (!cancelled) setError(friendlyError(e, '연결 자료를 불러오지 못했어요.')); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [actionId, retry]);
  const save = async (unlink = false) => {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const r = unlink ? await workContextApi.unlink(actionId) : await workContextApi.saveResource(actionId, { url: url.trim(), label: label.trim() }); setResource(r.resource); if (unlink) { setUrl(''); setLabel(''); } }
    catch (e) { setError(friendlyError(e, '자료 연결을 저장하지 못했어요. 입력은 유지했어요.')); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section className="guided-approval work-context" aria-label="연결 자료"><h2>이어서 볼 자료</h2>
    {loading ? <p>자료 확인 중…</p> : resource ? <a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.label} · 새 탭에서 열기</a> : !error && <p>연결한 자료가 없어도 시작할 수 있어요.</p>}
    <details><summary>자료 연결·수정</summary><label>표시 이름<input value={label} maxLength={100} onChange={e => setLabel(e.target.value)} /></label><label>웹 주소<input type="url" value={url} maxLength={2048} onChange={e => setUrl(e.target.value)} placeholder="https://" /></label><button className="reentry-secondary" disabled={loading || busy || !label.trim() || !/^https?:\/\//.test(url)} onClick={() => void save()}>연결 저장</button>{resource && <button className="reentry-secondary" disabled={busy} onClick={() => void save(true)}>연결 해제</button>}<p>주소만 연결해요. 원본 자료를 수집하거나 삭제하지 않아요.</p></details>
    {error && <p role="alert">{error} <button onClick={() => setRetry(x => x + 1)}>다시 조회</button></p>}
  </section>;
}
