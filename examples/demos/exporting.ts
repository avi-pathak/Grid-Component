import { Grid, CellCallback } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

export const exporting: Demo = {
  id: 'export',
  title: 'Export',
  tagline:
    'Export to CSV, Excel (.xlsx), or PDF — generated in the browser with zero dependencies. Customize cells with a callback, and export large data asynchronously with a progress bar.',
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
    const customChk = checkbox('Custom cell styling', true);
    const asyncChk = checkbox('Async + progress', true);
    const exportBtn = button('Download');
    const note = document.createElement('span');
    note.className = 'apg-demo-readout';
    toolbar.append(
      formatSel.label,
      scopeSel.label,
      groupsChk.label,
      customChk.label,
      asyncChk.label,
      exportBtn,
      note,
    );
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
      itemsSource: makeSales(20000),
      selectionMode: 'RowRange',
      allowSorting: true,
      groupPanel: true,
    });

    grid.on('exported', (e) => {
      note.textContent = `Exported ${e.fileName}`;
    });

    // A cellCallback like Wijmo's formatItem: bold group aggregates, and tint
    // the Sales column green/red by sign (Excel picks up the styling; PDF too).
    const cellCallback: CellCallback = (ctx) => {
      if (ctx.rowKind === 'group') {
        ctx.cell.style = { bold: true, background: '#eef2fb' };
        return;
      }
      if (ctx.column.key === 'sales') {
        const n = Number(ctx.cell.value);
        ctx.cell.style = { color: n >= 5000 ? '#0a7d33' : '#c0392b' };
      }
    };

    exportBtn.addEventListener('click', () => {
      const opts = {
        format: formatSel.input.value,
        rows: scopeSel.input.value as 'all' | 'selection',
        includeGroups: groupsChk.input.checked,
        fileName: 'grid-export',
        title: 'Sales Export',
        cellCallback: customChk.input.checked ? cellCallback : undefined,
      };
      if (asyncChk.input.checked) {
        exportBtn.disabled = true;
        note.textContent = 'Exporting…';
        grid
          .exportAsync({ ...opts, showProgress: true })
          .finally(() => (exportBtn.disabled = false));
      } else {
        grid.export(opts);
      }
    });

    return {
      grid,
      dispose: () => {
        grid.dispose();
        toolbar.remove();
        gridHost.remove();
      },
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
