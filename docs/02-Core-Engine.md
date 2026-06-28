# 02 — Core Engine

The `core/` layer is the spine of the grid: it composes the subsystems, normalizes
options, and holds the shared state everything else reads from.

## Files

| File | Role |
| --- | --- |
| `core/Grid.ts` | Public facade and composition root (added in Phase 5) |
| `core/GridOptions.ts` | Normalize user options into resolved, defaulted values |
| `core/GridState.ts` | Shared, observable scroll + viewport state |
| `core/GridViewport.ts` | Compute the visible window from scroll + layout (Phase 2) |

## Options

Users pass a loose [`GridOptions`](../src/core/GridOptions.ts) object.
`resolveOptions` turns it into a strict `ResolvedOptions` the internals rely on:

- `columns` → `Column` instances (value resolution + width defaults)
- `itemsSource` (or the legacy `dataSource` alias) → a plain array
- `rowHeight` / `headerHeight` → defaults of **24** and **28**, matching the
  `--apg-row-height` and `--apg-header-height` CSS variables

```ts
const resolved = resolveOptions({
  columns: [{ binding: 'id', header: 'ID', width: 60 }],
  itemsSource: data,
});
```

Keeping normalization in one function means the rest of the code never has to
write `options.rowHeight ?? 24` again — it reads `resolved.rowHeight`.

## State

[`GridState`](../src/core/GridState.ts) is a small observable. It owns the values
that change on every scroll and that more than one subsystem needs to agree on:

```ts
class GridState {
  scrollTop; scrollLeft;          // current scroll offset
  firstRow; lastRow;              // visible row range
  firstCol; lastCol;              // visible column range
  subscribe(listener): () => void;
  emitChange(): void;
}
```

The rule: **subsystems read these fields and subscribe to changes; they never keep
a private copy.** That's what keeps scroll, layout, and rendering in sync without
direct references between them.

State grows as features land — selection in Phase 6, editing in Phase 7 — but each
field is added only when something consumes it, so the object never fills up with
unused flags.

## Lifecycle (preview)

The `Grid` facade (Phase 5) wires the pieces together and owns teardown:

```mermaid
flowchart LR
  new[new Grid] --> resolve[resolveOptions]
  resolve --> compose[construct subsystems]
  compose --> mount[render first window]
  mount --> live[scroll / select / edit]
  live --> dispose[dispose: remove listeners + DOM]
```

`dispose()` must leave no dangling scroll listeners, observers, or detached nodes —
that's verified in Phase 5.

## Design notes

- **Composition over inheritance.** `Grid` holds its subsystems as fields and
  injects shared dependencies (state, data, layout). There is no base-grid class to
  extend.
- **No globals.** The original grid stashed internals on `window`; here every
  dependency is passed through a constructor.
