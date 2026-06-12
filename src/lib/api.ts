// 백엔드(reaction-backend) 호출용 fetch 래퍼.
// 응답·에러·인증·Idempotency 규약은 docs/api-contract.md v0.7 의 §1 을 따른다.

import type {
  ActionDetail,
  AnonymizeRequest,
  ApiErrorPayload,
  AuthSession,
  CalendarConnection,
  CheckInRequest,
  CheckInResponse,
  ExecutionStartResponse,
  ConsentRecord,
  ConsentUpdateRequest,
  FailureTagMaster,
  FailureTagRequest,
  FailureTagResponse,
  FixedSchedule,
  FixedScheduleCreateRequest,
  FreeBusy,
  GoalsByTier,
  Habit,
  HabitCreateRequest,
  HabitInstance,
  InboxCreateRequest,
  InboxItem,
  InboxUpdateRequest,
  InterviewSession,
  NotificationSettings,
  NotificationSettingsUpdateRequest,
  OnboardingStatus,
  Plan,
  PlanBlockUpdate,
  PlanScheduledBlock,
  PushSubscribeRequest,
  RecoveryDecisionRequest,
  RecoveryDecisionResponse,
  RecoveryProposalsResponse,
  ReflectionBatchRequest,
  ReflectionPendingItem,
  ReplanDiff,
  SlotAnswerRequest,
  SlotCatalogEntry,
  TimePolicy,
  TodayAgenda,
  ToneModeUpdateRequest,
  UserProfile,
  UserSettings,
  WeeklyPlanResponse,
  WeeklyReview,
} from '../types/api';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const TOKEN_KEY = 'reaction.accessToken';

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly field?: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';
  body?: unknown;
  idempotencyKey?: string;
  // 토큰이 없어도 호출. /auth/google 같은 인증 진입점.
  anonymous?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey, anonymous = false } = opts;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content
  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    let payload: ApiErrorPayload | null = null;
    try {
      payload = (await res.json()) as ApiErrorPayload;
    } catch {
      /* 응답이 JSON이 아닌 경우 fallthrough */
    }
    throw new ApiError(
      payload?.code ?? 'COMMON_HTTP_ERROR',
      payload?.message ?? `HTTP ${res.status}`,
      res.status,
      payload?.field,
    );
  }

  return (await res.json()) as T;
}

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  loginWithGoogle: (idToken: string) =>
    request<AuthSession>('/auth/google', {
      method: 'POST',
      body: { idToken },
      anonymous: true,
    }),

  me: () => request<UserProfile>('/auth/me'),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      anonymous: true,
    }),

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    }),
};

// ── Onboarding ────────────────────────────────────────────────
export const onboardingApi = {
  status: () => request<OnboardingStatus>('/onboarding/status'),
};

// ── Interview (S02) ───────────────────────────────────────────
export const interviewApi = {
  start: () =>
    request<InterviewSession>('/interview/sessions', {
      method: 'POST',
      body: {},
    }),

  get: (sessionId: string) =>
    request<InterviewSession>(`/interview/sessions/${sessionId}`),

  submitAnswer: (sessionId: string, payload: SlotAnswerRequest) =>
    request<InterviewSession>(`/interview/sessions/${sessionId}/answers`, {
      method: 'POST',
      body: payload,
    }),

  nextQuestion: (sessionId: string) =>
    request<InterviewSession>(`/interview/sessions/${sessionId}/next-question`, {
      method: 'POST',
      body: {},
    }),

  finish: (sessionId: string) =>
    request<InterviewSession>(`/interview/sessions/${sessionId}/finish`, {
      method: 'POST',
      body: {},
    }),

  slotCatalog: () => request<SlotCatalogEntry[]>('/interview/slot-catalog'),
};

// ── Goals (S03·S26) ───────────────────────────────────────────
export const goalsApi = {
  list: () => request<GoalsByTier>('/goals'),
};

// ── Time Policies (S07) ───────────────────────────────────────
export const timePoliciesApi = {
  list: () => request<TimePolicy[]>('/time-policies'),

  prefillFromInterview: () =>
    request<TimePolicy[]>('/time-policies/prefill-from-interview', {
      method: 'POST',
      body: {},
    }),
};

// ── Fixed Schedules (S05) ─────────────────────────────────────
export const fixedSchedulesApi = {
  list: () => request<FixedSchedule[]>('/fixed-schedules'),

  create: (body: FixedScheduleCreateRequest) =>
    request<FixedSchedule>('/fixed-schedules', { method: 'POST', body }),

  remove: (scheduleId: string) =>
    request<void>(`/fixed-schedules/${scheduleId}`, { method: 'DELETE' }),
};

// ── Calendar (S04) ────────────────────────────────────────────
export const calendarApi = {
  connect: (code: string) =>
    request<CalendarConnection>('/calendar/connect', {
      method: 'POST',
      body: { code },
    }),

  disconnect: () =>
    request<void>('/calendar/connect', { method: 'DELETE' }),

  freebusy: (from: string, to: string) =>
    request<FreeBusy>(`/calendar/freebusy?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
};

// ── Inbox (S24·S25) ───────────────────────────────────────────
export const inboxApi = {
  list: (status?: string) =>
    request<InboxItem[]>(status ? `/inbox?status=${encodeURIComponent(status)}` : '/inbox'),

  create: (body: InboxCreateRequest) =>
    request<InboxItem>('/inbox', { method: 'POST', body }),

  update: (inboxId: string, body: InboxUpdateRequest) =>
    request<InboxItem>(`/inbox/${inboxId}`, { method: 'PATCH', body }),

  // Inbox → Goal (tier=maintain, 한도 초과 시 422 GOAL_TIER_LIMIT_EXCEEDED)
  convertToGoal: (inboxId: string) =>
    request<InboxItem>(`/inbox/${inboxId}/convert-to-goal`, { method: 'POST', body: {} }),

  // Inbox → ActionItem(source=inbox)
  convertToAction: (inboxId: string) =>
    request<InboxItem>(`/inbox/${inboxId}/convert-to-action`, { method: 'POST', body: {} }),

  // soft delete (status=archived, 204 No Content)
  archive: (inboxId: string) =>
    request<void>(`/inbox/${inboxId}/archive`, { method: 'POST', body: {} }),
};

// ── Habits (S27) ──────────────────────────────────────────────
export const habitsApi = {
  list: () => request<Habit[]>('/habits'),

  create: (body: HabitCreateRequest) =>
    request<Habit>('/habits', { method: 'POST', body }),

  remove: (habitId: string) =>
    request<void>(`/habits/${habitId}`, { method: 'DELETE' }),

  instancesForWeek: (weekStart: string) =>
    request<HabitInstance[]>(`/habit-instances?weekStart=${encodeURIComponent(weekStart)}`),

  check: (instanceId: string) =>
    request<HabitInstance>(`/habit-instances/${instanceId}/check`, {
      method: 'POST',
      body: {},
    }),
};

// ── Today / Execution (S10-S13) — #19-A 조회 + #19-B start/check-ins 구현 ──
export const todayApi = {
  agenda: () => request<TodayAgenda>('/today/agenda'),

  getAction: (actionId: string) =>
    request<ActionDetail>(`/today/actions/${actionId}`),

  // [▶ 시작] → execution_events 생성. 블록 없으면 서버가 즉석 블록 생성 (#19-B)
  start: (actionId: string) =>
    request<ExecutionStartResponse>(`/today/actions/${actionId}/start`, {
      method: 'POST',
      body: {},
    }),

  // pause/resume 은 #19-B-2 까지 백엔드 501
  pause: (executionId: string) =>
    request<unknown>(`/today/focus/${executionId}/pause`, {
      method: 'POST',
      body: {},
    }),

  resume: (executionId: string) =>
    request<unknown>(`/today/focus/${executionId}/resume`, {
      method: 'POST',
      body: {},
    }),

  // Quick Check-in 4칩 (#19-B). needsFailureTags=true → S18 → §12 Recovery
  checkIn: (body: CheckInRequest) =>
    request<CheckInResponse>('/today/check-ins', {
      method: 'POST',
      body,
    }),
};

// ── Plans (S06·S14·S15·S16) — 백엔드 501 ──────────────────────
export const plansApi = {
  generate: () => request<Plan>('/plans/generate', { method: 'POST', body: {} }),

  get: (planId: string) => request<Plan>(`/plans/${planId}`),

  approve: (planId: string) =>
    request<Plan>(`/plans/${planId}/approve`, { method: 'POST', body: {} }),

  weekly: (weekStart: string) =>
    request<WeeklyPlanResponse>(`/plans/weekly?weekStart=${encodeURIComponent(weekStart)}`),

  updateBlock: (planId: string, blockId: string, body: PlanBlockUpdate) =>
    request<PlanScheduledBlock>(`/plans/${planId}/blocks/${blockId}`, {
      method: 'PATCH',
      body,
    }),
};

// ── Reviews (S21·S22) — 백엔드 501 ────────────────────────────
export const reviewsApi = {
  weekly: (weekStart: string) =>
    request<WeeklyReview>(`/reviews/weekly?weekStart=${encodeURIComponent(weekStart)}`),

  regenerate: (weekStart: string) =>
    request<WeeklyReview>('/reviews/weekly/generate', {
      method: 'POST',
      body: { weekStart },
    }),

  acceptHabitPenalty: (habitId: string, idempotencyKey: string) =>
    request<void>(`/reviews/habit-penalty/${habitId}/accept`, {
      method: 'POST',
      body: {},
      idempotencyKey,
    }),
};

// ── Reflection (S17·S18) — #19-B failure-tags 구현. pending/batch 는 501 ──
export const reflectionApi = {
  pending: () => request<ReflectionPendingItem[]>('/reflection/pending'),

  // 13종 실패 사유 마스터 (S18 칩 원본)
  failureTags: () => request<FailureTagMaster[]>('/reflection/failure-tags'),

  batch: (body: ReflectionBatchRequest, idempotencyKey: string) =>
    request<void>('/reflection/batch', { method: 'POST', body, idempotencyKey }),

  // 실패 사유 0~2개 태깅 — 이 태그가 Recovery 룰 엔진(§12) 입력이 된다 (#19-B)
  tagExecution: (executionId: string, body: FailureTagRequest) =>
    request<FailureTagResponse>(`/reflection/failure-tags/${executionId}`, {
      method: 'POST',
      body,
    }),
};

// ── Recovery / Replan (S19·S20) — #20-A 구현. replan 은 501 ────
export const recoveryApi = {
  // 회복 카드 2~4장 생성 (Draft Layer). pending 존재 시 그대로 반환 — 재호출 안전
  generateProposals: (executionId: string) =>
    request<RecoveryProposalsResponse>('/recovery/proposals/generate', {
      method: 'POST',
      body: { executionId },
    }),

  // 수락/스킵 확정 — Idempotency-Key 필수 (§1.7)
  decide: (body: RecoveryDecisionRequest, idempotencyKey: string) =>
    request<RecoveryDecisionResponse>('/recovery/decisions', {
      method: 'POST',
      body,
      idempotencyKey,
    }),
};

export const replanApi = {
  diff: (executionId: string) => request<ReplanDiff>(`/replan/${executionId}`),

  approve: (executionId: string, idempotencyKey: string) =>
    request<void>(`/replan/${executionId}/approve`, {
      method: 'POST',
      body: {},
      idempotencyKey,
    }),
};

// ── Notifications (S08·S25) ───────────────────────────────────
export const notificationsApi = {
  getSettings: () => request<NotificationSettings>('/notifications/settings'),

  updateSettings: (body: NotificationSettingsUpdateRequest) =>
    request<NotificationSettings>('/notifications/settings', { method: 'PATCH', body }),

  subscribe: (body: PushSubscribeRequest) =>
    request<void>('/notifications/subscribe', { method: 'POST', body }),

  unsubscribe: () =>
    request<void>('/notifications/subscribe', { method: 'DELETE' }),
};

// ── Settings / Privacy (S23·S28) — 백엔드 501 ─────────────────
export const settingsApi = {
  get: () => request<UserSettings>('/settings'),

  updateToneMode: (body: ToneModeUpdateRequest) =>
    request<UserSettings>('/settings/tone-mode', { method: 'PATCH', body }),

  anonymize: (body: AnonymizeRequest) =>
    request<void>('/settings/anonymize', { method: 'POST', body }),
};

export const privacyApi = {
  consents: () => request<ConsentRecord[]>('/privacy/consent'),

  updateConsent: (body: ConsentUpdateRequest) =>
    request<ConsentRecord>('/privacy/consent', { method: 'POST', body }),
};
