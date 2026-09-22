import type { CalendarCheck } from '../types/api';

// 상태가 확인되지 않은 응답을 '겹침 있음/없음'으로 추측하지 않는다.
export function visibleCalendarConflict(calendar: CalendarCheck | undefined, conflict?: boolean) {
  return calendar?.status === 'ok' && conflict === true;
}
