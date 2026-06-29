import { Demo } from './types';
import { virtualization } from './virtualization';
import { selection } from './selection';
import { cellTypes } from './cellTypes';
import { calculated } from './calculated';
import { combo } from './combo';
import { customCell } from './customCell';
import { reorder } from './reorder';
import { editing } from './editing';
import { layout } from './layout';

export type { Demo };

export const demos: Demo[] = [
  virtualization,
  selection,
  cellTypes,
  calculated,
  combo,
  customCell,
  reorder,
  editing,
  layout,
];
