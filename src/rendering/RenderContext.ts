import { LayoutEngine } from '../virtualization/LayoutEngine';
import { Column } from '../models/Column';
import { DataView } from '../data/DataView';
import { GridState } from '../core/GridState';

/**
 * Everything a render pass needs, passed in fresh each frame so the renderers
 * never hold a stale reference to the data, columns, or layout.
 */
export interface RenderContext {
  layout: LayoutEngine;
  columns: Column[];
  data: DataView;
  state: GridState;
}
