import { describe, it, expect, vi, afterEach } from 'vitest';
import { Column } from '../models/Column';
import { buildColumnGroups, buildColumnGroupLayout } from './buildColumnGroups';

function cols(...bindings: string[]): Column[] {
  return bindings.map((binding) => new Column({ binding }));
}

describe('buildColumnGroups (tree resolve)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds a flat group from string shorthand (back-compat)', () => {
    const groups = buildColumnGroups(cols('name', 'ytd', 'm1'), [
      { header: 'Perf', columns: ['ytd', 'm1'] },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].header).toBe('Perf');
    expect(groups[0].leafBindings()).toEqual(['ytd', 'm1']);
    expect(groups[0].depth()).toBe(1);
  });

  it('builds a nested tree of groups and leaves', () => {
    const groups = buildColumnGroups(cols('stock', 'bond', 'cash', 'other', 'amount'), [
      {
        header: 'Allocation',
        columns: ['stock', 'bond', { header: 'Detail', columns: ['cash', 'other'] }, 'amount'],
      },
    ]);
    const alloc = groups[0];
    expect(alloc.depth()).toBe(2);
    expect(alloc.leafBindings()).toEqual(['stock', 'bond', 'cash', 'other', 'amount']);
    const detail = alloc.children.find((c) => c.kind === 'group');
    expect(detail).toBeDefined();
  });

  it('drops unknown leaf bindings with a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const groups = buildColumnGroups(cols('a'), [{ header: 'G', columns: ['a', 'bogus'] }]);
    expect(groups[0].leafBindings()).toEqual(['a']);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('drops a group with no surviving leaves', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const groups = buildColumnGroups(cols('a'), [{ header: 'Empty', columns: ['bogus'] }]);
    expect(groups).toHaveLength(0);
  });

  it('claims each binding once, even across nesting', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const groups = buildColumnGroups(cols('a', 'b'), [
      { header: 'Outer', columns: ['a', { header: 'Inner', columns: ['a', 'b'] }] },
    ]);
    // 'a' is claimed by the outer leaf, so the inner group only keeps 'b'.
    expect(groups[0].leafBindings()).toEqual(['a', 'b']);
  });

  it('resolves collapseTo against descendant leaves at any depth', () => {
    const groups = buildColumnGroups(cols('stock', 'cash', 'other'), [
      {
        header: 'Allocation',
        collapseTo: 'cash',
        columns: ['stock', { header: 'Detail', columns: ['cash', 'other'] }],
      },
    ]);
    expect(groups[0].collapseTo).toBe('cash');
  });

  it('defaults collapseTo to the first descendant leaf', () => {
    const groups = buildColumnGroups(cols('stock', 'cash'), [
      { header: 'Allocation', columns: ['stock', { header: 'Detail', columns: ['cash'] }] },
    ]);
    expect(groups[0].collapseTo).toBe('stock');
  });
});

describe('buildColumnGroupLayout', () => {
  it('returns no rows when there are no groups', () => {
    expect(buildColumnGroupLayout(cols('a', 'b'), [])).toEqual({
      rows: 0,
      cells: [],
      leafHeaderCols: new Set(),
    });
  });

  it('lays out a single-level group with full-height fillers for ungrouped columns', () => {
    const columns = cols('name', 'ytd', 'm1');
    const groups = buildColumnGroups(columns, [{ header: 'Perf', columns: ['ytd', 'm1'] }]);
    const layout = buildColumnGroupLayout(columns, groups);
    expect(layout.rows).toBe(1);
    // name → leaf-header cell; ytd+m1 → one Perf cell.
    expect(layout.cells).toEqual([
      { group: null, startCol: 0, endCol: 0, row: 0, rowSpan: 1, leafCol: 0, key: 'leaf@0:0' },
      { group: groups[0], startCol: 1, endCol: 2, row: 0, rowSpan: 1, key: 'perf@0:1' },
    ]);
    expect(layout.leafHeaderCols).toEqual(new Set([0]));
  });

  it('lays out two header rows with a rowspan filler for a shallow leaf', () => {
    // Allocation spans [stock, (Detail: cash, other), amount] → depth 2.
    const columns = cols('stock', 'cash', 'other', 'amount');
    const groups = buildColumnGroups(columns, [
      {
        header: 'Allocation',
        columns: ['stock', { header: 'Detail', columns: ['cash', 'other'] }, 'amount'],
      },
    ]);
    const layout = buildColumnGroupLayout(columns, groups);
    expect(layout.rows).toBe(2);

    // Row 0: one Allocation cell spanning all four columns.
    const row0 = layout.cells.filter((c) => c.row === 0);
    expect(row0).toHaveLength(1);
    expect(row0[0].group?.header).toBe('Allocation');
    expect(row0[0].startCol).toBe(0);
    expect(row0[0].endCol).toBe(3);

    // Row 1: stock (rowspan filler), Detail cell over cash+other, amount (rowspan filler).
    const row1 = layout.cells.filter((c) => c.row === 1);
    const detail = row1.find((c) => c.group?.header === 'Detail')!;
    expect(detail.startCol).toBe(1);
    expect(detail.endCol).toBe(2);
    const stockFiller = row1.find((c) => c.startCol === 0)!;
    expect(stockFiller.group).toBeNull();
    expect(stockFiller.rowSpan).toBe(1); // already at bottom row
  });

  it('gives a top-level ungrouped column a filler that spans every header row', () => {
    const columns = cols('name', 'cash', 'other');
    const groups = buildColumnGroups(columns, [
      { header: 'Detail', columns: [{ header: 'Sub', columns: ['cash', 'other'] }] },
    ]);
    const layout = buildColumnGroupLayout(columns, groups);
    expect(layout.rows).toBe(2);
    const nameFiller = layout.cells.find((c) => c.startCol === 0 && c.group === null)!;
    expect(nameFiller.row).toBe(0);
    expect(nameFiller.rowSpan).toBe(2); // spans both header rows
  });
});
