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

  it('defaults dataType to String and aligns left', () => {
    const col = new Column({ binding: 'name' });
    expect(col.dataType).toBe('String');
    expect(col.align).toBe('left');
  });

  it('aligns Number and Date right, Boolean center', () => {
    expect(new Column({ binding: 'n', dataType: 'Number' }).align).toBe('right');
    expect(new Column({ binding: 'd', dataType: 'Date' }).align).toBe('right');
    expect(new Column({ binding: 'b', dataType: 'Boolean' }).align).toBe('center');
  });

  it('lets align override the dataType default', () => {
    expect(new Column({ binding: 'n', dataType: 'Number', align: 'left' }).align).toBe('left');
  });

  it('parses text into the column dataType', () => {
    expect(new Column({ binding: 'n', dataType: 'Number' }).parse('42')).toBe(42);
    expect(new Column({ binding: 'n', dataType: 'Number' }).parse('')).toBeNull();
    expect(new Column({ binding: 'b', dataType: 'Boolean' }).parse('true')).toBe(true);
    expect(new Column({ binding: 'b', dataType: 'Boolean' }).parse('false')).toBe(false);
    expect(new Column({ binding: 's' }).parse('hello')).toBe('hello');
    const d = new Column({ binding: 'd', dataType: 'Date' }).parse('2024-03-15') as Date;
    expect(d).toBeInstanceOf(Date);
  });

  it('formats Booleans as empty (rendered as a checkbox) and Dates with locale', () => {
    expect(new Column({ binding: 'b', dataType: 'Boolean' }).format({ b: true })).toBe('');
    const formatted = new Column({ binding: 'd', dataType: 'Date' }).format({
      d: new Date(2024, 2, 15),
    });
    expect(formatted).not.toBe('');
  });

  it('treats a valueGetter column as calculated and read-only', () => {
    const col = new Column<{ a: number; b: number }>({
      header: 'Sum',
      valueGetter: (item) => item.a + item.b,
      editable: true, // ignored for calculated columns
    });
    expect(col.isCalculated).toBe(true);
    expect(col.editable).toBe(false);
    expect(col.getValue({ a: 2, b: 3 })).toBe(5);
    expect(col.binding).toBe('');
  });

  it('maps values to text and back with a dataMap (string list)', () => {
    const col = new Column({ binding: 'status', dataMap: ['Open', 'Closed'] });
    expect(col.format({ status: 'Closed' })).toBe('Closed');
    expect(col.parse('Open')).toBe('Open');
  });

  it('maps value/text pairs with a dataMap', () => {
    const col = new Column({
      binding: 'country',
      dataMap: [
        { value: 'us', text: 'United States' },
        { value: 'uk', text: 'United Kingdom' },
      ],
    });
    expect(col.format({ country: 'uk' })).toBe('United Kingdom');
    expect(col.parse('United States')).toBe('us');
    expect(col.dataMap?.getKeyValues().length).toBe(2);
  });

  it('keeps a cellTemplate reference', () => {
    const col = new Column({ binding: 'sales', cellTemplate: (c) => `<b>${c.value}</b>` });
    expect(col.cellTemplate).toBeTypeOf('function');
  });
});
