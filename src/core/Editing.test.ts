import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid';

function makeRows(n: number) {
  const rows = [];
  for (let i = 0; i < n; i++) rows.push({ id: i, name: `n${i}` });
  return rows;
}

const columns = [
  { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
  { binding: 'name', header: 'Name', width: 160, editable: true },
];

describe('editing position', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('places the editor at the row offset from the current scroll', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(1000), rowHeight: 24 });

    // Scroll down, then edit a visible row; the body is pinned, so the editor
    // must be placed at rowTop - scrollTop, not at the absolute rowTop.
    const vp = host.querySelector('.apg-viewport') as HTMLElement;
    vp.scrollTop = 24 * 100;

    grid.editCell(102, 1);

    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input).not.toBeNull();
    // rowTop(102)=2448, scrollTop=2400 -> 48px inside the pinned panel.
    expect(input.style.transform).toContain('translate3d(80px, 48px, 0)');
  });

  it('edits a cell value through the editor', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(20), rowHeight: 24 });
    grid.editCell(2, 1);

    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'edited';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(grid.collectionView.items[2].name).toBe('edited');
  });
});
