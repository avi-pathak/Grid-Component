import { Grid, GridStateSnapshot } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

const STORAGE_KEY = 'apg-demo-state';

export const stateSerialization: Demo = {
  id: 'state',
  title: 'Save & load state',
  tagline:
    'Sort, group, filter, resize, reorder, or freeze — then save the layout to JSON and restore it later.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const saveBtn = button('Save state');
    const loadBtn = button('Load state');
    const clearBtn = button('Clear saved');
    const note = document.createElement('span');
    note.className = 'apg-demo-readout';
    toolbar.append(saveBtn, loadBtn, clearBtn, note);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const json = document.createElement('textarea');
    json.className = 'apg-demo-json';
    json.readOnly = true;
    json.rows = 8;
    host.appendChild(json);

    const columns = [
      { binding: 'id', header: 'ID', width: 70, dataType: 'Number' as const },
      { binding: 'product', header: 'Product', width: 150 },
      { binding: 'country', header: 'Country', width: 150 },
      { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number' as const },
      { binding: 'expenses', header: 'Expenses', width: 120, dataType: 'Number' as const },
    ];

    const grid = new Grid(gridHost, {
      columns,
      itemsSource: makeSales(2000),
      allowFiltering: true,
      groupPanel: true,
    });

    const showSaved = (): void => {
      const saved = localStorage.getItem(STORAGE_KEY);
      note.textContent = saved ? 'Saved layout available' : 'No saved layout yet';
      loadBtn.disabled = !saved;
      clearBtn.disabled = !saved;
    };
    showSaved();

    saveBtn.addEventListener('click', () => {
      const snap = grid.toJSON();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
      json.value = JSON.stringify(snap, null, 2);
      showSaved();
    });

    loadBtn.addEventListener('click', () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const snap = JSON.parse(saved) as GridStateSnapshot;
      grid.loadJSON(snap);
      json.value = JSON.stringify(snap, null, 2);
    });

    clearBtn.addEventListener('click', () => {
      localStorage.removeItem(STORAGE_KEY);
      json.value = '';
      showSaved();
    });

    return {
      grid,
      dispose: () => {
        grid.dispose();
        toolbar.remove();
        gridHost.remove();
        json.remove();
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
