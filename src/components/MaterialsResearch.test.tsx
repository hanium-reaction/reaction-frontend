import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MaterialsResearch } from './MaterialsResearch';
import { plansApi } from '../lib/api';
import type { components } from '../types/openapi';

vi.mock('../lib/api', async (original) => { const api = await original<typeof import('../lib/api')>(); return { ...api, plansApi: { ...api.plansApi, studyMethod: vi.fn(), materialsCatalog: vi.fn(), bookDetail: vi.fn(), materialsSpecConfirm: vi.fn() } }; });
const method = { aiSource: 'rule' as const, isDraft: true, goalTitle: '영어', approach: '책으로 연습', bookQuery: '영어 기초', videoQuery: '영어 영상', notice: '검색어를 확인하세요', materialMix: 'book' as const } satisfies components['schemas']['StudyMethodResponse'];
const detail = { kind: 'book' as const, title: '기초 영어', author: '작가', isbn13: '123', pageCount: 100 } satisfies components['schemas']['BookSpecDetail'];
describe('자료 검색 승인 경계 (#315)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(plansApi.studyMethod).mockResolvedValue(method);
    vi.mocked(plansApi.materialsCatalog).mockResolvedValue({ books: [{ ...detail, publisher: '출판사', coverUrl: '', linkUrl: '' }], videoNotice: '영상 검색은 건너뛰었어요' });
    vi.mocked(plansApi.bookDetail).mockResolvedValue({ detail });
    vi.mocked(plansApi.materialsSpecConfirm).mockResolvedValue({ goalTitle: '영어', kinds: ['book'], notice: '다음 계획부터 반영돼요' });
  });
  it('사용자가 확인한 검색어만 외부 검색에 보내고 상세 확인 전에는 저장하지 않는다', async () => {
    render(<MaterialsResearch interviewSessionId="session-a" />);
    expect(plansApi.studyMethod).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('학습 방식·검색어 제안 받기'));
    const input = await screen.findByLabelText('도서 검색어');
    expect(plansApi.materialsCatalog).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '수정한 검색어' } });
    fireEvent.click(screen.getByText('확인한 검색어로 검색'));
    fireEvent.click(await screen.findByText('기초 영어 · 작가 · 출판사'));
    expect(await screen.findByText('작가 · 100쪽')).toBeInTheDocument();
    expect(plansApi.materialsSpecConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('이 자료 맞아요'));
    expect(await screen.findByText('다음 계획부터 반영돼요')).toBeInTheDocument();
    expect(plansApi.materialsCatalog).toHaveBeenCalledWith({ bookQuery: '수정한 검색어', videoQuery: null });
    expect(plansApi.materialsSpecConfirm).toHaveBeenCalledWith({ interviewSessionId: 'session-a', details: [detail] });
  });
  it('저장 실패 시 다음 단계로 넘기지 않고 선택한 자료를 보존한다', async () => {
    vi.mocked(plansApi.materialsSpecConfirm).mockRejectedValue(new Error('offline'));
    const confirmed = vi.fn(); render(<MaterialsResearch interviewSessionId="s" onConfirmed={confirmed} />);
    fireEvent.click(screen.getByText('학습 방식·검색어 제안 받기'));
    fireEvent.click(await screen.findByText('확인한 검색어로 검색'));
    fireEvent.click(await screen.findByText('기초 영어 · 작가 · 출판사'));
    fireEvent.click(await screen.findByText('이 자료 맞아요'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(confirmed).not.toHaveBeenCalled();
    expect(screen.getByText('작가 · 100쪽')).toBeInTheDocument();
  });
  it('상세가 없는 응답은 안내를 표시하고 확정하지 않는다', async () => {
    vi.mocked(plansApi.bookDetail).mockResolvedValue({ detail: null, notice: '제공처가 응답하지 않아요' });
    render(<MaterialsResearch interviewSessionId="s" />);
    fireEvent.click(screen.getByText('학습 방식·검색어 제안 받기'));
    fireEvent.click(await screen.findByText('확인한 검색어로 검색'));
    fireEvent.click(await screen.findByText('기초 영어 · 작가 · 출판사'));
    expect(await screen.findByText('제공처가 응답하지 않아요')).toBeInTheDocument();
    expect(screen.queryByText('이 자료 맞아요')).not.toBeInTheDocument();
  });
  it('저장 안내를 먼저 보여주고 명시적인 계속하기에서만 다음 질문으로 이동한다', async () => {
    const confirmed = vi.fn().mockResolvedValue(undefined);
    const saved = vi.fn();
    render(<MaterialsResearch interviewSessionId="s" onSaved={saved} onConfirmed={confirmed} />);
    fireEvent.click(screen.getByText('학습 방식·검색어 제안 받기'));
    fireEvent.click(await screen.findByText('확인한 검색어로 검색'));
    fireEvent.click(await screen.findByText('기초 영어 · 작가 · 출판사'));
    fireEvent.click(await screen.findByText('이 자료 맞아요'));
    const next = await screen.findByText('확정한 자료로 인터뷰 계속하기');
    expect(saved).toHaveBeenCalledOnce();
    expect(confirmed).not.toHaveBeenCalled();
    fireEvent.click(next);
    await waitFor(() => expect(confirmed).toHaveBeenCalledOnce());
  });
});
