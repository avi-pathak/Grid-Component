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

## Editing Events

The lifecycle: `beginningEdit` → `cellEditStart` → `cellEditPreparing` →
(user edits) → `cellEditEnding` → `cellEditEnded` → `cellEditEnd`.
`cellEditPreparing` fires right after the editor is positioned and open,
informationally — `{ row, col, column }`, no `cancel` flag. Unlike Wijmo's
`prepareCellForEdit`, it doesn't hand out the live editor instance: apgrid's
editors are shared, recycled internals (one `TextEditor` instance reused
across every text-editable cell), and reaching into one from app code would
break that model. It exists mainly as a hook for Quick Editing internally —
`EditorManager.begin(cell, { mode, initialChar })` and each editor's
`open(..., opts?: EditorOpenOptions)` are how a caller distinguishes "F2/
double-click, show the existing value selected" from "typed a character,
seed the editor with just that."

## Quick Editing

Typing a plain printable character over a selected (not yet editing) cell
starts an edit seeded with just that character, Excel-style — the previous
value is replaced outright rather than appended to. `KeyboardHandler`'s new
`onType` callback fires for any unmodified single-character keydown (no
Ctrl/Alt/Meta) that isn't otherwise a nav key or Space/F2/Enter; `Grid.onType`
skips Boolean columns (still Space-only) and defers the rest — read-only,
non-editable, already-editing — to `EditorManager.begin()`'s existing checks.

While quick-editing, arrow keys commit the value and move the active cell in
that direction instead of moving the caret through the text — reusing the
same `onNav()` path regular keyboard navigation uses, so bounds-clamping and
group-row skipping come for free. F2 and double-click still enter **full**
mode: the existing value shown and fully selected, arrow keys moving the
caret as normal. `DropDownEditor` also honors quick mode (seeds the typed
character and filters the option list by it) but keeps its own arrow-key
behavior (list navigation) — commit-and-move is TextEditor-only, since a
dropdown's arrows are already spoken for.

Deferred (not built): Wijmo's "F2 toggles quick↔full mode for the cell
currently being edited." Fiddly enough to be its own follow-up rather than
part of this pass.

## Always Editing

`GridOptions.alwaysEdit` opens an editor at the active cell automatically
after every selection move — no F2/double-click/typing needed — mirroring
Wijmo's `startEditing()`-from-`selectionChanged` recipe rather than adding a
distinct "always editing" engine mode. Boolean, read-only, and non-editable
columns are excluded the same way every other entry point already is:
`EditorManager.begin()`'s existing checks, not a separate code path.

This exposed a real gap `begin()` had regardless of `alwaysEdit`: calling it
for a *different* cell while one was already open used to silently no-op,
leaving the first cell's edit dangling. `begin()` now settles the previous
edit first — by blurring whatever element currently has focus, which runs
that editor's own existing commit/cancel-on-blur handling — before opening
the new one. Calling `begin()`/`editCell()` again on the *same* cell that's
already open is still a no-op, so it doesn't reset an in-progress edit.

## Highlight Edits

Not a first-class FlexGrid API in Wijmo either — a recipe there (external
map + `formatItem` + explicit clear), so apgrid follows the same shape.
`GridOptions.highlightEdits` turns it on; when it does, `Grid` captures each
edited binding's **original** value the first time it's touched (in the
`beginningEdit` hook, one snapshot per item, lazily — only for bindings
actually edited) into a `WeakMap<item, Record<binding, originalValue>>`, so
removed rows don't leak memory once nothing else references them.

`.apg-cell-edited` is **recomputed on every render** — `column.getValue(item)
!== snapshot[binding]` — rather than a sticky "was edited" flag. That's a
deliberate choice: it means `Ctrl+Z`, or manually typing the original value
back in, clears the highlight for free, with no special-case hook into
`EditAction`/`UndoStack`. `grid.isCellEdited(row, col)` reads it directly;
`grid.clearEditHighlights()` drops all tracked snapshots (a fresh `WeakMap`)
and redraws. Composes with the existing `cellClassRules`/`cellClass` system
rather than replacing it, and layers under cell selection so a selected +
edited cell shows the selection color, not both.

## Validation — event-based

`cellEditEnding` already had `cancel`; it now also takes `stayInEditMode`
(only meaningful alongside `cancel = true`). Plain `cancel` behaves as
before — the editor closes and the value reverts. `cancel` +
`stayInEditMode` instead leaves the editor open with the rejected text still
in it, so the user fixes it in place rather than losing what they typed;
pressing Enter/blurring again re-runs the same validation.

Internally this meant reordering `EditorManager.commit()` — it used to close
the editor unconditionally before checking whether the value should commit,
which doesn't work if closing has to become conditional. It now only closes
once it knows the outcome (no-op, rejected-and-closing, or committed).

Building Quick Editing's arrow-commit-and-move on top of this surfaced a
second interaction: an arrow key during a rejected-and-stayed-open commit
must not also move the active cell away from the editor that's still open —
`commitAndMove` now only calls `onMove` when the commit actually closed.

## Validation — CollectionView-style

Wijmo's `collectionView.getError(item, prop, parsing)` doesn't have a home on
this repo's `CollectionView` — it's a lean, grid-agnostic data layer reused
by `ODataCollectionView`/`ODataVirtualCollectionView` with no dependency on
`Column`, so the hook lives on `GridOptions` instead, following the existing
`cellClassRules`/`rowClass` convention (already grid-level for the same
layering reason): `getError?: (ctx: CellTemplateContext, parsing: boolean) =>
string | null | undefined`.

`Column.tryParse(text)` is the new prerequisite `parse()` couldn't provide:
`parse()` returns `null` both for "the user cleared the cell" and for
"the text failed to coerce" (e.g. `Number('abc')`), which `getError` needs
to tell apart. `tryParse` returns `{ value, ok }`, `ok: false` only for a
genuine coercion failure. `parsing` is `true` in that case (`ctx.value` is
the raw text); `false` once it parsed fine, for a business-rule check
against the parsed value. A non-null return from either uses the same
stay-open path as `stayInEditMode`; apps can also surface the message
however else they like from inside `getError` itself or a `cellEditEnding`
handler — see "Validation feedback" below for the built-in visual treatment.

Staying open is enforced, not advisory. While a value is rejected the grid
refuses to move the selection or start an edit elsewhere, so a cell can't be
left holding a value the app already said is invalid — the equivalent of AG
Grid's `invalidEditValueMode: 'block'`. An attempt to move away puts focus
back in the editor instead. **Escape is always the way out**: it discards the
rejected value, reverts the cell, and frees the selection, so a rule that no
input can satisfy can never trap the user permanently.

One real-world caveat surfaced while testing this: a native `<input
type="number">` (or `type="date"`) sanitizes non-numeric/non-date text to
`''` before it's ever read — by the browser and by jsdom alike — so
`parsing: true` can never actually be triggered by *typing* through the
built-in Number/Date editor. It's still reachable through `tryParse()` itself
(unit-tested directly in `Column.test.ts`) and would be reachable through any
future paste/programmatic-set path or a custom text-based editor (below).

## Validation feedback (invalid marking)

Checking the actual Wijmo CollectionViewValidation demo and AG Grid's docs
directly (rather than relying on the earlier research pass) turned up a
correction: AG Grid *does* ship a built-in visual treatment for a rejected
value — an `invalid` class on the validation element plus a tooltip shown
while hovering the still-open editor (`getValidationErrors`/
`getValidationElement`, `invalidEditValueMode: 'revert' | 'block'`). The
original "no built-in error-tooltip UI" note above was wrong for AG Grid
(Wijmo's demo still doesn't document a specific visual treatment beyond
"the grid displays the error").

apgrid now has the same idea, wired through the mechanism that already
existed rather than a new one: `CellEditor.setInvalid?(message: string |
null): void`, an optional method on the editor interface. `EditorManager`
calls it whenever a commit stays open — from `stayOpenOnReject`
(`cellEditEnding.stayInEditMode`, now also carrying an optional
`errorMessage`) or from a non-null `getError` result — and clears it
(`setInvalid(null)`) right before a successful commit. `TextEditor` and
`DropDownEditor` implement it: `.apg-editor-invalid` (a red border, new
`--apg-error-border` token) plus the message set as the input's native
`title` (a real tooltip on hover, no custom tooltip component needed).
Resets automatically the next time that shared editor instance opens on a
new cell — `TextEditor.open()` already rebuilds `className` from scratch
each time; `DropDownEditor.open()` explicitly clears it since its root's
class isn't rebuilt per-open. `RadioEditor` and custom editors don't need to
implement it (no free-text concept to mark), so `setInvalid` is optional on
the interface rather than required.

## Custom Editors

`ColumnDef.editor?: CellEditorFactory` — a factory called once, lazily, the
first time that column is edited: `(commit: (value: string) => void, cancel:
() => void) => CellEditor`. The returned instance is cached per column and
reused across every subsequent edit, matching how the built-in editors are
each one shared instance.

The `CellEditor` interface (`open(parent, column, item, rect, opts?)`,
`close()`) is exactly what `TextEditor`/`DropDownEditor`/`RadioEditor`
already implement — promoted from a private interface in `EditorManager.ts`
to its own file (`src/editing/CellEditor.ts`) and exported publicly, no
redesign needed. `open()`'s `rect` already comes through the same
`cellRect()`/`translate3d` mechanism every other editor uses, so a custom
editor participates in DOM recycling automatically.

The factory shape is the one thing this pass changed from the original plan:
a plain `CellEditor | (() => CellEditor)` looked simpler but doesn't work — a
custom editor has no way to actually commit a value back into the grid's
undo/edit lifecycle unless it receives the same `commit`/`cancel` callbacks
the built-ins get at construction. So the factory takes those two callbacks,
mirroring `new TextEditor(commit, cancel, ...)` exactly; a "pass an
already-built instance" form was dropped since it can't be functional.

No built-in commit/cancel UI is prescribed beyond that — a custom editor
decides its own interaction (a date picker's calendar click, a color
swatch's confirm button, etc.) and calls `commit(value)`/`cancel()` itself,
same as `TextEditor` calling its own `onCommit` on Enter/blur.

## Popup Editors

`GridOptions.popupEditors` adds a pencil button (always rendered at reduced
opacity, full opacity on hover — matching the header filter button's actual
convention, not a hide-until-hover one) to each data row's row-header cell.
Clicking it opens `EditPopup` (`src/rendering/EditPopup.ts`): one labeled
field per editable column, Save/Cancel footer.

Two things this phase deliberately does differently from the original plan,
found while implementing:

- **The popup builds its own plain inputs/selects per field, not the
  `TextEditor`/`DropDownEditor`/custom-editor instances.** Those are
  singletons sized and positioned for exactly one cell via
  `translate3d`/`cellRect()` — a poor fit for a vertical multi-field form.
  The popup instead reads `column.dataType`/`column.dataMap` directly
  (mirroring what those editors render) and commits through
  `column.tryParse()`, the same parser `EditorManager` uses.
- **It's a `document.body`-appended fixed overlay**, positioned via
  `getBoundingClientRect()` and closing on outside-click/Escape/scroll —
  exactly `FilterEditor`'s proven pattern, not the transform-positioned
  `.apg-cells` panel the in-cell editors live in (which is `overflow:
  hidden` and sized to one row; a multi-field form is usually taller).
  Because of this placement, `MouseHandler`'s existing `closest('.apg-editor')`
  guard and `ClipboardHandler`'s `isEditing` guard don't need a matching
  "is a popup open" check — the popup's clicks/keydowns never reach the
  `.apg-viewport`/host listeners those guards protect, since it isn't a
  descendant of either.

Wiring: pencil click → `rowEditStarting` (cancelable) →
`collectionView.editItem(item)` (previously unused by cell editing — this is
where it's finally exercised) → open `EditPopup` → `rowEditStarted`. Save →
`rowEditEnding` (cancelable; a reject calls `cancelEdit()` instead of
committing) → one `EditAction` per changed field, wrapped in a single
`BatchAction` (already existed, used by paste) and pushed once, so **one**
`Ctrl+Z` undoes every field changed in that save → `collectionView.commitEdit()`
→ `rowEditEnded`. Cancel (button, outside click, Escape, or scroll) →
`collectionView.cancelEdit()` (already restores the pre-edit snapshot) →
`rowEditEnded`. Unchanged fields are diffed out before Save, so saving
without touching anything pushes no undo entry at all.
