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

describe('always editing', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('opens an editor at the active cell automatically after a selection move', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), alwaysEdit: true });
    grid.select(0, 1);
    expect(host.querySelector('.apg-cells input')).not.toBeNull();
  });

  it('does not auto-open an editor without alwaysEdit (regression)', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.select(0, 1);
    expect(host.querySelector('.apg-cells input')).toBeNull();
  });

  it('excludes Boolean columns (still click/Space toggle only)', () => {
    const data = [{ id: 0, active: false }];
    const grid = new Grid(host, { columns: boolColumns, itemsSource: data, alwaysEdit: true });
    grid.select(0, 1);
    expect(host.querySelector('.apg-editor')).toBeNull();
  });

  it('excludes read-only cells', () => {
    const grid = new Grid(host, {
      columns,
      itemsSource: makeRows(5),
      alwaysEdit: true,
      isReadOnly: true,
    });
    grid.select(0, 1);
    expect(host.querySelector('.apg-editor')).toBeNull();
  });

  it('excludes non-editable columns', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), alwaysEdit: true });
    grid.select(0, 0); // 'id' is not editable
    expect(host.querySelector('.apg-editor')).toBeNull();
  });

  it('re-opens the editor at the new cell after moving again', () => {
    const grid = new Grid(host, {
      columns: [
        { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
        { binding: 'name', header: 'Name', width: 160, editable: true },
        { binding: 'extra', header: 'Extra', width: 120, editable: true },
      ],
      itemsSource: makeRows(5).map((r) => ({ ...r, extra: 'e' })),
      alwaysEdit: true,
    });
    grid.select(0, 1);
    let input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.value).toBe('n0');

    grid.select(0, 2);
    input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.value).toBe('e');
  });
});

describe('editing a second cell while one is already open', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('commits the first cell and transfers editing to the new one', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      { binding: 'name', header: 'Name', width: 160, editable: true },
      { binding: 'extra', header: 'Extra', width: 120, editable: true },
    ];
    const data = [
      { id: 0, name: 'n0', extra: 'e0' },
      { id: 1, name: 'n1', extra: 'e1' },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data });

    grid.editCell(0, 1);
    let input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'changed';

    grid.editCell(0, 2); // moves on without an explicit blur/Enter first

    expect(data[0].name).toBe('changed'); // first cell committed
    input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.value).toBe('e0'); // now editing the second cell
  });

  it('calling editCell on the same cell again is a no-op', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'not yet committed';

    grid.editCell(0, 1);

    expect(host.querySelector('.apg-cells input')).toBe(input); // same editor instance, untouched
    expect(input.value).toBe('not yet committed');
  });
});

describe('highlight edits', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  function commitViaEnter(host: HTMLElement, value: string): void {
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  it('does not mark a cell edited by default (highlightEdits off)', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.editCell(0, 1);
    commitViaEnter(host, 'changed');
    grid.editCell(1, 1); // force a redraw pass in case update batches
    expect(host.querySelector('.apg-cell-edited')).toBeNull();
  });

  it('marks a cell edited once its value differs from the original', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), highlightEdits: true });
    expect(grid.isCellEdited(0, 1)).toBe(false);

    grid.editCell(0, 1);
    commitViaEnter(host, 'changed');

    expect(grid.isCellEdited(0, 1)).toBe(true);
    expect(host.querySelector('.apg-cell-edited')).not.toBeNull();
  });

  it('unmarks a cell when its value is edited back to the original', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), highlightEdits: true });
    grid.editCell(0, 1);
    commitViaEnter(host, 'changed');
    expect(grid.isCellEdited(0, 1)).toBe(true);

    grid.editCell(0, 1);
    commitViaEnter(host, 'n0'); // back to the original value
    expect(grid.isCellEdited(0, 1)).toBe(false);
  });

  it('clears the highlight on undo (recomputed from the snapshot, not a sticky flag)', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), highlightEdits: true });
    grid.editCell(0, 1);
    commitViaEnter(host, 'changed');
    expect(grid.isCellEdited(0, 1)).toBe(true);

    grid.undo();
    expect(grid.isCellEdited(0, 1)).toBe(false);
  });

  it('clearEditHighlights() drops all tracked edits', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5), highlightEdits: true });
    grid.editCell(0, 1);
    commitViaEnter(host, 'changed');
    expect(grid.isCellEdited(0, 1)).toBe(true);

    grid.clearEditHighlights();
    expect(grid.isCellEdited(0, 1)).toBe(false);
    expect(host.querySelector('.apg-cell-edited')).toBeNull();
  });
});

describe('event-based validation (cellEditEnding.stayInEditMode)', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  it('cancel alone still closes and reverts, unchanged (regression)', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.on('cellEditEnding', (e) => (e.cancel = true));

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'rejected';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(host.querySelector('.apg-editor')).toBeNull();
    expect(grid.collectionView.items[0].name).toBe('n0');
  });

  it('cancel + stayInEditMode keeps the editor open with the rejected text', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    let ended = 0;
    grid.on('cellEditEnding', (e) => {
      e.cancel = true;
      e.stayInEditMode = true;
    });
    grid.on('cellEditEnded', () => ended++);
    grid.on('cellEditEnd', () => ended++);

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'rejected';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(host.querySelector('.apg-editor')).not.toBeNull(); // still open
    expect(input.value).toBe('rejected'); // rejected text preserved
    expect(grid.collectionView.items[0].name).toBe('n0'); // not committed
    expect(ended).toBe(0); // no cellEditEnded/cellEditEnd until a valid commit
  });

  it('a subsequent valid value commits normally after a stay-open rejection', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.on('cellEditEnding', (e) => {
      if (e.value === 'bad') {
        e.cancel = true;
        e.stayInEditMode = true;
      }
    });

    grid.editCell(0, 1);
    let input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'bad';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(host.querySelector('.apg-editor')).not.toBeNull();

    input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'good';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(host.querySelector('.apg-editor')).toBeNull();
    expect(grid.collectionView.items[0].name).toBe('good');
  });

  it('a quick-edit arrow key does not move the selection when the commit stays open', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.on('cellEditEnding', (e) => {
      e.cancel = true;
      e.stayInEditMode = true;
    });
    grid.select(0, 1);

    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

    expect(host.querySelector('.apg-editor')).not.toBeNull(); // still editing cell (0,1)
    expect(grid.selectedCell).toEqual({ row: 0, col: 1 }); // selection did not move
  });
});

describe('CollectionView-style validation (getError)', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  const numberColumns = [
    { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
    { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number' as const, editable: true },
  ];

  function commit(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }

  it('rejects with parsing=true when the text fails to coerce, and stays open', () => {
    // A native <input type="number"> sanitizes non-numeric text to '' before
    // it's ever read (real browsers and jsdom both do this), so a genuine
    // coercion failure can't be typed through the built-in Number editor in
    // this harness — Column.tryParse's ok:false branch is covered directly
    // in Column.test.ts. This exercises the same getError/parsing wiring
    // through a text column instead, where invalid text really does reach it.
    const calls: Array<{ value: unknown; parsing: boolean }> = [];
    const dateColumns = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      { binding: 'due', header: 'Due', width: 120, dataType: 'Date' as const, editable: true },
    ];
    const grid = new Grid(host, {
      columns: dateColumns,
      itemsSource: [{ id: 0, due: new Date('2024-01-01') }],
      getError: (ctx, parsing) => {
        calls.push({ value: ctx.value, parsing });
        return parsing ? 'Not a date' : null;
      },
    });

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    // <input type="date"> also sanitizes, so set the value directly (bypassing
    // the sanitizer) to simulate text that reaches the parser as malformed —
    // this exercises tryParse's ok:false path through EditorManager.commit().
    Object.defineProperty(input, 'value', { value: 'not-a-date', writable: true });
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(calls).toEqual([{ value: 'not-a-date', parsing: true }]);
    expect(host.querySelector('.apg-editor')).not.toBeNull();
    expect(grid.collectionView.items[0].due).toEqual(new Date('2024-01-01'));
  });

  it('rejects with parsing=false for a value that parses fine but fails a business rule', () => {
    const calls: Array<{ value: unknown; parsing: boolean }> = [];
    const grid = new Grid(host, {
      columns: numberColumns,
      itemsSource: [{ id: 0, sales: 10 }],
      getError: (ctx, parsing) => {
        calls.push({ value: ctx.value, parsing });
        return typeof ctx.value === 'number' && ctx.value < 0 ? 'Must be positive' : null;
      },
    });

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    commit(input, '-5');

    expect(calls).toEqual([{ value: -5, parsing: false }]);
    expect(host.querySelector('.apg-editor')).not.toBeNull();
    expect(grid.collectionView.items[0].sales).toBe(10);
  });

  it('commits normally when getError returns null', () => {
    const grid = new Grid(host, {
      columns: numberColumns,
      itemsSource: [{ id: 0, sales: 10 }],
      getError: () => null,
    });

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    commit(input, '20');

    expect(host.querySelector('.apg-editor')).toBeNull();
    expect(grid.collectionView.items[0].sales).toBe(20);
  });

  it('does not call getError when the value did not change (regression guard)', () => {
    let called = false;
    const grid = new Grid(host, {
      columns: numberColumns,
      itemsSource: [{ id: 0, sales: 10 }],
      getError: () => {
        called = true;
        return null;
      },
    });

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    commit(input, '10'); // same as the original value

    expect(called).toBe(false);
    expect(host.querySelector('.apg-editor')).toBeNull();
  });
});
