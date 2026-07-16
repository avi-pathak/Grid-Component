import { Grid } from '@avi-pathak/apgrid';
import { Demo } from './types';

interface Fund {
  name: string;
  currency: string;
  'alloc.stock': number;
  'alloc.bond': number;
  'alloc.cash': number;
  'alloc.other': number;
  'alloc.amount': number;
  'perf.ytd': number;
  'perf.m1': number;
  'perf.m6': number;
  'perf.m12': number;
  [key: string]: unknown;
}

const NAMES = [
  'Constant Growth',
  'Optimus Prime',
  'Crypto Planet',
  'MegaZone',
  'Serenity',
  'Blue Horizon',
  'Iron Vault',
  'Summit Peak',
];
const CURRENCIES = ['USD', 'EUR', 'BTC', 'YEN', 'GBP'];

// Deterministic pseudo-random so the demo is stable across reloads (no Date/random
// dependency in the grid itself; this is just demo data).
function makeFunds(count: number): Fund[] {
  let seed = 12345;
  const rnd = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const funds: Fund[] = [];
  for (let i = 0; i < count; i++) {
    const stock = rnd();
    const bond = rnd();
    const cash = rnd();
    const other = rnd();
    funds.push({
      name: `${NAMES[i % NAMES.length]} ${Math.floor(i / NAMES.length) || ''}`.trim(),
      currency: CURRENCIES[i % CURRENCIES.length],
      'alloc.stock': stock,
      'alloc.bond': bond,
      'alloc.cash': cash,
      'alloc.other': other,
      'alloc.amount': Math.round(2000 + rnd() * 80000),
      'perf.ytd': rnd() * 0.08,
      'perf.m1': rnd() * 0.05,
      'perf.m6': rnd() * 0.06,
      'perf.m12': rnd() * 0.09,
    });
  }
  return funds;
}

const pct = (v: unknown): string => `${Math.round((v as number) * 100)}%`;
const pct2 = (v: unknown): string => `${((v as number) * 100).toFixed(2)}%`;
const money = (v: unknown): string => `$${(v as number).toLocaleString('en-US')}`;

// Red for weak allocations, green for strong — mirrors the Wijmo demo's cell template.
const allocClass = (ctx: { value: unknown }): string =>
  (ctx.value as number) > 0.2 ? 'big-val' : 'small-val';

export const nestedColumnGroups: Demo = {
  id: 'nestedColumnGroups',
  title: 'Nested column groups',
  tagline:
    'Groups within groups build a multi-row header. Allocation nests a Detail subgroup; Perf nests Short and Long. Click any group header to collapse it — a representative column (its collapseTo) stays visible so you can expand it again.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const collapseBtn = button('Collapse all');
    const expandBtn = button('Expand all');
    const animToggle = checkbox('Collapse/Expand animation', true);
    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    toolbar.append(collapseBtn, expandBtn, animToggle.label, readout);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const columns = [
      { binding: 'name', header: 'Name', width: 150 },
      { binding: 'currency', header: 'Curr', width: 80, align: 'center' as const },
      {
        binding: 'alloc.stock',
        header: 'Stocks',
        width: 90,
        align: 'right' as const,
        valueFormatter: pct,
        cellClass: allocClass,
      },
      {
        binding: 'alloc.bond',
        header: 'Bonds',
        width: 90,
        align: 'right' as const,
        valueFormatter: pct,
        cellClass: allocClass,
      },
      {
        binding: 'alloc.cash',
        header: 'Cash',
        width: 90,
        align: 'right' as const,
        valueFormatter: pct,
        cellClass: allocClass,
      },
      {
        binding: 'alloc.other',
        header: 'Other',
        width: 90,
        align: 'right' as const,
        valueFormatter: pct,
        cellClass: allocClass,
      },
      {
        binding: 'alloc.amount',
        header: 'Amount',
        width: 110,
        align: 'right' as const,
        valueFormatter: money,
      },
      {
        binding: 'perf.ytd',
        header: 'YTD',
        width: 100,
        align: 'right' as const,
        valueFormatter: pct2,
      },
      {
        binding: 'perf.m1',
        header: '1 M',
        width: 90,
        align: 'right' as const,
        valueFormatter: pct2,
      },
      {
        binding: 'perf.m6',
        header: '6 M',
        width: 90,
        align: 'right' as const,
        valueFormatter: pct2,
      },
      {
        binding: 'perf.m12',
        header: '12 M',
        width: 100,
        align: 'right' as const,
        valueFormatter: pct2,
      },
    ];

    const grid = new Grid(gridHost, {
      columns,
      itemsSource: makeFunds(500),
      headerHeight: 30,
      groupHeaderRowHeight: 30,
      columnGroupAnimation: true,
      // Allocation → [Stocks, Bonds, Detail → [Cash, Other], Amount]
      // Perf → [Short → [YTD, 1M], Long → [6M, 12M]]  (both start collapsed)
      columnGroups: [
        {
          header: 'Allocation',
          collapseTo: 'alloc.amount',
          columns: [
            'alloc.stock',
            'alloc.bond',
            { header: 'Detail', columns: ['alloc.cash', 'alloc.other'] },
            'alloc.amount',
          ],
        },
        {
          header: 'Perf',
          columns: [
            {
              header: 'Short',
              collapseTo: 'perf.ytd',
              collapsed: true,
              columns: ['perf.ytd', 'perf.m1'],
            },
            {
              header: 'Long',
              collapseTo: 'perf.m12',
              collapsed: true,
              columns: ['perf.m6', 'perf.m12'],
            },
          ],
        },
      ],
    });

    const status = (): void => {
      const collapsed = grid.columnGroups
        .flatMap((g) => g.descendantGroups())
        .filter((g) => g.collapsed)
        .map((g) => g.header);
      readout.textContent = collapsed.length
        ? `Collapsed: ${collapsed.join(', ')}`
        : 'All groups expanded';
    };
    status();
    grid.on('columnGroupCollapsedChanged', status);

    collapseBtn.addEventListener('click', () => grid.collapseAllColumnGroups());
    expandBtn.addEventListener('click', () => grid.expandAllColumnGroups());
    animToggle.input.addEventListener('change', () => {
      grid.columnGroupAnimation = animToggle.input.checked;
    });

    return {
      grid,
      dispose: () => {
        grid.dispose();
        toolbar.remove();
        gridHost.remove();
      },
    };
  },
};

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'apg-demo-btn';
  b.textContent = text;
  return b;
}

function checkbox(
  text: string,
  checked: boolean,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement('label');
  label.className = 'apg-demo-field';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  label.append(input, document.createTextNode(` ${text}`));
  return { label, input };
}
