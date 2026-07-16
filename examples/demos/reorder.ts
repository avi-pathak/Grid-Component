import { Grid } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

export const reorder: Demo = {
  id: 'reorder',
  title: 'Column reordering',
  tagline: 'Drag a column header to move it. Drag the right edge to resize. Ctrl+Z to undo.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    readout.textContent = 'Drag any header to reorder';
    toolbar.appendChild(readout);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 140 },
        { binding: 'country', header: 'Country', width: 140 },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number' },
        { binding: 'expenses', header: 'Expenses', width: 120, dataType: 'Number' },
        { binding: 'active', header: 'Active', width: 90, dataType: 'Boolean' },
      ],
      itemsSource: makeSales(2000),
      allowColumnReorder: true,
    });

    const off = grid.on('columnReordered', ({ from, to }) => {
      readout.textContent = `Moved column ${from} → ${to}`;
    });

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
