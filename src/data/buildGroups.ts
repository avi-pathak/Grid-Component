import { PropertyGroupDescription } from '../models/GroupDescription';
import { SortDescription } from '../models/SortDescription';
import { CollectionViewGroup } from './CollectionViewGroup';
import { compareValues } from './compareValues';

export interface GroupResult<T> {
  groups: CollectionViewGroup<T>[];
  /** Leaves reordered so items of the same group are contiguous. */
  leaves: T[];
}

/**
 * Build the group tree for `items` (already filtered and sorted) against the
 * given descriptions. Groups within a level are ordered by their key, honoring
 * the sort direction of any {@link SortDescription} on that level's property
 * (so sorting a grouped column reverses its groups). Leaves keep the incoming
 * order. Returns the tree and the leaves reordered to match, so a caller can use
 * the reordered array as its view.
 */
export function buildGroups<T>(
  items: T[],
  descriptions: PropertyGroupDescription<T>[],
  sorts: SortDescription[] = [],
): GroupResult<T> {
  return groupLevel(items, descriptions, sorts, 0);
}

function groupLevel<T>(
  items: T[],
  descriptions: PropertyGroupDescription<T>[],
  sorts: SortDescription[],
  level: number,
): GroupResult<T> {
  if (level >= descriptions.length) return { groups: [], leaves: items };

  const desc = descriptions[level];
  const buckets = new Map<string, { key: unknown; items: T[] }>();
  for (const item of items) {
    const key = desc.groupKey(item);
    const id = bucketId(key);
    let bucket = buckets.get(id);
    if (!bucket) {
      bucket = { key, items: [] };
      buckets.set(id, bucket);
    }
    bucket.items.push(item);
  }

  const descending = sorts.some((s) => s.property === desc.property && !s.ascending);
  const dir = descending ? -1 : 1;
  const ordered = [...buckets.values()].sort((a, b) => compareValues(a.key, b.key) * dir);
  const groups: CollectionViewGroup<T>[] = [];
  const leaves: T[] = [];
  for (const bucket of ordered) {
    const child = groupLevel(bucket.items, descriptions, sorts, level + 1);
    const group = new CollectionViewGroup<T>(
      groupName(bucket.key),
      bucket.key,
      level,
      child.leaves,
    );
    group.groups.push(...child.groups);
    groups.push(group);
    for (const leaf of child.leaves) leaves.push(leaf);
  }
  return { groups, leaves };
}

// Stable map id for a key. Dates compare by time and the type prefix keeps
// numbers and their string forms in separate buckets.
function bucketId(key: unknown): string {
  if (key == null) return 'n';
  if (key instanceof Date) return `d${key.getTime()}`;
  return `${typeof key}:${String(key)}`;
}

function groupName(key: unknown): string {
  if (key == null) return '(Blanks)';
  if (key instanceof Date) return key.toLocaleDateString();
  return String(key);
}
