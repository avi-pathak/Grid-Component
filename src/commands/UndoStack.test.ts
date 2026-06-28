import { describe, it, expect, vi } from 'vitest';
import { UndoStack } from './UndoStack';

function action() {
  return { undo: vi.fn(), redo: vi.fn() };
}

describe('UndoStack', () => {
  it('starts with nothing to undo or redo', () => {
    const s = new UndoStack();
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
  });

  it('undoes and redoes in order', () => {
    const s = new UndoStack();
    const a = action();
    s.push(a);
    expect(s.canUndo).toBe(true);
    s.undo();
    expect(a.undo).toHaveBeenCalledOnce();
    expect(s.canRedo).toBe(true);
    s.redo();
    expect(a.redo).toHaveBeenCalledOnce();
  });

  it('discards the redo branch on a new push', () => {
    const s = new UndoStack();
    s.push(action());
    s.undo();
    expect(s.canRedo).toBe(true);
    s.push(action());
    expect(s.canRedo).toBe(false);
  });

  it('does not record actions applied during undo/redo', () => {
    const s = new UndoStack();
    s.push({ undo: () => s.push(action()), redo: () => {} });
    s.undo();
    expect(s.actionCount).toBe(1);
  });

  it('caps the history at maxActions', () => {
    const s = new UndoStack(2);
    s.push(action());
    s.push(action());
    s.push(action());
    expect(s.actionCount).toBe(2);
  });

  it('fires onStateChanged', () => {
    const s = new UndoStack();
    const cb = vi.fn();
    s.onStateChanged = cb;
    s.push(action());
    expect(cb).toHaveBeenCalled();
  });
});
