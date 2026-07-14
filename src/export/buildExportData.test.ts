import { describe, it, expect } from 'vitest';
import { Column } from '../models/Column';
import { buildExportData, buildExportDataAsync, ExportSource } from './buildExportData';

function cols(): Column[] {
  return [
    new Column({ binding: 'id', header: 'ID', dataType: 'Number' }),
    new Column({ binding: 'name', header: 'Name' }),
    new Column({ binding: 'active', header: 'Active', dataType: 'Boolean' }),
  ];
}

// A flat (ungrouped) source over a plain array.
function flatSource(items: Record<string, unknown>[]): ExportSource {
  return {
    length: items.length,
    item: (i) => items[i],
    rowType: () => 'data',
    groupRow: () => null,
  };
}

describe('buildExportData', () => {
  const items = [
    { id: 1, name: 'Alice', active: true },
    { id: 2, name: 'Bob', active: false },
  ];

  it('maps columns to typed export columns', () => {
    const data = buildExportData({ columns: cols(), source: flatSource(items) }, {});
    expect(data.columns).toEqual([
      { header: 'ID', key: 'id', type: 'Number', align: 'right', width: 100 },
      { header: 'Name', key: 'name', type: 'String', align: 'left', width: 100 },
      { header: 'Active', key: 'active', type: 'Boolean', align: 'center', width: 100 },
    ]);
  });

  it('carries raw value, formatted text, and type for each cell', () => {
    const data = buildExportData({ columns: cols(), source: flatSource(items) }, {});
    expect(data.rows).toHaveLength(2);
    const [a] = data.rows;
    expect(a.kind).toBe('data');
    expect(a.cells[0]).toMatchObject({ value: 1, text: '1', type: 'Number' });
    expect(a.cells[1]).toMatchObject({ value: 'Alice', text: 'Alice', type: 'String' });
    // Booleans get a readable TRUE/FALSE for export (grid renders a checkbox).
    expect(a.cells[2]).toMatchObject({ value: true, text: 'TRUE', type: 'Boolean' });
  });

  it('limits rows to a selection rectangle', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `n${i}`, active: false }));
    const data = buildExportData(
      {
        columns: cols(),
        source: flatSource(many),
        selection: { topRow: 3, bottomRow: 5, leftCol: 0, rightCol: 2 },
      },
      {},
    );
    expect(data.rows.map((r) => r.cells[0].value)).toEqual([3, 4, 5]);
  });

  it('includes group rows by default (outline) and can be turned off', () => {
    const src: ExportSource = {
      length: 3,
      rowType: (i) => (i === 0 ? 'group' : 'data'),
      item: (i) => (i === 0 ? undefined : items[i - 1]),
      groupRow: (i) =>
        i === 0 ? { group: { name: 'G', itemCount: 2, items } as never, level: 0 } : null,
    };
    // Grouped source → outline grouping on by default, group summary rows kept.
    const def = buildExportData({ columns: cols(), source: src }, {});
    expect(def.rows[0].kind).toBe('group');
    expect(def.outline).toBe(true);
    // Data rows carry an outline level.
    expect(def.rows[1].level).toBe(1);

    // Opt out of both outline and plain group rows → flat data only.
    const flat = buildExportData(
      { columns: cols(), source: src },
      { outlineGroups: false, includeGroups: false },
    );
    expect(flat.rows.every((r) => r.kind === 'data')).toBe(true);
    expect(flat.outline).toBe(false);

    // Plain (non-outline) group text rows.
    const plain = buildExportData(
      { columns: cols(), source: src },
      { outlineGroups: false, includeGroups: true },
    );
    expect(plain.rows[0].kind).toBe('group');
    expect(plain.rows[0].cells[0].text).toContain('G (2)');
    expect(plain.outline).toBe(false);
  });

  it('runs a cellCallback that can mutate value, text, and style', () => {
    const data = buildExportData(
      { columns: cols(), source: flatSource(items) },
      {
        cellCallback: (ctx) => {
          if (ctx.column.key === 'name') {
            ctx.cell.text = ctx.cell.text.toUpperCase();
            ctx.cell.style = { bold: true };
          }
        },
      },
    );
    expect(data.rows[0].cells[1].text).toBe('ALICE');
    expect(data.rows[0].cells[1].style).toEqual({ bold: true });
    // Other columns untouched.
    expect(data.rows[0].cells[0].style).toBeUndefined();
  });

  it('passes the source item and rowKind to the cellCallback', () => {
    const seen: Array<{ kind: string; hasItem: boolean }> = [];
    buildExportData(
      { columns: cols(), source: flatSource(items) },
      { cellCallback: (ctx) => seen.push({ kind: ctx.rowKind, hasItem: ctx.item != null }) },
    );
    expect(seen.every((s) => s.kind === 'data' && s.hasItem)).toBe(true);
  });

  it('runs a headerCallback that rewrites header text', () => {
    const data = buildExportData(
      { columns: cols(), source: flatSource(items) },
      { headerCallback: (ctx) => `<${ctx.text}>` },
    );
    expect(data.columns.map((c) => c.header)).toEqual(['<ID>', '<Name>', '<Active>']);
  });
});

describe('buildExportDataAsync', () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ id: i, name: `n${i}`, active: false }));

  it('produces the same rows as the sync builder', async () => {
    const sync = buildExportData({ columns: cols(), source: flatSource(many) }, {});
    const async = await buildExportDataAsync(
      { columns: cols(), source: flatSource(many) },
      { chunkSize: 5 },
    );
    expect(async.rows.map((r) => r.cells[0].value)).toEqual(sync.rows.map((r) => r.cells[0].value));
  });

  it('reports progress reaching 1', async () => {
    const fractions: number[] = [];
    await buildExportDataAsync(
      { columns: cols(), source: flatSource(many) },
      { chunkSize: 5, onProgress: (f) => fractions.push(f) },
    );
    expect(fractions.length).toBeGreaterThan(0);
    expect(fractions[fractions.length - 1]).toBe(1);
  });

  it('rejects with an AbortError when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      buildExportDataAsync(
        { columns: cols(), source: flatSource(many) },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('buildExportData merges', () => {
  const items = [
    { id: 1, country: 'US', sales: 100 },
    { id: 2, country: 'US', sales: 200 },
    { id: 3, country: 'UK', sales: 300 },
  ];
  const mcols = [
    new Column({ binding: 'id', header: 'ID', dataType: 'Number' }),
    new Column({ binding: 'country', header: 'Country' }),
    new Column({ binding: 'sales', header: 'Sales', dataType: 'Number' }),
  ];
  const src: ExportSource = {
    length: items.length,
    item: (i) => items[i],
    rowType: () => 'data',
    groupRow: () => null,
  };
  // Vertical merge on the country column (grid col 1) for the two US rows.
  const merge = (row: number, col: number) =>
    col === 1 && row <= 1 ? { topRow: 0, bottomRow: 1, leftCol: 1, rightCol: 1 } : null;

  it('records merge spans and blanks non-origin cells', () => {
    const data = buildExportData({ columns: mcols, source: src, merge }, {});
    expect(data.merges).toEqual([{ topRow: 0, bottomRow: 1, leftCol: 1, rightCol: 1 }]);
    // Origin keeps its value; the merged cell below is blanked.
    expect(data.rows[0].cells[1].text).toBe('US');
    expect(data.rows[1].cells[1].text).toBe('');
    expect(data.rows[1].cells[1].value).toBeNull();
  });

  it('remaps merge coordinates when columns are reordered', () => {
    // Export country first, id second → the merged column moves to export-col 0.
    const reordered = [mcols[1], mcols[0], mcols[2]];
    const gridColOf = (ec: number) => [1, 0, 2][ec];
    const data = buildExportData(
      { columns: reordered, source: src, merge, gridColOf },
      {},
    );
    expect(data.merges).toEqual([{ topRow: 0, bottomRow: 1, leftCol: 0, rightCol: 0 }]);
  });
});
