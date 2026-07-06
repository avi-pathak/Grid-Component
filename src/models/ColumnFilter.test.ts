import { describe, it, expect } from 'vitest';
import { Column } from './Column';
import { ColumnFilter, operatorsFor, filterKey } from './ColumnFilter';

interface Row {
  name: string;
  n: number;
  active: boolean;
  [key: string]: unknown;
}

const textCol = new Column<Row>({ binding: 'name' });
const numCol = new Column<Row>({ binding: 'n', dataType: 'Number' });
const boolCol = new Column<Row>({ binding: 'active', dataType: 'Boolean' });

const row = (name: string, n: number, active = false): Row => ({ name, n, active });

describe('ColumnFilter value set', () => {
  it('is inactive with a null value set', () => {
    const f = new ColumnFilter(textCol);
    expect(f.isActive).toBe(false);
    expect(f.test(row('anything', 1))).toBe(true);
  });

  it('keeps only rows whose display value is selected', () => {
    const f = new ColumnFilter(textCol);
    f.values = new Set(['Apple', 'Cherry']);
    expect(f.isActive).toBe(true);
    expect(f.test(row('Apple', 1))).toBe(true);
    expect(f.test(row('Banana', 1))).toBe(false);
    expect(f.test(row('Cherry', 1))).toBe(true);
  });

  it('uses True/False keys for boolean columns', () => {
    expect(filterKey(boolCol, row('', 0, true))).toBe('True');
    expect(filterKey(boolCol, row('', 0, false))).toBe('False');
    const f = new ColumnFilter(boolCol);
    f.values = new Set(['True']);
    expect(f.test(row('', 0, true))).toBe(true);
    expect(f.test(row('', 0, false))).toBe(false);
  });
});

describe('ColumnFilter text conditions', () => {
  const check = (op: Parameters<typeof makeCond>[0], value: string, name: string) => {
    const f = new ColumnFilter(textCol);
    f.condition = makeCond(op, value);
    return f.test(row(name, 0));
  };

  it('handles contains / equals / startsWith / endsWith', () => {
    expect(check('contains', 'pp', 'Apple')).toBe(true);
    expect(check('contains', 'zz', 'Apple')).toBe(false);
    expect(check('equals', 'apple', 'Apple')).toBe(true); // case-insensitive
    expect(check('notEquals', 'apple', 'Banana')).toBe(true);
    expect(check('startsWith', 'ap', 'Apple')).toBe(true);
    expect(check('endsWith', 'le', 'Apple')).toBe(true);
    expect(check('endsWith', 'ba', 'Apple')).toBe(false);
  });

  it('treats an empty condition value as no constraint', () => {
    expect(check('contains', '', 'Apple')).toBe(true);
  });

  it('handles empty / notEmpty', () => {
    expect(check('empty', '', '')).toBe(true);
    expect(check('empty', '', 'x')).toBe(false);
    expect(check('notEmpty', '', 'x')).toBe(true);
  });
});

describe('ColumnFilter number conditions', () => {
  const check = (op: Parameters<typeof makeCond>[0], value: string, n: number) => {
    const f = new ColumnFilter(numCol);
    f.condition = makeCond(op, value);
    return f.test(row('', n));
  };

  it('compares numerically', () => {
    expect(check('gt', '10', 15)).toBe(true);
    expect(check('gt', '10', 5)).toBe(false);
    expect(check('gte', '10', 10)).toBe(true);
    expect(check('lt', '10', 5)).toBe(true);
    expect(check('lte', '10', 10)).toBe(true);
    expect(check('equals', '10', 10)).toBe(true);
    expect(check('notEquals', '10', 11)).toBe(true);
  });
});

describe('operatorsFor', () => {
  it('offers text operators for string columns and comparison operators for numbers', () => {
    expect(operatorsFor(textCol).map((o) => o.op)).toContain('contains');
    expect(operatorsFor(numCol).map((o) => o.op)).toContain('gt');
    expect(operatorsFor(numCol).map((o) => o.op)).not.toContain('contains');
  });
});

function makeCond(op: import('./ColumnFilter').FilterOperator, value: string) {
  return { op, value };
}
