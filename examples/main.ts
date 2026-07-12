import '../src/styles/apgrid.scss';
import './site.css';
import { VERSION } from '../src';
import { demos } from './demos';

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

function show(id: string): void {
  const demo = demos.find((d) => d.id === id) ?? demos[0];

  dispose?.();
  stage.innerHTML = '';

  demoTitle.textContent = demo.title;
  demoTagline.textContent = demo.tagline;
  dispose = demo.mount(stage);

  for (const link of nav.querySelectorAll('a')) {
    link.classList.toggle('active', link.dataset.id === demo.id);
  }
  if (location.hash !== `#${demo.id}`) location.hash = demo.id;
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
