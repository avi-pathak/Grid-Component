# 11 — Export

The export module turns the grid's data into a downloadable file — **CSV**,
**Excel (.xlsx)**, or **PDF** — entirely in the browser with **zero
dependencies**. It's designed to be format-agnostic: adding a new format (JSON,
HTML, Markdown, …) means implementing one small interface, never touching the
grid.

## Quick start

```ts
grid.export();                       // export.csv, all rows
grid.export({ format: 'xlsx' });     // export.xlsx
grid.export({ format: 'pdf', fileName: 'report', title: 'Q3 Sales' });

// Just the current selection, specific columns, no download — get the bytes:
const { content, fileName, mimeType } =
  grid.export({ format: 'xlsx', rows: 'selection', columns: ['name', 'sales'], download: false })!;
```

## Options

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `format` | `'csv' \| 'xlsx' \| 'pdf' \| string` | `'csv'` | any registered format |
| `fileName` | `string` | `'export'` | extension added automatically |
| `rows` | `'all' \| 'selection'` | `'all'` | limit to the selection rectangle |
| `columns` | `string[]` | all visible | bindings, in export order |
| `includeHeaders` | `boolean` | `true` | emit the header row |
| `includeGroups` | `boolean` | `false` | include group-header + aggregate rows |
| `download` | `boolean` | `true` | `false` returns the artifact without downloading |
| `title` | `string` | — | shown above the table (pdf/xlsx) |
| `csv` | `CsvOptions` | — | delimiter, BOM, newline |
| `pdf` | `PdfOptions` | — | orientation, font size |

`grid.exportData(options)` returns just the format-agnostic payload (the IR);
`grid.registerExportFormat(fmt)` adds a custom format.

## Architecture

Reading the grid is decoupled from writing any format by a small intermediate
representation (IR):

```
grid columns + DataView  ──buildExportData──▶  ExportData (IR)  ──ExportFormat──▶  csv / xlsx / pdf
```

- [`types.ts`](../src/export/types.ts) — the IR (`ExportData`: typed columns +
  rows + optional multi-level header bands) and the `ExportFormat` interface
  every writer implements.
- [`buildExportData.ts`](../src/export/buildExportData.ts) — pure and grid-free:
  turns columns + a row source into the IR. Each cell carries its **raw value**,
  its **formatted text**, its **type**, and alignment, so any writer can render
  it. Group-header rows (with aggregates) are included on request.
- [`formats/`](../src/export/formats) — the writers, each pure: `csv.ts`,
  `xlsx.ts`, `pdf.ts`.
- [`registry.ts`](../src/export/registry.ts) — format id → writer.
- [`ExportManager.ts`](../src/export/ExportManager.ts) — orchestrates a run,
  fires the events, downloads. Built inside `Grid` with injected getters, the
  same DI pattern as the clipboard handler.

New formats plug in without touching the grid:

```ts
grid.registerExportFormat({
  id: 'tsv',
  extension: 'tsv',
  mimeType: 'text/tab-separated-values',
  render: (data) => data.rows.map((r) => r.cells.map((c) => c.text).join('\t')).join('\n'),
});
grid.export({ format: 'tsv' });
```

## The zero-dependency writers

- **CSV** — RFC 4180 escaping (quote fields with delimiter/quote/newline, double
  inner quotes) with a UTF-8 BOM by default so Excel opens it as UTF-8.
- **XLSX** — an .xlsx is an OPC package (a ZIP of XML parts). A from-scratch
  [`ZipWriter`](../src/export/zip/zip.ts) emits STORED (uncompressed) entries —
  a fully valid ZIP Excel opens without repair — with a hand-rolled
  [CRC-32](../src/export/zip/crc32.ts). The worksheet uses inline strings (no
  shared-strings part), types each cell (number / boolean / **date as a 1900
  serial** with a date style), sets column widths, and merges header-group
  cells.
- **PDF** — a hand-assembled PDF (catalog → pages → page(s) → content stream)
  with a correct xref table, using the standard Helvetica font (no embedding).
  Rows are paginated; the table is drawn with text + gridline operators, with
  parenthesis/backslash escaping in strings.

## Events

Cancelable `-ing` / `-ed` pair, via the same `emitCancel` machinery as every
other structural action:

| Event | When | Cancelable |
| --- | --- | --- |
| `exporting` | before the artifact is produced | yes (set `cancel`) |
| `exported` | after the artifact is produced / downloaded | — |

## Tested

- Unit: [`crc32.test.ts`](../src/export/zip/crc32.test.ts) (known CRC vectors),
  [`zip.test.ts`](../src/export/zip/zip.test.ts) (byte-level headers/EOCD),
  [`buildExportData.test.ts`](../src/export/buildExportData.test.ts) (IR mapping,
  selection, groups), [`formats.test.ts`](../src/export/formats.test.ts) (CSV
  escaping, XLSX cell typing + date serials, PDF structure).
- End-to-end: [`Export.test.ts`](../src/core/Export.test.ts) — `grid.export`
  across formats, selection scope, column picking, events + cancel, custom
  formats.
- The generated `.xlsx` opens in Excel/LibreOffice/openpyxl (verified: typed
  numbers, dates, merged header groups) and the `.pdf` opens in standard viewers
  (verified: multi-page, extractable text).
