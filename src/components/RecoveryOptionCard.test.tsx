import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RecoveryOptionCard } from './RecoveryOptionCard';

describe('회복 선택 카드의 독립된 조작', () => {
  it('설명을 열어도 선택을 저장하지 않는다', async () => {
    const onSelect = vi.fn(), onToggleWhy = vi.fn();
    const user = userEvent.setup();
    render(<RecoveryOptionCard title="10분만 하기" why="시작 부담을 줄여요" onSelect={onSelect} onToggleWhy={onToggleWhy} />);
    await user.click(screen.getByRole('button', { name: '왜?' }));
    expect(onToggleWhy).toHaveBeenCalledOnce();
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '10분만 하기' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('키보드로 선택하고 펼쳐진 설명을 읽을 수 있다', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<RecoveryOptionCard title="10분만 하기" selected why="시작 부담을 줄여요" whyOpen onSelect={onSelect} />);
    await user.tab();
    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '10분만 하기' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '왜?' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('시작 부담을 줄여요')).toBeVisible();
    expect(screen.queryByText(/성공률/)).not.toBeInTheDocument();
  });
});
