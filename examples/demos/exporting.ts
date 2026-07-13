import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

export const exporting: Demo = {
  id: 'export',
  title: 'Export',
  tagline:
    'Export the grid to CSV, Excel (.xlsx), or PDF — all generated in the browser with zero dependencies. Choose a format and scope, then download.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';

    const formatSel = select('Format', [
      ['csv', 'CSV'],
      ['xlsx', 'Excel (.xlsx)'],
      ['pdf', 'PDF'],
    ]);
    const scopeSel = select('Rows', [
      ['all', 'All rows'],
      ['selection', 'Selection'],
    ]);
    const groupsChk = checkbox('Include group rows', false);
    const exportBtn = button('Download');
    const note = document.createElement('span');
    note.className = 'apg-demo-readout';
    toolbar.append(formatSel.label, scopeSel.label, groupsChk.label, exportBtn, note);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 150 },
        { binding: 'country', header: 'Country', width: 150, aggregate: 'count' },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number', aggregate: 'sum' },
        {
          binding: 'expenses',
          header: 'Expenses',
          width: 120,
          dataType: 'Number',
          aggregate: 'sum',
        },
        { binding: 'joined', header: 'Joined', width: 130, dataType: 'Date' },
      ],
      itemsSource: makeSales(2000),
      selectionMode: 'RowRange',
      allowSorting: true,
      groupPanel: true,
    });

    grid.on('exported', (e) => {
      note.textContent = `Exported ${e.fileName}`;
    });

    exportBtn.addEventListener('click', () => {
      grid.export({
        format: formatSel.input.value,
        rows: scopeSel.input.value as 'all' | 'selection',
        includeGroups: groupsChk.input.checked,
        fileName: 'grid-export',
        title: 'Sales Export',
      });
    });

    return () => {
      grid.dispose();
      toolbar.remove();
      gridHost.remove();
    };
  },
};

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'apg-demo-btn';
  b.textContent = text;
  return b;
}

function select(
  labelText: string,
  options: [string, string][],
): { label: HTMLLabelElement; input: HTMLSelectElement } {
  const label = document.createElement('label');
  label.className = 'apg-demo-field';
  const input = document.createElement('select');
  for (const [value, text] of options) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    input.appendChild(opt);
  }
  label.append(document.createTextNode(`${labelText} `), input);
  return { label, input };
}

function checkbox(
  text: string,
  checked: boolean,
): { label: HTMLLabelElement; input: HTMLInputElement } {
  const label = document.createElement('label');
  label.className = 'apg-demo-field';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  label.append(input, document.createTextNode(` ${text}`));
  return { label, input };
}
