import { Demo } from './types';
import { demos } from './index';

/**
 * The site's information architecture. The demo modules themselves stay
 * category-agnostic — this file is the single place that decides how the 37
 * feature demos are grouped, ordered, and described in the sidebar and on the
 * overview page. Adding a demo to `demos` without listing its id here is caught
 * by `demos.test.ts`.
 */
export interface Category {
  id: string;
  label: string;
  /** One line shown on the overview page's category card. */
  blurb: string;
  /** Key into the icon set in `icons.ts`. */
  icon: string;
  /** Demo ids, in the order they should appear under this category. */
  demoIds: string[];
}

export const categories: Category[] = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    blurb: 'The core rendering engine — virtualization, layout, and the data source.',
    icon: 'play',
    demoIds: ['virtualization', 'layout', 'collectionview-basics'],
  },
  {
    id: 'data-sources',
    label: 'Data Sources',
    blurb: 'Paging, remote OData, endless scrolling, and streaming real-time updates.',
    icon: 'database',
    demoIds: ['paging', 'odata', 'infinite-scroll', 'live-data'],
  },
  {
    id: 'columns',
    label: 'Columns',
    blurb: 'Nested header groups, reordering, frozen panes, merged cells, and formulas.',
    icon: 'columns',
    demoIds: ['columnGroups', 'nestedColumnGroups', 'reorder', 'freeze', 'merging', 'calculated'],
  },
  {
    id: 'cells',
    label: 'Cells & Rendering',
    blurb: 'Data types, custom templates, conditional styling, and value maps.',
    icon: 'grid',
    demoIds: [
      'cell-types',
      'custom-cell',
      'conditional-styling',
      'data-maps',
      'dynamic-data-maps',
      'combo',
    ],
  },
  {
    id: 'selection',
    label: 'Selection & Clipboard',
    blurb: 'Seven selection modes, plus copy and paste against real spreadsheets.',
    icon: 'pointer',
    demoIds: ['selection', 'clipboard'],
  },
  {
    id: 'editing',
    label: 'Editing',
    blurb: 'In-place edits, keyboard flow, read-only columns, placeholders, and IME.',
    icon: 'pencil',
    demoIds: [
      'editing',
      'quick-editing',
      'always-editing',
      'read-only',
      'placeholders',
      'ime',
      'editing-events',
    ],
  },
  {
    id: 'validation',
    label: 'Validation & Editors',
    blurb: 'Cell validation, fully custom editors, popups, and change tracking.',
    icon: 'shield',
    demoIds: [
      'validation',
      'custom-editors',
      'popup-editors',
      'highlight-edits',
      'change-tracking',
    ],
  },
  {
    id: 'shaping',
    label: 'Shaping Data',
    blurb: 'Drag-to-group with aggregates, and multi-column filtering.',
    icon: 'filter',
    demoIds: ['grouping', 'filtering'],
  },
  {
    id: 'output',
    label: 'Export & State',
    blurb: 'Export to CSV, Excel, and PDF; serialize and restore grid state.',
    icon: 'download',
    demoIds: ['export', 'state'],
  },
];

export interface CategorizedDemo {
  demo: Demo;
  category: Category;
}

const byId = new Map(demos.map((d) => [d.id, d]));

/**
 * Demos in catalog order, each paired with its category. This — not the raw
 * `demos` array — is the order the sidebar and the prev/next controls use.
 */
export const catalog: CategorizedDemo[] = categories.flatMap((category) =>
  category.demoIds
    .map((id) => byId.get(id))
    .filter((demo): demo is Demo => demo != null)
    .map((demo) => ({ demo, category })),
);

export const categoryOf = (demoId: string): Category | undefined =>
  catalog.find((entry) => entry.demo.id === demoId)?.category;

/** Demo ids registered in `demos` but missing from every category above. */
export const uncategorizedIds = (): string[] => {
  const listed = new Set(categories.flatMap((c) => c.demoIds));
  return demos.map((d) => d.id).filter((id) => !listed.has(id));
};
