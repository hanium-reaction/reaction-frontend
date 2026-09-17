import { useEffect, useState } from 'react';
import { Calendar, CheckCircle } from '@phosphor-icons/react';
import { ApiError, calendarApi, friendlyError } from '../lib/api';
import {
  CalendarConsentCancelled,
  calendarConsentReady,
  GOOGLE_CLIENT_ID,
  requestCalendarCode,
} from '../lib/googleIdentity';
import { isNativeApp } from '../lib/platform';
import { useToast } from '../contexts/ToastContext';

// Google 캘린더 연결 — 온보딩(SetupScreen)과 설정(SettingsScreen)이 같이 쓴다.
//
// 흐름: GIS popup 동의 → authorization code → POST /calendar/connect. 읽기 전용
// freebusy 라 일정의 제목·장소는 읽지 않고, 연결되면 계획 생성이 그 시간을 피한다.
//
// 상태는 서버가 정한다(GET /calendar/connect). 501 이면 서버 설정이 아직이라는 뜻이라
// '준비 중' 을 그린다 — 예전처럼 가짜 코드로 연결된 척하지 않는다.

type Status = 'loading' | 'unavailable' | 'disconnected' | 'connected' | 'error';

interface CalendarConnectCardProps {
  /** 온보딩의 촘촘한 목록에 맞춘 작은 글씨. */
  compact?: boolean;
  onChange?: (connected: boolean) => void;
}

export function CalendarConnectCard({ compact = false, onChange }: CalendarConnectCardProps) {
  const toast = useToast();
  // 네이티브 셸(WebView)에서는 Google 이 OAuth 팝업을 막는다(disallowed_useragent).
  // 연결은 계정 단위라 웹에서 한 번 연결하면 앱에도 반영된다.
  const native = isNativeApp();
  const [status, setStatus] = useState<Status>(native || !GOOGLE_CLIENT_ID ? 'unavailable' : 'loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (native || !GOOGLE_CLIENT_ID) return;
    let cancelled = false;
    calendarApi.status().then(
      (c) => { if (!cancelled) setStatus(c.connected ? 'connected' : 'disconnected'); },
      (err: unknown) => {
        if (cancelled) return;
        setStatus(err instanceof ApiError && err.status === 501 ? 'unavailable' : 'error');
      },
    );
    return () => { cancelled = true; };
  }, [native]);

  const setConnected = (connected: boolean) => {
    setStatus(connected ? 'connected' : 'disconnected');
    onChange?.(connected);
  };

  const connect = () => {
    if (busy) return;
    if (!calendarConsentReady()) {
      toast.info('Google 연결을 준비하고 있어요. 잠시 후 다시 눌러 주세요.');
      return;
    }
    setBusy(true);
    // requestCalendarCode 는 await 전에 동기로 팝업을 연다 — 순서를 바꾸면 팝업이 막힌다.
    requestCalendarCode()
      .then((code) => calendarApi.connect(code))
      .then(() => {
        setConnected(true);
        toast.success('캘린더를 연결했어요. 계획을 세울 때 겹치는 일정을 피할게요.');
      })
      .catch((err: unknown) => {
        if (err instanceof CalendarConsentCancelled) return;
        // 422 는 서버가 사용자에게 할 말을 담아 보낸다(체크 해제·만료된 코드·재시도 안내).
        if (err instanceof ApiError && err.status === 422) toast.error(err.message);
        else toast.error(friendlyError(err, '캘린더를 연결하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      })
      .finally(() => setBusy(false));
  };

  const disconnect = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await calendarApi.disconnect();
      setConnected(false);
      toast.info('캘린더 연결을 해제했어요.');
    } catch (err: unknown) {
      toast.error(friendlyError(err, '연결을 해제하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  const connected = status === 'connected';
  const actionable = status === 'disconnected' || status === 'error';
  const title = connected ? 'Google 캘린더 연결됨' : 'Google 캘린더 연결';
  const desc = {
    loading: '연결 상태를 확인하고 있어요…',
    unavailable: native
      ? '캘린더 연결은 웹에서 할 수 있어요. 한 번 연결하면 앱에도 반영돼요.'
      : '지금은 아래에서 직접 추가해 주세요',
    disconnected: '제목 없이 시간만 읽어, 겹치지 않게 계획해요',
    connected: '캘린더 일정과 겹치지 않게 계획을 세워요',
    error: '연결 상태를 불러오지 못했어요. 눌러서 다시 연결해 볼 수 있어요.',
  }[status];

  const titleSize = compact ? 12 : 13;
  const descSize = compact ? 10 : 11;

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'var(--surface-raised)', border: `1px solid ${connected ? 'var(--brand)' : 'var(--sand-200)'}`, borderRadius: 12, padding: compact ? '10px 12px' : '12px 14px', boxSizing: 'border-box', opacity: status === 'unavailable' ? 0.85 : 1 }}
    >
      <div style={{ width: compact ? 26 : 36, height: compact ? 26 : 36, borderRadius: compact ? 8 : 10, background: connected ? 'var(--brand)' : 'var(--sand-100)', color: connected ? '#FFFCF6' : 'var(--text-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {connected ? <CheckCircle size={compact ? 12 : 18} weight="fill" /> : <Calendar size={compact ? 12 : 18} weight="fill" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: compact ? 600 : 700, fontSize: titleSize, color: status === 'unavailable' ? 'var(--text-2)' : 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 5 }}>
          {title}
          {status === 'unavailable' && !native && (
            <span style={{ height: 'var(--ctrl-xs)', padding: '0 5px', borderRadius: 9999, background: 'var(--sand-200)', fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'inline-flex', alignItems: 'center' }}>준비 중</span>
          )}
        </div>
        <div style={{ fontSize: descSize, color: 'var(--text-3)', marginTop: 1 }}>{desc}</div>
      </div>
      {actionable && (
        <button
          onClick={connect}
          disabled={busy}
          style={{ flexShrink: 0, height: 30, padding: '0 12px', borderRadius: 9999, border: 'none', background: 'var(--brand)', color: '#FFFCF6', fontWeight: 700, fontSize: 12, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}
        >
          {busy ? '연결 중…' : '연결'}
        </button>
      )}
      {connected && (
        <button
          onClick={disconnect}
          disabled={busy}
          style={{ flexShrink: 0, height: 30, padding: '0 10px', borderRadius: 9999, border: '1px solid var(--sand-300)', background: 'transparent', color: 'var(--text-2)', fontWeight: 600, fontSize: 12, cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: busy ? 0.6 : 1 }}
        >
          해제
        </button>
      )}
    </div>
  );
}
