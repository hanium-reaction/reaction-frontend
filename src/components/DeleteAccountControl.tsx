import { useRef, useState } from 'react';
import { friendlyError, settingsApi } from '../lib/api';
import { ReButton } from './ReButton';
import type { components } from '../types/openapi';

export function DeleteAccountControl({ onDeleted }: { onDeleted: () => Promise<void> }) {
  const [confirmation, setConfirmation] = useState<components['schemas']['DeleteAccountResponse'] | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const request = async (confirm: boolean) => {
    if (lock.current || (confirm && !confirmation?.confirmationToken)) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      const result = await settingsApi.deleteAccount(confirm ? confirmation!.confirmationToken! : undefined);
      if (result.status === 'deleted') { await onDeleted(); return; }
      setConfirmation(result);
    } catch (err) { setError(friendlyError(err, '계정 삭제 요청을 처리하지 못했어요.')); }
    finally { lock.current = false; setBusy(false); }
  };
  return <section aria-label="계정 삭제" style={{ marginTop: 12 }}>
    {!confirmation && <ReButton variant="ghost" disabled={busy} onClick={() => void request(false)}>계정 삭제 안내 확인</ReButton>}
    {confirmation && <div>
      <h3>계정을 삭제할까요?</h3><p>{confirmation.message}</p>
      {confirmation.expiresAt && <p>확인 유효 시간: {new Date(confirmation.expiresAt).toLocaleString('ko-KR')}</p>}
      <p>아래 삭제 버튼을 누르기 전에는 삭제되지 않습니다.</p>
      <ReButton disabled={busy || !confirmation.confirmationToken} onClick={() => void request(true)}>확인했어요. 계정 삭제</ReButton>
      <ReButton variant="ghost" disabled={busy} onClick={() => setConfirmation(null)}>취소</ReButton>
    </div>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
