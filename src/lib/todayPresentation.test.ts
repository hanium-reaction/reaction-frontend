import { describe, expect, it } from 'vitest';
import { todayPresentation } from './todayPresentation';
import type { Task } from '../types';
const task = (status: Task['status'], extra: Partial<Task> = {}): Task => ({ id: '1', title: '시험 준비', status, ...extra });
describe('todayPresentation', () => {
  it('distinguishes first use, normal, partial and completed states', () => {
    expect(todayPresentation([]).mode).toBe('empty');
    expect(todayPresentation([task('todo')]).mode).toBe('ready');
    expect(todayPresentation([task('partial_done')]).mode).toBe('restart');
    expect(todayPresentation([task('done')]).mode).toBe('done');
  });
  it('offers review for unchecked work without claiming a missed login', () => {
    expect(todayPresentation([task('todo', { missedCheckIn: true })]).mode).toBe('restart');
    expect(todayPresentation([task('done', { missedCheckIn: true })]).mode).toBe('done');
  });
  it('keeps active execution first and ignores fixed tasks for replan', () => {
    expect(todayPresentation([task('in_progress'), task('failed')]).mode).toBe('active');
    expect(todayPresentation([task('failed', { fixed: true })]).mode).toBe('ready');
  });
});
