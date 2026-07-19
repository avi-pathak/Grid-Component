import { Grid } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

export const alwaysEditing: Demo = {
  id: 'always-editing',
  title: 'Always editing',
  tagline: 'An editor opens automatically at the active cell after every selection move.',
  mount(host) {
    const hint = document.createElement('p');
    hint.className = 'apg-demo-readout';
    hint.style.margin = '0 0 12px';
    hint.textContent =
      'Click any editable cell, or move with the arrow keys — an editor opens right away, ' +
      'no F2/double-click/typing needed. Boolean cells (Active) still just toggle on click, ' +
      'and the ID column stays read-only.';
    host.appendChild(hint);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 150, editable: true },
        { binding: 'country', header: 'Country', width: 140, editable: true },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number', editable: true },
        { binding: 'expenses', header: 'Expenses', width: 120, dataType: 'Number', editable: true },
        { binding: 'active', header: 'Active', width: 90, dataType: 'Boolean', editable: true },
      ],
      itemsSource: makeSales(500),
      alwaysEdit: true,
    });

    return {
      grid,
      dispose: () => {
        grid.dispose();
        hint.remove();
        gridHost.remove();
      },
    };
  },
};
