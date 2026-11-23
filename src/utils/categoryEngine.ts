import {
  AppData,
  CategoryConfig,
  CategoryDomain,
  LayoutConfig,
} from '../types';
import { sanitizeTextInput } from './matrixLayoutEngine';

const PALETTE_ROTATION = [
  '#10b981', // emerald
  '#06b6d4', // cyan
  '#a855f7', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#38bdf8', // sky
  '#84cc16', // lime
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#94a3b8', // slate
];

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  // 1. Timeline Categories
  { id: 'cat-tl-work', name: 'work', domain: 'timeline', color: '#10b981', icon: 'briefcase', order: 0 },
  { id: 'cat-tl-health', name: 'health', domain: 'timeline', color: '#06b6d4', icon: 'heart', order: 1 },
  { id: 'cat-tl-learning', name: 'learning', domain: 'timeline', color: '#a855f7', icon: 'book', order: 2 },
  { id: 'cat-tl-personal', name: 'personal', domain: 'timeline', color: '#f59e0b', icon: 'user', order: 3 },
  { id: 'cat-tl-social', name: 'social', domain: 'timeline', color: '#ec4899', icon: 'users', order: 4 },
  { id: 'cat-tl-creative', name: 'creative', domain: 'timeline', color: '#38bdf8', icon: 'sparkles', order: 5 },
  { id: 'cat-tl-other', name: 'other', domain: 'timeline', color: '#94a3b8', icon: 'tag', order: 6 },

  // 2. Funds / Expense Ledger Categories
  { id: 'cat-fn-income', name: 'Client / Income', domain: 'funds', color: '#10b981', icon: 'trending-up', order: 0 },
  { id: 'cat-fn-salary', name: 'Salary', domain: 'funds', color: '#22c55e', icon: 'wallet', order: 1 },
  { id: 'cat-fn-groceries', name: 'Groceries', domain: 'funds', color: '#f59e0b', icon: 'shopping-cart', order: 2 },
  { id: 'cat-fn-housing', name: 'Housing & Utilities', domain: 'funds', color: '#06b6d4', icon: 'home', order: 3 },
  { id: 'cat-fn-software', name: 'Software & Cloud', domain: 'funds', color: '#a855f7', icon: 'cpu', order: 4 },
  { id: 'cat-fn-fitness', name: 'Fitness & Health', domain: 'funds', color: '#ec4899', icon: 'activity', order: 5 },
  { id: 'cat-fn-transport', name: 'Transportation', domain: 'funds', color: '#38bdf8', icon: 'car', order: 6 },
  { id: 'cat-fn-ops', name: 'Operations', domain: 'funds', color: '#94a3b8', icon: 'layers', order: 7 },

  // 3. Strategic Goals Categories
  { id: 'cat-gl-fitness', name: 'fitness', domain: 'goals', color: '#10b981', icon: 'dumbbell', order: 0 },
  { id: 'cat-gl-financial', name: 'financial', domain: 'goals', color: '#f59e0b', icon: 'dollar-sign', order: 1 },
  { id: 'cat-gl-career', name: 'career', domain: 'goals', color: '#06b6d4', icon: 'briefcase', order: 2 },
  { id: 'cat-gl-learning', name: 'learning', domain: 'goals', color: '#a855f7', icon: 'graduation-cap', order: 3 },
  { id: 'cat-gl-personal', name: 'personal', domain: 'goals', color: '#ec4899', icon: 'star', order: 4 },
  { id: 'cat-gl-travel', name: 'travel', domain: 'goals', color: '#38bdf8', icon: 'compass', order: 5 },

  // 4. Daily Notes Tags / Categories
  { id: 'cat-nt-daily', name: 'daily', domain: 'notes', color: '#f59e0b', icon: 'book-open', order: 0 },
  { id: 'cat-nt-focus', name: 'focus', domain: 'notes', color: '#06b6d4', icon: 'zap', order: 1 },
  { id: 'cat-nt-strategy', name: 'strategy', domain: 'notes', color: '#10b981', icon: 'target', order: 2 },
  { id: 'cat-nt-briefing', name: 'briefing', domain: 'notes', color: '#a855f7', icon: 'file-text', order: 3 },
  { id: 'cat-nt-debrief', name: 'debrief', domain: 'notes', color: '#38bdf8', icon: 'check-circle', order: 4 },

  // 5. Private Gallery Tags / Categories
  { id: 'cat-ga-arch', name: 'architecture', domain: 'gallery', color: '#06b6d4', icon: 'image', order: 0 },
  { id: 'cat-ga-fit', name: 'fitness', domain: 'gallery', color: '#10b981', icon: 'activity', order: 1 },
  { id: 'cat-ga-work', name: 'workspace', domain: 'gallery', color: '#a855f7', icon: 'monitor', order: 2 },
  { id: 'cat-ga-mile', name: 'milestone', domain: 'gallery', color: '#f59e0b', icon: 'award', order: 3 },

  // 6. Daily Maxim / Philosophy Tags
  { id: 'cat-qt-disc', name: 'discipline', domain: 'quotes', color: '#f59e0b', icon: 'shield', order: 0 },
  { id: 'cat-qt-strat', name: 'strategy', domain: 'quotes', color: '#06b6d4', icon: 'compass', order: 1 },
  { id: 'cat-qt-stoic', name: 'stoicism', domain: 'quotes', color: '#a855f7', icon: 'book', order: 2 },
  { id: 'cat-qt-exec', name: 'execution', domain: 'quotes', color: '#10b981', icon: 'zap', order: 3 },
  { id: 'cat-qt-cust', name: 'custom', domain: 'quotes', color: '#ec4899', icon: 'star', order: 4 },
];

const VALID_DOMAINS: CategoryDomain[] = ['timeline', 'funds', 'goals', 'notes', 'gallery', 'quotes'];

/**
 * Sanitizes a category name (strips HTML/script tags and trims whitespace).
 */
export function sanitizeCategoryName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 48);
}

/**
 * Resolves the complete list of categories from AppData, merging saved categories
 * with DEFAULT_CATEGORIES (when first initialized) and auto-discovering any categories
 * referenced on existing timeline, funds, goals, dailyNotes, or gallery items.
 */
export function resolveCategoriesForAppData(
  appData?: Partial<AppData> | null
): CategoryConfig[] {
  const rawSaved =
    appData?.settings?.categories ??
    appData?.categories;

  const baseList: CategoryConfig[] = [];
  const seenByDomain = new Map<string, CategoryConfig>();

  const registerItem = (item: CategoryConfig) => {
    const cleanName = sanitizeCategoryName(item.name);
    if (!cleanName || !VALID_DOMAINS.includes(item.domain)) return;
    const key = `${item.domain}::${cleanName.toLowerCase()}`;
    if (seenByDomain.has(key)) return;
    const normalized: CategoryConfig = {
      id: item.id || `cat-${item.domain}-${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      name: cleanName,
      domain: item.domain,
      color: typeof item.color === 'string' && item.color.startsWith('#') ? item.color : '#06b6d4',
      icon: typeof item.icon === 'string' && item.icon ? item.icon : 'tag',
      order: typeof item.order === 'number' ? item.order : baseList.length,
    };
    seenByDomain.set(key, normalized);
    baseList.push(normalized);
  };

  if (Array.isArray(rawSaved) && rawSaved.length > 0) {
    for (const c of rawSaved) {
      if (c && typeof c === 'object') {
        registerItem(c as CategoryConfig);
      }
    }
    // Ensure every domain has at least its defaults if none were saved for that domain
    for (const domain of VALID_DOMAINS) {
      const hasAnyInDomain = baseList.some((c) => c.domain === domain);
      if (!hasAnyInDomain) {
        for (const def of DEFAULT_CATEGORIES.filter((d) => d.domain === domain)) {
          registerItem(def);
        }
      }
    }
  } else {
    for (const def of DEFAULT_CATEGORIES) {
      registerItem(def);
    }
  }

  // Auto-discover any categories currently used on items so no item category is ever missing
  const discover = (domain: CategoryDomain, rawName?: string) => {
    const clean = sanitizeCategoryName(rawName);
    if (!clean) return;
    const key = `${domain}::${clean.toLowerCase()}`;
    if (!seenByDomain.has(key)) {
      const domainItems = baseList.filter((c) => c.domain === domain);
      const color = PALETTE_ROTATION[domainItems.length % PALETTE_ROTATION.length];
      registerItem({
        id: `cat-${domain}-${clean.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${domainItems.length}`,
        name: clean,
        domain,
        color,
        icon: 'tag',
        order: domainItems.length,
      });
    }
  };

  for (const t of appData?.timeline || []) {
    discover('timeline', t.category);
  }
  for (const fe of appData?.frequentEvents || []) {
    discover('timeline', fe.category);
  }
  for (const f of appData?.funds || []) {
    discover('funds', f.category);
  }
  for (const g of appData?.goals || []) {
    discover('goals', g.category);
  }
  for (const n of appData?.dailyNotes || []) {
    for (const tag of n.tags || []) {
      discover('notes', tag);
    }
  }
  for (const img of appData?.gallery || []) {
    for (const tag of img.tags || []) {
      discover('gallery', tag);
    }
  }
  for (const q of appData?.quoteState?.customQuotes || []) {
    if (q.category) {
      discover('quotes', q.category);
    }
  }

  // Normalize order within each domain while preserving relative order
  const result: CategoryConfig[] = [];
  for (const domain of VALID_DOMAINS) {
    const domainList = baseList
      .filter((c) => c.domain === domain)
      .sort((a, b) => a.order - b.order)
      .map((c, idx) => ({ ...c, order: idx }));
    result.push(...domainList);
  }

  return result;
}

/**
 * Returns the ordered CategoryConfig list for a specific domain.
 */
export function getCategoriesByDomain(
  appData: Partial<AppData> | null | undefined,
  domain: CategoryDomain
): CategoryConfig[] {
  return resolveCategoriesForAppData(appData).filter((c) => c.domain === domain);
}

/**
 * Counts how many items in AppData currently reference a given category name in a domain.
 */
export function countCategoryReferences(
  appData: Partial<AppData> | null | undefined,
  categoryName: string,
  domain?: CategoryDomain
): number {
  if (!appData) return 0;
  const targetLower = sanitizeCategoryName(categoryName).toLowerCase();
  if (!targetLower) return 0;

  let count = 0;

  if (!domain || domain === 'timeline') {
    for (const t of appData.timeline || []) {
      if (t.category?.trim().toLowerCase() === targetLower) count++;
    }
    for (const fe of appData.frequentEvents || []) {
      if (fe.category?.trim().toLowerCase() === targetLower) count++;
    }
  }

  if (!domain || domain === 'funds') {
    for (const f of appData.funds || []) {
      if (f.category?.trim().toLowerCase() === targetLower) count++;
    }
  }

  if (!domain || domain === 'goals') {
    for (const g of appData.goals || []) {
      if (g.category?.trim().toLowerCase() === targetLower) count++;
    }
  }

  if (!domain || domain === 'notes') {
    for (const n of appData.dailyNotes || []) {
      if ((n.tags || []).some((t) => t.trim().toLowerCase() === targetLower)) count++;
    }
  }

  if (!domain || domain === 'gallery') {
    for (const g of appData.gallery || []) {
      if ((g.tags || []).some((t) => t.trim().toLowerCase() === targetLower)) count++;
    }
  }

  if (!domain || domain === 'quotes') {
    for (const q of appData.quoteState?.customQuotes || []) {
      if (q.category?.trim().toLowerCase() === targetLower) count++;
    }
  }

  return count;
}

export interface RenameCategoryResult {
  updated: boolean;
  merged: boolean;
  reason?: 'empty' | 'unchanged';
  oldName: string;
  finalName: string;
  updatedItemsCount: number;
  nextAppData: AppData;
  nextLayoutConfig?: LayoutConfig;
}

/**
 * Atomically renames a category from `oldName` to `newRawName` and cascades the update
 * across all referencing items (timeline, frequentEvents, funds, goals, dailyNotes, gallery,
 * quotes, and custom panels).
 *
 * - Preserves category colors, icons, and sort order.
 * - Rejects empty/blank strings (reverts to `oldName`).
 * - Handles case-insensitive duplicates cleanly by merging into the existing category.
 */
export function renameCategoryCascading(
  appData: AppData,
  oldName: string,
  newRawName: string,
  domain?: CategoryDomain,
  layoutConfig?: LayoutConfig
): RenameCategoryResult {
  const cleanOld = sanitizeCategoryName(oldName);
  const cleanNew = sanitizeCategoryName(newRawName);

  // 1. Prevent saving empty/blank strings (revert to oldName)
  if (!cleanNew || !cleanOld) {
    return {
      updated: false,
      merged: false,
      reason: 'empty',
      oldName: cleanOld || oldName,
      finalName: cleanOld || oldName,
      updatedItemsCount: 0,
      nextAppData: appData,
      nextLayoutConfig: layoutConfig,
    };
  }

  // Exact match (including case) -> no-op
  if (cleanNew === cleanOld) {
    return {
      updated: false,
      merged: false,
      reason: 'unchanged',
      oldName: cleanOld,
      finalName: cleanOld,
      updatedItemsCount: 0,
      nextAppData: appData,
      nextLayoutConfig: layoutConfig,
    };
  }

  const oldLower = cleanOld.toLowerCase();
  const newLower = cleanNew.toLowerCase();
  const isCaseOnlyRename = oldLower === newLower;

  const currentCategories = resolveCategoriesForAppData(appData);
  let merged = false;
  let finalName = cleanNew;

  // 2. Update or merge in categories array while preserving color, icon, and sort order
  const updatedCategories: CategoryConfig[] = [];
  for (const d of VALID_DOMAINS) {
    const domainCats = currentCategories
      .filter((c) => c.domain === d)
      .sort((a, b) => a.order - b.order);

    if (domain && d !== domain) {
      updatedCategories.push(...domainCats);
      continue;
    }

    const oldIdx = domainCats.findIndex((c) => c.name.toLowerCase() === oldLower);
    const existingTargetIdx = domainCats.findIndex(
      (c, idx) => idx !== oldIdx && c.name.toLowerCase() === newLower
    );

    if (oldIdx === -1) {
      // Category wasn't in registry yet; if existingTargetIdx is found, merge into it, else add it
      if (existingTargetIdx !== -1) {
        merged = true;
        finalName = domainCats[existingTargetIdx].name;
        updatedCategories.push(...domainCats);
      } else {
        updatedCategories.push(
          ...domainCats,
          {
            id: `cat-${d}-${newLower.replace(/[^a-z0-9]/g, '-')}-${domainCats.length}`,
            name: cleanNew,
            domain: d,
            color: PALETTE_ROTATION[domainCats.length % PALETTE_ROTATION.length],
            icon: 'tag',
            order: domainCats.length,
          }
        );
      }
    } else if (!isCaseOnlyRename && existingTargetIdx !== -1) {
      // Case-insensitive collision with another existing category in the same domain -> merge cleanly!
      merged = true;
      finalName = domainCats[existingTargetIdx].name;
      const mergedDomainCats = domainCats
        .filter((_, idx) => idx !== oldIdx)
        .map((c, idx) => ({ ...c, order: idx }));
      updatedCategories.push(...mergedDomainCats);
    } else {
      // In-place rename: preserve id, color, icon, and order!
      const renamedDomainCats = domainCats.map((c, idx) =>
        idx === oldIdx
          ? {
              ...c,
              name: cleanNew,
            }
          : c
      );
      updatedCategories.push(...renamedDomainCats);
    }
  }

  // 3. Cascade updates across all child entities referencing oldName
  let updatedItemsCount = 0;
  const matchesOld = (val?: string) =>
    typeof val === 'string' && val.trim().toLowerCase() === oldLower;

  const nextTimeline = (appData.timeline || []).map((entry) => {
    if ((!domain || domain === 'timeline') && matchesOld(entry.category)) {
      updatedItemsCount++;
      return { ...entry, category: finalName };
    }
    return entry;
  });

  const nextFrequentEvents = (appData.frequentEvents || []).map((fe) => {
    if ((!domain || domain === 'timeline') && matchesOld(fe.category)) {
      updatedItemsCount++;
      return { ...fe, category: finalName };
    }
    return fe;
  });

  const nextFunds = (appData.funds || []).map((fund) => {
    if ((!domain || domain === 'funds') && matchesOld(fund.category)) {
      updatedItemsCount++;
      return { ...fund, category: finalName };
    }
    return fund;
  });

  const nextGoals = (appData.goals || []).map((goal) => {
    if ((!domain || domain === 'goals') && matchesOld(goal.category)) {
      updatedItemsCount++;
      return { ...goal, category: finalName };
    }
    return goal;
  });

  const deduplicateTags = (tags: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of tags) {
      const k = t.trim().toLowerCase();
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(t.trim());
      }
    }
    return out;
  };

  const nextDailyNotes = (appData.dailyNotes || []).map((note) => {
    if ((!domain || domain === 'notes') && (note.tags || []).some(matchesOld)) {
      updatedItemsCount++;
      const replaced = (note.tags || []).map((t) => (matchesOld(t) ? finalName : t));
      return {
        ...note,
        tags: deduplicateTags(replaced),
        updatedAt: Date.now(),
      };
    }
    return note;
  });

  const nextGallery = (appData.gallery || []).map((item) => {
    if ((!domain || domain === 'gallery') && (item.tags || []).some(matchesOld)) {
      updatedItemsCount++;
      const replaced = (item.tags || []).map((t) => (matchesOld(t) ? finalName : t));
      return {
        ...item,
        tags: deduplicateTags(replaced),
      };
    }
    return item;
  });

  const nextCustomQuotes = (appData.quoteState?.customQuotes || []).map((q) => {
    if (matchesOld(q.category)) {
      updatedItemsCount++;
      return { ...q, category: finalName };
    }
    return q;
  });

  const nextQuoteState = appData.quoteState
    ? {
        ...appData.quoteState,
        customQuotes: nextCustomQuotes,
      }
    : undefined;

  let nextLayoutConfig = layoutConfig;
  if (layoutConfig && Array.isArray(layoutConfig.widgets)) {
    const nextWidgets = layoutConfig.widgets.map((w) => {
      let widgetChanged = false;
      const nextKv = (w.customKeyValues || []).map((kv) => {
        if (matchesOld(kv.label)) {
          widgetChanged = true;
          updatedItemsCount++;
          return { ...kv, label: finalName };
        }
        if (matchesOld(kv.value)) {
          widgetChanged = true;
          updatedItemsCount++;
          return { ...kv, value: finalName };
        }
        return kv;
      });
      return widgetChanged ? { ...w, customKeyValues: nextKv } : w;
    });
    nextLayoutConfig = {
      ...layoutConfig,
      widgets: nextWidgets,
    };
  }

  const nextAppData: AppData = {
    ...appData,
    categories: updatedCategories,
    timeline: nextTimeline,
    frequentEvents: nextFrequentEvents,
    funds: nextFunds,
    goals: nextGoals,
    dailyNotes: nextDailyNotes,
    gallery: nextGallery,
    quoteState: nextQuoteState,
    settings: {
      ...appData.settings,
      categories: updatedCategories,
      quoteState: nextQuoteState || appData.settings.quoteState,
      ...(nextLayoutConfig
        ? {
            layoutConfig: nextLayoutConfig,
            dashboardWidgets: nextLayoutConfig.widgets,
          }
        : {}),
    },
    updatedAt: Date.now(),
  };

  return {
    updated: true,
    merged,
    oldName: cleanOld,
    finalName,
    updatedItemsCount,
    nextAppData,
    nextLayoutConfig,
  };
}

/**
 * Adds a new category to a domain in AppData (no-op if case-insensitive match already exists).
 */
export function addCategoryToDomain(
  appData: AppData,
  domain: CategoryDomain,
  rawName: string,
  color?: string,
  icon?: string
): { added: boolean; category?: CategoryConfig; nextAppData: AppData } {
  const cleanName = sanitizeCategoryName(rawName);
  if (!cleanName) {
    return { added: false, nextAppData: appData };
  }

  const current = resolveCategoriesForAppData(appData);
  const domainCats = current.filter((c) => c.domain === domain);
  const existing = domainCats.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    return { added: false, category: existing, nextAppData: appData };
  }

  const newCat: CategoryConfig = {
    id: `cat-${domain}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    name: cleanName,
    domain,
    color:
      color && color.startsWith('#')
        ? color
        : PALETTE_ROTATION[domainCats.length % PALETTE_ROTATION.length],
    icon: icon || 'tag',
    order: domainCats.length,
  };

  const nextCategories = [...current, newCat];
  return {
    added: true,
    category: newCat,
    nextAppData: {
      ...appData,
      categories: nextCategories,
      settings: {
        ...appData.settings,
        categories: nextCategories,
      },
      updatedAt: Date.now(),
    },
  };
}

/**
 * Updates the color of an existing category in a domain.
 */
export function updateCategoryColorInDomain(
  appData: AppData,
  domain: CategoryDomain,
  categoryName: string,
  newColorHex: string
): AppData {
  if (!/^#[0-9A-Fa-f]{6}$/.test(newColorHex.trim())) {
    return appData;
  }
  const targetLower = sanitizeCategoryName(categoryName).toLowerCase();
  const current = resolveCategoriesForAppData(appData);
  let changed = false;
  const nextCategories = current.map((cat) => {
    if (cat.domain === domain && cat.name.toLowerCase() === targetLower) {
      changed = true;
      return { ...cat, color: newColorHex.trim() };
    }
    return cat;
  });
  if (!changed) return appData;
  return {
    ...appData,
    categories: nextCategories,
    settings: {
      ...appData.settings,
      categories: nextCategories,
    },
    updatedAt: Date.now(),
  };
}

/**
 * Deletes a category from a domain (preserving at least 1 category per domain).
 */
export function deleteCategoryFromDomain(
  appData: AppData,
  domain: CategoryDomain,
  categoryName: string
): AppData {
  const targetLower = sanitizeCategoryName(categoryName).toLowerCase();
  const current = resolveCategoriesForAppData(appData);
  const domainCats = current.filter((c) => c.domain === domain);
  if (domainCats.length <= 1) {
    return appData;
  }
  const nextCategories = current.filter(
    (c) => !(c.domain === domain && c.name.toLowerCase() === targetLower)
  );
  if (nextCategories.length === current.length) {
    return appData;
  }
  return {
    ...appData,
    categories: nextCategories,
    settings: {
      ...appData.settings,
      categories: nextCategories,
    },
    updatedAt: Date.now(),
  };
}

