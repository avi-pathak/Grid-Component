import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

const countries = 'US,Germany,UK,Japan,Italy,Greece,France,Spain,Brazil,India'.split(',');

export const combo: Demo = {
  id: 'combo',
  title: 'ComboBox cells',
  tagline: 'A column with a dataMap edits through a dropdown.',
  mount(host) {
    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const data = makeSales(2000).map((r) => ({ ...r, status: r.id % 2 ? 'active' : 'paused' }));

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 130 },
        { binding: 'country', header: 'Country', width: 150, editable: true, dataMap: countries },
        {
          binding: 'status',
          header: 'Status',
          width: 130,
          editable: true,
          dataMap: [
            { value: 'active', text: '● Active' },
            { value: 'paused', text: '⏸ Paused' },
            { value: 'closed', text: '✕ Closed' },
          ],
        },
        { binding: 'sales', header: 'Sales', width: 110, dataType: 'Number' },
      ],
      itemsSource: data,
    });

    return {
    grid,
    dispose: () => {
      grid.dispose();
      gridHost.remove();
    },
  };
  },
};
