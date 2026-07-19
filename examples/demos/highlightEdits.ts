import { Grid } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

export const highlightEdits: Demo = {
  id: 'highlight-edits',
  title: 'Highlight edits',
  tagline: 'Edited cells stay marked until undone or reverted back to their original value.',
  mount(host) {
    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const clearBtn = document.createElement('button');
    clearBtn.className = 'apg-demo-btn';
    clearBtn.textContent = 'Clear highlights';
    const undoBtn = document.createElement('button');
    undoBtn.className = 'apg-demo-btn';
    undoBtn.textContent = '↶ Undo';
    undoBtn.disabled = true;
    const hint = document.createElement('span');
    hint.className = 'apg-demo-readout';
    hint.textContent =
      'Edit a cell — it stays tinted even after you click away. Undo (or typing the ' +
      'original value back in) clears the tint automatically.';
    toolbar.append(clearBtn, undoBtn, hint);
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
      ],
      itemsSource: makeSales(500),
      highlightEdits: true,
    });

    clearBtn.addEventListener('click', () => grid.clearEditHighlights());
    undoBtn.addEventListener('click', () => grid.undo());
    const off = grid.on('undoStackChanged', ({ canUndo }) => (undoBtn.disabled = !canUndo));

    return {
      grid,
      dispose: () => {
        off();
        grid.dispose();
        toolbar.remove();
        gridHost.remove();
      },
    };
  },
};
