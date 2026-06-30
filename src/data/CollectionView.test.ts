import { describe, it, expect } from 'vitest';
import { CollectionView } from './CollectionView';
import { SortDescription } from '../models/SortDescription';

interface Row {
  id: number;
  name: string;
}

function rows(): Row[] {
  return [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
    { id: 3, name: 'c' },
  ];
}

describe('CollectionView', () => {
  it('exposes the source items in view order', () => {
    const cv = new CollectionView(rows());
    expect(cv.items.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(cv.itemCount).toBe(3);
  });

  it('does not track changes by default', () => {
    const cv = new CollectionView(rows());
    const item = cv.items[0];
    cv.editItem(item);
    item.name = 'edited';
    cv.commitEdit();
    expect(cv.itemsEdited).toHaveLength(0);
  });

  it('records edited items when trackChanges is on', () => {
    const cv = new CollectionView(rows(), { trackChanges: true });
    const item = cv.items[1];
    cv.editItem(item);
    item.name = 'edited';
    cv.commitEdit();
    expect(cv.itemsEdited).toEqual([item]);
    // editing the same item again does not duplicate it
    cv.editItem(item);
    item.name = 'again';
    cv.commitEdit();
    expect(cv.itemsEdited).toHaveLength(1);
  });

  it('restores the original values on cancelEdit', () => {
    const cv = new CollectionView(rows());
    const item = cv.items[0];
    cv.editItem(item);
    item.name = 'temp';
    cv.cancelEdit();
    expect(item.name).toBe('a');
  });

  it('tracks added items through addNew/commitNew', () => {
    const cv = new CollectionView(rows(), { trackChanges: true });
    const added = cv.addNew({ id: 4, name: 'd' }, true);
    expect(cv.items).toContain(added);
    expect(cv.itemsAdded).toEqual([added]);
  });

  it('drops a pending add on cancelNew', () => {
    const cv = new CollectionView(rows());
    cv.addNew({ id: 4, name: 'd' });
    expect(cv.itemCount).toBe(4);
    cv.cancelNew();
    expect(cv.itemCount).toBe(3);
    expect(cv.isAddingNew).toBe(false);
  });

  it('tracks removed items', () => {
    const cv = new CollectionView(rows(), { trackChanges: true });
    const victim = cv.items[1];
    cv.remove(victim);
    expect(cv.itemCount).toBe(2);
    expect(cv.itemsRemoved).toEqual([victim]);
  });

  it('cancels out an added item that is then removed', () => {
    const cv = new CollectionView(rows(), { trackChanges: true });
    const added = cv.addNew({ id: 4, name: 'd' }, true);
    cv.remove(added);
    expect(cv.itemsAdded).toHaveLength(0);
    expect(cv.itemsRemoved).toHaveLength(0);
  });

  it('clears all tracked changes', () => {
    const cv = new CollectionView(rows(), { trackChanges: true });
    const item = cv.items[0];
    cv.editItem(item);
    item.name = 'x';
    cv.commitEdit();
    cv.addNew({ id: 4, name: 'd' }, true);
    cv.clearChanges();
    expect(cv.itemsEdited).toHaveLength(0);
    expect(cv.itemsAdded).toHaveLength(0);
    expect(cv.itemsRemoved).toHaveLength(0);
  });

  it('emits collectionChanged on edits, adds, and removes', () => {
    const cv = new CollectionView(rows());
    const actions: string[] = [];
    cv.on('collectionChanged', (e) => actions.push(e.action));
    const item = cv.items[0];
    cv.editItem(item);
    item.name = 'x';
    cv.commitEdit();
    cv.addNew({ id: 4, name: 'd' }, true);
    cv.remove(cv.items[0]);
    expect(actions).toContain('change');
    expect(actions).toContain('add');
    expect(actions).toContain('remove');
  });

  it('moves the current item', () => {
    const cv = new CollectionView(rows());
    cv.moveCurrentToFirst();
    expect(cv.currentItem?.id).toBe(1);
    cv.moveCurrentToNext();
    expect(cv.currentItem?.id).toBe(2);
    cv.moveCurrentToLast();
    expect(cv.currentItem?.id).toBe(3);
  });

  it('swaps the source collection and clears changes', () => {
    const cv = new CollectionView(rows(), { trackChanges: true });
    cv.remove(cv.items[0]);
    cv.sourceCollection = [{ id: 9, name: 'z' }];
    expect(cv.items.map((r) => r.id)).toEqual([9]);
    expect(cv.itemsRemoved).toHaveLength(0);
  });

  it('sorts the view ascending and descending', () => {
    const cv = new CollectionView([
      { id: 2, name: 'b' },
      { id: 1, name: 'a' },
      { id: 3, name: 'c' },
    ]);
    cv.sortDescriptions = [new SortDescription('id', true)];
    expect(cv.items.map((r) => r.id)).toEqual([1, 2, 3]);
    cv.sortDescriptions = [new SortDescription('id', false)];
    expect(cv.items.map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it('does not reorder the source array when sorting', () => {
    const source = [
      { id: 2, name: 'b' },
      { id: 1, name: 'a' },
    ];
    const cv = new CollectionView(source);
    cv.sortDescriptions = [new SortDescription('id', true)];
    expect(source.map((r) => r.id)).toEqual([2, 1]); // source untouched
    expect(cv.items.map((r) => r.id)).toEqual([1, 2]);
  });

  it('filters the view with a predicate', () => {
    const cv = new CollectionView(rows());
    cv.filter = (r) => r.id > 1;
    expect(cv.items.map((r) => r.id)).toEqual([2, 3]);
    cv.filter = null;
    expect(cv.items).toHaveLength(3);
  });

  it('applies the filter then the sort', () => {
    const cv = new CollectionView([
      { id: 1, name: 'c' },
      { id: 2, name: 'a' },
      { id: 3, name: 'b' },
    ]);
    cv.filter = (r) => r.id !== 1;
    cv.sortDescriptions = [new SortDescription('name', true)];
    expect(cv.items.map((r) => r.name)).toEqual(['a', 'b']);
  });

  it('sorts through a sortConverter', () => {
    const cv = new CollectionView([
      { id: 1, code: 'z' },
      { id: 2, code: 'a' },
    ]);
    // Without a converter, sorting by 'code' ascending yields a(2), z(1) -> [2, 1].
    // The converter makes it sort by id instead, proving it is used.
    cv.sortConverter = (_sd, item) => (item as { id: number }).id;
    cv.sortDescriptions = [new SortDescription('code', true)];
    expect(cv.items.map((r) => r.id)).toEqual([1, 2]);
  });

  it('keeps the same item current across a sort', () => {
    const cv = new CollectionView([
      { id: 3, name: 'c' },
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ]);
    cv.moveCurrentTo(cv.items[0]); // id 3
    cv.sortDescriptions = [new SortDescription('id', true)];
    expect(cv.currentItem?.id).toBe(3);
    expect(cv.currentPosition).toBe(2); // now last after sorting 1,2,3
  });

  it('pages the view and reports page metrics', () => {
    const data = Array.from({ length: 23 }, (_, i) => ({ id: i, name: `r${i}` }));
    const cv = new CollectionView(data, { pageSize: 10 });
    expect(cv.pageCount).toBe(3);
    expect(cv.totalItemCount).toBe(23);
    expect(cv.itemCount).toBe(10);
    expect(cv.items.map((r) => r.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('navigates between pages', () => {
    const data = Array.from({ length: 23 }, (_, i) => ({ id: i, name: `r${i}` }));
    const cv = new CollectionView(data, { pageSize: 10 });
    const pages: number[] = [];
    cv.on('pageChanged', () => pages.push(cv.pageIndex));

    expect(cv.moveToNextPage()).toBe(true);
    expect(cv.pageIndex).toBe(1);
    expect(cv.items.map((r) => r.id)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);

    expect(cv.moveToLastPage()).toBe(true);
    expect(cv.pageIndex).toBe(2);
    expect(cv.items.map((r) => r.id)).toEqual([20, 21, 22]); // short last page

    expect(cv.moveToNextPage()).toBe(false); // already last
    expect(cv.moveToFirstPage()).toBe(true);
    expect(cv.pageIndex).toBe(0);
    expect(pages).toEqual([1, 2, 0]);
  });

  it('resets to the first page and re-pages when the page size changes', () => {
    const data = Array.from({ length: 23 }, (_, i) => ({ id: i, name: `r${i}` }));
    const cv = new CollectionView(data, { pageSize: 10 });
    cv.moveToLastPage();
    cv.pageSize = 5;
    expect(cv.pageIndex).toBe(0);
    expect(cv.pageCount).toBe(5);
    expect(cv.itemCount).toBe(5);
  });

  it('applies filter and sort before paging', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ id: i, name: `r${i}` }));
    const cv = new CollectionView(data, { pageSize: 5 });
    cv.filter = (r) => r.id % 2 === 0; // 10 even rows
    cv.sortDescriptions = [new SortDescription('id', false)]; // 18,16,...,0
    expect(cv.totalItemCount).toBe(10);
    expect(cv.pageCount).toBe(2);
    expect(cv.items.map((r) => r.id)).toEqual([18, 16, 14, 12, 10]);
  });
});
