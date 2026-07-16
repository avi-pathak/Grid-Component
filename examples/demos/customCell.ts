import { Grid } from '@avi-pathak/apgrid';
import { makeSales, SalesRow } from '../data';
import { Demo } from './types';

const flags: Record<string, string> = {
  US: '#3b82f6',
  Germany: '#f59e0b',
  UK: '#ef4444',
  Japan: '#ec4899',
  Italy: '#22c55e',
  Greece: '#06b6d4',
  France: '#6366f1',
  Spain: '#f97316',
  Brazil: '#10b981',
  India: '#8b5cf6',
};

export const customCell: Demo = {
  id: 'custom-cell',
  title: 'Custom cells',
  tagline: 'A cellTemplate returns HTML — here a progress bar and colored badges.',
  mount(host) {
    const gridHost = document.createElement('div');
    gridHost.className = 'apg-demo-grid';
    host.appendChild(gridHost);

    const grid = new Grid(gridHost, {
      columns: [
        { binding: 'id', header: 'ID', width: 60, dataType: 'Number' },
        {
          binding: 'country',
          header: 'Country',
          width: 150,
          cellTemplate: ({ value }) => {
            const color = flags[String(value)] ?? '#94a3b8';
            return `<span class="badge" style="background:${color}"></span>${value}`;
          },
        },
        {
          binding: 'sales',
          header: 'Sales',
          width: 220,
          cellTemplate: ({ value }) => {
            const pct = Math.min(100, Math.round((Number(value) / 10000) * 100));
            return `<div class="bar"><i style="width:${pct}%"></i></div><span class="bar-num">${value}</span>`;
          },
        },
        { binding: 'expenses', header: 'Expenses', width: 110, dataType: 'Number' },
      ],
      itemsSource: makeSales(2000) as SalesRow[],
    });

    return {
      grid,
      dispose: () => {
        grid.dispose();
        gridHost.remove();
      },
    };
  },
};
