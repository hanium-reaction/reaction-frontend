// Development-only harness. Real screen components and HTTP client, loopback test API.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReentryScreen } from '../../src/screens/ReentryScreen';
import { FocusScreen } from '../../src/screens/FocusScreen';
import type { ReentryState } from '../../src/types/api';
import '../../src/index.css';
import '../../src/styles/interface.css';
import '../../src/styles/native-flow.css';

function TestFlow() {
  const [state, setState] = useState<ReentryState | null>(null);
  const [complete, setComplete] = useState(false);
  const task = { id: 'action_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: '보고서 작성', status: 'todo' as const };
  return <main style={{ maxWidth: 700, margin: '0 auto' }}>
    <p>로컬 P0 연결 검증 · 테스트 데이터</p>
    {complete ? <h1>전체 과제 완료 기록됨</h1> : state ? <FocusScreen task={task} reentry={state}
      elapsedMin={0} totalMin={30} onPause={() => {}} onBack={() => setState(null)}
      onComplete={() => setComplete(true)} onStopWithResult={() => setState(null)} />
      : <ReentryScreen task={task} onStart={setState} onBack={() => setState(null)} />}
  </main>;
}
if (!import.meta.env.DEV) throw new Error('Development-only test harness');
createRoot(document.getElementById('root')!).render(<TestFlow />);
