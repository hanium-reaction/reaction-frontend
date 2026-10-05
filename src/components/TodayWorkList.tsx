import { useId, useState } from 'react';
import { CaretDown, MagnifyingGlass } from '@phosphor-icons/react';
import type { Task, TaskStatus } from '../types';
import './today-work-list.css';

export interface WorkListItem { task: Task; time?: string; dur?: string; goalLabel?: string }
type View = 'all' | 'planned' | 'replan' | 'done';
const views: { id: View; label: string }[] = [
  { id: 'all', label: '전체' }, { id: 'planned', label: '예정' },
  { id: 'replan', label: '재계획' }, { id: 'done', label: '완료' },
];
const statuses: Record<TaskStatus, { label: string; view: Exclude<View, 'all'> }> = {
  todo: { label: '예정', view: 'planned' }, in_progress: { label: '진행 중', view: 'planned' },
  failed: { label: '다시 정하기', view: 'replan' }, partial_done: { label: '일부 완료', view: 'replan' },
  recovery_pending: { label: '재계획 대기', view: 'replan' }, done: { label: '완료', view: 'done' },
};

/** Linear's focused lists/peek, adapted to touch: inspecting never starts or completes a task. */
export function TodayWorkList({ items, title = '오늘의 작업', interactive = true, onDetail, onRecovery }: {
  items: WorkListItem[]; title?: string; interactive?: boolean;
  onDetail: (id: string) => void; onRecovery: (id: string) => void;
}) {
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const headingId = useId();
  const needle = query.trim().toLocaleLowerCase();
  const visible = items.filter(({ task, goalLabel }) =>
    (view === 'all' || statuses[task.status].view === view)
    && `${task.title} ${goalLabel ?? task.goal ?? ''}`.toLocaleLowerCase().includes(needle));
  return (
    <section className="work-list" aria-labelledby={headingId}>
      <header className="work-list-heading"><h2 id={headingId}>{title}</h2><span>{items.length}개</span></header>
      <div className="work-list-filters" role="group" aria-label="작업 상태 필터">
        {views.map(({ id, label }) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>
          {label}<span>{id === 'all' ? items.length : items.filter(({ task }) => statuses[task.status].view === id).length}</span>
        </button>)}
      </div>
      <label className="work-list-search"><MagnifyingGlass size={18} aria-hidden="true" />
        <input type="search" aria-label="작업 또는 목표 검색" placeholder="작업 또는 목표 검색" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <p className="work-list-hint" aria-live="polite">{visible.length}개 표시 · 작업을 누르면 첫 행동과 상세 내용을 볼 수 있어요.</p>
      <div className="work-list-items">
        {visible.map(({ task, time, dur, goalLabel }) => {
          const status = statuses[task.status];
          return <details className="work-list-item" key={task.id}>
            <summary>
              <span className={`work-list-state work-list-state--${status.view}`} aria-hidden="true" />
              <span className="work-list-main"><strong>{task.title}</strong>
                <span className="work-list-meta">{[time ?? task.time, dur ?? task.dur, goalLabel ?? task.goal].filter(Boolean).join(' · ') || '시간 미정'}</span>
              </span>
              <span className={`work-list-status work-list-status--${status.view}`}>{status.label}</span>
              <CaretDown className="work-list-chevron" size={16} aria-hidden="true" />
            </summary>
            <div className="work-list-preview">
              {task.firstStep && <p><strong>첫 행동</strong>{task.firstStep}</p>}
              {task.whyNow && <p><strong>이 작업을 하는 이유</strong>{task.whyNow}</p>}
              {task.failReason && <p><strong>기록한 중단 사유</strong>{task.failReason}</p>}
              {!task.firstStep && !task.whyNow && !task.failReason && <p>아직 추가 설명이 없어요. 계획 상세에서 내용을 확인해 주세요.</p>}
              <div className="work-list-actions">
                <button type="button" disabled={!interactive} onClick={() => onDetail(task.id)}>계획 자세히</button>
                {status.view === 'replan' && !task.fixed && <button type="button" className="work-list-replan" disabled={!interactive} onClick={() => onRecovery(task.id)}>다음 행동 다시 정하기</button>}
              </div>
              {!interactive && <p>주간에서 가져온 일정이에요. 주간 화면에서 내용을 확인해 주세요.</p>}
            </div>
          </details>;
        })}
      </div>
      {visible.length === 0 && <div className="work-list-empty"><p>{needle ? '검색 조건에 맞는 작업이 없어요.' : '이 상태의 작업은 없어요.'}</p><button type="button" onClick={() => { setQuery(''); setView('all'); }}>전체 작업 보기</button></div>}
    </section>
  );
}
