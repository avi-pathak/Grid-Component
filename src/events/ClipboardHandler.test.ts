import { describe, it, expect, vi } from 'vitest';
import { ClipboardHandler } from './ClipboardHandler';

// jsdom doesn't build ClipboardEvent with a clipboardData payload, so fake one.
function clipboardEvent(type: 'copy' | 'paste', text = ''): Event {
  const store = { text };
  const e = new Event(type, { cancelable: true });
  Object.defineProperty(e, 'clipboardData', {
    value: {
      getData: () => store.text,
      setData: (_mime: string, value: string) => {
        store.text = value;
      },
    },
  });
  return e;
}

describe('ClipboardHandler', () => {
  it('writes the clip text to the clipboard on copy', () => {
    const host = document.createElement('div');
    new ClipboardHandler(host, {
      isEditing: () => false,
      getClip: () => 'A\tB',
      applyClip: () => {},
    });
    const e = clipboardEvent('copy');
    host.dispatchEvent(e);
    expect(
      (e as unknown as { clipboardData: DataTransfer }).clipboardData.getData('text/plain'),
    ).toBe('A\tB');
    expect(e.defaultPrevented).toBe(true);
  });

  it('passes pasted text to applyClip', () => {
    const host = document.createElement('div');
    const applyClip = vi.fn();
    new ClipboardHandler(host, { isEditing: () => false, getClip: () => null, applyClip });
    host.dispatchEvent(clipboardEvent('paste', 'x\ty'));
    expect(applyClip).toHaveBeenCalledWith('x\ty');
  });

  it('ignores copy and paste while a cell is being edited', () => {
    const host = document.createElement('div');
    const applyClip = vi.fn();
    new ClipboardHandler(host, { isEditing: () => true, getClip: () => 'nope', applyClip });

    const copy = clipboardEvent('copy');
    host.dispatchEvent(copy);
    expect(copy.defaultPrevented).toBe(false);

    host.dispatchEvent(clipboardEvent('paste', 'x'));
    expect(applyClip).not.toHaveBeenCalled();
  });

  it('skips copy when there is nothing to copy', () => {
    const host = document.createElement('div');
    new ClipboardHandler(host, {
      isEditing: () => false,
      getClip: () => null,
      applyClip: () => {},
    });
    const e = clipboardEvent('copy');
    host.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it('stops listening after dispose', () => {
    const host = document.createElement('div');
    const applyClip = vi.fn();
    const handler = new ClipboardHandler(host, {
      isEditing: () => false,
      getClip: () => null,
      applyClip,
    });
    handler.dispose();
    host.dispatchEvent(clipboardEvent('paste', 'x'));
    expect(applyClip).not.toHaveBeenCalled();
  });
});
