import { describe, it, expect, beforeEach } from 'vitest';
import { Grid } from './Grid';
import { CellEditor } from '../editing/CellEditor';

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

  it('keeps an open editor over its cell when the grid scrolls', () => {
    // Regression: the editor was placed once at open time and never moved
    // again, while the rows around it are redrawn at new offsets on every
    // scroll. It drifted a full scroll delta away from its own cell —
    // visible when an arrow key at the viewport edge scrolls the grid, since
    // select() opens the editor before scrollIntoView runs.
    const grid = new Grid(host, { columns, itemsSource: makeRows(1000), rowHeight: 24 });
    const vp = host.querySelector('.apg-viewport') as HTMLElement;
    vp.scrollTop = 24 * 100;
    grid.editCell(102, 1);

    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.style.transform).toContain('translate3d(80px, 48px, 0)');

    vp.scrollTop = 24 * 102; // rowTop(102) is now exactly the scroll offset
    vp.dispatchEvent(new Event('scroll'));
    expect(input.style.transform).toContain('translate3d(80px, 0px, 0)');
  });

  it('scrolls one row at a time when arrowing past the last visible row', () => {
    // Regression: opening the editor focuses its input, and the browser then
    // scrolls that input into view on its own. The editor is transform-placed
    // inside a pinned panel, so the browser's reckoning of where it sits is
    // wrong and the viewport jumped instead of advancing a single row. The
    // grid does its own minimal scrollIntoView, so the editors must focus with
    // preventScroll and leave scrolling alone.
    const focused: Array<FocusOptions | undefined> = [];
    const realFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function (opts?: FocusOptions) {
      focused.push(opts);
      return realFocus.call(this, opts);
    };
    try {
      const grid = new Grid(host, {
        columns,
        itemsSource: makeRows(1000),
        rowHeight: 24,
        alwaysEdit: true,
      });
      grid.select(10, 1);
      expect(focused.some((o) => o?.preventScroll === true)).toBe(true);
      void grid;
    } finally {
      HTMLElement.prototype.focus = realFocus;
    }
  });

  it('advances the scroll by exactly one row at the bottom edge', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(1000), rowHeight: 24 });
    const vp = host.querySelector('.apg-viewport') as HTMLElement;
    // jsdom reports clientHeight 0, so stub the metric the scroll math reads.
    // The 28px column header sits inside the viewport, so 268 leaves exactly
    // ten 24px rows of data area.
    Object.defineProperty(vp, 'clientHeight', { value: 268, configurable: true });
    vp.scrollTop = 0;

    grid.select(9, 1); // last fully visible row — already in view, no scroll
    expect(vp.scrollTop).toBe(0);

    grid.select(10, 1); // one past it
    expect(vp.scrollTop).toBe(24); // exactly one row, not a jump
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

  it('moves on to the next cell when the open editor has no blur-to-commit', () => {
    // Regression: begin() settled the previous edit by blurring
    // document.activeElement, which only ever worked because the built-in
    // editors happen to commit on their input's blur. An editor that doesn't
    // (any custom CellEditor, or a built-in whose input never took focus
    // because the window was inactive) stayed open, and begin() then bailed
    // out — so the next cell silently never entered edit mode at all.
    let opens = 0;
    const held: CellEditor = {
      open: () => {
        opens++;
      },
      close: () => {},
    };
    const grid = new Grid(host, {
      columns: [
        { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
        { binding: 'name', header: 'Name', width: 160, editable: true, editor: () => held },
        { binding: 'extra', header: 'Extra', width: 120, editable: true, editor: () => held },
      ],
      itemsSource: makeRows(3).map((r) => ({ ...r, extra: 'e' })),
      alwaysEdit: true,
    });

    grid.select(0, 1);
    expect(opens).toBe(1);

    grid.select(0, 2); // the stuck editor must not block this
    expect(opens).toBe(2);
  });

  it('arrow keys commit and move on to the next cell instead of moving the caret', () => {
    // Regression: always-edit opened in 'full' mode, so the editor swallowed
    // arrow keys for caret movement and the selection could never leave the
    // cell — making the mode unusable with the keyboard.
    const grid = new Grid(host, {
      columns: [
        { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
        { binding: 'name', header: 'Name', width: 160, editable: true },
      ],
      itemsSource: makeRows(3),
      alwaysEdit: true,
    });

    grid.select(0, 1);
    let input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'edited';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(grid.collectionView.items[0].name).toBe('edited'); // committed
    expect(grid.selectedCell).toEqual({ row: 1, col: 1 }); // and moved
    input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input).not.toBeNull(); // new cell is editing too
    expect(input.value).toBe('n1');
  });

  it('stays in edit mode when an arrow key hits the first row', () => {
    // Regression: ArrowUp on row 0 committed and closed the editor, but the
    // move clamped to the same cell so applyMove bailed out and nothing
    // re-opened it — the cell was left stranded out of edit mode.
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), alwaysEdit: true });
    grid.select(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(grid.selectedCell).toEqual({ row: 0, col: 1 }); // clamped, didn't move
    expect(host.querySelector('.apg-cells input')).not.toBeNull(); // still editing
  });

  it('keeps keyboard focus on the grid when an edge move ends the edit', () => {
    // Regression: committing removes the input from the DOM, orphaning focus
    // on <body>. Without alwaysEdit re-opening an editor, the grid stopped
    // receiving keys and the page scrolled on the next arrow press instead.
    const grid = new Grid(host, { columns, itemsSource: makeRows(3) });
    grid.select(0, 1);
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', bubbles: true }));
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));

    expect(host.querySelector('.apg-cells input')).toBeNull(); // edit ended
    expect(document.activeElement).toBe(host); // but the grid can still be driven

    // And the grid really does still respond to the keyboard.
    host.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(grid.selectedCell).toEqual({ row: 1, col: 1 });
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

  it('marks the editor invalid with a tooltip when errorMessage is set alongside stayInEditMode', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.on('cellEditEnding', (e) => {
      e.cancel = true;
      e.stayInEditMode = true;
      e.errorMessage = 'That value is not allowed';
    });

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'rejected';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(input.classList.contains('apg-editor-invalid')).toBe(true);
    expect(input.title).toBe('That value is not allowed');
  });

  it('clears the invalid mark once a subsequent value commits', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(5) });
    grid.on('cellEditEnding', (e) => {
      if (e.value === 'bad') {
        e.cancel = true;
        e.stayInEditMode = true;
        e.errorMessage = 'Bad value';
      }
    });

    grid.editCell(0, 1);
    let input = host.querySelector('.apg-cells input') as HTMLInputElement;
    input.value = 'bad';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(input.classList.contains('apg-editor-invalid')).toBe(true);

    input.value = 'good';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    grid.editCell(1, 1); // reopen the same shared TextEditor instance on a new cell
    input = host.querySelector('.apg-cells input') as HTMLInputElement;
    expect(input.classList.contains('apg-editor-invalid')).toBe(false);
    expect(input.title).toBe('');
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

  it('traps the selection on the cell until the value is valid', () => {
    // Regression: a rejected value kept its editor open, but nothing stopped
    // the selection moving — clicking or arrowing to another cell walked the
    // active cell away and left the invalid editor stranded on the old one.
    const rows = [
      { id: 0, sales: 10 },
      { id: 1, sales: 20 },
    ];
    const grid = new Grid(host, {
      columns: numberColumns,
      itemsSource: rows,
      getError: (ctx) =>
        typeof ctx.value === 'number' && ctx.value < 0 ? 'Sales cannot be negative' : null,
    });

    grid.select(0, 1);
    grid.editCell(0, 1);
    commit(host.querySelector('.apg-cells input') as HTMLInputElement, '-5');
    expect(host.querySelector('.apg-editor')).not.toBeNull(); // held open

    grid.select(1, 1); // try to walk away
    expect(grid.selectedCell).toEqual({ row: 0, col: 1 }); // refused
    expect(host.querySelector('.apg-editor')).not.toBeNull(); // still on the bad cell
    expect(rows[0].sales).toBe(10); // nothing committed
  });

  it('frees the selection once the value is fixed', () => {
    const rows = [
      { id: 0, sales: 10 },
      { id: 1, sales: 20 },
    ];
    const grid = new Grid(host, {
      columns: numberColumns,
      itemsSource: rows,
      getError: (ctx) =>
        typeof ctx.value === 'number' && ctx.value < 0 ? 'Sales cannot be negative' : null,
    });

    grid.select(0, 1);
    grid.editCell(0, 1);
    commit(host.querySelector('.apg-cells input') as HTMLInputElement, '-5');
    grid.select(1, 1);
    expect(grid.selectedCell).toEqual({ row: 0, col: 1 }); // trapped

    commit(host.querySelector('.apg-cells input') as HTMLInputElement, '99'); // fix it
    expect(rows[0].sales).toBe(99);

    grid.select(1, 1);
    expect(grid.selectedCell).toEqual({ row: 1, col: 1 }); // free to move now
  });

  it('lets Escape discard a rejected value and move on', () => {
    // Without this the user would be permanently stuck on a cell they cannot
    // satisfy (a rule no input can pass, say).
    const rows = [
      { id: 0, sales: 10 },
      { id: 1, sales: 20 },
    ];
    const grid = new Grid(host, {
      columns: numberColumns,
      itemsSource: rows,
      getError: () => 'never valid',
    });

    grid.select(0, 1);
    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    commit(input, '-5');
    expect(host.querySelector('.apg-editor')).not.toBeNull();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.querySelector('.apg-editor')).toBeNull();
    expect(rows[0].sales).toBe(10); // reverted

    grid.select(1, 1);
    expect(grid.selectedCell).toEqual({ row: 1, col: 1 }); // no longer trapped
  });

  it('marks the editor invalid with the getError message as a tooltip', () => {
    const grid = new Grid(host, {
      columns: numberColumns,
      itemsSource: [{ id: 0, sales: 10 }],
      getError: (ctx) =>
        typeof ctx.value === 'number' && ctx.value < 0 ? 'Must be positive' : null,
    });

    grid.editCell(0, 1);
    const input = host.querySelector('.apg-cells input') as HTMLInputElement;
    commit(input, '-5');

    expect(input.classList.contains('apg-editor-invalid')).toBe(true);
    expect(input.title).toBe('Must be positive');
  });
});

describe('custom editors', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  // A minimal custom editor: takes the commit/cancel callbacks EditorManager
  // hands every editor (same contract the built-ins use), and exposes them so
  // the test can drive a commit/cancel directly instead of simulating DOM input.
  class FakeEditor implements CellEditor {
    openCalls: Array<{ rect: DOMRect }> = [];
    closeCalls = 0;

    constructor(
      private onCommit: (value: string) => void,
      private onCancel: () => void,
    ) {}

    open(_parent: HTMLElement, _column: unknown, _item: unknown, rect: DOMRect): void {
      this.openCalls.push({ rect });
    }

    close(): void {
      this.closeCalls++;
    }

    commit(value: string): void {
      this.onCommit(value);
    }

    cancel(): void {
      this.onCancel();
    }
  }

  it('uses the column.editor factory instead of the built-in text editor', () => {
    let editor: FakeEditor | undefined;
    const cols = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      {
        binding: 'name',
        header: 'Name',
        width: 160,
        editable: true,
        editor: (commit: (v: string) => void, cancel: () => void) => {
          editor = new FakeEditor(commit, cancel);
          return editor;
        },
      },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: makeRows(5) });

    grid.editCell(0, 1);

    expect(editor).toBeDefined();
    expect(editor!.openCalls.length).toBe(1);
    expect(host.querySelector('.apg-editor')).toBeNull(); // no built-in TextEditor rendered
  });

  it('receives the correct cell rect, and its commit runs through undo/redo', () => {
    let editor: FakeEditor | undefined;
    const data = [{ id: 0, name: 'n0' }];
    const cols = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      {
        binding: 'name',
        header: 'Name',
        width: 160,
        editable: true,
        editor: (commit: (v: string) => void, cancel: () => void) => {
          editor = new FakeEditor(commit, cancel);
          return editor;
        },
      },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data });

    grid.editCell(0, 1);
    const rect = editor!.openCalls[0].rect;
    expect(rect.left).toBe(80); // after the 80px id column
    expect(rect.top).toBe(0);

    editor!.commit('edited');

    expect(data[0].name).toBe('edited');
    expect(editor!.closeCalls).toBe(1);
    expect(grid.canUndo).toBe(true);

    grid.undo();
    expect(data[0].name).toBe('n0');
  });

  it('reuses the same custom editor instance across edits (one per column)', () => {
    const instances: FakeEditor[] = [];
    const cols = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      {
        binding: 'name',
        header: 'Name',
        width: 160,
        editable: true,
        editor: (commit: (v: string) => void, cancel: () => void) => {
          const e = new FakeEditor(commit, cancel);
          instances.push(e);
          return e;
        },
      },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: makeRows(5) });

    grid.editCell(0, 1);
    instances[0].commit('a');
    grid.editCell(1, 1);
    instances[0].commit('b');

    expect(instances.length).toBe(1); // factory only called once
  });

  it('cancel does not commit a value', () => {
    let editor: FakeEditor | undefined;
    const data = [{ id: 0, name: 'n0' }];
    const cols = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      {
        binding: 'name',
        header: 'Name',
        width: 160,
        editable: true,
        editor: (commit: (v: string) => void, cancel: () => void) => {
          editor = new FakeEditor(commit, cancel);
          return editor;
        },
      },
    ];
    const grid = new Grid(host, { columns: cols, itemsSource: data });

    grid.editCell(0, 1);
    editor!.cancel();

    expect(data[0].name).toBe('n0');
    expect(editor!.closeCalls).toBe(1);
  });
});

describe('popup editors', () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  function openPopup(host: HTMLElement, row: number): void {
    const btn = host.querySelector(`.apg-rowheader-edit[data-popup-row="${row}"]`) as HTMLElement;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  it('centers the popup on the grid, not on the row-header pencil button', () => {
    // Regression: the popup was anchored to the pencil button, which sits at
    // the grid's far-left edge — so a 260px form opened in the corner, half
    // covering the rows it edits.
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    host.getBoundingClientRect = () => new DOMRect(100, 50, 800, 400);

    openPopup(host, 0);
    const dialog = document.querySelector('.apg-edit-popup') as HTMLElement;
    // jsdom gives the dialog a 0x0 rect, so the centered position collapses to
    // the midpoint of the bounds — enough to prove it centers on the grid
    // rather than tracking the button's left edge.
    expect(dialog.style.left).toBe('500px'); // 100 + 800 / 2
    expect(dialog.style.top).toBe('250px'); // 50 + 400 / 2
    void grid;
  });

  it('keeps the popup on screen when the grid is larger than the window', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    host.getBoundingClientRect = () => new DOMRect(-4000, -3000, 9000, 9000);

    openPopup(host, 0);
    const dialog = document.querySelector('.apg-edit-popup') as HTMLElement;
    expect(parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(8);
    expect(parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(8);
    void grid;
  });

  it('shows a pencil button per data row only when popupEditors is on', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    expect(host.querySelectorAll('.apg-rowheader-edit').length).toBe(3);
    void grid;
  });

  it('does not show a pencil button by default', () => {
    new Grid(host, { columns, itemsSource: makeRows(3) });
    expect(host.querySelectorAll('.apg-rowheader-edit').length).toBe(0);
  });

  it('opens the popup with the row current values and the full lifecycle event order', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    const order: string[] = [];
    grid.on('rowEditStarting', () => order.push('rowEditStarting'));
    grid.on('rowEditStarted', () => order.push('rowEditStarted'));
    grid.on('rowEditEnding', () => order.push('rowEditEnding'));
    grid.on('rowEditEnded', () => order.push('rowEditEnded'));

    openPopup(host, 1);

    const dialog = document.querySelector('.apg-edit-popup') as HTMLElement;
    expect(dialog).not.toBeNull();
    const input = dialog.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('n1');

    const saveBtn = dialog.querySelector('.apg-edit-popup-save') as HTMLButtonElement;
    input.value = 'edited';
    saveBtn.click();

    expect(grid.collectionView.items[1].name).toBe('edited');
    expect(document.querySelector('.apg-edit-popup')).toBeNull();
    expect(order).toEqual(['rowEditStarting', 'rowEditStarted', 'rowEditEnding', 'rowEditEnded']);
  });

  it('Cancel restores the original values and does not commit', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    openPopup(host, 0);

    const dialog = document.querySelector('.apg-edit-popup') as HTMLElement;
    const input = dialog.querySelector('input') as HTMLInputElement;
    input.value = 'should not stick';
    (dialog.querySelector('.apg-edit-popup-cancel') as HTMLButtonElement).click();

    expect(grid.collectionView.items[0].name).toBe('n0');
    expect(document.querySelector('.apg-edit-popup')).toBeNull();
  });

  it('Escape also cancels', async () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    openPopup(host, 0);
    const dialog = document.querySelector('.apg-edit-popup') as HTMLElement;
    (dialog.querySelector('input') as HTMLInputElement).value = 'nope';

    // The outside-click/Escape/scroll listeners attach on a deferred timeout
    // (so the same click that opened the popup doesn't also close it).
    await new Promise((resolve) => setTimeout(resolve, 0));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(grid.collectionView.items[0].name).toBe('n0');
    expect(document.querySelector('.apg-edit-popup')).toBeNull();
  });

  it('one Ctrl+Z after Save reverts every field changed in that save', () => {
    const cols = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      { binding: 'name', header: 'Name', width: 160, editable: true },
      { binding: 'extra', header: 'Extra', width: 120, editable: true },
    ];
    const data = [{ id: 0, name: 'n0', extra: 'e0' }];
    const grid = new Grid(host, { columns: cols, itemsSource: data, popupEditors: true });

    openPopup(host, 0);
    const dialog = document.querySelector('.apg-edit-popup') as HTMLElement;
    const inputs = dialog.querySelectorAll('input');
    (inputs[0] as HTMLInputElement).value = 'name2';
    (inputs[1] as HTMLInputElement).value = 'extra2';
    (dialog.querySelector('.apg-edit-popup-save') as HTMLButtonElement).click();

    expect(data[0].name).toBe('name2');
    expect(data[0].extra).toBe('extra2');
    expect(grid.canUndo).toBe(true);

    grid.undo();

    expect(data[0].name).toBe('n0');
    expect(data[0].extra).toBe('e0');
  });

  it('rowEditStarting can be cancelled to block opening the popup', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    grid.on('rowEditStarting', (e) => (e.cancel = true));

    openPopup(host, 0);

    expect(document.querySelector('.apg-edit-popup')).toBeNull();
  });

  it('rowEditEnding can be cancelled to reject the save (cancels the edit transaction instead)', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    grid.on('rowEditEnding', (e) => (e.cancel = true));

    openPopup(host, 0);
    const dialog = document.querySelector('.apg-edit-popup') as HTMLElement;
    (dialog.querySelector('input') as HTMLInputElement).value = 'blocked';
    (dialog.querySelector('.apg-edit-popup-save') as HTMLButtonElement).click();

    expect(grid.collectionView.items[0].name).toBe('n0');
    expect(document.querySelector('.apg-edit-popup')).toBeNull();
  });

  it('scrolling the grid while the popup is open closes it', async () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    openPopup(host, 0);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const vp = host.querySelector('.apg-viewport') as HTMLElement;
    vp.dispatchEvent(new Event('scroll', { bubbles: true }));

    expect(document.querySelector('.apg-edit-popup')).toBeNull();
    expect(grid.collectionView.items[0].name).toBe('n0');
  });

  it('does not commit unchanged fields (no EditAction pushed when nothing changed)', () => {
    const grid = new Grid(host, { columns, itemsSource: makeRows(3), popupEditors: true });
    openPopup(host, 0);
    const dialog = document.querySelector('.apg-edit-popup') as HTMLElement;
    (dialog.querySelector('.apg-edit-popup-save') as HTMLButtonElement).click(); // no field touched

    expect(grid.canUndo).toBe(false);
  });
});
