import './styles/apgrid.scss';

import * as controls from './controls';

/** Namespace holding the grid control and its data-mapping helpers (ap.controls.*). */
export { controls };

// Core data
export { CollectionView } from './data/CollectionView';
export { ODataCollectionView } from './data/ODataCollectionView';
export { ODataVirtualCollectionView } from './data/ODataVirtualCollectionView';
export { SortDescription } from './models/SortDescription';

// Grid module, also reachable through `controls`
export { Grid } from './core/Grid';
export { Grid as ApGrid } from './core/Grid';
export { Column } from './models/Column';
export { ColumnGroup, ColumnGroupLeaf } from './models/ColumnGroup';
export { DataMap } from './models/DataMap';
export { DataMapEditor } from './models/DataMapEditor';
export { PropertyGroupDescription } from './models/GroupDescription';
export { CollectionViewGroup } from './data/CollectionViewGroup';
export { ColumnFilter } from './models/ColumnFilter';
export { icons, iconEl } from './utils/icons';

// Export module
export { ExportManager } from './export/ExportManager';
export { ExportRegistry } from './export/registry';
export { csvFormat } from './export/formats/csv';
export { xlsxFormat } from './export/formats/xlsx';
export { pdfFormat } from './export/formats/pdf';

// Value formatting (Excel-style patterns + short codes), also used by ColumnDef.format.
export { format, formatNumber, formatDate, formatDatePreset } from './formatting';
export type { FormatOptions } from './formatting';

export type { ColumnDef } from './models/Column';
export type { ColumnGroupDef } from './models/ColumnGroup';
export type { ColumnGroupNode } from './models/ColumnGroup';
export type {
  DataType,
  CellAlign,
  DataMapEntry,
  CellTemplateContext,
  AggregateType,
  CellStyle,
  CellClassFn,
  CellStyleFn,
  CellClassRules,
} from './models/Column';
export type { GroupHeaderContext, GroupHeaderTemplate } from './rendering/GroupHeader';
export type { GroupPanelOptions } from './rendering/GroupPanel';
export type { FilterOperator, FilterCondition, OperatorChoice } from './models/ColumnFilter';
export type { IconName } from './utils/icons';
export type {
  GridOptions,
  HeadersVisibility,
  RowStyleContext,
  RowClass,
  RowStyle,
} from './core/GridOptions';
export type { CellAddress, CellRange } from './models/Cell';
export { makeRange } from './models/Cell';
export type { MergeQuery, MergeManager } from './models/MergeManager';
export { contentMerge } from './models/MergeManager';
export type {
  GridStateSnapshot,
  ColumnStateSnapshot,
  FilterStateSnapshot,
  ColumnGroupStateSnapshot,
} from './models/GridStateSnapshot';
export type { SelectionMode } from './selection/SelectionModel';
export type { GridEvents } from './events/GridEvents';
export type { UndoableAction } from './commands/UndoableAction';
export type { CellEditor } from './editing/CellEditor';
export type { EditorOpenOptions } from './editing/EditorOpenOptions';
export type { CollectionViewOptions, CollectionChange, ChangeAction } from './data/CollectionView';
export type { ODataOptions } from './data/ODataCollectionView';
export type {
  ExportOptions,
  ExportFormat,
  ExportData,
  ExportColumn,
  ExportRow,
  ExportCell,
  ExportCellStyle,
  ExportMerge,
  ExportCellContext,
  ExportHeaderContext,
  CellCallback,
  HeaderCallback,
  ExportProgress,
  CsvOptions,
  PdfOptions,
} from './export/types';
export type { ExportResult, ExportDeps } from './export/ExportManager';

export const VERSION = '0.1.0';
