import {
  AppData,
  DailyNoteEntry,
  DistanceEntry,
  FrequentEvent,
  FundEntry,
  GoalEntry,
  TimelineCategory,
  TimelineEntry,
} from '../types';
import { calculateDurationMinutes } from './calculations';
import { sanitizeTextInput } from './matrixLayoutEngine';
import { computeEndTimeFromDuration } from './frequentEventsEngine';

export interface CalendarSpanSegment {
  segmentId: string;
  entry: TimelineEntry;
  date: string; // YYYY-MM-DD for this specific day cell
  originDate: string; // Original entry.date
  startMinute: number; // 0..1440 within this date
  endMinute: number; // 0..1440 within this date
  segmentDurationMinutes: number;
  displayStartTime: string; // HH:mm
  displayEndTime: string; // HH:mm
  isMultiDay: boolean;
  spanPosition: 'single' | 'start' | 'middle' | 'end';
  spanDayIndex: number; // 1-based (e.g. Day 1 of 3)
  spanTotalDays: number; // Total days spanned
}

export interface CalendarOverlayToggles {
  showNotes: boolean;
  showGoals: boolean;
  showFunds: boolean;
  showDistances: boolean;
}

export interface CalendarDayCellData {
  date: string; // YYYY-MM-DD
  dayOfMonth: number;
  monthOffset: -1 | 0 | 1; // -1 = prev month, 0 = current month, 1 = next month
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  segments: CalendarSpanSegment[];
  totalFocusMinutes: number;
  notes: DailyNoteEntry[];
  goalsDue: GoalEntry[];
  funds: FundEntry[];
  netFundsAmount: number;
  incomeAmount: number;
  expenseAmount: number;
  distances: DistanceEntry[];
  totalDistanceMiles: number;
}

export interface VisualFlowBlock {
  segmentId: string;
  entryId: string;
  title: string;
  category: TimelineCategory;
  leftPercent: number;
  widthPercent: number;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  displayTimeRange: string;
  isMultiDay: boolean;
  spanPosition: 'single' | 'start' | 'middle' | 'end';
  spanDayIndex: number;
  spanTotalDays: number;
  isOverlapping: boolean;
}

export const DEFAULT_CALENDAR_OVERLAYS: CalendarOverlayToggles = {
  showNotes: true,
  showGoals: true,
  showFunds: true,
  showDistances: true,
};

/**
 * Parses 'HH:mm' string into minutes from 00:00 (0..1439).
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
  if (!match) return 0;
  const h = Math.min(23, Math.max(0, parseInt(match[1], 10) || 0));
  const m = Math.min(59, Math.max(0, parseInt(match[2], 10) || 0));
  return h * 60 + m;
}

/**
 * Formats minutes (0..1440) into 'HH:mm' tabular string.
 */
export function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(1440, Math.round(totalMinutes)));
  if (clamped === 1440) return '24:00';
  const h = String(Math.floor(clamped / 60)).padStart(2, '0');
  const m = String(clamped % 60).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Adds `days` to a YYYY-MM-DD date string using UTC noon to avoid DST drift.
 */
export function addDaysToIsoDate(isoDate: string, days: number): string {
  const clean = /^\d{4}-\d{2}-\d{2}$/.test((isoDate || '').trim())
    ? isoDate.trim()
    : new Date().toISOString().slice(0, 10);
  const base = new Date(`${clean}T12:00:00Z`);
  if (isNaN(base.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  const shifted = new Date(base.getTime() + days * 86400000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Expands a single TimelineEntry into 1 or more daily CalendarSpanSegments.
 * Handles overnight activities (endTime < startTime) and multi-day / >24h activities
 * (e.g. long trips logged via Timeline Screenshot OCR with durationMinutes > 1440).
 */
export function expandTimelineEntryToDailySegments(entry: TimelineEntry): CalendarSpanSegment[] {
  if (!entry || typeof entry.date !== 'string') return [];

  const startMin = parseTimeToMinutes(entry.startTime || '09:00');
  const computedDur = calculateDurationMinutes(entry.startTime || '09:00', entry.endTime || '10:00');
  const rawDuration =
    typeof entry.durationMinutes === 'number' && entry.durationMinutes > 0
      ? Math.round(entry.durationMinutes)
      : computedDur > 0
      ? computedDur
      : 60;

  // Cap at 30 days max to guard against malformed astronomical numbers
  const totalDuration = Math.min(rawDuration, 30 * 1440);
  const endAbsoluteMin = startMin + totalDuration;
  const totalSpanDays = Math.max(1, Math.ceil(endAbsoluteMin / 1440));
  const isMultiDay = totalSpanDays > 1;

  const segments: CalendarSpanSegment[] = [];

  for (let dayIdx = 0; dayIdx < totalSpanDays; dayIdx++) {
    const segDate = addDaysToIsoDate(entry.date, dayIdx);
    const segStart = dayIdx === 0 ? startMin : 0;
    const segEnd = Math.min(1440, endAbsoluteMin - dayIdx * 1440);
    const segDuration = Math.max(0, segEnd - segStart);
    if (segDuration <= 0 && totalSpanDays > 1) continue;

    let spanPosition: 'single' | 'start' | 'middle' | 'end' = 'single';
    if (isMultiDay) {
      if (dayIdx === 0) spanPosition = 'start';
      else if (dayIdx === totalSpanDays - 1) spanPosition = 'end';
      else spanPosition = 'middle';
    }

    segments.push({
      segmentId: `${entry.id}__day_${dayIdx}`,
      entry,
      date: segDate,
      originDate: entry.date,
      startMinute: segStart,
      endMinute: segEnd,
      segmentDurationMinutes: segDuration || totalDuration,
      displayStartTime: minutesToTimeString(segStart),
      displayEndTime:
        dayIdx === totalSpanDays - 1 && !isMultiDay
          ? entry.endTime || minutesToTimeString(segEnd)
          : minutesToTimeString(segEnd),
      isMultiDay,
      spanPosition,
      spanDayIndex: dayIdx + 1,
      spanTotalDays: totalSpanDays,
    });
  }

  return segments;
}

/**
 * Expands all timeline entries (optionally filtered by category) into a date-keyed Map of segments.
 */
export function buildDailySegmentsMap(
  timeline: TimelineEntry[],
  categoryFilter: string = 'all'
): Map<string, CalendarSpanSegment[]> {
  const map = new Map<string, CalendarSpanSegment[]>();
  if (!Array.isArray(timeline)) return map;

  const normalizedFilter = (categoryFilter || 'all').trim().toLowerCase();

  for (const entry of timeline) {
    if (!entry || typeof entry.id !== 'string') continue;
    if (
      normalizedFilter !== 'all' &&
      (entry.category || '').toLowerCase() !== normalizedFilter
    ) {
      continue;
    }

    const segments = expandTimelineEntryToDailySegments(entry);
    for (const seg of segments) {
      const list = map.get(seg.date) || [];
      list.push(seg);
      map.set(seg.date, list);
    }
  }

  // Sort each day's segments chronologically (multi-day continuations first, then by startMinute)
  for (const [dateKey, list] of map.entries()) {
    list.sort((a, b) => {
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      return b.segmentDurationMinutes - a.segmentDurationMinutes;
    });
    map.set(dateKey, list);
  }

  return map;
}

/**
 * Generates the 42-day (6-week) calendar grid for a given year and 0-indexed month (0 = Jan .. 11 = Dec),
 * enriched with two-way synced Timeline segments and cross-module data overlays.
 */
export function buildCalendarMonthGrid(
  year: number,
  month: number,
  appData: AppData | null | undefined,
  categoryFilter: string = 'all',
  overlays: CalendarOverlayToggles = DEFAULT_CALENDAR_OVERLAYS,
  todayIso?: string
): CalendarDayCellData[] {
  const currentToday = todayIso || new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const startDayOfWeek = firstOfMonth.getUTCDay(); // 0 (Sun) .. 6 (Sat)
  const gridStartDate = new Date(firstOfMonth.getTime() - startDayOfWeek * 86400000);

  const timeline = appData?.timeline || [];
  const dailyNotes = overlays.showNotes ? appData?.dailyNotes || [] : [];
  const goals = overlays.showGoals ? appData?.goals || [] : [];
  const funds = overlays.showFunds ? appData?.funds || [] : [];
  const distances = overlays.showDistances ? appData?.distances || [] : [];

  const segmentsMap = buildDailySegmentsMap(timeline, categoryFilter);

  const notesByDate = new Map<string, DailyNoteEntry[]>();
  for (const note of dailyNotes) {
    if (!note?.date) continue;
    const list = notesByDate.get(note.date) || [];
    list.push(note);
    notesByDate.set(note.date, list);
  }

  const goalsByDate = new Map<string, GoalEntry[]>();
  for (const goal of goals) {
    if (!goal?.targetDate) continue;
    const list = goalsByDate.get(goal.targetDate) || [];
    list.push(goal);
    goalsByDate.set(goal.targetDate, list);
  }

  const fundsByDate = new Map<string, FundEntry[]>();
  for (const fund of funds) {
    if (!fund?.date) continue;
    const list = fundsByDate.get(fund.date) || [];
    list.push(fund);
    fundsByDate.set(fund.date, list);
  }

  const distancesByDate = new Map<string, DistanceEntry[]>();
  for (const dist of distances) {
    if (!dist?.date) continue;
    const list = distancesByDate.get(dist.date) || [];
    list.push(dist);
    distancesByDate.set(dist.date, list);
  }

  const cells: CalendarDayCellData[] = [];

  for (let i = 0; i < 42; i++) {
    const cellDateObj = new Date(gridStartDate.getTime() + i * 86400000);
    const isoDate = cellDateObj.toISOString().slice(0, 10);
    const cellYear = cellDateObj.getUTCFullYear();
    const cellMonth = cellDateObj.getUTCMonth();
    const dayOfMonth = cellDateObj.getUTCDate();
    const dayOfWeek = cellDateObj.getUTCDay();

    let monthOffset: -1 | 0 | 1 = 0;
    if (cellYear < year || (cellYear === year && cellMonth < month)) {
      monthOffset = -1;
    } else if (cellYear > year || (cellYear === year && cellMonth > month)) {
      monthOffset = 1;
    }

    const daySegments = segmentsMap.get(isoDate) || [];
    const totalFocusMinutes = daySegments.reduce(
      (sum, seg) => sum + (seg.segmentDurationMinutes || 0),
      0
    );

    const dayFunds = fundsByDate.get(isoDate) || [];
    let incomeAmount = 0;
    let expenseAmount = 0;
    for (const f of dayFunds) {
      if (f.type === 'income') incomeAmount += f.amount;
      else expenseAmount += f.amount;
    }
    const netFundsAmount = Math.round((incomeAmount - expenseAmount) * 100) / 100;

    const dayDistances = distancesByDate.get(isoDate) || [];
    const totalDistanceMiles =
      Math.round(
        dayDistances.reduce(
          (sum, d) => sum + (d.unit === 'km' ? d.distance * 0.621371 : d.distance),
          0
        ) * 100
      ) / 100;

    cells.push({
      date: isoDate,
      dayOfMonth,
      monthOffset,
      isCurrentMonth: monthOffset === 0,
      isToday: isoDate === currentToday,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      segments: daySegments,
      totalFocusMinutes,
      notes: notesByDate.get(isoDate) || [],
      goalsDue: goalsByDate.get(isoDate) || [],
      funds: dayFunds,
      netFundsAmount,
      incomeAmount: Math.round(incomeAmount * 100) / 100,
      expenseAmount: Math.round(expenseAmount * 100) / 100,
      distances: dayDistances,
      totalDistanceMiles,
    });
  }

  return cells;
}

/**
 * Builds detailed CalendarDayCellData for any single YYYY-MM-DD date (used by the Day Inspector Drawer
 * even if the user selects a date outside the current month grid).
 */
export function getCalendarDayInspectorData(
  isoDate: string,
  appData: AppData | null | undefined,
  categoryFilter: string = 'all',
  overlays: CalendarOverlayToggles = DEFAULT_CALENDAR_OVERLAYS,
  todayIso?: string
): CalendarDayCellData {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test((isoDate || '').trim())
    ? isoDate.trim()
    : new Date().toISOString().slice(0, 10);
  const dObj = new Date(`${cleanDate}T12:00:00Z`);
  const year = dObj.getUTCFullYear();
  const month = dObj.getUTCMonth();

  const grid = buildCalendarMonthGrid(year, month, appData, categoryFilter, overlays, todayIso);
  const match = grid.find((c) => c.date === cleanDate);
  if (match) return match;

  return {
    date: cleanDate,
    dayOfMonth: dObj.getUTCDate() || 1,
    monthOffset: 0,
    isCurrentMonth: true,
    isToday: cleanDate === (todayIso || new Date().toISOString().slice(0, 10)),
    isWeekend: dObj.getUTCDay() === 0 || dObj.getUTCDay() === 6,
    segments: [],
    totalFocusMinutes: 0,
    notes: [],
    goalsDue: [],
    funds: [],
    netFundsAmount: 0,
    incomeAmount: 0,
    expenseAmount: 0,
    distances: [],
    totalDistanceMiles: 0,
  };
}

/**
 * Computes 24-Hour Visual Flow Bar blocks (00:00 - 24:00) for a given day's segments.
 */
export function computeDayVisualFlowBlocks(segments: CalendarSpanSegment[]): VisualFlowBlock[] {
  if (!Array.isArray(segments) || segments.length === 0) return [];

  return segments.map((seg, index) => {
    const startMin = Math.max(0, Math.min(1440, seg.startMinute));
    const durMin = Math.max(1, Math.min(1440 - startMin, seg.segmentDurationMinutes));
    const endMin = startMin + durMin;
    const leftPercent = Math.round((startMin / 1440) * 10000) / 100;
    const widthPercent = Math.max(1.5, Math.round((durMin / 1440) * 10000) / 100);

    const isOverlapping = segments.some((other, otherIdx) => {
      if (otherIdx >= index) return false;
      const otherStart = other.startMinute;
      const otherEnd = other.startMinute + Math.max(1, other.segmentDurationMinutes);
      return otherStart < endMin && otherEnd > startMin;
    });

    return {
      segmentId: seg.segmentId,
      entryId: seg.entry.id,
      title: seg.entry.title,
      category: seg.entry.category,
      leftPercent,
      widthPercent,
      startMinute: startMin,
      endMinute: endMin,
      durationMinutes: seg.segmentDurationMinutes,
      displayTimeRange: `${seg.displayStartTime} → ${seg.displayEndTime}`,
      isMultiDay: seg.isMultiDay,
      spanPosition: seg.spanPosition,
      spanDayIndex: seg.spanDayIndex,
      spanTotalDays: seg.spanTotalDays,
      isOverlapping,
    };
  });
}

/**
 * Creates a sanitized TimelineEntry from a FrequentEvent template targeted onto a specific `targetDate` (YYYY-MM-DD).
 */
export function createTimelineEntryForCalendarDate(
  fe: FrequentEvent,
  targetDate: string,
  fallbackNow: Date = new Date()
): TimelineEntry {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test((targetDate || '').trim())
    ? targetDate.trim()
    : fallbackNow.toISOString().slice(0, 10);

  const curH = String(fallbackNow.getHours()).padStart(2, '0');
  const curM = String(fallbackNow.getMinutes()).padStart(2, '0');

  const rawStart =
    typeof fe.startTime === 'string' && /^\d{2}:\d{2}$/.test(fe.startTime.trim())
      ? fe.startTime.trim()
      : `${curH}:${curM}`;

  const duration = Math.max(5, Math.min(2880, Math.round(Number(fe.durationMinutes) || 60)));

  const endStr =
    typeof fe.endTime === 'string' && /^\d{2}:\d{2}$/.test(fe.endTime.trim()) && fe.startTime
      ? fe.endTime.trim()
      : computeEndTimeFromDuration(rawStart, Math.min(720, duration));

  const finalDuration = duration || calculateDurationMinutes(rawStart, endStr) || 60;

  return {
    id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: sanitizeTextInput(fe.title, 'Quick Activity', 120),
    category: sanitizeTextInput(fe.category, 'work', 48) as TimelineCategory,
    date: cleanDate,
    startTime: rawStart,
    endTime: endStr,
    durationMinutes: finalDuration,
    notes: fe.notes ? sanitizeTextInput(fe.notes, '', 300) : undefined,
    customFields: {},
    createdAt: Date.now(),
  };
}

/**
 * Returns a chronological list of upcoming/recent schedule segments around `referenceDate`
 * for the Dashboard "Mini-Calendar / Upcoming Schedule" widget.
 */
export function getUpcomingScheduleSegments(
  timeline: TimelineEntry[],
  referenceDate?: string,
  maxItems: number = 6
): CalendarSpanSegment[] {
  const refIso = referenceDate || new Date().toISOString().slice(0, 10);
  const map = buildDailySegmentsMap(timeline, 'all');

  const allDates = Array.from(map.keys()).sort();
  const upcomingOrToday: CalendarSpanSegment[] = [];
  const recentPast: CalendarSpanSegment[] = [];

  for (const d of allDates) {
    const segs = map.get(d) || [];
    if (d >= refIso) {
      upcomingOrToday.push(...segs);
    } else {
      recentPast.push(...segs);
    }
  }

  if (upcomingOrToday.length >= maxItems) {
    return upcomingOrToday.slice(0, maxItems);
  }

  const neededFromPast = Math.max(0, maxItems - upcomingOrToday.length);
  const tailPast = recentPast.slice(-neededFromPast);
  return [...upcomingOrToday, ...tailPast.reverse()].slice(0, maxItems);
}
