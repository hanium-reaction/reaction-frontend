import { useEffect, useId, useRef, useState } from 'react';
import { ArrowsClockwise, CalendarBlank, WarningCircle, X } from '@phosphor-icons/react';
import { ApiError, friendlyError, plansApi } from '../lib/api';
import type { WeeklyReplanResponse, WeeklyReplanApproveResponse } from '../types/api';
import { ReButton } from './ReButton';
import './WeeklyReplanCard.css';

const dateLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
const dayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
const timeLabel = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function scheduleTime(start: string, end: string) {
  const from = new Date(start), to = new Date(end);
  return `${timeLabel.format(from)}–${dayKey.format(from) === dayKey.format(to) ? '' : `${dateLabel.format(to)} `}${timeLabel.format(to)}`;
}

export function WeeklyReplanCard({ onApproved }: { onApproved: () => void }) {
  const [draft, setDraft] = useState<WeeklyReplanResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WeeklyReplanApproveResponse | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    if (draft && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [draft]);
  const days = new Map<string, WeeklyReplanResponse['blocks']>();
  [...(draft?.blocks ?? [])].sort((a, b) => Date.parse(a.start) - Date.parse(b.start)).forEach(block => {
    const key = dayKey.format(new Date(block.start));
    days.set(key, [...(days.get(key) ?? []), block]);
  });
  const replaced = draft?.blocks.filter(block => block.replacesBlockId).length ?? 0;
  const run = async (approve: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (approve && draft) {
        setResult(await plansApi.approveReplan(draft.planId, `weekly-replan-${draft.planId}`));
        setDraft(null); onApproved();
      } else if (!approve) {
        setResult(null);
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
  return <section aria-label="남은 일 다시 배치" className="planning-replan" style={{ marginBottom: 6 }}>
    <div className="planning-replan-summary"><ReButton size="sm" disabled={busy} onClick={() => void run(false)}>{busy ? '초안 만드는 중…' : '남은 일 다시 배치'}</ReButton><span>미리 보고 적용해요</span></div>
    {error && !draft && <p role="alert" className="weekly-replan-error">{error}</p>}
    {result && <p role="status">일정 {result.createdBlocks}개를 배치하고 {result.cancelledBlocks}개를 정리했어요. 이미 시작했거나 변경된 일정 {result.skippedBlocks}개는 보존했어요.</p>}
    {draft && <dialog ref={dialog} className="weekly-replan-dialog" aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={event => { event.preventDefault(); if (!busy) setDraft(null); }}>
      <div className="weekly-replan-layout">
        <header className="weekly-replan-header">
          <div><span className="weekly-replan-eyebrow"><ArrowsClockwise size={15} aria-hidden="true" /> 계획 다시 정리</span>
            <h2 id={titleId}>남은 일정 미리보기</h2>
          </div>
          <button className="weekly-replan-close" aria-label="미리보기 닫기" disabled={busy} onClick={() => setDraft(null)}><X size={20} /></button>
          <p id={descriptionId}>적용하기 전에는 일정이 바뀌지 않아요.</p>
          <div className="weekly-replan-counts"><strong>전체 {draft.blocks.length}개</strong><span>재배치 {replaced}개</span><span>새 일정 {draft.blocks.length - replaced}개</span></div>
        </header>
        <div className="weekly-replan-body" tabIndex={0} role="region" aria-label="변경할 일정 목록">
          <p className="weekly-replan-start">{dateLabel.format(new Date(`${draft.windowStart}T00:00:00+09:00`))}부터 · 한국 시간</p>
          {!!draft.warnings?.length && <details className="weekly-replan-warnings">
            <summary><WarningCircle size={18} aria-hidden="true" /><span>적용 전 확인할 내용 {draft.warnings.length}개</span><span className="weekly-replan-expand">펼치기</span></summary>
            <ul>{draft.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          </details>}
          {[...days].map(([day, blocks]) => <section className="weekly-replan-day" key={day} aria-label={dateLabel.format(new Date(blocks[0].start))}>
            <h3><CalendarBlank size={17} aria-hidden="true" />{dateLabel.format(new Date(blocks[0].start))}<span>{blocks.length}개</span></h3>
            <ul>{blocks.map((block, index) => <li className="weekly-replan-block" key={`${block.actionId}-${index}`}>
              <div className="weekly-replan-block-meta"><span className={block.replacesBlockId ? 'weekly-replan-kind' : 'weekly-replan-kind is-new'}>{block.replacesBlockId ? '재배치' : '새 일정'}</span><span>{Math.round((Date.parse(block.end) - Date.parse(block.start)) / 60000)}분</span></div>
              <strong>{block.title}</strong>
              <p><time dateTime={block.start}>{scheduleTime(block.start, block.end)}</time></p>
            </li>)}</ul>
          </section>)}
          {!draft.blocks.length && <div className="weekly-replan-empty"><CalendarBlank size={32} aria-hidden="true" /><strong>다시 배치할 일정이 없어요.</strong><p>남은 할 일이 생기면 다시 확인해 주세요.</p></div>}
        </div>
        <footer className="weekly-replan-footer">
          {error && <p role="alert" className="weekly-replan-error">{error}</p>}
          {!!draft.warnings?.length && <p className="weekly-replan-footer-note">마감·배치 관련 안내 {draft.warnings.length}개를 확인해 주세요.</p>}
          <div><ReButton variant="ghost" disabled={busy} onClick={() => setDraft(null)}>취소</ReButton>
            <ReButton full disabled={busy || !draft.blocks.length} onClick={() => void run(true)}>{busy ? '적용하는 중…' : '확인하고 적용'}</ReButton></div>
        </footer>
      </div>
    </dialog>}
  </section>;
}
