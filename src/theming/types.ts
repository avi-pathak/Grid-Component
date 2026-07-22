// =============================================================================
// apgrid — theming types
// =============================================================================
// `ThemeParams` is the small, human-facing input set a Theme Builder exposes —
// roughly a dozen knobs. `deriveTokens` (see ./derive) fans these out into the
// full `--apg-*` token palette that the stylesheet actually reads. Keeping the
// two apart is the whole point: authors reason about "accent" and "spacing",
// not about 30-odd individual surface and state colours.

/** How grid borders are drawn. Mirrors AG Grid's borders control. */
export type BorderStyle = 'all' | 'horizontal' | 'none';

/** The seed values a theme is built from. */
export interface ThemeParams {
  /** CSS font-family stack for the whole grid. */
  fontFamily: string;
  /** Base font size in px. */
  fontSize: number;

  /** Primary cell surface colour. Its luminance decides light-vs-dark derivation. */
  backgroundColor: string;
  /** Primary text colour. */
  foregroundColor: string;
  /** The single accent — focus ring, selection, sort arrow, primary buttons. */
  accentColor: string;

  /** Hairline colour for grid lines and overlay edges. */
  borderColor: string;
  /** Which borders are drawn. `'none'` sets border width to 0. */
  borders: BorderStyle;
  /** Thickness in px of the active-cell selection ring (and editor outline). Defaults to 1. */
  selectionRingWidth?: number;

  /** Header background. Derived from the surface when omitted. */
  headerBackgroundColor?: string;
  /** Whether alternate rows get a subtle zebra tint. */
  oddRowStriping: boolean;

  /** Base spacing unit in px — drives horizontal cell padding. */
  spacing: number;
  /** Outer radius in px for large surfaces (overlay roots). */
  wrapperRadius: number;
  /** Inner radius in px for controls (inputs, chips, buttons). */
  widgetRadius: number;

  /** Row height in px. Applied live via `Grid.setGeometry`. */
  rowHeight: number;
  /** Column-header height in px. */
  headerHeight: number;
}

/**
 * Every `--apg-*` token name the stylesheet reads (without the `--apg-` prefix).
 * This is the contract between `deriveTokens` and the SCSS in `src/styles/`.
 */
export type TokenName =
  // geometry
  | 'row-height'
  | 'header-height'
  | 'group-header-height'
  | 'cell-padding-x'
  | 'radius'
  | 'radius-sm'
  | 'radius-lg'
  | 'border-width'
  | 'border-width-strong'
  | 'accent-ring-width'
  // typography
  | 'font-family'
  | 'font-size'
  | 'line-height'
  | 'font-weight-header'
  | 'font-weight-medium'
  // motion
  | 'transition'
  // surfaces
  | 'cell-bg'
  | 'cell-bg-alt'
  | 'cell-fg'
  | 'fg-muted'
  // borders
  | 'border-color'
  | 'border-strong'
  // header
  | 'header-bg'
  | 'header-fg'
  // accent + states
  | 'active-border'
  | 'accent-contrast'
  | 'selected-bg'
  | 'hover-bg'
  | 'focus-ring'
  | 'edited-bg'
  | 'error-border'
  // grouping / panels / frozen
  | 'group-bg'
  | 'group-bg-hover'
  | 'panel-bg'
  | 'frozen-cell-bg'
  // chrome
  | 'shadow-sm'
  | 'shadow-md'
  | 'shadow-lg'
  | 'scrollbar-thumb'
  | 'control-hover'
  | 'checkbox-border';

/** A fully-derived palette: every token name mapped to a CSS value string. */
export type TokenMap = Record<TokenName, string>;

/** A named, ready-to-use theme: params plus a stable id and display label. */
export interface ThemePreset {
  /** Stable id used for the CSS class `.apg-theme-<id>` and lookups. */
  id: string;
  /** Human-readable name for a theme picker. */
  label: string;
  /** Whether this is the light or dark variant of its family. */
  scheme: 'light' | 'dark';
  /** The seed values. */
  params: ThemeParams;
}
