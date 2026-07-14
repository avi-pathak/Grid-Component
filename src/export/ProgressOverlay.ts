/**
 * A minimal, self-contained progress overlay shown during `exportAsync` when
 * `showProgress` is enabled. It mounts into the grid host, needs no styles from
 * the grid stylesheet (inline styles only), and is removed when the export
 * finishes. Hidden by default — the manager only creates it on request.
 */
export class ProgressOverlay {
  private root: HTMLElement;
  private bar: HTMLElement;
  private label: HTMLElement;

  constructor(private host: HTMLElement) {
    this.root = el('div', {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      background: 'rgba(0,0,0,0.35)',
      zIndex: '50',
      font: '13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color: '#fff',
    });
    this.root.className = 'apg-export-progress';
    this.root.setAttribute('role', 'progressbar');

    this.label = el('div', { fontWeight: '600' });
    this.label.textContent = 'Exporting…';

    const track = el('div', {
      width: '220px',
      height: '8px',
      borderRadius: '4px',
      background: 'rgba(255,255,255,0.25)',
      overflow: 'hidden',
    });
    this.bar = el('div', {
      width: '0%',
      height: '100%',
      borderRadius: '4px',
      background: '#4b8bff',
      transition: 'width 0.1s linear',
    });
    track.appendChild(this.bar);
    this.root.append(this.label, track);
  }

  show(): void {
    // The host must be a positioned container; the grid host already is.
    if (getComputedStyle(this.host).position === 'static') {
      this.host.style.position = 'relative';
    }
    this.host.appendChild(this.root);
  }

  set(fraction: number): void {
    const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
    this.bar.style.width = `${pct}%`;
    this.label.textContent = `Exporting… ${pct}%`;
    this.root.setAttribute('aria-valuenow', String(pct));
  }

  hide(): void {
    this.root.remove();
  }
}

function el(tag: string, style: Partial<CSSStyleDeclaration>): HTMLElement {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  return node;
}
