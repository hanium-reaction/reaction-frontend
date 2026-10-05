import React from "react";
import { ArrowUpRight, Clock, Play, Target } from "@phosphor-icons/react";
import type { Task } from "../types";
import { EmptyState } from "./EmptyState";
export interface HeroTaskCardProps {
  task: Task | null;
  done: number;
  total: number;
  time?: string;
  dur?: string;
  goalLabel?: string;
  goalColor?: { bg: string; bd: string; fg: string };
  onComplete: () => void;
  onPartial: () => void;
  onFail: () => void;
  onStart: (id: string) => void;
  startDisabled?: boolean;
  startLabel?: string;
  onDetail: () => void;
}
export function HeroTaskCard({
  task,
  time,
  dur,
  goalLabel,
  onStart,
  onFail,
  startDisabled = false,
  startLabel = "시작하기",
  onDetail,
}: HeroTaskCardProps) {
  if (!task)
    return (
      <EmptyState tone="hero" title="오늘 할 일이 없어요">
        주간 계획에서 블록을 추가해보세요.
      </EmptyState>
    );
  const active = task.status === "in_progress";
  const shownTime = time ?? task.time;
  const shownDur = dur ?? task.dur;
  return (
    <article className="execution-hero" aria-label="지금 집중할 일">
      <div className="execution-hero-heading">
        <span className="execution-hero-badge">
          <span aria-hidden>●</span> {active ? "진행 중인 일" : "다음 할 일"}
        </span>
        {shownTime && <span className="tnum">{shownTime} 시작</span>}
      </div>
      <h2>{task.title}</h2>
      <div className="execution-hero-meta">
        {shownDur && (
          <span>
            <Clock size={15} />
            {shownDur}
          </span>
        )}
        {goalLabel && (
          <span>
            <Target size={15} />
            {goalLabel}
          </span>
        )}
        {task.carryover && <span>이월된 계획</span>}
      </div>
      {task.firstStep && (
        <div className="execution-first-step">
          <strong>첫 행동</strong>
          {task.firstStep}
        </div>
      )}
      <button
        className="execution-start"
        disabled={!active && startDisabled}
        onClick={() => {
          if (active || !startDisabled) onStart(task.id);
        }}
        data-tour-help="집중 화면에서 시간을 재고, 실행 후 실제로 한 만큼 기록해요."
      >
        {(active || !startDisabled) && <Play size={17} weight="fill" />}
        {active ? "이어서 하기" : startLabel}
      </button>
      <div className="execution-secondary">
        <button onClick={onDetail}>
          계획 자세히 <ArrowUpRight size={12} style={{ display: "inline" }} />
        </button>
        {!startDisabled && (
          <button onClick={onFail}>계획대로 하기 어렵다면?</button>
        )}
      </div>
    </article>
  );
}
