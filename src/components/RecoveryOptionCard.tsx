import React from 'react';
import { Check, Info } from '@phosphor-icons/react';
import '../styles/guided-redesign.css';

export interface RecoveryOptionCardProps {
  title: string;
  /** if-then 의 then 쪽. "10분만 해보기" 처럼 행동으로 쓴다. */
  description?: string;
  /** if-then 의 if 쪽. "다시 막히면" 처럼 조건으로 쓴다. 앞에 "만약"이 자동으로 붙는다. */
  trigger?: string;
  /** 예상 성공률(0~100). 0 이면 표시하지 않는다 — 근거 없는 숫자를 지어내지 않는다. */
  confidence?: number;
  /** "오늘 21:00 · 20분" 같은 시점 요약. */
  timeLabel?: string;
  /** 첫 번째(=추천) 항목에만 준다. */
  recommended?: boolean;
  selected?: boolean;
  onSelect: () => void;
  /** 이 제안을 왜 골랐는지. 있으면 [왜?] 버튼이 생긴다. */
  why?: string;
  whyOpen?: boolean;
  onToggleWhy?: () => void;
  /** 기존 호출부 호환용. 새 선택 UI는 공통 indigo 강조색을 사용한다. */
  colors?: { bg: string; bc: string; ac: string };
}

/**
 * 막혔을 때 내미는 회복 제안 하나.
 *
 * 선택 버튼과 설명 버튼을 분리한다. 설명을 열어도 제안을 선택하지 않는다.
 *
 * if-then 형식을 쓰는 이유: "만약 [막히면], [10분만]" 처럼 조건과 행동을 미리 묶어두면
 * 그 순간 판단할 필요가 없어진다. 그래서 trigger 는 가능하면 채워서 넘긴다.
 *
 * 성공률은 없으면 없는 대로 둔다. 0 을 넘기면 아예 렌더하지 않는다.
 */
export function RecoveryOptionCard({
  title,
  description,
  trigger,
  confidence = 0,
  timeLabel,
  recommended = false,
  selected = false,
  onSelect,
  why,
  whyOpen = false,
  onToggleWhy,
}: RecoveryOptionCardProps) {
  return (
    <article className={`guided-option${selected ? ' guided-option--selected' : ''}`}>
      <button type="button" className="guided-option-select" aria-pressed={selected} aria-label={title} onClick={onSelect}>
        <span className="guided-option-heading">
          <span className="guided-option-indicator" aria-hidden="true">{selected && <Check size={14} weight="bold" />}</span>
          <strong>{title}</strong>
          {recommended && <span className="guided-option-badge">추천 ✓</span>}
        </span>
        {description && <span className="guided-option-description">{trigger && <span className="guided-option-trigger">만약 {trigger}, </span>}{description}</span>}
        {(confidence > 0 || timeLabel) && <span className="guided-option-meta">{confidence > 0 && <span>성공률 {confidence}%</span>}{timeLabel && <span>{timeLabel}</span>}</span>}
      </button>
      {why && <div className="guided-option-explanation">
        <button type="button" className="guided-why" aria-expanded={whyOpen} onClick={onToggleWhy}><Info size={15} /> 왜?</button>
        {whyOpen && <p>{why}</p>}
      </div>}
    </article>
  );
}
