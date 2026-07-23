// Web Push 구독 헬퍼 (#25).
// VAPID public key 는 백엔드 GET /notifications/vapid-public-key 에서 받는다(구현됨).
// 서버가 키를 주면 그 키로 구독해야 실제 발송이 도달한다. 서버가 미설정(null)이면
// 발송 못 하는 구독이 조용히 쌓이므로 구독을 만들지 않는다. 엔드포인트 호출 자체가
// 실패하면(구버전 백엔드/네트워크) 데모가 안 깨지도록 env/더미 키로 fallback.

import { notificationsApi } from './api';
import type { PushSubscribeRequest } from '../types/api';

// Fallback VAPID public key — 우선 환경변수(VITE_VAPID_PUBLIC_KEY), 없으면 시연용 더미.
// 서버 키를 못 받았을 때만 쓰인다. 실제 발송에는 같은 키쌍의 백엔드가 필요하다.
const FALLBACK_VAPID_PUBLIC_KEY =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const ENV_VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ?? FALLBACK_VAPID_PUBLIC_KEY;

// 서버에서 applicationServerKey 를 해석한다.
//  - 문자열 키  → 그 키로 구독
//  - null       → 서버 VAPID 미설정. 구독하면 안 됨 (구독 생략 신호)
//  - 호출 실패  → env/더미 키로 fallback (데모 유지)
type ResolvedKey = { key: string } | { unsupported: true };

async function resolveServerKey(): Promise<ResolvedKey> {
  try {
    const { publicKey } = await notificationsApi.vapidPublicKey();
    if (publicKey) return { key: publicKey };
    return { unsupported: true };
  } catch {
    return { key: ENV_VAPID_PUBLIC_KEY };
  }
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

  // 서버가 VAPID 키를 주는지 먼저 확인 — 미설정이면 도달 못 하는 구독을 만들지 않는다.
  const resolved = await resolveServerKey();
  if ('unsupported' in resolved) return null;

  // permission 요청
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return null;
  }
  if (Notification.permission !== 'granted') return null;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(resolved.key) as BufferSource,
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
