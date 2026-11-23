/**
 * Client-side HTML5 Canvas image compressor for Private Gallery & Profile Avatars.
 * Resizes images to fit within `maxDimension` x `maxDimension` (default 256x256px)
 * and encodes as WebP (or JPEG fallback) at `quality` (default 0.8) so account sync
 * payloads remain compact and never exceed Cloudflare storage limits.
 */
export async function compressImageToDataUrl(
  source: File | Blob | string,
  maxDimension: number = 256,
  quality: number = 0.8
): Promise<{ dataUrl: string; sizeKb: number; width: number; height: number }> {
  const rawDataUrl =
    typeof source === 'string'
      ? source
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (typeof ev.target?.result === 'string') {
              resolve(ev.target.result);
            } else {
              reject(new Error('Failed to read image file'));
            }
          };
          reader.onerror = () => reject(new Error('Failed to read image file'));
          reader.readAsDataURL(source);
        });

  if (typeof document === 'undefined') {
    const fallbackKb = Math.max(1, Math.round((rawDataUrl.length * 0.75) / 1024));
    return { dataUrl: rawDataUrl, sizeKb: fallbackKb, width: maxDimension, height: maxDimension };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const origW = img.naturalWidth || img.width || maxDimension;
        const origH = img.naturalHeight || img.height || maxDimension;
        const scale = Math.min(1, maxDimension / Math.max(origW, origH, 1));
        const targetW = Math.max(1, Math.round(origW * scale));
        const targetH = Math.max(1, Math.round(origH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const kb = Math.max(1, Math.round((rawDataUrl.length * 0.75) / 1024));
          resolve({ dataUrl: rawDataUrl, sizeKb: kb, width: origW, height: origH });
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Try WebP first, fall back to JPEG if WebP is unsupported
        let compressed = canvas.toDataURL('image/webp', quality);
        if (!compressed.startsWith('data:image/webp')) {
          compressed = canvas.toDataURL('image/jpeg', quality);
        }

        const sizeKb = Math.max(1, Math.round((compressed.length * 0.75) / 1024));
        resolve({
          dataUrl: compressed,
          sizeKb,
          width: targetW,
          height: targetH,
        });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Unable to decode image'));
    img.src = rawDataUrl;
  });
}
