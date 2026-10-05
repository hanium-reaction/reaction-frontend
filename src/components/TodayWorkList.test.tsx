import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TodayWorkList, type WorkListItem } from './TodayWorkList';
const items: WorkListItem[] = [
  { task: { id: 'a', title: 'Read chapters', status: 'todo', firstStep: 'Open the book' }, goalLabel: '자격시험' },
  { task: { id: 'b', title: '진행하는 작업', status: 'in_progress' } },
  { task: { id: 'c', title: '멈춘 작업', status: 'failed', failReason: '시간 부족' } },
  { task: { id: 'd', title: '일부 작업', status: 'partial_done' } },
  { task: { id: 'e', title: '대기 작업', status: 'recovery_pending' } },
  { task: { id: 'f', title: '마친 작업', status: 'done' } },
];
const callbacks = () => ({ onDetail: vi.fn(), onRecovery: vi.fn() });
describe('TodayWorkList', () => {
  it('does not offer replanning for a fixed event', () => {
    render(<TodayWorkList items={[{ task: { ...items[2].task, fixed: true } }]} {...callbacks()} />);
    document.querySelector('details')!.open = true;
    expect(screen.queryByRole('button', { name: '다음 행동 다시 정하기' })).not.toBeInTheDocument();
  });
  it('six server statuses map to disjoint groups without losing active work', () => {
    render(<TodayWorkList items={items} {...callbacks()} />);
    const filters = within(screen.getByRole('group', { name: '작업 상태 필터' }));
    expect(filters.getByRole('button', { name: '전체 6' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(filters.getByRole('button', { name: '예정 2' }));
    expect(document.querySelectorAll('details')).toHaveLength(2);
    expect(screen.getByText('진행하는 작업')).toBeInTheDocument();
    fireEvent.click(filters.getByRole('button', { name: '재계획 3' }));
    expect(document.querySelectorAll('details')).toHaveLength(3);
    expect(screen.queryByText('마친 작업')).not.toBeInTheDocument();
    fireEvent.click(filters.getByRole('button', { name: '완료 1' }));
    expect(document.querySelectorAll('details')).toHaveLength(1);
    expect(screen.getByText('마친 작업')).toBeInTheDocument();
  });
  it('searches title and goal without changing status totals and can reset empty results', () => {
    render(<TodayWorkList items={items} {...callbacks()} />);
    const input = screen.getByRole('searchbox', { name: '작업 또는 목표 검색' });
    fireEvent.change(input, { target: { value: '  CHAPTERS  ' } });
    expect(document.querySelectorAll('details')).toHaveLength(1);
    fireEvent.change(input, { target: { value: '자격시험' } });
    expect(screen.getByText('Read chapters')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '완료 1' }));
    expect(screen.getByText('검색 조건에 맞는 작업이 없어요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '전체 작업 보기' }));
    expect(input).toHaveValue('');
    expect(document.querySelectorAll('details')).toHaveLength(6);
  });
  it('preview does not start, complete, or navigate; explicit buttons receive the same id', () => {
    const props = callbacks();
    render(<TodayWorkList items={[items[2]]} {...props} />);
    fireEvent.click(screen.getByText('멈춘 작업').closest('summary')!);
    expect(props.onDetail).not.toHaveBeenCalled();
    expect(props.onRecovery).not.toHaveBeenCalled();
    const detail = document.querySelector('details')!;
    detail.open = true;
    fireEvent.click(screen.getByRole('button', { name: '계획 자세히' }));
    fireEvent.click(screen.getByRole('button', { name: '다음 행동 다시 정하기' }));
    expect(props.onDetail).toHaveBeenCalledWith('c');
    expect(props.onRecovery).toHaveBeenCalledWith('c');
  });
  it('weekly fallback remains read-only', () => {
    const props = callbacks();
    render(<TodayWorkList items={[items[2]]} interactive={false} {...props} />);
    document.querySelector('details')!.open = true;
    for (const name of ['계획 자세히', '다음 행동 다시 정하기']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name }));
    }
    expect(props.onDetail).not.toHaveBeenCalled(); expect(props.onRecovery).not.toHaveBeenCalled();
  });
  it('reflects status updates and a removed item while keeping the selected filter', () => {
    const props = callbacks();
    const { rerender } = render(<TodayWorkList items={items} {...props} />);
    fireEvent.click(screen.getByRole('button', { name: '완료 1' }));
    rerender(<TodayWorkList items={[{ task: { ...items[0].task, status: 'done' } }]} {...props} />);
    expect(screen.getByText('Read chapters')).toBeInTheDocument();
    expect(screen.queryByText('마친 작업')).not.toBeInTheDocument();
    expect(document.querySelectorAll('details')).toHaveLength(1);
  });
});
