import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid';
import { MergeManager } from '../models/MergeManager';
import { makeRange } from '../models/Cell';

function rows(values: string[]) {
  return values.map((country, i) => ({ id: i, country, sales: i * 10 }));
}

const columns = [
  { binding: 'country', header: 'Country', width: 120, allowMerging: true },
  { binding: 'sales', header: 'Sales', width: 100, dataType: 'Number' as const },
];

describe('cell merging', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('does not merge without allowMerging', () => {
    new Grid(host, {
      columns: [{ binding: 'country', width: 120 }],
      itemsSource: rows(['A', 'A', 'B']),
    });
    expect(host.querySelectorAll('.apg-cell-merged').length).toBe(0);
  });

  it('merges adjacent equal values in a mergeable column', () => {
    new Grid(host, { columns, itemsSource: rows(['A', 'A', 'A', 'B', 'B']) });
    const merged = host.querySelectorAll('.apg-cell-merged');
    // Two spans: A (rows 0-2) and B (rows 3-4).
    expect(merged.length).toBe(2);
    expect((merged[0] as HTMLElement).textContent).toBe('A');
    expect((merged[0] as HTMLElement).style.height).toBe('72px'); // 3 * 24
  });

  it('leaves singletons to the normal renderer', () => {
    new Grid(host, { columns, itemsSource: rows(['A', 'B', 'C']) });
    expect(host.querySelectorAll('.apg-cell-merged').length).toBe(0);
  });

  it('removes the covered cells from the body', () => {
    new Grid(host, { columns, itemsSource: rows(['A', 'A', 'A']) });
    // The country column (col 0) should have no plain body cells left there.
    const bodyCol0 = [...host.querySelectorAll('.apg-cells > .apg-row .apg-cell')].filter(
      (c) => (c as HTMLElement).style.left === '0px',
    );
    expect(bodyCol0.length).toBe(0);
    expect(host.querySelectorAll('.apg-cell-merged').length).toBe(1);
  });

  it('honors a custom merge manager', () => {
    // Merge the sales column into pairs regardless of content.
    const manager: MergeManager = (q) => {
      if (q.col !== 1) return null;
      const top = q.row - (q.row % 2);
      const bottom = Math.min(top + 1, q.rowCount - 1);
      return top === bottom ? null : makeRange(top, 1, bottom, 1);
    };
    new Grid(host, { columns, itemsSource: rows(['A', 'B', 'C', 'D']), mergeManager: manager });
    const merged = host.querySelectorAll('.apg-cell-merged');
    expect(merged.length).toBe(2);
  });
});
