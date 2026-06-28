import '../src/styles/grid.css';
import { Grid, SelectionMode } from '../src';

const countries = 'US,Germany,UK,Japan,Italy,Greece,France,Spain,Brazil,India'.split(',');

const data = [];
for (let i = 0; i < 200_000; i++) {
  data.push({
    id: i,
    country: countries[i % countries.length],
    sales: Math.round(Math.random() * 10000),
    expenses: Math.round(Math.random() * 5000),
    note: `row ${i}`,
  });
}

const grid = new Grid('#theGrid', {
  columns: [
    { binding: 'id', header: 'ID', width: 80 },
    { binding: 'country', header: 'Country', width: 140, editable: true },
    { binding: 'sales', header: 'Sales', width: 120, editable: true },
    { binding: 'expenses', header: 'Expenses', width: 120, editable: true },
    { binding: 'note', header: 'Note', width: 200, editable: true },
  ],
  itemsSource: data,
  selectionMode: 'CellRange',
});

const picker = document.getElementById('mode') as HTMLSelectElement | null;
picker?.addEventListener('change', () => {
  grid.selectionMode = picker.value as SelectionMode;
});

const undoBtn = document.getElementById('undo') as HTMLButtonElement | null;
const redoBtn = document.getElementById('redo') as HTMLButtonElement | null;
undoBtn?.addEventListener('click', () => grid.undo());
redoBtn?.addEventListener('click', () => grid.redo());
grid.on('undoStackChanged', ({ canUndo, canRedo }) => {
  if (undoBtn) undoBtn.disabled = !canUndo;
  if (redoBtn) redoBtn.disabled = !canRedo;
});
