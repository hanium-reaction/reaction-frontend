import type { FailureTagRequest } from '../types/api';

// 카탈로그 장애 시 사용하는 기존 한글 코드도 지원한다.
export function hasAvoidanceReason(codes: readonly string[]): boolean {
  return codes.some((code) => code === 'AVOIDANCE' || code === '회피');
}

export function normalizeFailureTagRequest(body: FailureTagRequest): FailureTagRequest {
  if (hasAvoidanceReason(body.tagCodes)) return body;
  const { taskAversiveness: _unused, ...rest } = body;
  return rest;
}
