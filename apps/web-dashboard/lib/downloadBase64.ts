export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export function downloadBase64File(b64: string, mime: string, filename: string): void {
  const blob = base64ToBlob(b64, mime);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Object URL for inline display (e.g. img src); caller must revoke when done. */
export function objectUrlFromBase64(b64: string, mime: string): string {
  return URL.createObjectURL(base64ToBlob(b64, mime));
}
