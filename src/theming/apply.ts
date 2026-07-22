import { deriveTokens } from './derive';
import { ThemeParams, TokenMap } from './types';

// =============================================================================
// apgrid — applying a theme
// =============================================================================
// Two ways to use a derived palette:
//
//   applyTheme(el, params) — write the tokens as inline custom properties on a
//     live element. Fast, no stylesheet, ideal for a Theme Builder preview.
//
//   themeToCss(selector, params) — generate a static CSS rule to paste into a
//     project. This is the "export" a builder hands back.
//
// A note on the four body-mounted overlays (context menu, filter dialog, edit
// popup, drag ghost): custom properties inherit, and only the grid reads `--apg-*`,
// so applying the tokens to a shared ancestor of both the grid and those portals
// — i.e. `document.body` or `:root` — themes the overlays for free. `applyTheme`
// therefore accepts any element; point it at the host to theme one grid, or at
// the body to theme every grid and overlay on the page.

/** Class that suppresses vertical (column) borders, for `borders: 'horizontal'`. */
export const HORIZONTAL_BORDERS_CLASS = 'apg-borders-horizontal';

/**
 * Write a theme's derived tokens onto `target` as inline custom properties, and
 * toggle the horizontal-borders class to match `params.borders`. Returns the
 * derived `TokenMap` in case the caller wants to display it.
 */
export function applyTheme(target: HTMLElement, params: ThemeParams): TokenMap {
  const tokens = deriveTokens(params);
  for (const [name, value] of Object.entries(tokens)) {
    target.style.setProperty(`--apg-${name}`, value);
  }
  target.classList.toggle(HORIZONTAL_BORDERS_CLASS, params.borders === 'horizontal');
  return tokens;
}

/** Remove everything `applyTheme` set, restoring the stylesheet defaults. */
export function clearTheme(target: HTMLElement): void {
  const tokens = deriveTokens(defaultParamsForClear);
  for (const name of Object.keys(tokens)) {
    target.style.removeProperty(`--apg-${name}`);
  }
  target.classList.remove(HORIZONTAL_BORDERS_CLASS);
}

// Only the key set matters here, not the values — used to know which properties
// applyTheme could have written so clearTheme can remove exactly those.
const defaultParamsForClear: ThemeParams = {
  fontFamily: 'sans-serif',
  fontSize: 13,
  backgroundColor: '#ffffff',
  foregroundColor: '#000000',
  accentColor: '#2563eb',
  borderColor: '#e3e7ef',
  borders: 'all',
  oddRowStriping: true,
  spacing: 8,
  wrapperRadius: 8,
  widgetRadius: 6,
  rowHeight: 30,
  headerHeight: 36,
};

/**
 * Generate a static CSS rule that applies a theme to everything matching
 * `selector` (typically a class like `.apg-theme-brand` placed on grid hosts, or
 * `body` to cover overlays too). The output is a self-contained stylesheet
 * fragment suitable for copy-paste.
 */
export function themeToCss(selector: string, params: ThemeParams): string {
  const tokens = deriveTokens(params);
  const lines = Object.entries(tokens).map(([name, value]) => `  --apg-${name}: ${value};`);
  let css = `${selector} {\n${lines.join('\n')}\n}\n`;

  // 'horizontal' can't be expressed by a token alone — column borders live on
  // individual cells — so emit the matching suppression rule.
  if (params.borders === 'horizontal') {
    css +=
      `${selector} .apg-cell,\n${selector} .apg-header-cell {\n` + `  border-right-width: 0;\n}\n`;
  }
  return css;
}
