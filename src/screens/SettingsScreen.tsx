import { useEffect, useState } from 'react';
import { CaretLeft, Sparkle, BellRinging, BellSlash, Shield, Warning, Check, ArrowClockwise, UserFocus } from '@phosphor-icons/react';
import { ApiError, notificationsApi, privacyApi, settingsApi } from '../lib/api';
import { subscribePush, unsubscribePush, getPushPermission } from '../lib/push';
import { useNavigation } from '../contexts/NavigationContext';
import type { ConsentRecord, ConsentType, ProfileResponse, ToneMode, UserSettings } from '../types/api';

const TONE_OPTIONS: { mode: ToneMode; label: string; desc: string }[] = [
  { mode: 'gentle', label: '부드럽게', desc: '실패도 격려로. 압박 적은 톤.' },
  { mode: 'encouraging', label: '응원하기', desc: '작은 성과도 크게. 동기 부여.' },
  { mode: 'strict', label: '단단하게', desc: '명확한 피드백. 약속 강조.' },
];

// /settings/profile 의 enum → 한국어 라벨. 지속형 프로필 메모리(인터뷰가 채움)의 읽기 표시용.
const ENERGY_LABELS: Record<string, string> = { morning: '아침형', afternoon: '오후형', evening: '저녁형', night: '밤형', varies: '그때그때' };
const RECOVERY_TONE_LABELS: Record<string, string> = { gentle: '부드러운 회복', normal: '보통 회복', encouraging: '응원 회복' };
const SUGGESTION_LABELS: Record<string, string> = { soft: '권유형 제안', neutral: '중립 제안', firm: '단호한 제안' };
const EXPLANATION_LABELS: Record<string, string> = { brief: '간결한 설명', normal: '보통 설명', detailed: '자세한 설명' };
const REMINDER_LABELS: Record<string, string> = { minimal: '알림 최소', standard: '알림 표준', active: '알림 적극' };

// ProfileResponse → 표시용 칩 문구 배열. 인터뷰가 안 채운 항목은 건너뛴다.
function profileChips(p: ProfileResponse): string[] {
  const chips: string[] = [];
  const b = p.behavioral;
  if (b) {
    if (ENERGY_LABELS[b.energyCycle]) chips.push(ENERGY_LABELS[b.energyCycle]);
    if (b.attentionSpan) chips.push(`집중 ${b.attentionSpan}분`);
    if (b.timeChunkPreference) chips.push(`${b.timeChunkPreference}분 단위`);
    if (b.preferredStartTime && b.preferredEndTime) chips.push(`${b.preferredStartTime}–${b.preferredEndTime}`);
  }
  const i = p.interaction;
  if (i) {
    if (RECOVERY_TONE_LABELS[i.recoveryTone]) chips.push(RECOVERY_TONE_LABELS[i.recoveryTone]);
    if (SUGGESTION_LABELS[i.suggestionStyle]) chips.push(SUGGESTION_LABELS[i.suggestionStyle]);
    if (EXPLANATION_LABELS[i.explanationDepth]) chips.push(EXPLANATION_LABELS[i.explanationDepth]);
    if (REMINDER_LABELS[i.reminderFrequency]) chips.push(REMINDER_LABELS[i.reminderFrequency]);
  }
  return chips;
}

const CONSENT_TYPES: { type: ConsentType; label: string; desc: string }[] = [
  { type: 'marketing', label: '마케팅 수신', desc: '새 기능·이벤트 소식' },
  { type: 'research', label: '연구 활용', desc: '익명 통계 (논문/리포트)' },
  { type: 'analytics', label: '사용 분석', desc: '오류·성능 개선용' },
];

export function SettingsScreen() {
  const { user, setScreen } = useNavigation();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  // /settings/profile — 백엔드 구현됨. 조회 성공 시에만 로드(실패/미구현이면 섹션 숨김).
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
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
    // mock-and-replace: 프로필 메모리는 실데이터가 올 때만 섹션을 띄운다. 실패하면 숨김(데모 안 깨짐).
    settingsApi.getProfile().then(
      (p) => { if (!cancelled) { setProfile(p); setProfileLoaded(true); } },
      () => { /* 미구현/에러 — 섹션 숨김 */ },
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

        {/* Profile memory (S23) — /settings/profile 실연동. 조회 성공 시에만 렌더. */}
        {profileLoaded && (() => {
          const chips = profile ? profileChips(profile) : [];
          return (
            <section>
              <SectionLabel icon={<UserFocus size={11} weight="fill" />}>내 코칭 프로필</SectionLabel>
              <div style={{ background: 'var(--surface-raised)', border: '1px solid var(--sand-200)', borderRadius: 14, padding: 14 }}>
                {chips.length > 0 ? (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10, lineHeight: 1.5 }}>
                      인터뷰로 파악한 리듬·선호예요. 계획과 회복 제안이 이 프로필을 따라요.
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {chips.map((c) => (
                        <span key={c} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', background: 'var(--sand-100)', border: '1px solid var(--sand-200)', borderRadius: 9999, padding: '5px 11px' }}>{c}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>
                    아직 프로필이 비어 있어요. 인터뷰를 마치면 리듬·선호가 여기에 표시돼요.
                  </div>
                )}
              </div>
            </section>
          );
        })()}

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

function Toggle({ on }: { on: boolean }) {
  return (
    <div style={{ width: 36, height: 20, borderRadius: 9999, background: on ? 'var(--brand)' : 'var(--sand-300)', position: 'relative', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: 9999, background: '#fff', transition: 'left 160ms' }} />
    </div>
  );
}
