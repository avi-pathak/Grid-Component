import {
  parseColor,
  toCss,
  mix,
  fade,
  luminance,
  isDark as isDarkColor,
  pickContrasting,
  RGBA,
} from '../utils/Color';
import { ThemeParams, TokenMap } from './types';

// =============================================================================
// apgrid — token derivation
// =============================================================================
// Turn a dozen `ThemeParams` seeds into the full `--apg-*` palette. The guiding
// idea is that most tokens are relationships, not independent choices: hover is
// "a little accent over the surface", muted text is "foreground pulled toward
// the surface", a striped row is "the surface nudged toward the text". Expressing
// them as mixes means one accent change ripples coherently through the whole grid
// and stays legible on both light and dark surfaces.
//
// Light vs dark is detected from the background's luminance, so a theme author
// never sets a mode flag — they just pick a dark background and everything else
// adapts.

const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 };
const NEAR_BLACK: RGBA = { r: 24, g: 29, b: 39, a: 1 };

// Fixed values that aren't worth a dedicated builder control yet. Kept here so
// the palette is still complete and a preset can't forget them.
const LINE_HEIGHT = '1.45';
const TRANSITION = '0.12s ease';
const FONT_WEIGHT_HEADER = '600';
const FONT_WEIGHT_MEDIUM = '500';

/**
 * Derive the complete token palette from a theme's seed params. Every key of
 * `TokenMap` is produced, and every value is a valid CSS string.
 */
export function deriveTokens(params: ThemeParams): TokenMap {
  const bg = parseColor(params.backgroundColor);
  const fg = parseColor(params.foregroundColor);
  const accent = parseColor(params.accentColor);
  const border = parseColor(params.borderColor);
  const dark = isDarkColor(bg);

  // Accent-tinted state fills are stronger on dark surfaces, where a faint wash
  // over a dark ground would otherwise be invisible.
  const selectedA = dark ? 0.22 : 0.1;
  const hoverA = dark ? 0.12 : 0.055;
  const focusA = dark ? 0.55 : 0.4;
  const controlA = dark ? 0.08 : 0.06;
  const scrollA = dark ? 0.22 : 0.18;

  const headerBg = params.headerBackgroundColor
    ? parseColor(params.headerBackgroundColor)
    : mix(bg, fg, 0.045);

  // The amber "edited" tint and the error red are the two semantic colours that
  // shouldn't chase the accent — they carry fixed meaning.
  const amber: RGBA = { r: 217, g: 119, b: 6, a: 1 };
  const errorBorder = dark ? '#f87171' : '#dc2626';

  const borderWidth = params.borders === 'none' ? '0' : '1px';

  const map: TokenMap = {
    // geometry
    'row-height': px(params.rowHeight),
    'header-height': px(params.headerHeight),
    'group-header-height': px(params.headerHeight),
    'cell-padding-x': px(params.spacing + 6),
    radius: px(params.widgetRadius),
    'radius-sm': px(Math.max(0, params.widgetRadius - 2)),
    'radius-lg': px(params.wrapperRadius),
    'border-width': borderWidth,
    'border-width-strong': params.borders === 'none' ? '0' : '2px',
    'accent-ring-width': px(params.selectionRingWidth ?? 1),

    // typography
    'font-family': params.fontFamily,
    'font-size': px(params.fontSize),
    'line-height': LINE_HEIGHT,
    'font-weight-header': FONT_WEIGHT_HEADER,
    'font-weight-medium': FONT_WEIGHT_MEDIUM,

    // motion
    transition: TRANSITION,

    // surfaces
    'cell-bg': toCss(bg),
    'cell-bg-alt': toCss(params.oddRowStriping ? mix(bg, fg, 0.035) : bg),
    'cell-fg': toCss(fg),
    'fg-muted': toCss(mix(fg, bg, 0.4)),

    // borders
    'border-color': toCss(border),
    'border-strong': toCss(mix(border, fg, 0.35)),

    // header
    'header-bg': toCss(headerBg),
    'header-fg': toCss(mix(fg, bg, 0.1)),

    // accent + states
    'active-border': toCss(accent),
    'accent-contrast': toCss(pickContrasting([WHITE, NEAR_BLACK], accent)),
    'selected-bg': toCss(fade(accent, selectedA)),
    'hover-bg': toCss(fade(accent, hoverA)),
    'focus-ring': toCss(fade(accent, focusA)),
    'edited-bg': toCss(fade(amber, dark ? 0.22 : 0.14)),
    'error-border': errorBorder,

    // grouping / panels / frozen
    'group-bg': toCss(mix(bg, accent, 0.06)),
    'group-bg-hover': toCss(mix(bg, accent, 0.1)),
    'panel-bg': toCss(mix(bg, fg, 0.05)),
    'frozen-cell-bg': toCss(mix(bg, accent, 0.05)),

    // chrome
    'shadow-sm': shadow(dark, 'sm'),
    'shadow-md': shadow(dark, 'md'),
    'shadow-lg': shadow(dark, 'lg'),
    'scrollbar-thumb': toCss(fade(fg, scrollA)),
    'control-hover': toCss(fade(fg, controlA)),
    'checkbox-border': toCss(mix(fg, bg, 0.5)),
  };

  return map;
}

const px = (n: number): string => `${n}px`;

// Elevation deepens on dark themes, where a soft light-mode shadow disappears.
function shadow(dark: boolean, size: 'sm' | 'md' | 'lg'): string {
  const alpha = dark ? { sm: 0.4, md: 0.5, lg: 0.6 } : { sm: 0.06, md: 0.14, lg: 0.2 };
  const geometry = { sm: '0 1px 2px', md: '0 4px 12px', lg: '0 12px 30px' };
  return `${geometry[size]} rgba(0, 0, 0, ${alpha[size]})`;
}

/**
 * Whether a theme's background reads as dark. Exposed so a builder can, e.g.,
 * flip its own chrome to match the grid it is previewing.
 */
export function isDarkTheme(params: ThemeParams): boolean {
  return luminance(parseColor(params.backgroundColor)) < 0.4;
}
