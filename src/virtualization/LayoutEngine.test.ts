import { describe, it, expect } from 'vitest';
import { LayoutEngine } from './LayoutEngine';
import { Column } from '../models/Column';

const columns = [
  new Column({ binding: 'a', width: 60 }),
  new Column({ binding: 'b', width: 120 }),
  new Column({ binding: 'c', width: 100 }),
];

describe('LayoutEngine totals and offsets', () => {
  it('computes totals from row height and column widths', () => {
    const layout = new LayoutEngine(1000, 24, columns);
    expect(layout.totalHeight).toBe(24000);
    expect(layout.totalWidth).toBe(280);
  });

  it('returns row tops and column lefts', () => {
    const layout = new LayoutEngine(1000, 24, columns);
    expect(layout.getRowTop(10)).toBe(240);
    expect(layout.getColLeft(0)).toBe(0);
    expect(layout.getColLeft(1)).toBe(60);
    expect(layout.getColLeft(2)).toBe(180);
    expect(layout.getColWidth(1)).toBe(120);
  });
});

describe('getVisibleRows', () => {
  it('locates the range at the top', () => {
    const layout = new LayoutEngine(1000, 24, columns);
    expect(layout.getVisibleRows(0, 480)).toEqual({ first: 0, last: 19 });
  });

  it('locates the range after scrolling', () => {
    const layout = new LayoutEngine(1000, 24, columns);
    // scrollTop 240 = exactly row 10
    expect(layout.getVisibleRows(240, 480)).toEqual({ first: 10, last: 29 });
  });

  it('clamps the last row at the end of the data', () => {
    const layout = new LayoutEngine(20, 24, columns);
    const range = layout.getVisibleRows(10000, 480);
    expect(range.last).toBe(19);
  });

  it('handles a million rows without iterating', () => {
    const layout = new LayoutEngine(1_000_000, 24, columns);
    expect(layout.getVisibleRows(24_000_000 - 480, 480)).toEqual({
      first: 999_980,
      last: 999_999,
    });
  });

  it('returns an empty range with no rows', () => {
    const layout = new LayoutEngine(0, 24, columns);
    expect(layout.getVisibleRows(0, 480)).toEqual({ first: 0, last: -1 });
  });
});

describe('getVisibleCols', () => {
  it('locates columns by their cumulative left edges', () => {
    const layout = new LayoutEngine(10, 24, columns);
    // viewport 0..150 spans column 0 (0-60) and column 1 (60-180)
    expect(layout.getVisibleCols(0, 150)).toEqual({ first: 0, last: 1 });
  });

  it('finds the column containing a scrolled-to offset', () => {
    const layout = new LayoutEngine(10, 24, columns);
    expect(layout.getVisibleCols(70, 50)).toEqual({ first: 1, last: 1 });
  });
});

describe('point lookups', () => {
  it('maps a y offset to a row', () => {
    const layout = new LayoutEngine(1000, 24, columns);
    expect(layout.rowAtY(0)).toBe(0);
    expect(layout.rowAtY(25)).toBe(1);
    expect(layout.rowAtY(1_000_000)).toBe(999); // clamped to the last row
  });

  it('maps an x offset to a column', () => {
    const layout = new LayoutEngine(10, 24, columns);
    expect(layout.colAtX(0)).toBe(0);
    expect(layout.colAtX(70)).toBe(1); // 60..180 is column 1
    expect(layout.colAtX(200)).toBe(2); // clamped to the last column
  });
});
