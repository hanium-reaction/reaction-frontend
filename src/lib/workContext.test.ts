import { afterEach, expect, it, vi } from 'vitest';
import { reflectionApi } from './api';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('메모만 입력하면 실패 태그를 만들지 않고 독립 메모로 저장한다', async () => {
  vi.stubEnv('VITE_REENTRY_P0', 'true');
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({memo:'다음 문장'}), {status:200}));
  vi.stubGlobal('fetch', fetcher);
  await reflectionApi.tagExecution('exec-1', {tagCodes:[], memo:'다음 문장', taskAversiveness:null});
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledWith('/api/work-context/executions/exec-1/note', expect.objectContaining({method:'PUT', body:JSON.stringify({memo:'다음 문장'})}));
});
