# 09 — Roadmap

Status of the build against the planned feature set. Done items are implemented, tested,
and verified in the browser.

## Done

- Layered architecture: data, layout, virtualization, rendering, interaction
- Dual-axis virtualization (1M+ rows, 100+ cols) with O(1)/binary-search lookups
- DOM recycling via object pools; `transform`-based positioning
- Single-scroller layout with pinned corner, column headers, row headers
- `headersVisibility` (None / Column / Row / All)
- Selection modes: None, Cell, CellRange, Row, RowRange, Column, ColumnRange
- Mouse + keyboard navigation, drag/shift range extend
- Cell editing (TextEditor) gated by `column.editable`
- Column resize by dragging the header edge
- Undo / redo for edits and resizes (`UndoStack`, ctrl+Z / ctrl+Y)
- Multi-level **column groups**: header bands spanning leaf columns, with
  collapse/expand (`columnGroups` option, `toggleColumnGroup`, persisted in state)
- **Export** to CSV / Excel (.xlsx) / PDF — zero-dependency, pluggable formats
  (`grid.export`, `registerExportFormat`)
- Typed event bus; ResizeObserver-driven layout
- Webpack 5 build (ESM/CJS/UMD + types), Vitest, ESLint/Prettier, CI

## Next (designed for, not built)

| Feature | Approach |
| --- | --- |
| Sorting / filtering | `CollectionView` view-index map behind `DataView` |
| Grouping | group rows in the view; same renderer |
| Frozen panes | extra pinned ranges, like the corner |
| Cell renderers / templates | `column.cellRenderer` hook in `CellRenderer` |
| More editors | register checkbox/date/number in `EditorManager` |
| Clipboard | copy/paste the selection range |
| Non-contiguous selection | list of ranges in `SelectionModel` |
| Touch / a11y | pointer events, ARIA grid roles |

## Phases delivered

1. Foundation & build → 2. Models/data/state → 3. Layout/viewport → 4. Rendering →
5. Virtualization/scroll → 6. Public API → 7. Interaction → 8. Editing →
9. Resize/undo → 10. Docs & publish.
