import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

export const freeze: Demo = {
  id: 'freeze',
  title: 'Frozen rows & columns',
  tagline:
    'Pin leading rows and columns so they stay visible while the rest of the grid scrolls. Set the counts and press Apply.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';

    const colsField = numberField('Freeze Columns (Left)', 2);
    const rowsField = numberField('Freeze Rows (Top)', 1);
    const applyBtn = button('Apply');
    const clearBtn = button('Clear');
    const readout = document.createElement('span');
    readout.className = 'apg-demo-readout';
    toolbar.append(colsField.wrap, rowsField.wrap, applyBtn, clearBtn, readout);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const data = makeSales(5000);
    const columns = [
      { binding: 'id', header: 'ID', width: 70, dataType: 'Number' as const },
      { binding: 'product', header: 'Product', width: 160 },
      { binding: 'country', header: 'Country', width: 160 },
      { binding: 'sales', header: 'Sales', width: 130, dataType: 'Number' as const },
      quarter('Q1', 0.22),
      quarter('Q2', 0.26),
      quarter('Q3', 0.24),
      quarter('Q4', 0.28),
    ];

    const grid = new Grid(gridHost, {
      columns,
      itemsSource: data,
      frozenColumns: 2,
      frozenRows: 1,
    });

    const status = (): void => {
      readout.textContent = `Frozen — left: ${grid.frozenColumns}, top: ${grid.frozenRows}`;
    };
    status();

    grid.on('frozenColumnsChanged', status);
    grid.on('frozenRowsChanged', status);

    applyBtn.addEventListener('click', () => {
      grid.freezeColumns(clampField(colsField.input));
      grid.freezeRows(clampField(rowsField.input));
    });
    clearBtn.addEventListener('click', () => {
      colsField.input.value = '0';
      rowsField.input.value = '0';
      grid.freezeColumns(0);
      grid.freezeRows(0);
    });

    return () => {
      grid.dispose();
      toolbar.remove();
      gridHost.remove();
    };
  },
};

function quarter(header: string, share: number) {
  return {
    header,
    width: 120,
    dataType: 'Number' as const,
    valueGetter: (item: { sales: number }) => Math.round(item.sales * share),
  };
}

function clampField(input: HTMLInputElement): number {
  return Math.max(0, input.valueAsNumber || 0);
}

function numberField(
  label: string,
  value: number,
): { wrap: HTMLLabelElement; input: HTMLInputElement } {
  const wrap = document.createElement('label');
  wrap.className = 'apg-demo-field';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.className = 'apg-demo-input';
  input.value = String(value);
  wrap.append(document.createTextNode(`${label} `), input);
  return { wrap, input };
}

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'apg-demo-btn';
  b.textContent = text;
  return b;
}
