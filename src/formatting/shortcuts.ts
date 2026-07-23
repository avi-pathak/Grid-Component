// =============================================================================
// apgrid — format shortcut codes
// =============================================================================
// Concise .NET/Wijmo-style codes recognised only when they are the ENTIRE
// pattern (e.g. `format: 'n2'`). Any longer string is treated as an Excel
// pattern. Number codes expand to an Excel pattern; currency and date codes are
// handled directly against `Intl` by the dispatcher, since their symbol,
// placement, and field order are locale-specific.

const NUMBER_SHORTCUT = /^([nfp])(\d*)$/i;
const CURRENCY_SHORTCUT = /^c(\d*)$/i;
const DATE_PRESETS = new Set(['d', 'D', 't', 'T', 'g', 'G']);

/** Expand `n`/`f`/`p` (+ optional digit count) to an Excel pattern, else null. */
export function expandNumberShortcut(pattern: string): string | null {
  const m = NUMBER_SHORTCUT.exec(pattern);
  if (!m) return null;
  const kind = m[1].toLowerCase();
  const digits = m[2] === '' ? 2 : Number(m[2]);
  const frac = digits > 0 ? '.' + '0'.repeat(digits) : '';
  if (kind === 'n') return `#,##0${frac}`;
  if (kind === 'f') return `0${frac}`;
  return `0${frac}%`; // p
}

/** Digit count for a `c` currency shortcut, or null when the pattern isn't one. */
export function currencyShortcutDigits(pattern: string): number | null {
  const m = CURRENCY_SHORTCUT.exec(pattern);
  if (!m) return null;
  return m[1] === '' ? 2 : Number(m[1]);
}

/** Whether `pattern` is a whole-string date/time preset code. */
export function datePreset(pattern: string): 'd' | 'D' | 't' | 'T' | 'g' | 'G' | null {
  return DATE_PRESETS.has(pattern) ? (pattern as 'd' | 'D' | 't' | 'T' | 'g' | 'G') : null;
}
