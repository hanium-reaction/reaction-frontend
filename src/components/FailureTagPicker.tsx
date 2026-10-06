// 실패 사유 태그 입력 폼 (S18, 백엔드 #17 카탈로그).
//
// 원래 오늘 화면(TodayScreen)의 실패 시트 안에만 인라인으로 박혀 있던 UI다. 저녁 일괄
// 회고(EveningCheckInScreen)에서도 같은 입력을 받아야 해서(#238) 폼 본체만 떼어냈다.
// 시트 껍데기(오버레이·바텀시트)는 화면마다 다르므로 여기 넣지 않는다 — 오늘 화면은
// 바텀시트로, 저녁 체크인은 마법사 단계로 각각 감싼다.
import { useEffect, useId, useState } from 'react';
import { FAIL_REASONS } from '../data';
import { reflectionApi } from '../lib/api';
import { hasAvoidanceReason } from '../lib/failureReason';
import { Segmented } from './Segmented';
import './failure-tag-picker.css';

export interface FailureTagOption {
  code: string;
  labelKo: string;
}

// 실패 태그 마스터 카탈로그(GET /reflection/failure-tags, #17).
// 백엔드가 응답하지 않으면 더미 라벨로 버틴다 — 사유 입력 자체가 막히면 안 되기 때문이다.
// tagCode 를 함께 들고 있어야 reflectionApi.tagExecution 에 실제 코드를 실어 보낼 수 있다(#80).
export function useFailureTagCatalog(): FailureTagOption[] {
  const [reasons, setReasons] = useState<FailureTagOption[]>(
    FAIL_REASONS.map((label) => ({ code: label, labelKo: label })),
  );
  useEffect(() => {
    let cancelled = false;
    reflectionApi.failureTags().then(
      (tags) => {
        if (!cancelled && tags.length) setReasons(tags.map((t) => ({ code: t.tagCode, labelKo: t.labelKo })));
      },
      () => { /* 미구현이거나 오류가 발생한 상황 — 더미 라벨을 그대로 유지한다 */ },
    );
    return () => { cancelled = true; };
  }, []);
  return reasons;
}

interface FailureTagPickerProps {
  reasons: FailureTagOption[];
  selected: FailureTagOption[];
  onChange: (next: FailureTagOption[]) => void;
  memo: string;
  onMemoChange: (memo: string) => void;
  memoPlaceholder?: string;
  // task_aversiveness(#222) 1~5 문항. 서버 태그 요청에 값을 보낼 화면에서 켠다.
  aversiveness?: number | null;
  onAversivenessChange?: (v: number | null) => void;
}

// 태그는 최대 2개까지 고를 수 있다. 3번째를 누르면 가장 오래된 것을 밀어낸다(swap).
// 이 규칙을 여기 한 곳에만 두어야 화면마다 상한이 어긋나는 일이 생기지 않는다.
function toggle(selected: FailureTagOption[], r: FailureTagOption): FailureTagOption[] {
  if (selected.some((t) => t.code === r.code)) return selected.filter((t) => t.code !== r.code);
  if (selected.length >= 2) return [selected[1], r];
  return [...selected, r];
}

// Show a short, stable entry list, without collapsing different server codes into
// a guessed cause. The full catalog (including new codes) remains available.
export function primaryFailureReasons(reasons: FailureTagOption[]): FailureTagOption[] {
  const groups = [
    ['TIME_SHORTAGE', 'CONFLICT', '일정 충돌'],
    ['FATIGUE', 'LOW_ENERGY', '피곤함'],
    ['AMBIGUITY', 'HARD_TO_START', '막막함'],
    ['PLAN_TOO_BIG', '과대 과제'],
  ];
  return groups.flatMap((codes) => {
    const found = codes.map((code) => reasons.find((r) => r.code === code)).find(Boolean);
    return found ? [found] : [];
  });
}

export function canContinueInterruption(selected: FailureTagOption[], memo: string): boolean {
  // The API rejects a memo without a tag. Never invent a tag or discard a draft.
  return selected.length > 0 || !memo.trim();
}

export function FailureTagPicker({
  reasons,
  selected,
  onChange,
  memo,
  onMemoChange,
  memoPlaceholder = '예: 하고 싶었는데 너무 졸려서 멈췄어요',
  aversiveness,
  onAversivenessChange,
}: FailureTagPickerProps) {
  const memoId = useId();
  const asksAversion = hasAvoidanceReason(selected.map((reason) => reason.code));
  const primary = primaryFailureReasons(reasons);
  const extra = reasons.filter((r) => !primary.some((p) => p.code === r.code));
  useEffect(() => {
    if (!asksAversion && aversiveness != null) onAversivenessChange?.(null);
  }, [asksAversion, aversiveness, onAversivenessChange]);

  const buttons = (options: FailureTagOption[]) => options.map((r) => {
          const sel = selected.some((t) => t.code === r.code);
          return (
            <button
              type="button"
              key={r.code}
              className="interruption-option"
              aria-pressed={sel}
              onClick={() => onChange(toggle(selected, r))}
            >
              {r.labelKo}
            </button>
          );
        });

  return (
    <div className="interruption-input">
      <p className="interruption-hint">가까운 상황만 골라 주세요. 잘 모르겠으면 넘어가도 돼요.</p>
      <div className="interruption-options" role="group" aria-label="자주 쓰는 상황">{buttons(primary)}</div>
      {extra.length > 0 && <details className="interruption-more">
        <summary>다른 상황{selected.filter((s) => extra.some((r) => r.code === s.code)).length > 0 ? ' · 선택 있음' : ''}</summary>
        <div className="interruption-options" role="group" aria-label="다른 상황">{buttons(extra)}</div>
      </details>}
      <p className="interruption-hint">선택 사항 · 최대 2개{selected.length ? ` · ${selected.map((r) => r.labelKo).join(', ')}` : ''}</p>

      {asksAversion && onAversivenessChange && (
        <details className="interruption-more">
          <summary>피하고 싶었던 정도 남기기 (선택)</summary>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>이 일 자체를 얼마나 피하고 싶었나요? (선택)</div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 8px', lineHeight: 1.5 }}>피곤함이나 시간 부족과는 별개로, 이 일을 하고 싶지 않았던 정도예요.</p>
          <Segmented
            fluid
            ariaLabel="이 일을 피하고 싶었던 정도 1~5 (선택)"
            value={aversiveness ?? 0}
            onChange={(v) => onAversivenessChange(aversiveness === v ? null : v)}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)', margin: '4px 0 14px' }}>
            <span>전혀 아니었어요</span>
            <span>매우 피하고 싶었어요</span>
          </div>
        </details>
      )}

      {(selected.length > 0 || memo.length > 0) && <details className="interruption-more" open={memo.length > 0 || undefined}>
      <summary>내 말로 덧붙이기 (선택)</summary>
      <label className="interruption-hint" htmlFor={memoId}>선택한 상황으로 설명하기 어려운 점을 적어 주세요.</label>
      <textarea
        id={memoId}
        value={memo}
        onChange={(e) => onMemoChange(e.target.value)}
        placeholder={memoPlaceholder}
        rows={2}
        maxLength={300}
        style={{ width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid var(--sand-200)', background: 'var(--surface-ground)', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', color: 'var(--text-1)', outline: 'none', resize: 'none', marginBottom: 14 }}
      />
      {!canContinueInterruption(selected, memo) && <p role="alert" className="interruption-hint">메모를 저장하려면 상황을 하나 골라 주세요. 사유 없이 넘어가려면 메모를 지워 주세요.</p>}
      </details>}
    </div>
  );
}
