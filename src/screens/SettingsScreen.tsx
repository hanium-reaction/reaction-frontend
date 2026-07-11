import { useEffect, useState } from 'react';
import { CaretLeft, Sparkle, BellRinging, BellSlash, Shield, Warning, Check, ArrowClockwise, Waveform } from '@phosphor-icons/react';
import { ApiError, notificationsApi, privacyApi, settingsApi } from '../lib/api';
import { subscribePush, unsubscribePush, getPushPermission } from '../lib/push';
import { useNavigation } from '../contexts/NavigationContext';
import type {
  ConsentRecord,
  ConsentType,
  EnergyCycle,
  ProfileSettings,
  ProfileUpdate,
  RecoveryTone,
  ReminderFrequency,
  ToneMode,
  UserSettings,
} from '../types/api';

const ENERGY_OPTIONS: { v: EnergyCycle; label: string }[] = [
  { v: 'morning', label: '오전' },
  { v: 'afternoon', label: '오후' },
  { v: 'evening', label: '저녁' },
  { v: 'night', label: '심야' },
  { v: 'varies', label: '변동' },
];
const RECOVERY_OPTIONS: { v: RecoveryTone; label: string }[] = [
  { v: 'gentle', label: '부드럽게' },
  { v: 'normal', label: '보통' },
  { v: 'encouraging', label: '응원' },
];
const REMINDER_OPTIONS: { v: ReminderFrequency; label: string }[] = [
  { v: 'minimal', label: '최소' },
  { v: 'standard', label: '보통' },
  { v: 'active', label: '적극' },
];

const TONE_OPTIONS: { mode: ToneMode; label: string; desc: string }[] = [
  { mode: 'gentle', label: '부드럽게', desc: '실패도 격려로. 압박 적은 톤.' },
  { mode: 'encouraging', label: '응원하기', desc: '작은 성과도 크게. 동기 부여.' },
  { mode: 'strict', label: '단단하게', desc: '명확한 피드백. 약속 강조.' },
];

const CONSENT_TYPES: { type: ConsentType; label: string; desc: string }[] = [
  { type: 'marketing', label: '마케팅 수신', desc: '새 기능·이벤트 소식' },
  { type: 'research', label: '연구 활용', desc: '익명 통계 (논문/리포트)' },
  { type: 'analytics', label: '사용 분석', desc: '오류·성능 개선용' },
];

export function SettingsScreen() {
  const { user, setScreen } = useNavigation();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [confirmAnonymize, setConfirmAnonymize] = useState(false);
  const [confirmRestartInterview, setConfirmRestartInterview] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    settingsApi.get().then(
      (s) => { if (!cancelled) setSettings(s); },
      () => {
        // 백엔드 501 — auth.me 의 toneMode 만이라도 활용
        if (!cancelled && user) {
          setSettings({ toneMode: user.toneMode, language: 'ko', timezone: user.timezone });
        }
      },
    );
    settingsApi.getProfile().then(
      (p) => { if (!cancelled) setProfile(p); },
      () => { /* 미구현/네트워크 — 프로필 섹션 숨김 */ },
    );
    privacyApi.consents().then(
      (c) => { if (!cancelled) setConsents(c); },
      () => { /* 501 — 빈 list */ },
    );
    getPushPermission().then((granted) => {
      if (!cancelled) setPushEnabled(granted);
    });
    return () => { cancelled = true; };
  }, [user]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  const setTone = async (mode: ToneMode) => {
    if (!settings) return;
    setSettings({ ...settings, toneMode: mode });
    try {
      await settingsApi.updateToneMode({ toneMode: mode });
      showToast('톤이 바뀌었어요');
    } catch (err) {
      if (err instanceof ApiError) showToast('서버 미동작 — 로컬에만 적용');
    }
  };

  const patchProfile = async (patch: ProfileUpdate) => {
    try {
      const updated = await settingsApi.updateProfile(patch);
      setProfile(updated); // 서버가 병합된 전체 프로필을 돌려줌 (진실 소스)
      showToast('저장했어요');
    } catch (err) {
      if (err instanceof ApiError) showToast('저장에 실패했어요');
    }
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (!pushEnabled) {
        const sub = await subscribePush();
        if (sub) {
          await notificationsApi.subscribe(sub).catch(() => {});
          setPushEnabled(true);
          showToast('푸시 알림 켜졌어요');
        } else {
          showToast('브라우저가 허용을 거부했어요');
        }
      } else {
        await unsubscribePush();
        await notificationsApi.unsubscribe().catch(() => {});
        setPushEnabled(false);
        showToast('푸시 알림 꺼졌어요');
      }
    } catch (err) {
      showToast('알림 설정에 실패했어요');
    } finally {
      setPushBusy(false);
    }
  };

  const setConsentValue = async (type: ConsentType, granted: boolean) => {
    setConsents((cs) => {
      const found = cs.find((c) => c.type === type);
      if (found) return cs.map((c) => (c.type === type ? { ...c, granted } : c));
      return [...cs, { type, granted, grantedAt: granted ? new Date().toISOString() : null }];
    });
    try {
      await privacyApi.updateConsent({ type, granted });
    } catch { /* 501 — 로컬만 */ }
  };

  const anonymize = async () => {
    try {
      await settingsApi.anonymize({ confirmationToken: 'demo-confirm' });
      showToast('익명화 요청 접수됨');
    } catch (err) {
      showToast('서버 미동작 — 데모 모드');
    } finally {
      setConfirmAnonymize(false);
    }
  };

  const consentGranted = (type: ConsentType) =>
    consents.find((c) => c.type === type)?.granted ?? false;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface-ground)', position: 'relative' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setScreen('today')}
            style={{ width: 36, height: 36, borderRadius: 9999, border: 'none', background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
            aria-label="뒤로"
          >
            <CaretLeft size={16} />
          </button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, letterSpacing: '-0.02em', margin: 0 }}>설정</h1>
        </div>

        {user && (
          <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--sand-200)', borderRadius: 14, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 9999, background: 'var(--brand-soft)', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>
              {user.name.slice(0, 1)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{user.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
        )}

        {/* Tone mode */}
        <section>
          <SectionLabel icon={<Sparkle size={11} weight="fill" />}>코칭 톤</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {TONE_OPTIONS.map((o) => {
              const active = settings?.toneMode === o.mode;
              return (
                <button
                  key={o.mode}
                  onClick={() => setTone(o.mode)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textAlign: 'left', background: active ? 'var(--brand-soft)' : 'var(--surface-raised)', border: `1.5px solid ${active ? 'var(--brand)' : 'var(--sand-200)'}`, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{o.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{o.desc}</div>
                  </div>
                  {active && <Check size={16} weight="bold" color="var(--brand)" />}
                </button>
              );
            })}
          </div>
        </section>

        {/* 프로필 메모리 (리듬/선호) — 인터뷰가 채운 값을 재인터뷰 없이 편집 (#A-2) */}
        {profile && (
          <section>
            <SectionLabel icon={<Waveform size={11} weight="fill" />}>나의 리듬 (프로필)</SectionLabel>
            <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--sand-200)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <ChoiceGroup
                label="주로 집중되는 시간대"
                options={ENERGY_OPTIONS}
                value={profile.behavioral?.energyCycle}
                onPick={(v) => patchProfile({ energyCycle: v })}
              />
              <MinuteField
                label="한 번에 집중하는 길이"
                value={profile.behavioral?.attentionSpan}
                onSave={(n) => patchProfile({ attentionSpan: n })}
              />
              <ChoiceGroup
                label="회복 대화 톤"
                options={RECOVERY_OPTIONS}
                value={profile.interaction?.recoveryTone}
                onPick={(v) => patchProfile({ recoveryTone: v })}
              />
              <ChoiceGroup
                label="알림 빈도"
                options={REMINDER_OPTIONS}
                value={profile.interaction?.reminderFrequency}
                onPick={(v) => patchProfile({ reminderFrequency: v })}
              />
              <MinuteField
                label="회복 시 최소 단위 (막혔을 때 이만큼만 해보기)"
                value={profile.downscopeUnitMin ?? undefined}
                onSave={(n) => patchProfile({ downscopeUnitMin: n })}
              />
              <ToggleRow
                label="지칠 땐 휴식 제안 받기"
                on={profile.restOk ?? false}
                onToggle={() => patchProfile({ restOk: !(profile.restOk ?? false) })}
              />
              <div style={{ fontSize: 10, color: 'var(--text-3)', lineHeight: 1.5 }}>
                온보딩 인터뷰에서 파악한 값이에요. 여기서 바꾸면 인터뷰를 다시 하지 않아도 반영돼요.
              </div>
            </div>
          </section>
        )}

        {/* Push */}
        <section>
          <SectionLabel icon={<BellRinging size={11} weight="fill" />}>알림</SectionLabel>
          <button
            onClick={togglePush}
            disabled={pushBusy}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 14px', textAlign: 'left', background: 'var(--surface-raised)', border: `1.5px solid ${pushEnabled ? 'var(--brand)' : 'var(--sand-200)'}`, borderRadius: 12, cursor: pushBusy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: pushBusy ? 0.6 : 1 }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 10, background: pushEnabled ? 'var(--brand)' : 'var(--sand-100)', color: pushEnabled ? '#FFFCF6' : 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {pushEnabled ? <BellRinging size={18} weight="fill" /> : <BellSlash size={18} />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>웹 푸시 알림</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{pushEnabled ? '모닝 브리프·저녁 회고 알림이 켜져 있어요' : '브라우저 알림을 받으려면 켜주세요'}</div>
            </div>
            <Toggle on={pushEnabled} />
          </button>
        </section>

        {/* Consent */}
        <section>
          <SectionLabel icon={<Shield size={11} weight="fill" />}>동의 관리</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {CONSENT_TYPES.map((c) => {
              const granted = consentGranted(c.type);
              return (
                <button
                  key={c.type}
                  onClick={() => setConsentValue(c.type, !granted)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'var(--surface-raised)', border: '1px solid var(--sand-200)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{c.desc}</div>
                  </div>
                  <Toggle on={granted} />
                </button>
              );
            })}
          </div>
        </section>

        {/* Onboarding */}
        <section>
          <SectionLabel icon={<ArrowClockwise size={11} weight="fill" />}>온보딩</SectionLabel>
          <button
            onClick={() => setConfirmRestartInterview(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', width: '100%', background: 'var(--surface-raised)', border: '1.5px solid var(--sand-200)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>인터뷰 다시하기</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>목표 파악 질문을 처음부터 다시 진행해요. 기존 목표는 그대로 남아요.</div>
            </div>
          </button>
          {confirmRestartInterview && (
            <div style={{ marginTop: 8, padding: 12, background: 'var(--brand-soft)', border: '1px solid var(--coral-200)', borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--coral-700)', marginBottom: 6 }}>지금 인터뷰를 다시 시작할까요?</div>
              <div style={{ fontSize: 11, color: 'var(--coral-700)', marginBottom: 10, lineHeight: 1.5 }}>목표 파악부터 다시 진행돼요. 기존 목표는 삭제되지 않고 그대로 남아있어요 — 새 인터뷰로 목표를 더 추가하게 돼요.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmRestartInterview(false)} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid var(--sand-200)', background: 'var(--surface-raised)', color: 'var(--text-2)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                <button onClick={() => setScreen('goal-intake')} style={{ flex: 1, height: 36, borderRadius: 10, border: 'none', background: 'var(--brand)', color: '#FFFCF6', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>다시 시작</button>
              </div>
            </div>
          )}
        </section>

        {/* Danger zone */}
        <section>
          <SectionLabel icon={<Warning size={11} weight="fill" />} tone="danger">데이터 관리</SectionLabel>
          <button
            onClick={() => setConfirmAnonymize(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', width: '100%', background: 'transparent', border: '1.5px solid var(--coral-200)', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--danger)' }}>계정 익명화 요청</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>이름·이메일·메모가 익명화돼요. 통계는 유지.</div>
            </div>
          </button>
          {confirmAnonymize && (
            <div style={{ marginTop: 8, padding: 12, background: '#FAE2D8', border: '1px solid var(--coral-200)', borderRadius: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--danger)', marginBottom: 6 }}>정말 익명화할까요?</div>
              <div style={{ fontSize: 11, color: 'var(--coral-700)', marginBottom: 10, lineHeight: 1.5 }}>이 동작은 되돌릴 수 없어요. 한 번 더 확인 후 진행돼요.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmAnonymize(false)} style={{ flex: 1, height: 36, borderRadius: 10, border: '1px solid var(--sand-200)', background: 'var(--surface-raised)', color: 'var(--text-2)', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                <button onClick={anonymize} style={{ flex: 1, height: 36, borderRadius: 10, border: 'none', background: 'var(--danger)', color: '#FFFCF6', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>익명화</button>
              </div>
            </div>
          )}
        </section>
      </div>

      {toast && (
        <div style={{ position: 'absolute', bottom: 'max(16px, env(safe-area-inset-bottom, 16px))', left: 16, right: 16, padding: '10px 14px', background: 'var(--text-1)', color: '#FAF6EE', borderRadius: 10, fontSize: 12, textAlign: 'center', boxShadow: 'var(--shadow-md)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function SectionLabel({ icon, children, tone = 'default' }: { icon?: React.ReactNode; children: React.ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: tone === 'danger' ? 'var(--danger)' : 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
      {icon}
      {children}
    </div>
  );
}

// 사람마다 다른 '분' 값 — 고정 선택지 대신 자유 수정 입력(스텝 5분 · 5~240 범위).
function MinuteField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | undefined;
  onSave: (n: number) => void;
}) {
  const [text, setText] = useState(value != null ? String(value) : '');
  useEffect(() => {
    setText(value != null ? String(value) : '');
  }, [value]);

  const clamp = (n: number) => Math.min(240, Math.max(5, n));
  const commit = () => {
    const n = parseInt(text, 10);
    if (!Number.isNaN(n)) {
      const c = clamp(n);
      if (c !== value) onSave(c);
      else setText(String(c));
    } else {
      setText(value != null ? String(value) : ''); // 무효 입력 되돌림
    }
  };
  const bump = (delta: number) => onSave(clamp((value ?? 30) + delta));

  const stepBtn = (labelTxt: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{ width: 34, height: 'var(--ctrl-sm)', borderRadius: 9, border: '1.5px solid var(--sand-200)', background: 'var(--surface-raised)', color: 'var(--text-1)', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1 }}
    >
      {labelTxt}
    </button>
  );

  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {stepBtn('−', () => bump(-5))}
        <input
          type="number"
          inputMode="numeric"
          value={text}
          min={5}
          max={240}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          style={{ width: 64, height: 'var(--ctrl-sm)', textAlign: 'center', borderRadius: 9, border: '1.5px solid var(--sand-200)', background: 'var(--surface-raised)', color: 'var(--text-1)', fontSize: 14, fontWeight: 700, fontFamily: 'inherit', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>분</span>
        {stepBtn('+', () => bump(5))}
      </div>
    </div>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
    >
      <div style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{label}</div>
      <Toggle on={on} />
    </button>
  );
}

function ChoiceGroup<T extends string | number>({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: { v: T; label: string }[];
  value: T | undefined;
  onPick: (v: T) => void;
}) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={String(o.v)}
              onClick={() => onPick(o.v)}
              style={{
                height: 'var(--ctrl-sm)',
                padding: '0 13px',
                borderRadius: 9999,
                border: `1.5px solid ${active ? 'var(--brand)' : 'var(--sand-200)'}`,
                background: active ? 'var(--brand-soft)' : 'var(--surface-raised)',
                color: active ? 'var(--brand)' : 'var(--text-2)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div style={{ width: 36, height: 20, borderRadius: 9999, background: on ? 'var(--brand)' : 'var(--sand-300)', position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 9999, background: '#fff', transition: 'left 160ms' }} />
    </div>
  );
}
