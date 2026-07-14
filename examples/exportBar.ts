import { Grid } from '../src';

/**
 * A compact, reusable Export control shown in the demo header for any demo that
 * exposes its grid. Offers a format picker and an Export button that runs
 * `grid.exportAsync` with the built-in progress overlay — so every demo is
 * exportable with no per-demo code. `getGrid` is called at export time so demos
 * that rebuild their grid still export the current one.
 */
export function mountExportBar(slot: HTMLElement, getGrid: () => Grid): void {
  const bar = document.createElement('div');
  bar.className = 'export-bar';

  const select = document.createElement('select');
  select.className = 'export-bar-select';
  for (const [value, label] of [
    ['csv', 'CSV'],
    ['xlsx', 'Excel'],
    ['pdf', 'PDF'],
  ]) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.appendChild(opt);
  }

  const btn = document.createElement('button');
  btn.className = 'export-bar-btn';
  btn.type = 'button';
  btn.textContent = 'Export ↓';

  btn.addEventListener('click', () => {
    btn.disabled = true;
    getGrid()
      .exportAsync({
        format: select.value,
        fileName: 'apgrid-export',
        showProgress: true,
        includeGroups: true,
        title: 'apgrid export',
      })
      .finally(() => {
        btn.disabled = false;
      });
  });

  bar.append(select, btn);
  slot.appendChild(bar);
}
