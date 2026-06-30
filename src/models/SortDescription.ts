/** Describes how a CollectionView sorts on one property. Mirrors Wijmo's SortDescription. */
export class SortDescription {
  constructor(
    public readonly property: string,
    public readonly ascending = true,
  ) {}
}
