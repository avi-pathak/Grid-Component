import '@avi-pathak/apgrid/styles.css';
import './site.css';
import { VERSION, Grid } from '@avi-pathak/apgrid';
import { demos } from './demos';
import { DemoHandle } from './demos/types';
import { mountExportBar } from './exportBar';

const nav = document.getElementById('nav') as HTMLElement;
const stage = document.getElementById('stage') as HTMLElement;
const demoTitle = document.getElementById('demo-title') as HTMLElement;
const demoTagline = document.getElementById('demo-tagline') as HTMLElement;
const versionEl = document.getElementById('version') as HTMLElement;

versionEl.textContent = `v${VERSION}`;

// Dark-theme toggle: adds `apg-theme-dark` to <body>, which the stylesheet's
// ancestor rule applies to every `.apg` grid (and its body-mounted overlays).
const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
const applyTheme = (dark: boolean): void => {
  document.body.classList.toggle('apg-theme-dark', dark);
  document.body.classList.toggle('site-dark', dark);
  themeToggle.textContent = dark ? 'Light' : 'Dark';
  themeToggle.setAttribute('aria-pressed', String(dark));
};
themeToggle.addEventListener('click', () => {
  applyTheme(!document.body.classList.contains('apg-theme-dark'));
});
applyTheme(false);

let dispose: (() => void) | null = null;
const exportSlot = document.getElementById('export-slot') as HTMLElement;

function show(id: string): void {
  const demo = demos.find((d) => d.id === id) ?? demos[0];

  dispose?.();
  exportSlot.innerHTML = '';
  stage.innerHTML = '';

  demoTitle.textContent = demo.title;
  demoTagline.textContent = demo.tagline;

  const handle: DemoHandle = demo.mount(stage);
  const grid = extractGrid(handle);
  dispose = toDispose(handle);

  // Every demo that exposes its grid gets a shared Export control in the header.
  if (grid) mountExportBar(exportSlot, grid);

  for (const link of nav.querySelectorAll('a')) {
    link.classList.toggle('active', link.dataset.id === demo.id);
  }
  if (location.hash !== `#${demo.id}`) location.hash = demo.id;
}

// Resolve the demo's grid to a getter (some demos rebuild their grid).
function extractGrid(handle: DemoHandle): (() => Grid) | null {
  if (typeof handle === 'function' || !handle.grid) return null;
  const g = handle.grid;
  return typeof g === 'function' ? g : () => g;
}

function toDispose(handle: DemoHandle): () => void {
  return typeof handle === 'function' ? handle : () => handle.dispose();
}

for (const demo of demos) {
  const link = document.createElement('a');
  link.href = `#${demo.id}`;
  link.dataset.id = demo.id;
  link.textContent = demo.title;
  nav.appendChild(link);
}

window.addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1));
