import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { WeeklyReplanCard } from '../components/WeeklyReplanCard';
import { plansApi } from '../lib/api';
import '../index.css';

export function mountPreview() {
  if (!import.meta.env.DEV) return;
  window.fetch = async () => { throw new Error('개발 fixture: 네트워크 요청 차단'); };
  plansApi.generateReplan = async () => ({
    planId: 'fixture-plan', windowStart: '2026-10-08', horizon: null, generatedAt: '2026-10-08T09:00:00+09:00',
    warnings: ['팀 프로젝트 보고서의 마감은 10월 9일이에요. 변경할 일정을 확인해 주세요.', '기존 회의와 수면 시간은 유지돼요.', '이 화면은 UI 검증용 시연 데이터입니다.'],
    blocks: Array.from({ length: 60 }, (_, index) => {
      const start = new Date(Date.UTC(2026, 9, 8 + Math.floor(index / 3), 12 + index % 3));
      return { actionId: `fixture-${index}`, title: ['팀 프로젝트 보고서에 필요한 자료 정리', '팀 프로젝트 보고서 초안 작성 및 팀 실험 결과 반영', '작성한 보고서의 인용 자료와 수치를 확인하고 최종 제출 파일 검토'][index % 3], category: 'study', start: start.toISOString(), end: new Date(start.getTime() + 30 * 60000).toISOString(), replacesBlockId: index % 3 === 0 ? null : `block_fixture-internal-${index}` };
    }),
  });
  plansApi.approveReplan = async () => ({ planId: 'fixture-plan', cancelledBlocks: 40, createdBlocks: 60, skippedBlocks: 0, activatedAt: '' });
  function Preview() {
    const [applied, setApplied] = useState(false);
    return <main style={{ padding: 24, fontFamily: 'Pretendard, sans-serif' }}><h1 style={{ fontSize: 24 }}>주간 계획</h1><p>개발 검증용 · 시연 데이터 60개</p><WeeklyReplanCard onApproved={() => setApplied(true)} />{applied && <p>시연 적용 완료 · 실제 일정 변경 없음</p>}</main>;
  }
  createRoot(document.getElementById('root')!).render(<Preview />);
}
