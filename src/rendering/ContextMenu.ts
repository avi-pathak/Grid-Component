import { createEl } from '../utils/DOM';
import { IconName, iconEl } from '../utils/icons';
import { applyThemeScope } from '../utils/theme-scope';

export interface MenuItem {
  label: string;
  icon?: IconName;
  disabled?: boolean;
  action: () => void;
}

export type MenuEntry = MenuItem | 'separator';

/**
 * A small floating menu shown at a point (typically the mouse on right-click).
 * Closes on outside click, Escape, scroll, or when another menu opens. Icons
 * come from the shared icon set.
 */
export class ContextMenu {
  private el?: HTMLElement;

  /** `themeSource` is any element inside the owning grid, used to carry its
   *  theme classes onto the body-mounted menu. */
  constructor(private themeSource?: HTMLElement) {}

  get isOpen(): boolean {
    return this.el != null;
  }

  open(x: number, y: number, items: MenuEntry[]): void {
    this.close();
    const menu = createEl('div', 'apg-context-menu');
    for (const item of items) {
      if (item === 'separator') {
        menu.appendChild(createEl('div', 'apg-context-menu-sep'));
        continue;
      }
      const row = createEl('button', 'apg-context-menu-item');
      row.type = 'button';
      row.disabled = !!item.disabled;
      row.appendChild(item.icon ? iconEl(item.icon, 'apg-context-menu-icon') : blankIcon());
      const label = createEl('span', 'apg-context-menu-label');
      label.textContent = item.label;
      row.appendChild(label);
      if (!item.disabled) {
        row.addEventListener('click', () => {
          this.close();
          item.action();
        });
      }
      menu.appendChild(row);
    }
    applyThemeScope(menu, this.themeSource ?? null);
    document.body.appendChild(menu);

    // Keep the menu inside the viewport.
    const r = menu.getBoundingClientRect();
    const left = Math.max(4, Math.min(x, window.innerWidth - r.width - 8));
    const top = Math.max(4, Math.min(y, window.innerHeight - r.height - 8));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    this.el = menu;

    // Defer so the opening click/contextmenu doesn't immediately close it.
    setTimeout(() => {
      window.addEventListener('mousedown', this.onOutside, true);
      window.addEventListener('keydown', this.onKey, true);
      window.addEventListener('scroll', this.close, true);
    });
  }

  readonly close = (): void => {
    if (!this.el) return;
    this.el.remove();
    this.el = undefined;
    window.removeEventListener('mousedown', this.onOutside, true);
    window.removeEventListener('keydown', this.onKey, true);
    window.removeEventListener('scroll', this.close, true);
  };

  private readonly onOutside = (e: MouseEvent): void => {
    if (this.el && !this.el.contains(e.target as Node)) this.close();
  };

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };
}

function blankIcon(): HTMLElement {
  return createEl('span', 'apg-context-menu-icon');
}
