import { describe, it, expect } from 'vitest';
import { Column } from './Column';

describe('Column', () => {
  it('defaults header to binding and width to 100', () => {
    const col = new Column({ binding: 'sales' });
    expect(col.header).toBe('sales');
    expect(col.width).toBe(100);
  });

  it('reads values by binding', () => {
    const col = new Column({ binding: 'country' });
    expect(col.getValue({ country: 'UK' })).toBe('UK');
  });

  it('uses valueGetter and valueFormatter when provided', () => {
    const col = new Column<{ price: number }>({
      binding: 'price',
      valueGetter: (item) => item.price * 2,
      valueFormatter: (value) => `$${value}`,
    });
    expect(col.getValue({ price: 10 })).toBe(20);
    expect(col.format({ price: 10 })).toBe('$20');
  });

  it('formats null and undefined as empty strings', () => {
    const col = new Column({ binding: 'x' });
    expect(col.format({ x: null })).toBe('');
    expect(col.format({})).toBe('');
  });
});
