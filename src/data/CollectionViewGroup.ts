/**
 * A node in the group tree built by a CollectionView. A group either holds child
 * groups (when more than one grouping level is active) or sits at the bottom
 * level over its own leaf items. `items` always holds every leaf beneath the
 * group in view order, so aggregates and counts read straight from it.
 */
export class CollectionViewGroup<T = Record<string, unknown>> {
  readonly groups: CollectionViewGroup<T>[] = [];

  constructor(
    /** Display text for the group key, e.g. the country name. */
    readonly name: string,
    /** Raw group key before formatting. */
    readonly key: unknown,
    readonly level: number,
    /** Every leaf under this group, in view order. */
    readonly items: T[] = [],
  ) {}

  get isBottomLevel(): boolean {
    return this.groups.length === 0;
  }

  get itemCount(): number {
    return this.items.length;
  }
}
