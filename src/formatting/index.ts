// =============================================================================
// apgrid — value formatting entry
// =============================================================================
// `format(value, pattern, locale?, currency?)` turns a raw value into a display
// string using an Excel-style pattern or a short .NET/Wijmo code. This is the
// engine behind `ColumnDef.format`, and it is exported so consumers can format
// values outside the grid (like Wijmo's `Globalize.format`). It never throws:
// unrecognised input falls back to `String(value)`.

import { formatNumber } from './number';
import { formatDate, formatDatePreset } from './date';
import { expandNumberShortcut, currencyShortcutDigits, datePreset } from './shortcuts';

export interface FormatOptions {
  locale?: string;
  /** ISO currency code for the `c` shortcut and `Intl` currency style. Default USD. */
  currency?: string;
}

const currencyCache = new Map<string, Intl.NumberFormat>();

function formatCurrency(value: number, digits: number, opts: FormatOptions): string {
  const currency = opts.currency ?? 'USD';
  const key = `${opts.locale ?? ''}|${currency}|${digits}`;
  let fmt = currencyCache.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat(opts.locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
    } catch {
      // Bad currency/locale — degrade to a plain fixed-decimal number.
      return formatNumber(value, `#,##0.${'0'.repeat(digits)}`, opts.locale);
    }
    currencyCache.set(key, fmt);
  }
  return fmt.format(value);
}

/**
 * Format `value` with an Excel-style `pattern` (or a short code like `n2`, `c`,
 * `p0`, `d`). Returns `''` for `null`/`undefined` and `String(value)` for
 * anything it can't format.
 */
export function format(
  value: unknown,
  pattern: string,
  locale?: string,
  currency?: string,
): string {
  if (value == null || pattern === '') return value == null ? '' : String(value);
  const opts: FormatOptions = { locale, currency };

  // Whole-string shortcut codes take priority over the pattern grammar.
  const preset = datePreset(pattern);
  if (preset && value instanceof Date) return formatDatePreset(value, preset, locale);

  if (typeof value === 'number') {
    const cDigits = currencyShortcutDigits(pattern);
    if (cDigits != null) return formatCurrency(value, cDigits, opts);
    const expanded = expandNumberShortcut(pattern);
    return formatNumber(value, expanded ?? pattern, locale);
  }

  if (value instanceof Date) return formatDate(value, pattern, locale);

  // Text: honour a 4-section pattern's text section (`@` = the string).
  if (typeof value === 'string' && pattern.includes('@')) {
    const textSection = pattern.split(';').pop() ?? '';
    return textSection.replace(/@/g, value).replace(/"/g, '');
  }

  return String(value);
}

export { formatNumber } from './number';
export { formatDate, formatDatePreset } from './date';
