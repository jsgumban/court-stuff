/**
 * Shrinks a picked image so it can live inside a synced settings row.
 * QR codes need sharp edges, so PNG is preferred and JPEG is only a fallback
 * when the PNG comes out too large.
 */
export async function resizeImage(file: File, maxDim = 720, maxBytes = 300_000): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This image format cannot be read here. Try a PNG or JPEG screenshot.');
  });

  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image on this browser.');
  ctx.imageSmoothingQuality = 'high';
  // A white backdrop keeps transparent QR codes scannable.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const png = canvas.toDataURL('image/png');
  if (dataUrlBytes(png) <= maxBytes) return png;
  for (const q of [0.92, 0.85, 0.75]) {
    const jpeg = canvas.toDataURL('image/jpeg', q);
    if (dataUrlBytes(jpeg) <= maxBytes) return jpeg;
  }
  throw new Error('That image is too detailed to store. Crop it to just the QR code and try again.');
}

export function dataUrlBytes(dataUrl: string): number {
  const i = dataUrl.indexOf(',');
  if (i < 0) return 0;
  const b64 = dataUrl.slice(i + 1);
  return Math.floor((b64.length * 3) / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
}

export function formatBytes(n: number): string {
  return n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
