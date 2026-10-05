import { House, CalendarBlank, Tray, Target } from "@phosphor-icons/react";
import type { TabId, ScreenId } from "../types";
interface MergedTabBarProps {
  active: TabId;
  screen?: ScreenId;
  onChange: (tab: TabId) => void;
  onGoals?: () => void;
  dotTabs?: TabId[];
}
const tabs = [
  { id: "today", label: "오늘", Icon: House },
  { id: "weekly", label: "주간", Icon: CalendarBlank },
  { id: "goals", label: "목표", Icon: Target },
  { id: "inbox", label: "인박스", Icon: Tray },
] as const;
export function MergedTabBar({
  active,
  screen,
  onChange,
  onGoals,
  dotTabs = [],
}: MergedTabBarProps) {
  return (
    <nav className="workspace-bottom-nav" aria-label="주요 화면">
      {tabs
        .filter((t) => t.id !== "goals" || onGoals)
        .map(({ id, label, Icon }) => {
          const current = screen === "goals" ? id === "goals" : active === id;
          const dot = id !== "goals" && dotTabs.includes(id);
          return (
            <button
              key={id}
              aria-current={current ? "page" : undefined}
              aria-label={dot ? `${label} — 확인 안 한 작업 있음` : label}
              onClick={() => (id === "goals" ? onGoals?.() : onChange(id))}
            >
              <Icon size={22} weight={current ? "fill" : "regular"} />
              {label}
              {dot && <span className="workspace-nav-dot" aria-hidden />}
            </button>
          );
        })}
    </nav>
  );
}
