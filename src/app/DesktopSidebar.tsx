import {
  House,
  CalendarBlank,
  Tray,
  Gear,
  Target,
} from "@phosphor-icons/react";
import { Wordmark } from "../components/Wordmark";
import { useNavigation } from "../contexts/NavigationContext";
import type { ScreenId } from "../types";
const destinations = [
  { id: "today", label: "오늘", Icon: House },
  { id: "weekly", label: "주간 계획", Icon: CalendarBlank },
  { id: "goals", label: "나의 목표", Icon: Target },
  { id: "inbox", label: "인박스", Icon: Tray },
] as const;
const workspaceScreens: ScreenId[] = [
  "today",
  "weekly",
  "review",
  "goals",
  "inbox",
  "settings",
  "my-info",
  "mandala",
];
export function DesktopSidebar() {
  const { screen, setScreen, setTab, setWeekOffset } = useNavigation();
  const showNav = workspaceScreens.includes(screen);
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-brand">
        <span className="workspace-logo" aria-hidden>
          ↗
        </span>
        <Wordmark size={21} />
      </div>
      {showNav ? (
        <div>
          <p className="workspace-label">내 워크스페이스</p>
          <nav aria-label="주요 화면">
            {destinations.map(({ id, label, Icon }) => (
              <button
                key={id}
                className="workspace-nav-item"
                aria-current={
                  screen === id || (id === "weekly" && screen === "review")
                    ? "page"
                    : undefined
                }
                onClick={() => {
                  if (id === "weekly") setWeekOffset(0);
                  if (id !== "goals") setTab(id);
                  setScreen(id);
                }}
              >
                <Icon size={21} weight={screen === id ? "fill" : "regular"} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      ) : (
        <div className="workspace-sidebar-note">
          <strong>나에게 맞는 계획 찾기</strong>
          <p>목표와 생활 패턴을 살펴보고, 실행할 수 있는 크기로 나눠요.</p>
        </div>
      )}
      <div className="workspace-sidebar-footer">
        {showNav && (
          <button
            className="workspace-nav-item"
            aria-current={screen === "settings" ? "page" : undefined}
            onClick={() => setScreen("settings")}
          >
            <Gear size={21} />
            설정
          </button>
        )}
        <p className="workspace-sidebar-note">
          계획이 달라져도,
          <br />
          다음 행동은 이어지도록.
        </p>
      </div>
    </aside>
  );
}
