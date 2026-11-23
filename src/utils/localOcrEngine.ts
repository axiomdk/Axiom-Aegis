import { createWorker } from 'tesseract.js';

export interface OcrProgressInfo {
  progress: number; // 0 to 1
  status: string;
}

export type OcrProgressCallback = (info: OcrProgressInfo) => void;

export interface LocalOcrResult {
  text: string;
  confidence: number;
}

/**
 * Preprocesses an image via offscreen Canvas to maximize OCR character contrast.
 * Converts to grayscale, stretches dynamic range, and boosts contrast so faint text
 * on map tiles or dark-mode themes is sharply legible for Tesseract.
 */
export async function preprocessImageForOcr(
  imageSource: File | Blob | string
): Promise<string> {
  // If not running in a browser with Canvas support, return source string if string
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return typeof imageSource === 'string' ? imageSource : '';
  }

  return new Promise<string>((resolve, reject) => {
    let objectUrl: string | null = null;
    let srcUrl = '';

    if (typeof imageSource === 'string') {
      srcUrl = imageSource;
    } else {
      objectUrl = URL.createObjectURL(imageSource);
      srcUrl = objectUrl;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          resolve(srcUrl);
          return;
        }

        // Limit maximum dimension to 2400px to maintain crispness without exceeding memory
        let width = img.width;
        let height = img.height;
        const maxDim = 2400;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Pass 1: Find min and max luminance for auto-stretch
        let minLum = 255;
        let maxLum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          if (lum < minLum) minLum = lum;
          if (lum > maxLum) maxLum = lum;
        }

        const lumRange = Math.max(maxLum - minLum, 1);

        // Pass 2: High contrast auto-stretch and sharpening
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;

          // Normalized 0 to 1
          let stretched = (lum - minLum) / lumRange;

          // Contrast S-curve boost (enhances text separation from gradients)
          stretched = stretched < 0.5
            ? 2 * stretched * stretched
            : 1 - 2 * (1 - stretched) * (1 - stretched);

          const finalVal = Math.min(255, Math.max(0, Math.round(stretched * 255)));

          data[i] = finalVal;     // R
          data[i + 1] = finalVal; // G
          data[i + 2] = finalVal; // B
          // Alpha remains untouched
        }

        ctx.putImageData(imgData, 0, 0);
        const processedDataUrl = canvas.toDataURL('image/png');

        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve(processedDataUrl);
      } catch (err) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        // Fall back to original image on any processing error
        resolve(srcUrl);
      }
    };

    img.onerror = (err) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for OCR preprocessing'));
    };

    img.src = srcUrl;
  });
}

/**
 * Runs 100% client-side OCR using Tesseract.js in the browser.
 * Provides granular progress percentage (0-100%) and status tracking.
 */
export async function runLocalOcr(
  imageInput: File | Blob | string,
  onProgress?: OcrProgressCallback
): Promise<LocalOcrResult> {
  // Step 1: Preprocess with auto-contrast canvas enhancement
  let processedSource: string = '';
  try {
    if (onProgress) {
      onProgress({ progress: 0.05, status: 'Enhancing image contrast...' });
    }
    processedSource = await preprocessImageForOcr(imageInput);
  } catch (err) {
    console.warn('Auto-contrast preprocessing failed, proceeding with raw image input', err);
    if (typeof imageInput === 'string') {
      processedSource = imageInput;
    } else {
      processedSource = URL.createObjectURL(imageInput);
    }
  }

  // Step 2: Initialize Tesseract worker
  let worker: any = null;
  try {
    if (onProgress) {
      onProgress({ progress: 0.15, status: 'Initializing OCR engine...' });
    }

    worker = await createWorker('eng', 1, {
      logger: (m: any) => {
        if (!onProgress) return;
        const progressRaw = typeof m.progress === 'number' ? m.progress : 0;
        // Scale Tesseract recognition progress between 15% and 95%
        const scaledProgress = 0.15 + progressRaw * 0.8;
        const statusMsg = m.status === 'recognizing text'
          ? `Scanning screenshot (${Math.round(progressRaw * 100)}%)...`
          : (m.status || 'Processing...');
        onProgress({ progress: scaledProgress, status: statusMsg });
      },
    });

    if (onProgress) {
      onProgress({ progress: 0.2, status: 'Scanning screenshot text...' });
    }

    // Step 3: Recognize text
    const result = await worker.recognize(processedSource);

    if (onProgress) {
      onProgress({ progress: 1.0, status: 'Parsing detected mileage...' });
    }

    const text = result.data?.text || '';
    const confidence = typeof result.data?.confidence === 'number' ? result.data.confidence : 80;

    return {
      text,
      confidence,
    };
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {
        // Safe terminate ignore
      }
    }
  }
}
