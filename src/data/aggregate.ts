import { AggregateType } from '../models/Column';

/**
 * Reduce a set of item values to a single aggregate. `count` returns the item
 * count; the numeric aggregates read each value through `getValue`, skip
 * null/non-numeric entries, and return null when nothing numeric is present.
 */
export function computeAggregate<T>(
  items: T[],
  type: AggregateType,
  getValue: (item: T) => unknown,
): number | null {
  if (type === 'count') return items.length;

  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const item of items) {
    const raw = getValue(item);
    if (raw == null || raw === '') continue; // Number(null)/Number('') are 0, so skip first
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    sum += n;
    count++;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  if (count === 0) return null;

  switch (type) {
    case 'sum':
      return sum;
    case 'avg':
      return sum / count;
    case 'min':
      return min;
    case 'max':
      return max;
  }
}
