# @avi-pathak/apgrid

## 0.2.0

### Minor Changes

- 2b9740b: Add multi-level column groups: nested header bands over leaf columns
  (`columnGroups`), collapse/expand with `collapseTo` (a representative column
  stays visible), cancelable `columnGroupCollapsing` / `columnGroupCollapsedChanged`
  / `columnGroupsChanged` events, state serialization via `toJSON`/`loadJSON`, and
  an opt-in collapse/expand animation (`columnGroupAnimation`). Shallow leaves
  render a single full-height header cell in the band. Includes flat and nested
  example demos.
- 8d8fde1: Initial release: virtualized data grid with dual-axis virtualization, row/column
  headers, configurable selection modes, editing, column resize, and undo/redo.
- abe7a5e: Migrate styling to SCSS and add a modern visual refresh with a built-in dark
  theme. Styles are now authored as SCSS partials with a central design-token
  layer; every value stays a `--apg-*` CSS custom property so runtime overrides
  keep working. Ships `apgrid.css` (light + dark, gated by the `apg-theme-dark` /
  `apg-theme-auto` class) plus standalone `apgrid-light.css` and `apgrid-dark.css`,
  and exposes the SCSS partials via the `./scss/*` export for consumers who want to
  compose their own theme.
