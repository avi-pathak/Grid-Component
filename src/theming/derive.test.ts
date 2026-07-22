import { describe, it, expect } from 'vitest';
import { deriveTokens, isDarkTheme } from './derive';
import { themeToCss, applyTheme } from './apply';
import { presets } from './presets';
import { ThemeParams, TokenName } from './types';
import { parseColor, contrast, over } from '../utils/Color';

const ALL_TOKENS: TokenName[] = [
  'row-height',
  'header-height',
  'group-header-height',
  'cell-padding-x',
  'radius',
  'radius-sm',
  'radius-lg',
  'border-width',
  'border-width-strong',
  'accent-ring-width',
  'font-family',
  'font-size',
  'line-height',
  'font-weight-header',
  'font-weight-medium',
  'transition',
  'cell-bg',
  'cell-bg-alt',
  'cell-fg',
  'fg-muted',
  'border-color',
  'border-strong',
  'header-bg',
  'header-fg',
  'active-border',
  'accent-contrast',
  'selected-bg',
  'hover-bg',
  'focus-ring',
  'edited-bg',
  'error-border',
  'group-bg',
  'group-bg-hover',
  'panel-bg',
  'frozen-cell-bg',
  'shadow-sm',
  'shadow-md',
  'shadow-lg',
  'scrollbar-thumb',
  'control-hover',
  'checkbox-border',
];

const sample: ThemeParams = {
  fontFamily: 'system-ui',
  fontSize: 13,
  backgroundColor: '#ffffff',
  foregroundColor: '#1f2933',
  accentColor: '#2563eb',
  borderColor: '#e3e7ef',
  borders: 'all',
  oddRowStriping: true,
  spacing: 8,
  wrapperRadius: 8,
  widgetRadius: 6,
  rowHeight: 30,
  headerHeight: 36,
};

describe('deriveTokens', () => {
  it('produces every token name and no others', () => {
    const tokens = deriveTokens(sample);
    expect(Object.keys(tokens).sort()).toEqual([...ALL_TOKENS].sort());
  });

  it('passes seed colours straight through', () => {
    const tokens = deriveTokens(sample);
    expect(tokens['cell-bg']).toBe('rgb(255, 255, 255)');
    expect(tokens['cell-fg']).toBe('rgb(31, 41, 51)');
    expect(tokens['active-border']).toBe('rgb(37, 99, 235)');
  });

  it('maps geometry and radius params to px', () => {
    const tokens = deriveTokens(sample);
    expect(tokens['row-height']).toBe('30px');
    expect(tokens['header-height']).toBe('36px');
    expect(tokens['radius-lg']).toBe('8px');
    expect(tokens.radius).toBe('6px');
    expect(tokens['radius-sm']).toBe('4px');
  });

  it('drops striping to the base surface when disabled', () => {
    const striped = deriveTokens({ ...sample, oddRowStriping: true });
    const flat = deriveTokens({ ...sample, oddRowStriping: false });
    expect(flat['cell-bg-alt']).toBe(flat['cell-bg']);
    expect(striped['cell-bg-alt']).not.toBe(striped['cell-bg']);
  });

  it('zeroes border widths when borders are off', () => {
    const tokens = deriveTokens({ ...sample, borders: 'none' });
    expect(tokens['border-width']).toBe('0');
    expect(tokens['border-width-strong']).toBe('0');
  });

  it('derives the selection ring width, defaulting to 1px', () => {
    expect(deriveTokens(sample)['accent-ring-width']).toBe('1px');
    expect(deriveTokens({ ...sample, selectionRingWidth: 3 })['accent-ring-width']).toBe('3px');
  });

  it('detects dark backgrounds without a mode flag', () => {
    expect(isDarkTheme(sample)).toBe(false);
    expect(isDarkTheme({ ...sample, backgroundColor: '#12151b' })).toBe(true);
  });

  it('strengthens accent state fills on dark themes', () => {
    const light = deriveTokens(sample);
    const dark = deriveTokens({
      ...sample,
      backgroundColor: '#12151b',
      foregroundColor: '#e6e9ee',
    });
    const alpha = (v: string): number => parseColor(v).a;
    expect(alpha(dark['selected-bg'])).toBeGreaterThan(alpha(light['selected-bg']));
  });

  it('produces CSS-parseable colours for every colour token', () => {
    const tokens = deriveTokens(sample);
    const colourTokens: TokenName[] = [
      'cell-bg',
      'cell-bg-alt',
      'cell-fg',
      'fg-muted',
      'border-color',
      'border-strong',
      'header-bg',
      'header-fg',
      'active-border',
      'accent-contrast',
      'selected-bg',
      'hover-bg',
      'focus-ring',
      'edited-bg',
      'error-border',
      'group-bg',
      'group-bg-hover',
      'panel-bg',
      'frozen-cell-bg',
      'scrollbar-thumb',
      'control-hover',
      'checkbox-border',
    ];
    for (const name of colourTokens) {
      expect(() => parseColor(tokens[name]), name).not.toThrow();
    }
  });
});

describe('preset accessibility', () => {
  // The whole point of derivation is that a coherent, legible palette falls out
  // of a few seeds. Assert it: body text on the cell surface must clear WCAG AA
  // (4.5:1), and the checkmark colour must clear it against the accent fill.
  for (const preset of presets) {
    it(`${preset.label}: text on surface meets WCAG AA`, () => {
      const tokens = deriveTokens(preset.params);
      const ratio = contrast(parseColor(tokens['cell-fg']), parseColor(tokens['cell-bg']));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it(`${preset.label}: header text is legible on the header`, () => {
      const tokens = deriveTokens(preset.params);
      const ratio = contrast(parseColor(tokens['header-fg']), parseColor(tokens['header-bg']));
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it(`${preset.label}: checkmark contrasts the accent`, () => {
      const tokens = deriveTokens(preset.params);
      const ratio = contrast(
        parseColor(tokens['accent-contrast']),
        parseColor(tokens['active-border']),
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it(`${preset.label}: a selected row stays readable`, () => {
      // selected-bg is translucent accent over the surface — composite it first.
      const tokens = deriveTokens(preset.params);
      const bg = over(parseColor(tokens['selected-bg']), parseColor(tokens['cell-bg']));
      const ratio = contrast(parseColor(tokens['cell-fg']), bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('themeToCss', () => {
  it('emits a rule of custom properties for the selector', () => {
    const css = themeToCss('.apg-theme-x', sample);
    expect(css).toContain('.apg-theme-x {');
    expect(css).toContain('--apg-cell-bg: rgb(255, 255, 255);');
    expect(css).toContain('--apg-active-border: rgb(37, 99, 235);');
  });

  it('adds a column-border suppression rule only for horizontal borders', () => {
    expect(themeToCss('.x', { ...sample, borders: 'all' })).not.toContain('border-right-width');
    const horizontal = themeToCss('.x', { ...sample, borders: 'horizontal' });
    expect(horizontal).toContain('.x .apg-cell');
    expect(horizontal).toContain('border-right-width: 0;');
  });
});

describe('applyTheme', () => {
  it('writes custom properties and toggles the horizontal-borders class', () => {
    const el = document.createElement('div');
    applyTheme(el, sample);
    expect(el.style.getPropertyValue('--apg-cell-bg')).toBe('rgb(255, 255, 255)');
    expect(el.classList.contains('apg-borders-horizontal')).toBe(false);

    applyTheme(el, { ...sample, borders: 'horizontal' });
    expect(el.classList.contains('apg-borders-horizontal')).toBe(true);
  });
});
