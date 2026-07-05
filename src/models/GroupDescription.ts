/**
 * Describes how a CollectionView groups items on one property. The optional
 * `converter` turns a raw cell value into a group key, so callers can group
 * dates by year or numbers into ranges instead of by exact value.
 */
export class PropertyGroupDescription<T = Record<string, unknown>> {
  constructor(
    public readonly property: string,
    private readonly converter?: (item: T, value: unknown) => unknown,
  ) {}

  /** The key an item belongs under. Items with equal keys share a group. */
  groupKey(item: T): unknown {
    const value = (item as Record<string, unknown>)[this.property];
    return this.converter ? this.converter(item, value) : value;
  }
}
