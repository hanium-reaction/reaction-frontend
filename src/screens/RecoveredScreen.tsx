import React, { useEffect, useState } from 'react';
import { friendlyError, replanApi } from '../lib/api';
import type { ReplanBlock, ReplanDiff } from '../types/api';
import { ErrorBanner } from '../components/ErrorBanner';
import '../components/reentry.css';

export interface AppliedRecovery {
  taskTitle: string; failReason: string; proposalTitle: string; proposalDesc: string; proposalTime: string;
  requiresReplan?: boolean; proposalType?: string;
}
interface RecoveredScreenProps {
  recoveryCount?: number; applied?: AppliedRecovery | null; onDone: () => void; onOpenWeekly?: () => void; executionId?: string;
}
function schedule(block: ReplanBlock) {
  const start = new Date(block.startAt), end = new Date(block.endAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return '일정 정보 없음';
  const format = (date: Date) => date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  return `${format(start)} – ${format(end)} (한국 시간)`;
}
export function RecoveredScreen({ applied, onDone, onOpenWeekly, executionId }: RecoveredScreenProps) {
  const needsReplan = applied?.requiresReplan ?? true;
  const [diff, setDiff] = useState<ReplanDiff | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setDiff(null); setDiffError(null); setApproveError(null);
    if (!executionId || !needsReplan) return;
    let cancelled = false;
    replanApi.diff(executionId).then((value) => {
      if (cancelled) return;
      if (value?.before && value?.after) setDiff(value);
      else setDiffError('일정 변경 내용이 비어 있어요. 다시 불러와 주세요.');
    }, (error) => { if (!cancelled) setDiffError(friendlyError(error, '실제 일정 변경 내용을 불러오지 못했어요.')); });
    return () => { cancelled = true; };
  }, [executionId, needsReplan, retry]);
  if (!applied || !executionId) return <div className="reentry-page"><h1>확인할 회복 기록이 없어요</h1><p>오늘 화면에서 다시 살펴볼 항목과 방법을 먼저 선택해 주세요.</p><button className="reentry-secondary" onClick={onDone}>오늘로 돌아가기</button></div>;
  const approved = !!diff?.alreadyApproved;
  const handleDone = async () => {
    if (approving || (needsReplan && !diff)) return;
    if (needsReplan && !approved) {
      setApproving(true); setApproveError(null);
      try { await replanApi.approve(executionId, `replan-${executionId}`); }
      catch (error) { setApproveError(friendlyError(error, '일정 반영을 완료하지 못했어요. 다시 시도해 주세요.')); setApproving(false); return; }
      setApproving(false);
    }
    onDone();
  };
  return <div className="reentry-page"><div className="reentry-page-inner">
    <ol className="reentry-steps" aria-label="다시 시작 순서"><li>01 항목 확인</li><li>02 방법 선택</li><li aria-current="step">03 변경 확인</li></ol>
    <div className="reentry-eyebrow">{approved ? '일정 반영됨' : needsReplan ? '승인 전 미리보기' : '선택 저장됨'}</div>
    <h1>{needsReplan ? '이렇게 다시 시작해요' : '회복 선택을 저장했어요'}</h1>
    <p>{needsReplan ? '선택한 한 항목의 변경 내용을 확인해 주세요.' : applied.proposalType === 'PARK' ? '잠시 보류하고, 여유가 생기면 다시 살펴봐요.' : '시간 변경은 주간 계획에서 직접 완료해 주세요.'}</p>
    <div className="reentry-diff">
      <article><div className="reentry-eyebrow">기존 계획</div><h2>{diff?.before.title ?? applied.taskTitle}</h2>
        <dl>{diff && <><dt>예정 시각</dt><dd>{schedule(diff.before)}</dd><dt>계획 시간</dt><dd>{diff.before.estimatedMinutes != null ? `${diff.before.estimatedMinutes}분` : '정보 없음'}</dd></>}{applied.failReason && <><dt>내가 기록한 이유</dt><dd>{applied.failReason}</dd></>}</dl>
      </article>
      <article><div className="reentry-eyebrow">{needsReplan ? approved ? '반영된 계획' : '변경할 계획' : '선택한 방법'}</div><h2>{diff?.after.title ?? applied.proposalTitle}</h2><p>{applied.proposalDesc}</p>
        <dl>{diff && <><dt>예정 시각</dt><dd>{schedule(diff.after)}</dd><dt>계획 시간</dt><dd>{diff.after.estimatedMinutes != null ? `${diff.after.estimatedMinutes}분` : '정보 없음'}</dd></>}</dl>
        {needsReplan && !diff && !diffError && <p role="status">서버에서 실제 변경 내용을 불러오는 중이에요.</p>}
      </article>
    </div>
    {needsReplan && diff && !approved && <p>변경 예정이에요. 아래 버튼으로 승인해 주세요.</p>}
    {!needsReplan && <p>선택은 저장됐으며 새 일정은 자동으로 만들지 않았어요.</p>}
    <section className="reentry-footnote" aria-label="남아 있는 계획"><strong>남아 있는 계획도 확인해 주세요</strong><p>여기서는 선택한 항목의 변경 내용만 보여드려요. 전체 일정은 주간 계획에서 확인해 주세요. 계획을 줄인 시간은 실제 완료량이나 남은 작업량을 뜻하지 않아요.</p></section>
    {(diffError || approveError) && <ErrorBanner>{approveError ?? diffError}</ErrorBanner>}
    {diffError && <button className="reentry-secondary" onClick={() => setRetry((value) => value + 1)}>변경 내용 다시 불러오기</button>}
    <button className="reentry-primary" disabled={approving || (needsReplan && !diff)} onClick={handleDone}>{approving ? '반영하는 중…' : approveError ? '다시 시도' : needsReplan && !approved ? '일정 반영하기' : '오늘로 돌아가기'}</button>
    {needsReplan && !approved && <button className="reentry-secondary" style={{ width: '100%', marginTop: 10 }} disabled={approving} onClick={onDone}>지금은 반영하지 않고 돌아가기</button>}
    {!needsReplan && applied.proposalType === 'RESCHEDULE' && onOpenWeekly && <button className="reentry-secondary" style={{ width: '100%', marginTop: 10 }} onClick={onOpenWeekly}>주간 계획 열기</button>}
    <p style={{ fontSize: 11, textAlign: 'center' }}>일정 반영은 실행 완료 기록과 달라요. 실제로 한 일은 실행 후 기록해 주세요.</p>
  </div></div>;
}
