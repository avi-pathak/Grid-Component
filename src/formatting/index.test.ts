import { describe, it, expect } from 'vitest';
import { format } from './index';

describe('format dispatch', () => {
  it('formats numbers with Excel patterns', () => {
    expect(format(1234.5, '#,##0.00')).toBe('1,234.50');
    expect(format(0.1234, '0.00%')).toBe('12.34%');
  });

  it('expands n/f/p number shortcuts', () => {
    expect(format(1234.5, 'n2')).toBe('1,234.50');
    expect(format(1234.5, 'n0')).toBe('1,235');
    expect(format(5, 'f2')).toBe('5.00');
    expect(format(0.5, 'p0')).toBe('50%');
  });

  it('formats currency via the c shortcut', () => {
    expect(format(1234.5, 'c', 'en-US', 'USD')).toBe('$1,234.50');
    expect(format(1234.5, 'c0', 'en-US', 'USD')).toBe('$1,235');
  });

  it('formats dates with Excel patterns and presets', () => {
    const d = new Date(2024, 0, 5);
    expect(format(d, 'MMM d, yyyy', 'en-US')).toBe('Jan 5, 2024');
    expect(format(d, 'd', 'en-US')).toBe('1/5/24');
  });

  it('substitutes the text section for strings', () => {
    expect(format('n/a', '#,##0;;;"["@"]"')).toBe('[n/a]');
  });

  it('returns empty string for null/undefined and never throws', () => {
    expect(format(null, '0.00')).toBe('');
    expect(format(undefined, '0.00')).toBe('');
    expect(format(42, '')).toBe('42');
    expect(format({ a: 1 }, '0.00')).toBe('[object Object]');
  });
});
