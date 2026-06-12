// 백엔드 응답 타입 (reaction-backend/docs/api-contract.md v0.7 기준).
// 응답은 envelope 없이 도메인 객체를 직접 반환하며 필드는 모두 camelCase.

export type OnboardingState =
  | 'WELCOME'
  | 'ONBOARDING_INTERVIEW'
  | 'ONBOARDING_CONFIRM'
  | 'ONBOARDING_CALENDAR'
  | 'ONBOARDING_MANUAL_SCHEDULE'
  | 'ONBOARDING_POLICIES'
  | 'ONBOARDING_FIRST_PLAN'
  | 'ONBOARDING_NOTIFICATIONS'
  | 'ACTIVE';

export type ToneMode = 'gentle' | 'strict' | 'encouraging';

export interface UserProfile {
  userId: string;
  email: string;
  name: string;
  timezone: string;
  onboardingState: OnboardingState;
  toneMode: ToneMode;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

export interface OnboardingStatus {
  currentState: OnboardingState;
  suggestedNextScreen: string; // e.g. "S01", "S02", ..., "S10"
}

// ── Interview (S02) ────────────────────────────────────────────
export type SlotAnswerType =
  | 'text'
  | 'chip'
  | 'select'
  | 'date_picker'
  | 'time_range';

export interface InterviewQuestion {
  slotKey: string;
  text: string;
  answerType: SlotAnswerType;
  options: string[];
}

export type InterviewEndReason = 'early_user' | 'completed' | null;

export interface InterviewSession {
  sessionId: string;
  ambiguityScore: number;
  totalTurns: number;
  endReason: InterviewEndReason;
  currentQuestion: InterviewQuestion | null;
}

export interface SlotAnswerRequest {
  slotKey: string;
  value: unknown;
  clientTurn: number;
}

export interface SlotCatalogEntry {
  slotKey: string;
  label: string;
  answerType: SlotAnswerType;
  isRequired: boolean;
  category: string;
}

// ── Goals (S03·S26) ───────────────────────────────────────────
export type GoalTier = 'focus' | 'maintain' | 'parked';

export interface ApiGoal {
  goalId: string;
  title: string;
  category: string;
  goalTier: GoalTier;
  priorityLevel: number;
  deadline: string | null; // YYYY-MM-DD
  estimatedMinutes: number | null;
  status: string;
}

export interface GoalsByTier {
  focus: ApiGoal[];
  maintain: ApiGoal[];
  parked: ApiGoal[];
}

// ── Time Policies (S07) ───────────────────────────────────────
export type PolicyType =
  | 'sleep'
  | 'lunch'
  | 'break_min'
  | 'no_touch'
  | 'late_night_block'
  | 'custom';

export interface TimePolicy {
  policyId: string;
  policyType: PolicyType | string;
  // payload 는 policy_type 별로 모양이 다르다 (sleep/lunch: {startTime,endTime},
  // break_min: {minMinutes}, 등).
  payload: Record<string, unknown>;
  isActive: boolean;
}

// ── Fixed Schedules (S05) ─────────────────────────────────────
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface FixedSchedule {
  scheduleId: string;
  title: string;
  daysOfWeek: DayOfWeek[];
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface FixedScheduleCreateRequest {
  title: string;
  daysOfWeek: DayOfWeek[];
  startTime: string;
  endTime: string;
}

// ── Calendar (S04) ─────────────────────────────────────────────
export interface CalendarConnection {
  provider: string;
  connected: boolean;
  scopes: string[];
}

export interface BusyInterval {
  start: string; // KST ISO 8601
  end: string;
}

export interface FreeBusy {
  busy: BusyInterval[];
}

// ── Notifications (S08) ───────────────────────────────────────
export interface NotificationSettings {
  morningBriefTime: string; // HH:MM
  eveningReflectionTime: string;
  preCardEnabled: boolean;
  pushSubscribed: boolean;
}

export interface NotificationSettingsUpdateRequest {
  morningBriefTime?: string;
  eveningReflectionTime?: string;
  preCardEnabled?: boolean;
}

// ── Inbox (S24·S25) ───────────────────────────────────────────
export type InboxStatus = 'captured' | 'classified' | 'archived' | 'promoted';
// 백엔드가 강제하는 6종 enum (#40, schemas/inbox.py)
export type InboxCategory = 'study' | 'project' | 'health' | 'routine' | 'schedule' | 'other';

export interface InboxItem {
  inboxId: string;
  rawText: string;
  aiCategoryGuess: string | null;
  userCategory: string | null;
  status: InboxStatus | string;
  promotedGoalId: string | null;
}

export interface InboxCreateRequest {
  rawText: string;
}

export interface InboxUpdateRequest {
  userCategory?: InboxCategory;
  status?: InboxStatus;
}

// ── Habits (S27) ──────────────────────────────────────────────
export type TimePreference = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface Habit {
  habitId: string;
  title: string;
  category: string;
  frequencyPerWeek: number;
  minutesPerSession: number;
  timePreference: TimePreference | string;
  priorityLevel: number;
}

export interface HabitInstance {
  instanceId: string;
  habitId: string;
  weekStart: string; // YYYY-MM-DD
  targetCount: number;
  doneCount: number;
}

export interface HabitCreateRequest {
  title: string;
  category: string;
  frequencyPerWeek: number;
  minutesPerSession: number;
  timePreference: TimePreference;
  priorityLevel: number;
}

// ── Today / Execution (S10-S13) — api-contract §10 (#19-A 조회 + #19-B 쓰기 구현 반영) ──

export type ActionItemStatus =
  | 'planned'
  | 'in_progress'
  | 'done'
  | 'partial_done'
  | 'failed'
  | 'over_done'
  | 'archived';

export interface MorningBriefData {
  headline: string;
  bigRockActionId: string | null; // action_<uuid>
  adjustmentHints: string[];
  fallbackUsed: boolean;
}

export interface AgendaCard {
  actionId: string; // action_<uuid>
  title: string;
  category: string;
  status: ActionItemStatus | string;
  priority: number;
  estimatedMinutes: number;
  source: string;
  whyNow: string | null;
  firstStep: string | null;
}

export interface AgendaHabit {
  instanceId: string; // hinst_<uuid>
  habitId: string; // habit_<uuid>
  title: string;
  targetCount: number;
  doneCount: number;
}

export interface AgendaFixedSchedule {
  scheduleId: string; // fixed_<uuid>
  title: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

export interface TodayAgenda {
  date: string; // YYYY-MM-DD
  brief: MorningBriefData | null;
  cards: AgendaCard[];
  habits: AgendaHabit[];
  fixedSchedules: AgendaFixedSchedule[];
}

export interface ActionDetail {
  actionId: string;
  title: string;
  category: string;
  status: string;
  priority: number;
  estimatedMinutes: number;
  targetDate: string; // YYYY-MM-DD
  source: string;
  whyNow: string | null;
  firstStep: string | null;
  goalId: string | null;
}

export type CompletionStatus = 'done' | 'partial_done' | 'failed' | 'over_done';

// POST /today/actions/{id}/start 응답 (#19-B)
export interface ExecutionStartResponse {
  executionId: string; // exec_<uuid>
  actionId: string;
  completionStatus: string; // in_progress
  actualStartAt: string; // KST ISO
}

// POST /today/check-ins 요청 (#19-B) — Quick Check-in 4칩
export interface CheckInRequest {
  executionId: string;
  completionStatus: CompletionStatus;
  userRating?: number; // 1~5
  userFeedback?: string; // 서버에서 at-rest 암호화
}

// POST /today/check-ins 응답 — needsFailureTags=true 면 S18(실패 사유)로 이동
export interface CheckInResponse {
  executionId: string;
  actionId: string;
  completionStatus: string;
  actualDurationMinutes: number | null;
  needsFailureTags: boolean;
}

// ── Reflection (S17·S18) — api-contract §11 (#19-B failure-tags 구현, batch 는 501) ──
// 13종 실패 태그 (api-contract §11)
export type FailureTagCode =
  | 'TIME_SHORTAGE'
  | 'LOW_ENERGY'
  | 'HARD_TO_START'
  | 'PRIORITY_SHIFT'
  | 'PLAN_TOO_BIG'
  | 'FATIGUE'
  | 'AMBIGUITY'
  | 'CONFLICT'
  | 'OVERRUN'
  | 'AVOIDANCE'
  | 'DISTRACTION'
  | 'EMERGENCY'
  | 'CONTEXT_LOSS';

// GET /reflection/failure-tags 응답 row (#19-B 구현)
export interface FailureTagMaster {
  tagCode: FailureTagCode | string;
  labelKo: string;
  description: string | null;
  sortOrder: number;
}

// POST /reflection/failure-tags/{executionId} 요청 — 0~2개. memo 는 서버 암호화
export interface FailureTagRequest {
  tagCodes: Array<FailureTagCode | string>;
  memo?: string;
}

export interface FailureTagResponse {
  executionId: string;
  tagCodes: string[];
  hasMemo: boolean;
}

export interface ReflectionPendingItem {
  executionId: string;
  actionItemId: string;
  title: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string | null;
  completionStatus: CompletionStatus | null;
}

export interface ReflectionBatchRequest {
  items: Array<{
    executionId: string;
    completionStatus: CompletionStatus;
    failureTags?: FailureTagCode[];
    memoEncrypted?: string;
  }>;
}

// ── Recovery / Replan (S19·S20) — api-contract §12 (#20-A 구현, replan 은 501) ──
export type RecoveryGroup = 'DOWNSCOPE' | 'RESCHEDULE' | 'CARRY_OVER' | 'PARK';

export type RecoveryStrategyCode =
  | 'NANO_STEP'
  | 'DOWNSCOPE_DEFAULT'
  | 'ENVIRONMENT_SHIFT'
  | 'CONTEXT_REWARMING'
  | 'RESCHEDULE_DEFAULT'
  | 'ACTIVE_RECOVERY'
  | 'CARRYOVER_DEFAULT'
  | 'FREEZE_SLOT'
  | 'PARK_DEFAULT';

// POST /recovery/proposals/generate 응답 (#20-A 구현) — Draft Layer
export interface RecoveryCard {
  attemptId: string; // rec_<uuid>
  optionGroup: RecoveryGroup;
  strategyType: RecoveryStrategyCode | string;
  labelKo: string;
  suggestedActionText: string;
  minRecoveryUnitMinutes: number;
  allowRestMode: boolean;
  triggerTag: string | null;
}

export interface RecoveryProposalsResponse {
  executionId: string;
  cards: RecoveryCard[];
  isDraft: boolean;
  aiSource: 'llm' | 'rule';
}

// POST /recovery/decisions 요청 (#20-A) — Idempotency-Key 필수
export interface RecoveryDecisionRequest {
  executionId: string;
  decision: 'accepted' | 'skipped';
  acceptedAttemptId?: string;
  decisionReason?: string;
}

export interface RecoveryDecisionResponse {
  executionId: string;
  acceptedAttemptId: string | null;
  rejectedAttemptIds: string[];
  skippedAttemptIds: string[];
  resultingActionItemId: string | null; // action_<uuid> (DOWNSCOPE/CARRY_OVER 수락 시)
  isDraft: boolean;
}

export interface ReplanDiffBlock {
  blockId: string;
  title: string;
  scheduledTime: string | null;
  durationMinutes: number;
  carryover?: boolean;
}

export interface ReplanDiff {
  executionId: string;
  beforeBlocks: ReplanDiffBlock[];
  afterBlocks: ReplanDiffBlock[];
  summary: string;
}

// ── Plans (S06·S14·S15·S16) — 백엔드 501. api-contract §8 추정 ──
export type WorkloadLevel = 'easy' | 'medium' | 'heavy';

export interface PlanScheduledBlock {
  blockId: string;
  actionItemId: string | null;
  title: string;
  scheduledTime: string; // KST ISO 또는 HH:MM
  durationMinutes: number;
  goalId: string | null;
  fixed?: boolean;
  carryover?: boolean;
}

export interface PlanActionItem {
  actionItemId: string;
  title: string;
  goalId: string | null;
  estimatedMinutes?: number;
}

export interface PlanWeek {
  weekStart: string; // YYYY-MM-DD (월요일)
  workloadLevel: WorkloadLevel;
  warnings: string[];
  actionItems: PlanActionItem[];
  scheduledBlocks: PlanScheduledBlock[];
}

export interface Plan {
  planId: string;
  horizonEnd: string; // YYYY-MM-DD
  weeks: PlanWeek[];
}

export interface WeeklyPlanResponse {
  weekStart: string;
  blocks: PlanScheduledBlock[];
  workloadLevel?: WorkloadLevel;
}

export interface PlanBlockUpdate {
  scheduledTime?: string;
  durationMinutes?: number;
  title?: string;
}

// ── Reviews (S21·S22) — 백엔드 501. api-contract §13 추정 ───────
export interface WeeklyReview {
  weekStart: string; // YYYY-MM-DD
  adherenceRate: number; // 0~100
  consistencyDays: number;
  resilienceRate: number;
  categorySuccessRate: Record<string, number>;
  peakWindow: string | null;  // 예: "21:00-22:00"
  drainWindow: string | null;
  policyUpdateCandidates: string[];
}

// ── Settings / Privacy (S23·S28) — 백엔드 501. api-contract §16 ──
export type Language = 'ko' | 'en' | string;

export interface UserSettings {
  toneMode: ToneMode;
  language: Language;
  timezone: string;
}

export interface ToneModeUpdateRequest {
  toneMode: ToneMode;
}

export interface AnonymizeRequest {
  confirmationToken: string;
}

export type ConsentType = 'marketing' | 'research' | 'analytics' | string;

export interface ConsentRecord {
  type: ConsentType;
  granted: boolean;
  grantedAt: string | null;
}

export interface ConsentUpdateRequest {
  type: ConsentType;
  granted: boolean;
}

// ── Web Push (S08·S25) ────────────────────────────────────────
export interface PushSubscribeRequest {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// ── 공통 에러 ─────────────────────────────────────────────────
export interface ApiErrorPayload {
  code: string;
  message: string;
  field: string | null;
  // KST ISO 8601 with offset (api-contract §1.5)
  server_time: string;
}
