/**
 * Formats a Date, timestamp, or YYYY-MM-DD string into Axiom Aegis's date-based
 * `vYY.MM.DD` version string (e.g., 2026-11-02 -> 'v26.11.2', 2026-11-03 -> 'v26.11.3', 2026-11-20 -> 'v26.11.20').
 */
export function formatDateBasedVersion(
  dateInput: Date | number | string = '2026-11-20',
  includePrefix = true,
  twoDigitDay?: boolean
): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dateInput.trim())) {
    const [yyyyStr, mmStr, ddStr] = dateInput.trim().split('-');
    const yy = Number(yyyyStr) % 100;
    const mm = Number(mmStr);
    const numDd = Number(ddStr);
    const iso = `${String(Number(yyyyStr)).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(numDd).padStart(2, '0')}`;
    const pad = twoDigitDay ?? (iso >= '2026-11-04');
    const dd = pad ? String(numDd).padStart(2, '0') : String(numDd);
    return `${includePrefix ? 'v' : ''}${yy}.${mm}.${dd}`;
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    return `${includePrefix ? 'v' : ''}26.11.20`;
  }
  const yy = d.getFullYear() % 100;
  const mm = d.getMonth() + 1;
  const numDd = d.getDate();
  const iso = toIsoDateString(d);
  const pad = twoDigitDay ?? (iso >= '2026-11-04');
  const dd = pad ? String(numDd).padStart(2, '0') : String(numDd);
  return `${includePrefix ? 'v' : ''}${yy}.${mm}.${dd}`;
}

/**
 * Computes the next calendar day's version string in `vYY.MM.DD` format
 * (e.g., '2026-11-03' -> 'v26.11.04', '2026-11-04' -> 'v26.11.05').
 */
export function getNextDayVersion(
  dateInput: Date | number | string = '2026-11-20',
  includePrefix = true,
  twoDigitDay?: boolean
): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dateInput.trim())) {
    const [yyyyStr, mmStr, ddStr] = dateInput.trim().split('-');
    const utcDate = new Date(Date.UTC(Number(yyyyStr), Number(mmStr) - 1, Number(ddStr) + 1));
    const nextIso = toIsoDateString(utcDate);
    return formatDateBasedVersion(nextIso, includePrefix, twoDigitDay);
  }
  const base = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput);
  base.setDate(base.getDate() + 1);
  return formatDateBasedVersion(base, includePrefix, twoDigitDay);
}

export const INITIAL_EPOCH_RELEASE_DATE = '2026-11-02';
export const LATEST_CHANGE_RELEASE_DATE = '2026-11-20';
export const HAS_RELEASE_CHANGES_OR_ADDITIONS = true;

/**
 * Normalizes a Date, timestamp, or date string into an ISO `YYYY-MM-DD` string.
 */
export function toIsoDateString(dateInput: Date | number | string): string {
  if (typeof dateInput === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(dateInput.trim())) {
    const [yyyyStr, mmStr, ddStr] = dateInput.trim().split('-');
    const yyyy = String(Number(yyyyStr)).padStart(4, '0');
    const mm = String(Number(mmStr)).padStart(2, '0');
    const dd = String(Number(ddStr)).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) {
    return INITIAL_EPOCH_RELEASE_DATE;
  }
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Resolves the active release date in `YYYY-MM-DD` format.
 * Advances from `baseReleaseDate` to `candidateDate` IF AND ONLY IF `hasChangesOrAdditions` is true
 * and `candidateDate` is on or after `baseReleaseDate`.
 */
export function resolveReleaseDateWithChanges(
  baseReleaseDate: Date | number | string = INITIAL_EPOCH_RELEASE_DATE,
  candidateDate: Date | number | string = LATEST_CHANGE_RELEASE_DATE,
  hasChangesOrAdditions = true
): string {
  const baseIso = toIsoDateString(baseReleaseDate);
  if (!hasChangesOrAdditions) {
    return baseIso;
  }
  const candidateIso = toIsoDateString(candidateDate);
  return candidateIso >= baseIso ? candidateIso : baseIso;
}

/**
 * Computes the date-based `vYY.M.D` version string, advancing the version date
 * only when `hasChangesOrAdditions` is true.
 */
export function resolveVersionWithDateOnChanges(
  baseReleaseDate: Date | number | string = INITIAL_EPOCH_RELEASE_DATE,
  candidateDate: Date | number | string = LATEST_CHANGE_RELEASE_DATE,
  hasChangesOrAdditions = true,
  includePrefix = true
): string {
  const effectiveDate = resolveReleaseDateWithChanges(
    baseReleaseDate,
    candidateDate,
    hasChangesOrAdditions
  );
  return formatDateBasedVersion(effectiveDate, includePrefix);
}

export const CURRENT_RELEASE_DATE = resolveReleaseDateWithChanges(
  INITIAL_EPOCH_RELEASE_DATE,
  LATEST_CHANGE_RELEASE_DATE,
  HAS_RELEASE_CHANGES_OR_ADDITIONS
);
export const APP_VERSION = formatDateBasedVersion(CURRENT_RELEASE_DATE);
export const APP_VERSION_BARE = formatDateBasedVersion(CURRENT_RELEASE_DATE, false);
export const APP_FULL_NAME = 'Axiom Aegis';
export const APP_SHORT_NAME = 'AA';
export const APP_BUILD_TIMESTAMP = Date.now();

/**
 * Scrubs any legacy semantic version strings (e.g. v1.x.x BETA / ALPHA) from HTML or text
 * and replaces them with the active YY.MM.DD version (APP_VERSION).
 */
export function sanitizeLegacyVersionStrings(input: string): string {
  if (typeof input !== 'string' || !input) return '';
  return input.replace(/\bv1\.\d+\.\d+(?:\s*(?:BETA|ALPHA))?\b/gi, APP_VERSION);
}

/**
 * Format the most recent update time cleanly for display in badges and watermarks
 */
export function formatLastUpdated(timestamp?: number | null): string {
  if (!timestamp) {
    return 'Synced';
  }

  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);

  // Under 45 seconds
  if (diffMs < 45 * 1000) {
    return 'Just now';
  }

  // Under 1 hour
  if (diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    return `${mins}m ago`;
  }

  const d = new Date(timestamp);
  const today = new Date();
  const isSameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();

  const timeStr = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isSameDay) {
    return `Today at ${timeStr}`;
  }

  const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${dateStr}, ${timeStr}`;
}

/**
 * Format the exact full date/time string for tooltips
 */
export function formatExactTime(timestamp?: number | null): string {
  if (!timestamp) return 'No local modifications yet';
  return new Date(timestamp).toLocaleString();
}
