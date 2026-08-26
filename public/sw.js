// Re:Action service worker (#25 PWA + Web Push).
// 최소 구성: 설치 단계에서 즉시 활성화, push event 처리.

const CACHE_NAME = 'reaction-v1';

self.addEventListener('install', (event) => {
  // skipWaiting — 새 SW 가 등록되자마자 활성화. 캐시 전략은 후속.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-only + 오프라인 fallback 없이 일단 통과. 추후 stale-while-revalidate 도입.
self.addEventListener('fetch', (event) => {
  // 별도 처리 없음 — 브라우저 기본 동작.
});

// Web Push 수신.
self.addEventListener('push', (event) => {
  const data = event.data ? safeParse(event.data.text()) : {};
  const title = data.title || 'Re:Action';
  const body = data.body || '오늘의 첫 카드가 기다리고 있어요.';
  const options = {
    body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    // 예전엔 url 문자열만 담아서 알림 id 가 여기서 버려졌고, 그래서 "열었다"를
    // 서버에 기록할 방법이 없었다(#258). 객체로 담아 id 를 클릭까지 끌고 간다.
    data: { id: data.id || null, url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = event.notification.data;
  // 구버전 알림(문자열 url)도 아직 트레이에 남아 있을 수 있다.
  const url = (typeof raw === 'string' ? raw : raw && raw.url) || '/';
  const id = (raw && typeof raw === 'object' && raw.id) || null;

  // 열람 기록은 SW 가 직접 못 보낸다 — 액세스 토큰이 localStorage 에 있고
  // service worker 는 거기에 접근할 수 없다. 그래서 앱 쪽에 id 를 넘기고
  // 앱이 POST /notifications/{id}/opened 를 부른다(#258).
  //   · 창이 이미 있으면 postMessage
  //   · 없으면 열 주소에 ?notif= 를 붙여 앱이 부팅하며 집어가게 한다
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) {
        if ('focus' in c) {
          if (id) c.postMessage({ type: 'notification-opened', id });
          return c.focus();
        }
      }
      const target = id
        ? url + (url.includes('?') ? '&' : '?') + 'notif=' + encodeURIComponent(id)
        : url;
      return self.clients.openWindow(target);
    }),
  );
});

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
