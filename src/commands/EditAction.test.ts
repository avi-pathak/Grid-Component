import { describe, it, expect } from 'vitest';
import { EditAction } from './EditAction';
import { DataView } from '../data/DataView';
import { Column } from '../models/Column';

describe('EditAction', () => {
  it('swaps old and new values on undo and redo', () => {
    const data = new DataView([{ sales: 100 }]);
    const col = new Column({ binding: 'sales', editable: true });
    let applied = 0;
    const a = new EditAction(data, col, 0, 100, 250, () => applied++);

    a.redo();
    expect(data.item(0).sales).toBe(250);
    a.undo();
    expect(data.item(0).sales).toBe(100);
    expect(applied).toBe(2);
  });
});
