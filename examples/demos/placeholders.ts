import { Grid } from '@avi-pathak/apgrid';
import { Demo } from './types';

interface ContactRow {
  id: number;
  name: string;
  email: string;
  phone: string;
  notes: string;
  [key: string]: unknown;
}

function makeContacts(count: number): ContactRow[] {
  const rows: ContactRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: i + 1,
      name: i % 4 === 0 ? '' : `Contact ${i + 1}`,
      email: i % 3 === 0 ? '' : `contact${i + 1}@example.com`,
      phone: '',
      notes: '',
    });
  }
  return rows;
}

export const placeholders: Demo = {
  id: 'placeholders',
  title: 'Placeholders',
  tagline: 'Explicit column.placeholder, plus showPlaceholders falling back to the header text.',
  mount(host) {
    const hint = document.createElement('p');
    hint.className = 'apg-demo-readout';
    hint.style.margin = '0 0 12px';
    hint.textContent =
      'Double-click an empty cell to see its placeholder. Name/Email set their own text; ' +
      'Phone/Notes have none set, so showPlaceholders falls back to the column header.';
    host.appendChild(hint);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        {
          binding: 'name',
          header: 'Name',
          width: 160,
          editable: true,
          placeholder: 'Full name',
        },
        {
          binding: 'email',
          header: 'Email',
          width: 200,
          editable: true,
          placeholder: 'name@company.com',
        },
        { binding: 'phone', header: 'Phone', width: 150, editable: true },
        { binding: 'notes', header: 'Notes', width: 200, editable: true },
      ],
      itemsSource: makeContacts(300),
      showPlaceholders: true,
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
