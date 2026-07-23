// =============================================================================
// apgrid — Excel-style number formatting
// =============================================================================
// A hand-rolled formatter for the common Excel number-pattern grammar: digit
// placeholders `0` and `#`, a decimal point, thousands grouping, percent scaling,
// currency/literal prefixes and suffixes, and the up-to-four-section
// `positive;negative;zero;text` form. Locale-specific group and decimal
// separators come from `Intl.NumberFormat`; everything else is parsed here,
// because Excel custom patterns have no `Intl` equivalent.
//
// Deliberately NOT supported (documented as future work): fractions `?/?`,
// scientific `E+`, magnitude scaling `0,,`, `[Red]` colours, conditional
// `[>100]` sections, fill `*`, and alignment `_`.

interface Separators {
  group: string;
  decimal: string;
}

const sepCache = new Map<string, Separators>();

function separators(locale?: string): Separators {
  const key = locale ?? '';
  const cached = sepCache.get(key);
  if (cached) return cached;
  let seps: Separators = { group: ',', decimal: '.' };
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(11111.1);
    seps = {
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    };
  } catch {
    // Unknown locale — fall back to the invariant separators.
  }
  sepCache.set(key, seps);
  return seps;
}

/** Split a pattern into its `;`-separated sections, respecting quoted literals. */
function splitSections(pattern: string): string[] {
  const sections: string[] = [];
  let current = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '"') {
      current += ch;
      i++;
      while (i < pattern.length && pattern[i] !== '"') current += pattern[i++];
      if (i < pattern.length) current += pattern[i];
    } else if (ch === '\\') {
      current += ch + (pattern[i + 1] ?? '');
      i++;
    } else if (ch === ';') {
      sections.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  sections.push(current);
  return sections;
}

interface SectionParts {
  prefix: string;
  suffix: string;
  digitRun: string;
  percent: number;
  hasNumber: boolean;
}

// Pull the numeric placeholder run out of a section, keeping the surrounding
// literal text as prefix/suffix. `%` is both a literal (kept in the output) and
// a ×100 scaling signal.
function parseSection(section: string): SectionParts {
  const literalAt = (out: { text: string }, src: string, i: number): number => {
    const ch = src[i];
    if (ch === '"') {
      i++;
      while (i < src.length && src[i] !== '"') out.text += src[i++];
      return i;
    }
    if (ch === '\\') {
      out.text += src[i + 1] ?? '';
      return i + 1;
    }
    out.text += ch;
    return i;
  };

  const prefix = { text: '' };
  const suffix = { text: '' };
  let digitRun = '';
  let percent = 0;
  let hasNumber = false;
  let seenNumber = false;

  for (let i = 0; i < section.length; i++) {
    const ch = section[i];
    const isDigitToken = ch === '0' || ch === '#' || ch === ',' || ch === '.';
    if (ch === '%') percent++;
    if (isDigitToken) {
      digitRun += ch;
      hasNumber = true;
      seenNumber = true;
    } else {
      i = literalAt(seenNumber ? suffix : prefix, section, i);
    }
  }

  return { prefix: prefix.text, suffix: suffix.text, digitRun, percent, hasNumber };
}

function groupThousands(intDigits: string, group: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, group);
}

function formatDigitRun(magnitude: number, digitRun: string, seps: Separators): string {
  const dot = digitRun.indexOf('.');
  const intPat = dot >= 0 ? digitRun.slice(0, dot) : digitRun;
  const fracPat = dot >= 0 ? digitRun.slice(dot + 1) : '';
  const hasThousands = intPat.includes(',');
  const minInt = (intPat.match(/0/g) ?? []).length;
  const maxFrac = (fracPat.match(/[0#]/g) ?? []).length;
  const minFrac = (fracPat.match(/0/g) ?? []).length;

  const fixed = magnitude.toFixed(maxFrac);
  const [rawInt, rawFrac = ''] = fixed.split('.');

  // Integer part: pad to the minimum, or drop a lone zero when the pattern uses
  // only `#` before the point (Excel shows ".5", not "0.5", for `#.0`).
  let intStr = rawInt;
  if (intStr.length < minInt) intStr = '0'.repeat(minInt - intStr.length) + intStr;
  if (minInt === 0 && Number(rawInt) === 0) intStr = '';
  if (hasThousands && intStr) intStr = groupThousands(intStr, seps.group);

  // Fraction: trim trailing zeros down to the minimum.
  let fracStr = rawFrac;
  while (fracStr.length > minFrac && fracStr.endsWith('0')) fracStr = fracStr.slice(0, -1);

  const showDecimal = fracPat.length > 0 && fracStr.length > 0;
  return intStr + (showDecimal ? seps.decimal + fracStr : '');
}

/**
 * Format a number with an Excel-style pattern. Returns `String(value)` for
 * non-finite input so it never throws.
 */
export function formatNumber(value: number, pattern: string, locale?: string): string {
  if (!Number.isFinite(value)) return String(value);

  const sections = splitSections(pattern);
  const negative = value < 0;

  // Section selection: [positive, negative, zero, text]. With one section,
  // negatives get an implicit sign; the negative section is fed the magnitude
  // since it carries its own sign/parentheses.
  let section: string;
  let implicitSign = false;
  if (value > 0) {
    section = sections[0];
  } else if (negative) {
    if (sections[1] !== undefined) {
      section = sections[1];
    } else {
      section = sections[0];
      implicitSign = true;
    }
  } else {
    section = sections[2] !== undefined ? sections[2] : sections[0];
  }

  if (section === '') return '';

  const parts = parseSection(section);
  const seps = separators(locale);

  let magnitude = Math.abs(value);
  if (parts.percent > 0) magnitude *= 100 ** parts.percent;

  const body = parts.hasNumber ? formatDigitRun(magnitude, parts.digitRun, seps) : '';

  const sign = implicitSign ? '-' : '';
  return sign + parts.prefix + body + parts.suffix;
}
