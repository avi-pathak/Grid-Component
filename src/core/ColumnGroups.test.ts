import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid';

function makeRows(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({ name: `r${i}`, ytd: i, m1: i * 2, m6: i * 3, stocks: i * 4 });
  }
  return rows;
}

const columns = [
  { binding: 'name', header: 'Name', width: 100 },
  { binding: 'ytd', header: 'YTD', width: 60 },
  { binding: 'm1', header: '1 M', width: 60 },
  { binding: 'm6', header: '6 M', width: 60 },
  { binding: 'stocks', header: 'Stocks', width: 80 },
];

const perf = { header: 'Perf', columns: ['ytd', 'm1', 'm6'] };

describe('column groups', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('renders a group-header band above the leaf header when groups are configured', () => {
    new Grid(host, { columns, itemsSource: makeRows(20), columnGroups: [perf] });
    const band = host.querySelector('.apg-columngroup-inner');
    expect(band).not.toBeNull();
    const group = host.querySelector('.apg-columngroup-cell[data-group="perf"]');
    expect(group?.textContent).toContain('Perf');
  });

  it('does not create the band when there are no column groups', () => {
    new Grid(host, { columns, itemsSource: makeRows(20) });
    expect(host.querySelector('.apg-columngroup-inner')).toBeNull();
  });

  it('adds the group-header height to the top gutter', () => {
    new Grid(host, {
      columns,
      itemsSource: makeRows(10),
      rowHeight: 24,
      headerHeight: 28,
      groupHeaderRowHeight: 30,
      columnGroups: [perf],
    });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    // gutterTop = groupHeader 30 + leaf header 28 = 58; + 10 rows * 24 = 240
    expect(canvas.style.height).toBe('298px');
  });

  it('exposes the resolved groups via the columnGroups getter', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), columnGroups: [perf] });
    expect(grid.columnGroups.map((g) => g.key)).toEqual(['perf']);
  });

  it('keeps the collapseTo column visible and hides the rest when collapsed', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(20), columnGroups: [perf] });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    const fullWidth = canvas.style.width;

    grid.toggleColumnGroup('perf', true);
    // collapseTo defaults to the first member (ytd), so m1 + m6 (60 + 60 = 120)
    // are hidden and ytd stays visible.
    const collapsedWidth = parseInt(canvas.style.width, 10);
    expect(parseInt(fullWidth, 10) - collapsedWidth).toBe(120);

    grid.toggleColumnGroup('perf', false);
    expect(canvas.style.width).toBe(fullWidth);
  });

  it('keeps the group header (with its chevron) clickable while collapsed so it can expand', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(20), columnGroups: [perf] });
    grid.toggleColumnGroup('perf', true);
    const group = host.querySelector<HTMLElement>('.apg-columngroup-cell[data-group="perf"]');
    expect(group, 'group header still rendered when collapsed').not.toBeNull();
    expect(group!.classList.contains('apg-collapsible')).toBe(true);
    // Clicking it expands the group again.
    group!.click();
    expect(grid.columnGroups[0].collapsed).toBe(false);
  });

  it('honors an explicit collapseTo column', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(20),
      columnGroups: [{ header: 'Perf', columns: ['ytd', 'm1', 'm6'], collapseTo: 'm6' }],
    });
    grid.toggleColumnGroup('perf', true);
    // m6 stays visible; ytd + m1 hide.
    expect(grid.columnGroups[0].collapseTo).toBe('m6');
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    const collapsedWidth = parseInt(canvas.style.width, 10);
    grid.toggleColumnGroup('perf', false);
    expect(parseInt(canvas.style.width, 10) - collapsedWidth).toBe(120);
  });

  it('renders an ungrouped column as a single tall header in the band (no blank gap)', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(20), columnGroups: [perf] });
    grid.select(0, 0); // bring the first columns into the visible window
    // "Name" (ungrouped) shows as a leaf-header cell in the group band...
    const leafCells = [
      ...host.querySelectorAll<HTMLElement>('.apg-columngroup-cell.apg-columngroup-leaf'),
    ];
    expect(leafCells.some((el) => el.textContent?.includes('Name'))).toBe(true);
    // ...and is NOT duplicated in the leaf header row below.
    const leafRow = host.querySelector('.apg-header-inner') as HTMLElement;
    const names = [...leafRow.querySelectorAll('.apg-header-cell')].map((el) => el.textContent);
    expect(names).not.toContain('Name');
  });

  it('animation is off by default and toggles the host class', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), columnGroups: [perf] });
    expect(grid.columnGroupAnimation).toBe(false);
    expect(host.classList.contains('apg-animated')).toBe(false);
    grid.columnGroupAnimation = true;
    expect(host.classList.contains('apg-animated')).toBe(true);
    grid.columnGroupAnimation = false;
    expect(host.classList.contains('apg-animated')).toBe(false);
  });

  it('enables animation from the columnGroupAnimation option', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(5),
      columnGroups: [perf],
      columnGroupAnimation: true,
    });
    expect(grid.columnGroupAnimation).toBe(true);
    expect(host.classList.contains('apg-animated')).toBe(true);
    grid.dispose();
    expect(host.classList.contains('apg-animated')).toBe(false);
  });

  it('collapseTo: null hides every column in the group', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(20),
      columnGroups: [{ header: 'Perf', columns: ['ytd', 'm1', 'm6'], collapseTo: null }],
    });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    const fullWidth = parseInt(canvas.style.width, 10);
    grid.toggleColumnGroup('perf', true);
    // All three (60*3 = 180) hidden.
    expect(fullWidth - parseInt(canvas.style.width, 10)).toBe(180);
  });

  it('toggles collapse state when called without an explicit target', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), columnGroups: [perf] });
    expect(grid.columnGroups[0].collapsed).toBe(false);
    grid.toggleColumnGroup('perf');
    expect(grid.columnGroups[0].collapsed).toBe(true);
    grid.toggleColumnGroup('perf');
    expect(grid.columnGroups[0].collapsed).toBe(false);
  });

  it('emits columnGroupCollapsing (cancelable) and columnGroupCollapsedChanged', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), columnGroups: [perf] });
    const events: string[] = [];
    grid.on('columnGroupCollapsing', (e) => events.push(`ing:${e.key}:${e.collapsed}`));
    grid.on('columnGroupCollapsedChanged', (e) => events.push(`ed:${e.key}:${e.collapsed}`));
    grid.toggleColumnGroup('perf', true);
    expect(events).toEqual(['ing:perf:true', 'ed:perf:true']);
  });

  it('lets a columnGroupCollapsing handler cancel the toggle', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), columnGroups: [perf] });
    grid.on('columnGroupCollapsing', (e) => (e.cancel = true));
    grid.toggleColumnGroup('perf', true);
    expect(grid.columnGroups[0].collapsed).toBe(false);
  });

  it('does not toggle a non-collapsible group', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(5),
      columnGroups: [{ header: 'Perf', columns: ['ytd', 'm1'], collapsible: false }],
    });
    grid.toggleColumnGroup('perf', true);
    expect(grid.columnGroups[0].collapsed).toBe(false);
  });

  it('keeps the active cell in range when a collapse removes its column', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(20),
      columnGroups: [{ header: 'Tail', columns: ['stocks'], collapseTo: null }],
    });
    grid.select(0, 4); // the "stocks" column, last one
    expect(grid.selectedCell).toEqual({ row: 0, col: 4 });
    grid.toggleColumnGroup('tail', true);
    // stocks is hidden; active cell should clamp back to the last visible column (3).
    expect(grid.selectedCell?.col).toBe(3);
  });

  it('setColumnGroups replaces groups and emits columnGroupsChanged', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), columnGroups: [perf] });
    const changed: string[][] = [];
    grid.on('columnGroupsChanged', (e) => changed.push(e.keys));
    grid.setColumnGroups([{ header: 'Returns', columns: ['ytd', 'm1'] }]);
    expect(grid.columnGroups.map((g) => g.key)).toEqual(['returns']);
    expect(changed).toEqual([['returns']]);
  });

  it('removeColumnGroup drops the matching group', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), columnGroups: [perf] });
    grid.removeColumnGroup('perf');
    expect(grid.columnGroups).toHaveLength(0);
  });

  it('collapseAllColumnGroups / expandAllColumnGroups toggle every group', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(5),
      columnGroups: [
        { header: 'Perf', columns: ['ytd', 'm1'] },
        { header: 'Extra', columns: ['m6', 'stocks'] },
      ],
    });
    grid.collapseAllColumnGroups();
    expect(grid.columnGroups.every((g) => g.collapsed)).toBe(true);
    grid.expandAllColumnGroups();
    expect(grid.columnGroups.every((g) => !g.collapsed)).toBe(true);
  });

  it('keeps editing and selection aligned with visible columns while collapsed', () => {
    const grid = new Grid(host, {
      columns: columns.map((c) => ({ ...c, editable: true })),
      itemsSource: makeRows(20),
      // collapseTo: null so the whole group hides, leaving visible [name, stocks].
      columnGroups: [{ ...perf, collapseTo: null }],
    });
    grid.toggleColumnGroup('perf', true);
    // Visible columns are now [name, stocks]; selecting col 1 should land on stocks.
    grid.select(2, 1);
    expect(grid.selectedCell).toEqual({ row: 2, col: 1 });
    grid.setCellValue(2, 1, 999);
    // The edit writes to the row's `stocks` field (the 2nd visible column).
    expect(grid.collectionView.items[2].stocks).toBe(999);
  });
});

describe('column groups persistence', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('captures column groups and their collapse state in toJSON', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10), columnGroups: [perf] });
    grid.toggleColumnGroup('perf', true);
    const snap = grid.toJSON();
    expect(snap.columnGroups).toEqual([
      {
        key: 'perf',
        header: 'Perf',
        columns: ['ytd', 'm1', 'm6'],
        collapsed: true,
        collapseTo: 'ytd',
      },
    ]);
  });

  it('persists hidden columns in the column snapshot so a round-trip is lossless', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10), columnGroups: [perf] });
    grid.toggleColumnGroup('perf', true);
    const snap = grid.toJSON();
    // All 5 columns are still recorded even though 3 are hidden.
    expect(snap.columns?.map((c) => c.binding)).toEqual(['name', 'ytd', 'm1', 'm6', 'stocks']);
  });

  it('round-trips column groups onto a grid that already has the band', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10), columnGroups: [perf] });
    grid.toggleColumnGroup('perf', true);
    const snap = grid.toJSON();

    grid.toggleColumnGroup('perf', false);
    grid.loadJSON(snap);
    expect(grid.columnGroups[0].collapsed).toBe(true);
    expect(grid.toJSON().columnGroups).toEqual(snap.columnGroups);
  });
});

describe('nested column groups', () => {
  let host: HTMLElement;

  const allocCols = [
    { binding: 'name', header: 'Name', width: 100 },
    { binding: 'stock', header: 'Stocks', width: 60 },
    { binding: 'bond', header: 'Bonds', width: 60 },
    { binding: 'cash', header: 'Cash', width: 60 },
    { binding: 'other', header: 'Other', width: 60 },
    { binding: 'amount', header: 'Amount', width: 80 },
  ];

  // Allocation → [Stocks, Bonds, Detail → [Cash, Other], Amount]
  const alloc = {
    header: 'Allocation',
    collapseTo: 'amount',
    columns: ['stock', 'bond', { header: 'Detail', columns: ['cash', 'other'] }, 'amount'],
  };

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('makes the header band as tall as the deepest nesting', () => {
    new Grid(host, {
      columns: allocCols,
      itemsSource: makeRows(10),
      rowHeight: 24,
      headerHeight: 28,
      groupHeaderRowHeight: 30,
      columnGroups: [alloc],
    });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    // gutterTop = 2 group rows * 30 + leaf header 28 = 88; + 10 rows * 24 = 328.
    expect(canvas.style.height).toBe('328px');
  });

  it('renders nested group headers (Allocation over Detail)', () => {
    const grid = new Grid(host, {
      columns: allocCols,
      itemsSource: makeRows(10),
      columnGroups: [alloc],
    });
    // jsdom reports a zero-width viewport, so nudge the visible window to cover
    // the Detail columns before asserting they render.
    grid.select(0, 3);
    expect(host.querySelector('[data-group="allocation"]')).not.toBeNull();
    expect(host.querySelector('[data-group="detail"]')).not.toBeNull();
  });

  it('collapses an inner group independently, keeping its collapseTo column', () => {
    const grid = new Grid(host, {
      columns: allocCols,
      itemsSource: makeRows(10),
      columnGroups: [alloc],
    });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    const before = parseInt(canvas.style.width, 10);
    // Detail collapses to its first leaf (cash), hiding only `other` (60px).
    grid.toggleColumnGroup('detail', true);
    expect(before - parseInt(canvas.style.width, 10)).toBe(60);
    // Allocation stays expanded.
    expect(grid.columnGroups[0].collapsed).toBe(false);
  });

  it('collapsing the outer group hides all descendants except its collapseTo', () => {
    const grid = new Grid(host, {
      columns: allocCols,
      itemsSource: makeRows(10),
      columnGroups: [alloc],
    });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    const before = parseInt(canvas.style.width, 10);
    grid.toggleColumnGroup('allocation', true);
    // Allocation keeps `amount` (80); hides stock, bond, cash, other = 60*4 = 240.
    expect(before - parseInt(canvas.style.width, 10)).toBe(240);
  });

  it('an inner collapse cannot re-show a column hidden by a collapsed outer group', () => {
    const grid = new Grid(host, {
      columns: allocCols,
      itemsSource: makeRows(10),
      columnGroups: [alloc],
    });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    grid.toggleColumnGroup('allocation', true); // keeps only amount among Allocation's leaves
    const collapsedWidth = parseInt(canvas.style.width, 10);
    // Toggling Detail while the outer group is collapsed must not reveal cash/other.
    grid.toggleColumnGroup('detail', true);
    expect(parseInt(canvas.style.width, 10)).toBe(collapsedWidth);
  });

  it('collapseAll / expandAll recurse into nested groups', () => {
    const grid = new Grid(host, {
      columns: allocCols,
      itemsSource: makeRows(10),
      columnGroups: [alloc],
    });
    grid.collapseAllColumnGroups();
    expect(grid.columnGroups[0].collapsed).toBe(true);
    const detail = grid.columnGroups[0].descendantGroups().find((g) => g.key === 'detail')!;
    expect(detail.collapsed).toBe(true);
    grid.expandAllColumnGroups();
    expect(grid.columnGroups[0].descendantGroups().every((g) => !g.collapsed)).toBe(true);
  });

  it('round-trips nested collapse state through toJSON/loadJSON', () => {
    const grid = new Grid(host, {
      columns: allocCols,
      itemsSource: makeRows(10),
      columnGroups: [alloc],
    });
    grid.toggleColumnGroup('detail', true);
    const snap = grid.toJSON();
    // Snapshot nests: Allocation.columns contains the Detail subgroup snapshot.
    const allocSnap = snap.columnGroups![0];
    const detailSnap = allocSnap.columns.find(
      (c): c is Exclude<typeof c, string> => typeof c !== 'string',
    )!;
    expect(detailSnap.collapsed).toBe(true);

    grid.toggleColumnGroup('detail', false);
    grid.loadJSON(snap);
    const detail = grid.columnGroups[0].descendantGroups().find((g) => g.key === 'detail')!;
    expect(detail.collapsed).toBe(true);
  });
});
