# API Reference

`@avi-pathak/apgrid` — public API. Import the grid and its stylesheet:

```ts
import { Grid } from '@avi-pathak/apgrid';
import '@avi-pathak/apgrid/styles.css';
```

`Grid` is also exported as `ApGrid`.

## Constructor

```ts
new Grid(host: string | HTMLElement, options: GridOptions)
```

Throws if a string selector matches nothing.

## GridOptions

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `columns` | `ColumnDef[]` | — | required |
| `itemsSource` | `T[]` | `[]` | the data |
| `dataSource` | `T[]` | — | alias for `itemsSource` (legacy) |
| `rowHeight` | `number` | 24 | |
| `headerHeight` | `number` | 28 | |
| `rowHeaderWidth` | `number` | 48 | |
| `selectionMode` | `SelectionMode` | `'Cell'` | |
| `headersVisibility` | `HeadersVisibility` | `'All'` | None / Column / Row / All |

### ColumnDef

```ts
{ binding, header?, width?, editable?, valueGetter?, valueFormatter? }
```

## Properties

| Member | Type | |
| --- | --- | --- |
| `selectedCell` | `CellAddress \| null` | active cell |
| `selection` | `CellRange \| null` | highlighted rectangle |
| `selectionMode` | `SelectionMode` | get / set |
| `canUndo` / `canRedo` | `boolean` | undo state |

## Methods

| Method | Purpose |
| --- | --- |
| `select(row, col, extend?)` | select / extend, scroll into view |
| `scrollTo(row, col?)` | scroll a cell into view |
| `setData(items)` | replace data, refresh |
| `addColumn(def, index?)` / `removeColumn(index)` | columns |
| `editCell(row, col)` | begin editing (if editable) |
| `resizeColumn(index, width)` | resize (undoable) |
| `undo()` / `redo()` | undo stack |
| `refresh()` / `invalidate()` | recompute / redraw |
| `on(type, handler)` | subscribe; returns unsubscribe |
| `dispose()` | tear down, remove listeners/DOM |

## Events

`cellClick`, `cellDoubleClick`, `selectionChanged`, `scrollChanged`,
`cellEditStart`, `cellEditEnd`, `undoStackChanged`.

```ts
const off = grid.on('selectionChanged', (cell) => console.log(cell));
off();
```

## SelectionMode

`None` · `Cell` · `CellRange` · `Row` · `RowRange` · `Column` · `ColumnRange`

## Example

```ts
const grid = new Grid('#grid', {
  columns: [
    { binding: 'id', header: 'ID', width: 60 },
    { binding: 'name', header: 'Name', width: 160, editable: true },
  ],
  itemsSource: data,
  selectionMode: 'CellRange',
});
grid.on('undoStackChanged', ({ canUndo }) => (undoBtn.disabled = !canUndo));
grid.select(0, 1);
```
