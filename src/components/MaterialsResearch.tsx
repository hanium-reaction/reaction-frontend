import { useRef, useState } from 'react';
import { friendlyError, plansApi } from '../lib/api';
import type { components } from '../types/openapi';
import { ReButton } from './ReButton';

type Schemas = components['schemas'];
export function MaterialsResearch({ interviewSessionId, onConfirmed, onSaved, onBusyChange }: {
  interviewSessionId: string | null;
  onConfirmed?: () => Promise<void>;
  onSaved?: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [method, setMethod] = useState<Schemas['StudyMethodResponse'] | null>(null);
  const [bookQuery, setBookQuery] = useState('');
  const [videoQuery, setVideoQuery] = useState('');
  const [catalog, setCatalog] = useState<Schemas['MaterialsCatalogResponse'] | null>(null);
  const [book, setBook] = useState<Schemas['BookSpecDetail'] | null>(null);
  const [video, setVideo] = useState<Schemas['VideoSpecDetail'] | null>(null);
  const [saved, setSaved] = useState<Schemas['MaterialsSpecConfirmResponse'] | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [detailNotice, setDetailNotice] = useState<string | null>(null);
  const run = async (work: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setError(null);
    try { await work(); } catch (err) { setError(friendlyError(err, '자료를 불러오지 못했어요. 직접 붙여넣거나 다시 시도해 주세요.')); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  };
  return <section aria-label="도서·영상 자료 검색" style={{ border: '1px solid var(--sand-200)', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
    <h2 style={{ fontSize: 16, margin: 0 }}>도서·영상 자료 찾기</h2>
    {!method && <ReButton disabled={busy || !interviewSessionId} onClick={() => void run(async () => {
      const result = await plansApi.studyMethod(interviewSessionId); setMethod(result);
      setBookQuery(result.materialMix === 'video' ? '' : result.bookQuery);
      setVideoQuery(result.materialMix === 'book' ? '' : result.videoQuery);
    })}>학습 방식·검색어 제안 받기</ReButton>}
    {method && <>
      <b>대상 목표: {method.goalTitle}</b><p>{method.approach}</p>
      <ul>{method.focusPoints?.map((point) => <li key={point}>{point}</li>)}</ul><p>{method.notice}</p>
      <p>아래 검색어를 확인한 뒤 검색을 누르면 외부 도서·영상 서비스에 전달됩니다. 필요 없는 검색어는 비워 주세요.</p>
      <label>도서 검색어<input aria-label="도서 검색어" value={bookQuery} maxLength={100} disabled={busy} onChange={(event) => { setBookQuery(event.target.value); setCatalog(null); setBook(null); setVideo(null); setSaved(null); }} /></label>
      <label>영상 검색어<input aria-label="영상 검색어" value={videoQuery} maxLength={100} disabled={busy} onChange={(event) => { setVideoQuery(event.target.value); setCatalog(null); setBook(null); setVideo(null); setSaved(null); }} /></label>
      <ReButton disabled={busy || (!bookQuery.trim() && !videoQuery.trim())} onClick={() => void run(async () => {
        if ([bookQuery.trim(), videoQuery.trim()].some((query) => query && query.length < 2)) throw new Error('검색어는 2자 이상 입력해 주세요.');
        const result = await plansApi.materialsCatalog({ bookQuery: bookQuery.trim() || null, videoQuery: videoQuery.trim() || null });
        setCatalog(result); setBook(null); setVideo(null); setSaved(null);
      })}>확인한 검색어로 검색</ReButton>
    </>}
    {catalog && <>
      {catalog.bookNotice && <p role="status">{catalog.bookNotice}</p>}
      {catalog.books?.map((candidate) => <ReButton key={candidate.isbn13} variant="ghost" disabled={busy} onClick={() => void run(async () => { const result = await plansApi.bookDetail(candidate.isbn13); setBook(result.detail ?? null); setDetailNotice(result.notice ?? (!result.detail ? '도서 상세를 확인하지 못했어요. 직접 붙여넣거나 다른 자료를 골라 주세요.' : null)); setSaved(null); })}>
        {candidate.title} · {candidate.author} · {candidate.publisher}
      </ReButton>)}
      {catalog.videoNotice && <p role="status">{catalog.videoNotice}</p>}
      {catalog.videos?.map((candidate) => <ReButton key={candidate.playlistId} variant="ghost" disabled={busy} onClick={() => void run(async () => { const result = await plansApi.videoDetail(candidate.playlistId); setVideo(result.detail ?? null); setDetailNotice(result.notice ?? (!result.detail ? '영상 상세를 확인하지 못했어요. 직접 붙여넣거나 다른 자료를 골라 주세요.' : null)); setSaved(null); })}>
        {candidate.title} · {candidate.channelTitle}
      </ReButton>)}
    </>}
    {detailNotice && <p role="status">{detailNotice}</p>}
    {book && <div><b>{book.title}</b><p>{book.author} · {book.pageCount}쪽</p>
      <ul>{book.chapters?.map((chapter, i) => <li key={i}>{chapter.title}</li>)}</ul>
      {!book.chapters?.length && <p>목차를 확인하지 못했어요. 페이지 수로 분량을 나눠요.</p>}
      <ReButton variant="ghost" disabled={busy} onClick={() => { setBook(null); setSaved(null); }}>도서 선택 해제</ReButton></div>}
    {video && <div><b>{video.title}</b><p>{video.channelTitle} · {video.videoCount}개 · {video.totalMinutes}분</p>
      <ul>{video.curriculum?.map((item, i) => <li key={i}>{item.title}</li>)}</ul>
      {video.truncated && <p>긴 재생목록은 일부 영상만 확인했어요.</p>}
      <ReButton variant="ghost" disabled={busy} onClick={() => { setVideo(null); setSaved(null); }}>영상 선택 해제</ReButton></div>}
    {(book || video) && !saved && <ReButton disabled={busy} onClick={() => void run(async () => {
      const details: Schemas['MaterialsSpecConfirmRequest']['details'] = [...(book ? [book] : []), ...(video ? [video] : [])];
      const result = await plansApi.materialsSpecConfirm({ interviewSessionId, details }); setSaved(result);
      onSaved?.();
    })}>이 자료 맞아요</ReButton>}
    {saved && <div role="status"><p>{saved.notice}</p>{saved.bookPace && <p>{saved.bookPace.summary} · 세션당 {saved.bookPace.pagesPerSession}쪽, 총 {saved.bookPace.totalSessions}회</p>}</div>}
    {saved && onConfirmed && <ReButton disabled={busy} onClick={() => void run(onConfirmed)}>확정한 자료로 인터뷰 계속하기</ReButton>}
    {busy && <p role="status">자료를 처리하고 있어요…</p>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
