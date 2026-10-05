import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { GoalCard } from './GoalCard';
import { InboxAction, InboxItemCard } from './InboxItemCard';

it('목표 카드를 키보드로 열고 펼침 상태를 알린다', async () => {
  const onToggle = vi.fn();
  render(<GoalCard title="이번 학기 목표" tier="focus" onToggle={onToggle} expanded><button>수정</button></GoalCard>);
  const toggle = screen.getByRole('button', { name: /이번 학기 목표/ });
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  toggle.focus();
  await userEvent.keyboard('{Enter}');
  expect(onToggle).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: '수정' }));
  expect(onToggle).toHaveBeenCalledTimes(1);
});

it('인박스 처리 버튼은 자료 열기를 실행하지 않는다', async () => {
  const open = vi.fn();
  const archive = vi.fn();
  render(<InboxItemCard text="읽어볼 자료" onOpen={open} actions={<InboxAction onClick={archive}>보관</InboxAction>} />);
  await userEvent.click(screen.getByRole('button', { name: '보관' }));
  expect(archive).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
  screen.getByRole('button', { name: /읽어볼 자료/ }).focus();
  await userEvent.keyboard('{Enter}');
  expect(open).toHaveBeenCalledTimes(1);
});
