import React, { useRef } from 'react';
import { CaretLeft, Pause, Check } from '@phosphor-icons/react';
import { Chip } from '../components/Chip';
import { ReButton } from '../components/ReButton';
import { todayApi } from '../lib/api';
import type { Task } from '../types';

interface FocusScreenProps {
  // 잘못된 상태(force navigation, 빈 tasks 등)로 마운트되어도 폭발하지 않도록 null 허용.
  task: Task | null;
  elapsedMin: number;
  totalMin: number;
  // 일시정지 후 재진입이면 이 execution 을 resume 한다 (없으면 새로 start).
  resumeExecutionId?: string | null;
  onPause: () => void;
  // 일시정지 시 확보한 executionId 를 부모로 올려 재진입 때 resume 하도록 한다.
  onPaused?: (executionId: string) => void;
  onComplete: () => void;
  onBack: () => void;
}

export function FocusScreen({ task, elapsedMin, totalMin, resumeExecutionId, onPause, onPaused, onComplete, onBack }: FocusScreenProps) {
  // 백엔드 /today/* 실연동: start(#13)·pause/resume(#83)·check-in(#13) 을 시도하되
  // 실패는 조용히 — 화면 흐름(onPause/onComplete) 은 그대로 진행(fallback).
  const executionIdRef = useRef<string | null>(null);

  // 첫 진입 시: 재진입(resumeExecutionId)이면 resume, 아니면 새 세션 start.
  React.useEffect(() => {
    if (!task) return;
    let cancelled = false;
    if (resumeExecutionId) {
      executionIdRef.current = resumeExecutionId;
      todayApi.resume(resumeExecutionId).catch(() => { /* 실패해도 진행 */ });
    } else {
      todayApi.start(task.id).then(
        (e) => { if (!cancelled) executionIdRef.current = e.executionId; },
        () => { /* 미구현/실패 — 그냥 진행 */ },
      );
    }
    return () => { cancelled = true; };
  }, [task?.id, resumeExecutionId]);

  // task 없이 잘못 마운트된 경우 — 빈 흰 화면 대신 명확한 안내 + 뒤로가기.
  if (!task) {
    return (
      <div style={{ padding: '60px 24px', background: 'var(--surface-ground)', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, textAlign: 'center' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: 'var(--text-1)' }}>시작할 카드가 없어요</div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 260, margin: 0, lineHeight: 1.6 }}>오늘 화면에서 카드를 골라 시작해주세요.</p>
        <ReButton variant="primary" size="md" onClick={onBack}>오늘로 돌아가기</ReButton>
      </div>
    );
  }

  const handlePause = () => {
    if (executionIdRef.current) {
      todayApi.pause(executionIdRef.current).catch(() => {});
      onPaused?.(executionIdRef.current);
    }
    onPause();
  };

  const handleComplete = () => {
    if (executionIdRef.current) {
      // 소요 시간(actualDurationMinutes)은 백엔드가 start 시각 기준으로 계산한다.
      todayApi
        .checkIn(
          { executionId: executionIdRef.current, completionStatus: 'done' },
          `check-${executionIdRef.current}`,
        )
        .catch(() => {});
    }
    onComplete();
  };

  const pct = Math.min(elapsedMin / totalMin, 1);
  const R = 120;
  const circumference = 2 * Math.PI * R;

  return (
    <div style={{ padding: '12px 20px 110px', background: 'var(--surface-ground)', minHeight: '100%' }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-2)', padding: 0, marginBottom: 20, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
        <CaretLeft size={20} /> Today
      </button>
      <Chip tone="amber" style={{ marginBottom: 12 }}>● Executing · Stage 4</Chip>
      <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 4 }}>{task.title}</h1>
      <p className="tnum" style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 36 }}>시작 14:02 · 목표 {totalMin}분</p>

      <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 28px' }}>
        <svg width="280" height="280" viewBox="0 0 280 280">
          <circle cx="140" cy="140" r={R} stroke="var(--sand-200)" strokeWidth="10" fill="none" />
          <circle
            cx="140" cy="140" r={R} stroke="var(--brand)" strokeWidth="10" fill="none"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)}
            transform="rotate(-90 140 140)"
          />
          <text x="140" y="138" textAnchor="middle" fontSize="56" fontWeight="700" fill="var(--text-1)" fontFamily="Pretendard Variable" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.04em' }}>
            {String(elapsedMin).padStart(2, '0')}:00
          </text>
          <text x="140" y="166" textAnchor="middle" fontSize="13" fill="var(--text-3)" fontFamily="Pretendard Variable" letterSpacing="0.08em">
            {totalMin - elapsedMin}분 남음
          </text>
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <ReButton variant="ghost" size="lg" full onClick={handlePause}>
          <Pause size={18} /> 잠깐 멈춤
        </ReButton>
        <ReButton variant="primary" size="lg" full onClick={handleComplete}>
          <Check size={18} /> 완료
        </ReButton>
      </div>
    </div>
  );
}
