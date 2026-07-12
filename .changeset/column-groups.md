---
'@avi-pathak/apgrid': minor
---

Add multi-level column groups: nested header bands over leaf columns
(`columnGroups`), collapse/expand with `collapseTo` (a representative column
stays visible), cancelable `columnGroupCollapsing` / `columnGroupCollapsedChanged`
/ `columnGroupsChanged` events, state serialization via `toJSON`/`loadJSON`, and
an opt-in collapse/expand animation (`columnGroupAnimation`). Shallow leaves
render a single full-height header cell in the band. Includes flat and nested
example demos.
