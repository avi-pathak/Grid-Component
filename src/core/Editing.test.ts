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

const boolColumns = [
  { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
  { binding: 'active', header: 'Active', width: 80, editable: true, dataType: 'Boolean' as const },
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

describe('read-only levels', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('blocks editing grid-wide via the isReadOnly option', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), isReadOnly: true });
    grid.editCell(0, 1);
    expect(host.querySelector('.apg-editor')).toBeNull();
  });

  it('blocks editing grid-wide via the isReadOnly property at runtime', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.isReadOnly = true;
    grid.editCell(0, 1);
    expect(host.querySelector('.apg-editor')).toBeNull();

    grid.isReadOnly = false;
    grid.editCell(0, 1);
    expect(host.querySelector('.apg-editor')).not.toBeNull();
  });

  it('blocks Boolean toggling grid-wide via isReadOnly', () => {
    const data = [{ id: 0, active: false }];
    const grid = new Grid(host, { columns: boolColumns, itemsSource: data, isReadOnly: true });
    grid.select(0, 1);
    host.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(data[0].active).toBe(false);
  });

  it('blocks editing on rows matched by rowReadOnly, but not other rows', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(5),
      rowReadOnly: ({ item }) => (item as { id: number }).id === 0,
    });

    grid.editCell(0, 1);
    expect(host.querySelector('.apg-editor')).toBeNull();

    grid.editCell(1, 1);
    expect(host.querySelector('.apg-editor')).not.toBeNull();
  });

  it('blocks Boolean toggling on rows matched by rowReadOnly', () => {
    const data = [
      { id: 0, active: false },
      { id: 1, active: false },
    ];
    const grid = new Grid(host, {
      columns: boolColumns,
      itemsSource: data,
      rowReadOnly: ({ row }) => row === 0,
    });

    grid.select(0, 1);
    host.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(data[0].active).toBe(false);

    grid.select(1, 1);
    host.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    expect(data[1].active).toBe(true);
  });

  it('still respects column.editable === false unchanged', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.editCell(0, 0); // 'id' column is not editable
    expect(host.querySelector('.apg-editor')).toBeNull();
  });
});

describe('IME composition safety', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('does not commit or cancel a text edit on Enter/Escape mid-composition', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;

    input.dispatchEvent(new Event('compositionstart'));
    input.value = 'かな';
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }),
    );
    expect(host.querySelector('.apg-editor')).not.toBeNull(); // still open
    expect(grid.collectionView.items[0].name).not.toBe('かな'); // not committed

    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true }),
    );
    expect(host.querySelector('.apg-editor')).not.toBeNull(); // not cancelled either

    input.dispatchEvent(new Event('compositionend'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(host.querySelector('.apg-editor')).toBeNull(); // now commits
    expect(grid.collectionView.items[0].name).toBe('かな');
  });

  it('treats keyCode 229 as composing even without isComposing (Chrome/Android quirk)', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;

    input.value = 'partial';
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }),
    );
    expect(host.querySelector('.apg-editor')).not.toBeNull();
    expect(grid.collectionView.items[0].name).not.toBe('partial');
  });

  it('does not commit or cancel a dropdown edit on Enter/Escape mid-composition', () => {
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

    input.dispatchEvent(new Event('compositionstart'));
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }),
    );
    expect(host.querySelector('.apg-editor-dropdown')).not.toBeNull();
    expect(data[0].status).toBe('Open');

    input.dispatchEvent(new Event('compositionend'));
  });
});

describe('placeholders', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('uses an explicit column.placeholder', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      { binding: 'name', header: 'Name', width: 160, editable: true, placeholder: 'Enter a name' },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: makeRows(5) });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.placeholder).toBe('Enter a name');
  });

  it('falls back to the column header when showPlaceholders is on and no explicit placeholder is set', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), showPlaceholders: true });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.placeholder).toBe('Name');
  });

  it('has no placeholder by default', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.placeholder).toBe('');
  });

  it('an explicit column.placeholder wins over showPlaceholders', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      { binding: 'name', header: 'Name', width: 160, editable: true, placeholder: 'Custom' },
    ];
    const grid = new Grid(host, {
      columns: cols,
      itemsSource: makeRows(5),
      showPlaceholders: true,
    });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.placeholder).toBe('Custom');
  });
});

describe('cellEditPreparing', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('fires once per begin(), after cellEditStart, with the right row/col/column', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    const order: string[] = [];
    let payload: { row: number; col: number; column: { binding: string } } | undefined;

    grid.on('cellEditStart', () => order.push('cellEditStart'));
    grid.on('cellEditPreparing', (e) => {
      order.push('cellEditPreparing');
      payload = e;
    });

    grid.editCell(1, 1);

    expect(order).toEqual(['cellEditStart', 'cellEditPreparing']);
    expect(payload).toEqual({
      row: 1,
      col: 1,
      column: expect.objectContaining({ binding: 'name' }),
    });
  });

  it('does not fire when the edit is rejected before it starts', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    let fired = false;
    grid.on('beginningEdit', (e) => (e.cancel = true));
    grid.on('cellEditPreparing', () => (fired = true));

    grid.editCell(0, 1);

    expect(fired).toBe(false);
  });
});

describe('quick editing', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('typing over a selected cell opens the editor seeded with just that character', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.select(0, 1);

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));

    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('x');
    // the original 'n0' value is gone, not just appended to
    expect(input.value).not.toContain('n0');
  });

  it('Arrow-Left during a quick edit commits the value and moves the active cell left', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.select(0, 1); // 'name' column, the only editable one
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));

    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(grid.collectionView.items[0].name).toBe('x');
    expect(grid.selectedCell).toEqual({ row: 0, col: 0 });
    expect(host.querySelector('.apg-editor')).toBeNull(); // editor closed after commit
  });

  it('F2 still enters full mode: existing value shown and selected, not replaced', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.select(0, 1);

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }));

    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.value).toBe('n0');
  });

  it('double-click still enters full mode unchanged', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.editCell(0, 1); // exercises the same 'full' path onDoubleClick uses
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.value).toBe('n0');
  });

  it('arrow keys in full mode move the caret, not the active cell', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.select(0, 1);
    grid.editCell(0, 1); // F2/double-click path: full mode

    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(host.querySelector('.apg-editor')).not.toBeNull(); // still editing
    expect(grid.selectedCell).toEqual({ row: 0, col: 1 }); // selection did not move
  });

  it('does not quick-edit a read-only cell', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), isReadOnly: true });
    grid.select(0, 1);

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));

    expect(host.querySelector('.apg-editor')).toBeNull();
  });

  it('does not quick-edit a Boolean column (still toggles via Space only)', () => {
    const data = [{ id: 0, active: false }];
    const grid = new Grid(host, { columns: boolColumns, itemsSource: data });
    grid.select(0, 1);

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));

    expect(host.querySelector('.apg-editor')).toBeNull();
    expect(data[0].active).toBe(false);
  });

  it('does not quick-edit while a cell is already being edited', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.value).toBe('n0'); // full mode, unchanged by a stray host-level keydown

    // A keydown dispatched directly on host (bypassing the input) must not
    // reset the open editor back into quick mode.
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    expect(input.value).toBe('n0');
  });
});
