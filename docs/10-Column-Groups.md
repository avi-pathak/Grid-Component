# 10 — Column Groups

Column groups add header rows above the leaf column headers: named bands that
span a run of columns (a "Perf" band over YTD/1M/6M/12M). Groups **nest** — a
group's children can be leaves or further groups — producing a multi-row header.
Any group can be **collapsed** to hide its columns, and the whole configuration
is serialized by `toJSON`.

This is the *column-axis* analog of row grouping ([06-Data-Layer](./06-Data-Layer.md))
and reuses the same conventions: a plain model, a pure resolver, a pooled
renderer, cancelable event pairs, and a snapshot field.

## Quick start

```ts
import { Grid } from '@avi-pathak/apgrid';

const grid = new Grid('#grid', {
  columns: [
    { binding: 'name', header: 'Name', width: 140 },
    { binding: 'stock', header: 'Stocks', width: 90 },
    { binding: 'cash', header: 'Cash', width: 90 },
    { binding: 'other', header: 'Other', width: 90 },
    { binding: 'amount', header: 'Amount', width: 110 },
  ],
  itemsSource: data,
  columnGroups: [
    {
      header: 'Allocation',
      collapseTo: 'amount',
      columns: [
        'stock',
        { header: 'Detail', columns: ['cash', 'other'] }, // nested subgroup
        'amount',
      ],
    },
  ],
  groupHeaderRowHeight: 30, // optional; defaults to headerHeight
});

grid.toggleColumnGroup('detail');       // collapse just the inner group
grid.toggleColumnGroup('allocation');   // collapse the whole band
grid.collapseAllColumnGroups();         // recurses into nested groups
```

## Model — a recursive tree

A [`ColumnGroupDef`](../src/models/ColumnGroup.ts) node is **either** a leaf
(references a grid column by `binding`) **or** a group (has a nested `columns`
array of child nodes). A plain string in `columns` is shorthand for
`{ binding }`, so the flat form still works unchanged:

```ts
interface ColumnGroupDef {
  header?: string;
  binding?: string;                       // leaf
  columns?: (string | ColumnGroupDef)[];  // group (children)
  collapsed?: boolean;                     // start collapsed
  collapsible?: boolean;                   // allow the chevron (default true)
  collapseTo?: string | null;              // descendant kept visible when collapsed
  key?: string;                            // identity; defaults to a slug of `header`
}

// Flat (still supported):
{ header: 'Perf', columns: ['ytd', 'm1', 'm6'] }

// Nested:
{ header: 'Perf', columns: [
  { header: 'Short', columns: ['ytd', 'm1'] },
  { header: 'Long',  columns: ['m6', 'm12'] },
]}
```

Resolution runs through the pure
[`buildColumnGroups`](../src/data/buildColumnGroups.ts) helper (mirrors
`buildGroups.ts` for row grouping), depth-first:

- Each leaf binding must reference a real column and may belong to **one** group
  — a binding claimed twice, or referencing an unknown column, is dropped with a
  console warning.
- A group left with no valid leaf descendants is dropped.
- `collapseTo` may name **any descendant** leaf (at any depth); an unknown value
  falls back to the first descendant leaf, and `null` means "hide every column".

The resolved [`ColumnGroup`](../src/models/ColumnGroup.ts) exposes tree helpers:
`leafBindings()`, `depth()`, and `descendantGroups()`.

## Layout & rendering

Header depth is fixed by the **authored tree** (collapsing hides columns but
never changes the row count), so the top gutter is:

```
gutterTop = depth * groupHeaderRowHeight + headerHeight
```

The [`ColumnGroupRenderer`](../src/rendering/ColumnGroupRenderer.ts) draws the
band from a pure layout builder,
[`buildColumnGroupLayout(columns, groups)`](../src/data/buildColumnGroups.ts):

1. For each header row it emits one cell per maximal run of consecutive visible
   columns sharing the same ancestor group at that depth.
2. A column shallower than the full depth (a top-level leaf like Name, or a leaf
   directly under a group) gets a single cell that **row-spans** down to the
   bottom header row — so Name/Curr occupy the whole header height while nested
   groups stack. That tall cell **is the column's own header** (its text, sort
   arrow, and filter button, drawn by `fillHeaderCell`); the leaf-header row
   below skips it so the header is never drawn twice or left as a blank gap.
3. Each cell is positioned `left/width` from the column geometry and `top/height`
   from its row and row-span. Only cells intersecting the visible column window
   are materialized, so the node count tracks the viewport (× the small, fixed
   header depth), never the total column count. **Groups never store a width** —
   it's always derived, so leaf resize/undo need zero changes.

### Collapse / expand animation

Set `columnGroupAnimation: true` (or `grid.columnGroupAnimation = true` at
runtime) to ease the header cells' geometry as columns hide and show — the
column-axis analog of Wijmo's `.animated` class. It adds `.apg-animated` to the
host, which applies a `transition` to `.apg-columngroup-cell`; off by default.


## Collapse = hidden columns (with `collapseTo`)

Collapsing a group hides all its descendant leaf columns **except** its
`collapseTo`, which stays visible carrying the header and its expand chevron —
mirroring Wijmo FlexGrid's `collapseTo`. So a collapsed group never disappears;
click its remaining header to expand. (`collapseTo: null` hides everything; then
only an external toggle can expand it.)

Nesting composes: the hide computation walks the tree top-down, and once inside
a collapsed group only its `collapseTo` survives — an inner group can't re-show a
column its collapsed ancestor already hid.

`Grid` keeps two arrays:

- `allColumns` — the authored order, including hidden columns; source of truth
  for membership and `toJSON`.
- `columns` — `allColumns` minus hidden; **the array every subsystem already
  indexes** (selection, editing, resize, sort, the renderer, the layout).

A collapse is just a recompute of `columns` + `layout.setColumns` + redraw — the
column-axis parallel of `refreshRows()`.

## Events

Cancelable `-ing`/`-ed` pairs, via the same `emitCancel` helper as every other
structural change. Keys address nested groups too.

| Event | When | Cancelable |
| --- | --- | --- |
| `columnGroupCollapsing` | before a collapse/expand | yes |
| `columnGroupCollapsedChanged` | after a collapse/expand | — |
| `columnGroupsChanged` | after add/remove/replace | — |

## Public API

| Member | Purpose |
| --- | --- |
| `columnGroups` | the resolved top-level groups (authored order) |
| `setColumnGroups(defs)` | replace all groups (empty array removes them) |
| `addColumnGroup(def)` / `removeColumnGroup(key)` | add / remove one |
| `toggleColumnGroup(key, collapsed?)` | collapse/expand any group by key (omit = toggle) |
| `collapseAllColumnGroups()` / `expandAllColumnGroups()` | bulk toggle (recurses) |

## Persistence

`toJSON` records a `columnGroups` tree (`key`, `header`, `collapsed`,
`collapseTo`, and a nested `columns` array mirroring the def tree) plus the
**full** `allColumns` order/width, so a round-trip is lossless even while
columns are hidden and at every nesting level. `loadJSON` restores groups right
after the column order settles. `version` stays `1` (additive; flat snapshots
still load).

## Demos

- [columnGroups](../examples/demos/columnGroups.ts) — flat, single-level groups.
- [nestedColumnGroups](../examples/demos/nestedColumnGroups.ts) — the Allocation
  → {Stocks, Bonds, Detail → {Cash, Other}, Amount} / Perf → {Short, Long}
  structure with conditional cell styling.

## Tested

- [buildColumnGroups.test.ts](../src/data/buildColumnGroups.test.ts) — recursive
  resolve, dedupe across nesting, deep `collapseTo`, and the layered layout
  (rowspan for shallow leaves).
- [ColumnGroupRenderer.test.ts](../src/rendering/ColumnGroupRenderer.test.ts) —
  multi-row positioning, bounded/recycled DOM, chevron state, nested toggle.
- [ColumnGroups.test.ts](../src/core/ColumnGroups.test.ts) — flat + nested
  collapse/expand end-to-end, independent inner collapse, ancestor-wins hiding,
  gutter height, and `toJSON`/`loadJSON` round-trips.
