if (import.meta.env.DEV) {
  void import('./WeeklyReplanPreview').then(({ mountPreview }) => mountPreview());
} else {
  document.getElementById('root')!.textContent = '개발 서버에서만 제공하는 테스트 화면입니다.';
}
