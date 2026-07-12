---
'@avi-pathak/apgrid': minor
---

Migrate styling to SCSS and add a modern visual refresh with a built-in dark
theme. Styles are now authored as SCSS partials with a central design-token
layer; every value stays a `--apg-*` CSS custom property so runtime overrides
keep working. Ships `apgrid.css` (light + dark, gated by the `apg-theme-dark` /
`apg-theme-auto` class) plus standalone `apgrid-light.css` and `apgrid-dark.css`,
and exposes the SCSS partials via the `./scss/*` export for consumers who want to
compose their own theme.
