import { describe, it, expect } from 'vitest';
import { Column } from '../models/Column';
import { buildExportData, ExportSource } from './buildExportData';

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

  it('skips group rows unless includeGroups is set', () => {
    const src: ExportSource = {
      length: 3,
      rowType: (i) => (i === 0 ? 'group' : 'data'),
      item: (i) => (i === 0 ? undefined : items[i - 1]),
      groupRow: (i) =>
        i === 0 ? { group: { name: 'G', itemCount: 2, items } as never, level: 0 } : null,
    };
    const without = buildExportData({ columns: cols(), source: src }, {});
    expect(without.rows.every((r) => r.kind === 'data')).toBe(true);

    const withGroups = buildExportData({ columns: cols(), source: src }, { includeGroups: true });
    expect(withGroups.rows[0].kind).toBe('group');
    expect(withGroups.rows[0].cells[0].text).toContain('G (2)');
  });
});
