# 04 — Virtualization

The grid renders millions of rows by keeping only the visible window in the DOM.
Two pieces make that work: the [`LayoutEngine`](../src/virtualization/LayoutEngine.ts)
(pixel ↔ index math) and the [`GridViewport`](../src/core/GridViewport.ts) (which
window is visible). The renderer (see [03-Rendering](./03-Rendering.md)) draws only
that window; pooling keeps the node count flat.

## Coordinate math

Rows use a uniform height, so row math is O(1) and never allocates a per-row array —
essential at a million rows:

```ts
totalHeight = rowCount * rowHeight;
getRowTop(r) = r * rowHeight;
rowAtY(y)    = floor(y / rowHeight);
```

Columns have individual widths, so their left edges are a cumulative array and lookups
are a binary search:

```ts
colLefts = [0, w0, w0+w1, …];        // built once per column change
getColLeft(c) = colLefts[c];
colAtX(x)     = upperBound(colLefts, x) - 1;  // O(log cols)
```

`upperBound`/`lowerBound` live in [BinarySearch.ts](../src/utils/BinarySearch.ts). The
rule never to "iterate from row 0" is what keeps scrolling cheap at any dataset size.

## Visible range

`getVisibleRows(scrollTop, height)` and `getVisibleCols(scrollLeft, width)` return the
first/last index touching the viewport. [`GridViewport`](../src/core/GridViewport.ts)
pads them with a small buffer and writes them to state:

```ts
firstRow = max(0, visible.first - BUFFER_ROWS);   // 3
lastRow  = min(rowCount-1, visible.last + BUFFER_ROWS);
firstCol = max(0, visible.first - BUFFER_COLS);    // 1
lastCol  = min(colCount-1, visible.last + BUFFER_COLS);
```

`update` returns `true` only when that range changed, so sub-row scrolls skip the
render entirely. The buffer means a few off-screen rows are ready before they scroll in.

## Dual-axis

Rows and columns virtualize independently, so 1,000,000 rows × 100 columns keeps the
DOM at roughly:

```
(visibleRows + 2·BUFFER) × (visibleCols + 2·BUFFER) + headers
```

— a few hundred cells, regardless of dataset size.

## Pooling

[`ObjectPool`](../src/utils/ObjectPool.ts) recycles row and cell elements. Scrolling
reuses nodes that left the window for the ones entering it, so no allocation churn. The
[render pipeline](./03-Rendering.md) covers how rows/cells are repositioned with
`transform`.

## Verified

[LayoutEngine.test.ts](../src/virtualization/LayoutEngine.test.ts) checks the range at
1,000,000 rows resolves without iteration; [Renderer.test.ts](../src/rendering/Renderer.test.ts)
asserts the DOM stays under ~30 rows after jumping 500k rows; the browser demo holds a
bounded node count scrolling a 200k-row grid.
