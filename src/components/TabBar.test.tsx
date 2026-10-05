import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MergedTabBar } from "./TabBar";
it("목표는 전용 화면으로 이동하고 기존 오늘 탭을 활성으로 표시하지 않는다", () => {
  const change = vi.fn(),
    goals = vi.fn();
  render(
    <MergedTabBar
      active="today"
      screen="goals"
      onChange={change}
      onGoals={goals}
    />,
  );
  expect(screen.getByRole("button", { name: "목표" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("button", { name: "오늘" })).not.toHaveAttribute(
    "aria-current",
  );
  fireEvent.click(screen.getByRole("button", { name: "목표" }));
  expect(goals).toHaveBeenCalledOnce();
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "주간" }));
  expect(change).toHaveBeenCalledWith("weekly");
});
it("주간 리뷰에서도 주간 탭을 유지한다", () => {
  render(
    <MergedTabBar
      active="weekly"
      screen="review"
      onChange={vi.fn()}
      onGoals={vi.fn()}
    />,
  );
  expect(screen.getByRole("button", { name: "주간" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});
