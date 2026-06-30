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
import { changeTracking } from './changeTracking';
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
  changeTracking,
  layout,
];
