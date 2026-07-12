# @avi-pathak/apgrid

A fast, framework-free **virtualized data grid** for the web. Renders 1,000,000+ rows
with a recycled DOM, modeled on the architecture of commercial data grids.

## Features

- Dual-axis virtualization (millions of rows, hundreds of columns) at ~60fps
- Recycled DOM — node count tracks the viewport, not the dataset
- Row + column headers with pinned corner; full-span scrollbars
- Selection modes: None, Cell, CellRange, Row, RowRange, Column, ColumnRange
- Sorting, filtering, and row grouping (with a drag-to-group bar)
- **Multi-level column groups** (nested headers, collapse/expand)
- Frozen rows & columns, cell merging, clipboard copy/paste
- Cell editing (text / dropdown / checkbox), column resize & reorder
- Full **undo / redo** (ctrl+Z / ctrl+Y) and state serialization (`toJSON` / `loadJSON`)
- SCSS-authored, token-driven styling with a built-in **dark theme**
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

Opt into the dark theme by adding the `apg-theme-dark` class to the host (or any
ancestor), or `apg-theme-auto` to follow the OS.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with the example demos on `:5173` |
| `npm run build` | Bundle ESM/CJS/UMD, extract CSS themes, emit `.d.ts` |
| `npm test` | Vitest unit tests |
| `npm run typecheck` · `npm run lint` | Strict type check / ESLint |
| `npm run docs` | Generate the API documentation site into `docs-site/` |
| `npm run docs:serve` | Build the docs and serve them locally |

## Documentation

The generated site combines the auto-built **API reference** (from the source
TSDoc) with the hand-written guides:

- **Architecture** — the layered design and render pipeline
- **Core Engine**, **Rendering**, **Virtualization** — the internals
- **Interaction** — selection, editing, keyboard, events
- **Data Layer** — the `CollectionView` / `DataView` abstraction
- **Column Groups** — multi-level headers and collapse/expand
- **Build System**, **Testing**, **Roadmap**

Run `npm run docs:serve` to browse it locally. The guide markdown lives in the
[`docs` folder on GitHub](https://github.com/avi-pathak/Grid-Component/tree/main/docs).
