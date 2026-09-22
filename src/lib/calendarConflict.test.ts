import { describe, expect, it } from 'vitest';
import { visibleCalendarConflict } from './calendarConflict';
describe('캘린더 배지 신뢰 조건 (#338)', () => {
  it.each(['failed', 'not_connected'] as const)('%s이면 이전 겹침 값이 있어도 배지를 숨긴다', (status) => {
    expect(visibleCalendarConflict({ status, checkedAt: null }, true)).toBe(false);
  });
  it('이전 API의 상태 누락 응답에도 배지를 그리지 않는다', () => {
    expect(visibleCalendarConflict(undefined, true)).toBe(false);
  });
  it('서버 확인이 성공한 겹침만 표시하고 수정 후 false이면 지운다', () => {
    const calendar = { status: 'ok' as const, checkedAt: null };
    expect(visibleCalendarConflict(calendar, true)).toBe(true);
    expect(visibleCalendarConflict(calendar, false)).toBe(false);
  });
});
