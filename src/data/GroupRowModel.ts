import { CollectionViewGroup } from './CollectionViewGroup';

export interface GroupDisplayRow<T> {
  kind: 'group';
  group: CollectionViewGroup<T>;
  level: number;
  /** Stable identity across rebuilds, used to remember collapse state. */
  pathKey: string;
  collapsed: boolean;
}

export interface DataDisplayRow {
  kind: 'data';
  /** Index into the collection view's leaf array. */
  viewIndex: number;
}

export type DisplayRow<T> = GroupDisplayRow<T> | DataDisplayRow;

/**
 * Flattens a collection view's group tree into the linear list of rows the grid
 * actually renders: a header row per group followed by its data rows, with the
 * subtree omitted when a group is collapsed. Collapse state is keyed by group
 * path so it survives rebuilds (re-sort, filter, regroup).
 */
export class GroupRowModel<T = Record<string, unknown>> {
  private rows: DisplayRow<T>[] = [];
  private collapsed = new Set<string>();
  private allKeys = new Set<string>();

  get length(): number {
    return this.rows.length;
  }

  get active(): boolean {
    return this.rows.length > 0;
  }

  rebuild(groups: CollectionViewGroup<T>[]): void {
    this.rows = [];
    this.allKeys = new Set();
    if (groups.length === 0) return;
    let cursor = 0;
    const walk = (group: CollectionViewGroup<T>, parentPath: string): void => {
      const pathKey = `${parentPath}\u0000${group.name}`;
      this.allKeys.add(pathKey);
      const collapsed = this.collapsed.has(pathKey);
      this.rows.push({ kind: 'group', group, level: group.level, pathKey, collapsed });
      if (collapsed) {
        cursor += group.items.length; // leaves stay in the view; skip past them
        return;
      }
      if (group.isBottomLevel) {
        for (let i = 0; i < group.items.length; i++) {
          this.rows.push({ kind: 'data', viewIndex: cursor++ });
        }
      } else {
        for (const child of group.groups) walk(child, pathKey);
      }
    };
    for (const group of groups) walk(group, '');
  }

  rowAt(index: number): DisplayRow<T> | undefined {
    return this.rows[index];
  }

  isCollapsed(pathKey: string): boolean {
    return this.collapsed.has(pathKey);
  }

  toggle(pathKey: string): void {
    if (this.collapsed.has(pathKey)) this.collapsed.delete(pathKey);
    else this.collapsed.add(pathKey);
  }

  collapseAll(): void {
    this.collapsed = new Set(this.allKeys);
  }

  expandAll(): void {
    this.collapsed.clear();
  }

  /** The path keys of every collapsed group, for saving state. */
  collapsedKeys(): string[] {
    return [...this.collapsed];
  }

  /** Replace the collapsed set (used when restoring saved state). */
  setCollapsed(keys: string[]): void {
    this.collapsed = new Set(keys);
  }
}
