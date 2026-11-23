import { FrequentEvent, TimelineCategory, TimelineEntry } from '../types';
import { calculateDurationMinutes } from './calculations';
import { sanitizeTextInput } from './matrixLayoutEngine';

/**
 * Computes HH:mm end time given a start time ('HH:mm') and duration in minutes.
 */
export function computeEndTimeFromDuration(startTime: string, durationMinutes: number): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec((startTime || '').trim());
  const sh = match ? Math.min(23, Math.max(0, parseInt(match[1], 10))) : 9;
  const sm = match ? Math.min(59, Math.max(0, parseInt(match[2], 10))) : 0;
  const dur = Math.max(5, Math.min(720, Math.round(Number(durationMinutes) || 60)));
  const endTotal = (sh * 60 + sm + dur) % 1440;
  const eh = String(Math.floor(endTotal / 60)).padStart(2, '0');
  const em = String(endTotal % 60).padStart(2, '0');
  return `${eh}:${em}`;
}

/**
 * Filters frequent event templates by search query (matching title, category, or notes)
 * and optional category filter.
 */
export function filterFrequentEvents(
  events: FrequentEvent[],
  searchQuery: string = '',
  categoryFilter: string = 'all'
): FrequentEvent[] {
  if (!Array.isArray(events)) return [];
  const q = searchQuery.trim().toLowerCase();
  const cat = categoryFilter.trim().toLowerCase();

  return events.filter((fe) => {
    if (!fe || typeof fe.title !== 'string') return false;
    if (cat && cat !== 'all' && (fe.category || '').toLowerCase() !== cat) {
      return false;
    }
    if (!q) return true;
    const titleMatch = fe.title.toLowerCase().includes(q);
    const catMatch = (fe.category || '').toLowerCase().includes(q);
    const notesMatch = (fe.notes || '').toLowerCase().includes(q);
    return titleMatch || catMatch || notesMatch;
  });
}

/**
 * Creates a sanitized TimelineEntry from a FrequentEvent template for 1-click instant logging.
 */
export function createTimelineEntryFromFrequentEvent(
  fe: FrequentEvent,
  referenceDate: Date = new Date()
): TimelineEntry {
  const todayStr = referenceDate.toISOString().split('T')[0];
  const curH = String(referenceDate.getHours()).padStart(2, '0');
  const curM = String(referenceDate.getMinutes()).padStart(2, '0');

  const rawStart =
    typeof fe.startTime === 'string' && /^\d{2}:\d{2}$/.test(fe.startTime.trim())
      ? fe.startTime.trim()
      : `${curH}:${curM}`;

  const duration = Math.max(
    5,
    Math.min(720, Math.round(Number(fe.durationMinutes) || 60))
  );

  const endStr =
    typeof fe.endTime === 'string' && /^\d{2}:\d{2}$/.test(fe.endTime.trim()) && fe.startTime
      ? fe.endTime.trim()
      : computeEndTimeFromDuration(rawStart, duration);

  const finalDuration = duration || calculateDurationMinutes(rawStart, endStr);

  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: sanitizeTextInput(fe.title, 'Quick Activity', 120),
    category: sanitizeTextInput(fe.category, 'work', 48) as TimelineCategory,
    date: todayStr,
    startTime: rawStart,
    endTime: endStr,
    durationMinutes: finalDuration,
    notes: fe.notes ? sanitizeTextInput(fe.notes, '', 300) : undefined,
    customFields: {},
    createdAt: Date.now(),
  };
}

export interface UpsertFrequentEventInput {
  id?: string;
  title: string;
  category?: TimelineCategory;
  durationMinutes?: number;
  startTime?: string;
  notes?: string;
}

/**
 * Creates or updates a FrequentEvent template with strict sanitization.
 */
export function upsertFrequentEventTemplate(
  events: FrequentEvent[],
  input: UpsertFrequentEventInput
): { item: FrequentEvent; nextEvents: FrequentEvent[] } | null {
  const cleanTitle = sanitizeTextInput(input.title, '', 100);
  if (!cleanTitle) return null;

  const cleanCategory = sanitizeTextInput(input.category || 'work', 'work', 48);
  const durationMinutes = Math.max(
    5,
    Math.min(720, Math.round(Number(input.durationMinutes) || 60))
  );

  const hasValidStart =
    typeof input.startTime === 'string' && /^\d{2}:\d{2}$/.test(input.startTime.trim());
  const startTime = hasValidStart ? input.startTime!.trim() : '09:00';
  const endTime = computeEndTimeFromDuration(startTime, durationMinutes);
  const cleanNotes = input.notes ? sanitizeTextInput(input.notes, '', 240) : undefined;

  const safeList = Array.isArray(events) ? events : [];
  const existingIdx = input.id ? safeList.findIndex((e) => e.id === input.id) : -1;

  const item: FrequentEvent = {
    id: existingIdx >= 0 ? safeList[existingIdx].id : `fe-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    title: cleanTitle,
    category: cleanCategory,
    durationMinutes,
    startTime,
    endTime,
    notes: cleanNotes || undefined,
  };

  const nextEvents =
    existingIdx >= 0
      ? safeList.map((e, i) => (i === existingIdx ? item : e))
      : [item, ...safeList];

  return { item, nextEvents };
}

/**
 * Reorders a frequent event template up or down in the list.
 */
export function moveFrequentEventTemplate(
  events: FrequentEvent[],
  index: number,
  direction: 'up' | 'down'
): FrequentEvent[] {
  if (!Array.isArray(events) || index < 0 || index >= events.length) return events || [];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= events.length) return events;
  const next = [...events];
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}
