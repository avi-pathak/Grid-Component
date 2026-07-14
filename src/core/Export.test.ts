import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid';

function makeRows(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ id: i, name: `r${i}`, sales: i * 10 });
  return rows;
}

const columns = [
  { binding: 'id', header: 'ID', width: 60, dataType: 'Number' as const },
  { binding: 'name', header: 'Name', width: 120 },
  { binding: 'sales', header: 'Sales', width: 100, dataType: 'Number' as const },
];

describe('Grid export', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('exports all rows to CSV without downloading', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3) });
    const result = grid.export({ format: 'csv', download: false });
    expect(result).not.toBeNull();
    const text = (result!.content as string).replace(/^\uFEFF/, '');
    const lines = text.split('\r\n');
    expect(lines[0]).toBe('ID,Name,Sales');
    expect(lines[1]).toBe('0,r0,0');
    expect(lines[3]).toBe('2,r2,20');
    expect(result!.fileName).toBe('export.csv');
    expect(result!.mimeType).toContain('text/csv');
  });

  it('defaults to CSV and the "export" file name', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(2) });
    const result = grid.export({ download: false });
    expect(result!.fileName).toBe('export.csv');
  });

  it('exports only the selection when rows: "selection"', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(10), selectionMode: 'RowRange' });
    grid.select(2, 0);
    grid.select(4, 2, true); // extend to a 3-row range
    const text = (
      grid.export({ format: 'csv', rows: 'selection', download: false })!.content as string
    ).replace(/^\uFEFF/, '');
    const dataLines = text.split('\r\n').slice(1); // drop header
    expect(dataLines.map((l) => l.split(',')[0])).toEqual(['2', '3', '4']);
  });

  it('restricts and reorders columns via options.columns', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(1) });
    const text = (
      grid.export({ format: 'csv', columns: ['sales', 'id'], download: false })!.content as string
    ).replace(/^\uFEFF/, '');
    expect(text.split('\r\n')[0]).toBe('Sales,ID');
  });

  it('produces a valid XLSX (ZIP) artifact', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    const result = grid.export({ format: 'xlsx', download: false });
    const bytes = result!.content as Uint8Array;
    expect(bytes[0]).toBe(0x50); // PK
    expect(bytes[1]).toBe(0x4b);
    expect(result!.fileName).toBe('export.xlsx');
  });

  it('produces a valid PDF artifact', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    const bytes = grid.export({ format: 'pdf', download: false })!.content as Uint8Array;
    expect(new TextDecoder('latin1').decode(bytes).startsWith('%PDF')).toBe(true);
  });

  it('fires exporting (cancelable) and exported events', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(2) });
    const seen: string[] = [];
    grid.on('exporting', (e) => seen.push(`ing:${e.format}`));
    grid.on('exported', (e) => seen.push(`ed:${e.format}`));
    grid.export({ format: 'csv', download: false });
    expect(seen).toEqual(['ing:csv', 'ed:csv']);
  });

  it('lets an exporting handler cancel the export', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(2) });
    grid.on('exporting', (e) => (e.cancel = true));
    expect(grid.export({ format: 'csv', download: false })).toBeNull();
  });

  it('returns null for an unknown format', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(2) });
    expect(grid.export({ format: 'nope', download: false })).toBeNull();
  });

  it('exportData exposes the IR without rendering', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(2) });
    const data = grid.exportData();
    expect(data.columns.map((c) => c.header)).toEqual(['ID', 'Name', 'Sales']);
    expect(data.rows).toHaveLength(2);
    expect(data.rows[0].cells[0]).toMatchObject({ value: 0, type: 'Number' });
  });

  it('supports a custom registered format', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(2) });
    grid.registerExportFormat({
      id: 'tsv',
      extension: 'tsv',
      mimeType: 'text/tab-separated-values',
      render: (data) => data.rows.map((r) => r.cells.map((c) => c.text).join('\t')).join('\n'),
    });
    const result = grid.export({ format: 'tsv', download: false });
    expect(result!.fileName).toBe('export.tsv');
    expect((result!.content as string).split('\n')[0]).toBe('0\tr0\t0');
  });
});

describe('Grid async export', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('exportAsync resolves to the same content as export', async () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(50) });
    const sync = grid.export({ format: 'csv', download: false })!.content as string;
    const async = (await grid.exportAsync({ format: 'csv', download: false, chunkSize: 10 }))!
      .content as string;
    expect(async).toBe(sync);
  });

  it('reports progress ending at 1', async () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(30) });
    const seen: number[] = [];
    await grid.exportAsync({
      format: 'csv',
      download: false,
      chunkSize: 5,
      onProgress: (f) => seen.push(f),
    });
    expect(seen[seen.length - 1]).toBe(1);
  });

  it('cancels via an AbortSignal, resolving to null', async () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(100) });
    const controller = new AbortController();
    controller.abort();
    const result = await grid.exportAsync({ format: 'csv', download: false, signal: controller.signal });
    expect(result).toBeNull();
  });

  it('shows and removes the progress overlay when showProgress is true', async () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(20) });
    const p = grid.exportAsync({ format: 'csv', download: false, showProgress: true, chunkSize: 5 });
    // Overlay appears during the run.
    expect(host.querySelector('.apg-export-progress')).not.toBeNull();
    await p;
    // …and is removed afterward.
    expect(host.querySelector('.apg-export-progress')).toBeNull();
  });

  it('does not show the overlay by default', async () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(20) });
    const p = grid.exportAsync({ format: 'csv', download: false, chunkSize: 5 });
    expect(host.querySelector('.apg-export-progress')).toBeNull();
    await p;
  });

  it('applies a cellCallback end-to-end', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(2) });
    const text = (
      grid.export({
        format: 'csv',
        download: false,
        cellCallback: (ctx) => {
          if (ctx.column.key === 'name') ctx.cell.text = ctx.cell.text.toUpperCase();
        },
      })!.content as string
    ).replace(/^\uFEFF/, '');
    expect(text.split('\r\n')[1]).toBe('0,R0,0');
  });
});

describe('Grid export with cell merging', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  const mergeData = [
    { id: 1, country: 'US', sales: 100 },
    { id: 2, country: 'US', sales: 200 },
    { id: 3, country: 'UK', sales: 300 },
    { id: 4, country: 'UK', sales: 400 },
  ];
  const mergeCols = [
    { binding: 'id', header: 'ID', dataType: 'Number' as const },
    { binding: 'country', header: 'Country', allowMerging: true },
    { binding: 'sales', header: 'Sales', dataType: 'Number' as const },
  ];

  it('blanks non-origin merged cells in CSV', () => {
    const grid = new Grid(host, { columns: mergeCols, itemsSource: mergeData, allowMerging: true });
    const text = (grid.export({ format: 'csv', download: false })!.content as string).replace(
      /^\uFEFF/,
      '',
    );
    const lines = text.split('\r\n');
    expect(lines[1]).toBe('1,US,100');
    expect(lines[2]).toBe('2,,200'); // country merged away
    expect(lines[3]).toBe('3,UK,300');
    expect(lines[4]).toBe('4,,400');
  });

  it('records merge spans in the export IR', () => {
    const grid = new Grid(host, { columns: mergeCols, itemsSource: mergeData, allowMerging: true });
    const merges = grid.exportData().merges!;
    expect(merges).toContainEqual({ topRow: 0, bottomRow: 1, leftCol: 1, rightCol: 1 });
    expect(merges).toContainEqual({ topRow: 2, bottomRow: 3, leftCol: 1, rightCol: 1 });
  });

  it('emits <mergeCells> in the XLSX for data merges', () => {
    const grid = new Grid(host, { columns: mergeCols, itemsSource: mergeData, allowMerging: true });
    const bytes = grid.export({ format: 'xlsx', download: false })!.content as Uint8Array;
    const xml = new TextDecoder('latin1').decode(bytes);
    expect(xml).toContain('<mergeCells');
    // Data starts at sheet row 2 (row 1 is the header); US merge = B2:B3.
    expect(xml).toContain('<mergeCell ref="B2:B3"/>');
    expect(xml).toContain('<mergeCell ref="B4:B5"/>');
  });
});

describe('Grid export: native filter and grouping', () => {
  let host: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  const rows = () => {
    const r = [];
    for (let i = 0; i < 8; i++) r.push({ id: i, country: i < 4 ? 'US' : 'UK', sales: i * 10 });
    return r;
  };
  const cols = [
    { binding: 'id', header: 'ID', dataType: 'Number' as const },
    { binding: 'country', header: 'Country' },
    { binding: 'sales', header: 'Sales', dataType: 'Number' as const, aggregate: 'sum' as const },
  ];

  it('adds an Excel AutoFilter when the grid has filtering', () => {
    const grid = new Grid(host, { columns: cols, itemsSource: rows(), allowFiltering: true });
    const xml = new TextDecoder('latin1').decode(
      grid.export({ format: 'xlsx', download: false })!.content as Uint8Array,
    );
    expect(xml).toContain('<autoFilter');
  });

  it('does not add an AutoFilter without filtering (default)', () => {
    const grid = new Grid(host, { columns: cols, itemsSource: rows() });
    const xml = new TextDecoder('latin1').decode(
      grid.export({ format: 'xlsx', download: false })!.content as Uint8Array,
    );
    expect(xml).not.toContain('<autoFilter');
  });

  it('exports ALL rows (not just the filtered view) when an AutoFilter is added', () => {
    const grid = new Grid(host, { columns: cols, itemsSource: rows(), allowFiltering: true });
    // Filter the view down to US; the export should still contain UK rows for
    // Excel's own filter to act on.
    grid.collectionView.filter = (it) => (it as { country: string }).country === 'US';
    grid.refresh();
    expect(grid.collectionView.items.length).toBe(4); // filtered view

    const text = (grid.export({ format: 'csv', download: false })!.content as string).replace(
      /^\uFEFF/,
      '',
    );
    const dataLines = text.split('\r\n').slice(1);
    expect(dataLines.length).toBe(8); // all rows, not 4
    expect(dataLines.some((l) => l.includes('UK'))).toBe(true);
  });

  it('exports only the filtered view when autoFilter is off', () => {
    const grid = new Grid(host, { columns: cols, itemsSource: rows(), allowFiltering: true });
    grid.collectionView.filter = (it) => (it as { country: string }).country === 'US';
    grid.refresh();
    const text = (
      grid.export({ format: 'csv', download: false, autoFilter: false })!.content as string
    ).replace(/^\uFEFF/, '');
    const dataLines = text.split('\r\n').slice(1);
    expect(dataLines.length).toBe(4); // filtered view only
    expect(dataLines.every((l) => l.includes('US'))).toBe(true);
  });

  it('carries active value-filters into the Excel AutoFilter and hides non-matching rows', () => {
    const grid = new Grid(host, { columns: cols, itemsSource: rows(), allowFiltering: true });
    // A checkbox-style value filter on Country = US (via the filter model).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fm = (grid as any).filterModel;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const countryCol = (grid as any).columns[1];
    const cf = fm.get(countryCol);
    cf.values = new Set(['US']);
    fm.apply();
    grid.refresh();

    const xml = new TextDecoder('latin1').decode(
      grid.export({ format: 'xlsx', download: false })!.content as Uint8Array,
    );
    // The filter criterion is in the AutoFilter\u2026
    expect(xml).toContain('<filterColumn colId="1">');
    expect(xml).toContain('<filter val="US"/>');
    // \u2026and the non-matching rows are hidden (UK rows), while all rows are present.
    expect(xml).toContain('hidden="1"');
  });

  it('uses Excel row grouping (outline levels) for grouped data', () => {
    const grid = new Grid(host, { columns: cols, itemsSource: rows(), groupPanel: true });
    grid.groupBy('country');
    const xml = new TextDecoder('latin1').decode(
      grid.export({ format: 'xlsx', download: false })!.content as Uint8Array,
    );
    expect(xml).toContain('<outlinePr');
    expect(xml).toContain('outlineLevel="1"');
  });

  it('respects outlineGroups: false (flat data)', () => {
    const grid = new Grid(host, { columns: cols, itemsSource: rows(), groupPanel: true });
    grid.groupBy('country');
    const xml = new TextDecoder('latin1').decode(
      grid.export({ format: 'xlsx', download: false, outlineGroups: false, includeGroups: false })!
        .content as Uint8Array,
    );
    expect(xml).not.toContain('outlineLevel="1"');
  });
});
