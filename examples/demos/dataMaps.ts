import { Grid, DataMap, DataMapEditor } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

// A real key/display map: cells hold the country code, the grid shows the name.
const countryMap = new DataMap(
  [
    { code: 'US', name: 'United States' },
    { code: 'DE', name: 'Germany' },
    { code: 'UK', name: 'United Kingdom' },
    { code: 'JP', name: 'Japan' },
    { code: 'IT', name: 'Italy' },
    { code: 'GR', name: 'Greece' },
  ],
  'code',
  'name',
);
const codes = ['US', 'DE', 'UK', 'JP', 'IT', 'GR'];

const priorities = [
  { value: 1, text: 'High' },
  { value: 2, text: 'Medium' },
  { value: 3, text: 'Low' },
];

// Editable map: the autocomplete accepts owners that aren't on the list.
const ownerMap = new DataMap('Alice,Bob,Carmen,Dmitri,Elena,Farid'.split(','));
ownerMap.isEditable = true;
const owners = 'Alice,Bob,Carmen,Dmitri,Elena,Farid'.split(',');

export const dataMaps: Demo = {
  id: 'data-maps',
  title: 'Data maps & editors',
  tagline: 'One DataMap, three editors: dropdown, radio buttons, and autocomplete.',
  mount(host) {
    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const data = makeSales(2000).map((r, i) => ({
      ...r,
      countryCode: codes[i % codes.length],
      priority: (i % 3) + 1,
      owner: owners[i % owners.length],
    }));

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 130 },
        {
          binding: 'countryCode',
          header: 'Country (dropdown)',
          width: 170,
          editable: true,
          dataMap: countryMap,
          dataMapEditor: DataMapEditor.DropDownList,
        },
        {
          binding: 'priority',
          header: 'Priority (radio)',
          width: 150,
          editable: true,
          dataMap: priorities,
          dataMapEditor: DataMapEditor.RadioButtons,
        },
        {
          binding: 'owner',
          header: 'Owner (autocomplete)',
          width: 190,
          editable: true,
          dataMap: ownerMap,
          dataMapEditor: DataMapEditor.AutoComplete,
        },
      ],
      itemsSource: data,
    });

    return () => {
      grid.dispose();
      gridHost.remove();
    };
  },
};
