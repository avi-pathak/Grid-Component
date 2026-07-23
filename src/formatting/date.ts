// =============================================================================
// apgrid — Excel-style date/time formatting
// =============================================================================
// Formats a Date with Excel date/time tokens: `yyyy`/`yy`, `MMMM`/`MMM`/`MM`/`M`
// (month), `dddd`/`ddd`/`dd`/`d` (weekday/day), `HH`/`H` (24h), `hh`/`h` (12h),
// `mm`/`m` (minute), `ss`/`s` (second), and `AM/PM`. Month vs minute follows
// Excel: uppercase `M` is always month; lowercase `m` is a minute only when it
// sits next to an hour or second token, otherwise it is a month. Locale month
// and weekday names come from cached `Intl.DateTimeFormat` instances.

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function dtf(locale: string | undefined, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = (locale ?? '') + JSON.stringify(opts);
  let fmt = dtfCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, opts);
    dtfCache.set(key, fmt);
  }
  return fmt;
}

const pad2 = (n: number): string => (n < 10 ? '0' + n : String(n));

type TokenType = 'field' | 'literal' | 'meridiem';

interface Token {
  type: TokenType;
  letter?: string;
  count?: number;
  text?: string;
  upper?: boolean; // meridiem: AM/PM vs am/pm
  short?: boolean; // meridiem: A/P vs AM/PM
}

const FIELD_LETTERS = new Set(['y', 'M', 'm', 'd', 'H', 'h', 's']);

function tokenize(pattern: string): Token[] {
  const tokens: Token[] = [];
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];

    if (ch === '"') {
      let text = '';
      i++;
      while (i < pattern.length && pattern[i] !== '"') text += pattern[i++];
      tokens.push({ type: 'literal', text });
      continue;
    }
    if (ch === '\\') {
      tokens.push({ type: 'literal', text: pattern[i + 1] ?? '' });
      i++;
      continue;
    }

    const ahead5 = pattern.slice(i, i + 5);
    const ahead3 = pattern.slice(i, i + 3);
    if (/^am\/pm$/i.test(ahead5)) {
      tokens.push({ type: 'meridiem', upper: ahead5[0] === 'A', short: false });
      i += 4;
      continue;
    }
    if (/^a\/p$/i.test(ahead3)) {
      tokens.push({ type: 'meridiem', upper: ahead3[0] === 'A', short: true });
      i += 2;
      continue;
    }

    if (FIELD_LETTERS.has(ch)) {
      let count = 1;
      while (pattern[i + 1] === ch) {
        count++;
        i++;
      }
      tokens.push({ type: 'field', letter: ch, count });
      continue;
    }

    tokens.push({ type: 'literal', text: ch });
  }
  return tokens;
}

// A lowercase `m` is a minute when the nearest field token on either side is an
// hour (before) or a second (after); otherwise it is a month.
function isMinute(tokens: Token[], index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    if (tokens[i].type !== 'field') continue;
    if (tokens[i].letter === 'h' || tokens[i].letter === 'H') return true;
    break;
  }
  for (let i = index + 1; i < tokens.length; i++) {
    if (tokens[i].type !== 'field') continue;
    if (tokens[i].letter === 's') return true;
    break;
  }
  return false;
}

function renderField(letter: string, count: number, date: Date, locale?: string): string {
  switch (letter) {
    case 'y':
      return count <= 2
        ? String(date.getFullYear()).slice(-2).padStart(2, '0')
        : String(date.getFullYear());
    case 'M':
      return renderMonth(count, date, locale);
    case 'd':
      if (count >= 4) return dtf(locale, { weekday: 'long' }).format(date);
      if (count === 3) return dtf(locale, { weekday: 'short' }).format(date);
      return count >= 2 ? pad2(date.getDate()) : String(date.getDate());
    case 'H':
      return count >= 2 ? pad2(date.getHours()) : String(date.getHours());
    case 'h': {
      const h12 = ((date.getHours() + 11) % 12) + 1;
      return count >= 2 ? pad2(h12) : String(h12);
    }
    case 's':
      return count >= 2 ? pad2(date.getSeconds()) : String(date.getSeconds());
    default:
      return '';
  }
}

function renderMonth(count: number, date: Date, locale?: string): string {
  if (count >= 4) return dtf(locale, { month: 'long' }).format(date);
  if (count === 3) return dtf(locale, { month: 'short' }).format(date);
  return count >= 2 ? pad2(date.getMonth() + 1) : String(date.getMonth() + 1);
}

function renderMinute(count: number, date: Date): string {
  return count >= 2 ? pad2(date.getMinutes()) : String(date.getMinutes());
}

/**
 * Format a Date with an Excel-style pattern. Returns `''` for an invalid Date so
 * it never throws.
 */
export function formatDate(value: Date, pattern: string, locale?: string): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';

  const tokens = tokenize(pattern);
  let out = '';

  tokens.forEach((token, index) => {
    if (token.type === 'literal') {
      out += token.text ?? '';
    } else if (token.type === 'meridiem') {
      const pm = value.getHours() >= 12;
      let text = token.short ? (pm ? 'P' : 'A') : pm ? 'PM' : 'AM';
      if (!token.upper) text = text.toLowerCase();
      out += text;
    } else if (token.letter === 'm') {
      out += isMinute(tokens, index)
        ? renderMinute(token.count ?? 1, value)
        : renderMonth(token.count ?? 1, value, locale);
    } else {
      out += renderField(token.letter!, token.count ?? 1, value, locale);
    }
  });

  return out;
}

/** Locale-default date/time presets, backing the `d`/`D`/`t`/`T`/`g`/`G` shortcuts. */
export function formatDatePreset(
  value: Date,
  preset: 'd' | 'D' | 't' | 'T' | 'g' | 'G',
  locale?: string,
): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  const opts: Record<typeof preset, Intl.DateTimeFormatOptions> = {
    d: { dateStyle: 'short' },
    D: { dateStyle: 'long' },
    t: { timeStyle: 'short' },
    T: { timeStyle: 'medium' },
    g: { dateStyle: 'short', timeStyle: 'short' },
    G: { dateStyle: 'short', timeStyle: 'medium' },
  };
  return dtf(locale, opts[preset]).format(value);
}
