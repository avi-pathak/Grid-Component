import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid';

function makeRows(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ id: i, name: `r${i}`, city: `c${i}` });
  return rows;
}

const columns = [
  { binding: 'id', header: 'ID', width: 80 },
  { binding: 'name', header: 'Name', width: 120 },
  { binding: 'city', header: 'City', width: 120 },
];

describe('freeze', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('pins columns from the frozenColumns option', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(50), frozenColumns: 1 });
    expect(grid.frozenColumns).toBe(1);

    const band = host.querySelector('.apg-frozen-cols') as HTMLElement;
    expect(band.style.display).not.toBe('none');
    const cells = band.querySelectorAll('.apg-cell');
    expect(cells.length).toBeGreaterThan(0);
    expect(cells[0].textContent).toBe('0');
  });

  it('pins rows from the frozenRows option', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(50), frozenRows: 2 });
    expect(grid.frozenRows).toBe(2);

    const band = host.querySelector('.apg-frozen-rows') as HTMLElement;
    expect(band.style.display).not.toBe('none');
    expect(band.querySelectorAll('.apg-frozen-cell-row').length).toBe(2);
  });

  it('shows the corner when rows and columns are both frozen', () => {
    new Grid(host, { columns, itemsSource: makeRows(50), frozenColumns: 1, frozenRows: 1 });
    const corner = host.querySelector('.apg-frozen-corner') as HTMLElement;
    expect(corner.style.display).not.toBe('none');
    expect(corner.querySelectorAll('.apg-cell').length).toBe(1);
  });

  it('freezeColumns updates the count and emits frozenColumnsChanged', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(50) });
    const events: number[] = [];
    grid.on('frozenColumnsChanged', (e) => events.push(e.count));

    grid.freezeColumns(2);

    expect(grid.frozenColumns).toBe(2);
    expect(events).toEqual([2]);
  });

  it('freezingColumns can be cancelled', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(50) });
    grid.on('freezingColumns', (e) => (e.cancel = true));

    grid.freezeColumns(2);

    expect(grid.frozenColumns).toBe(0);
  });

  it('freezeRows updates the count and emits frozenRowsChanged', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(50) });
    const events: number[] = [];
    grid.on('frozenRowsChanged', (e) => events.push(e.count));

    grid.freezeRows(3);

    expect(grid.frozenRows).toBe(3);
    expect(events).toEqual([3]);
  });

  it('clamps the freeze count to the grid size', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(50) });
    grid.freezeColumns(99);
    expect(grid.frozenColumns).toBe(columns.length);
  });

  it('unfreezes and hides the band when set back to 0', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(50), frozenColumns: 2 });
    grid.freezeColumns(0);

    expect(grid.frozenColumns).toBe(0);
    const band = host.querySelector('.apg-frozen-cols') as HTMLElement;
    expect(band.style.display).toBe('none');
  });
});
