import { Grid, HeadersVisibility } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

const options: HeadersVisibility[] = ['All', 'Column', 'Row', 'None'];

export const layout: Demo = {
  id: 'layout',
  title: 'Headers & layout',
  tagline: 'Toggle row and column headers via the headersVisibility option.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const label = document.createElement('label');
    label.textContent = 'Headers: ';
    const select = document.createElement('select');
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o;
      opt.textContent = o;
      select.appendChild(opt);
    }
    label.appendChild(select);
    toolbar.appendChild(label);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const data = makeSales(2000);
    const columns = [
      { binding: 'id', header: 'ID', width: 80, dataType: 'Number' as const },
      { binding: 'product', header: 'Product', width: 150 },
      { binding: 'country', header: 'Country', width: 150 },
      { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number' as const },
    ];

    let grid = new Grid(gridHost, { columns, itemsSource: data, headersVisibility: 'All' });

    select.addEventListener('change', () => {
      grid.dispose();
      grid = new Grid(gridHost, {
        columns,
        itemsSource: data,
        headersVisibility: select.value as HeadersVisibility,
      });
    });

    return () => {
      grid.dispose();
      toolbar.remove();
      gridHost.remove();
    };
  },
};
