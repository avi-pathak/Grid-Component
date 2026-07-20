import { Grid } from '@avi-pathak/apgrid';
import { makeSales } from '../data';
import { Demo } from './types';

export const ime: Demo = {
  id: 'ime',
  title: 'IME (CJK input)',
  tagline: 'An Enter that confirms an IME composition must not commit the cell early.',
  mount(host) {
    const hint = document.createElement('p');
    hint.className = 'apg-demo-readout';
    hint.style.margin = '0 0 12px';
    hint.textContent =
      'With a CJK input method (Pinyin, Kana, Hangul…), double-click Product and type: the ' +
      'Enter that confirms a composition candidate keeps editing instead of committing the ' +
      "cell. If you don't have an IME installed, the button below replays that exact sequence " +
      'programmatically and reports the result.';
    host.appendChild(hint);

    const toolbar = document.createElement('div');
    toolbar.className = 'apg-demo-toolbar';
    const runBtn = document.createElement('button');
    runBtn.className = 'apg-demo-btn';
    runBtn.textContent = 'Simulate composition + Enter';
    const status = document.createElement('span');
    status.className = 'apg-demo-readout';
    toolbar.append(runBtn, status);
    host.appendChild(toolbar);

    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 70, dataType: 'Number' },
        { binding: 'product', header: 'Product', width: 180, editable: true },
        { binding: 'country', header: 'Country', width: 140, editable: true },
        { binding: 'sales', header: 'Sales', width: 120, dataType: 'Number', editable: true },
      ],
      itemsSource: makeSales(500),
    });

    const input = (): HTMLInputElement | null => gridHost.querySelector('.apg-cells input');

    runBtn.addEventListener('click', () => {
      grid.editCell(0, 1);
      const el = input();
      if (!el) {
        status.textContent = 'Could not open the editor.';
        return;
      }
      // Enter fired mid-composition (to confirm the IME candidate) must not commit.
      el.dispatchEvent(new CompositionEvent('compositionstart'));
      el.value = '日本語';
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const stillOpenDuringComposition = input() != null;

      // Once composition ends, Enter commits the confirmed text as usual.
      el.dispatchEvent(new CompositionEvent('compositionend'));
      el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const closedAfterComposition = input() == null;
      const committed = grid.collectionView.items[0].product === '日本語';

      const pass = stillOpenDuringComposition && closedAfterComposition && committed;
      status.textContent = pass
        ? '✓ Enter during composition did NOT commit; Enter after composition committed "日本語".'
        : '✗ Unexpected: the composition Enter leaked through.';
    });

    return {
      grid,
      dispose: () => {
        grid.dispose();
        hint.remove();
        toolbar.remove();
        gridHost.remove();
      },
    };
  },
};
