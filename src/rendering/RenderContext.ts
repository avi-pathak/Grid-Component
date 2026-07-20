import { LayoutEngine } from '../virtualization/LayoutEngine';
import { Column } from '../models/Column';
import { ColumnGroup } from '../models/ColumnGroup';
import { DataView } from '../data/DataView';
import { GridState } from '../core/GridState';
import { GroupHeaderTemplate } from './GroupHeader';
import { RowClass, RowStyle } from '../core/GridOptions';
import { CellRange } from '../models/Cell';

/** Resolved merge lookup: the span a cell belongs to, or null when it stands alone. */
export type MergeLookup = (row: number, col: number) => CellRange | null;

/**
 * Everything a render pass needs, passed in fresh each frame so the renderers
 * never hold a stale reference to the data, columns, or layout.
 */
export interface RenderContext {
  layout: LayoutEngine;
  columns: Column[];
  data: DataView;
  state: GridState;
  /** Optional custom renderer for group-header row labels. */
  groupHeaderTemplate?: GroupHeaderTemplate;
  /** Optional conditional class(es) for data rows. */
  rowClass?: RowClass;
  /** Optional conditional inline styles for data rows. */
  rowStyle?: RowStyle;
  /** Optional cell-merge lookup. Present only when merging is enabled. */
  merge?: MergeLookup;
  /** True when the cell's value differs from its pre-edit snapshot. Present only when highlightEdits is on. */
  isCellEdited?: (row: number, col: number) => boolean;
  /** Show a pencil button in each data row's row-header cell. Consumed by RowHeaderRenderer. */
  popupEditors?: boolean;
  rowNumbers?: boolean;
  /** Active column-header groups. Consumed by the ColumnGroupRenderer. */
  columnGroups?: ColumnGroup[];
}
