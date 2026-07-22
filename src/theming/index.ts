// =============================================================================
// apgrid — theming entry (@avi-pathak/apgrid/theming)
// =============================================================================
// A small, dependency-free layer for deriving and applying grid themes at
// runtime. Kept in its own subpath so the core grid bundle carries none of it
// unless a consumer opts in.

export { deriveTokens, isDarkTheme } from './derive';
export { applyTheme, clearTheme, themeToCss, HORIZONTAL_BORDERS_CLASS } from './apply';
export { presets, presetById, defaultPreset } from './presets';
export type { ThemeParams, TokenName, TokenMap, ThemePreset, BorderStyle } from './types';

// Colour helpers, handy when building a theme UI (e.g. seeding a colour input
// from a derived token). Re-exported so consumers don't reach into deep paths.
export { parseColor, toHex, toCss, contrast, isDark } from '../utils/Color';
export type { RGBA } from '../utils/Color';
