import { beforeEach, describe, expect, it } from 'vitest';
import { dismissUncheckedBlocks, filterDismissedBlocks, findUncheckedBlocks } from './uncheckedBlocks';

describe('서버 미체크 판정 (#341)', () => {
  beforeEach(() => localStorage.clear());
  it('로컬 시간이나 진행 상태를 재계산하지 않고 서버 true만 사용한다', () => {
    expect(findUncheckedBlocks([
      { id: 'a', title: '미체크', status: 'todo', missedCheckIn: true },
      { id: 'b', title: '진행 중', status: 'in_progress', missedCheckIn: false },
      { id: 'c', title: '구 응답', status: 'todo' },
    ])).toEqual([{ actionId: 'a', title: '미체크' }]);
  });
  it('닫은 배지를 다음 조회에도 숨긴다', () => {
    dismissUncheckedBlocks(['a']);
    expect(filterDismissedBlocks([{ actionId: 'a', title: '미체크' }])).toEqual([]);
  });
});
