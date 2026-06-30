import { ODataCollectionView } from './ODataCollectionView';

/**
 * An {@link ODataCollectionView} that loads data incrementally for infinite
 * scrolling. The first load fetches one chunk; {@link loadMore} appends the next
 * chunk until every row has been retrieved.
 */
export class ODataVirtualCollectionView<
  T = Record<string, unknown>,
> extends ODataCollectionView<T> {
  private _allLoaded = false;

  /** True once every server row has been loaded. */
  get allLoaded(): boolean {
    return this._allLoaded;
  }

  // A full load resets to the first chunk (e.g. after sorting changes).
  load(): void {
    if (!this.url) return;
    this._allLoaded = false;
    this.fetchPage(0, this.pageSize)
      .then(({ items, total }) => {
        this._totalItemCount = total;
        this.source = items;
        this.view = items;
        this._position = items.length ? 0 : -1;
        this._allLoaded = items.length >= total;
        this.finishLoad();
      })
      .catch((err) => this.failLoad(err));
  }

  /** Fetch and append the next chunk. No-op while loading or once all loaded. */
  loadMore(): void {
    if (this._isLoading || this._allLoaded || !this.url) return;
    const skip = this.view.length;
    this.fetchPage(skip, this.pageSize)
      .then(({ items, total }) => {
        this._totalItemCount = total;
        const all = this.source.concat(items);
        this.source = all;
        this.view = all;
        this._allLoaded = all.length >= total;
        this.finishLoad();
      })
      .catch((err) => this.failLoad(err));
  }
}
