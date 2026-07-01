export interface ClipboardDeps {
  /** True while a cell editor is open, so clipboard events go to the editor. */
  isEditing: () => boolean;
  /** Text to write to the clipboard for the current selection, or null to skip. */
  getClip: () => string | null;
  /** Apply pasted text to the grid. */
  applyClip: (text: string) => void;
}

/**
 * Wires the grid's copy and paste shortcuts to the system clipboard. It listens
 * for the browser's native copy/paste events on the host, which fire on Ctrl+C
 * and Ctrl+V (and the menu actions) while the grid has focus. Using these events
 * means pasted text can come from another app (a spreadsheet) or from the grid
 * itself, in the same tab-delimited format.
 */
export class ClipboardHandler {
  private readonly onCopy = (e: ClipboardEvent): void => {
    if (this.deps.isEditing() || !e.clipboardData) return;
    const text = this.deps.getClip();
    if (text == null) return;
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
  };

  private readonly onPaste = (e: ClipboardEvent): void => {
    if (this.deps.isEditing() || !e.clipboardData) return;
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;
    e.preventDefault();
    this.deps.applyClip(text);
  };

  constructor(
    private host: HTMLElement,
    private deps: ClipboardDeps,
  ) {
    this.host.addEventListener('copy', this.onCopy);
    this.host.addEventListener('paste', this.onPaste);
  }

  dispose(): void {
    this.host.removeEventListener('copy', this.onCopy);
    this.host.removeEventListener('paste', this.onPaste);
  }
}
