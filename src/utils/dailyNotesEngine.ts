import {
  AppData,
  DailyNoteEntry,
  DistanceEntry,
  FundEntry,
  LifeStatEntry,
  TimelineEntry,
} from '../types';
import {
  calculateDistanceSummary,
  calculateDurationMinutes,
  calculateFundsSummary,
  formatMinutes,
} from './calculations';
import { sanitizeTextInput } from './matrixLayoutEngine';

export type TacticalEditorViewMode = 'write' | 'split' | 'read';

export interface TacticalNoteTemplate {
  id: 'morning_briefing' | 'eod_debrief' | 'decision_log' | 'architecture_spec';
  label: string;
  shortLabel: string;
  defaultTitle: string;
  defaultTags: string[];
  markdownSection: string;
}

export const TACTICAL_NOTE_TEMPLATES: TacticalNoteTemplate[] = [
  {
    id: 'morning_briefing',
    label: '+ Morning Briefing',
    shortLabel: 'Morning Briefing',
    defaultTitle: 'Morning Command Briefing',
    defaultTags: ['briefing', 'priority', 'daily'],
    markdownSection: `## Morning Command Briefing
- [ ] Primary Daily Objective
- [ ] Physical Training / Movement
- [ ] Reconcile Daily Funds Ledger & Milestones

### Key Energy & Risk Countermeasures
- **Primary Objective:** High-clarity execution window
- **Countermeasure:** Minimize external distractions`,
  },
  {
    id: 'eod_debrief',
    label: '+ EOD Debrief',
    shortLabel: 'EOD Debrief',
    defaultTitle: 'End-of-Day Tactical Debrief',
    defaultTags: ['debrief', 'review', 'wins'],
    markdownSection: `## End-of-Day Tactical Debrief
- [x] Primary Deep Work Objective Completed
- [ ] Carry-Forward Action Item for Tomorrow

### Operational Review
- **Completed Wins:** 
- **Bottlenecks Encountered:** 
- **Key Lesson / Adjustment:** `,
  },
  {
    id: 'decision_log',
    label: '+ Decision Log',
    shortLabel: 'Decision Log',
    defaultTitle: 'Tactical Decision Log',
    defaultTags: ['decision', 'strategy', 'analysis'],
    markdownSection: `## Tactical Decision Log
- **Decision Context:** 
- **Option A:** Conservative / Baseline Path
- **Option B:** High-Conviction Execution Path
- [ ] Execute selected course of action and verify outcome`,
  },
  {
    id: 'architecture_spec',
    label: '+ Architecture Spec',
    shortLabel: 'Architecture Spec',
    defaultTitle: 'Systems Architecture Specification',
    defaultTags: ['architecture', 'spec', 'engineering'],
    markdownSection: `## Systems Architecture Specification
### 1. Problem Statement & Constraints
- **Local-First Invariant:** 100% client-side AES-256-GCM state persistence
- **Performance Target:** Zero-latency state mutation & deterministic verification

### 2. Implementation Checklist
- [ ] Decouple pure domain logic into unit-tested engine module
- [ ] Verify strict WCAG AA contrast on #000000 surfaces`,
  },
];

export interface NoteTelemetry {
  wordCount: number;
  charCount: number;
  readingTimeMinutes: number;
  readingTimeLabel: string;
  actionItemCount: number;
  completedActionItemCount: number;
}

export interface MarkdownChecklistItem {
  lineIndex: number;
  itemIndex: number;
  checked: boolean;
  text: string;
  rawLine: string;
}

export interface NoteExplorerMonthGroup {
  monthKey: string;
  monthLabel: string;
  notes: DailyNoteEntry[];
}

export interface GroupedNotesExplorer {
  pinned: DailyNoteEntry[];
  monthGroups: NoteExplorerMonthGroup[];
}

export interface DailyOperationalContext {
  date: string;
  timelineEntries: TimelineEntry[];
  totalTimelineMinutes: number;
  focusMinutes: number;
  formattedTotalTime: string;
  formattedFocusTime: string;
  biometrics: {
    weightLbs: number | null;
    mood: number | null;
    moodNote?: string;
  };
  funds: {
    income: number;
    expense: number;
    netDelta: number;
    transactionCount: number;
    netVaultBalance: number;
  };
  distances: {
    totalMiles: number;
    tripCount: number;
  };
}

/**
 * Sanitize and normalize a DailyNoteEntry object against HTML/script injection
 * while preserving markdown symbols (`#`, `- [ ]`, `>`, `` ` ``, `*`).
 */
export function sanitizeDailyNote(raw: unknown): DailyNoteEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const todayStr = new Date().toISOString().split('T')[0];

  const rawDate =
    typeof candidate.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate.date.trim())
      ? candidate.date.trim()
      : todayStr;

  const rawContent =
    typeof candidate.content === 'string'
      ? candidate.content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<\/?[a-zA-Z][^>]*>/g, '')
          .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
          .trim()
          .slice(0, 16000)
      : '';

  const rawTitle = sanitizeTextInput(candidate.title, `Daily Note — ${rawDate}`, 120);

  const tags = Array.isArray(candidate.tags)
    ? Array.from(
        new Set(
          candidate.tags
            .map((t) =>
              sanitizeTextInput(t, '', 32)
                .replace(/^#+/, '')
                .trim()
                .toLowerCase()
            )
            .filter((t) => t.length > 0)
        )
      ).slice(0, 15)
    : [];

  const mood =
    typeof candidate.mood === 'number' && !isNaN(candidate.mood)
      ? Math.min(10, Math.max(1, Math.round(candidate.mood)))
      : undefined;

  const now = Date.now();
  const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : now;
  const updatedAt = typeof candidate.updatedAt === 'number' ? candidate.updatedAt : now;

  return {
    id:
      typeof candidate.id === 'string' && candidate.id.trim()
        ? sanitizeTextInput(candidate.id, `note-${now}`, 64)
        : `note-${now}-${Math.random().toString(36).slice(2, 6)}`,
    date: rawDate,
    title: rawTitle,
    content: rawContent,
    tags,
    mood,
    isPinned: Boolean(candidate.isPinned),
    createdAt,
    updatedAt,
  };
}

/**
 * Create or update a DailyNoteEntry in the collection
 */
export function upsertDailyNote(
  existingNotes: DailyNoteEntry[],
  input: {
    id?: string;
    date: string;
    title?: string;
    content: string;
    tags?: string[];
    mood?: number;
    isPinned?: boolean;
  }
): { nextNotes: DailyNoteEntry[]; savedNote: DailyNoteEntry } | null {
  const clean = sanitizeDailyNote({
    ...input,
    updatedAt: Date.now(),
  });
  if (!clean || (!clean.content && !input.title?.trim())) {
    return null;
  }

  const list = Array.isArray(existingNotes) ? [...existingNotes] : [];
  const existingIdx = list.findIndex((n) => (input.id ? n.id === input.id : false));

  if (existingIdx >= 0) {
    const updated: DailyNoteEntry = {
      ...list[existingIdx],
      ...clean,
      id: list[existingIdx].id,
      createdAt: list[existingIdx].createdAt,
      updatedAt: Date.now(),
    };
    list[existingIdx] = updated;
    return { nextNotes: list, savedNote: updated };
  }

  return {
    nextNotes: [clean, ...list],
    savedNote: clean,
  };
}

/**
 * Filter and sort Daily Notes (Pinned first, then newest date, then newest updatedAt)
 */
export function filterAndSortDailyNotes(
  notes: DailyNoteEntry[],
  searchQuery: string = '',
  tagFilter: string = 'all'
): DailyNoteEntry[] {
  if (!Array.isArray(notes)) return [];
  const q = searchQuery.toLowerCase().trim().replace(/^#/, '');
  const tf = tagFilter.toLowerCase().trim().replace(/^#/, '');

  return [...notes]
    .filter((n) => {
      if (tf && tf !== 'all' && !(n.tags || []).some((t) => t.toLowerCase() === tf)) {
        return false;
      }
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.date.includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
        return a.isPinned ? -1 : 1;
      }
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatMonthHeading(yyyyMm: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!match) return yyyyMm || 'Archive';
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
  const monthName = MONTH_NAMES[monthIdx] || match[2];
  return `${monthName} ${year}`;
}

/**
 * Groups filtered notes into Pinned and chronological Month/Date sections for the Left Explorer Rail.
 */
export function groupNotesByPinnedAndMonth(notes: DailyNoteEntry[]): GroupedNotesExplorer {
  if (!Array.isArray(notes) || notes.length === 0) {
    return { pinned: [], monthGroups: [] };
  }

  const pinned: DailyNoteEntry[] = [];
  const monthMap = new Map<string, DailyNoteEntry[]>();

  for (const note of notes) {
    if (note.isPinned) {
      pinned.push(note);
    }
    const monthKey = (note.date || '').slice(0, 7) || 'Unknown';
    const bucket = monthMap.get(monthKey) || [];
    bucket.push(note);
    monthMap.set(monthKey, bucket);
  }

  const sortedMonthKeys = Array.from(monthMap.keys()).sort((a, b) => b.localeCompare(a));
  const monthGroups: NoteExplorerMonthGroup[] = sortedMonthKeys.map((monthKey) => ({
    monthKey,
    monthLabel: formatMonthHeading(monthKey),
    notes: (monthMap.get(monthKey) || []).sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    }),
  }));

  return { pinned, monthGroups };
}

/**
 * Parses all `- [ ]` and `- [x]` markdown checklist lines from note content.
 */
export function parseMarkdownChecklists(content: string): MarkdownChecklistItem[] {
  if (typeof content !== 'string' || !content) return [];
  const lines = content.split('\n');
  const items: MarkdownChecklistItem[] = [];
  let itemIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const match = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(rawLine);
    if (match) {
      items.push({
        lineIndex: i,
        itemIndex,
        checked: match[1].toLowerCase() === 'x',
        text: match[2].trim(),
        rawLine,
      });
      itemIndex += 1;
    }
  }

  return items;
}

/**
 * Toggles a `- [ ]` / `- [x]` markdown checklist item at the given lineIndex.
 */
export function toggleMarkdownChecklistLine(content: string, lineIndex: number): string {
  if (typeof content !== 'string' || !content) return '';
  const lines = content.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return content;

  const target = lines[lineIndex];
  if (/^(\s*[-*]\s+\[)[ ](\]\s+.*)$/.test(target)) {
    lines[lineIndex] = target.replace(/^(\s*[-*]\s+\[)[ ](\]\s+.*)$/, '$1x$2');
  } else if (/^(\s*[-*]\s+\[)[xX](\]\s+.*)$/.test(target)) {
    lines[lineIndex] = target.replace(/^(\s*[-*]\s+\[)[xX](\]\s+.*)$/, '$1 $2');
  }

  return lines.join('\n');
}

/**
 * Appends a quick scratchpad bullet (`- [ ] ...` or `- ...`) cleanly to a note's markdown content.
 */
export function appendQuickScratchpadBullet(
  existingContent: string,
  bulletText: string,
  asChecklist: boolean = true
): string {
  const cleanText = sanitizeTextInput(bulletText, '', 400);
  if (!cleanText) return existingContent || '';

  const formattedLine = asChecklist
    ? cleanText.startsWith('- [')
      ? cleanText
      : `- [ ] ${cleanText.replace(/^[-*]\s+/, '')}`
    : cleanText.startsWith('- ')
    ? cleanText
    : `- ${cleanText.replace(/^[-*]\s+/, '')}`;

  const trimmed = (existingContent || '').trimEnd();
  if (!trimmed) return formattedLine;
  return `${trimmed}\n${formattedLine}`;
}

/**
 * Computes live word count, character count, reading time, and checklist progress.
 */
export function computeNoteTelemetry(content: string): NoteTelemetry {
  const raw = typeof content === 'string' ? content : '';
  const trimmed = raw.trim();
  const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;
  const charCount = raw.length;
  const readingTimeMinutes = wordCount === 0 ? 0 : Math.max(1, Math.ceil(wordCount / 200));
  const readingTimeLabel = wordCount === 0 ? '0 min read' : `${readingTimeMinutes} min read`;

  const checklists = parseMarkdownChecklists(raw);
  const actionItemCount = checklists.length;
  const completedActionItemCount = checklists.filter((c) => c.checked).length;

  return {
    wordCount,
    charCount,
    readingTimeMinutes,
    readingTimeLabel,
    actionItemCount,
    completedActionItemCount,
  };
}

/**
 * Inserts a structured tactical template into existing note content without overwriting existing text.
 */
export function insertTemplateIntoNoteContent(
  existingContent: string,
  template: TacticalNoteTemplate
): string {
  const current = (existingContent || '').trim();
  if (!current) {
    return template.markdownSection;
  }
  return `${current}\n\n---\n\n${template.markdownSection}`;
}

/**
 * Formats an inline timestamped 1d6 Roll outcome badge for cursor insertion.
 */
export function formatInlineD6RollStamp(face: number, timeHHMM?: string): string {
  const safeFace = Math.min(6, Math.max(1, Math.round(Number(face) || 6)));
  const outcome =
    safeFace === 6
      ? 'CRITICAL MAX'
      : safeFace >= 4
      ? 'HIGH CONVICTION'
      : safeFace >= 2
      ? 'STEADY'
      : 'NATURAL 1';
  const timeSuffix = timeHHMM ? ` · ${timeHHMM}` : '';
  return `[🎲 1d6 Roll: ${safeFace} — ${outcome}${timeSuffix}]`;
}

/**
 * Inserts a snippet at the active textarea cursor selection (`selectionStart`, `selectionEnd`),
 * or appends cleanly on a new line if no cursor position is provided.
 */
export function insertTextAtCursorOrEnd(
  content: string,
  snippet: string,
  selectionStart?: number | null,
  selectionEnd?: number | null
): { nextContent: string; nextCursorPos: number } {
  const base = typeof content === 'string' ? content : '';
  if (
    typeof selectionStart === 'number' &&
    selectionStart >= 0 &&
    selectionStart <= base.length
  ) {
    const end =
      typeof selectionEnd === 'number' && selectionEnd >= selectionStart
        ? selectionEnd
        : selectionStart;
    const before = base.slice(0, selectionStart);
    const after = base.slice(end);
    const needsLeadingSpace =
      before.length > 0 && !before.endsWith(' ') && !before.endsWith('\n');
    const needsTrailingSpace =
      after.length > 0 && !after.startsWith(' ') && !after.startsWith('\n');
    const injected = `${needsLeadingSpace ? ' ' : ''}${snippet}${needsTrailingSpace ? ' ' : ''}`;
    const nextContent = `${before}${injected}${after}`;
    return {
      nextContent,
      nextCursorPos: before.length + injected.length,
    };
  }

  const trimmed = base.trimEnd();
  const nextContent = trimmed ? `${trimmed}\n${snippet}` : snippet;
  return {
    nextContent,
    nextCursorPos: nextContent.length,
  };
}

/**
 * Computes live cross-module operational records linked to a specific date (`YYYY-MM-DD`).
 */
export function computeDailyOperationalContext(
  date: string,
  appData: Partial<Pick<AppData, 'timeline' | 'lifeStats' | 'funds' | 'distances' | 'settings'>>
): DailyOperationalContext {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const timelineEntries = (appData.timeline || []).filter((t) => t.date === targetDate);

  let totalTimelineMinutes = 0;
  let focusMinutes = 0;

  for (const entry of timelineEntries) {
    const dur =
      entry.durationMinutes > 0
        ? entry.durationMinutes
        : calculateDurationMinutes(entry.startTime, entry.endTime);
    totalTimelineMinutes += dur;
    const cat = (entry.category || '').toLowerCase();
    if (cat === 'work' || cat === 'learning' || cat === 'creative' || cat === 'health') {
      focusMinutes += dur;
    }
  }

  const dayStats = (appData.lifeStats || []).filter((s) => s.date === targetDate);
  const latestDayStat = dayStats[0] || null;
  const fallbackWeight =
    latestDayStat?.weightLbs ??
    (appData.lifeStats || []).find((s) => typeof s.weightLbs === 'number')?.weightLbs ??
    null;

  const dayFunds = (appData.funds || []).filter((f) => f.date === targetDate);
  let income = 0;
  let expense = 0;
  for (const f of dayFunds) {
    if (f.type === 'income') income += Number(f.amount) || 0;
    else expense += Number(f.amount) || 0;
  }
  income = Math.round(income * 100) / 100;
  expense = Math.round(expense * 100) / 100;
  const netDelta = Math.round((income - expense) * 100) / 100;

  const overallFunds = calculateFundsSummary(
    (appData.funds || []) as FundEntry[],
    appData.settings?.startingBalance ?? 0
  );

  const dayDistances = (appData.distances || []).filter((d) => d.date === targetDate);
  const distSummary = calculateDistanceSummary(dayDistances as DistanceEntry[], 'mi');

  return {
    date: targetDate,
    timelineEntries,
    totalTimelineMinutes,
    focusMinutes,
    formattedTotalTime: formatMinutes(totalTimelineMinutes),
    formattedFocusTime: formatMinutes(focusMinutes),
    biometrics: {
      weightLbs: fallbackWeight,
      mood: latestDayStat?.mood ?? null,
      moodNote: latestDayStat?.moodNote,
    },
    funds: {
      income,
      expense,
      netDelta,
      transactionCount: dayFunds.length,
      netVaultBalance: overallFunds.currentBalance,
    },
    distances: {
      totalMiles: distSummary.total,
      tripCount: dayDistances.length,
    },
  };
}

/**
 * Generates a structured Markdown snapshot of a date's cross-module operational telemetry
 * for 1-click `[+ Stamp Daily Snapshot]` insertion into a Daily Note.
 */
export function buildDailySnapshotMarkdown(
  date: string,
  appData: Partial<Pick<AppData, 'timeline' | 'lifeStats' | 'funds' | 'distances' | 'settings'>>
): string {
  const ctx = computeDailyOperationalContext(date, appData);
  const currency = appData.settings?.currencySymbol || '$';
  const deltaSign = ctx.funds.netDelta >= 0 ? '+' : '-';
  const formattedDelta = `${deltaSign}${currency}${Math.abs(ctx.funds.netDelta).toFixed(2)}`;
  const formattedVaultBalance = `${currency}${ctx.funds.netVaultBalance.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const timelineBullets =
    ctx.timelineEntries.length > 0
      ? ctx.timelineEntries
          .map(
            (e) =>
              `- [x] **${e.title}** (${e.startTime}–${e.endTime} · ${formatMinutes(
                e.durationMinutes || calculateDurationMinutes(e.startTime, e.endTime)
              )} · \`${e.category}\`)`
          )
          .join('\n')
      : '- [ ] No timeline blocks logged yet for this date';

  const weightLabel =
    ctx.biometrics.weightLbs !== null ? `${ctx.biometrics.weightLbs} lbs` : 'Unlogged';
  const moodLabel =
    ctx.biometrics.mood !== null ? `${ctx.biometrics.mood}/10` : 'Pending';

  return [
    `### Daily Operational Snapshot — ${ctx.date}`,
    `- **Scheduled Activity:** ${ctx.formattedTotalTime} total across ${ctx.timelineEntries.length} blocks`,
    `- **Biometrics & Distance:** Weight ${weightLabel} · Mood ${moodLabel} · ${ctx.distances.totalMiles} mi (${ctx.distances.tripCount} trips)`,
    `- **Funds Ledger:** Day Net ${formattedDelta} (${ctx.funds.transactionCount} txns) · Net Vault Balance ${formattedVaultBalance}`,
    `#### Logged Timeline Activity`,
    timelineBullets,
  ].join('\n');
}

/**
 * Synchronizes a Daily Note's mood rating (`1–10`) into the `Life Statistics` collection for that date
 * so Biometrics and Daily Notes never drift out of sync.
 */
export function syncNoteMoodToLifeStats(
  lifeStats: LifeStatEntry[],
  date: string,
  mood: number,
  noteTitle?: string
): LifeStatEntry[] {
  const safeList = Array.isArray(lifeStats) ? [...lifeStats] : [];
  const clampedMood = Math.min(10, Math.max(1, Math.round(Number(mood) || 8)));
  const targetDate = date || new Date().toISOString().split('T')[0];

  const existingIndex = safeList.findIndex((s) => s.date === targetDate);
  if (existingIndex >= 0) {
    const existing = safeList[existingIndex];
    safeList[existingIndex] = {
      ...existing,
      mood: clampedMood,
      moodNote: existing.moodNote || (noteTitle ? `Synced from ${noteTitle}` : 'Synced from Daily Note'),
    };
    return safeList;
  }

  const latestRef = safeList[0];
  const newEntry: LifeStatEntry = {
    id: `ls-sync-${targetDate}-${Date.now()}`,
    date: targetDate,
    age: latestRef?.age ?? 27,
    heightFt: latestRef?.heightFt ?? 5,
    heightIn: latestRef?.heightIn ?? 11,
    weightLbs: latestRef?.weightLbs ?? 172.8,
    mood: clampedMood,
    moodNote: noteTitle ? `Synced from ${noteTitle}` : 'Synced from Daily Note',
    weeklyIncome: latestRef?.weeklyIncome ?? 2500,
    createdAt: Date.now(),
  };

  return [newEntry, ...safeList];
}
