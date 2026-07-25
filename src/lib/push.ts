// Web Push 구독 헬퍼 (#25).
// VAPID public key 는 런타임에 백엔드(#16 GET /notifications/vapid-public-key)에서 받아온다.
// 서버가 자기 private key 의 짝을 알려줘 rotate 에도 진실 소스가 서버 하나로 모인다.
// 엔드포인트 미도달(구버전 백엔드/네트워크) 시엔 빌드타임 폴백 키로 데모 흐름을 유지한다.

import type { PushSubscribeRequest } from '../types/api';
import { notificationsApi } from './api';

// 빌드타임 폴백 VAPID public key — 우선 환경변수(VITE_VAPID_PUBLIC_KEY), 없으면 시연용 더미.
// 서버 런타임 키를 못 받았을 때만 쓰인다. 실제 발송엔 같은 키쌍의 private key 를 가진 백엔드가 필요.
const FALLBACK_VAPID_PUBLIC_KEY =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const BUILD_TIME_VAPID_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY ?? FALLBACK_VAPID_PUBLIC_KEY;

// 구독에 쓸 VAPID public key 를 결정한다.
//   - 서버가 키 반환 → 그 키 사용(진실 소스, rotate 자동 반영).
//   - 서버가 publicKey=null → VAPID 미설정. 구독하면 조용히 실패하는 구독만 쌓이므로 null 반환(구독 안 함).
//   - 엔드포인트 자체 실패(구버전 백엔드/오프라인) → 빌드타임 폴백으로 데모 유지.
async function resolveVapidPublicKey(): Promise<string | null> {
  try {
    const { publicKey } = await notificationsApi.vapidPublicKey();
    if (publicKey === null) return null; // 서버 계약: 미설정이면 구독하지 않는다.
    if (publicKey) return publicKey;
    return BUILD_TIME_VAPID_PUBLIC_KEY; // 빈 문자열 등 예외적 응답 방어.
  } catch {
    return BUILD_TIME_VAPID_PUBLIC_KEY; // 미도달 — 폴백으로 데모 흐름 유지.
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

  // 서버가 VAPID 미설정(null)이면 구독을 만들지 않는다 — 도달 못 하는 구독이 쌓이는 것 방지.
  const vapidKey = await resolveVapidPublicKey();
  if (!vapidKey) return null;

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
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
