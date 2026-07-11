import { describe, it, expect } from 'vitest';
import { GridViewport } from './GridViewport';
import { GridState } from './GridState';
import { LayoutEngine } from '../virtualization/LayoutEngine';
import { Column } from '../models/Column';

const columns = [
  new Column({ binding: 'a', width: 100 }),
  new Column({ binding: 'b', width: 100 }),
  new Column({ binding: 'c', width: 100 }),
];

function setup(rowCount = 1000) {
  const state = new GridState();
  const layout = new LayoutEngine(rowCount, 24, columns);
  const viewport = new GridViewport(state, layout);
  viewport.setSize(300, 480);
  return { state, viewport };
}

describe('GridViewport', () => {
  it('writes a buffered visible range into state', () => {
    const { state, viewport } = setup();
    viewport.update(240, 0); // row 10 at the top

    // visible rows 10..29, padded by the row buffer
    expect(state.firstRow).toBe(2);
    expect(state.lastRow).toBe(37);
    expect(state.scrollTop).toBe(240);
  });

  it('does not let the buffer run past the data', () => {
    const { state, viewport } = setup();
    viewport.update(0, 0);
    expect(state.firstRow).toBe(0);
  });

  it('reports whether the range changed', () => {
    const { viewport } = setup();
    viewport.setSize(300, 470); // not a multiple of the row height, so there's slack
    expect(viewport.update(0, 0)).toBe(true);
    expect(viewport.update(5, 0)).toBe(false); // still the same row window
    expect(viewport.update(240, 0)).toBe(true); // new rows
  });
});
