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
| `columnGroups` | `ColumnGroupDef[]` | — | multi-level header groups |
| `groupHeaderRowHeight` | `number` | = `headerHeight` | height of the group-header row |
| `columnGroupAnimation` | `boolean` | `false` | animate group headers on collapse/expand |
| `selectionMode` | `SelectionMode` | `'Cell'` | |
| `headersVisibility` | `HeadersVisibility` | `'All'` | None / Column / Row / All |
| `rowNumbers` | `boolean` | `false` | number the row headers 1, 2, 3… (blank otherwise) |

### ColumnDef

```ts
{ binding, header?, width?, editable?, valueGetter?, valueFormatter? }
```

### ColumnGroupDef

A recursive tree: a node is a **leaf** (`binding`) or a **group** (nested
`columns`). A string in `columns` is shorthand for `{ binding }`.

```ts
{ header?, binding?, columns?: (string | ColumnGroupDef)[],
  collapsed?, collapsible?, collapseTo?, key? }
```

`collapseTo` names the one **descendant** column kept visible while collapsed
(defaults to the first descendant leaf; `null` hides all). See
[10-Column-Groups](./10-Column-Groups.md).

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
| `columnGroups` | resolved column groups (getter) |
| `columnGroupAnimation` | get/set collapse-expand animation |
| `setColumnGroups(defs)` | replace all column groups |
| `addColumnGroup(def)` / `removeColumnGroup(key)` | add / remove one group |
| `toggleColumnGroup(key, collapsed?)` | collapse/expand a group (omit = toggle) |
| `collapseAllColumnGroups()` / `expandAllColumnGroups()` | bulk collapse/expand |
| `export(options?)` | export to csv/xlsx/pdf; returns artifact + metadata |
| `exportAsync(options?)` | async export (chunked, progress, cancelable) |
| `exportData(options?)` | build the format-agnostic export payload only |
| `registerExportFormat(fmt)` | add a custom export format |
| `undo()` / `redo()` | undo stack |
| `refresh()` / `invalidate()` | recompute / redraw |
| `on(type, handler)` | subscribe; returns unsubscribe |
| `dispose()` | tear down, remove listeners/DOM |

## Events

`cellClick`, `cellDoubleClick`, `selectionChanged`, `scrollChanged`,
`cellEditStart`, `cellEditEnd`, `undoStackChanged`,
`columnGroupCollapsing`, `columnGroupCollapsedChanged`, `columnGroupsChanged`,
`exporting`, `exported`.

See [11-Export](./11-Export.md) for the export options and architecture.

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
