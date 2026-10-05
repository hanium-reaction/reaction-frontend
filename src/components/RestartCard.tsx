import React, { useState } from 'react';
import { ArrowRight, ArrowsClockwise } from '@phosphor-icons/react';
import type { Task } from '../types';
import './reentry.css';

export function RestartCard({ tasks, onReview, onRecovery }: {
  tasks: Task[];
  onReview: (id: string) => void;
  onRecovery: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState('');
  const candidates = tasks.filter((task) => !task.fixed && task.status !== 'done' &&
    (task.missedCheckIn || ['partial_done', 'failed', 'recovery_pending'].includes(task.status)));
  const selected = candidates.find((task) => task.id === selectedId)
    ?? candidates.find((task) => task.missedCheckIn)
    ?? candidates.find((task) => ['partial_done', 'failed', 'recovery_pending'].includes(task.status))
    ?? candidates[0];
  if (!selected) return null;
  const canReplan = ['partial_done', 'failed', 'recovery_pending'].includes(selected.status);
  return <section className="restart-card workspace-restart" aria-labelledby="restart-title">
    <div className="restart-heading-icon"><ArrowsClockwise size={20} weight="bold" /></div>
    <h2 id="restart-title">다시 정할 일</h2>
    <p>계획이 달라졌다면, 지금 가능한 방법으로.</p>
    <label className="restart-select-label" htmlFor="restart-task">다시 살펴볼 항목 <span>{candidates.length}개</span></label>
    <select id="restart-task" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
      {candidates.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
    </select>
    <div className="restart-context">
      <span>{selected.missedCheckIn ? '결과 확인 대기' : selected.status === 'partial_done' ? '일부 완료 기록' : canReplan ? '계획 다시 살펴보기' : selected.status === 'in_progress' ? '진행 중' : '시작 전'}</span>
      {selected.dur && <span>계획 {selected.dur}</span>}
    </div>
    <button className="reentry-primary" onClick={() => canReplan ? onRecovery(selected.id) : onReview(selected.id)}>
      {canReplan ? '다시 시작할 방법 보기' : '이 항목부터 확인하기'} <ArrowRight size={18} />
    </button>
    <small>{selected.missedCheckIn ? '아직 결과를 확인하지 않았어요. 실제로 한 만큼 기록해 주세요.' : '한 항목씩 확인해요. 나머지 계획도 이어서 살펴볼 수 있어요.'}</small>
  </section>;
}
