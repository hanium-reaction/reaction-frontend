import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { RestartCard } from './RestartCard';

it('미체크는 실패로 바꾸지 않고 선택한 항목의 확인으로 보낸다', () => {
  const review = vi.fn(), recovery = vi.fn();
  const tasks = [{ id: 'pending', title: '책 읽기', status: 'todo' as const, missedCheckIn: true }, { id: 'partial', title: '보고서', status: 'partial_done' as const }];
  render(<RestartCard tasks={tasks} onReview={review} onRecovery={recovery} />);
  expect(screen.getByText('결과 확인 대기')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /이 항목부터 확인하기/ }));
  expect(review).toHaveBeenCalledWith('pending');
  expect(recovery).not.toHaveBeenCalled();
  expect(tasks[0].status).toBe('todo');
  fireEvent.change(screen.getByLabelText(/다시 살펴볼 항목/), { target: { value: 'partial' } });
  fireEvent.click(screen.getByRole('button', { name: /다시 시작할 방법 보기/ }));
  expect(recovery).toHaveBeenCalledWith('partial');
});
it('완료 또는 고정 일정만 있으면 복귀를 유도하지 않는다', () => {
  const { container } = render(<RestartCard tasks={[{ id: 'done', title: '완료', status: 'done' }, { id: 'fixed', title: '수업', status: 'todo', fixed: true }]} onReview={vi.fn()} onRecovery={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});
it('선택한 항목이 사라지면 실제 남아 있는 항목을 선택한다', () => {
  const review = vi.fn();
  const props = { onReview: review, onRecovery: vi.fn() };
  const { rerender } = render(<RestartCard {...props} tasks={[{ id: 'one', title: '첫째', status: 'todo', missedCheckIn: true }]} />);
  rerender(<RestartCard {...props} tasks={[{ id: 'two', title: '둘째', status: 'todo', missedCheckIn: true }]} />);
  fireEvent.click(screen.getByRole('button', { name: /이 항목부터 확인하기/ }));
  expect(review).toHaveBeenCalledWith('two');
});
it('일반 예정 항목만 있으면 다시 시작 카드를 표시하지 않는다', () => {
  const { container } = render(<RestartCard tasks={[{ id: 'future', title: '내일 공부', status: 'todo', scheduledAt: '2099-01-01T10:00:00+09:00' }]} onReview={vi.fn()} onRecovery={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});
