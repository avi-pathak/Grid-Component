import { clamp } from './Math';

// =============================================================================
// apgrid — colour utilities
// =============================================================================
// A tiny, dependency-free colour toolkit used by the theming layer to derive a
// full token palette from a handful of seed colours. Everything works on a plain
// RGBA tuple so the maths stays obvious; parsing accepts the CSS forms a theme
// author is likely to hand us (hex 3/4/6/8, rgb(), rgba()) and output is always a
// canonical rgb()/rgba() string that every browser and jsdom agree on.

/** Red/green/blue in 0–255, alpha in 0–1. */
export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

const clamp255 = (n: number): number => clamp(Math.round(n), 0, 255);
const clamp01 = (n: number): number => clamp(n, 0, 1);

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB_FN = /^rgba?\(([^)]+)\)$/i;

/**
 * Parse a CSS colour string into an `RGBA`. Supports `#rgb`, `#rgba`, `#rrggbb`,
 * `#rrggbbaa`, `rgb(r,g,b)` and `rgba(r,g,b,a)` (comma or space separated, with
 * an optional `/ alpha`). Throws on anything it does not understand rather than
 * guessing — a bad seed colour should surface loudly in a theme, not silently
 * paint the grid black.
 */
export function parseColor(input: string): RGBA {
  const str = input.trim();

  const hex = HEX.exec(str);
  if (hex) return parseHex(hex[1]);

  const fn = RGB_FN.exec(str);
  if (fn) return parseRgbFn(fn[1]);

  throw new Error(`apgrid: cannot parse colour "${input}"`);
}

function parseHex(body: string): RGBA {
  // #rgb / #rgba use one nibble per channel; expand each to a full byte.
  if (body.length === 3 || body.length === 4) {
    const [r, g, b, a = 'f'] = body.split('');
    return {
      r: parseInt(r + r, 16),
      g: parseInt(g + g, 16),
      b: parseInt(b + b, 16),
      a: parseInt(a + a, 16) / 255,
    };
  }
  if (body.length === 6 || body.length === 8) {
    return {
      r: parseInt(body.slice(0, 2), 16),
      g: parseInt(body.slice(2, 4), 16),
      b: parseInt(body.slice(4, 6), 16),
      a: body.length === 8 ? parseInt(body.slice(6, 8), 16) / 255 : 1,
    };
  }
  throw new Error(`apgrid: invalid hex colour "#${body}"`);
}

function parseRgbFn(body: string): RGBA {
  // Accept both "r, g, b" and the modern "r g b / a" syntaxes.
  const parts = body
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length < 3) throw new Error(`apgrid: invalid rgb colour "rgb(${body})"`);
  const channel = (s: string): number =>
    s.endsWith('%') ? (parseFloat(s) / 100) * 255 : parseFloat(s);
  return {
    r: clamp255(channel(parts[0])),
    g: clamp255(channel(parts[1])),
    b: clamp255(channel(parts[2])),
    a: parts[3] != null ? clamp01(parseFloat(parts[3])) : 1,
  };
}

/** Canonical CSS string: `rgb(...)` when opaque, `rgba(...)` otherwise. */
export function toCss({ r, g, b, a }: RGBA): string {
  const R = clamp255(r);
  const G = clamp255(g);
  const B = clamp255(b);
  if (a >= 1) return `rgb(${R}, ${G}, ${B})`;
  return `rgba(${R}, ${G}, ${B}, ${round(clamp01(a), 3)})`;
}

/** `#rrggbb` string, ignoring alpha — the form an `<input type="color">` needs. */
export function toHex({ r, g, b }: RGBA): string {
  const hex = (n: number): string => clamp255(n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Linearly interpolate two colours by `t` (0 → `a`, 1 → `b`), including alpha.
 * This is a straight channel blend, not an alpha-composite — use `over` when you
 * need to lay a translucent colour on top of an opaque one.
 */
export function mix(a: RGBA, b: RGBA, t: number): RGBA {
  const k = clamp01(t);
  return {
    r: a.r + (b.r - a.r) * k,
    g: a.g + (b.g - a.g) * k,
    b: a.b + (b.b - a.b) * k,
    a: a.a + (b.a - a.a) * k,
  };
}

/** Return `color` with its alpha replaced by `alpha` (0–1). */
export function fade(color: RGBA, alpha: number): RGBA {
  return { ...color, a: clamp01(alpha) };
}

/**
 * Composite a (possibly translucent) `fg` over an opaque `bg` — the "source-over"
 * blend a browser performs when painting one on the other. Returns an opaque
 * colour, which is what tokens that must be solid (e.g. a pinned-cell background)
 * need.
 */
export function over(fg: RGBA, bg: RGBA): RGBA {
  const a = clamp01(fg.a);
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

const WHITE: RGBA = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: RGBA = { r: 0, g: 0, b: 0, a: 1 };

/** Mix `color` toward white by `t`. */
export const lighten = (color: RGBA, t: number): RGBA => mix(color, WHITE, t);

/** Mix `color` toward black by `t`. */
export const darken = (color: RGBA, t: number): RGBA => mix(color, BLACK, t);

/**
 * WCAG relative luminance (0 = black, 1 = white). Alpha is ignored — luminance is
 * a property of the visible colour, so composite first if the colour is
 * translucent.
 */
export function luminance({ r, g, b }: RGBA): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours, from 1 (identical) to 21 (black/white). */
export function contrast(a: RGBA, b: RGBA): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** True when a colour is dark enough that light text reads better on it. */
export const isDark = (color: RGBA): boolean => luminance(color) < 0.4;

/** Of the `candidates`, the one with the highest contrast against `bg`. */
export function pickContrasting(candidates: RGBA[], bg: RGBA): RGBA {
  let best = candidates[0];
  let bestRatio = -1;
  for (const c of candidates) {
    const ratio = contrast(c, bg);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = c;
    }
  }
  return best;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
