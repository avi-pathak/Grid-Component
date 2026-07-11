import { Grid, MergeManager } from '../../src';
import { makeRange } from '../../src/models/Cell';
import { Demo } from './types';

interface Row {
  country: string;
  rep: string;
  product: string;
  sales: number;
  expenses: number;
  [key: string]: unknown;
}

const countries = ['Italy', 'UK', 'US', 'Germany', 'Greece'];
const reps = ['Paul Smith', 'Susan Johnson', 'Chris Evans'];
const products = ['Widget', 'Gadget', 'Gizmo', 'Sprocket'];

// Rows grouped by country then rep, so equal values sit next to each other.
function buildRows(): Row[] {
  const out: Row[] = [];
  for (const country of countries) {
    for (const rep of reps) {
      const n = 2 + ((Math.random() * 2) | 0);
      for (let i = 0; i < n; i++) {
        out.push({
          country,
          rep,
          product: products[(Math.random() * products.length) | 0],
          sales: Math.round(1000 + Math.random() * 18000),
          expenses: Math.round(500 + Math.random() * 4500),
        });
      }
    }
  }
  return out;
}

// Only merge a column vertically when the cell to its left also matches, so the
// merge respects the outer grouping instead of joining unrelated runs.
const restrictedMerge: MergeManager = (q) => {
  if (!q.mergeableCol(q.col)) return null;
  const v = q.value(q.row, q.col);
  if (v == null || v === '') return null;
  const leftMatches = (r: number): boolean =>
    q.col === 0 || q.value(r, q.col - 1) === q.value(q.row, q.col - 1);

  let top = q.row;
  let bottom = q.row;
  while (top - 1 >= 0 && q.value(top - 1, q.col) === v && leftMatches(top - 1)) top--;
  while (bottom + 1 < q.rowCount && q.value(bottom + 1, q.col) === v && leftMatches(bottom + 1)) {
    bottom++;
  }
  return top === bottom ? null : makeRange(top, q.col, bottom, q.col);
};

// Merge every pair of data rows in the numeric columns, ignoring content.
const customMerge: MergeManager = (q) => {
  if (q.col < 3) return null;
  const top = q.row - (q.row % 2);
  const bottom = Math.min(top + 1, q.rowCount - 1);
  return top === bottom ? null : makeRange(top, q.col, bottom, q.col);
};

type Mode = 'content' | 'restricted' | 'custom';

export const merging: Demo = {
  id: 'merging',
  title: 'Cell merging',
  tagline:
    'Merge adjacent cells that share a value, restrict merges to a parent group, or supply a custom rule.',
  mount(host) {
    const data = buildRows();
    const columns = [
      { binding: 'country', header: 'Country', width: 130, allowMerging: true },
      { binding: 'rep', header: 'Sales Rep', width: 150, allowMerging: true },
      { binding: 'product', header: 'Product', width: 130 },
      { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number' as const },
      { binding: 'expenses', header: 'Expenses', width: 120, dataType: 'Number' as const },
    ];

    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const label = document.createElement('label');
    label.textContent = 'Merge mode: ';
    const select = document.createElement('select');
    for (const [value, text] of [
      ['content', 'Content (Country + Rep)'],
      ['restricted', 'Restricted (Rep within Country)'],
      ['custom', 'Custom (pair numeric rows)'],
    ] as [Mode, string][]) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = text;
      select.appendChild(opt);
    }
    label.appendChild(select);
    toolbar.appendChild(label);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const build = (mode: Mode): Grid =>
      new Grid(gridHost, {
        columns,
        itemsSource: data,
        mergeManager:
          mode === 'restricted' ? restrictedMerge : mode === 'custom' ? customMerge : undefined,
      });

    let grid = build('content');
    select.addEventListener('change', () => {
      grid.dispose();
      grid = build(select.value as Mode);
    });

    return () => {
      grid.dispose();
      toolbar.remove();
      gridHost.remove();
    };
  },
};
