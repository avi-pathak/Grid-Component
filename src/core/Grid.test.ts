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
});
