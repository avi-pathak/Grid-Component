---
'@avi-pathak/apgrid': minor
---

Make row-header numbering opt-in via the new `rowNumbers` option (default
`false`).

**Breaking:** row headers previously always rendered a 1-based row number.
They are now blank unless you set `rowNumbers: true`. The row-header column
itself is unaffected — whether it shows at all is still `headersVisibility`.

This matches both references: FlexGrid's row headers are empty until you
template them (`cellTemplate` / `formatItem` with `row.index + 1`), and AG
Grid's equivalent `rowNumbers` grid option is likewise `false` by default.

The number is the row's position in the current view, so it renumbers as
sorting, filtering, and paging change what's on screen — the same
display-position semantics AG Grid documents.
