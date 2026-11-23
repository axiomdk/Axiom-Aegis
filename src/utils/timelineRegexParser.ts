import { TimelineOcrLeg, TimelineOcrResult } from '../services/timelineOcrService';

export interface ParsedLegItem {
  id: string;
  origin: string;
  destination: string;
  distance_miles: number;
  duration: string;
  raw_line?: string;
}

export interface ParsedTimelineOcrData {
  summary_distance_displayed: string;
  summary_miles: number | null;
  legs: TimelineOcrLeg[];
  total_distance_miles: number;
  raw_text: string;
  detected_unit: 'mi' | 'km';
}

/**
 * Regex to detect overall total summary in timeline headers, e.g.:
 * "Total driving: 42.6 mi"
 * "Total: 18.4 miles"
 * "Total distance: 25.1 mi"
 * "Summary: 42.6 mi"
 */
const SUMMARY_REGEX = /(?:total(?:\s+(?:driving|distance|trip|travel|walking|cycling))?|summary|day\s+total)[\s:•·\-|—]*([0-9]+(?:[.,][0-9]+)?)\s*(mi(?:les)?|km)\b/i;

/**
 * Regex to detect distance values in lines or text blocks.
 * Captures number and unit (mi, miles, km).
 */
const DISTANCE_PATTERN = /\b([0-9]+(?:[.,][0-9]+)?)\s*(mi(?:les)?|km)\b/i;

/**
 * Regex to detect duration like "26 min", "1 hr 15 mins", "45 mins", "1h 30m"
 */
const DURATION_PATTERN = /\b([0-9]+\s*(?:hr|hrs|hour|hours|h)?\s*[0-9]*\s*(?:min|mins|minute|minutes|m))\b/i;

/**
 * Cleans string removing OCR noise or bullet artifacts
 */
function cleanOcrText(text: string): string {
  return text
    .replace(/[•·|\-—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts a distance string/number with unit to miles (rounded to 1 decimal place).
 */
export function normalizeToMiles(amountStr: string, unitStr: string): number {
  const sanitized = amountStr.replace(',', '.');
  const num = parseFloat(sanitized);
  if (isNaN(num) || num <= 0) return 0;

  const isKm = /^km$/i.test(unitStr.trim());
  const miles = isKm ? num * 0.621371 : num;
  return Math.round(miles * 10) / 10;
}

/**
 * Recalculates total distance from legs list with strict 1 decimal place precision.
 */
export function recalculateTotalDistance(legs: TimelineOcrLeg[]): number {
  const sum = legs.reduce((acc, leg) => acc + (Number(leg.distance_miles) || 0), 0);
  return Math.round(sum * 10) / 10;
}

/**
 * Parses raw OCR text output into structured Google Maps Timeline trip legs and distance summaries.
 */
export function parseTimelineOcrText(rawText: string): ParsedTimelineOcrData {
  if (!rawText || !rawText.trim()) {
    return {
      summary_distance_displayed: '0 mi',
      summary_miles: null,
      legs: [],
      total_distance_miles: 0,
      raw_text: '',
      detected_unit: 'mi',
    };
  }

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let summaryMiles: number | null = null;
  let summaryDisplayed = '';
  let detectedUnit: 'mi' | 'km' = 'mi';
  let summaryLineIndex = -1;

  // 1. Scan for Total Driving / Overall Summary Header first
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(SUMMARY_REGEX);
    if (match) {
      const valStr = match[1];
      const unit = match[2].toLowerCase();
      detectedUnit = unit.startsWith('km') ? 'km' : 'mi';
      summaryMiles = normalizeToMiles(valStr, unit);
      summaryDisplayed = `${summaryMiles} mi`;
      summaryLineIndex = i;
      break;
    }
  }

  // 2. Scan remaining lines for individual legs/trips
  const detectedLegs: TimelineOcrLeg[] = [];
  const seenLegDistances: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    // Skip the line identified as total summary to prevent double counting
    if (i === summaryLineIndex) continue;

    const line = lines[i];

    // Filter out obvious false positives (e.g. speeds like "45 mph", percentages, battery levels)
    if (/mph\b|kph\b|km\/h\b|%/i.test(line)) {
      continue;
    }

    const distMatch = line.match(DISTANCE_PATTERN);
    if (!distMatch) continue;

    const valStr = distMatch[1];
    const unitStr = distMatch[2].toLowerCase();
    const miles = normalizeToMiles(valStr, unitStr);

    if (miles <= 0) continue;

    // Filter out if this line is an exact match to the summary miles and line says "total"
    if (summaryMiles !== null && Math.abs(miles - summaryMiles) < 0.05 && /total/i.test(line)) {
      continue;
    }

    // Extract duration if present in the line
    let durationStr = '15 mins';
    const durMatch = line.match(DURATION_PATTERN);
    if (durMatch) {
      durationStr = cleanOcrText(durMatch[1]);
    } else if (i + 1 < lines.length && DURATION_PATTERN.test(lines[i + 1])) {
      const nextDurMatch = lines[i + 1].match(DURATION_PATTERN);
      if (nextDurMatch) {
        durationStr = cleanOcrText(nextDurMatch[1]);
      }
    }

    // Determine Origin and Destination from surrounding context lines
    let origin = 'Waypoint';
    let destination = 'Stop';

    // Check preceding line (often the starting stop or place name)
    const prevLine = i > 0 ? lines[i - 1] : '';
    const nextLine = i + 1 < lines.length ? lines[i + 1] : '';

    const cleanPrev = cleanOcrText(prevLine);
    const cleanNext = cleanOcrText(nextLine);

    // If line itself has an arrow or separator (e.g. "Home -> Office · 12 mi")
    if (line.includes('->') || line.includes('→') || line.includes(' to ')) {
      const parts = line.split(/(?:->|→|\bto\b)/i);
      if (parts.length >= 2) {
        origin = cleanOcrText(parts[0].replace(DISTANCE_PATTERN, ''));
        destination = cleanOcrText(parts[1].replace(DISTANCE_PATTERN, '').replace(DURATION_PATTERN, ''));
      }
    } else if (cleanPrev && !DISTANCE_PATTERN.test(cleanPrev) && !/total/i.test(cleanPrev) && cleanPrev.length > 2) {
      // Use previous line as origin or destination
      origin = cleanPrev;
      if (cleanNext && !DISTANCE_PATTERN.test(cleanNext) && !DURATION_PATTERN.test(cleanNext) && cleanNext.length > 2) {
        destination = cleanNext;
      } else {
        destination = `Destination (${miles} mi)`;
      }
    } else if (cleanNext && !DISTANCE_PATTERN.test(cleanNext) && !DURATION_PATTERN.test(cleanNext) && cleanNext.length > 2) {
      destination = cleanNext;
      origin = `Origin Leg ${detectedLegs.length + 1}`;
    } else {
      origin = `Stop ${detectedLegs.length + 1}`;
      destination = `Stop ${detectedLegs.length + 2}`;
    }

    // Clean up origin/dest names
    if (!origin || origin.length < 2) origin = `Leg ${detectedLegs.length + 1} Origin`;
    if (!destination || destination.length < 2) destination = `Leg ${detectedLegs.length + 1} Destination`;

    // Truncate extreme length strings if OCR merged paragraphs
    if (origin.length > 60) origin = origin.slice(0, 57) + '...';
    if (destination.length > 60) destination = destination.slice(0, 57) + '...';

    const legId = `ocr-leg-${Date.now()}-${detectedLegs.length}-${Math.random().toString(36).substring(2, 6)}`;

    detectedLegs.push({
      id: legId,
      origin,
      destination,
      distance_miles: miles,
      duration: durationStr,
    });
    seenLegDistances.push(miles);
  }

  // Calculate final total distance
  let finalTotalMiles = 0;
  if (detectedLegs.length > 0) {
    finalTotalMiles = recalculateTotalDistance(detectedLegs);
  } else if (summaryMiles !== null && summaryMiles > 0) {
    finalTotalMiles = summaryMiles;
  }

  if (!summaryDisplayed && finalTotalMiles > 0) {
    summaryDisplayed = `${finalTotalMiles} mi`;
  }

  return {
    summary_distance_displayed: summaryDisplayed || '0 mi',
    summary_miles: summaryMiles,
    legs: detectedLegs,
    total_distance_miles: finalTotalMiles,
    raw_text: rawText,
    detected_unit: detectedUnit,
  };
}
