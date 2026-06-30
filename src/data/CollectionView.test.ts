import { describe, it, expect } from 'vitest';
import { CollectionView } from './CollectionView';

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
});
