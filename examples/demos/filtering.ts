import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

const money = (v: unknown): string => (v == null ? '' : `$${Number(v).toLocaleString()}`);

export const filtering: Demo = {
  id: 'filtering',
  title: 'Filtering',
  tagline: 'Click the funnel in a column header to filter by value or condition.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'apg-demo-btn';
    clearBtn.textContent = 'Clear filters';
    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    toolbar.append(clearBtn, readout);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      allowFiltering: true,
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number', filter: false },
        { binding: 'product', header: 'Product', width: 130 },
        { binding: 'country', header: 'Country', width: 130 },
        {
          binding: 'sales',
          header: 'Sales',
          width: 120,
          dataType: 'Number',
          valueFormatter: money,
        },
        {
          binding: 'expenses',
          header: 'Expenses',
          width: 120,
          dataType: 'Number',
          valueFormatter: money,
        },
        { binding: 'active', header: 'Active', width: 80, dataType: 'Boolean' },
        { binding: 'joined', header: 'Joined', width: 120, dataType: 'Date' },
      ],
      itemsSource: makeSales(500),
    });

    const cv = grid.collectionView;
    const update = (): void => {
      readout.textContent = `${cv.itemCount} of ${cv.sourceCollection.length} rows`;
    };
    const off = grid.on('filterChanged', update);
    update();

    clearBtn.addEventListener('click', () => grid.clearFilters());

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
