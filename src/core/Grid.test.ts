import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid';
import { DataMapEditor } from '../models/DataMapEditor';
import { DataMap } from '../models/DataMap';

function makeRows(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ id: i, name: `r${i}` });
  return rows;
}

const columns = [
  { binding: 'id', header: 'ID', width: 80 },
  { binding: 'name', header: 'Name', width: 120 },
];

describe('Grid', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('mounts the scaffold into the host', () => {
    new Grid(host, { columns, itemsSource: makeRows(100) });
    expect(host.classList.contains('apg')).toBe(true);
    expect(host.querySelector('.apg-header-inner')).not.toBeNull();
    expect(host.querySelector('.apg-viewport')).not.toBeNull();
  });

  it('throws when the host selector matches nothing', () => {
    expect(() => new Grid('#missing', { columns, itemsSource: [] })).toThrow();
  });

  it('sizes the scroll canvas from the data totals plus the header gutter', () => {
    new Grid(host, { columns, itemsSource: makeRows(100), rowHeight: 24 });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    // gutter = headerHeight 28 + rows*24; width = rowHeaderWidth 48 + cols
    expect(canvas.style.height).toBe('2428px'); // 28 + 100 * 24
    expect(canvas.style.width).toBe('248px'); // 48 + 80 + 120
  });

  it('resizes the canvas when data changes', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100), rowHeight: 24 });
    grid.setData(makeRows(10));
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    expect(canvas.style.height).toBe('268px'); // 28 + 10 * 24
  });

  it('grows the header when a column is added', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10) });
    const inner = host.querySelector('.apg-header-inner') as HTMLElement;
    expect(inner.style.width).toBe('200px');
    grid.addColumn({ binding: 'extra', header: 'Extra', width: 100 });
    expect(inner.style.width).toBe('300px');
  });

  it('accepts dataSource as an alias for itemsSource', () => {
    new Grid(host, { columns, dataSource: makeRows(5), rowHeight: 24 });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    expect(canvas.style.height).toBe('148px'); // 28 gutter + 5 * 24
  });

  it('updates selection and emits selectionChanged on select()', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100) });
    const changes: Array<{ row: number; col: number } | null> = [];
    grid.on('selectionChanged', (c) => changes.push(c));

    grid.select(3, 1);

    expect(grid.selectedCell).toEqual({ row: 3, col: 1 });
    expect(changes).toEqual([{ row: 3, col: 1 }]);
  });

  it('does not re-emit selectionChanged for the same cell', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100) });
    const changes: unknown[] = [];
    grid.on('selectionChanged', (c) => changes.push(c));

    grid.select(2, 0);
    grid.select(2, 0);

    expect(changes).toHaveLength(1);
  });

  it('stops emitting events after dispose', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100) });
    let count = 0;
    grid.on('selectionChanged', () => count++);
    grid.dispose();
    grid.select(1, 1);
    expect(count).toBe(0);
  });

  it('defaults to Cell selection mode', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100) });
    expect(grid.selectionMode).toBe('Cell');
    grid.select(2, 1);
    expect(grid.selection).toEqual({ topRow: 2, leftCol: 1, bottomRow: 2, rightCol: 1 });
  });

  it('honors the configured selection mode', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100), selectionMode: 'Row' });
    grid.select(3, 1);
    // Row mode highlights the whole row (both columns), active cell keeps its column
    expect(grid.selection).toEqual({ topRow: 3, leftCol: 0, bottomRow: 3, rightCol: 1 });
    expect(grid.selectedCell).toEqual({ row: 3, col: 1 });
  });

  it('extends the selection in a range mode', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(100),
      selectionMode: 'CellRange',
    });
    grid.select(2, 0);
    grid.select(5, 1, true);
    expect(grid.selection).toEqual({ topRow: 2, leftCol: 0, bottomRow: 5, rightCol: 1 });
  });

  it('selects nothing in None mode', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100), selectionMode: 'None' });
    grid.select(2, 1);
    expect(grid.selection).toBeNull();
    expect(grid.selectedCell).toBeNull();
  });

  it('clears the highlight when switched to None', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100) });
    grid.select(2, 1);
    grid.selectionMode = 'None';
    expect(grid.selection).toBeNull();
  });

  it('shows row headers with 1-based numbers by default', () => {
    new Grid(host, { columns, itemsSource: makeRows(100) });
    expect(host.querySelector('.apg-rowheader-inner')).not.toBeNull();
    expect(host.querySelector('.apg-corner')).not.toBeNull();
    const nums = [...host.querySelectorAll('.apg-rowheader-cell')].map((c) => c.textContent);
    expect(nums).toContain('1');
  });

  it('hides headers per headersVisibility', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(100),
      headersVisibility: 'Column',
    });
    expect(host.querySelector('.apg-rowheader-cell')).toBeNull();
    expect(host.querySelector('.apg-header-cell')).not.toBeNull();
    grid.dispose();

    new Grid(host, { columns, itemsSource: makeRows(100), headersVisibility: 'None' });
    expect(host.querySelector('.apg-rowheader-cell')).toBeNull();
  });

  it('tears down cleanly on dispose', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100) });
    grid.dispose();
    expect(host.classList.contains('apg')).toBe(false);
    expect(host.querySelector('.apg-canvas')).toBeNull();
    expect(host.querySelector('.apg-viewport')).toBeNull();
  });

  it('edits a cell and records it for undo/redo', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80 },
      { binding: 'name', header: 'Name', width: 120, editable: true },
    ];
    const data = makeRows(10);
    const grid = new Grid(host, { columns: cols, itemsSource: data });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-editor') as HTMLInputElement;
    expect(input).not.toBeNull();
    input.value = 'changed';
    input.dispatchEvent(new Event('blur'));

    expect(data[0].name).toBe('changed');
    expect(grid.canUndo).toBe(true);

    grid.undo();
    expect(data[0].name).toBe('r0');
    grid.redo();
    expect(data[0].name).toBe('changed');
  });

  it('does not open an editor for non-editable columns', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10) });
    grid.editCell(0, 0);
    expect(host.querySelector('.apg-editor')).toBeNull();
  });

  it('toggles a Boolean cell with Space instead of opening an editor', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      {
        binding: 'active',
        header: 'Active',
        width: 80,
        dataType: 'Boolean' as const,
        editable: true,
      },
    ];
    const data = [{ id: 0, active: false }];
    const grid = new Grid(host, { columns: cols, itemsSource: data });

    grid.editCell(0, 1); // Boolean never opens a text editor
    expect(host.querySelector('.apg-editor')).toBeNull();

    grid.select(0, 1);
    host.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(data[0].active).toBe(true);
    expect(grid.canUndo).toBe(true);

    grid.undo();
    expect(data[0].active).toBe(false);
  });

  it('parses numeric edits into numbers', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80 },
      {
        binding: 'sales',
        header: 'Sales',
        width: 100,
        dataType: 'Number' as const,
        editable: true,
      },
    ];
    const data = [{ id: 0, sales: 100 }];
    const grid = new Grid(host, { columns: cols, itemsSource: data });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-editor') as HTMLInputElement;
    input.value = '250';
    input.dispatchEvent(new Event('blur'));
    expect(data[0].sales).toBe(250);
  });

  it('resizes a column with undo support', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10) });
    grid.resizeColumn(0, 200);
    expect(grid.canUndo).toBe(true);
    grid.undo();
    expect(grid.canUndo).toBe(false);
    expect(grid.canRedo).toBe(true);
  });

  it('grows the canvas after a column resize', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10) });
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    const before = parseInt(canvas.style.width, 10);
    grid.resizeColumn(0, 200); // id column was 80 -> 200
    expect(parseInt(canvas.style.width, 10)).toBe(before + 120);
  });

  it('reorders a column with undo and emits columnReordered', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 80 },
      { binding: 'b', header: 'B', width: 80 },
      { binding: 'c', header: 'C', width: 80 },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: makeRows(5) });
    const events: Array<{ from: number; to: number }> = [];
    grid.on('columnReordered', (e) => events.push(e));

    grid.moveColumn(0, 2); // A -> end
    expect(events).toEqual([{ from: 0, to: 2 }]);
    expect(grid.canUndo).toBe(true);

    grid.undo();
    expect(grid.canUndo).toBe(false);
    expect(grid.canRedo).toBe(true);
  });

  it('ignores out-of-range or no-op column moves', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.moveColumn(0, 0);
    grid.moveColumn(0, 5);
    expect(grid.canUndo).toBe(false);
  });

  it('edits a dataMap (combo) cell via a select', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80 },
      {
        binding: 'status',
        header: 'Status',
        width: 120,
        editable: true,
        dataMap: ['Open', 'Closed'],
      },
    ];
    const data = [{ id: 0, status: 'Open' }];
    const grid = new Grid(host, { columns: cols, itemsSource: data });

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-editor-dropdown .apg-dd-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    const options = host.querySelectorAll('.apg-editor-dropdown .apg-dropdown-option');
    expect(options.length).toBe(2);
    input.value = 'Closed';
    input.dispatchEvent(new Event('blur'));
    expect(data[0].status).toBe('Closed');
    expect(grid.canUndo).toBe(true);
  });

  it('does not edit a calculated column', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 80, dataType: 'Number' as const },
      {
        header: 'Sum',
        width: 80,
        valueGetter: (r: Record<string, unknown>) => Number(r.a) + 1,
        editable: true,
      },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: [{ a: 5 }] });
    grid.editCell(0, 1);
    expect(host.querySelector('.apg-editor')).toBeNull();
  });

  it('places the editor in the scrolling cells panel at the cell position', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80 },
      { binding: 'name', header: 'Name', width: 120, editable: true },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: makeRows(100), rowHeight: 24 });

    grid.editCell(10, 1);
    const editor = host.querySelector('.apg-editor') as HTMLElement;
    // The editor must be a child of .apg-cells so it scrolls with the row; if it
    // lived in .apg-viewport it would drift from the cell once scrolled.
    expect(editor.parentElement?.classList.contains('apg-cells')).toBe(true);
    // Content coordinates: col 1 starts after the 80px id column, row 10 at 10*24.
    expect(editor.style.transform).toBe('translate3d(80px, 240px, 0)');
  });

  it('keeps the editor aligned with its cell after scrolling', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80 },
      { binding: 'name', header: 'Name', width: 120, editable: true },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: makeRows(100), rowHeight: 24 });

    grid.editCell(40, 1);
    const before = (host.querySelector('.apg-editor') as HTMLElement).style.transform;
    (host.querySelector('.apg-editor') as HTMLElement).dispatchEvent(new Event('blur'));

    // Scroll so the same row sits at a non-zero scrollTop, then re-edit. The
    // transform must be unchanged — the old code subtracted scrollTop here and
    // the editor crept upward away from the cell.
    grid.scrollTo(40);
    grid.editCell(40, 1);
    const after = (host.querySelector('.apg-editor') as HTMLElement).style.transform;

    expect(after).toBe(before);
    expect(after).toBe('translate3d(80px, 960px, 0)'); // 40 * 24
  });

  it('opens a radio editor for a RadioButtons data-mapped column', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80 },
      {
        binding: 'priority',
        header: 'Priority',
        width: 120,
        editable: true,
        dataMap: [
          { value: 1, text: 'High' },
          { value: 2, text: 'Low' },
        ],
        dataMapEditor: DataMapEditor.RadioButtons,
      },
    ];
    const data = [{ id: 0, priority: 1 }];
    const grid = new Grid(host, { columns: cols, itemsSource: data });

    grid.editCell(0, 1);
    const radios = host.querySelectorAll('.apg-editor-radio input[type=radio]');
    expect(radios.length).toBe(2);

    const low = [...radios].find(
      (r) => (r as HTMLInputElement).value === 'Low',
    ) as HTMLInputElement;
    low.checked = true;
    low.dispatchEvent(new Event('change'));
    expect(data[0].priority).toBe(2);
    expect(grid.canUndo).toBe(true);
  });

  it('opens an autocomplete editor for an AutoComplete data-mapped column', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80 },
      {
        binding: 'owner',
        header: 'Owner',
        width: 120,
        editable: true,
        dataMap: ['Alice', 'Bob'],
        dataMapEditor: DataMapEditor.AutoComplete,
      },
    ];
    const data = [{ id: 0, owner: 'Alice' }];
    const grid = new Grid(host, { columns: cols, itemsSource: data });

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-editor-dropdown .apg-dd-input') as HTMLInputElement;
    expect(input).not.toBeNull();
    // The popup list renders the map's display values as options.
    const options = host.querySelectorAll('.apg-editor-dropdown .apg-dropdown-option');
    expect(options.length).toBe(2);
    input.value = 'Bob';
    input.dispatchEvent(new Event('blur'));
    expect(data[0].owner).toBe('Bob');
  });

  it('filters a dynamic data-mapped column by the row item', () => {
    const cityItems = [
      { country: 'US', city: 'Seattle' },
      { country: 'US', city: 'Miami' },
      { country: 'UK', city: 'London' },
    ];
    const cityMap = new DataMap(cityItems, 'city', 'city');
    cityMap.itemsFilter = (row) => {
      const country = (row as { country?: string }).country;
      return country ? cityItems.filter((c) => c.country === country) : cityItems;
    };
    const cols = [
      { binding: 'country', header: 'Country', width: 100, editable: true, dataMap: ['US', 'UK'] },
      { binding: 'city', header: 'City', width: 120, editable: true, dataMap: cityMap },
    ];
    const data = [{ country: 'US', city: 'Seattle' }];
    const grid = new Grid(host, { columns: cols, itemsSource: data });

    grid.editCell(0, 1); // open the City dropdown for a US row
    const texts = [...host.querySelectorAll('.apg-editor-dropdown .apg-dropdown-option')].map(
      (o) => o.textContent,
    );
    expect(texts).toEqual(['Miami', 'Seattle']); // only US cities, sorted by display
  });

  it('tracks edited rows when trackChanges is enabled', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80 },
      { binding: 'name', header: 'Name', width: 120, editable: true },
    ];
    const data = makeRows(10);
    const grid = new Grid(host, { columns: cols, itemsSource: data, trackChanges: true });

    grid.editCell(2, 1);
    const input = host.querySelector('.apg-editor') as HTMLInputElement;
    input.value = 'renamed';
    input.dispatchEvent(new Event('blur'));

    expect(grid.collectionView.itemsEdited).toContain(data[2]);
  });

  it('grows the grid when a row is added through the collection view', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10), rowHeight: 24 });
    grid.collectionView.addNew({ id: 99, name: 'new' }, true);
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    expect(canvas.style.height).toBe('292px'); // 28 gutter + 11 * 24
  });

  it('sets a cell value programmatically with undo support', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80 },
      { binding: 'name', header: 'Name', width: 120, editable: true },
    ];
    const data = makeRows(5);
    const grid = new Grid(host, { columns: cols, itemsSource: data });

    grid.setCellValue(2, 1, 'patched');
    expect(data[2].name).toBe('patched');
    expect(grid.canUndo).toBe(true);
    grid.undo();
    expect(data[2].name).toBe('r2');
  });

  it('ignores setCellValue on a non-editable column', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.setCellValue(0, 0, 999);
    expect(grid.canUndo).toBe(false);
  });

  it('updates a dependent column from cellEditEnd', () => {
    const citiesByCountry: Record<string, string[]> = {
      US: ['Seattle', 'Miami'],
      UK: ['London', 'Bristol'],
    };
    const cols = [
      { binding: 'country', header: 'Country', width: 100, editable: true, dataMap: ['US', 'UK'] },
      {
        binding: 'city',
        header: 'City',
        width: 120,
        editable: true,
        dataMap: ['Seattle', 'Miami', 'London', 'Bristol'],
      },
    ];
    const data = [{ country: 'US', city: 'Seattle' }];
    const grid = new Grid(host, { columns: cols, itemsSource: data });
    grid.on('cellEditEnd', ({ row, col }) => {
      if (col !== 0) return;
      const item = grid.collectionView.items[row] as { country: string; city: string };
      const cities = citiesByCountry[item.country] ?? [];
      if (!cities.includes(item.city)) grid.setCellValue(row, 1, cities[0]);
    });

    grid.editCell(0, 0);
    const input = host.querySelector('.apg-editor-dropdown .apg-dd-input') as HTMLInputElement;
    input.value = 'UK';
    input.dispatchEvent(new Event('blur'));

    expect(data[0].country).toBe('UK');
    expect(data[0].city).toBe('London'); // city reset to a valid UK city
  });

  it('sorts the view when sort() is called, cycling asc/desc/none', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    const cv = grid.collectionView;

    grid.sort('id');
    expect(cv.sortDescriptions[0]).toMatchObject({ property: 'id', ascending: true });
    expect(cv.items.map((r) => (r as { id: number }).id)).toEqual([0, 1, 2, 3, 4]);

    grid.sort('id'); // toggle to descending
    expect(cv.sortDescriptions[0]).toMatchObject({ property: 'id', ascending: false });
    expect(cv.items.map((r) => (r as { id: number }).id)).toEqual([4, 3, 2, 1, 0]);

    grid.sort('id'); // third call clears the sort
    expect(cv.sortDescriptions).toHaveLength(0);
  });

  it('shows a sort arrow on the sorted column header', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.sort('id', true);
    const arrows = [...host.querySelectorAll('.apg-sort-arrow')].map((a) => a.textContent);
    expect(arrows).toContain('▲');
  });

  it('does not sort a calculated column', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 80, dataType: 'Number' as const },
      { header: 'Sum', width: 80, valueGetter: (r: Record<string, unknown>) => Number(r.a) + 1 },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: [{ a: 2 }, { a: 1 }] });
    grid.sort('Sum'); // no binding match -> ignored
    expect(grid.collectionView.sortDescriptions).toHaveLength(0);
  });

  it('moves the collection view current item to the selected row', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10) });
    grid.select(4, 1);
    expect(grid.collectionView.currentPosition).toBe(4);
    expect((grid.collectionView.currentItem as { id: number }).id).toBe(4);
  });

  it('sorts a data-mapped column by its display text', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 60, dataType: 'Number' as const },
      {
        binding: 'status',
        header: 'Status',
        width: 120,
        editable: true,
        // keys sort 1,2,3 but display sorts Closed, Open, Pending
        dataMap: [
          { value: 1, text: 'Open' },
          { value: 2, text: 'Closed' },
          { value: 3, text: 'Pending' },
        ],
      },
    ];
    const data = [
      { id: 1, status: 1 },
      { id: 2, status: 2 },
      { id: 3, status: 3 },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data });
    grid.sort('status');
    // by display: Closed(2), Open(1), Pending(3)
    expect(grid.collectionView.items.map((r) => (r as { id: number }).id)).toEqual([2, 1, 3]);
  });

  it('exports a cell range as tab-delimited text', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 60, dataType: 'Number' as const },
      { binding: 'name', header: 'Name', width: 100, editable: true },
    ];
    const data = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data, allowClipboard: true });
    const text = grid.getClipString({ topRow: 0, leftCol: 0, bottomRow: 1, rightCol: 1 });
    expect(text).toBe('1\ta\n2\tb');
  });

  it('pastes tab-delimited text down a column from the anchor', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 60, dataType: 'Number' as const },
      { binding: 'name', header: 'Name', width: 100, editable: true },
    ];
    const data = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data, allowClipboard: true });
    grid.setClipString('x\ny\nz', { topRow: 0, leftCol: 1, bottomRow: 0, rightCol: 1 });
    expect(data.map((r) => r.name)).toEqual(['x', 'y', 'z']);
  });

  it('pastes a 2D block across rows and columns', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 60, dataType: 'Number' as const, editable: true },
      { binding: 'b', header: 'B', width: 60, editable: true },
    ];
    const data = [
      { a: 0, b: '' },
      { a: 0, b: '' },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data, allowClipboard: true });
    grid.setClipString('10\tx\n20\ty', { topRow: 0, leftCol: 0, bottomRow: 0, rightCol: 0 });
    expect(data).toEqual([
      { a: 10, b: 'x' },
      { a: 20, b: 'y' },
    ]);
  });

  it('skips read-only and calculated columns when pasting', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 60, dataType: 'Number' as const }, // read-only
      { binding: 'name', header: 'Name', width: 100, editable: true },
      {
        header: 'Sum',
        width: 60,
        valueGetter: (r: Record<string, unknown>) => Number(r.id) + 1,
        editable: true, // calculated -> forced read-only
      },
    ];
    const data = [{ id: 1, name: 'a' }];
    const grid = new Grid(host, { columns: cols, itemsSource: data, allowClipboard: true });
    grid.setClipString('99\tZ\t100', { topRow: 0, leftCol: 0, bottomRow: 0, rightCol: 0 });
    expect(data[0].id).toBe(1); // read-only, unchanged
    expect(data[0].name).toBe('Z'); // editable, pasted
  });

  it('treats a paste as a single undo step', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 60 },
      { binding: 'name', header: 'Name', width: 100, editable: true },
    ];
    const data = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
      { id: 3, name: 'c' },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data, allowClipboard: true });
    grid.setClipString('x\ny\nz', { topRow: 0, leftCol: 1, bottomRow: 0, rightCol: 1 });
    expect(grid.canUndo).toBe(true);
    grid.undo();
    expect(data.map((r) => r.name)).toEqual(['a', 'b', 'c']); // all restored at once
    expect(grid.canUndo).toBe(false);
    grid.redo();
    expect(data.map((r) => r.name)).toEqual(['x', 'y', 'z']);
  });

  it('cancels a paste when the pasting event is canceled', () => {
    const cols = [{ binding: 'name', header: 'Name', width: 100, editable: true }];
    const data = [{ name: 'a' }];
    const grid = new Grid(host, { columns: cols, itemsSource: data, allowClipboard: true });
    grid.on('pasting', (e) => (e.cancel = true));
    grid.setClipString('z', { topRow: 0, leftCol: 0, bottomRow: 0, rightCol: 0 });
    expect(data[0].name).toBe('a');
    expect(grid.canUndo).toBe(false);
  });

  it('emits pasted with the affected range', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 60, editable: true },
      { binding: 'b', header: 'B', width: 60, editable: true },
    ];
    const data = [
      { a: '', b: '' },
      { a: '', b: '' },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data, allowClipboard: true });
    let pastedRange: unknown = null;
    grid.on('pasted', (e) => (pastedRange = e.range));
    grid.setClipString('1\t2\n3\t4', { topRow: 0, leftCol: 0, bottomRow: 0, rightCol: 0 });
    expect(pastedRange).toEqual({ topRow: 0, leftCol: 0, bottomRow: 1, rightCol: 1 });
  });

  it('shows the grouping bar only when groupPanel is enabled', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10) });
    expect(host.querySelector('.apg-grouppanel')).toBeNull();
    grid.dispose();
    new Grid(host, { columns, itemsSource: makeRows(10), groupPanel: true });
    expect(host.querySelector('.apg-grouppanel')).not.toBeNull();
  });

  it('groups rows and inserts group-header rows with counts', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 60, dataType: 'Number' as const },
      { binding: 'kind', header: 'Kind', width: 100 },
    ];
    const data = [
      { id: 1, kind: 'A' },
      { id: 2, kind: 'B' },
      { id: 3, kind: 'A' },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data, groupPanel: true });
    grid.groupBy('kind');

    const events: string[][] = [];
    grid.on('groupsChanged', (e) => events.push(e.bindings));
    grid.groupBy('kind');
    expect(events).toEqual([['kind']]);

    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    // 2 group headers (A, B) + 3 data rows = 5 rows; height = 28 gutter + 5*24
    expect(canvas.style.height).toBe(`${28 + 5 * 24}px`);
    const labels = [...host.querySelectorAll('.apg-group-name')].map((n) => n.textContent);
    expect(labels).toEqual(['A', 'B']);
    const counts = [...host.querySelectorAll('.apg-group-count')].map((n) => n.textContent);
    expect(counts).toEqual(['2', '1']);
  });

  it('renders an expand/collapse chevron icon on group rows', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 100 }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'A' }, { kind: 'B' }],
      groupPanel: true,
    });
    grid.groupBy('kind');
    const toggles = host.querySelectorAll('.apg-group-toggle');
    expect(toggles.length).toBe(2);
    expect(toggles[0].querySelector('svg')).not.toBeNull(); // SVG icon, not a glyph char
    expect(toggles[0].classList.contains('apg-group-toggle-open')).toBe(true); // expanded

    grid.collapseAllGroups();
    const collapsed = host.querySelector('.apg-group-toggle') as HTMLElement;
    expect(collapsed.classList.contains('apg-group-toggle-open')).toBe(false);
  });

  it('renders a custom group-header template', () => {
    const cols = [
      { binding: 'kind', header: 'Kind', width: 100 },
      { binding: 'n', header: 'N', width: 80, dataType: 'Number' as const },
    ];
    const data = [
      { kind: 'A', n: 1 },
      { kind: 'A', n: 2 },
      { kind: 'B', n: 3 },
    ];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: data,
      groupPanel: true,
      groupHeaderTemplate: ({ group, itemCount }) =>
        `<span class="custom-label">${group.name}: ${itemCount}</span>`,
    });
    grid.groupBy('kind');
    const labels = [...host.querySelectorAll('.custom-label')].map((n) => n.textContent);
    expect(labels).toEqual(['A: 2', 'B: 1']);
    // The chevron is still added by the grid alongside the custom content.
    expect(host.querySelector('.apg-group-toggle')).not.toBeNull();
  });

  it('renders a chip per grouping level and removes one on ✕', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 80 },
      { binding: 'b', header: 'B', width: 80 },
    ];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [
        { a: '1', b: '1' },
        { a: '1', b: '2' },
      ],
      groupPanel: true,
    });
    grid.groupBy('a', 'b');
    expect(host.querySelectorAll('.apg-group-chip').length).toBe(2);

    grid.removeGroup('a');
    const remaining = [...host.querySelectorAll('.apg-group-chip')].map(
      (c) => (c as HTMLElement).dataset.binding,
    );
    expect(remaining).toEqual(['b']);
  });

  it('caps grouping at maxGroups', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 80 },
      { binding: 'b', header: 'B', width: 80 },
      { binding: 'c', header: 'C', width: 80 },
    ];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ a: '1', b: '1', c: '1' }],
      groupPanel: true,
      maxGroups: 2,
    });
    grid.groupBy('a', 'b', 'c');
    expect(grid.groupDescriptions.map((g) => g.property)).toEqual(['a', 'b']);
  });

  it('collapses a group so its data rows disappear', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 60, dataType: 'Number' as const },
      { binding: 'kind', header: 'Kind', width: 100 },
    ];
    const data = [
      { id: 1, kind: 'A' },
      { id: 2, kind: 'A' },
      { id: 3, kind: 'B' },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data, groupPanel: true });
    grid.groupBy('kind');
    const canvas = host.querySelector('.apg-canvas') as HTMLElement;
    const before = canvas.style.height;

    grid.collapseAllGroups();
    // Only the 2 group headers remain: height = 28 + 2*24
    expect(canvas.style.height).toBe(`${28 + 2 * 24}px`);

    grid.expandAllGroups();
    expect(canvas.style.height).toBe(before);
  });

  it('shows a column aggregate on group-header rows', () => {
    const cols = [
      { binding: 'kind', header: 'Kind', width: 100 },
      {
        binding: 'sales',
        header: 'Sales',
        width: 100,
        dataType: 'Number' as const,
        aggregate: 'sum' as const,
      },
    ];
    const data = [
      { kind: 'A', sales: 10 },
      { kind: 'A', sales: 15 },
      { kind: 'B', sales: 100 },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data, groupPanel: true });
    grid.groupBy('kind');
    const aggs = [...host.querySelectorAll('.apg-group-agg')].map((a) => a.textContent);
    expect(aggs).toEqual(['25', '100']);
  });

  it('clears grouping and returns to a flat list', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 100 }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'B' }],
      groupPanel: true,
    });
    grid.groupBy('kind');
    expect(host.querySelector('.apg-group-row')).not.toBeNull();
    grid.clearGroups();
    expect(host.querySelector('.apg-group-row')).toBeNull();
    expect(grid.groupDescriptions).toHaveLength(0);
  });

  it('reverses group order when a grouped column is sorted descending', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 100 }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'C' }, { kind: 'B' }],
      groupPanel: true,
    });
    grid.groupBy('kind');
    const names = () => grid.collectionView.groups.map((g) => g.name);
    expect(names()).toEqual(['A', 'B', 'C']);

    grid.sort('kind', false); // descending
    expect(names()).toEqual(['C', 'B', 'A']);

    grid.sort('kind', true); // ascending
    expect(names()).toEqual(['A', 'B', 'C']);
  });

  it('opens a context menu on right-clicking a group chip', () => {
    const cols = [
      { binding: 'kind', header: 'Kind', width: 100 },
      { binding: 'n', header: 'N', width: 80, dataType: 'Number' as const },
    ];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [
        { kind: 'A', n: 1 },
        { kind: 'B', n: 2 },
      ],
      groupPanel: true,
    });
    grid.groupBy('kind');

    const chip = host.querySelector('.apg-group-chip[data-binding="kind"]') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));

    const menu = document.querySelector('.apg-context-menu');
    expect(menu).not.toBeNull();
    const labels = [...menu!.querySelectorAll('.apg-context-menu-label')].map((l) => l.textContent);
    expect(labels).toEqual([
      'Expand All',
      'Collapse All',
      'Sort Ascending',
      'Sort Descending',
      'Remove Sort',
      'Remove Group',
    ]);
    // "Remove Sort" is disabled until the group is sorted.
    const removeSort = [...menu!.querySelectorAll('.apg-context-menu-item')].find(
      (b) => b.textContent === 'Remove Sort',
    ) as HTMLButtonElement;
    expect(removeSort.disabled).toBe(true);
  });

  it('sorts descending from the chip context menu', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 100 }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'B' }, { kind: 'C' }],
      groupPanel: true,
    });
    grid.groupBy('kind');
    const chip = host.querySelector('.apg-group-chip[data-binding="kind"]') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));

    const menu = document.querySelector('.apg-context-menu')!;
    const sortDesc = [...menu.querySelectorAll('.apg-context-menu-item')].find(
      (b) => b.textContent === 'Sort Descending',
    ) as HTMLButtonElement;
    sortDesc.click();

    const names = grid.collectionView.groups.map((g) => g.name);
    expect(names).toEqual(['C', 'B', 'A']);
    expect(document.querySelector('.apg-context-menu')).toBeNull(); // closed after action
  });

  it('removes a group from the chip context menu', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 80 },
      { binding: 'b', header: 'B', width: 80 },
    ];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [
        { a: '1', b: '1' },
        { a: '1', b: '2' },
      ],
      groupPanel: true,
    });
    grid.groupBy('a', 'b');
    const chip = host.querySelector('.apg-group-chip[data-binding="a"]') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));

    const menu = document.querySelector('.apg-context-menu')!;
    const removeGroup = [...menu.querySelectorAll('.apg-context-menu-item')].find(
      (b) => b.textContent === 'Remove Group',
    ) as HTMLButtonElement;
    removeGroup.click();

    expect(grid.groupDescriptions.map((g) => g.property)).toEqual(['b']);
  });

  it('enables every grouping-bar capability by default', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 100 }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'B' }],
      groupPanel: true,
    });
    grid.groupBy('kind');
    expect(host.querySelector('.apg-grouppanel-icon')).not.toBeNull();
    expect(host.querySelector('.apg-group-chip-grip')).not.toBeNull();
    expect(host.querySelector('.apg-group-chip-remove')).not.toBeNull();
    const chip = host.querySelector('.apg-group-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));
    expect(document.querySelector('.apg-context-menu')).not.toBeNull();
  });

  it('always renders the group icon and chip grip so CSS can hide them', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 100 }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'B' }],
      groupPanel: { allowReorder: false }, // even with reorder off, the grip stays for CSS
    });
    grid.groupBy('kind');
    // These are visual-only; there's no flag to remove them — style them out in CSS.
    expect(host.querySelector('.apg-grouppanel-icon')).not.toBeNull();
    expect(host.querySelector('.apg-group-chip-grip')).not.toBeNull();
  });

  it('omits remove buttons when allowRemove is false', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 100 }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'B' }],
      groupPanel: { allowRemove: false },
    });
    grid.groupBy('kind');
    expect(host.querySelector('.apg-group-chip-remove')).toBeNull();

    const chip = host.querySelector('.apg-group-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));
    const labels = [...document.querySelectorAll('.apg-context-menu-label')].map(
      (l) => l.textContent,
    );
    expect(labels).not.toContain('Remove Group');
  });

  it('does not sort from the chip or menu when allowSort is false', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 100 }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'C' }, { kind: 'B' }],
      groupPanel: { allowSort: false },
    });
    grid.groupBy('kind');

    const chip = host.querySelector('.apg-group-chip[data-binding="kind"]') as HTMLElement;
    chip.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }),
    );
    chip.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, button: 0, clientX: 0, clientY: 0 }),
    );
    chip.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, clientX: 0, clientY: 0 }),
    );
    expect(grid.collectionView.sortDescriptions).toHaveLength(0); // click did nothing

    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));
    const labels = [...document.querySelectorAll('.apg-context-menu-label')].map(
      (l) => l.textContent,
    );
    // No sort entries; Remove Group stays (allowRemove still on).
    expect(labels).toEqual(['Expand All', 'Collapse All', 'Remove Group']);
  });

  it('does not open a context menu when contextMenu is false', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 100 }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'B' }],
      groupPanel: { contextMenu: false },
    });
    grid.groupBy('kind');
    const chip = host.querySelector('.apg-group-chip') as HTMLElement;
    chip.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 20, clientY: 20 }));
    expect(document.querySelector('.apg-context-menu')).toBeNull();
  });

  it('honors maxGroups from the groupPanel options object', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 80 },
      { binding: 'b', header: 'B', width: 80 },
      { binding: 'c', header: 'C', width: 80 },
    ];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ a: '1', b: '1', c: '1' }],
      groupPanel: { maxGroups: 2 },
    });
    grid.groupBy('a', 'b', 'c');
    expect(grid.groupDescriptions.map((g) => g.property)).toEqual(['a', 'b']);
  });

  // --- Filtering ---

  function openFilter(): HTMLElement {
    const btn = host.querySelector('.apg-filter-btn') as HTMLElement;
    btn.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }),
    );
    btn.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, clientX: 0, clientY: 0 }),
    );
    return document.querySelector('.apg-filter-dialog') as HTMLElement;
  }

  it('shows a filter button only on filterable columns', () => {
    const cols = [
      { binding: 'a', header: 'A', width: 100, filter: true },
      { binding: 'b', header: 'B', width: 100, filter: false },
    ];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ a: '1', b: '2' }],
      allowFiltering: true,
    });
    expect(host.querySelectorAll('.apg-filter-btn').length).toBe(1);
    grid.dispose();

    new Grid(host, {
      columns: [{ binding: 'a', header: 'A', width: 100 }],
      itemsSource: [{ a: '1' }],
    });
    expect(host.querySelector('.apg-filter-btn')).toBeNull(); // filtering off by default
  });

  it('filters rows by a value checklist and clears them again', () => {
    const cols = [
      { binding: 'kind', header: 'Kind', width: 120, filter: true },
      { binding: 'id', header: 'ID', width: 60, dataType: 'Number' as const },
    ];
    const data = [
      { kind: 'A', id: 1 },
      { kind: 'A', id: 2 },
      { kind: 'B', id: 3 },
      { kind: 'C', id: 4 },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data, allowFiltering: true });

    const dialog = openFilter();
    expect(dialog).not.toBeNull();
    for (const item of [...dialog.querySelectorAll('.apg-filter-item')]) {
      if (item.querySelector('span')!.textContent !== 'A') {
        const box = item.querySelector('input') as HTMLInputElement;
        box.checked = false;
        box.dispatchEvent(new Event('change'));
      }
    }
    (dialog.querySelector('.apg-filter-apply') as HTMLElement).click();

    expect(grid.collectionView.itemCount).toBe(2); // only the two A rows
    expect(host.querySelector('.apg-filter-btn.apg-filter-active')).not.toBeNull();

    grid.clearFilters();
    expect(grid.collectionView.itemCount).toBe(4);
    expect(host.querySelector('.apg-filter-btn.apg-filter-active')).toBeNull();
  });

  it('filters numbers by a greater-than condition', () => {
    const cols = [
      { binding: 'n', header: 'N', width: 120, dataType: 'Number' as const, filter: true },
    ];
    const data = [{ n: 5 }, { n: 15 }, { n: 25 }];
    const grid = new Grid(host, { columns: cols, itemsSource: data, allowFiltering: true });

    const dialog = openFilter();
    const op = dialog.querySelector('.apg-filter-op') as HTMLSelectElement;
    op.value = 'gt';
    op.dispatchEvent(new Event('change'));
    const val = dialog.querySelector('.apg-filter-value') as HTMLInputElement;
    val.value = '10';
    val.dispatchEvent(new Event('input'));
    (dialog.querySelector('.apg-filter-apply') as HTMLElement).click();

    expect(grid.collectionView.itemCount).toBe(2); // 15 and 25
  });

  it('emits filterChanged with the active bindings', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 120, filter: true }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'B' }],
      allowFiltering: true,
    });
    const events: string[][] = [];
    grid.on('filterChanged', (e) => events.push(e.activeBindings));

    const dialog = openFilter();
    const items = [...dialog.querySelectorAll('.apg-filter-item')];
    const bBox = items
      .find((i) => i.querySelector('span')!.textContent === 'B')!
      .querySelector('input') as HTMLInputElement;
    bBox.checked = false;
    bBox.dispatchEvent(new Event('change'));
    (dialog.querySelector('.apg-filter-apply') as HTMLElement).click();

    expect(events).toEqual([['kind']]);
  });

  it('sorts a column from the filter dialog', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 120, filter: true }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'B' }, { kind: 'A' }, { kind: 'C' }],
      allowFiltering: true,
    });

    let dialog = openFilter();
    const asc = [...dialog.querySelectorAll('.apg-filter-sort-btn')].find(
      (b) => b.textContent === 'Sort Ascending',
    ) as HTMLButtonElement;
    asc.click();
    expect(grid.collectionView.items.map((r) => (r as { kind: string }).kind)).toEqual([
      'A',
      'B',
      'C',
    ]);

    // Reopening shows the ascending shortcut as active; clicking it clears the sort.
    dialog = openFilter();
    const activeBtn = dialog.querySelector('.apg-filter-sort-active') as HTMLButtonElement;
    expect(activeBtn.textContent).toBe('Sort Ascending');
    activeBtn.click();
    expect(grid.collectionView.sortDescriptions).toHaveLength(0);
  });

  it('hides the sort shortcuts when sorting is disabled', () => {
    const cols = [{ binding: 'kind', header: 'Kind', width: 120, filter: true }];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: [{ kind: 'A' }, { kind: 'B' }],
      allowFiltering: true,
      allowSorting: false,
    });
    const dialog = openFilter();
    expect(dialog.querySelector('.apg-filter-sort')).toBeNull();
    grid.dispose();
  });
});
