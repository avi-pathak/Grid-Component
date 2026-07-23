import { describe, it, expect } from 'vitest';
import { formatNumber } from './number';

describe('formatNumber', () => {
  it('rounds to a fixed number of decimals', () => {
    expect(formatNumber(123.456, '0.00')).toBe('123.46');
    expect(formatNumber(123.4, '0.00')).toBe('123.40');
    expect(formatNumber(123, '0')).toBe('123');
  });

  it('groups thousands', () => {
    expect(formatNumber(1234567, '#,##0')).toBe('1,234,567');
    expect(formatNumber(1234.5, '#,##0.00')).toBe('1,234.50');
  });

  it('drops optional (#) digits but keeps required (0) ones', () => {
    expect(formatNumber(5, '#,##0.##')).toBe('5');
    expect(formatNumber(5.5, '#,##0.##')).toBe('5.5');
    expect(formatNumber(5.25, '0.0#')).toBe('5.25');
    expect(formatNumber(5, '0.0#')).toBe('5.0');
  });

  it('shows a leading-dot number when the integer part is all #', () => {
    expect(formatNumber(0.5, '#.00')).toBe('.50');
    expect(formatNumber(0.5, '0.00')).toBe('0.50');
  });

  it('scales percentages by 100 and keeps the % literal', () => {
    expect(formatNumber(0.1234, '0.00%')).toBe('12.34%');
    expect(formatNumber(0.5, '0%')).toBe('50%');
  });

  it('honours currency and literal prefixes/suffixes', () => {
    expect(formatNumber(1234.5, '$#,##0.00')).toBe('$1,234.50');
    expect(formatNumber(3.2, '0.0"kg"')).toBe('3.2kg');
    expect(formatNumber(5, '\\$0')).toBe('$5');
  });

  it('uses the negative section when present', () => {
    expect(formatNumber(-5, '#,##0.00;(#,##0.00)')).toBe('(5.00)');
    expect(formatNumber(5, '#,##0.00;(#,##0.00)')).toBe('5.00');
  });

  it('applies an implicit minus sign with a single section', () => {
    expect(formatNumber(-1234.5, '$#,##0.00')).toBe('-$1,234.50');
    expect(formatNumber(-42, '#,##0')).toBe('-42');
  });

  it('uses the zero section when provided', () => {
    expect(formatNumber(0, '#,##0.00;(#,##0.00);"—"')).toBe('—');
    expect(formatNumber(0, '#,##0.00')).toBe('0.00');
  });

  it('renders an empty section as a blank string', () => {
    expect(formatNumber(0, '#,##0;;')).toBe('');
  });

  it('respects a locale for separators', () => {
    // de-DE swaps the group and decimal separators.
    expect(formatNumber(1234.5, '#,##0.00', 'de-DE')).toBe('1.234,50');
  });

  it('never throws on non-finite input', () => {
    expect(formatNumber(NaN, '0.00')).toBe('NaN');
    expect(formatNumber(Infinity, '0.00')).toBe('Infinity');
  });
});
