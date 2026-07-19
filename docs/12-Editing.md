# 12 — Editing

How cells go from display to an editable value and back. This is the running home
for each editing sub-feature as it lands; it starts with what already exists
(Inline Editing, the base event lifecycle) plus the four levels of read-only.

## Inline Editing

The grid has one editing style: an editor overlay opens directly over the active
cell (no popup, no separate row of buttons). [`EditorManager`](../src/editing/EditorManager.ts)
owns the lifecycle — `begin`/`commit`/`cancel` — and picks one of `TextEditor`,
`DropDownEditor`, or `RadioEditor` per column via `editorFor()`. The editor is a
single shared instance per type, positioned with `transform: translate3d(...)` at
the cell's rect, so it tracks the cell while the grid scrolls without adding to the
recycled DOM pool.

## Read-only

Four independent levels, checked in this order by `EditorManager.begin()`:

| Level | How | Notes |
| --- | --- | --- |
| Grid | `grid.isReadOnly = true` (or `GridOptions.isReadOnly`) | Blocks every cell, including Boolean toggles |
| Row | `GridOptions.rowReadOnly: (ctx) => boolean` | `ctx` is `{ item, row }`, same shape as `rowClass`/`rowStyle` |
| Column | `column.editable === false` (the default) | Existing, unchanged |
| Cell | `beginningEdit` event, `e.cancel = true` | Existing, unchanged — for one-off exceptions |

`rowReadOnly` is a predicate rather than a stored flag (unlike Wijmo's `row.isReadOnly`)
because apgrid has no `Row` object — rows are plain items addressed by index through
`DataView`. It follows the same shape as the existing `rowClass`/`rowStyle` options.

```ts
const grid = new Grid('#grid', {
  columns,
  itemsSource: data,
  rowReadOnly: ({ item }) => item.locked === true,
});
grid.isReadOnly = true; // lock everything at runtime
```

Boolean columns are gated the same way: `toggleBoolean()` checks grid- and
row-level read-only before flipping the value, in addition to the existing
`column.editable` check.

## IME (CJK composition safety)

`TextEditor` and `DropDownEditor` track `compositionstart`/`compositionend` on
their input and, while composing (or on a `keyCode === 229` keydown — the
Chrome/Android quirk where the composition-confirming Enter reports
`isComposing: false`), Enter/Escape are left alone instead of committing or
cancelling the cell. Propagation is still stopped either way, so a composition
keystroke (e.g. arrows navigating a candidate list) never leaks into the
grid's own keyboard navigation. This is unconditional — there's no
`imeEnabled` toggle, since correct composition handling has no reason to ever
be off. `RadioEditor` has no free-text input, so it isn't affected.

## PlaceHolders

`column.placeholder` sets explicit placeholder text on the built-in text
editor; `GridOptions.showPlaceholders` falls back to the column's header text
when a column doesn't set its own. An explicit `column.placeholder` always
wins. Scoped to `TextEditor` only — `DropDownEditor`/`RadioEditor` present a
fixed set of choices, so there's no natural "empty state" for a placeholder to
fill.
