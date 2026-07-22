import { describe, it, expect } from 'vitest';
import {
  parseColor,
  toCss,
  toHex,
  mix,
  fade,
  over,
  lighten,
  darken,
  luminance,
  contrast,
  isDark,
  pickContrasting,
  RGBA,
} from './Color';

const white: RGBA = { r: 255, g: 255, b: 255, a: 1 };
const black: RGBA = { r: 0, g: 0, b: 0, a: 1 };

describe('parseColor', () => {
  it('parses 6-digit hex', () => {
    expect(parseColor('#2563eb')).toEqual({ r: 37, g: 99, b: 235, a: 1 });
  });

  it('parses 3-digit hex by doubling nibbles', () => {
    expect(parseColor('#abc')).toEqual({ r: 0xaa, g: 0xbb, b: 0xcc, a: 1 });
  });

  it('parses 8-digit hex alpha', () => {
    const c = parseColor('#00000080');
    expect(c.r).toBe(0);
    expect(c.a).toBeCloseTo(0.502, 2);
  });

  it('parses 4-digit hex alpha', () => {
    expect(parseColor('#f00f')).toEqual({ r: 255, g: 0, b: 0, a: 1 });
  });

  it('parses rgb() and rgba()', () => {
    expect(parseColor('rgb(1, 2, 3)')).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor('rgba(1, 2, 3, 0.5)')).toEqual({ r: 1, g: 2, b: 3, a: 0.5 });
  });

  it('parses modern space/slash rgb syntax', () => {
    expect(parseColor('rgb(10 20 30 / 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(parseColor('  #FFF  ')).toEqual(white);
  });

  it('throws on garbage rather than guessing', () => {
    expect(() => parseColor('not-a-color')).toThrow();
    expect(() => parseColor('#12345')).toThrow();
  });
});

describe('toCss', () => {
  it('emits rgb() when opaque and rgba() when translucent', () => {
    expect(toCss(white)).toBe('rgb(255, 255, 255)');
    expect(toCss({ r: 0, g: 0, b: 0, a: 0.5 })).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('round-trips through parseColor', () => {
    const c = parseColor('#336699');
    expect(parseColor(toCss(c))).toEqual(c);
  });

  it('clamps out-of-range channels', () => {
    expect(toCss({ r: 300, g: -5, b: 128, a: 2 })).toBe('rgb(255, 0, 128)');
  });
});

describe('toHex', () => {
  it('formats an opaque colour as #rrggbb', () => {
    expect(toHex({ r: 37, g: 99, b: 235, a: 1 })).toBe('#2563eb');
  });

  it('pads single-digit channels and ignores alpha', () => {
    expect(toHex({ r: 0, g: 5, b: 255, a: 0.3 })).toBe('#0005ff');
  });

  it('round-trips with parseColor', () => {
    expect(toHex(parseColor('#1b1f27'))).toBe('#1b1f27');
  });
});

describe('mix', () => {
  it('returns endpoints at t=0 and t=1', () => {
    expect(mix(black, white, 0)).toEqual(black);
    expect(mix(black, white, 1)).toEqual(white);
  });

  it('returns the midpoint at t=0.5', () => {
    expect(mix(black, white, 0.5)).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });

  it('interpolates alpha', () => {
    expect(mix(fade(black, 0), black, 0.5).a).toBe(0.5);
  });
});

describe('lighten / darken', () => {
  it('move toward white and black', () => {
    expect(toCss(lighten(black, 1))).toBe('rgb(255, 255, 255)');
    expect(toCss(darken(white, 1))).toBe('rgb(0, 0, 0)');
  });
});

describe('over', () => {
  it('composites a translucent colour to an opaque result', () => {
    const result = over(fade(white, 0.5), black);
    expect(result).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });

  it('leaves an opaque foreground unchanged', () => {
    expect(over(white, black)).toEqual(white);
  });
});

describe('luminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(luminance(black)).toBeCloseTo(0, 5);
    expect(luminance(white)).toBeCloseTo(1, 5);
  });
});

describe('contrast', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrast(black, white)).toBeCloseTo(21, 1);
    expect(contrast(white, white)).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    const a = parseColor('#2563eb');
    const b = parseColor('#f7f9fc');
    expect(contrast(a, b)).toBeCloseTo(contrast(b, a), 6);
  });
});

describe('isDark', () => {
  it('classifies backgrounds by luminance', () => {
    expect(isDark(black)).toBe(true);
    expect(isDark(white)).toBe(false);
    expect(isDark(parseColor('#1b1f27'))).toBe(true);
    expect(isDark(parseColor('#f7f9fc'))).toBe(false);
  });
});

describe('pickContrasting', () => {
  it('picks black text on a light accent and white on a dark one', () => {
    expect(pickContrasting([white, black], parseColor('#fbbf24'))).toEqual(black);
    expect(pickContrasting([white, black], parseColor('#1e40af'))).toEqual(white);
  });
});
