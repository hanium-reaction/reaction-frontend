import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { EveningCheckInScreen } from './EveningCheckInScreen';
import { reflectionApi, plansApi } from '../lib/api';
vi.mock('../lib/api', async original => ({
  ...await original<typeof import('../lib/api')>(),
  reflectionApi: { pending: vi.fn(), batch: vi.fn() },
  plansApi: { weekly: vi.fn().mockResolvedValue({ days: [] }) },
}));
vi.mock('../components/FailureTagPicker', () => ({ FailureTagPicker: () => null, useFailureTagCatalog: () => ({ tags: [], loading: false }) }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(plansApi.weekly).mockResolvedValue({ days: [] } as never); vi.mocked(reflectionApi.batch).mockResolvedValue({ needsFailureTags: [] } as never); });
it('에너지와 실행 모두 무선택이면 기존 기록을 바꾸지 않고 넘어간다', async () => {
  vi.mocked(reflectionApi.pending).mockResolvedValue([]);
  render(<EveningCheckInScreen onDone={vi.fn()} />);
  fireEvent.click(await screen.findByText('다음 →'));
  expect(reflectionApi.batch).not.toHaveBeenCalled();
});
it('에너지 없이 실행 결과를 저장하며 오류에서는 재시도할 수 있다', async () => {
  vi.mocked(reflectionApi.pending).mockResolvedValue([{ executionId: 'exec-1', title: '문장 쓰기', scheduledDate: '2026-10-19' }] as never);
  vi.mocked(reflectionApi.batch).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ needsFailureTags: [] } as never);
  render(<EveningCheckInScreen onDone={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: '했어요' }));
  fireEvent.click(screen.getByText('1건 기록하고 다음 →'));
  await screen.findByText('기록을 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  fireEvent.click(screen.getByText('1건 기록하고 다음 →'));
  await waitFor(() => expect(reflectionApi.batch).toHaveBeenCalledTimes(2));
  expect(vi.mocked(reflectionApi.batch).mock.calls[0]).toEqual(vi.mocked(reflectionApi.batch).mock.calls[1]);
});
