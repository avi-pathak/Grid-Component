import './styles/grid.css';

import * as controls from './controls';

/** Namespace holding the grid control and its data-mapping helpers (ap.controls.*). */
export { controls };

// Core data
export { CollectionView } from './data/CollectionView';

// Grid module, also reachable through `controls`
export { Grid } from './core/Grid';
export { Grid as ApGrid } from './core/Grid';
export { Column } from './models/Column';
export { DataMap } from './models/DataMap';
export { DataMapEditor } from './models/DataMapEditor';

export type { ColumnDef } from './models/Column';
export type { DataType, CellAlign, DataMapEntry, CellTemplateContext } from './models/Column';
export type { GridOptions, HeadersVisibility } from './core/GridOptions';
export type { CellAddress, CellRange } from './models/Cell';
export type { SelectionMode } from './selection/SelectionModel';
export type { GridEvents } from './events/GridEvents';
export type { UndoableAction } from './commands/UndoableAction';
export type { CollectionViewOptions, CollectionChange, ChangeAction } from './data/CollectionView';

export const VERSION = '0.1.0';
