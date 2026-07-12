import { describe, it, expect } from 'vitest';
import { ColumnGroupRenderer } from './ColumnGroupRenderer';
import { RenderContext } from './RenderContext';
import { GridState } from '../core/GridState';
import { LayoutEngine } from '../virtualization/LayoutEngine';
import { DataView } from '../data/DataView';
import { Column } from '../models/Column';
import { ColumnGroup } from '../models/ColumnGroup';
import { buildColumnGroups } from '../data/buildColumnGroups';

const ROW_H = 24;

function makeColumns(): Column[] {
  return [
    new Column({ binding: 'name', header: 'Name', width: 100 }),
    new Column({ binding: 'ytd', header: 'YTD', width: 60 }),
    new Column({ binding: 'm1', header: '1 M', width: 60 }),
    new Column({ binding: 'm6', header: '6 M', width: 60 }),
    new Column({ binding: 'stocks', header: 'Stocks', width: 80 }),
  ];
}

function setup(columns: Column[], groups: ColumnGroup[], firstCol = 0, lastCol = 4) {
  const layout = new LayoutEngine(1, ROW_H, columns);
  const state = new GridState();
  state.firstCol = firstCol;
  state.lastCol = lastCol;
  const data = new DataView<Record<string, unknown>>([]);
  const ctx: RenderContext = { layout, columns, data, state, columnGroups: groups };

  const inner = document.createElement('div');
  const toggled: string[] = [];
  const renderer = new ColumnGroupRenderer(inner, (key) => toggled.push(key), ROW_H);
  return { inner, renderer, ctx, toggled, layout };
}

describe('ColumnGroupRenderer', () => {
  it('renders one span cell per group plus a tall leaf-header cell per ungrouped column', () => {
    const columns = makeColumns();
    const groups = buildColumnGroups(columns, [{ header: 'Perf', columns: ['ytd', 'm1', 'm6'] }]);
    const { inner, renderer, ctx } = setup(columns, groups);
    renderer.render(ctx);
    // name + stocks = 2 leaf-header cells, 1 Perf group = 3 cells.
    expect(inner.querySelectorAll('.apg-columngroup-cell').length).toBe(3);
    const leaves = inner.querySelectorAll('.apg-columngroup-cell.apg-columngroup-leaf');
    expect(leaves.length).toBe(2);
    // The leaf cell carries the real column header text.
    const names = [...leaves].map((el) => el.textContent);
    expect(names).toContain('Name');
    expect(names).toContain('Stocks');
  });

  it('sizes a group span to the sum of its leaf column widths', () => {
    const columns = makeColumns();
    const groups = buildColumnGroups(columns, [{ header: 'Perf', columns: ['ytd', 'm1', 'm6'] }]);
    const { inner, renderer, ctx } = setup(columns, groups);
    renderer.render(ctx);
    const group = inner.querySelector<HTMLElement>('[data-group="perf"]')!;
    expect(group.style.left).toBe('100px'); // after name(100)
    expect(group.style.width).toBe('180px'); // 60*3
  });

  it('positions and row-spans nested header cells', () => {
    // Allocation over [ytd, (Detail: m1, m6)] → depth 2.
    const columns = makeColumns();
    const groups = buildColumnGroups(columns, [
      {
        header: 'Allocation',
        columns: ['ytd', { header: 'Detail', columns: ['m1', 'm6'] }],
      },
    ]);
    const { inner, renderer, ctx } = setup(columns, groups, 0, 4);
    renderer.render(ctx);

    const alloc = inner.querySelector<HTMLElement>('[data-group="allocation"]')!;
    expect(alloc.style.top).toBe('0px');
    expect(alloc.style.height).toBe(`${ROW_H}px`);

    const detail = inner.querySelector<HTMLElement>('[data-group="detail"]')!;
    expect(detail.style.top).toBe(`${ROW_H}px`); // second header row
    expect(detail.style.height).toBe(`${ROW_H}px`);

    // A top-level ungrouped column (name) is drawn as one cell spanning both
    // header rows, carrying its own header text.
    const nameCell = [
      ...inner.querySelectorAll<HTMLElement>('.apg-columngroup-cell.apg-columngroup-leaf'),
    ].find((el) => el.style.left === '0px')!;
    expect(nameCell.style.height).toBe(`${ROW_H * 2}px`);
    expect(nameCell.textContent).toContain('Name');
  });

  it('shows the header text and a chevron when collapsible', () => {
    const columns = makeColumns();
    const groups = buildColumnGroups(columns, [{ header: 'Perf', columns: ['ytd', 'm1'] }]);
    const { inner, renderer, ctx } = setup(columns, groups);
    renderer.render(ctx);
    const group = inner.querySelector<HTMLElement>('[data-group="perf"]')!;
    expect(group.textContent).toContain('Perf');
    expect(group.querySelector('.apg-columngroup-chevron')).not.toBeNull();
    expect(group.classList.contains('apg-collapsible')).toBe(true);
  });

  it('omits the chevron for a non-collapsible group', () => {
    const columns = makeColumns();
    const groups = buildColumnGroups(columns, [
      { header: 'Perf', columns: ['ytd', 'm1'], collapsible: false },
    ]);
    const { inner, renderer, ctx } = setup(columns, groups);
    renderer.render(ctx);
    const group = inner.querySelector<HTMLElement>('[data-group="perf"]')!;
    expect(group.querySelector('.apg-columngroup-chevron')).toBeNull();
    expect(group.classList.contains('apg-collapsible')).toBe(false);
  });

  it('toggles the group when a collapsible cell is clicked', () => {
    const columns = makeColumns();
    const groups = buildColumnGroups(columns, [{ header: 'Perf', columns: ['ytd', 'm1'] }]);
    const { inner, renderer, ctx, toggled } = setup(columns, groups);
    renderer.render(ctx);
    inner.querySelector<HTMLElement>('[data-group="perf"]')!.click();
    expect(toggled).toEqual(['perf']);
  });

  it('toggles a nested group when its cell is clicked', () => {
    const columns = makeColumns();
    const groups = buildColumnGroups(columns, [
      { header: 'Allocation', columns: ['ytd', { header: 'Detail', columns: ['m1', 'm6'] }] },
    ]);
    const { inner, renderer, ctx, toggled } = setup(columns, groups);
    renderer.render(ctx);
    inner.querySelector<HTMLElement>('[data-group="detail"]')!.click();
    expect(toggled).toEqual(['detail']);
  });

  it('does not toggle when a leaf-header cell is clicked', () => {
    const columns = makeColumns();
    const groups = buildColumnGroups(columns, [{ header: 'Perf', columns: ['ytd', 'm1'] }]);
    const { inner, renderer, ctx, toggled } = setup(columns, groups);
    renderer.render(ctx);
    inner.querySelector<HTMLElement>('.apg-columngroup-cell.apg-columngroup-leaf')!.click();
    expect(toggled).toEqual([]);
  });

  it('keeps the DOM bounded to the visible column window', () => {
    const many: Column[] = [];
    for (let i = 0; i < 200; i++) many.push(new Column({ binding: `c${i}`, width: 50 }));
    const groups = buildColumnGroups(many, [{ header: 'G', columns: ['c11', 'c12'] }]);
    const { inner, renderer, ctx } = setup(many, groups, 10, 20);
    renderer.render(ctx);
    // 11 visible columns → at most 11 cells (one group cell covering c11/c12,
    // the rest fillers) — bounded, not 200.
    expect(inner.querySelectorAll('.apg-columngroup-cell').length).toBeLessThanOrEqual(11);
  });

  it('clear() removes every cell from the DOM', () => {
    const columns = makeColumns();
    const groups = buildColumnGroups(columns, [{ header: 'Perf', columns: ['ytd', 'm1'] }]);
    const { inner, renderer, ctx } = setup(columns, groups);
    renderer.render(ctx);
    expect(inner.querySelectorAll('.apg-columngroup-cell').length).toBeGreaterThan(0);
    renderer.clear();
    expect(inner.querySelectorAll('.apg-columngroup-cell').length).toBe(0);
  });
});
