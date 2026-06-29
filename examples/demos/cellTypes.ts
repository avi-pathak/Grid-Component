import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

export const cellTypes: Demo = {
  id: 'cell-types',
  title: 'Cell types',
  tagline: 'String, Number, Boolean, and Date columns align and edit by their type.',
  mount(host) {
    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 140, dataType: 'String', editable: true },
        { binding: 'country', header: 'Country', width: 130, dataType: 'String', editable: true },
        { binding: 'sales', header: 'Sales', width: 110, dataType: 'Number', editable: true },
        { binding: 'active', header: 'Active', width: 90, dataType: 'Boolean', editable: true },
        { binding: 'joined', header: 'Joined', width: 130, dataType: 'Date', editable: true },
      ],
      itemsSource: makeSales(2000),
    });

    return () => {
      grid.dispose();
      gridHost.remove();
    };
  },
};
