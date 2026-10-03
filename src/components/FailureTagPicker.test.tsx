import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FailureTagPicker, type FailureTagOption } from './FailureTagPicker';
import { normalizeFailureTagRequest } from '../lib/failureReason';

const reasons = [
  { code: 'AVOIDANCE', labelKo: '회피' },
  { code: 'FATIGUE', labelKo: '피곤함' },
  { code: 'TIME_SHORTAGE', labelKo: '시간 부족' },
];

function Form() {
  const [selected, setSelected] = useState<FailureTagOption[]>([]);
  const [score, setScore] = useState<number | null>(null);
  return <FailureTagPicker reasons={reasons} selected={selected} onChange={setSelected}
    memo="" onMemoChange={() => {}} aversiveness={score} onAversivenessChange={setScore} />;
}

describe('사유별 회피 문항', () => {
  it('피로와 시간 부족만 선택하면 회피 정도를 묻지 않는다', () => {
    render(<Form />);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '피곤함' }));
    fireEvent.click(screen.getByRole('button', { name: '시간 부족' }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('회피와 피로를 함께 선택하면 선택 문항을 표시하고 점수를 취소할 수 있다', () => {
    render(<Form />);
    fireEvent.click(screen.getByRole('button', { name: '회피' }));
    fireEvent.click(screen.getByRole('button', { name: '피곤함' }));
    expect(screen.getByRole('tablist')).toHaveAccessibleName(/선택/);
    fireEvent.click(screen.getByRole('tab', { name: '4' }));
    expect(screen.getByRole('tab', { name: '4' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: '4' }));
    expect(screen.getByRole('tab', { name: '4' })).toHaveAttribute('aria-selected', 'false');
  });

  it.each(['직접 해제', '세 번째 사유로 교체'])('%s 시 이전 회피 점수를 지운다', (mode) => {
    render(<Form />);
    fireEvent.click(screen.getByRole('button', { name: '회피' }));
    fireEvent.click(screen.getByRole('tab', { name: '5' }));
    if (mode === '직접 해제') fireEvent.click(screen.getByRole('button', { name: '회피' }));
    else {
      fireEvent.click(screen.getByRole('button', { name: '피곤함' }));
      fireEvent.click(screen.getByRole('button', { name: '시간 부족' }));
    }
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '회피' }));
    expect(screen.getByRole('tab', { name: '5' })).toHaveAttribute('aria-selected', 'false');
  });

  it('외부에서 사유가 초기화되어도 숨겨진 점수를 지운다', () => {
    const change = vi.fn();
    render(<FailureTagPicker reasons={reasons} selected={[]} onChange={() => {}}
      memo="" onMemoChange={() => {}} aversiveness={4} onAversivenessChange={change} />);
    expect(change).toHaveBeenCalledWith(null);
  });

  it('카탈로그 장애 시 한글 회피 코드도 지원한다', () => {
    render(<FailureTagPicker reasons={[]} selected={[{ code: '회피', labelKo: '회피' }]}
      onChange={() => {}} memo="" onMemoChange={() => {}} onAversivenessChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});

describe('태그 요청의 회피 점수', () => {
  it.each(['TIME_SHORTAGE', 'LOW_ENERGY', 'HARD_TO_START', 'PRIORITY_SHIFT', 'PLAN_TOO_BIG',
    'FATIGUE', 'AMBIGUITY', 'CONFLICT', 'OVERRUN', 'DISTRACTION', 'EMERGENCY', 'CONTEXT_LOSS', '피곤함'])
  ('%s는 회피 점수로 전송하지 않는다', (code) => {
    const body = { tagCodes: [code], memo: '하고 싶었지만 졸렸어요', taskAversiveness: 5 };
    expect(normalizeFailureTagRequest(body)).toEqual({ tagCodes: [code], memo: body.memo });
    expect(body.taskAversiveness).toBe(5);
  });
  it.each(['AVOIDANCE', '회피'])('%s가 포함되면 회피 점수를 보존한다', (code) => {
    const body = { tagCodes: [code, 'FATIGUE'], taskAversiveness: 3 };
    expect(normalizeFailureTagRequest(body)).toEqual(body);
  });
});
