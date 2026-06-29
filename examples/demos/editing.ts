import { Grid } from '../../src';
import { makeSales } from '../data';
import { Demo } from './types';

export const editing: Demo = {
  id: 'editing',
  title: 'Editing & undo',
  tagline: 'Double-click to edit, drag header edges to resize. Every change is undoable.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const undo = button('↶ Undo');
    const redo = button('↷ Redo');
    undo.disabled = true;
    redo.disabled = true;
    toolbar.append(undo, redo);
    const hint = document.createElement('span');
    hint.className = 'apg-demo-readout';
    hint.textContent = 'Ctrl+Z / Ctrl+Y also work';
    toolbar.appendChild(hint);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 150, editable: true },
        { binding: 'country', header: 'Country', width: 140, editable: true },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number', editable: true },
        { binding: 'expenses', header: 'Expenses', width: 120, dataType: 'Number', editable: true },
        { binding: 'active', header: 'Active', width: 90, dataType: 'Boolean', editable: true },
      ],
      itemsSource: makeSales(2000),
    });

    undo.addEventListener('click', () => grid.undo());
    redo.addEventListener('click', () => grid.redo());
    const off = grid.on('undoStackChanged', ({ canUndo, canRedo }) => {
      undo.disabled = !canUndo;
      redo.disabled = !canRedo;
    });

    return () => {
      off();
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
