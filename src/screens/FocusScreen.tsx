import React from 'react';
import { CaretLeft, Pause, Check } from '@phosphor-icons/react';
import { Chip } from '../components/Chip';
import { ReButton } from '../components/ReButton';
import { todayApi } from '../lib/api';
import type { Task } from '../types';

interface FocusScreenProps {
  // 잘못된 상태(force navigation, 빈 tasks 등)로 마운트되어도 폭발하지 않도록 null 허용.
  task: Task | null;
  // 실행 ID(exec_<uuid>) — 시작/체크인 등 실행 생명주기는 컨트롤러(ReActionMerged)가
  // 소유한다 (#19-B). 본 화면은 표시 + pause 시도만.
  executionId?: string | null;
  elapsedMin: number;
  totalMin: number;
  onPause: () => void;
  onComplete: () => void;
  onBack: () => void;
}

export function FocusScreen({ task, executionId, elapsedMin, totalMin, onPause, onComplete, onBack }: FocusScreenProps) {

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
    // pause 는 #19-B-2 까지 백엔드 501 — 시도만 하고 조용히 진행.
    if (executionId) {
      todayApi.pause(executionId).catch(() => {});
    }
    onPause();
  };

  const handleComplete = () => {
    // done 체크인은 컨트롤러(markDone → checkInRemote)가 수행 — 이중 체크인 방지.
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
