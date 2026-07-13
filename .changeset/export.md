---
'@avi-pathak/apgrid': minor
---

Add a zero-dependency export module. `grid.export({ format })` produces CSV,
Excel (.xlsx), or PDF entirely in the browser — with a from-scratch ZIP writer +
CRC-32 for xlsx and a hand-assembled PDF, no runtime dependencies. Formats are
pluggable via a small `ExportFormat` interface and `grid.registerExportFormat`;
exports can be scoped to the selection, restricted/reordered by column, and
include group-header/aggregate rows. Cancelable `exporting` / `exported` events,
plus `grid.exportData` to get the format-agnostic payload.
