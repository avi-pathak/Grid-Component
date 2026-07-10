import { describe, it, expect } from 'vitest';
import { Column } from './Column';

interface Row {
  n: number;
  name: string;
  [key: string]: unknown;
}

const row = (n: number, name = 'x'): Row => ({ n, name });

describe('Column.cellClasses', () => {
  it('returns nothing when no class options are set', () => {
    const col = new Column<Row>({ binding: 'n' });
    expect(col.cellClasses(row(1), 0)).toEqual([]);
  });

  it('applies a static string or array of classes', () => {
    expect(new Column<Row>({ binding: 'n', cellClass: 'a b' }).cellClasses(row(1), 0)).toEqual([
      'a',
      'b',
    ]);
    expect(new Column<Row>({ binding: 'n', cellClass: ['a', 'b'] }).cellClasses(row(1), 0)).toEqual(
      ['a', 'b'],
    );
  });

  it('applies a class from a function using the value', () => {
    const col = new Column<Row>({
      binding: 'n',
      cellClass: ({ value }) => (Number(value) < 0 ? 'neg' : 'pos'),
    });
    expect(col.cellClasses(row(-5), 0)).toEqual(['neg']);
    expect(col.cellClasses(row(5), 0)).toEqual(['pos']);
  });

  it('evaluates cellClassRules predicates', () => {
    const col = new Column<Row>({
      binding: 'n',
      cellClassRules: {
        high: ({ value }) => Number(value) >= 100,
        low: ({ value }) => Number(value) < 10,
      },
    });
    expect(col.cellClasses(row(150), 0)).toEqual(['high']);
    expect(col.cellClasses(row(5), 0)).toEqual(['low']);
    expect(col.cellClasses(row(50), 0)).toEqual([]);
  });

  it('combines cellClass and cellClassRules', () => {
    const col = new Column<Row>({
      binding: 'n',
      cellClass: 'base',
      cellClassRules: { hot: ({ value }) => Number(value) > 0 },
    });
    expect(col.cellClasses(row(1), 0)).toEqual(['base', 'hot']);
  });
});

describe('Column.cellInlineStyle', () => {
  it('returns null when unset', () => {
    expect(new Column<Row>({ binding: 'n' }).cellInlineStyle(row(1), 0)).toBeNull();
  });

  it('returns a static style object', () => {
    const style = { color: 'red' };
    expect(new Column<Row>({ binding: 'n', cellStyle: style }).cellInlineStyle(row(1), 0)).toEqual(
      style,
    );
  });

  it('returns a style from a function using the value', () => {
    const col = new Column<Row>({
      binding: 'n',
      cellStyle: ({ value }) => (Number(value) > 10 ? { backgroundColor: 'green' } : null),
    });
    expect(col.cellInlineStyle(row(20), 0)).toEqual({ backgroundColor: 'green' });
    expect(col.cellInlineStyle(row(5), 0)).toBeNull();
  });
});
