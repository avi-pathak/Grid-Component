import alwaysEditing from './alwaysEditing.ts?raw';
import calculated from './calculated.ts?raw';
import cellTypes from './cellTypes.ts?raw';
import changeTracking from './changeTracking.ts?raw';
import clipboard from './clipboard.ts?raw';
import collectionViewBasics from './collectionViewBasics.ts?raw';
import columnGroups from './columnGroups.ts?raw';
import combo from './combo.ts?raw';
import conditionalStyling from './conditionalStyling.ts?raw';
import customCell from './customCell.ts?raw';
import customEditors from './customEditors.ts?raw';
import dataMaps from './dataMaps.ts?raw';
import dynamicDataMaps from './dynamicDataMaps.ts?raw';
import editing from './editing.ts?raw';
import editingEvents from './editingEvents.ts?raw';
import exporting from './exporting.ts?raw';
import filtering from './filtering.ts?raw';
import freeze from './freeze.ts?raw';
import grouping from './grouping.ts?raw';
import highlightEdits from './highlightEdits.ts?raw';
import ime from './ime.ts?raw';
import infiniteScroll from './infiniteScroll.ts?raw';
import layout from './layout.ts?raw';
import liveData from './liveData.ts?raw';
import merging from './merging.ts?raw';
import nestedColumnGroups from './nestedColumnGroups.ts?raw';
import odata from './odata.ts?raw';
import paging from './paging.ts?raw';
import placeholders from './placeholders.ts?raw';
import popupEditors from './popupEditors.ts?raw';
import quickEditing from './quickEditing.ts?raw';
import readOnly from './readOnly.ts?raw';
import reorder from './reorder.ts?raw';
import selection from './selection.ts?raw';
import stateSerialization from './stateSerialization.ts?raw';
import validation from './validation.ts?raw';
import virtualization from './virtualization.ts?raw';

import dataSource from '../data.ts?raw';
import typesSource from './types.ts?raw';
import demoCssSource from '../demo.css?raw';

/**
 * The verbatim source of every demo, keyed by `Demo.id`, inlined at build time
 * by the bundler's `?raw` rule. The Code tab renders these, and the StackBlitz
 * launcher ships them as real project files — so what a reader sees is exactly
 * what runs, with no separately maintained snippet to drift out of date.
 */
export const demoSources: Record<string, string> = {
  'always-editing': alwaysEditing,
  calculated,
  'cell-types': cellTypes,
  'change-tracking': changeTracking,
  clipboard,
  'collectionview-basics': collectionViewBasics,
  columnGroups,
  combo,
  'conditional-styling': conditionalStyling,
  'custom-cell': customCell,
  'custom-editors': customEditors,
  'data-maps': dataMaps,
  'dynamic-data-maps': dynamicDataMaps,
  editing,
  'editing-events': editingEvents,
  export: exporting,
  filtering,
  freeze,
  grouping,
  'highlight-edits': highlightEdits,
  ime,
  'infinite-scroll': infiniteScroll,
  layout,
  'live-data': liveData,
  merging,
  nestedColumnGroups,
  odata,
  paging,
  placeholders,
  'popup-editors': popupEditors,
  'quick-editing': quickEditing,
  'read-only': readOnly,
  reorder,
  selection,
  state: stateSerialization,
  validation,
  virtualization,
};

/**
 * The two modules every demo imports (`../data` and `./types`) plus the shared
 * demo stylesheet. The sandbox needs these alongside the demo file itself.
 */
export const sharedSources = {
  data: dataSource,
  types: typesSource,
  css: demoCssSource,
};

/**
 * The name a demo module exports, read back out of its own source. Every demo
 * file is named after its exported const, so this doubles as the file name —
 * which saves keeping a second id-to-filename table in sync with this one.
 */
export const exportNameOf = (source: string): string =>
  /export const (\w+)\s*:\s*Demo\b/.exec(source)?.[1] ?? 'demo';

export const fileNameOf = (source: string): string => `${exportNameOf(source)}.ts`;
