---
'@avi-pathak/apgrid': minor
---

Add a zero-dependency export module. `grid.export({ format })` produces CSV,
Excel (.xlsx), or PDF entirely in the browser — with a from-scratch ZIP writer +
CRC-32 for xlsx and a hand-assembled PDF, no runtime dependencies.

Formats are pluggable via a small `ExportFormat` interface and
`grid.registerExportFormat`. Exports can be scoped to the selection,
restricted/reordered by column, and include group-header/aggregate rows.

Customization and scale:
- `cellCallback` / `headerCallback` customize each cell's value, text, and style
  (bold, italic, color, background, alignment — honored by xlsx and pdf), the
  format-agnostic analog of Wijmo's `formatItem`.
- `grid.exportAsync()` builds rows in chunks off the main thread, reports
  progress, shows an opt-in overlay (`showProgress`, hidden by default), and
  cancels via an `AbortSignal`.

Cancelable `exporting` / `exported` events, plus `grid.exportData` to get the
format-agnostic payload.
