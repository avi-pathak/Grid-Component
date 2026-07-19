export type NavAction = 'up' | 'down' | 'left' | 'right' | 'home' | 'end' | 'pageup' | 'pagedown';

/** Maps grid navigation and undo/redo keys and forwards them to the grid. */
export class KeyboardHandler {
  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        this.onUndoRedo(e.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (key === 'y') {
        e.preventDefault();
        this.onUndoRedo('redo');
        return;
      }
      return;
    }
    if (e.key === ' ' || e.key === 'F2' || e.key === 'Enter') {
      e.preventDefault();
      this.onActivate();
      return;
    }
    const action = toAction(e.key);
    if (action) {
      e.preventDefault();
      this.onNav(action, e.shiftKey);
      return;
    }
    // Typing a plain printable character over a selected (not yet editing)
    // cell starts a quick edit seeded with that character, Excel-style. Only
    // reached while no editor has focus — once one opens, its own keydown
    // handler stops propagation before this listener ever sees the keystroke.
    if (!e.altKey && e.key.length === 1) this.onType(e.key);
  };

  constructor(
    private host: HTMLElement,
    private onNav: (action: NavAction, extend: boolean) => void,
    private onUndoRedo: (action: 'undo' | 'redo') => void,
    private onActivate: () => void,
    private onType: (key: string) => void,
  ) {
    this.host.addEventListener('keydown', this.onKeyDown);
  }

  dispose(): void {
    this.host.removeEventListener('keydown', this.onKeyDown);
  }
}

function toAction(key: string): NavAction | null {
  switch (key) {
    case 'ArrowUp':
      return 'up';
    case 'ArrowDown':
      return 'down';
    case 'ArrowLeft':
      return 'left';
    case 'ArrowRight':
      return 'right';
    case 'Home':
      return 'home';
    case 'End':
      return 'end';
    case 'PageUp':
      return 'pageup';
    case 'PageDown':
      return 'pagedown';
    default:
      return null;
  }
}
