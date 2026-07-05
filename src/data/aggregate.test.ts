import { describe, it, expect } from 'vitest';
import { computeAggregate } from './aggregate';

describe('computeAggregate', () => {
  const items = [{ n: 10 }, { n: 20 }, { n: 30 }, { n: null }];
  const get = (it: { n: number | null }): unknown => it.n;

  it('sums numeric values, skipping non-numbers', () => {
    expect(computeAggregate(items, 'sum', get)).toBe(60);
  });

  it('averages numeric values', () => {
    expect(computeAggregate(items, 'avg', get)).toBe(20);
  });

  it('finds min and max', () => {
    expect(computeAggregate(items, 'min', get)).toBe(10);
    expect(computeAggregate(items, 'max', get)).toBe(30);
  });

  it('counts every item regardless of value', () => {
    expect(computeAggregate(items, 'count', get)).toBe(4);
  });

  it('returns null when nothing is numeric', () => {
    expect(computeAggregate([{ n: null }], 'sum', get)).toBeNull();
  });
});
