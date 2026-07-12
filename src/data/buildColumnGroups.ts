import { Column } from '../models/Column';
import {
  ColumnGroup,
  ColumnGroupDef,
  ColumnGroupLeaf,
  ColumnGroupNode,
} from '../models/ColumnGroup';

/**
 * Resolve raw {@link ColumnGroupDef}s (a tree of groups and leaves) against the
 * grid's authored columns. A leaf binding must reference a real column and may
 * belong to only one group; unknown or already-claimed bindings are dropped
 * with a console warning. A group left with no valid leaf descendants is
 * dropped. Returns the top-level groups in def order.
 */
export function buildColumnGroups<T>(columns: Column<T>[], defs: ColumnGroupDef[]): ColumnGroup[] {
  const known = new Set(columns.map((c) => c.binding));
  const claimed = new Set<string>();
  const groups: ColumnGroup[] = [];
  for (const def of defs) {
    const node = resolveNode(def, known, claimed);
    // A bare leaf at the top level isn't a group band; skip it (its column still
    // renders normally). Only groups form header bands.
    if (node && node.kind === 'group') groups.push(node);
  }
  return groups;
}

// Resolve one def node. Returns a leaf, a group, or null when nothing valid
// survives (unknown/claimed leaf, or an empty group).
function resolveNode(
  def: string | ColumnGroupDef,
  known: Set<string>,
  claimed: Set<string>,
): ColumnGroupNode | null {
  if (typeof def === 'string') return resolveLeaf(def, def, known, claimed);

  // Leaf def: has a binding, no children.
  if (def.binding != null && !def.columns) {
    return resolveLeaf(def.binding, def.header ?? def.binding, known, claimed);
  }

  // Group def: resolve children recursively.
  const children: ColumnGroupNode[] = [];
  for (const child of def.columns ?? []) {
    const node = resolveNode(child, known, claimed);
    if (node) children.push(node);
  }
  if (children.length === 0) return null;
  return new ColumnGroup(def, children);
}

function resolveLeaf(
  binding: string,
  label: string,
  known: Set<string>,
  claimed: Set<string>,
): ColumnGroupLeaf | null {
  if (!known.has(binding)) {
    warn(`column group references unknown column "${binding}" (in "${label}"); ignored`);
    return null;
  }
  if (claimed.has(binding)) {
    warn(`column "${binding}" is already claimed by another group; ignored`);
    return null;
  }
  claimed.add(binding);
  return new ColumnGroupLeaf(binding);
}

/** One rendered header cell in the multi-row column-group band. */
export interface ColumnGroupCell {
  /** The group this cell renders, or null when it is a leaf's own header (see `leafCol`). */
  group: ColumnGroup | null;
  /** Visible-column indices the cell spans, inclusive. */
  startCol: number;
  endCol: number;
  /** Header row, 0 = topmost. */
  row: number;
  /** How many header rows the cell spans down (shallow leaves reach the bottom). */
  rowSpan: number;
  /**
   * For a `group: null` cell, the visible-column index whose leaf header this
   * cell carries. Such a cell is a real, full-height column header (text, sort,
   * filter) rendered up here instead of in the leaf-header row below — so a
   * column shallower than the deepest group still shows one tall header. Always
   * equals `startCol` (fillers are one column wide).
   */
  leafCol?: number;
  /** Stable pooling identity. */
  key: string;
}

export interface ColumnGroupLayout {
  /** Number of header rows (max group depth; at least 1 when any group exists). */
  rows: number;
  cells: ColumnGroupCell[];
  /**
   * Visible-column indices whose leaf header is drawn in the group band (as a
   * tall `leafCol` cell) rather than the leaf-header row. The leaf HeaderRenderer
   * skips these so the header isn't drawn twice.
   */
  leafHeaderCols: Set<number>;
}

/**
 * Build the multi-row header layout for the current **visible** columns. Because
 * collapsed groups already dropped their hidden columns upstream, this only ever
 * sees visible columns — a collapsed group shows up as its single `collapseTo`
 * column, whose ancestor chain still names the collapsed group, so its header
 * cell (and chevron) render with no special-casing here.
 *
 * For each header row it emits one cell per maximal run of consecutive columns
 * sharing the same ancestor group at that depth. A column whose group chain is
 * shorter than the total depth gets a single cell that row-spans down to the
 * bottom (top-level leaves like Name/Curr span the whole header height).
 */
export function buildColumnGroupLayout<T>(
  columns: Column<T>[],
  groups: ColumnGroup[],
): ColumnGroupLayout {
  // Map each leaf binding to its ancestor chain (root group → ... → leaf's group).
  const chains = new Map<string, ColumnGroup[]>();
  for (const group of groups) indexChains(group, [], chains);

  const rows = groups.reduce((m, g) => Math.max(m, g.depth()), 0);
  if (rows === 0) return { rows: 0, cells: [], leafHeaderCols: new Set() };

  const cells: ColumnGroupCell[] = [];
  const leafHeaderCols = new Set<number>();
  const colChain = (col: number): ColumnGroup[] => chains.get(columns[col]?.binding ?? '') ?? [];

  for (let row = 0; row < rows; row++) {
    let col = 0;
    while (col < columns.length) {
      const chain = colChain(col);
      const group = chain[row] ?? null;

      if (group) {
        // Extend the run while the same group occupies this row.
        let end = col;
        while (end + 1 < columns.length && colChain(end + 1)[row] === group) end++;
        cells.push({
          group,
          startCol: col,
          endCol: end,
          row,
          rowSpan: 1,
          key: `${group.key}@${row}:${col}`,
        });
        col = end + 1;
      } else {
        // No group at this depth: a leaf shallower than the deepest group (or a
        // fully ungrouped column). Emit ONE full-height cell for it, at the row
        // where its group-chain ends, carrying the leaf's own header. It spans
        // down through the remaining header rows, so the column shows a single
        // tall header instead of a blank gap above the leaf row.
        if (chain.length === row) {
          cells.push({
            group: null,
            startCol: col,
            endCol: col,
            row,
            rowSpan: rows - row,
            leafCol: col,
            key: `leaf@${row}:${col}`,
          });
          leafHeaderCols.add(col);
        }
        col++;
      }
    }
  }
  return { rows, cells, leafHeaderCols };
}

// Record, for each descendant leaf binding, the chain of groups from the root
// group down to (but not including) the leaf.
function indexChains(
  node: ColumnGroupNode,
  ancestors: ColumnGroup[],
  out: Map<string, ColumnGroup[]>,
): void {
  if (node.kind === 'leaf') {
    out.set(node.binding, ancestors);
    return;
  }
  const next = [...ancestors, node];
  for (const child of node.children) indexChains(child, next, out);
}

function warn(message: string): void {
  if (typeof console !== 'undefined') console.warn(`apgrid: ${message}`);
}
