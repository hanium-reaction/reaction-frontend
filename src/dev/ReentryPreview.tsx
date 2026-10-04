import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MergedTodayScreen } from '../screens/TodayScreen';
import { MergedRecoveryScreen } from '../screens/RecoveryScreen';
import { RecoveredScreen, type AppliedRecovery } from '../screens/RecoveredScreen';
import { todayApi, plansApi, goalsApi, habitsApi, reflectionApi, recoveryApi, replanApi } from '../lib/api';
import type { Task } from '../types';
import '../index.css';

const tasks: Task[] = [
  { id: 'fixture-report', title: '포트폴리오 프로젝트 정리', status: 'partial_done', dur: '40분', goal: 'career', executionId: 'fixture-execution', firstStep: '어제 작성한 목차를 열고 핵심 내용을 한 문단 적어요.' },
  { id: 'fixture-reading', title: '책 한 챕터 읽기', status: 'todo', dur: '20분', missedCheckIn: true, firstStep: '책갈피가 있는 페이지를 펴요.' },
  { id: 'fixture-walk', title: '가볍게 산책하기', status: 'todo', dur: '15분' },
];
const applied: AppliedRecovery = { taskTitle: tasks[0].title, failReason: '시간이 부족했어요', proposalTitle: '핵심 내용 한 문단만', proposalDesc: '작성한 목차에서 가장 중요한 항목 하나를 골라 짧게 정리해요.', proposalTime: '10분', requiresReplan: true, proposalType: 'DOWNSCOPE' };

export function mountPreview() {
  if (!import.meta.env.DEV) return;
  // Fail closed: even accidental unmocked API actions cannot reach any live service.
  window.fetch = async () => { throw new Error('개발 fixture: 네트워크 요청 차단'); };
  todayApi.agenda = async () => ({ date: '2026-10-05', brief: null, habits: [], cards: tasks.map((task) => ({ actionId: task.id, title: task.title, category: task.goal ?? 'growth', priority: 1, source: 'plan', whyNow: null, cancellable: false, status: task.status === 'todo' ? 'pending' : task.status, estimatedMinutes: parseInt(task.dur!), missedCheckIn: task.missedCheckIn, executionId: task.executionId ?? null, firstStep: task.firstStep ?? null })), fixedSchedules: [] });
  plansApi.weekly = async () => ({ days: [] } as unknown as Awaited<ReturnType<typeof plansApi.weekly>>);
  goalsApi.list = async () => ({ focus: [], maintain: [], parked: [] });
  habitsApi.list = async () => [];
  habitsApi.instancesForWeek = async () => [];
  reflectionApi.failureTags = async () => [];
  recoveryApi.generateProposals = async () => ({ aiSource: 'llm', recoveryMode: 'standard', cards: [
    { attemptId: 'fixture-small', optionGroup: 'DOWNSCOPE', labelKo: '핵심 내용 한 문단만', suggestedActionText: applied.proposalDesc, minRecoveryUnitMinutes: 10, triggerTag: 'TIME_SHORTAGE' },
    { attemptId: 'fixture-later', optionGroup: 'RESCHEDULE', labelKo: '시간을 다시 정하기', suggestedActionText: '주간 계획을 보고 집중할 수 있는 시간을 골라요.' },
    { attemptId: 'fixture-park', optionGroup: 'PARK', labelKo: '잠시 보류하기', suggestedActionText: '지금은 내려놓고 다시 확인할 시점을 정해요.' },
  ] } as Awaited<ReturnType<typeof recoveryApi.generateProposals>>);
  recoveryApi.decide = async (body) => ({ resultingActionItemId: body.acceptedAttemptId === 'fixture-small' ? 'fixture-new' : null } as Awaited<ReturnType<typeof recoveryApi.decide>>);
  replanApi.diff = async () => ({ executionId: 'fixture-execution', optionGroup: 'DOWNSCOPE', before: { actionItemId: 'fixture-report', title: tasks[0].title, targetDate: '2026-10-05', startAt: '2026-10-05T19:00:00+09:00', endAt: '2026-10-05T19:40:00+09:00', estimatedMinutes: 40 }, after: { actionItemId: 'fixture-new', title: applied.proposalTitle, targetDate: '2026-10-06', startAt: '2026-10-06T19:00:00+09:00', endAt: '2026-10-06T19:10:00+09:00', estimatedMinutes: 10 }, isDraft: true });
  replanApi.approve = async () => { throw new Error('테스트 화면에서는 실제 일정을 반영하지 않습니다.'); };
  createRoot(document.getElementById('root')!).render(<Preview />);
}
function Preview() {
  const [page, setPage] = useState(new URLSearchParams(location.search).get('screen') ?? 'today');
  const [items, setItems] = useState(tasks);
  const [selection, setSelection] = useState(applied);
  const [active, setActive] = useState(tasks[0]);
  return <div style={{ height: '100dvh', background: 'var(--surface-ground)', display: 'flex', flexDirection: 'column' }}>
    <header style={{ padding: '10px 16px', borderBottom: '1px solid var(--sand-200)', fontSize: 11, display: 'flex', gap: 12, alignItems: 'center' }}><strong>테스트 데이터 · 실제 저장 없음</strong>{['today', 'recovery', 'recovered'].map((value, index) => <button key={value} onClick={() => setPage(value)} aria-label={value} style={{ color: 'var(--coral-700)' }}>{['오늘', '방법', '확인'][index]}</button>)}</header>
    <main style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', maxWidth: 900, margin: '0 auto' }}>
      {page === 'today' && <MergedTodayScreen tasks={items} onAgendaLoaded={setItems} onOpen={() => {}} onMarkDone={() => {}} onPartial={() => setPage('recovery')} onFail={() => setPage('recovery')} onOpenRecovery={(id) => { setActive(items.find((task) => task.id === id) ?? tasks[0]); setPage('recovery'); }} onEvening={() => {}} />}
      {page === 'recovery' && <MergedRecoveryScreen task={active} failReason="시간이 부족했어요" executionId="fixture-execution" onDismiss={() => setPage('today')} onOpenWeekly={() => {}} onAccept={(proposal, requiresReplan) => { setSelection({ ...applied, proposalTitle: proposal.title, proposalDesc: proposal.desc, proposalType: proposal.type, requiresReplan }); setPage('recovered'); }} />}
      {page === 'recovered' && <RecoveredScreen recoveryCount={1} applied={selection} executionId="fixture-execution" onDone={() => setPage('today')} onOpenWeekly={() => setPage('today')} />}
    </main>
  </div>;
}
