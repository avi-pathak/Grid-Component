import { Demo } from './types';
import { virtualization } from './virtualization';
import { selection } from './selection';
import { cellTypes } from './cellTypes';
import { editing } from './editing';
import { layout } from './layout';

export type { Demo };

export const demos: Demo[] = [virtualization, selection, cellTypes, editing, layout];
