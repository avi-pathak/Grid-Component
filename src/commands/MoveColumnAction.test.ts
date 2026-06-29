import { describe, it, expect, vi } from 'vitest';
import { MoveColumnAction, moveColumn } from './MoveColumnAction';
import { Column } from '../models/Column';

function cols(...names: string[]): Column[] {
  return names.map((n) => new Column({ binding: n, header: n }));
}

const order = (c: Column[]) => c.map((x) => x.header);

describe('moveColumn', () => {
  it('moves an item forward', () => {
    const c = cols('A', 'B', 'C', 'D');
    moveColumn(c, 0, 2);
    expect(order(c)).toEqual(['B', 'C', 'A', 'D']);
  });

  it('moves an item backward', () => {
    const c = cols('A', 'B', 'C', 'D');
    moveColumn(c, 3, 1);
    expect(order(c)).toEqual(['A', 'D', 'B', 'C']);
  });
});

describe('MoveColumnAction', () => {
  it('redoes and undoes a move', () => {
    const c = cols('A', 'B', 'C');
    const onApplied = vi.fn();
    const action = new MoveColumnAction(c, 0, 2, onApplied);

    action.redo();
    expect(order(c)).toEqual(['B', 'C', 'A']);
    action.undo();
    expect(order(c)).toEqual(['A', 'B', 'C']);
    expect(onApplied).toHaveBeenCalledTimes(2);
  });
});
