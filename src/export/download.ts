/**
 * Trigger a browser download of exported content. Kept isolated so the rest of
 * the export module stays DOM-free and unit-testable. No dependencies.
 */
export function downloadBlob(
  content: string | Uint8Array,
  fileName: string,
  mimeType: string,
): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  // Copy into a fresh ArrayBuffer-backed view so Blob gets a clean buffer.
  const part: BlobPart = typeof content === 'string' ? content : new Uint8Array(content).slice();
  const blob = new Blob([part], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the click has committed.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
