import '@avi-pathak/apgrid/styles.css';
import './demo.css';
import './site.css';

import { VERSION, Grid } from '@avi-pathak/apgrid';
import { demos } from './demos';
import { catalog, categories, categoryOf } from './demos/catalog';
import { demoSources, fileNameOf } from './demos/sources';
import { Demo, DemoHandle } from './demos/types';
import { createCodeView } from './codeView';
import { openInStackBlitz, hasSandbox } from './stackblitz';
import { mountExportBar } from './exportBar';
import { icon } from './icons';

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const nav = el('nav');
const main = el('main');
const crumbs = el('crumbs');
const search = el<HTMLInputElement>('search');
const exportSlot = el('export-slot');
const themeToggle = el<HTMLButtonElement>('theme-toggle');
const menuBtn = el<HTMLButtonElement>('menu-btn');
const sidebarClose = el<HTMLButtonElement>('sidebar-close');
const backdrop = el('backdrop');

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"]/g, (ch) =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;',
  );

/* ===========================================================================
   Static chrome
   ======================================================================== */

el('version').textContent = `v${VERSION}`;
el('brand').querySelector('.brand-mark')!.innerHTML = icon('layers', 18);
document.querySelector('.search-icon')!.innerHTML = icon('search', 15);
sidebarClose.innerHTML = icon('close', 17);
menuBtn.innerHTML = icon('menu', 18);
el('repo-link').innerHTML = `${icon('github', 14)}<span>GitHub</span>`;

/* ===========================================================================
   Live demo state

   Declared up front because the theme toggle below refreshes the mounted grid,
   and it runs during startup — before the demo page section is reached.
   ======================================================================== */

let dispose: (() => void) | null = null;
let currentGrid: (() => Grid) | null = null;

/* ===========================================================================
   Theme
   ======================================================================== */

const THEME_KEY = 'apgrid-theme';

const isDark = (): boolean => document.documentElement.classList.contains('site-dark');

function applyTheme(dark: boolean): void {
  document.documentElement.classList.toggle('apg-theme-dark', dark);
  document.documentElement.classList.toggle('site-dark', dark);
  themeToggle.innerHTML = icon(dark ? 'sun' : 'moon', 17);
  themeToggle.setAttribute('aria-pressed', String(dark));
  themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    // Private browsing — the theme just won't persist.
  }
  // Row metrics can differ between themes, so let the live grid re-measure.
  currentGrid?.().refresh();
}

themeToggle.addEventListener('click', () => applyTheme(!isDark()));
applyTheme(isDark());

/* ===========================================================================
   Mobile navigation drawer
   ======================================================================== */

function setNavOpen(open: boolean): void {
  document.body.classList.toggle('nav-open', open);
  backdrop.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
  if (open) search.focus();
}

menuBtn.addEventListener('click', () => setNavOpen(true));
sidebarClose.addEventListener('click', () => setNavOpen(false));
backdrop.addEventListener('click', () => setNavOpen(false));

/* ===========================================================================
   Sidebar
   ======================================================================== */

const COLLAPSED_KEY = 'apgrid-collapsed-groups';

const readCollapsed = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
};

const collapsed = readCollapsed();

function persistCollapsed(): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  } catch {
    // Non-fatal: groups simply reopen next visit.
  }
}

/** Wrap the matched substring in <mark> so search hits are visible. */
function withHighlight(title: string, query: string): string {
  if (!query) return escapeHtml(title);
  const at = title.toLowerCase().indexOf(query);
  if (at < 0) return escapeHtml(title);
  return (
    escapeHtml(title.slice(0, at)) +
    `<mark>${escapeHtml(title.slice(at, at + query.length))}</mark>` +
    escapeHtml(title.slice(at + query.length))
  );
}

function renderNav(): void {
  const query = search.value.trim().toLowerCase();
  const searching = query.length > 0;

  const groups = categories
    .map((category) => {
      const entries = catalog.filter(
        (entry) =>
          entry.category.id === category.id &&
          (!searching ||
            entry.demo.title.toLowerCase().includes(query) ||
            entry.demo.tagline.toLowerCase().includes(query) ||
            category.label.toLowerCase().includes(query)),
      );
      return { category, entries };
    })
    .filter((group) => group.entries.length > 0);

  if (groups.length === 0) {
    nav.innerHTML = `<p class="nav-empty">No demos match “${escapeHtml(search.value)}”.</p>`;
    return;
  }

  nav.innerHTML = groups
    .map(({ category, entries }) => {
      // A search should always reveal its own results, whatever is collapsed.
      const open = searching || !collapsed.has(category.id);
      const items = entries
        .map(
          ({ demo }) =>
            `<li><a class="nav-link" href="#${demo.id}" data-id="${demo.id}">${withHighlight(
              demo.title,
              query,
            )}</a></li>`,
        )
        .join('');

      return `
        <div class="nav-group" data-category="${category.id}" data-open="${open}">
          <button class="nav-group-btn" type="button" aria-expanded="${open}">
            ${icon('chevronDown', 12, 'chev')}
            <span class="nav-group-label">${escapeHtml(category.label)}</span>
            <span class="nav-count">${entries.length}</span>
          </button>
          <ul class="nav-list">${items}</ul>
        </div>`;
    })
    .join('');

  markActive();
}

nav.addEventListener('click', (event) => {
  const toggle = (event.target as HTMLElement).closest('.nav-group-btn');
  if (toggle) {
    const group = toggle.closest('.nav-group') as HTMLElement;
    const id = group.dataset.category!;
    const nowOpen = group.dataset.open !== 'true';
    group.dataset.open = String(nowOpen);
    toggle.setAttribute('aria-expanded', String(nowOpen));
    if (nowOpen) collapsed.delete(id);
    else collapsed.add(id);
    persistCollapsed();
    return;
  }
  if ((event.target as HTMLElement).closest('.nav-link')) setNavOpen(false);
});

let searchTimer: number | undefined;
search.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(renderNav, 90);
});

search.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    search.value = '';
    renderNav();
    search.blur();
  }
  if (event.key === 'Enter') {
    const first = nav.querySelector<HTMLAnchorElement>('.nav-link');
    if (first) location.hash = first.dataset.id!;
  }
});

// `/` focuses search from anywhere, the way most docs sites behave.
window.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
  if (event.key === '/' && !typing) {
    event.preventDefault();
    search.focus();
    search.select();
  }
});

function markActive(): void {
  const id = location.hash.slice(1);
  for (const link of nav.querySelectorAll<HTMLAnchorElement>('.nav-link')) {
    const active = link.dataset.id === id;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

/* ===========================================================================
   Overview page
   ======================================================================== */

function renderHome(): void {
  crumbs.innerHTML = '<span class="crumb-current">Overview</span>';
  exportSlot.innerHTML = '';

  const cards = categories
    .map(
      (category) => `
      <article class="cat-card">
        <div class="cat-card-head">
          <span class="cat-icon">${icon(category.icon, 17)}</span>
          <h3>${escapeHtml(category.label)}</h3>
        </div>
        <p class="cat-card-blurb">${escapeHtml(category.blurb)}</p>
        <ul class="cat-links">
          ${catalog
            .filter((entry) => entry.category.id === category.id)
            .map(({ demo }) => `<li><a href="#${demo.id}">${escapeHtml(demo.title)}</a></li>`)
            .join('')}
        </ul>
      </article>`,
    )
    .join('');

  main.innerHTML = `
    <div class="home">
      <section class="hero">
        <span class="hero-badge">${icon('bolt', 13)} v${escapeHtml(VERSION)} · zero runtime deps</span>
        <h1>A data grid that stays fast at <em>a million rows</em>.</h1>
        <p>
          apgrid renders millions of rows through a recycled DOM at ~60fps — no framework,
          no dependencies. Every demo below is live, shows its real source, and opens in an
          editable sandbox.
        </p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="#${catalog[0].demo.id}">
            ${icon('play', 14)}<span>Start with ${escapeHtml(catalog[0].demo.title)}</span>
          </a>
          <a
            class="btn"
            href="https://www.npmjs.com/package/@avi-pathak/apgrid"
            target="_blank"
            rel="noopener noreferrer"
          >${icon('download', 14)}<span>Install from npm</span>${icon('external', 13)}</a>
        </div>
        <div class="hero-stats">
          <div class="stat"><span class="stat-num">${catalog.length}</span><span class="stat-label">live demos</span></div>
          <div class="stat"><span class="stat-num">${categories.length}</span><span class="stat-label">feature areas</span></div>
          <div class="stat"><span class="stat-num">1M+</span><span class="stat-label">rows at 60fps</span></div>
          <div class="stat"><span class="stat-num">0</span><span class="stat-label">runtime deps</span></div>
        </div>
      </section>

      <div class="home-section-head">
        <h2>Browse by feature</h2>
        <p>Press <kbd>/</kbd> to search</p>
      </div>
      <div class="cat-grid">${cards}</div>
    </div>`;
}

/* ===========================================================================
   Demo page
   ======================================================================== */

function renderDemo(demo: Demo): void {
  const category = categoryOf(demo.id);
  const index = catalog.findIndex((entry) => entry.demo.id === demo.id);
  const prev = catalog[index - 1]?.demo;
  const next = catalog[index + 1]?.demo;
  const source = demoSources[demo.id];

  crumbs.innerHTML = [
    '<a href="#">Demos</a>',
    `<span class="sep">${icon('chevronRight', 11)}</span>`,
    category ? `<span>${escapeHtml(category.label)}</span>` : '',
    category ? `<span class="sep">${icon('chevronRight', 11)}</span>` : '',
    `<span class="crumb-current">${escapeHtml(demo.title)}</span>`,
  ].join('');

  main.innerHTML = `
    <article class="demo-view">
      <header class="demo-hero">
        ${category ? `<span class="demo-eyebrow">${escapeHtml(category.label)}</span>` : ''}
        <h1>${escapeHtml(demo.title)}</h1>
        <p>${escapeHtml(demo.tagline)}</p>
      </header>

      <div class="demo-bar">
        <div class="tabs" role="tablist" aria-label="Demo view">
          <button class="tab" type="button" role="tab" id="tab-preview" aria-controls="panel-preview" aria-selected="true">
            ${icon('eye', 14)}<span>Preview</span>
          </button>
          <button class="tab" type="button" role="tab" id="tab-code" aria-controls="panel-code" aria-selected="false">
            ${icon('code', 14)}<span>Code</span>
          </button>
        </div>
        <div class="demo-bar-spacer"></div>
        <div id="sandbox-slot"></div>
      </div>

      <section class="panel" id="panel-preview" role="tabpanel" aria-labelledby="tab-preview">
        <div class="stage" id="stage"></div>
      </section>

      <section class="panel" id="panel-code" role="tabpanel" aria-labelledby="tab-code" hidden></section>

      <nav class="pager" aria-label="Demo pagination">
        ${
          prev
            ? `<a class="pager-link prev" href="#${prev.id}">${icon('chevronLeft', 14)}
                 <span><span class="pager-dir">Previous</span><span class="pager-title">${escapeHtml(prev.title)}</span></span>
               </a>`
            : ''
        }
        ${
          next
            ? `<a class="pager-link next" href="#${next.id}">
                 <span><span class="pager-dir">Next</span><span class="pager-title">${escapeHtml(next.title)}</span></span>
                 ${icon('chevronRight', 14)}
               </a>`
            : ''
        }
      </nav>
    </article>`;

  // ---- Mount the live demo ------------------------------------------------

  const stage = el('stage');
  const handle: DemoHandle = demo.mount(stage);
  currentGrid = extractGrid(handle);
  dispose = toDispose(handle);

  exportSlot.innerHTML = '';
  if (currentGrid) mountExportBar(exportSlot, currentGrid);

  // ---- Source panel and sandbox ------------------------------------------

  const codePanel = el('panel-code');
  if (source) {
    codePanel.append(
      createCodeView({
        source,
        fileName: fileNameOf(source),
        actions: [sandboxButton(demo, true)],
      }),
    );
    const note = document.createElement('p');
    note.className = 'code-note';
    note.innerHTML = `${icon('bolt', 15)}<span><strong>This is the code that is running above.</strong>
      Open it in StackBlitz to get the same file in an editable project wired to the published
      npm package.</span>`;
    codePanel.append(note);

    if (hasSandbox(demo)) el('sandbox-slot').append(sandboxButton(demo, false));
  } else {
    codePanel.innerHTML = '<p class="code-note">Source is unavailable for this demo.</p>';
  }

  // ---- Tabs ---------------------------------------------------------------

  const tabPreview = el<HTMLButtonElement>('tab-preview');
  const tabCode = el<HTMLButtonElement>('tab-code');
  const panelPreview = el('panel-preview');

  function selectTab(showPreview: boolean): void {
    tabPreview.setAttribute('aria-selected', String(showPreview));
    tabCode.setAttribute('aria-selected', String(!showPreview));
    panelPreview.hidden = !showPreview;
    codePanel.hidden = showPreview;
    // The grid was display:none while the Code tab was open, so its viewport
    // measurements are stale — refresh() re-measures and redraws.
    if (showPreview) currentGrid?.().refresh();
  }

  tabPreview.addEventListener('click', () => selectTab(true));
  tabCode.addEventListener('click', () => selectTab(false));
}

function sandboxButton(demo: Demo, small: boolean): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = small ? 'btn btn-ghost btn-sm' : 'btn btn-run';
  button.innerHTML = `${icon('bolt', 14)}<span>${
    small ? 'StackBlitz' : 'Open in StackBlitz'
  }</span>${small ? '' : icon('external', 13)}`;
  button.title = `Open the ${demo.title} demo in an editable StackBlitz sandbox`;
  button.addEventListener('click', () => openInStackBlitz(demo));
  return button;
}

/* ===========================================================================
   Routing
   ======================================================================== */

// Some demos rebuild their grid, so resolve it lazily through a getter.
function extractGrid(handle: DemoHandle): (() => Grid) | null {
  if (typeof handle === 'function' || !handle.grid) return null;
  const grid = handle.grid;
  return typeof grid === 'function' ? grid : () => grid;
}

const toDispose = (handle: DemoHandle): (() => void) =>
  typeof handle === 'function' ? handle : () => handle.dispose();

function route(): void {
  dispose?.();
  dispose = null;
  currentGrid = null;

  const id = location.hash.slice(1);
  const demo = demos.find((d) => d.id === id);

  if (demo) renderDemo(demo);
  else renderHome();

  markActive();
  main.scrollTop = 0;
}

window.addEventListener('hashchange', route);

renderNav();
route();
