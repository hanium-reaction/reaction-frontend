import { useState } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FailureTagPicker, primaryFailureReasons, canContinueInterruption, type FailureTagOption } from './FailureTagPicker';
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

function expandDetails() {
  document.querySelectorAll('details').forEach((detail) => { detail.open = true; });
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
    expandDetails();
    fireEvent.click(screen.getByRole('button', { name: '회피' }));
    expandDetails();
    fireEvent.click(screen.getByRole('button', { name: '피곤함' }));
    expect(screen.getByRole('tablist')).toHaveAccessibleName(/선택/);
    fireEvent.click(screen.getByRole('tab', { name: '4' }));
    expect(screen.getByRole('tab', { name: '4' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: '4' }));
    expect(screen.getByRole('tab', { name: '4' })).toHaveAttribute('aria-selected', 'false');
  });

  it.each(['직접 해제', '세 번째 사유로 교체'])('%s 시 이전 회피 점수를 지운다', (mode) => {
    render(<Form />);
    expandDetails();
    fireEvent.click(screen.getByRole('button', { name: '회피' }));
    expandDetails();
    fireEvent.click(screen.getByRole('tab', { name: '5' }));
    if (mode === '직접 해제') fireEvent.click(screen.getByRole('button', { name: '회피' }));
    else {
      fireEvent.click(screen.getByRole('button', { name: '피곤함' }));
      fireEvent.click(screen.getByRole('button', { name: '시간 부족' }));
    }
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '회피' }));
    expandDetails();
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
    expandDetails();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });
});

describe('상황 입력 간소화', () => {
  it('기본 목록은 최대 네 개이며 서버 코드와 라벨을 그대로 보존한다', () => {
    const catalog = [...reasons, { code: 'PLAN_TOO_BIG', labelKo: '분량이 많았어요' },
      { code: 'AMBIGUITY', labelKo: '무엇부터 할지 몰랐어요' }, { code: 'NEW_CODE', labelKo: '새 상황' }];
    expect(primaryFailureReasons(catalog).map((r) => r.code)).toEqual(['TIME_SHORTAGE', 'FATIGUE', 'AMBIGUITY', 'PLAN_TOO_BIG']);
    render(<FailureTagPicker reasons={catalog} selected={[]} onChange={() => {}} memo="" onMemoChange={() => {}} />);
    expect(within(screen.getByRole('group', { name: '자주 쓰는 상황' })).getAllByRole('button')).toHaveLength(4);
    expect(document.querySelector('details')!.open).toBe(false);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expandDetails();
    expect(screen.getByRole('button', { name: '새 상황' })).toBeInTheDocument();
  });
  it('미응답을 임의 태그로 바꾸지 않고, 메모만 저장하는 잘못된 요청을 막는다', () => {
    expect(canContinueInterruption([], '')).toBe(true);
    expect(canContinueInterruption([], '   ')).toBe(true);
    expect(canContinueInterruption([], '졸려서 멈췄어요')).toBe(false);
    expect(canContinueInterruption([reasons[1]], '졸려서 멈췄어요')).toBe(true);
    expect(primaryFailureReasons([])).toEqual([]);
  });
  it('마지막 태그를 해제해도 작성한 메모를 버리지 않고 저장 조건을 알린다', () => {
    render(<FailureTagPicker reasons={reasons} selected={[]} onChange={() => {}} memo="쓰던 내용" onMemoChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('쓰던 내용');
    expect(screen.getByRole('alert')).toHaveTextContent('메모를 저장하려면 상황을 하나');
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
