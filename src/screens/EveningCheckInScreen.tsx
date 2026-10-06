import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react';
import { DemoNotice } from '../components/DemoNotice';
import {
  FailureTagPicker,
  useFailureTagCatalog,
  type FailureTagOption,
} from '../components/FailureTagPicker';
import { plansApi, reflectionApi } from '../lib/api';
import { localDateStr, weekStartStr } from '../lib/dates';
import '../styles/guided-redesign.css';
import '../styles/onboarding-redesign.css';
import type {
  CompletionStatus,
  ReflectionBatchItem,
  ReflectionPendingItem,
  WeeklyBlock,
} from '../types/api';

interface EveningCheckInScreenProps {
  onDone: () => void;
}

// 화면 단계. 'tags' 는 batch 응답의 needsFailureTags 가 비어 있지 않을 때만 거친다(#238).
type Step = 'checkin' | 'tags' | 'tomorrow' | 'done';

function EveningProgress({ step }: { step: Step }) {
  const current = step === 'checkin' ? 0 : step === 'tags' ? 1 : 2;
  return <header className="guided-evening-heading">
    <span className="guided-kicker">DAILY REFLECTION / 하루 마무리</span>
    <ol className="guided-intro-progress" aria-label="저녁 체크인 단계">
      {['실행 돌아보기', '사유 남기기 · 선택', '내일 확인'].map((label, index) =>
        <li key={label} aria-current={index === current ? 'step' : undefined}>{label}</li>)}
    </ol>
  </header>;
}

// 사유를 받아야 하는 실행 1건 — batch 를 보내고 나면 pending 목록에서 빠지기 때문에,
// 제목과 날짜를 미리 떠 두었다가 사유 단계에서 그대로 보여 준다.
interface TagTarget {
  executionId: string;
  title: string | null;
  scheduledDate: string | null;
  status: CompletionStatus | undefined;
}

// YYYY-MM-DD → 오늘/어제/그제 상대 라벨 (최근 3일 회고 대상이라 그 범위만 다룬다).
function relDayLabel(dateStr: string): string {
  const today = new Date();
  const d = new Date(`${dateStr}T00:00:00`);
  const diff = Math.round((today.setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0)) / 86400000);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff === 2) return '그제';
  return dateStr.slice(5);
}

const energyOptions = [
  { v: 1, label: '완전 방전', color: 'var(--danger)' },
  { v: 2, label: '좀 피곤해요', color: 'var(--warning)' },
  { v: 3, label: '보통이에요', color: 'var(--text-2)' },
  { v: 4, label: '꽤 좋아요', color: 'var(--success)' },
  { v: 5, label: '최상이에요', color: 'var(--brand-ink)' },
];

// Quick Check-in 4칩 (베이스라인 §1.4). 톤 잠금 "Be on your side, not on your case" —
// 라벨에 '실패'·'못했' 같은 심판 어휘를 쓰지 않는다.
// 용어는 오늘 화면(TodayScreen '일부만 함'/'잘 안됨')과 통일한다. 회복 코치(S19)도
// "'일부만' 또는 '잘 안됨' 으로 표시한 카드" 라고 안내하므로 같은 말을 써야 흐름이 이어진다.
const statusOptions: { v: CompletionStatus; label: string; color: string }[] = [
  { v: 'done', label: '했어요', color: 'var(--success)' },
  { v: 'partial_done', label: '일부만', color: 'var(--brand-ink)' },
  { v: 'failed', label: '잘 안됐어요', color: 'var(--text-3)' },
  { v: 'over_done', label: '더 했어요', color: 'var(--brand-ink)' },
];

// 같은 내용의 [모두 완료] 재전송은 같은 키 → 서버가 24h 안에 1회만 처리(중복 탭 방지).
// 매번 새 키(Date.now() 등)를 쓰면 멱등 보호가 통째로 무력해진다.
// 선택을 바꾸면 키도 바뀌어야 한다 — 같은 키에 다른 body 면 서버가 409 를 낸다.
// 해시 충돌 시엔 409 를 받을 뿐 데이터가 섞이지는 않는다(안전 실패).
function idempotencyKeyFor(items: ReflectionBatchItem[]): string {
  const canonical = items
    .map((i) => `${i.executionId}:${i.completionStatus}`)
    .sort()
    .join('|');
  let h = 0;
  for (let i = 0; i < canonical.length; i += 1) {
    h = (Math.imul(31, h) + canonical.charCodeAt(i)) | 0;
  }
  return `batch-${(h >>> 0).toString(36)}-${items.length}`;
}

export function EveningCheckInScreen({ onDone }: EveningCheckInScreenProps) {
  const [step, setStep] = useState<Step>('checkin');
  const [energy, setEnergy] = useState<number | null>(null);

  // GET /reflection/pending (#83) — 최근 3일 미체크(in_progress) 실행. 실패 시 더미로 가리지
  // 않고 빈 목록 + 안내로 정직하게(목업 제거 방침).
  const [pending, setPending] = useState<ReflectionPendingItem[]>([]);
  const [usingRealPending, setUsingRealPending] = useState(false);
  const [pendingLoading, setPendingLoading] = useState(true);

  // executionId → 사용자가 고른 4칩. 미선택 항목은 batch 에서 빠진다(강제하지 않는다).
  const [picked, setPicked] = useState<Record<string, CompletionStatus>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // 실패/부분완료인데 사유를 안 남긴 항목 — 서버가 needsFailureTags 로 알려준다(S18 유도 대상).
  // 예전에는 이 목록을 받아 두고도 입력 화면으로 이어주지 않아서, 완료 화면이 "오늘 화면에서
  // 카드를 열면 이어서 할 수 있어요" 라고 안내하지만 실제로는 도달할 수 없는 경로였다(#238).
  // 그 결과 태그가 0개인 채로 회복 룰 엔진이 돌아 카드가 늘 같은 조합으로만 뽑혔다.
  // 이제 batch 직후 'tags' 단계에서 한 건씩 사유를 받아 POST /reflection/failure-tags 로 보낸다.
  const [tagTargets, setTagTargets] = useState<TagTarget[]>([]);
  const [tagIndex, setTagIndex] = useState(0);
  const [tagSelected, setTagSelected] = useState<FailureTagOption[]>([]);
  const [tagMemo, setTagMemo] = useState('');
  const [tagAversiveness, setTagAversiveness] = useState<number | null>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  // 완료 화면 안내용 집계. tagTargets 는 batch 를 새로 보낼 때마다 갈리므로, 이번 체크인에서
  // 실제로 남긴 건수와 넘긴 건수는 따로 누적한다(뒤로 갔다가 다시 제출해도 숫자가 지워지지 않는다).
  const [taggedCount, setTaggedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const failReasons = useFailureTagCatalog();

  useEffect(() => {
    let cancelled = false;
    reflectionApi.pending().then(
      (items) => {
        if (cancelled) return;
        // fetch 성공 = 연동됨. 비어있어도 실데이터로 처리한다.
        setUsingRealPending(true);
        setPending(items);
      },
      () => { /* 네트워크/미동작 — 빈 목록 유지 + 아래 안내 배너 */ },
    ).finally(() => { if (!cancelled) setPendingLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const items = useMemo<ReflectionBatchItem[]>(
    () => pending
      .filter((p) => picked[p.executionId])
      .map((p) => ({ executionId: p.executionId, completionStatus: picked[p.executionId] })),
    [pending, picked],
  );

  // 창 밖(어제·그제) 건이 섞여 있으면 배너로 알린다 — "어제 회고 못한 것도 함께 정리해요".
  const carriedOver = pending.filter((p) => relDayLabel(p.scheduledDate) !== '오늘').length;

  const goNext = () => {
    setSubmitError(null);
    if (items.length === 0) { setStep('tomorrow'); return; }
    setSubmitting(true);
    reflectionApi.batch({ items }, idempotencyKeyFor(items)).then(
      (res) => {
        // pending 에서 빼기 전에 제목·날짜를 떠 둔다 — 사유 단계에서 어떤 실행인지 보여줘야 한다.
        // 서버가 목록에 없는 executionId 를 돌려주더라도 건너뛰지 않고 제목만 비운 채 받는다.
        const byId = new Map(pending.map((p) => [p.executionId, p]));
        setTagTargets(res.needsFailureTags.map((id) => {
          const p = byId.get(id);
          return {
            executionId: id,
            title: p?.title ?? null,
            scheduledDate: p?.scheduledDate ?? null,
            status: picked[id],
          };
        }));
        setTagIndex(0);
        setTagSelected([]);
        setTagMemo('');
        setTagAversiveness(null);
        setTagError(null);
        // 종결된 실행은 더 이상 미체크가 아니다 — 목록에서 뺀다.
        const done = new Set(items.map((i) => i.executionId));
        setPending((ps) => ps.filter((p) => !done.has(p.executionId)));
        setStep(res.needsFailureTags.length > 0 ? 'tags' : 'tomorrow');
      },
      () => {
        // 저장 실패를 삼키지 않는다 — 삼키면 사용자는 기록된 줄 알고 넘어간다.
        setSubmitError('기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      },
    ).finally(() => setSubmitting(false));
  };

  // 사유 단계에서 한 건을 끝냈을 때 — 다음 건으로 넘기거나, 마지막이면 내일 미리보기로.
  const advanceTagStep = () => {
    setTagSelected([]);
    setTagMemo('');
    setTagAversiveness(null);
    setTagError(null);
    const next = tagIndex + 1;
    if (next >= tagTargets.length) setStep('tomorrow');
    else setTagIndex(next);
  };

  // 이 건은 사유를 남기지 않고 넘긴다. 태그 입력은 끝까지 선택 사항이다 — 필수로 만들면
  // 저녁 체크인 자체를 회피하게 되고, 그러면 실행 데이터마저 못 받는다.
  const skipTag = () => {
    setSkippedCount((c) => c + 1);
    advanceTagStep();
  };

  // 남은 건을 통째로 넘긴다.
  const skipRemainingTags = () => {
    setSkippedCount((c) => c + (tagTargets.length - tagIndex));
    setStep('tomorrow');
  };

  // 0개 태그로는 저장하지 않는다 — 빈 요청은 회복 룰 엔진에 아무 정보도 주지 못한다.
  // 남기고 싶지 않으면 [건너뛰기] 로 넘어가면 된다.
  const submitTag = () => {
    const target = tagTargets[tagIndex];
    if (!target || tagSelected.length === 0) return;
    setTagSaving(true);
    setTagError(null);
    reflectionApi.tagExecution(target.executionId, {
      tagCodes: tagSelected.map((t) => t.code),
      memo: tagMemo.trim() || null,
      taskAversiveness: tagAversiveness,
    }).then(
      () => {
        setTaggedCount((c) => c + 1);
        advanceTagStep();
      },
      () => {
        setTagError('사유를 저장하지 못했어요. 다시 시도하거나 건너뛸 수 있어요.');
      },
    ).finally(() => setTagSaving(false));
  };

  if (step === 'done') {
    const selectedEnergy = energyOptions.find((e) => e.v === energy);
    return (
      <div className="guided-surface guided-evening guided-evening-done">
        <EveningProgress step="done" />
        <div style={{ width: 64, height: 64, borderRadius: 9999, background: '#E5EFE3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={32} weight="fill" color="var(--success-ink)" />
        </div>
        <h1>오늘을 돌아봤어요.</h1>
        <p>선택한 실행 기록과 내일 계획을 확인했어요. 오늘의 속도로 하루를 마무리하세요.</p>
        {selectedEnergy && (
          <div style={{ padding: '10px 14px', background: 'var(--brand-soft)', borderRadius: 12, border: '1px solid var(--coral-200)', fontSize: 12, color: 'var(--coral-700)', textAlign: 'left', width: '100%' }}>
            <b>이번 체크인에서 고른 에너지:</b><br />{selectedEnergy.label} · 아직 서버에 저장하거나 내일 계획에 자동 반영하지 않아요.
          </div>
        )}
        {/* 사유를 실제로 남겼는지 그대로 알려 준다. 예전에는 "오늘 화면에서 이어서 할 수
            있어요" 라고 안내했지만, 그 executionId 들은 대개 어제·그제 건이라 오늘 화면의
            날짜 스코프에 뜨지 않았고 'failed' 를 다시 여는 경로 자체도 없었다(#238). */}
        {taggedCount > 0 && (
          <div style={{ padding: '10px 14px', background: 'var(--brand-soft)', borderRadius: 12, border: '1px solid var(--coral-200)', fontSize: 12, color: 'var(--coral-700)', textAlign: 'left', width: '100%', lineHeight: 1.55 }}>
            <b>회복 제안에 반영:</b><br />{taggedCount}건의 사유를 남겼어요. 다음 회복안이 그 상황에 맞춰 달라져요.
          </div>
        )}
        {skippedCount > 0 && (
          <div style={{ padding: '10px 14px', background: 'var(--surface-raised)', borderRadius: 12, border: '1px solid var(--sand-200)', fontSize: 12, color: 'var(--text-2)', textAlign: 'left', width: '100%', lineHeight: 1.55 }}>
            {skippedCount}건은 사유를 남기지 않았어요. 사유가 없으면 회복안이 늘 비슷하게 나오니, 다음 저녁 체크인에서 남겨 주세요.
          </div>
        )}
        <div style={{ width: '100%' }}>
          <DemoNotice storageKey="evening-energy">
            에너지 기록은 아직 임시 저장돼요(저장 계약 준비 중). 실행별 회고는 실제로 저장됩니다.
          </DemoNotice>
        </div>
        <button onClick={onDone} className="guided-evening-cta">주간 계획 보기 →</button>
      </div>
    );
  }

  if (step === 'tomorrow') {
    return <TomorrowPreview onBack={() => setStep('checkin')} onConfirm={() => setStep('done')} />;
  }

  // 실패 사유 입력 단계(#238) — needsFailureTags 를 한 건씩 훑는다. 여러 건을 한 화면에
  // 늘어놓으면 태그 13종 + 메모가 겹쳐 길어지므로, 한 번에 한 건만 묻는다.
  if (step === 'tags') {
    const target = tagTargets[tagIndex];
    // 방어적 처리 — 대상이 비면 흐름을 막지 않고 다음 단계로 흘려보낸다.
    if (!target) {
      return <TomorrowPreview onBack={() => setStep('checkin')} onConfirm={() => setStep('done')} />;
    }
    const isLast = tagIndex === tagTargets.length - 1;
    const statusLabel = statusOptions.find((s) => s.v === target.status)?.label;
    return (
      <div className="guided-surface guided-evening guided-evening-tags">
        <EveningProgress step="tags" />
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-3)' }}>저녁 체크인 · 사유 남기기</div>
          <span className="tnum" style={{ fontSize: 11, color: 'var(--text-3)' }}>{tagIndex + 1} / {tagTargets.length}</span>
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>어떤 상황이었나요?</h2>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
          기억나는 상황을 남기거나, 건너뛰고 체크인을 마쳐도 돼요.
        </p>

        <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--sand-200)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {target.scheduledDate && (
              <span style={{ height: 'var(--ctrl-xs)', minWidth: 34, padding: '0 7px', background: 'var(--sand-100)', border: '1px solid var(--sand-200)', borderRadius: 9999, fontSize: 10, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{relDayLabel(target.scheduledDate)}</span>
            )}
            <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target.title ?? '체크인한 실행'}</div>
            {statusLabel && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{statusLabel}</span>
            )}
          </div>
          <FailureTagPicker
            reasons={failReasons}
            selected={tagSelected}
            onChange={setTagSelected}
            memo={tagMemo}
            onMemoChange={setTagMemo}
            aversiveness={tagAversiveness}
            onAversivenessChange={setTagAversiveness}
          />
        </div>

        {tagError && (
          <div role="alert" style={{ padding: '10px 12px', background: '#FBE9E7', border: '1px solid var(--danger)', borderRadius: 10, fontSize: 12, color: 'var(--danger-ink)', lineHeight: 1.5 }}>
            {tagError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={skipTag}
            disabled={tagSaving}
            style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--sand-200)', background: 'transparent', color: 'var(--text-2)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: tagSaving ? 'default' : 'pointer' }}
          >
            건너뛰기
          </button>
          <button
            onClick={submitTag}
            disabled={tagSelected.length === 0 || tagSaving}
            className="guided-evening-cta" style={{ flex: 2 }}
          >
            {tagSaving ? '저장하는 중…' : isLast ? '저장하고 완료 →' : '저장하고 다음 →'}
          </button>
        </div>
        <button
          onClick={skipRemainingTags}
          disabled={tagSaving}
          style={{ alignSelf: 'center', background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 12, fontFamily: 'inherit', textDecoration: 'underline', cursor: tagSaving ? 'default' : 'pointer', padding: 4 }}
        >
          나중에 할게요
        </button>
      </div>
    );
  }

  return (
    <div className="guided-surface guided-evening guided-evening-checkin">
      <EveningProgress step="checkin" />
      <header className="guided-evening-intro"><h1>오늘 하루 어땠나요?</h1>
      <p>한 일과 멈춘 지점을 돌아봐요. 남기고 싶은 실행만 선택해도 괜찮아요.</p></header>
      <div className="guided-evening-columns">
      <section className="guided-evening-panel" aria-label="실행 돌아보기">
      <h2 className="guided-section-title">01 · 실행 돌아보기</h2>

      {/* 최근 3일 미체크(in_progress) 실행 — GET /reflection/pending 실연동 (#83).
          카드별 4칩을 고르면 [다음]에서 POST /reflection/batch 로 한 번에 종결한다. */}
      {(pendingLoading || pending.length > 0) && (
        <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--sand-200)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>아직 체크인하지 않은 실행</div>
            {!pendingLoading && (
              <span className="tnum" style={{ fontSize: 11, color: 'var(--text-3)' }}>{pending.length}건</span>
            )}
          </div>
          {!pendingLoading && carriedOver > 0 && (
            <div style={{ padding: '8px 10px', background: 'var(--brand-soft)', border: '1px solid var(--coral-200)', borderRadius: 10, fontSize: 12, color: 'var(--coral-700)', lineHeight: 1.5 }}>
              어제·그제 정리 못한 {carriedOver}건도 함께 정리해요.
            </div>
          )}
          {pendingLoading ? (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>불러오는 중…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pending.map((p) => (
                <div key={p.executionId} style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ height: 'var(--ctrl-xs)', minWidth: 34, padding: '0 7px', background: 'var(--sand-100)', border: '1px solid var(--sand-200)', borderRadius: 9999, fontSize: 10, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{relDayLabel(p.scheduledDate)}</span>
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                    {p.scheduledTime && (
                      <div className="tnum" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>{p.scheduledTime.slice(0, 5)}</div>
                    )}
                  </div>
                  <div className="guided-evening-status-options">
                    {statusOptions.map((s) => {
                      const sel = picked[p.executionId] === s.v;
                      return (
                        <button
                          key={s.v}
                          aria-pressed={sel}
                          onClick={() => setPicked((m) => {
                            // 같은 칩을 다시 누르면 선택 해제 — 잘못 누른 걸 되돌릴 수 있어야 한다.
                            if (m[p.executionId] === s.v) {
                              const { [p.executionId]: _drop, ...rest } = m;
                              return rest;
                            }
                            return { ...m, [p.executionId]: s.v };
                          })}
                          className="guided-evening-status-option"
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {!pendingLoading && !usingRealPending && (
        <DemoNotice storageKey="evening-pending">
          미체크 실행 목록을 불러오지 못했어요.
        </DemoNotice>
      )}
      {!pendingLoading && usingRealPending && pending.length === 0 && <p>아직 체크인하지 않은 실행이 없어요.</p>}
      </section>

      <section className="guided-evening-panel" aria-label="현재 에너지">
      <h2 className="guided-section-title">02 · 지금의 에너지</h2>
      <p>현재 화면에서만 선택해요. 서버 저장과 내일 계획 자동 반영은 아직 지원하지 않아요.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {energyOptions.map((e) => (
          <button key={e.v} aria-pressed={energy === e.v} onClick={() => setEnergy(e.v)} style={{ padding: '14px 16px', borderRadius: 12, textAlign: 'left', background: energy === e.v ? 'var(--text-1)' : 'var(--surface-raised)', color: energy === e.v ? '#FAF6EE' : 'var(--text-1)', border: `1px solid ${energy === e.v ? 'var(--text-1)' : 'var(--sand-200)'}`, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 160ms', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: 9999, background: energy === e.v ? '#FFFCF6' : e.color, flexShrink: 0 }} />
            {e.label}
          </button>
        ))}
      </div>
      </section>
      </div>
      {submitError && (
        <div role="alert" style={{ padding: '10px 12px', background: '#FBE9E7', border: '1px solid var(--danger)', borderRadius: 10, fontSize: 12, color: 'var(--danger-ink)', lineHeight: 1.5 }}>
          {submitError}
        </div>
      )}
      <button
        onClick={goNext}
        disabled={!energy || submitting}
        className="guided-evening-cta"
      >
        {submitting ? '기록하는 중…' : items.length > 0 ? `${items.length}건 기록하고 다음 →` : '다음 →'}
      </button>
    </div>
  );
}

// 내일 예정 블록 — GET /plans/weekly 실데이터. (예전엔 요일·제목이 통째로 하드코딩돼 있어
// 금요일에도 "내일 목요일"이 뜨고 21:00/21:30 이 서로 모순됐다.)
function TomorrowPreview({ onBack, onConfirm }: { onBack: () => void; onConfirm: () => void }) {
  const [blocks, setBlocks] = useState<WeeklyBlock[] | null>(null);
  const [failed, setFailed] = useState(false);

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }, []);
  const tomorrowStr = localDateStr(tomorrow);
  const weekdayLabel = ['일', '월', '화', '수', '목', '금', '토'][tomorrow.getDay()];

  useEffect(() => {
    let cancelled = false;
    // 내일이 다음 주면(일요일의 내일) 그 주의 월요일로 조회해야 한다.
    plansApi.weekly(weekStartStr(tomorrow)).then(
      (plan) => {
        if (cancelled) return;
        const day = plan.days.find((d) => d.date === tomorrowStr);
        setBlocks(day?.blocks ?? []);
      },
      () => { if (!cancelled) setFailed(true); },
    );
    return () => { cancelled = true; };
  }, [tomorrowStr, tomorrow]);

  return (
    <div className="guided-surface guided-evening guided-evening-tomorrow">
      <EveningProgress step="tomorrow" />
      <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 6px' }}>내일 계획 미리보기</h2>
      <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--sand-200)', borderRadius: 14, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 10 }}>{weekdayLabel}요일 예정 블록 · {tomorrowStr.slice(5)}</div>
        {blocks === null && !failed && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>불러오는 중…</div>}
        {failed && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>내일 계획을 불러오지 못했어요.</div>}
        {blocks !== null && blocks.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>아직 잡힌 블록이 없어요. 주간 계획에서 추가할 수 있어요.</div>
        )}
        {blocks !== null && blocks.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {blocks.map((b) => {
              const start = new Date(b.startAt);
              const end = new Date(b.endAt);
              const mins = Math.max(Math.round((end.getTime() - start.getTime()) / 60000), 0);
              const hhmm = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
              return (
                <div key={b.blockId} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div className="tnum" style={{ width: 38, fontSize: 12, fontWeight: 700, color: 'var(--text-3)', flexShrink: 0 }}>{hhmm}</div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  <span style={{ height: 'var(--ctrl-xs)', padding: '0 7px', background: 'var(--sand-100)', border: '1px solid var(--sand-200)', borderRadius: 9999, fontSize: 10, color: 'var(--text-2)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>{mins}분</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onBack} style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--sand-200)', background: 'transparent', color: 'var(--text-1)', fontWeight: 600, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer' }}>이전</button>
        <button onClick={onConfirm} className="guided-evening-cta" style={{ flex: 2 }}>확인 →</button>
      </div>
    </div>
  );
}
