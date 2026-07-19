import { Demo } from './types';
import { virtualization } from './virtualization';
import { collectionViewBasics } from './collectionViewBasics';
import { paging } from './paging';
import { odata } from './odata';
import { infiniteScroll } from './infiniteScroll';
import { selection } from './selection';
import { cellTypes } from './cellTypes';
import { calculated } from './calculated';
import { combo } from './combo';
import { dataMaps } from './dataMaps';
import { dynamicDataMaps } from './dynamicDataMaps';
import { customCell } from './customCell';
import { reorder } from './reorder';
import { editing } from './editing';
import { readOnly } from './readOnly';
import { placeholders } from './placeholders';
import { quickEditing } from './quickEditing';
import { alwaysEditing } from './alwaysEditing';
import { highlightEdits } from './highlightEdits';
import { validation } from './validation';
import { customEditors } from './customEditors';
import { popupEditors } from './popupEditors';
import { clipboard } from './clipboard';
import { changeTracking } from './changeTracking';
import { grouping } from './grouping';
import { filtering } from './filtering';
import { conditionalStyling } from './conditionalStyling';
import { liveData } from './liveData';
import { freeze } from './freeze';
import { columnGroups } from './columnGroups';
import { nestedColumnGroups } from './nestedColumnGroups';
import { merging } from './merging';
import { stateSerialization } from './stateSerialization';
import { exporting } from './exporting';
import { layout } from './layout';

export type { Demo };

export const demos: Demo[] = [
  virtualization,
  collectionViewBasics,
  paging,
  odata,
  infiniteScroll,
  selection,
  cellTypes,
  calculated,
  combo,
  dataMaps,
  dynamicDataMaps,
  customCell,
  reorder,
  editing,
  readOnly,
  placeholders,
  quickEditing,
  alwaysEditing,
  highlightEdits,
  validation,
  customEditors,
  popupEditors,
  clipboard,
  changeTracking,
  grouping,
  filtering,
  conditionalStyling,
  liveData,
  freeze,
  columnGroups,
  nestedColumnGroups,
  merging,
  exporting,
  stateSerialization,
  layout,
];
