import React, { useEffect, useState } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { MergedTabBar } from '../components/TabBar';
import { SystemIntroScreen } from '../screens/SystemIntroScreen';
import { GoalIntakeScreen } from '../screens/GoalIntakeScreen';
import { GoalClassificationScreen } from '../screens/GoalClassificationScreen';
import { SetupScreen } from '../screens/SetupScreen';
import { WeeklyPlanGenerationScreen } from '../screens/WeeklyPlanGenerationScreen';
import { MorningBriefScreen } from '../screens/MorningBriefScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { MergedTodayScreen } from '../screens/TodayScreen';
import { FocusScreen } from '../screens/FocusScreen';
import { MergedRecoveryScreen } from '../screens/RecoveryScreen';
import { RecoveredScreen } from '../screens/RecoveredScreen';
import { EveningCheckInScreen } from '../screens/EveningCheckInScreen';
import { WeeklyCalendarScreenV2 } from '../screens/WeeklyCalendarScreen';
import { WeeklyReviewScreenV2 } from '../screens/WeeklyReviewScreen';
import { BASE_TASKS } from '../data';
import { useNavigation } from '../contexts/NavigationContext';
import { reflectionApi, todayApi } from '../lib/api';
import type { ScreenId, TabId, Task, TaskStatus } from '../types';
import type { AgendaCard, FailureTagMaster } from '../types/api';

// 백엔드 actionId('action_<uuid>') 만 실 API 체인을 태운다 — mock id('t1' 등)는 로컬 전용.
const isBackendTask = (id: string) => id.startsWith('action_');

// AgendaCard.status(#19-A) → 화면 TaskStatus
const STATUS_MAP: Record<string, TaskStatus> = {
  planned: 'todo',
  in_progress: 'in_progress',
  done: 'done',
  partial_done: 'partial_done',
  failed: 'failed',
  over_done: 'done',
};

function cardToTask(card: AgendaCard): Task {
  return {
    id: card.actionId,
    title: card.title,
    status: STATUS_MAP[card.status] ?? 'todo',
    dur: `${card.estimatedMinutes}분`,
    carryover: card.source === 'recovery_carryover',
    tag: card.source.startsWith('recovery_')
      ? { tone: 'coral', label: '복구 카드' }
      : undefined,
  };
}

// onboarding 흐름은 백엔드 §3 state machine 을 기반으로 하되, 클라이언트에서 두 쌍을
// 묶고 coping-style 을 제거해 8단계 → 5단계로 줄였다 (recovery.tone 은 인터뷰에서 받음):
//   intro → goal-intake → goal-classify → calendar-schedule(S04+S05)
//   → weekly-plan(S06) → policies-notifications(S07+S08) → morning-brief(첫 카드) → today
const NAV_META: Record<ScreenId, { label: string; back: ScreenId | null }> = {
  'intro':                  { label: 'RE:ACTION',      back: null },
  'goal-intake':            { label: '목표 파악',      back: 'intro' },
  'goal-classify':          { label: '목표 분류',      back: 'goal-intake' },
  'setup':                  { label: '마무리 확인',    back: 'goal-classify' },
  'weekly-plan':            { label: '주간 계획 생성', back: 'setup' },
  'morning-brief':          { label: '모닝 브리프',    back: 'weekly-plan' },
  'today':                  { label: '오늘의 실행',    back: null },
  'focus':                  { label: '집중 모드',      back: 'today' },
  'recovery':               { label: '복구 코치',      back: 'today' },
  'recovered':              { label: '회복 완료',      back: null },
  'evening':                { label: '저녁 체크인',    back: 'today' },
  'weekly':                 { label: '주간 계획',      back: null },
  'inbox':                  { label: 'LIFE INBOX',     back: null },
  'review':                 { label: '주간 리뷰',      back: null },
  'settings':               { label: '설정',           back: 'today' },
};

const TAB_SCREENS: ScreenId[] = ['today', 'weekly', 'inbox', 'review'];

function MergedTopNav({ screen, onBack }: { screen: ScreenId; onBack: () => void }) {
  const meta = NAV_META[screen] || { label: 'RE:ACTION', back: null };
  if (screen === 'intro') return null;
  return (
    <div style={{
      height: 44, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 18px', zIndex: 20,
    }}>
      {meta.back ? (
        <button onClick={onBack} style={{
          width: 44, height: 44, borderRadius: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--surface-raised)', border: '1px solid var(--sand-200)',
          cursor: 'pointer',
        }}>
          <CaretLeft size={14} color="var(--text-2)" />
        </button>
      ) : <div style={{ width: 44 }} />}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontFamily: 'var(--font-mono)',
        letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-2)',
      }}>
        <div style={{ width: 5, height: 5, borderRadius: 9999, background: 'var(--brand)' }} />
        {meta.label}
      </div>
      <div style={{ width: 44 }} />
    </div>
  );
}

interface ReActionMergedProps {
  hideTabs?: boolean;
}

export function ReActionMerged({ hideTabs = false }: ReActionMergedProps) {
  const { screen, tab, setScreen, setTab } = useNavigation();

  const [tasks, setTasks] = useState<Task[]>(BASE_TASKS);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [failReason, setFailReason] = useState('');
  const [recoveryCount, setRecoveryCount] = useState(37);
  // taskId(action_<uuid>) → executionId(exec_<uuid>) — #19-B 실행 추적
  const [executions, setExecutions] = useState<Record<string, string>>({});
  // 13종 실패 사유 마스터 (S18 칩 + label→tagCode 매핑) — #19-B
  const [failTags, setFailTags] = useState<FailureTagMaster[]>([]);
  // 복구 화면에 넘길 실행 ID — #20-A
  const [activeExecutionId, setActiveExecutionId] = useState<string | null>(null);

  // mock-and-replace: 백엔드 agenda 에 오늘 카드가 있으면 mock(BASE_TASKS) 교체.
  useEffect(() => {
    let cancelled = false;
    todayApi.agenda().then(
      (agenda) => {
        if (cancelled) return;
        if (agenda.cards.length > 0) setTasks(agenda.cards.map(cardToTask));
      },
      () => { /* 백엔드 미기동 — mock 유지 */ },
    );
    reflectionApi.failureTags().then(
      (tags) => { if (!cancelled) setFailTags(tags); },
      () => { /* mock 라벨 유지 */ },
    );
    return () => { cancelled = true; };
  }, []);

  // [▶ 시작] — 실행 생성 (이미 시작했으면 기존 executionId 재사용). #19-B
  const ensureExecution = async (taskId: string): Promise<string | null> => {
    if (!isBackendTask(taskId)) return null;
    if (executions[taskId]) return executions[taskId];
    try {
      const res = await todayApi.start(taskId);
      setExecutions((m) => ({ ...m, [taskId]: res.executionId }));
      return res.executionId;
    } catch {
      return executions[taskId] ?? null;
    }
  };

  // Quick Check-in (4칩 중 done/failed 만 — partial 은 #19-B-2). 실패는 조용히.
  const checkInRemote = async (
    taskId: string,
    completionStatus: 'done' | 'failed',
  ): Promise<string | null> => {
    const executionId = await ensureExecution(taskId);
    if (!executionId) return null;
    try {
      await todayApi.checkIn({ executionId, completionStatus });
    } catch { /* 이미 체크인됨(409) 등 — 데모 흐름 유지 */ }
    return executionId;
  };

  const showTabs = !hideTabs && TAB_SCREENS.includes(screen);

  const markDone = (id: string) => {
    setTasks((ts) => ts.map((t) => t.id === id ? { ...t, status: 'done' } : t));
    void checkInRemote(id, 'done');
  };

  const markPartial = (id: string, pct: number) =>
    setTasks((ts) => ts.map((t) => t.id === id
      ? { ...t, status: pct >= 100 ? 'done' : pct === 0 ? 'todo' : 'partial_done', progress: pct }
      : t
    ));

  const markFailed = (id: string, reason: string) => {
    setTasks((ts) => ts.map((t) => t.id === id ? { ...t, status: 'failed', failReason: reason } : t));
    setActiveTask(tasks.find((t) => t.id === id) || null);
    setFailReason(reason);
    // 실 API 체인: 체크인(failed) → 실패 사유 태깅 → 복구 화면 (#19-B → §11 → §12)
    void (async () => {
      const executionId = await checkInRemote(id, 'failed');
      setActiveExecutionId(executionId);
      if (executionId) {
        const tagCode = failTags.find((t) => t.labelKo === reason)?.tagCode;
        if (tagCode) {
          try {
            await reflectionApi.tagExecution(executionId, { tagCodes: [tagCode] });
          } catch { /* 이미 태깅됨(409) 등 */ }
        }
      }
      setScreen('recovery');
    })();
  };

  // 실제 시작 트리거 — task 를 in_progress 로 전이하고 focus 화면으로.
  // 이미 in_progress 인 다른 task 가 있으면 todo 로 되돌린다 (동시 하나만).
  const openTask = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.status === 'done' || t.status === 'failed') return;
    setTasks((ts) =>
      ts.map((x) => {
        if (x.id === id) return { ...x, status: 'in_progress' as const };
        if (x.status === 'in_progress') return { ...x, status: 'todo' as const };
        return x;
      }),
    );
    setActiveTask({ ...t, status: 'in_progress' });
    void ensureExecution(id);
    setScreen('focus');
  };

  const openRecovery = () => {
    const partial = tasks.find((t) => t.status === 'partial_done' || t.status === 'recovery_pending');
    const target = partial || tasks[1];
    setActiveTask(target);
    setActiveExecutionId(target ? (executions[target.id] ?? null) : null);
    setScreen('recovery');
  };

  const acceptRecovery = () => {
    setRecoveryCount((c) => c + 1);
    if (activeTask) setTasks((ts) => ts.map((t) => t.id === activeTask.id ? { ...t, status: 'done' } : t));
    setScreen('recovered');
  };

  const handleTabChange = (id: TabId) => { setTab(id); setScreen(id); };

  const goBack = () => {
    const meta = NAV_META[screen];
    if (meta?.back) setScreen(meta.back);
    else setScreen('today');
  };

  const handleFocusComplete = () => {
    if (activeTask) markDone(activeTask.id);
    setScreen('today');
    setActiveTask(null);
  };

  return (
    <div style={{
      width: '100%', height: '100%', flex: 1,
      overflow: 'hidden', background: 'var(--surface-ground)',
      display: 'flex', flexDirection: 'column',
    }}>
      <MergedTopNav screen={screen} onBack={goBack} />

      <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {screen === 'intro' && (
          <SystemIntroScreen onDone={() => setScreen('goal-intake')} />
        )}
        {screen === 'goal-intake' && (
          <GoalIntakeScreen onDone={() => setScreen('goal-classify')} />
        )}
        {screen === 'goal-classify' && (
          <GoalClassificationScreen onNext={() => setScreen('setup')} />
        )}
        {screen === 'setup' && (
          <SetupScreen onDone={() => setScreen('weekly-plan')} />
        )}
        {screen === 'weekly-plan' && (
          <WeeklyPlanGenerationScreen onContinue={() => setScreen('morning-brief')} />
        )}
        {screen === 'morning-brief' && (
          <MorningBriefScreen onStart={() => { setTab('today'); setScreen('today'); }} />
        )}
        {screen === 'today' && (
          <MergedTodayScreen
            tasks={tasks}
            failTags={failTags}
            onOpen={openTask}
            onMarkDone={markDone}
            onPartial={markPartial}
            onFail={markFailed}
            onOpenRecovery={openRecovery}
            onEvening={() => setScreen('evening')}
          />
        )}
        {screen === 'focus' && activeTask && (
          <FocusScreen
            task={activeTask}
            executionId={activeTask ? (executions[activeTask.id] ?? null) : null}
            elapsedMin={18} totalMin={45}
            onBack={() => { setScreen('today'); setActiveTask(null); }}
            onPause={() => setScreen('today')}
            onComplete={handleFocusComplete}
          />
        )}
        {screen === 'recovery' && (
          <MergedRecoveryScreen
            task={activeTask}
            executionId={activeExecutionId}
            failReason={failReason}
            onAccept={acceptRecovery}
            onDismiss={() => setScreen('today')}
          />
        )}
        {screen === 'recovered' && (
          <RecoveredScreen
            recoveryCount={recoveryCount}
            onDone={() => { setTab('today'); setScreen('today'); }}
          />
        )}
        {screen === 'evening' && (
          <EveningCheckInScreen onDone={() => { setTab('weekly'); setScreen('weekly'); }} />
        )}
        {screen === 'weekly' && <WeeklyCalendarScreenV2 />}
        {screen === 'inbox' && <InboxScreen />}
        {screen === 'review' && <WeeklyReviewScreenV2 />}
        {screen === 'settings' && <SettingsScreen />}
      </div>

      {showTabs && <MergedTabBar active={tab} onChange={handleTabChange} />}
    </div>
  );
}
