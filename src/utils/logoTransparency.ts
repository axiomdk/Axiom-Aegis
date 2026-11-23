/**
 * Axiom Aegis Brand Emblem Transparency Engine
 * Removes the dark navy/blue background and outer blue haze from the raster
 * brand emblem assets so that only the metallic/cyan Shield Icon and
 * the "AXIOM AEGIS" Wordmark remain visible with clean anti-aliased alpha edges.
 */

export interface RgbaPixel {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Computes the foreground alpha (0..255) and decontaminated RGB values for a single
 * pixel from the Axiom Aegis emblem image given the sampled background RGB baseline.
 */
export function computeEmblemForegroundPixel(
  r: number,
  g: number,
  b: number,
  bgR = 15,
  bgG = 22,
  bgB = 35
): RgbaPixel {
  // 1. White / Silver signal (captures "AXIOM AEGIS" white wordmark + metallic silver shield frame)
  // Background & outer blue haze have very low Red (r <= 32).
  const rDelta = r - bgR;
  const minRgDelta = Math.min(r, g) - bgR;
  const neutralMetric = Math.max(rDelta, minRgDelta * 1.15);
  // Smooth ramp from 20 (transparent background/haze) to 68 (opaque foreground)
  const whiteSilverAlpha = Math.max(0, Math.min(1, (neutralMetric - 20) / 48));

  // 2. Vibrant Electric Cyan / Azure Icon signal (captures the inner glowing shield & center chevron)
  // Background is (15, 22, 35) and outer ambient haze stays below (b < 128, g < 78).
  // The icon's cyan & azure facets have strong blue (b >= 130) and green (g >= 62).
  let cyanBlueAlpha = 0;
  if (b > 115 && g > 52) {
    const bScore = (b - 120) / 55;
    const gScore = (g - 55) / 45;
    const combinedCyan = Math.min(bScore, gScore * 1.15);
    cyanBlueAlpha = Math.max(0, Math.min(1, combinedCyan));
  }

  const alphaNorm = Math.max(whiteSilverAlpha, cyanBlueAlpha);

  if (alphaNorm <= 0.02) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  if (alphaNorm >= 0.98) {
    return { r, g, b, a: 255 };
  }

  // Un-premultiply the dark blue background from semi-transparent edge pixels
  // so white letters and silver borders have zero blue fringe.
  const outR = Math.min(255, Math.max(0, Math.round((r - bgR * (1 - alphaNorm)) / alphaNorm)));
  const outG = Math.min(255, Math.max(0, Math.round((g - bgG * (1 - alphaNorm)) / alphaNorm)));
  const outB = Math.min(255, Math.max(0, Math.round((b - bgB * (1 - alphaNorm)) / alphaNorm)));
  const outA = Math.min(255, Math.max(0, Math.round(alphaNorm * 255)));

  return { r: outR, g: outG, b: outB, a: outA };
}

/**
 * Processes an RGBA pixel buffer in-place, removing the dark blue background
 * and preserving only the Emblem Icon and "AXIOM AEGIS" Words.
 */
export function removeBlueBackgroundFromRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number
): Uint8ClampedArray {
  // Sample corner pixels to estimate baseline dark blue background if image is large enough
  let bgR = 15;
  let bgG = 22;
  let bgB = 35;

  if (width >= 4 && height >= 4 && data.length >= width * height * 4) {
    const sampleCoords = [
      [1, 1],
      [width - 2, 1],
      [1, height - 2],
      [width - 2, height - 2],
    ];
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    for (const [sx, sy] of sampleCoords) {
      const idx = (sy * width + sx) * 4;
      sumR += data[idx];
      sumG += data[idx + 1];
      sumB += data[idx + 2];
    }
    bgR = Math.round(sumR / sampleCoords.length);
    bgG = Math.round(sumG / sampleCoords.length);
    bgB = Math.round(sumB / sampleCoords.length);
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const px = computeEmblemForegroundPixel(r, g, b, bgR, bgG, bgB);
    data[i] = px.r;
    data[i + 1] = px.g;
    data[i + 2] = px.b;
    data[i + 3] = px.a;
  }

  return data;
}

const transparentDataUriCache = new Map<string, string>();
const inflightPromises = new Map<string, Promise<string>>();

/**
 * Loads a brand emblem image source in the browser, strips its blue background
 * on an offscreen canvas, and resolves to a cached transparent PNG data URI.
 */
export function getTransparentLogoDataUri(src: string): Promise<string> {
  if (!src || typeof document === 'undefined') {
    return Promise.resolve(src);
  }

  const cached = transparentDataUriCache.get(src);
  if (cached) {
    return Promise.resolve(cached);
  }

  const inflight = inflightPromises.get(src);
  if (inflight) {
    return inflight;
  }

  const promise = new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width || 256;
        const height = img.naturalHeight || img.height || 256;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        removeBlueBackgroundFromRgba(imageData.data, width, height);
        ctx.putImageData(imageData, 0, 0);
        const pngDataUri = canvas.toDataURL('image/png');
        transparentDataUriCache.set(src, pngDataUri);
        inflightPromises.delete(src);
        resolve(pngDataUri);
      } catch {
        inflightPromises.delete(src);
        resolve(src);
      }
    };
    img.onerror = () => {
      inflightPromises.delete(src);
      resolve(src);
    };
    img.src = src;
  });

  inflightPromises.set(src, promise);
  return promise;
}

/**
 * Synchronous lookup for already-cached transparent PNG data URI.
 */
export function getCachedTransparentLogoDataUri(src: string): string | undefined {
  return transparentDataUriCache.get(src);
}
