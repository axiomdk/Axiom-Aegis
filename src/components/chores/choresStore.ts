import { ChoreItem } from '../../types';

export type { ChoreItem };

export const CHORES_STORAGE_KEY = 'axiom_aegis_standalone_chores_v1';
export const TOMBSTONE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface ChoresSummary {
  total: number;
  completed: number;
  remaining: number;
}

/**
 * Normalizes a raw chore title: collapses newlines/tabs into spaces,
 * removes control characters, and trims leading/trailing whitespace.
 */
export function sanitizeChoreTitle(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function generateChoreId(now: number): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `chore_${crypto.randomUUID()}`;
  }
  return `chore_${now}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Adds a new chore to the front of the list if the title is non-empty.
 */
export function addChore(
  items: readonly ChoreItem[],
  rawTitle: string,
  now: number = Date.now(),
  idOverride?: string
): { items: ChoreItem[]; added: ChoreItem | null } {
  const title = sanitizeChoreTitle(rawTitle);
  if (!title) {
    return { items: [...items], added: null };
  }

  const ts = Number.isFinite(now) ? now : Date.now();
  const created: ChoreItem = {
    id: idOverride && idOverride.trim() ? idOverride.trim() : generateChoreId(ts),
    title,
    completed: false,
    createdAt: ts,
    updatedAt: ts,
  };

  return {
    items: [created, ...items],
    added: created,
  };
}

/**
 * Toggles the completed state of the matching chore ID and updates its modification timestamp.
 */
export function toggleChore(
  items: readonly ChoreItem[],
  id: string,
  now?: number
): ChoreItem[] {
  const ts = now !== undefined && Number.isFinite(now) ? now : Date.now();
  return items.map((item) =>
    item.id === id ? { ...item, completed: !item.completed, updatedAt: ts } : item
  );
}

/**
 * Deletes the matching chore ID from the list.
 */
export function deleteChore(items: readonly ChoreItem[], id: string): ChoreItem[] {
  return items.filter((item) => item.id !== id);
}

/**
 * Computes active, completed, and total chore counts.
 */
export function getChoresSummary(items: readonly ChoreItem[]): ChoresSummary {
  let completed = 0;
  for (const item of items) {
    if (item.completed) completed++;
  }
  const total = items.length;
  return {
    total,
    completed,
    remaining: total - completed,
  };
}

/**
 * Sanitizes an unknown array of chore candidates into validated ChoreItem records.
 */
export function sanitizeChoresList(rawList: unknown): ChoreItem[] {
  if (!Array.isArray(rawList)) return [];

  const seenIds = new Set<string>();
  const valid: ChoreItem[] = [];

  for (const entry of rawList) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Partial<ChoreItem>;
    const id = typeof candidate.id === 'string' ? candidate.id.trim().slice(0, 80) : '';
    const title = sanitizeChoreTitle(candidate.title);
    if (!id || !title || seenIds.has(id)) continue;

    seenIds.add(id);
    const createdAt =
      typeof candidate.createdAt === 'number' && Number.isFinite(candidate.createdAt)
        ? candidate.createdAt
        : 0;
    const item: ChoreItem = {
      id,
      title,
      completed: Boolean(candidate.completed),
      createdAt,
    };
    if (typeof candidate.updatedAt === 'number' && Number.isFinite(candidate.updatedAt)) {
      item.updatedAt = candidate.updatedAt;
    }
    valid.push(item);
  }

  return valid;
}

/**
 * Safely parses JSON into validated ChoreItem records.
 * Malformed or corrupted input degrades cleanly to an empty list.
 */
export function parseChoresFromStorage(raw: string | null): ChoreItem[] {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return sanitizeChoresList(parsed);
  } catch {
    return [];
  }
}

/**
 * Records deletion tombstones so deleted items propagate across devices without resurrecting.
 */
export function recordDeletedItemTombstones(
  existing: Record<string, number> | undefined,
  deletedIds: readonly string[],
  now: number = Date.now()
): Record<string, number> {
  const cutoff = now - TOMBSTONE_RETENTION_MS;
  const next: Record<string, number> = {};
  if (existing && typeof existing === 'object') {
    for (const [key, ts] of Object.entries(existing)) {
      if (key && typeof ts === 'number' && Number.isFinite(ts) && ts >= cutoff) {
        next[key] = ts;
      }
    }
  }
  for (const id of deletedIds) {
    const clean = typeof id === 'string' ? id.trim() : '';
    if (clean) {
      next[clean] = Math.max(next[clean] || 0, now);
    }
  }
  return next;
}

/**
 * One-time migration helper: reads and clears any legacy standalone localStorage chores
 * so previously created local chores are promoted into cloud AppData once and never left isolated.
 */
export function consumeLegacyLocalChoresOnce(): ChoreItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage?.getItem(CHORES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = parseChoresFromStorage(raw);
    window.localStorage.removeItem(CHORES_STORAGE_KEY);
    return parsed;
  } catch {
    return [];
  }
}

function getDefaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadChoresFromStorage(
  storage: Pick<Storage, 'getItem'> | null = getDefaultStorage()
): ChoreItem[] {
  if (!storage) return [];
  try {
    return parseChoresFromStorage(storage.getItem(CHORES_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function saveChoresToStorage(
  items: readonly ChoreItem[],
  storage: Pick<Storage, 'setItem'> | null = getDefaultStorage()
): void {
  if (!storage) return;
  try {
    storage.setItem(CHORES_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage failures
  }
}
