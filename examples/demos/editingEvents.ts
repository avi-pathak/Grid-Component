import { Grid } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

export const editingEvents: Demo = {
  id: 'editing-events',
  title: 'Editing events',
  tagline: 'The full begin → prepare → end lifecycle, logged live as you edit a cell.',
  mount(host) {
    const hint = document.createElement('p');
    hint.className = 'apg-demo-readout';
    hint.style.margin = '0 0 12px';
    hint.textContent =
      'Double-click a cell, change it, and press Enter — every editing event fires in order ' +
      'below. Press Escape instead to see the lifecycle without a commit (no cellEditEnding/' +
      'cellEditEnded).';
    host.appendChild(hint);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    gridHost.style.height = '300px';
    host.appendChild(gridHost);

    const log = document.createElement('textarea');
    log.className = 'apg-demo-json';
    log.readOnly = true;
    log.rows = 8;
    log.placeholder = 'Editing events will appear here…';
    host.appendChild(log);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 150, editable: true },
        { binding: 'country', header: 'Country', width: 140, editable: true },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number', editable: true },
      ],
      itemsSource: makeSales(500),
    });

    const lines: string[] = [];
    const write = (line: string): void => {
      lines.push(line);
      if (lines.length > 40) lines.shift();
      log.value = lines.join('\n');
      log.scrollTop = log.scrollHeight;
    };
    const at = (row: number, col: number): string => `(${row},${col})`;

    const offs = [
      grid.on('beginningEdit', (e) => write(`beginningEdit ${at(e.row, e.col)} — cancelable`)),
      grid.on('cellEditStart', (e) => write(`cellEditStart ${at(e.row, e.col)}`)),
      grid.on('cellEditPreparing', (e) =>
        write(`cellEditPreparing ${at(e.row, e.col)} — column "${e.column.header}"`),
      ),
      grid.on('cellEditEnding', (e) => write(`cellEditEnding ${at(e.row, e.col)} → ${e.value}`)),
      grid.on('cellEditEnded', (e) => write(`cellEditEnded ${at(e.row, e.col)} → ${e.value}`)),
      grid.on('cellEditEnd', (e) => write(`cellEditEnd ${at(e.row, e.col)}`)),
    ];

    return {
      grid,
      dispose: () => {
        offs.forEach((off) => off());
        grid.dispose();
        hint.remove();
        gridHost.remove();
        log.remove();
      },
    };
  },
};
