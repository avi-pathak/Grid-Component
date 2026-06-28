import { describe, it, expect } from 'vitest';
import { DataView } from './DataView';

describe('DataView', () => {
  it('reports length and reads items by index', () => {
    const view = new DataView([{ id: 1 }, { id: 2 }]);
    expect(view.length).toBe(2);
    expect(view.item(1)).toEqual({ id: 2 });
  });

  it('replaces items with setItems', () => {
    const view = new DataView<{ id: number }>([]);
    view.setItems([{ id: 9 }]);
    expect(view.length).toBe(1);
    expect(view.item(0).id).toBe(9);
  });
});
