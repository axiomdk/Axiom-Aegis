import { runLocalOcr, OcrProgressInfo } from '../utils/localOcrEngine';
import { parseTimelineOcrText } from '../utils/timelineRegexParser';

export interface TimelineOcrLeg {
  id?: string;
  origin: string;
  destination: string;
  distance_miles: number;
  duration: string;
}

export interface TimelineOcrResult {
  total_distance_miles: number;
  summary_distance_displayed: string;
  legs: TimelineOcrLeg[];
  raw_text?: string;
  confidence?: number;
}

/**
 * Converts a browser File or Blob object into a base64 encoded string with its MIME type.
 */
export function convertFileToBase64(file: File | Blob): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const match = result.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        resolve({
          mimeType: match[1],
          base64: match[2],
        });
      } else {
        // Fallback if no data URL header
        resolve({
          mimeType: file.type || 'image/png',
          base64: result.replace(/^data:[^;]+;base64,/, ''),
        });
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

/**
 * 100% Client-Side Local OCR Scanner:
 * Uses Tesseract.js directly inside the user's browser with offscreen canvas auto-contrast
 * preprocessing and regex distance extraction. Eliminates 503 server overload errors completely.
 */
export async function analyzeTimelineScreenshot(
  imageInput: File | Blob | string,
  onProgress?: (progress: number, status: string) => void
): Promise<TimelineOcrResult> {
  // Convert raw base64 string to data URL if passed without scheme
  let formattedInput: File | Blob | string = imageInput;
  if (typeof imageInput === 'string' && !imageInput.startsWith('data:') && !imageInput.startsWith('blob:') && !imageInput.startsWith('http')) {
    formattedInput = `data:image/png;base64,${imageInput}`;
  }

  // Run local OCR
  const ocrOutput = await runLocalOcr(formattedInput, (info: OcrProgressInfo) => {
    if (onProgress) {
      onProgress(info.progress, info.status);
    }
  });

  const parsed = parseTimelineOcrText(ocrOutput.text);

  return {
    total_distance_miles: parsed.total_distance_miles,
    summary_distance_displayed: parsed.summary_distance_displayed,
    legs: parsed.legs,
    raw_text: ocrOutput.text,
    confidence: ocrOutput.confidence,
  };
}

/**
 * Sample simulated OCR data for zero-cost offline preview.
 */
export function getSampleTimelineOcrResult(): TimelineOcrResult {
  return {
    total_distance_miles: 42.6,
    summary_distance_displayed: '42.6 mi',
    legs: [
      {
        id: 'leg-sample-1',
        origin: 'Residence / Home Base',
        destination: 'Engineering Hub & Innovation Lab',
        distance_miles: 14.2,
        duration: '26 mins',
      },
      {
        id: 'leg-sample-2',
        origin: 'Engineering Hub & Innovation Lab',
        destination: 'Regional Park Trailhead',
        distance_miles: 6.8,
        duration: '14 mins',
      },
      {
        id: 'leg-sample-3',
        origin: 'Regional Park Trailhead',
        destination: 'Organic Market & Provisions',
        distance_miles: 8.5,
        duration: '18 mins',
      },
      {
        id: 'leg-sample-4',
        origin: 'Organic Market & Provisions',
        destination: 'Residence / Home Base',
        distance_miles: 13.1,
        duration: '25 mins',
      },
    ],
    raw_text: `Google Maps Timeline\nThursday, Oct 22\nTotal driving: 42.6 mi · 1 hr 23 min\n\nResidence / Home Base\nDriving · 14.2 mi · 26 min\nEngineering Hub & Innovation Lab\n\nEngineering Hub & Innovation Lab\nDriving · 6.8 mi · 14 min\nRegional Park Trailhead\n\nRegional Park Trailhead\nDriving · 8.5 mi · 18 min\nOrganic Market & Provisions\n\nOrganic Market & Provisions\nDriving · 13.1 mi · 25 min\nResidence / Home Base`,
    confidence: 96,
  };
}
