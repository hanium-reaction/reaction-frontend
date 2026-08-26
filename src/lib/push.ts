// Web Push 구독 헬퍼 (#25).
// VAPID public key 는 GET /notifications/vapid-public-key 로 서버에서 받는다(백엔드 구현됨).
// 서버가 짝키를 직접 알려줘야 키 rotate 에도 구독이 어긋나지 않는다 — 하드코딩/빌드타임
// 주입은 rotate 시 조용히 깨진다. 호출 실패/미설정(publicKey=null) 시에만 데모 키로 fallback.

import type { PushSubscribeRequest } from '../types/api';
import { notificationsApi } from './api';

// 서버 미동작/미설정 시에만 쓰는 시연용 폴백 키. 이 키로 구독해도 서버가 그 private key 를
// 갖고 있지 않으니 실제 발송은 안 된다 — subscribe API 응답 모양 확인용.
const FALLBACK_VAPID_PUBLIC_KEY =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';

async function resolveVapidPublicKey(): Promise<string> {
  const envKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (envKey) return envKey;
  try {
    const { publicKey } = await notificationsApi.vapidPublicKey();
    if (publicKey) return publicKey;
  } catch {
    /* 미인증/오류 — 데모 키로 fallback */
  }
  return FALLBACK_VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getPushPermission(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

export async function subscribePush(): Promise<PushSubscribeRequest | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;

  // permission 요청
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return null;
  }
  if (Notification.permission !== 'granted') return null;

  const vapidPublicKey = await resolveVapidPublicKey();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
  });

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;

  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export async function unsubscribePush(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}

export async function registerServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  // 개발 환경에선 일부 브라우저가 SW 등록을 제한할 수 있어 silent fail.
  try {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch {
    /* 무시 */
  }
}

/** 이 주소에 실려 온 알림 id — service worker 가 새 창을 열 때 붙여 준다. */
const NOTIF_PARAM = 'notif';

/**
 * 알림 열람을 서버에 기록한다(#258).
 *
 * service worker 는 localStorage 에 접근할 수 없어 액세스 토큰을 못 읽는다. 그래서
 * SW 가 직접 부르지 않고 여기로 id 만 넘어온다 — 창이 이미 떠 있으면 postMessage 로,
 * 새로 열렸으면 주소의 `?notif=` 로. 어느 쪽이든 호출은 앱이 한다.
 *
 * 로그인 뒤에 시작해야 한다(401 이면 기록이 남지 않는다). 실패는 삼킨다 — 열람 기록
 * 하나 때문에 화면에 오류를 띄울 이유가 없고, endpoint 가 멱등이라 다음 기회에 또 부르면 된다.
 */
export function startNotificationOpenReporting(): () => void {
  if (typeof window === 'undefined') return () => {};

  const report = (id: string) => {
    if (!id) return;
    notificationsApi.opened(id).catch(() => { /* 열람 기록 실패는 조용히 넘긴다 */ });
  };

  // 1) 새 창으로 열린 경우 — 주소에서 집어가고 흔적은 지운다.
  //    남겨두면 새로고침할 때마다 같은 id 를 다시 보낸다(멱등이라 해롭진 않지만 요청 낭비).
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get(NOTIF_PARAM);
  if (fromUrl) {
    report(fromUrl);
    url.searchParams.delete(NOTIF_PARAM);
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }

  // 2) 이미 떠 있던 창 — SW 가 보낸 메시지를 받는다.
  if (!('serviceWorker' in navigator)) return () => {};
  const onMessage = (e: MessageEvent) => {
    const d = e.data;
    if (d && d.type === 'notification-opened' && typeof d.id === 'string') report(d.id);
  };
  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}
