// Separate Vite development entry. Never imports AppShell or registers a service worker.
// The production build only includes index.html; this fixture is not an application route.
if (import.meta.env.DEV) {
  void import('./ReentryPreview').then(({ mountPreview }) => mountPreview());
} else {
  document.getElementById('root')!.textContent = '개발 서버에서만 제공하는 테스트 화면입니다.';
}
