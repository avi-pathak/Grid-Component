import { Grid } from '../../src';
import { makeSales, SalesRow } from '../data';
import { Demo } from './types';

export const collectionViewBasics: Demo = {
  id: 'collectionview-basics',
  title: 'Basics (CollectionView)',
  tagline: 'Bind to an array, click headers to sort, filter, and track the current item.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const label = document.createElement('label');
    label.textContent = 'Filter country';
    const filter = document.createElement('input');
    filter.type = 'search';
    filter.placeholder = 'e.g. US';
    label.appendChild(filter);
    const current = document.createElement('span');
    current.className = 'apg-demo-readout';
    toolbar.append(label, current);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 130 },
        { binding: 'country', header: 'Country', width: 130 },
        { binding: 'sales', header: 'Sales', width: 110, dataType: 'Number', editable: true },
        { binding: 'expenses', header: 'Expenses', width: 110, dataType: 'Number', editable: true },
        { binding: 'joined', header: 'Joined', width: 120, dataType: 'Date' },
      ],
      itemsSource: makeSales(1000),
    });

    const cv = grid.collectionView;
    const showCurrent = () => {
      const row = cv.currentItem as SalesRow | null;
      current.textContent = row
        ? `Current: ${row.country} — sales $${row.sales.toLocaleString()}, expenses $${row.expenses.toLocaleString()} · ${cv.itemCount} rows in view`
        : `${cv.itemCount} rows in view`;
    };
    const offCurrent = cv.on('currentChanged', showCurrent);
    const offChanged = cv.on('collectionChanged', showCurrent);
    grid.select(0, 0);
    showCurrent();

    filter.addEventListener('input', () => {
      const q = filter.value.trim().toLowerCase();
      cv.filter = q
        ? (item) =>
            String((item as SalesRow).country)
              .toLowerCase()
              .includes(q)
        : null;
    });

    return () => {
      offCurrent();
      offChanged();
      grid.dispose();
      toolbar.remove();
      gridHost.remove();
    };
  },
};
