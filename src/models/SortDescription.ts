/** Describes how a CollectionView sorts on one property. */
export class SortDescription {
  constructor(
    public readonly property: string,
    public readonly ascending = true,
  ) {}
}
