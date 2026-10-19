// Development-only harness. Real screen components and HTTP client, loopback test API.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReentryScreen } from '../../src/screens/ReentryScreen';
import { QuickStart } from '../../src/components/QuickStart';
import { ReentryEvidenceCard } from '../../src/components/ReentryEvidenceCard';
import { workContextApi } from '../../src/lib/api';
import type { Task } from '../../src/types';
import { FocusScreen } from '../../src/screens/FocusScreen';
import type { ReentryState } from '../../src/types/api';
import '../../src/index.css';
import '../../src/styles/interface.css';
import '../../src/styles/native-flow.css';

function TestFlow() {
  const [state, setState] = useState<ReentryState | null>(null);
  const [complete, setComplete] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  return <main style={{ maxWidth: 700, margin: '0 auto' }}>
    <p>로컬 P0/P1 연결 검증 · 테스트 데이터</p>
    {!task ? <QuickStart userId="local-test" onDetailed={() => {}} onStart={a => setTask({id:a.actionId,title:a.title,status:"todo"})} /> : complete ? <><h1>전체 과제 완료 기록됨</h1><ReentryEvidenceCard weekStart="2026-10-19" /></> : state ? <><label>독립 메모 저장 검증<input value={note} onChange={e => setNote(e.target.value)} /></label><button onClick={async () => { await workContextApi.saveNote(state.executionId!, note); setNoteSaved(true); }}>메모 저장</button>{noteSaved && <p>메모 저장됨</p>}<FocusScreen task={task} reentry={state}
      elapsedMin={0} totalMin={30} onPause={() => {}} onBack={() => setState(null)}
      onComplete={() => setComplete(true)} onStopWithResult={() => setState(null)} /></>
      : <ReentryScreen task={task} onStart={setState} onBack={() => setState(null)} />}
  </main>;
}
if (!import.meta.env.DEV) throw new Error('Development-only test harness');
createRoot(document.getElementById('root')!).render(<TestFlow />);
