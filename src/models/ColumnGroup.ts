/**
 * Declares a node in the column-group header tree. A node is either:
 *  - a **leaf**, referencing a grid column by `binding`, or
 *  - a **group**, with a nested `columns` array of child nodes.
 *
 * A plain string in a group's `columns` is shorthand for `{ binding }`, so the
 * flat form `{ header: 'Perf', columns: ['ytd', 'm1'] }` still means a group of
 * two leaf columns.
 */
export interface ColumnGroupDef {
  header?: string;
  /** Leaf: the column binding this node maps to. Mutually exclusive with `columns`. */
  binding?: string;
  /** Group: child nodes (nested groups and/or leaf bindings), in order. */
  columns?: (string | ColumnGroupDef)[];
  /** Start collapsed (group only). Default false. */
  collapsed?: boolean;
  /** Allow the user to collapse/expand via the chevron (group only). Default true. */
  collapsible?: boolean;
  /**
   * Binding of the one **descendant** leaf column that stays visible when this
   * group is collapsed, carrying the header + chevron. Defaults to the first
   * descendant leaf. `null` hides every column (no in-header expand affordance).
   */
  collapseTo?: string | null;
  /** Stable identity for events/persistence. Defaults to a slug of `header`. */
  key?: string;
}

/** A resolved leaf node: a reference to a grid column by binding. */
export class ColumnGroupLeaf {
  readonly kind = 'leaf';
  constructor(readonly binding: string) {}
}

/** A resolved node in the group tree: either a nested group or a leaf. */
export type ColumnGroupNode = ColumnGroup | ColumnGroupLeaf;

/**
 * A resolved column group: a named header band over a subtree of leaf columns.
 * Groups nest recursively (a group's children may be groups or leaves), giving
 * a multi-row header. Collapsing a group hides all its descendant leaf columns
 * except `collapseTo`, which stays visible carrying the header and its expand
 * chevron — mirroring Wijmo FlexGrid's `collapseTo`.
 */
export class ColumnGroup {
  readonly kind = 'group';
  readonly key: string;
  readonly header: string;
  readonly collapsible: boolean;
  readonly collapseTo: string | null;
  readonly children: ColumnGroupNode[];
  collapsed: boolean;

  constructor(def: ColumnGroupDef, children: ColumnGroupNode[]) {
    this.header = def.header ?? '';
    this.key = def.key ?? slug(this.header);
    this.collapsible = def.collapsible ?? true;
    this.children = children;
    this.collapsed = def.collapsed ?? false;

    const leaves = this.leafBindings();
    if (def.collapseTo === null) {
      this.collapseTo = null;
    } else if (def.collapseTo != null && leaves.includes(def.collapseTo)) {
      this.collapseTo = def.collapseTo;
    } else {
      this.collapseTo = leaves[0] ?? null;
    }
  }

  /** All descendant leaf bindings, depth-first, in order. */
  leafBindings(): string[] {
    const out: string[] = [];
    collectLeaves(this, out);
    return out;
  }

  /** Number of header rows this group's subtree needs (its own row + deepest child). */
  depth(): number {
    let max = 0;
    for (const child of this.children) {
      if (child.kind === 'group') max = Math.max(max, child.depth());
    }
    return max + 1;
  }

  /** This group and every nested group beneath it, depth-first. */
  descendantGroups(): ColumnGroup[] {
    const out: ColumnGroup[] = [this];
    for (const child of this.children) {
      if (child.kind === 'group') out.push(...child.descendantGroups());
    }
    return out;
  }
}

function collectLeaves(node: ColumnGroupNode, out: string[]): void {
  if (node.kind === 'leaf') {
    out.push(node.binding);
    return;
  }
  for (const child of node.children) collectLeaves(child, out);
}

/** Lowercase, hyphenated identifier derived from a group's header text. */
function slug(header: string): string {
  const base = header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'group';
}
