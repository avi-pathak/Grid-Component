// =============================================================================
// apgrid — theme scope propagation
// =============================================================================
// The grid's four floating widgets (context menu, filter dialog, edit popup,
// drag ghost) are appended to `document.body`, not inside the grid host. Custom
// properties set on the host don't reach them, and neither does a theme *class*
// on the host — the overlays' only ancestors are <body> and <html>.
//
// So a grid marked `<div class="apg apg-theme-dark">` would otherwise pop a
// light context menu. `applyThemeScope` fixes that: given any element inside the
// grid, it walks up to the `.apg` host and copies that host's theme classes onto
// the portal, so the same token values resolve there too.
//
// (The `applyTheme` runtime path avoids this entirely by writing tokens to a
// shared ancestor of both the grid and the portals — but per-instance theme
// *classes* still need this.)

const THEME_CLASS_PREFIX = 'apg-theme-';
const BORDER_MODE_CLASS = 'apg-borders-horizontal';

/**
 * Copy the grid's theme classes onto a body-mounted `portal`. `source` is any
 * element inside the grid (or the host itself); the nearest `.apg` ancestor is
 * treated as the theme carrier. A no-op when no host is found.
 */
export function applyThemeScope(portal: HTMLElement, source: HTMLElement | null): void {
  const host = source?.closest('.apg');
  if (!host) return;
  for (const cls of host.classList) {
    if (cls.startsWith(THEME_CLASS_PREFIX) || cls === BORDER_MODE_CLASS) {
      portal.classList.add(cls);
    }
  }
}
