import {
  AppData,
  CustomNavCategory,
  SiteImprovementItem,
  SiteImprovementStatus,
  TabType,
} from '../types';

export interface SidebarMetrics {
  timelineCount: number;
  todayTimelineCount: number;
  calendarDaysCount: number;
  notesCount: number;
  pinnedNotesCount: number;
  choresCount: number;
  frequentEventsCount: number;
  lifeStatsCount: number;
  distancesCount: number;
  fundsCount: number;
  billsCount: number;
  goalsCount: number;
  activeGoalsCount: number;
  completedGoalsCount: number;
  galleryCount: number;
  shortcutsCount: number;
  siteImprovementsCount: number;
  totalRecordsCount: number;
}

export const DEFAULT_SIDEBAR_GROUP_ORDER: readonly string[] = [
  'daily_ops',
  'biometrics',
  'wealth',
  'vault_sys',
];

export const DEFAULT_SIDEBAR_GROUP_LABELS: Record<string, string> = {
  daily_ops: 'Personal',
  biometrics: 'Biometrics & Mobility',
  wealth: 'Wealth & Strategy',
  vault_sys: 'Vault & System',
};

export const DEFAULT_SIDEBAR_ITEM_LABELS: Record<string, string> = {
  'nav-shortcuts': 'Shortcuts',
  'nav-dashboard': 'Dashboard',
  'nav-calendar': 'Calendar',
  'nav-notes': 'Notes',
  'nav-chores': 'Chores',
  'nav-frequent-events': 'Quick Add',
  'nav-lifestats': 'Life Stats',
  'nav-distance': 'Distance',
  'nav-funds': 'Funds',
  'nav-goals': 'Strategic Goals',
  'nav-gallery': 'Private Gallery',
  'nav-import-hub': 'Import',
  'nav-changelog': 'Changelog',
  'nav-customization': 'Customization',
  'nav-settings': 'Settings',
  'nav-site-improvements': 'Site Improvements',
  'nav-master-admin': 'Master Admin Overseer',
};

export const TAB_TO_SIDEBAR_ITEM_ID: Partial<Record<TabType, string>> = {
  dashboard: 'nav-dashboard',
  shortcuts: 'nav-shortcuts',
  site_improvements: 'nav-site-improvements',
  calendar: 'nav-calendar',
  timeline: 'nav-calendar',
  notes: 'nav-notes',
  chores: 'nav-chores',
  lifestats: 'nav-lifestats',
  distance: 'nav-distance',
  funds: 'nav-funds',
  goals: 'nav-goals',
  gallery: 'nav-gallery',
  customization: 'nav-customization',
  settings: 'nav-settings',
  admin: 'nav-master-admin',
};

export const ADMIN_ONLY_BUILT_IN_TABS = new Set<string>(['admin', 'site_improvements']);
export const ADMIN_ONLY_BUILT_IN_ITEM_IDS = new Set<string>([
  'nav-master-admin',
  'nav-site-improvements',
]);

/**
 * Checks whether a tab ID is strictly restricted to the Master Admin ("The App Creator").
 */
export function isAdminOnlyTab(
  tabId: string | undefined | null,
  customCategories?: CustomNavCategory[] | null
): boolean {
  if (!tabId) return false;
  if (ADMIN_ONLY_BUILT_IN_TABS.has(tabId)) return true;

  if (tabId.startsWith('custom_cat_')) {
    const found = (customCategories || []).find((c) => c.id === tabId);
    // If custom category is marked admin_only (or missing from state), lock to Admin
    if (!found || found.visibility === 'admin_only') {
      return true;
    }
    return false;
  }

  return false;
}

/**
 * Checks whether a sidebar navigation item ID is strictly restricted to the Master Admin.
 */
export function isAdminOnlySidebarItem(
  itemId: string | undefined | null,
  customCategories?: CustomNavCategory[] | null
): boolean {
  if (!itemId) return false;
  if (ADMIN_ONLY_BUILT_IN_ITEM_IDS.has(itemId)) return true;

  if (itemId.startsWith('nav-custom-')) {
    const catId = itemId.slice('nav-custom-'.length);
    return isAdminOnlyTab(catId, customCategories);
  }
  if (itemId.startsWith('custom_cat_')) {
    return isAdminOnlyTab(itemId, customCategories);
  }
  return false;
}

/**
 * View-level security guard: immediately redirects non-admin accounts back to 'dashboard'
 * if they attempt to switch to or render an Admin-only view ID.
 */
export function enforceTabAccessGuard(
  targetTab: TabType | string,
  isMasterAdmin: boolean,
  customCategories?: CustomNavCategory[] | null
): TabType {
  const normalized = (targetTab === 'timeline' ? 'calendar' : targetTab) as TabType;
  if (!isMasterAdmin && isAdminOnlyTab(normalized, customCategories)) {
    return 'dashboard';
  }
  if (normalized.startsWith('custom_cat_')) {
    const exists = (customCategories || []).some((c) => c.id === normalized);
    if (!exists) return 'dashboard';
  }
  return normalized;
}

/**
 * Filters sidebar groups so standard "User" and "VIP" accounts NEVER see Admin-only categories.
 */
export function filterSidebarGroupsByAdminAccess<
  TItem extends { id: string; tab?: string; adminOnly?: boolean },
  TGroup extends { id: string; items: TItem[] }
>(
  groups: TGroup[],
  isMasterAdmin: boolean,
  customCategories?: CustomNavCategory[] | null
): TGroup[] {
  if (isMasterAdmin) {
    return groups;
  }
  return groups.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !item.adminOnly &&
        !isAdminOnlySidebarItem(item.id, customCategories) &&
        !isAdminOnlyTab(item.tab, customCategories)
    ),
  }));
}

const STATUS_CYCLE_ORDER: readonly SiteImprovementStatus[] = [
  'Idea',
  'Planned',
  'In Progress',
  'Completed',
];

/**
 * Cycles a SiteImprovementItem status in 1 click: Idea -> Planned -> In Progress -> Completed -> Idea
 */
export function cycleSiteImprovementStatus(
  currentStatus: SiteImprovementStatus
): SiteImprovementStatus {
  const idx = STATUS_CYCLE_ORDER.indexOf(currentStatus);
  if (idx === -1) return 'Planned';
  return STATUS_CYCLE_ORDER[(idx + 1) % STATUS_CYCLE_ORDER.length];
}

/**
 * Formats one or more SiteImprovementItem entries into a clean, copy-ready AI Studio development prompt.
 */
export function formatSiteImprovementsAsPrompt(items: SiteImprovementItem[]): string {
  const valid = (items || []).filter((it) => it && typeof it.title === 'string' && it.title.trim());
  if (valid.length === 0) {
    return '';
  }

  if (valid.length === 1) {
    const item = valid[0];
    const lines = [
      `Implement the following upgrade in Axiom Aegis:`,
      ``,
      `- **Title:** ${item.title.trim()}`,
      `- **App Section / Category:** ${item.categoryTag || 'General'}`,
      `- **Priority:** ${item.priority} | **Current Status:** ${item.status}`,
    ];
    if (item.notes && item.notes.trim()) {
      lines.push(`- **Implementation Details & Requirements:**\n  ${item.notes.trim()}`);
    }
    lines.push(
      ``,
      `Ensure all changes persist across localStorage and VaultContext, maintain flat pure-black (#000000) styling, and pass all unit tests.`
    );
    return lines.join('\n');
  }

  const header = [
    `Implement the following ${valid.length} site improvements in Axiom Aegis completely without placeholders:`,
    ``,
  ];
  const body = valid.map((item, idx) => {
    const notesBlock =
      item.notes && item.notes.trim()
        ? `\n   - Details: ${item.notes.trim().replace(/\n+/g, ' ')}`
        : '';
    return `${idx + 1}. [${item.priority.toUpperCase()} | ${item.categoryTag || 'General'}] ${item.title.trim()} (${item.status})${notesBlock}`;
  });
  const footer = [
    ``,
    `Ensure all changes persist across localStorage and VaultContext, maintain flat pure-black (#000000) styling, and recompile the production/single-file build when finished.`,
  ];

  return [...header, ...body, ...footer].join('\n');
}

/**
 * Sanitizes a single sidebar category or subsection label string.
 */
export function sanitizeSidebarLabel(
  raw: unknown,
  fallback: string,
  maxLength: number = 48
): string {
  if (typeof raw !== 'string') return fallback;
  const cleaned = raw
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}

/**
 * Sanitizes custom sidebar category (group) labels, falling back to DEFAULT_SIDEBAR_GROUP_LABELS.
 */
export function sanitizeSidebarGroupLabels(
  raw?: Record<string, string> | null
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [groupId, defaultLabel] of Object.entries(DEFAULT_SIDEBAR_GROUP_LABELS)) {
    const candidate = raw && typeof raw === 'object' ? raw[groupId] : undefined;
    result[groupId] = sanitizeSidebarLabel(candidate, defaultLabel);
  }
  return result;
}

/**
 * Sanitizes custom sidebar subsection (item) labels, falling back to DEFAULT_SIDEBAR_ITEM_LABELS.
 * Also preserves custom labels for dynamic custom categories (`nav-custom-*`).
 */
export function sanitizeSidebarItemLabels(
  raw?: Record<string, string> | null,
  customCategories?: CustomNavCategory[] | null
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [itemId, defaultLabel] of Object.entries(DEFAULT_SIDEBAR_ITEM_LABELS)) {
    const candidate = raw && typeof raw === 'object' ? raw[itemId] : undefined;
    result[itemId] = sanitizeSidebarLabel(candidate, defaultLabel);
  }
  if (Array.isArray(customCategories)) {
    for (const cat of customCategories) {
      if (cat && cat.id) {
        const key = `nav-custom-${cat.id}`;
        const candidate = raw && typeof raw === 'object' ? raw[key] : undefined;
        result[key] = sanitizeSidebarLabel(candidate, cat.name || 'Custom Category');
      }
    }
  }
  if (raw && typeof raw === 'object') {
    for (const [key, val] of Object.entries(raw)) {
      if (key.startsWith('nav-custom-') && typeof val === 'string' && !result[key]) {
        result[key] = sanitizeSidebarLabel(val, 'Custom Category');
      }
    }
  }
  return result;
}

/**
 * Ensures all default sidebar group IDs are present in the returned order without duplicates.
 */
export function sanitizeSidebarGroupOrder(rawOrder?: string[] | null): string[] {
  const validIds = new Set<string>(DEFAULT_SIDEBAR_GROUP_ORDER);
  const result: string[] = [];

  if (Array.isArray(rawOrder)) {
    for (const id of rawOrder) {
      const normalized = typeof id === 'string' ? id.trim() : '';
      if (validIds.has(normalized) && !result.includes(normalized)) {
        result.push(normalized);
      }
    }
  }

  for (const defaultId of DEFAULT_SIDEBAR_GROUP_ORDER) {
    if (!result.includes(defaultId)) {
      result.push(defaultId);
    }
  }

  return result;
}

/**
 * Orders sidebar navigation groups according to a persisted custom group order.
 */
export function orderSidebarGroups<T extends { id: string }>(
  groups: T[],
  groupOrder?: string[] | null
): T[] {
  const order = sanitizeSidebarGroupOrder(groupOrder);
  const indexMap = new Map<string, number>();
  order.forEach((id, idx) => indexMap.set(id, idx));

  return [...groups].sort((a, b) => {
    const idxA = indexMap.has(a.id) ? indexMap.get(a.id)! : 999;
    const idxB = indexMap.has(b.id) ? indexMap.get(b.id)! : 999;
    return idxA - idxB;
  });
}

/**
 * Moves a sidebar group up, down, or to a target group's slot (for drag-and-drop) and returns the new order.
 */
export function moveSidebarGroupOrder(
  currentOrder: string[] | null | undefined,
  groupId: string,
  target: 'up' | 'down' | string
): string[] {
  const order = sanitizeSidebarGroupOrder(currentOrder);
  const fromIdx = order.indexOf(groupId);
  if (fromIdx === -1) return order;

  if (target === 'up') {
    if (fromIdx === 0) return order;
    const next = [...order];
    [next[fromIdx - 1], next[fromIdx]] = [next[fromIdx], next[fromIdx - 1]];
    return next;
  }

  if (target === 'down') {
    if (fromIdx >= order.length - 1) return order;
    const next = [...order];
    [next[fromIdx], next[fromIdx + 1]] = [next[fromIdx + 1], next[fromIdx]];
    return next;
  }

  const toIdx = order.indexOf(target);
  if (toIdx === -1 || toIdx === fromIdx) return order;
  const next = [...order];
  const [moved] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, moved);
  return next;
}

export type SidebarGroupItemsMap = Record<string, string[]>;

export const DEFAULT_SIDEBAR_GROUP_ITEMS: Record<string, readonly string[]> = {
  daily_ops: ['nav-calendar', 'nav-notes', 'nav-chores', 'nav-frequent-events'],
  biometrics: ['nav-lifestats', 'nav-distance'],
  wealth: ['nav-funds', 'nav-goals'],
  vault_sys: [
    'nav-gallery',
    'nav-import-hub',
    'nav-changelog',
    'nav-customization',
    'nav-settings',
    'nav-site-improvements',
    'nav-master-admin',
  ],
};

export const ALL_KNOWN_SIDEBAR_ITEMS: readonly string[] = Object.values(DEFAULT_SIDEBAR_GROUP_ITEMS).flat();

/**
 * Sanitizes a custom sidebar group->items map so every known subsection item belongs to
 * exactly one category (no duplicates, no missing items), while also preserving dynamic custom categories (`nav-custom-*`).
 */
export function sanitizeSidebarGroupItems(
  rawMap?: Record<string, string[]> | null,
  customCategories?: CustomNavCategory[] | null
): SidebarGroupItemsMap {
  const validGroupIds = new Set<string>(DEFAULT_SIDEBAR_GROUP_ORDER);
  const validItemIds = new Set<string>(ALL_KNOWN_SIDEBAR_ITEMS);
  const assignedItems = new Set<string>();
  const result: SidebarGroupItemsMap = {
    daily_ops: [],
    biometrics: [],
    wealth: [],
    vault_sys: [],
  };

  const isAllowedItemId = (id: string) =>
    validItemIds.has(id) || id.startsWith('nav-custom-');

  if (rawMap && typeof rawMap === 'object') {
    for (const groupId of DEFAULT_SIDEBAR_GROUP_ORDER) {
      const candidateList = rawMap[groupId];
      if (!Array.isArray(candidateList)) continue;
      for (const rawItemId of candidateList) {
        const itemId = typeof rawItemId === 'string' ? rawItemId.trim() : '';
        if (isAllowedItemId(itemId) && !assignedItems.has(itemId)) {
          result[groupId].push(itemId);
          assignedItems.add(itemId);
        }
      }
    }

    // Also inspect any extra keys in rawMap just in case
    for (const [groupId, candidateList] of Object.entries(rawMap)) {
      if (!validGroupIds.has(groupId) || !Array.isArray(candidateList)) continue;
      for (const rawItemId of candidateList) {
        const itemId = typeof rawItemId === 'string' ? rawItemId.trim() : '';
        if (isAllowedItemId(itemId) && !assignedItems.has(itemId)) {
          result[groupId].push(itemId);
          assignedItems.add(itemId);
        }
      }
    }
  }

  // Assign any remaining known items to their default group
  for (const groupId of DEFAULT_SIDEBAR_GROUP_ORDER) {
    const defaultsForGroup = DEFAULT_SIDEBAR_GROUP_ITEMS[groupId] || [];
    for (const defaultItemId of defaultsForGroup) {
      if (!assignedItems.has(defaultItemId)) {
        result[groupId].push(defaultItemId);
        assignedItems.add(defaultItemId);
      }
    }
  }

  // Ensure any dynamic custom categories are assigned to their parentGroupId if not yet placed
  if (Array.isArray(customCategories)) {
    for (const cat of customCategories) {
      if (!cat || !cat.id) continue;
      const itemId = `nav-custom-${cat.id}`;
      if (!assignedItems.has(itemId)) {
        const targetGroup =
          cat.parentGroupId && validGroupIds.has(cat.parentGroupId)
            ? cat.parentGroupId
            : 'vault_sys';
        result[targetGroup].push(itemId);
        assignedItems.add(itemId);
      }
    }
  }

  return result;
}

/**
 * Applies custom category order, custom cross-category subsection item placement,
 * and custom category/subsection labels to sidebar groups.
 */
export function applySidebarCustomization<
  TItem extends { id: string; label?: string },
  TGroup extends { id: string; label?: string; items: TItem[] }
>(
  defaultGroups: TGroup[],
  groupOrder?: string[] | null,
  groupItemsMap?: Record<string, string[]> | null,
  groupLabels?: Record<string, string> | null,
  itemLabels?: Record<string, string> | null,
  customCategories?: CustomNavCategory[] | null
): TGroup[] {
  const sanitizedGroupLabels = sanitizeSidebarGroupLabels(groupLabels);
  const sanitizedItemLabels = sanitizeSidebarItemLabels(itemLabels, customCategories);

  const itemLookup = new Map<string, TItem>();
  const defaultGroupByItemId = new Map<string, string>();
  for (const group of defaultGroups) {
    for (const item of group.items) {
      defaultGroupByItemId.set(item.id, group.id);
      const customItemLabel = sanitizedItemLabels[item.id];
      itemLookup.set(
        item.id,
        customItemLabel && typeof item.label === 'string'
          ? { ...item, label: customItemLabel }
          : item
      );
    }
  }

  const sanitizedItemsMap = sanitizeSidebarGroupItems(groupItemsMap, customCategories);
  const placedIds = new Set<string>();

  const customizedGroups: TGroup[] = defaultGroups.map((group) => {
    const targetItemIds = sanitizedItemsMap[group.id] || [];
    const resolvedItems: TItem[] = [];
    for (const itemId of targetItemIds) {
      const item = itemLookup.get(itemId);
      if (item && !placedIds.has(itemId)) {
        resolvedItems.push(item);
        placedIds.add(itemId);
      }
    }
    const customGroupLabel = sanitizedGroupLabels[group.id];
    return {
      ...group,
      ...(customGroupLabel && typeof group.label === 'string'
        ? { label: customGroupLabel }
        : {}),
      items: resolvedItems,
    };
  });

  // Safety fallback for any dynamic item not yet in sanitizedItemsMap: place in its default group
  for (const [itemId, item] of itemLookup.entries()) {
    if (!placedIds.has(itemId) && customizedGroups.length > 0) {
      const preferredGroupId = defaultGroupByItemId.get(itemId);
      const targetGroup =
        customizedGroups.find((g) => g.id === preferredGroupId) ||
        customizedGroups[customizedGroups.length - 1];
      targetGroup.items.push(item);
      placedIds.add(itemId);
    }
  }

  return orderSidebarGroups(customizedGroups, groupOrder);
}

/**
 * Resolves the active tab's category group name and subsection title, respecting custom labels and category placement.
 */
export function resolveTabBreadcrumb(
  tab: TabType,
  groupItemsMap?: Record<string, string[]> | null,
  groupLabels?: Record<string, string> | null,
  itemLabels?: Record<string, string> | null,
  customCategories?: CustomNavCategory[] | null
): { group: string; title: string } {
  const sanitizedItemLabels = sanitizeSidebarItemLabels(itemLabels, customCategories);
  if (tab === 'dashboard') {
    return {
      group: 'Command Center',
      title: sanitizedItemLabels['nav-dashboard'] || 'Dashboard',
    };
  }
  if (tab === 'shortcuts') {
    return {
      group: 'Shortcuts',
      title: sanitizedItemLabels['nav-shortcuts'] || 'Shortcuts',
    };
  }

  const sanitizedGroupLabels = sanitizeSidebarGroupLabels(groupLabels);
  const sanitizedItemsMap = sanitizeSidebarGroupItems(groupItemsMap, customCategories);

  if (tab.startsWith('custom_cat_')) {
    const customCat = (customCategories || []).find((c) => c.id === tab);
    const navItemId = `nav-custom-${tab}`;
    const title =
      sanitizedItemLabels[navItemId] || customCat?.name || 'Custom Workspace';
    let parentGroupId = customCat?.parentGroupId || 'vault_sys';
    for (const [gId, items] of Object.entries(sanitizedItemsMap)) {
      if (items.includes(navItemId)) {
        parentGroupId = gId;
        break;
      }
    }
    const group =
      sanitizedGroupLabels[parentGroupId] ||
      DEFAULT_SIDEBAR_GROUP_LABELS[parentGroupId] ||
      'Vault & System';
    return { group, title };
  }

  const itemId = TAB_TO_SIDEBAR_ITEM_ID[tab];
  if (!itemId) {
    return { group: 'Command Center', title: 'Dashboard' };
  }

  const title = sanitizedItemLabels[itemId] || DEFAULT_SIDEBAR_ITEM_LABELS[itemId] || 'Workspace';
  let parentGroupId = 'daily_ops';
  for (const [gId, items] of Object.entries(sanitizedItemsMap)) {
    if (items.includes(itemId)) {
      parentGroupId = gId;
      break;
    }
  }
  const group =
    sanitizedGroupLabels[parentGroupId] ||
    DEFAULT_SIDEBAR_GROUP_LABELS[parentGroupId] ||
    'Operations';

  return { group, title };
}

/**
 * Moves a sidebar subsection item via drag-and-drop either onto another item (in the same or a different category)
 * or directly onto a category header.
 */
export function moveSidebarItemByDrag(
  currentMap: Record<string, string[]> | null | undefined,
  sourceItemId: string,
  target:
    | { type: 'item'; targetItemId: string }
    | { type: 'group'; targetGroupId: string }
): SidebarGroupItemsMap {
  const base = sanitizeSidebarGroupItems(currentMap);
  const next: SidebarGroupItemsMap = {};
  let foundSource = false;

  for (const groupId of DEFAULT_SIDEBAR_GROUP_ORDER) {
    const filtered = (base[groupId] || []).filter((id) => {
      if (id === sourceItemId) {
        foundSource = true;
        return false;
      }
      return true;
    });
    next[groupId] = filtered;
  }

  // Allow dragging dynamic custom category items even if they weren't yet in currentMap
  if (!foundSource && sourceItemId.startsWith('nav-custom-')) {
    foundSource = true;
  }

  if (!foundSource) {
    return base;
  }

  if (target.type === 'group') {
    const destGroup = next[target.targetGroupId];
    if (!destGroup) return base;
    destGroup.push(sourceItemId);
    return sanitizeSidebarGroupItems(next);
  }

  if (target.targetItemId === sourceItemId) {
    return base;
  }

  for (const groupId of DEFAULT_SIDEBAR_GROUP_ORDER) {
    const list = next[groupId];
    const targetIdx = list.indexOf(target.targetItemId);
    if (targetIdx !== -1) {
      list.splice(targetIdx, 0, sourceItemId);
      return sanitizeSidebarGroupItems(next);
    }
  }

  return base;
}

/**
 * Moves a sidebar subsection item one step up or down.
 * When at the top or bottom boundary of its current category, seamlessly transfers the item
 * into the adjacent category above or below in the current category order.
 */
export function moveSidebarItemStep(
  currentMap: Record<string, string[]> | null | undefined,
  currentGroupOrder: string[] | null | undefined,
  itemId: string,
  direction: 'up' | 'down',
  visibleItemIds?: Set<string>
): SidebarGroupItemsMap {
  const base = sanitizeSidebarGroupItems(currentMap);
  const orderedGroups = sanitizeSidebarGroupOrder(currentGroupOrder);

  const next: SidebarGroupItemsMap = {};
  for (const gId of DEFAULT_SIDEBAR_GROUP_ORDER) {
    next[gId] = [...(base[gId] || [])];
  }

  let currentGroupIdx = -1;
  let itemIdxInGroup = -1;

  for (let gIdx = 0; gIdx < orderedGroups.length; gIdx++) {
    const gId = orderedGroups[gIdx];
    const list = next[gId] || [];
    const idx = list.indexOf(itemId);
    if (idx !== -1) {
      currentGroupIdx = gIdx;
      itemIdxInGroup = idx;
      break;
    }
  }

  if (currentGroupIdx === -1 || itemIdxInGroup === -1) {
    return base;
  }

  const currentGroupId = orderedGroups[currentGroupIdx];
  const currentList = next[currentGroupId];

  if (direction === 'up') {
    // Find previous visible item in the same group
    let prevIdx = itemIdxInGroup - 1;
    while (prevIdx >= 0 && visibleItemIds && !visibleItemIds.has(currentList[prevIdx])) {
      prevIdx--;
    }

    if (prevIdx >= 0) {
      [currentList[prevIdx], currentList[itemIdxInGroup]] = [
        currentList[itemIdxInGroup],
        currentList[prevIdx],
      ];
      return sanitizeSidebarGroupItems(next);
    }

    // At the top of the current group -> move to the end of the previous group in orderedGroups
    if (currentGroupIdx > 0) {
      const prevGroupId = orderedGroups[currentGroupIdx - 1];
      currentList.splice(itemIdxInGroup, 1);
      next[prevGroupId].push(itemId);
      return sanitizeSidebarGroupItems(next);
    }

    return base;
  } else {
    // Find next visible item in the same group
    let nextIdx = itemIdxInGroup + 1;
    while (
      nextIdx < currentList.length &&
      visibleItemIds &&
      !visibleItemIds.has(currentList[nextIdx])
    ) {
      nextIdx++;
    }

    if (nextIdx < currentList.length) {
      [currentList[itemIdxInGroup], currentList[nextIdx]] = [
        currentList[nextIdx],
        currentList[itemIdxInGroup],
      ];
      return sanitizeSidebarGroupItems(next);
    }

    // At the bottom of the current group -> move to the start of the next group in orderedGroups
    if (currentGroupIdx < orderedGroups.length - 1) {
      const nextGroupId = orderedGroups[currentGroupIdx + 1];
      currentList.splice(itemIdxInGroup, 1);
      next[nextGroupId].unshift(itemId);
      return sanitizeSidebarGroupItems(next);
    }

    return base;
  }
}

export interface SidebarItemFilterTarget {
  id: string;
  label: string;
  keywords?: string[];
}

export interface SidebarGroupFilterTarget<TItem extends SidebarItemFilterTarget> {
  id: string;
  label: string;
  items: TItem[];
}

export const SIDEBAR_TAB_SHORTCUTS: Record<string, TabType> = {
  '1': 'dashboard',
  '2': 'calendar',
  '3': 'notes',
  '4': 'lifestats',
  '5': 'distance',
  '6': 'funds',
  '7': 'goals',
  '8': 'gallery',
  '9': 'settings',
  '0': 'calendar',
  c: 'calendar',
  C: 'calendar',
};

/**
 * Computes live tabular-nums operational metrics for the sidebar navigation items.
 */
export function computeSidebarMetrics(
  appData: AppData | null | undefined,
  todayIso?: string
): SidebarMetrics {
  const currentDay = todayIso || new Date().toISOString().slice(0, 10);

  const timeline = appData?.timeline || [];
  const dailyNotes = appData?.dailyNotes || [];
  const chores = appData?.chores || [];
  const frequentEvents = appData?.frequentEvents || [];
  const lifeStats = appData?.lifeStats || [];
  const distances = appData?.distances || [];
  const funds = appData?.funds || [];
  const bills = appData?.bills || [];
  const goals = appData?.goals || [];
  const gallery = appData?.gallery || [];
  const shortcuts = appData?.shortcuts || [];
  const siteImprovements = appData?.siteImprovements || [];

  const todayTimelineCount = timeline.filter((entry) => entry.date === currentDay).length;
  const calendarDaysSet = new Set<string>();
  for (const entry of timeline) {
    if (entry?.date) calendarDaysSet.add(entry.date);
  }
  const calendarDaysCount = calendarDaysSet.size;
  const pinnedNotesCount = dailyNotes.filter((note) => Boolean(note.isPinned)).length;
  const activeGoalsCount = goals.filter((goal) => goal.status !== 'completed').length;
  const completedGoalsCount = goals.filter((goal) => goal.status === 'completed').length;

  const totalRecordsCount =
    timeline.length +
    dailyNotes.length +
    chores.length +
    lifeStats.length +
    distances.length +
    funds.length +
    bills.length +
    goals.length +
    gallery.length;

  return {
    timelineCount: timeline.length,
    todayTimelineCount,
    calendarDaysCount,
    notesCount: dailyNotes.length,
    pinnedNotesCount,
    choresCount: chores.length,
    frequentEventsCount: frequentEvents.length,
    lifeStatsCount: lifeStats.length,
    distancesCount: distances.length,
    fundsCount: funds.length + bills.length,
    billsCount: bills.length,
    goalsCount: goals.length,
    activeGoalsCount,
    completedGoalsCount,
    galleryCount: gallery.length,
    shortcutsCount: shortcuts.length,
    siteImprovementsCount: siteImprovements.length,
    totalRecordsCount,
  };
}

/**
 * Filters sidebar navigation groups and items by a user search query.
 */
export function filterSidebarGroups<
  TItem extends SidebarItemFilterTarget,
  TGroup extends SidebarGroupFilterTarget<TItem>
>(groups: TGroup[], rawQuery: string): TGroup[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return groups;
  }

  const filtered: TGroup[] = [];

  for (const group of groups) {
    const groupMatches = group.label.toLowerCase().includes(query);
    if (groupMatches) {
      filtered.push(group);
      continue;
    }

    const matchingItems = group.items.filter((item) => {
      if (item.label.toLowerCase().includes(query)) return true;
      if (item.id.toLowerCase().includes(query)) return true;
      if (item.keywords && item.keywords.some((kw) => kw.toLowerCase().includes(query))) {
        return true;
      }
      return false;
    });

    if (matchingItems.length > 0) {
      filtered.push({
        ...group,
        items: matchingItems,
      });
    }
  }

  return filtered;
}

/**
 * Resolves keyboard shortcuts for sidebar navigation (Alt+1..9) and rail collapse toggle ('[').
 */
export function resolveSidebarShortcut(
  event: {
    key: string;
    altKey: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  },
  isEditableTarget: boolean
): { type: 'tab'; tab: TabType } | { type: 'toggle-collapse' } | null {
  if (isEditableTarget) {
    return null;
  }

  // Alt + 1..9 switches primary workspace tabs
  if (event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
    const targetTab = SIDEBAR_TAB_SHORTCUTS[event.key];
    if (targetTab) {
      return { type: 'tab', tab: targetTab };
    }
  }

  // '[' key toggles sidebar rail collapse when no modifier keys are held
  if (
    event.key === '[' &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  ) {
    return { type: 'toggle-collapse' };
  }

  return null;
}

