// Generate dist/apgrid-themes.css from the built theming module.
//
// The built-in theme CSS classes are produced by the exact same `themeToCss` /
// `deriveTokens` the runtime uses, so the shipped stylesheet and the JS API can
// never drift. Runs in `build:themes`, after `build:js` has emitted
// dist/theming/apgrid-theming.mjs.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { presets, themeToCss } = await import(resolve(here, '../dist/theming/apgrid-theming.mjs'));

const banner =
  '/* apgrid — built-in themes.\n' +
  ' * Generated from the theme presets; do not edit by hand.\n' +
  ' * Import alongside the base stylesheet, then add a class such as\n' +
  ' * `apg-theme-quill-dark` to the grid host (or <body> to cover overlays).\n' +
  ' */\n\n';

const css = banner + presets.map((p) => themeToCss(`.apg-theme-${p.id}`, p.params)).join('\n');

const out = resolve(here, '../dist/apgrid-themes.css');
writeFileSync(out, css);
console.log(`Wrote ${out} (${presets.length} themes)`);
