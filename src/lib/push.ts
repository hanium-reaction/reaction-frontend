// Web Push 구독 헬퍼 (#25).
// VAPID public key 는 GET /notifications/vapid-public-key 에서 런타임에 받는다(#83) —
// 서버가 키를 rotate 해도 자동으로 따라온다. 조회 실패(네트워크/구버전 백엔드)시에만
// 환경변수 또는 데모용 키로 폴백해 데모 흐름이 깨지지 않게 한다.

import type { PushSubscribeRequest } from '../types/api';
import { notificationsApi } from './api';

// 폴백 키 — 우선 환경변수(VITE_VAPID_PUBLIC_KEY), 없으면 시연용 더미.
const FALLBACK_VAPID_PUBLIC_KEY =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const ENV_VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? FALLBACK_VAPID_PUBLIC_KEY;

// 서버가 명시적으로 publicKey=null 을 주면 "VAPID 미설정" 의도이므로 폴백하지 않고
// 구독을 만들지 않는다(발송 불가 구독이 조용히 쌓이는 것 방지, api-contract 안내).
// 조회 자체가 실패(네트워크/구버전 백엔드)하면 데모가 안 깨지도록 폴백 키를 쓴다.
async function resolveVapidPublicKey(): Promise<string | null> {
  try {
    const res = await notificationsApi.vapidPublicKey();
    return res.publicKey ?? null;
  } catch {
    return ENV_VAPID_PUBLIC_KEY;
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

  // permission 요청
  if (Notification.permission === 'default') {
    const result = await Notification.requestPermission();
    if (result !== 'granted') return null;
  }
  if (Notification.permission !== 'granted') return null;

  const publicKey = await resolveVapidPublicKey();
  if (!publicKey) return null; // 서버 VAPID 미설정 — 구독 생성하지 않음

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
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
