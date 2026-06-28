# @avi-pathak/apgrid

A fast, framework-free **virtualized data grid** for the web. Renders 1,000,000+ rows
with a recycled DOM, modeled on the architecture of commercial grids like FlexGrid.

## Features

- Dual-axis virtualization (millions of rows, hundreds of columns) at ~60fps
- Recycled DOM — node count tracks the viewport, not the dataset
- Row + column headers with pinned corner; full-span scrollbars
- Selection modes: None, Cell, CellRange, Row, RowRange, Column, ColumnRange
- Cell editing, column resize, and full **undo / redo** (ctrl+Z / ctrl+Y)
- Zero runtime dependencies; ships ESM, CJS, and UMD with type declarations

## Install

```bash
npm install @avi-pathak/apgrid
```

## Usage

```ts
import { Grid } from '@avi-pathak/apgrid';
import '@avi-pathak/apgrid/styles.css';

const grid = new Grid('#theGrid', {
  columns: [
    { binding: 'id', header: 'ID', width: 60 },
    { binding: 'country', header: 'Country', width: 140 },
    { binding: 'sales', header: 'Sales', width: 120, editable: true },
  ],
  itemsSource: data,
  selectionMode: 'CellRange',
});
```

## Scripts

`npm run dev` · `npm run build` · `npm test` · `npm run typecheck` · `npm run lint`

## Docs

See [docs/](./docs/) — architecture, rendering, virtualization, interaction, build,
testing, roadmap, and the [API reference](./docs/API-Reference.md).
