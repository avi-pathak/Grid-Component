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
