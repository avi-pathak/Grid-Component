import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid';

function makeRows(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({ id: i, name: `n${i % 5}`, city: `c${i % 3}`, amount: i * 10 });
  }
  return rows;
}

const columns = [
  { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
  { binding: 'name', header: 'Name', width: 120 },
  { binding: 'city', header: 'City', width: 100 },
  { binding: 'amount', header: 'Amount', width: 110, dataType: 'Number' as const },
];

function makeGrid(host: HTMLElement): Grid {
  return new Grid(host, {
    columns,
    itemsSource: makeRows(60),
    allowFiltering: true,
    frozenColumns: 0,
  });
}

describe('state serialization', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('captures column order and widths', () => {
    const grid = makeGrid(host);
    grid.resizeColumn(1, 200);
    grid.moveColumn(0, 2);

    const snap = grid.toJSON();
    expect(snap.version).toBe(1);
    expect(snap.columns?.map((c) => c.binding)).toEqual(['name', 'city', 'id', 'amount']);
    expect(snap.columns?.find((c) => c.binding === 'name')?.width).toBe(200);
  });

  it('round-trips column order and width onto a fresh grid', () => {
    const a = makeGrid(host);
    a.resizeColumn(1, 200);
    a.moveColumn(0, 3);
    const snap = a.toJSON();
    a.dispose();

    const host2 = document.createElement('div');
    document.body.appendChild(host2);
    const b = makeGrid(host2);
    b.loadJSON(snap);

    const snap2 = b.toJSON();
    expect(snap2.columns).toEqual(snap.columns);
  });

  it('round-trips sort', () => {
    const grid = makeGrid(host);
    grid.sort('amount', false);
    const snap = grid.toJSON();
    expect(snap.sort).toEqual({ binding: 'amount', ascending: false });

    grid.sort('amount', null);
    grid.loadJSON(snap);
    expect(grid.toJSON().sort).toEqual({ binding: 'amount', ascending: false });
  });

  it('round-trips grouping and collapsed state', () => {
    const grid = makeGrid(host);
    grid.groupBy('name');
    grid.collapseAllGroups();

    const snap = grid.toJSON();
    expect(snap.groups).toEqual(['name']);
    expect(snap.collapsedGroups?.length).toBeGreaterThan(0);

    grid.clearGroups();
    grid.loadJSON(snap);

    const snap2 = grid.toJSON();
    expect(snap2.groups).toEqual(['name']);
    expect(snap2.collapsedGroups?.length).toBe(snap.collapsedGroups?.length);
  });

  it('round-trips frozen rows and columns', () => {
    const grid = makeGrid(host);
    grid.freezeColumns(2);
    grid.freezeRows(1);

    const snap = grid.toJSON();
    expect(snap.frozen).toEqual({ columns: 2, rows: 1 });

    grid.freezeColumns(0);
    grid.freezeRows(0);
    grid.loadJSON(snap);
    expect(grid.frozenColumns).toBe(2);
    expect(grid.frozenRows).toBe(1);
  });

  it('round-trips the active cell', () => {
    const grid = makeGrid(host);
    grid.select(4, 2);
    const snap = grid.toJSON();
    expect(snap.activeCell).toEqual({ row: 4, col: 2 });

    grid.select(0, 0);
    grid.loadJSON(snap);
    expect(grid.selectedCell).toEqual({ row: 4, col: 2 });
  });

  it('ignores a snapshot with the wrong version', () => {
    const grid = makeGrid(host);
    grid.freezeColumns(1);
    // @ts-expect-error testing a bad version
    grid.loadJSON({ version: 99, frozen: { columns: 3, rows: 0 } });
    expect(grid.frozenColumns).toBe(1);
  });
});
