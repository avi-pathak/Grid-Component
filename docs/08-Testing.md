# 08 — Testing

The library is tested at two levels: fast Vitest unit tests on the algorithms and
DOM behavior (jsdom), and manual/automated browser checks for the live grid.

## Unit tests (Vitest + jsdom)

Run with `npm test` (watch: `npm run test:watch`). Config: [vitest.config.ts](../vitest.config.ts).
Tests sit next to their source as `*.test.ts`. Current coverage:

| Area | File | Focus |
| --- | --- | --- |
| Binary search | utils/BinarySearch.test.ts | bounds, empty arrays |
| Object pool | utils/ObjectPool.test.ts | reuse, reset |
| Data view | data/DataView.test.ts | length, item, setItems |
| Column | models/Column.test.ts | value getter/formatter, editable |
| Layout engine | virtualization/LayoutEngine.test.ts | offsets, ranges, 1M rows |
| Viewport | core/GridViewport.test.ts | buffered range, change detection |
| Renderer | rendering/Renderer.test.ts | bounded DOM, pooling, row headers |
| Selection | selection/SelectionModel.test.ts | all 7 modes, extend |
| Events | events/EventBus.test.ts | typed pub/sub |
| Undo | commands/UndoStack.test.ts | push/undo/redo, cap, branch |
| Edit | commands/EditAction.test.ts | value swap |
| Grid | core/Grid.test.ts | API, selection, edit, resize, dispose |

The renderer tests prove the core promise: jump 500k rows, DOM stays under ~30 rows,
and scrolling allocates far fewer nodes than rows scrolled.

## Browser checks

`npm run dev` builds the library and serves the example app on `:5173`. The demo
app **consumes the built package as a real npm consumer would** — every example
imports from `@avi-pathak/apgrid` (and `@avi-pathak/apgrid/styles.css`), which
webpack resolves to the built `dist/` (ESM bundle + extracted CSS) via aliases,
not to `src/`. So running the demos exercises the actual published artifacts:
the `exports` map, the bundled JS, and the shipped stylesheet.

`npm run typecheck:examples` builds the type declarations and type-checks the
examples against the package's public `.d.ts`, catching any public-API
regression a consumer would hit.

Verified live: virtualized scroll, all selection modes, row/column headers,
full-span scrollbars, editing, undo/redo, grouping, filtering, column groups,
export (CSV/XLSX/PDF), and the dark theme.

> The unit tests (`npm test`) resolve `@avi-pathak/apgrid` to `src/` via a Vitest
> alias, so they stay fast and build-free. Only the browser app and
> `typecheck:examples` go through the built package.

## Suggested next

- **Playwright e2e**: scroll/select/edit on 1M rows; assert node count and ~60fps.
- **Benchmarks**: frame time, node count, scroll latency tracked over time.

## CI

[ci.yml](../.github/workflows/ci.yml) runs lint, typecheck, test, and build on every
push/PR. Releases publish through changesets in [release.yml](../.github/workflows/release.yml).
