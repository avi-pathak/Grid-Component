import { describe, it, expect } from 'vitest';
import { formatDate, formatDatePreset } from './date';

// A fixed local date/time: 2024-01-05 (Friday) 09:07:03.
const d = new Date(2024, 0, 5, 9, 7, 3);
// An afternoon time for 12h/meridiem coverage: 15:42.
const pm = new Date(2024, 6, 9, 15, 42, 0);

describe('formatDate', () => {
  it('formats months by token length', () => {
    expect(formatDate(d, 'M', 'en-US')).toBe('1');
    expect(formatDate(d, 'MM', 'en-US')).toBe('01');
    expect(formatDate(d, 'MMM', 'en-US')).toBe('Jan');
    expect(formatDate(d, 'MMMM', 'en-US')).toBe('January');
  });

  it('formats the common "MMM d, yyyy" pattern', () => {
    expect(formatDate(d, 'MMM d, yyyy', 'en-US')).toBe('Jan 5, 2024');
  });

  it('formats numeric dates with 2-digit years', () => {
    expect(formatDate(d, 'M/d/yy', 'en-US')).toBe('1/5/24');
    expect(formatDate(d, 'MM/dd/yyyy', 'en-US')).toBe('01/05/2024');
  });

  it('formats weekdays', () => {
    expect(formatDate(d, 'ddd', 'en-US')).toBe('Fri');
    expect(formatDate(d, 'dddd', 'en-US')).toBe('Friday');
  });

  it('reads lowercase m as minute next to an hour', () => {
    expect(formatDate(d, 'h:mm', 'en-US')).toBe('9:07');
    expect(formatDate(d, 'HH:mm:ss', 'en-US')).toBe('09:07:03');
  });

  it('reads lowercase m as month when standalone', () => {
    expect(formatDate(d, 'm/d/yyyy', 'en-US')).toBe('1/5/2024');
  });

  it('handles 12-hour clock and meridiem', () => {
    expect(formatDate(d, 'h:mm AM/PM', 'en-US')).toBe('9:07 AM');
    expect(formatDate(pm, 'h:mm AM/PM', 'en-US')).toBe('3:42 PM');
    expect(formatDate(pm, 'h:mm am/pm', 'en-US')).toBe('3:42 pm');
    expect(formatDate(pm, 'H:mm', 'en-US')).toBe('15:42');
  });

  it('keeps quoted and escaped literals', () => {
    expect(formatDate(d, '"Year:" yyyy', 'en-US')).toBe('Year: 2024');
  });

  it('returns empty string for an invalid date', () => {
    expect(formatDate(new Date('nope'), 'yyyy')).toBe('');
  });
});

describe('formatDatePreset', () => {
  it('renders locale-default presets', () => {
    expect(formatDatePreset(d, 'd', 'en-US')).toBe('1/5/24');
    expect(formatDatePreset(d, 'D', 'en-US')).toBe('January 5, 2024');
  });
});
