import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { HeroTaskCard } from "./HeroTaskCard";
const callbacks = () => ({
  onComplete: vi.fn(),
  onPartial: vi.fn(),
  onFail: vi.fn(),
  onStart: vi.fn(),
  onDetail: vi.fn(),
});
it("미래 계획은 디자인 개편 뒤에도 시작할 수 없다", () => {
  const props = callbacks();
  render(
    <HeroTaskCard
      {...props}
      task={{ id: "future", title: "내일 과제", status: "todo" }}
      done={0}
      total={1}
      startDisabled
      startLabel="예약 시각 후 시작"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "예약 시각 후 시작" }));
  expect(props.onStart).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "계획대로 하기 어렵다면?" }),
  ).not.toBeInTheDocument();
});
it("집중 진입과 결과 기록을 혼동하지 않는다", () => {
  const props = callbacks();
  render(
    <HeroTaskCard
      {...props}
      task={{
        id: "now",
        title: "과제",
        status: "todo",
        firstStep: "문서 열기",
      }}
      done={0}
      total={1}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "시작하기" }));
  expect(props.onStart).toHaveBeenCalledWith("now");
  expect(props.onComplete).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "계획대로 하기 어렵다면?" }),
  );
  expect(props.onFail).toHaveBeenCalledOnce();
  expect(screen.getByText("문서 열기")).toBeInTheDocument();
});
