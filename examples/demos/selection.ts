import { Grid, SelectionMode } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

const modes: SelectionMode[] = [
  'None',
  'Cell',
  'CellRange',
  'Row',
  'RowRange',
  'Column',
  'ColumnRange',
];

export const selection: Demo = {
  id: 'selection',
  title: 'Selection modes',
  tagline: 'Seven selection modes. Drag or shift-click to extend a range.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const label = document.createElement('label');
    label.textContent = 'Mode: ';
    const select = document.createElement('select');
    for (const m of modes) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      if (m === 'CellRange') opt.selected = true;
      select.appendChild(opt);
    }
    label.appendChild(select);
    toolbar.appendChild(label);

    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    toolbar.appendChild(readout);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 80, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 140 },
        { binding: 'country', header: 'Country', width: 140 },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number' },
        { binding: 'expenses', header: 'Expenses', width: 120, dataType: 'Number' },
      ],
      itemsSource: makeSales(5000),
      selectionMode: 'CellRange',
    });

    select.addEventListener('change', () => {
      grid.selectionMode = select.value as SelectionMode;
    });

    const showSelection = () => {
      const s = grid.selection;
      readout.textContent = s
        ? `rows ${s.topRow + 1}–${s.bottomRow + 1}, cols ${s.leftCol + 1}–${s.rightCol + 1}`
        : 'nothing selected';
    };
    showSelection();
    const off = grid.on('selectionChanged', showSelection);

    return {
    grid,
    dispose: () => {
      off();
      grid.dispose();
      toolbar.remove();
      gridHost.remove();
    },
  };
  },
};
