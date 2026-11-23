import {
  AppData,
  BillEntry,
  BillFrequency,
  CustomNavCategory,
  CustomPanelColor,
  CustomPanelType,
  CustomTableColumnDef,
  DashboardWidgetConfig,
  DashboardWidgetId,
  GridDensityMode,
  LayoutConfig,
  PageWidthMode,
  ShortcutItem,
  SidebarPositionMode,
  WidgetColSpan,
} from '../types';
import {
  createInitialAppData,
  DEFAULT_DASHBOARD_WIDGETS,
  DEFAULT_LAYOUT_CONFIG,
  DEFAULT_SETTINGS,
} from './defaults';
import {
  ACCENT_THEMES,
  isValidAccentColor,
  resolveAccentTheme,
  resolveSurfaceConfig,
  resolveTextColorConfig,
} from './theme';
import { resolveCategoriesForAppData } from './categoryEngine';
import { sanitizeFundEntries } from './fundsRegexParser';
import {
  calculateDurationMinutes,
  calculateFundsSummary,
} from './calculations';
import { syncGoalsWithLiveModules } from './aegisUpgradesEngine';
import {
  sanitizeSidebarGroupItems,
  sanitizeSidebarGroupLabels,
  sanitizeSidebarGroupOrder,
  sanitizeSidebarItemLabels,
} from './sidebarEngine';
import { sanitizeChoresList } from '../components/chores/choresStore';

export const MATRIX_GRID_COLUMNS = 3;
export const AXIOMS_STORAGE_KEY = 'axioms_dailies_state';
export const CLEAN_SLATE_MIGRATION_KEY = 'axiom_clean_slate_v1_1_01_migrated';

/**
 * Executes the one-time Clean Slate Migration to purge legacy demo/seeded
 * data persisted in localStorage and sessionStorage from earlier versions.
 */
export function runCleanSlateMigrationV1101(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
): boolean {
  const targetStorage =
    storage ?? (typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined);
  if (!targetStorage) return false;

  try {
    if (targetStorage.getItem(CLEAN_SLATE_MIGRATION_KEY) === 'true') {
      return false;
    }

    targetStorage.removeItem(AXIOMS_STORAGE_KEY);
    targetStorage.removeItem('axiom_dailies_encrypted_vault');
    targetStorage.removeItem('axiom_quote_engine_state_v1');
    targetStorage.removeItem('axiom_custom_categories_v1');
    targetStorage.removeItem('axiom_aegis_tactical_note_draft_v1');

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem('axiom_aegis_tactical_note_draft_v1');
      } catch {
        // Ignore sessionStorage errors
      }
    }

    targetStorage.setItem(CLEAN_SLATE_MIGRATION_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

export type MatrixDirection = 'left' | 'right' | 'up' | 'down';

export const DEFAULT_WIDGET_TITLES: Record<string, string> = {
  weather: 'Weather',
  kpi_funds: 'Net Funds Balance',
  kpi_mood: 'Latest Mood & Weight',
  kpi_distance: 'Run Distance',
  mini_calendar: 'Calendar & Schedule',
  aegis_visualizer: 'Lightning in a Bottle',
  plasma_sphere: 'Lightning in a Bottle',
  funds_recent: 'Expense Tracker',
  life_stats_panel: 'Life Stats',
  distance_panel: 'Distance',
  short_term_goals: 'Short-Term Milestones',
  goals_preview: 'Goals & Milestones',
  gallery_preview: 'Private Gallery',
  daily_notes: 'Daily Notes',
  frequent_events: 'Frequent Events',
  quick_capture: 'Quick Capture Matrix',
};

const VALID_PANEL_TYPES: CustomPanelType[] = [
  'checklist',
  'notes',
  'counter',
  'habits',
  'key_value',
];

const VALID_PANEL_COLORS: CustomPanelColor[] = Object.keys(ACCENT_THEMES) as CustomPanelColor[];

/**
 * Normalizes any legacy or numeric colSpan into 1 | 2 | 3 | 'full'.
 */
export function normalizeColSpan(span?: WidgetColSpan): 1 | 2 | 3 | 'full' {
  if (span === 'full') return 'full';
  if (span === 3) return 3;
  if (span === 2 || span === 'half') return 2;
  return 1;
}

/**
 * Computes responsive Tailwind col-span classes for 1x, 2x, 3x, or Full Width
 * within a 2, 3, or 4 column 2D CSS Grid.
 */
export function getColSpanClass(span: WidgetColSpan | undefined, gridCols: 2 | 3 | 4 = 3): string {
  const norm = normalizeColSpan(span);
  if (norm === 'full') {
    return 'col-span-1 md:col-span-2 lg:col-span-full';
  }
  if (norm === 3) {
    if (gridCols === 2) return 'col-span-1 md:col-span-2 lg:col-span-2';
    if (gridCols === 3) return 'col-span-1 md:col-span-2 lg:col-span-3';
    return 'col-span-1 md:col-span-2 lg:col-span-3';
  }
  if (norm === 2) {
    return 'col-span-1 md:col-span-2 lg:col-span-2';
  }
  return 'col-span-1';
}

/**
 * Sanitizes user-edited panel or column header titles against injection and trims whitespace.
 */
export function sanitizeColumnTitle(rawInput: string, fallbackTitle: string): string {
  if (typeof rawInput !== 'string') return fallbackTitle;
  const stripped = rawInput
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) return fallbackTitle;
  return stripped.slice(0, 64);
}

/**
 * Computes the target index for a 2D matrix movement given a column grid width.
 * - Left / Right: linear index shift (-1 / +1)
 * - Up / Down: vertical row shift (-cols / +cols, default +/- 3)
 */
export function getTargetMatrixIndex(
  currentIndex: number,
  totalLength: number,
  direction: MatrixDirection,
  cols: number = MATRIX_GRID_COLUMNS
): number | null {
  if (currentIndex < 0 || currentIndex >= totalLength) return null;

  let targetIndex = currentIndex;
  switch (direction) {
    case 'left':
      targetIndex = currentIndex - 1;
      break;
    case 'right':
      targetIndex = currentIndex + 1;
      break;
    case 'up':
      targetIndex = currentIndex - cols;
      break;
    case 'down':
      targetIndex = currentIndex + cols;
      break;
  }

  if (targetIndex < 0 || targetIndex >= totalLength) {
    return null;
  }

  return targetIndex;
}

/**
 * Checks whether a card at `currentIndex` can move in `direction` within the 2D matrix.
 */
export function canMoveInMatrix(
  currentIndex: number,
  totalLength: number,
  direction: MatrixDirection,
  cols: number = MATRIX_GRID_COLUMNS
): boolean {
  return getTargetMatrixIndex(currentIndex, totalLength, direction, cols) !== null;
}

/**
 * Executes a 2D matrix swap in the card array:
 * - Left/Right swaps adjacent linear indices (index +/- 1)
 * - Up/Down swaps across rows based on column count (index +/- cols)
 */
export function moveCardInMatrix(
  widgets: DashboardWidgetConfig[],
  currentIndex: number,
  direction: MatrixDirection,
  cols: number = MATRIX_GRID_COLUMNS
): DashboardWidgetConfig[] {
  const targetIndex = getTargetMatrixIndex(currentIndex, widgets.length, direction, cols);
  if (targetIndex === null) {
    return widgets.map((w, idx) => ({ ...w, order: idx }));
  }

  const next = [...widgets];
  const temp = next[currentIndex];
  next[currentIndex] = next[targetIndex];
  next[targetIndex] = temp;

  return next.map((item, idx) => ({
    ...item,
    order: idx,
  }));
}

/**
 * Reorders a card via Drag-and-Drop from `fromIndex` to `toIndex` in the 2D matrix.
 */
export function dragReorderInMatrix(
  widgets: DashboardWidgetConfig[],
  fromIndex: number,
  toIndex: number
): DashboardWidgetConfig[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= widgets.length ||
    toIndex >= widgets.length ||
    fromIndex === toIndex
  ) {
    return widgets.map((w, idx) => ({ ...w, order: idx }));
  }

  const next = [...widgets];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return next.map((item, idx) => ({
    ...item,
    order: idx,
  }));
}

/**
 * Updates the customTitle of a specific card in the 2D matrix after sanitizing input.
 */
export function updateMatrixCardTitle(
  widgets: DashboardWidgetConfig[],
  widgetId: DashboardWidgetId,
  newRawTitle: string
): DashboardWidgetConfig[] {
  const fallback = DEFAULT_WIDGET_TITLES[widgetId] || 'Custom Panel';
  const cleanTitle = sanitizeColumnTitle(newRawTitle, fallback);

  return widgets.map((w) =>
    w.id === widgetId
      ? {
          ...w,
          customTitle: cleanTitle,
        }
      : w
  );
}

/**
 * Updates the width span (1x, 2x, 3x, or 'full') of a card in the 2D matrix.
 */
export function updateMatrixCardSpan(
  widgets: DashboardWidgetConfig[],
  widgetId: DashboardWidgetId,
  newSpan: 1 | 2 | 3 | 'full'
): DashboardWidgetConfig[] {
  return widgets.map((w) =>
    w.id === widgetId
      ? {
          ...w,
          colSpan: newSpan,
        }
      : w
  );
}

/**
 * Toggles visibility of a card in the 2D matrix.
 */
export function toggleMatrixCardVisibility(
  widgets: DashboardWidgetConfig[],
  widgetId: DashboardWidgetId
): DashboardWidgetConfig[] {
  return widgets.map((w) =>
    w.id === widgetId
      ? {
          ...w,
          visible: !w.visible,
        }
      : w
  );
}

/**
 * Returns an array of the last 7 YYYY-MM-DD strings ending on `referenceDateStr` (chronological order).
 */
export function getLast7DayStrings(referenceDateStr?: string): string[] {
  const baseDate = referenceDateStr ? new Date(`${referenceDateStr}T12:00:00Z`) : new Date();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(baseDate.getTime() - i * 86400000);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

/**
 * Calculates consecutive day streak for a habit given its completedDates array.
 */
export function calculateHabitStreak(completedDates: string[], referenceDateStr?: string): number {
  if (!Array.isArray(completedDates) || completedDates.length === 0) return 0;
  const set = new Set(completedDates);
  const baseDate = referenceDateStr ? new Date(`${referenceDateStr}T12:00:00Z`) : new Date();
  const todayStr = baseDate.toISOString().split('T')[0];
  const yesterdayStr = new Date(baseDate.getTime() - 86400000).toISOString().split('T')[0];

  let cursor = set.has(todayStr)
    ? baseDate
    : set.has(yesterdayStr)
    ? new Date(baseDate.getTime() - 86400000)
    : null;

  if (!cursor) return 0;

  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dStr = new Date(cursor.getTime() - i * 86400000).toISOString().split('T')[0];
    if (set.has(dStr)) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export interface CreateCustomPanelOptions {
  panelType?: CustomPanelType;
  panelColor?: CustomPanelColor;
  colSpan?: 1 | 2 | 3 | 'full';
  targetValue?: number;
  unit?: string;
  step?: number;
}

/**
 * Creates and appends a new custom user panel to the 2D matrix.
 * Supports all 5 functional templates: 'checklist' | 'notes' | 'counter' | 'habits' | 'key_value'.
 */
export function createCustomMatrixColumn(
  widgets: DashboardWidgetConfig[],
  rawTitle: string,
  colSpanOrOptions: (1 | 2 | 3 | 'full') | CreateCustomPanelOptions = 1,
  panelTypeArg?: CustomPanelType,
  panelColorArg?: CustomPanelColor
): DashboardWidgetConfig[] {
  const opts: CreateCustomPanelOptions =
    typeof colSpanOrOptions === 'object' && colSpanOrOptions !== null
      ? colSpanOrOptions
      : {
          colSpan: colSpanOrOptions,
          panelType: panelTypeArg || 'checklist',
          panelColor: panelColorArg || 'cyan',
        };

  const panelType: CustomPanelType =
    opts.panelType && VALID_PANEL_TYPES.includes(opts.panelType) ? opts.panelType : 'checklist';
  const panelColor: CustomPanelColor =
    opts.panelColor && VALID_PANEL_COLORS.includes(opts.panelColor) ? opts.panelColor : 'cyan';
  const colSpan = normalizeColSpan(opts.colSpan ?? 1);
  const cleanTitle = sanitizeColumnTitle(rawTitle, 'Custom Tactical Panel');
  const todayStr = new Date().toISOString().split('T')[0];

  const newWidget: DashboardWidgetConfig = {
    id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    visible: true,
    colSpan,
    order: widgets.length,
    customTitle: cleanTitle,
    isCustom: true,
    panelType,
    panelColor,
    customItems: [
      { id: `ci-${Date.now()}-1`, text: 'Execute primary priority item', completed: false },
    ],
    customNotes: 'Encrypted scratchpad ready for tactical notes and protocol memos.',
    customCounter: {
      currentValue: 0,
      targetValue: typeof opts.targetValue === 'number' && opts.targetValue > 0 ? opts.targetValue : 8,
      unit: opts.unit ? sanitizeColumnTitle(opts.unit, 'units') : 'units',
      step: typeof opts.step === 'number' && opts.step > 0 ? opts.step : 1,
    },
    customHabits: [
      {
        id: `hab-${Date.now()}-1`,
        title: 'Deep Focus Session',
        completedDates: [todayStr],
      },
      {
        id: `hab-${Date.now()}-2`,
        title: 'Mobility & Hydration',
        completedDates: [],
      },
    ],
    customKeyValues: [
      { id: `kv-${Date.now()}-1`, label: 'Protocol Status', value: 'Nominal' },
      { id: `kv-${Date.now()}-2`, label: 'Daily Target', value: '100% Execution' },
    ],
  };

  return [...widgets, newWidget].map((w, idx) => ({ ...w, order: idx }));
}

/**
 * Validates that a candidate array conforms to the DashboardWidgetConfig schema.
 */
export function isValidMatrixLayout(candidate: unknown): candidate is DashboardWidgetConfig[] {
  if (!Array.isArray(candidate) || candidate.length === 0) return false;
  return candidate.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof (item as DashboardWidgetConfig).id === 'string' &&
      typeof (item as DashboardWidgetConfig).visible === 'boolean' &&
      typeof (item as DashboardWidgetConfig).order === 'number'
  );
}

/**
 * Sanitizes custom fields dictionary on a TimelineEntry or FundEntry.
 */
export function sanitizeCustomFields(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const cleanKey = sanitizeTextInput(k, '', 64);
    if (cleanKey && typeof v === 'string') {
      result[cleanKey] = sanitizeTextInput(v, '', 200);
    } else if (cleanKey && typeof v === 'number') {
      result[cleanKey] = String(v);
    }
  }
  return result;
}

/**
 * Validates and normalizes a complete LayoutConfig object.
 */
export function sanitizeLayoutConfig(
  candidate: unknown,
  fallback: LayoutConfig = DEFAULT_LAYOUT_CONFIG,
  customCategories?: CustomNavCategory[] | null
): LayoutConfig {
  if (!candidate || typeof candidate !== 'object') {
    return fallback;
  }

  const raw = candidate as Partial<LayoutConfig>;
  const gridColumns: 2 | 3 | 4 =
    raw.gridColumns === 2 || raw.gridColumns === 3 || raw.gridColumns === 4
      ? raw.gridColumns
      : fallback.gridColumns;

  const pageWidth: PageWidthMode =
    raw.pageWidth === 'standard' || raw.pageWidth === 'ultrawide' || raw.pageWidth === 'full'
      ? raw.pageWidth
      : fallback.pageWidth;

  const customPageMaxWidthPx =
    typeof raw.customPageMaxWidthPx === 'number' &&
    !isNaN(raw.customPageMaxWidthPx) &&
    raw.customPageMaxWidthPx >= 960 &&
    raw.customPageMaxWidthPx <= 3840
      ? Math.round(raw.customPageMaxWidthPx)
      : fallback.customPageMaxWidthPx;

  const density: GridDensityMode =
    raw.density === 'compact' || raw.density === 'comfortable' || raw.density === 'spacious'
      ? raw.density
      : fallback.density;

  const customGridGapPx =
    typeof raw.customGridGapPx === 'number' &&
    !isNaN(raw.customGridGapPx) &&
    raw.customGridGapPx >= 6 &&
    raw.customGridGapPx <= 48
      ? Math.round(raw.customGridGapPx)
      : fallback.customGridGapPx;

  const fontScale =
    typeof raw.fontScale === 'number' && raw.fontScale >= 0.85 && raw.fontScale <= 1.35
      ? Math.round(raw.fontScale * 100) / 100
      : fallback.fontScale;

  const isLegacyLayout = !raw.layoutVersion || raw.layoutVersion < 4;
  const promoteKpiWidgets = !raw.layoutVersion || raw.layoutVersion < 5;

  const widgets = isValidMatrixLayout(raw.widgets)
    ? mergeWithSystemWidgets(raw.widgets, fallback.widgets, isLegacyLayout, promoteKpiWidgets)
    : fallback.widgets;

  const customFundsColumns: CustomTableColumnDef[] = Array.isArray(raw.customFundsColumns)
    ? raw.customFundsColumns
        .filter((c: any) => c && typeof c.id === 'string' && typeof c.label === 'string')
        .map((c: any) => ({
          id: sanitizeTextInput(c.id, `cf_${Date.now()}`, 48),
          label: sanitizeColumnTitle(c.label, 'Custom Column'),
          type: c.type === 'number' || c.type === 'badge' ? c.type : 'text',
        }))
    : fallback.customFundsColumns || [];

  const customTimelineColumns: CustomTableColumnDef[] = Array.isArray(raw.customTimelineColumns)
    ? raw.customTimelineColumns
        .filter((c: any) => c && typeof c.id === 'string' && typeof c.label === 'string')
        .map((c: any) => ({
          id: sanitizeTextInput(c.id, `ct_${Date.now()}`, 48),
          label: sanitizeColumnTitle(c.label, 'Custom Column'),
          type: c.type === 'number' || c.type === 'badge' ? c.type : 'text',
        }))
    : fallback.customTimelineColumns || [];

  const hiddenFundsColumns = Array.isArray(raw.hiddenFundsColumns)
    ? raw.hiddenFundsColumns.filter((id): id is string => typeof id === 'string')
    : fallback.hiddenFundsColumns || [];

  const hiddenTimelineColumns = Array.isArray(raw.hiddenTimelineColumns)
    ? raw.hiddenTimelineColumns.filter((id): id is string => typeof id === 'string')
    : fallback.hiddenTimelineColumns || [];

  const sidebarGroupOrder = sanitizeSidebarGroupOrder(
    Array.isArray(raw.sidebarGroupOrder)
      ? raw.sidebarGroupOrder
      : fallback.sidebarGroupOrder
  );

  const sidebarGroupItems = sanitizeSidebarGroupItems(
    raw.sidebarGroupItems && typeof raw.sidebarGroupItems === 'object'
      ? raw.sidebarGroupItems
      : fallback.sidebarGroupItems,
    customCategories
  );

  const sidebarGroupLabels = sanitizeSidebarGroupLabels(
    raw.sidebarGroupLabels && typeof raw.sidebarGroupLabels === 'object'
      ? raw.sidebarGroupLabels
      : fallback.sidebarGroupLabels
  );

  const sidebarItemLabels = sanitizeSidebarItemLabels(
    raw.sidebarItemLabels && typeof raw.sidebarItemLabels === 'object'
      ? raw.sidebarItemLabels
      : fallback.sidebarItemLabels,
    customCategories
  );

  const sidebarPosition: SidebarPositionMode =
    raw.sidebarPosition === 'bottom' || raw.sidebarPosition === 'left'
      ? raw.sidebarPosition
      : fallback.sidebarPosition || 'left';

  const sidebarIconColor =
    typeof raw.sidebarIconColor === 'string' && /^#[0-9A-Fa-f]{6}$/.test(raw.sidebarIconColor.trim())
      ? raw.sidebarIconColor.trim()
      : fallback.sidebarIconColor || '#00E5FF';

  return {
    layoutVersion: 5,
    widgets,
    gridColumns,
    pageWidth,
    customPageMaxWidthPx,
    fontScale,
    density,
    customGridGapPx,
    sidebarPosition,
    sidebarIconColor,
    fundsColumnTitles: {
      ...fallback.fundsColumnTitles,
      ...(raw.fundsColumnTitles || {}),
    },
    timelineColumnTitles: {
      ...fallback.timelineColumnTitles,
      ...(raw.timelineColumnTitles || {}),
    },
    hiddenFundsColumns,
    hiddenTimelineColumns,
    customFundsColumns,
    customTimelineColumns,
    sidebarGroupOrder,
    sidebarGroupItems,
    sidebarGroupLabels,
    sidebarItemLabels,
  };
}

const DE_DUPLICATED_HIDDEN_BY_DEFAULT = new Set([
  'life_stats_panel',
  'distance_panel',
  'quick_capture',
  'short_term_goals',
]);

const PROMOTED_DASHBOARD_KPI_WIDGET_IDS = new Set([
  'kpi_funds',
  'kpi_mood',
  'kpi_distance',
]);

const REMOVED_LEGACY_WIDGET_IDS = new Set(['timeline_today', 'kpi_focus', 'dice_roller']);

/**
 * Merges saved widgets with system default widgets so no built-in panel is ever lost,
 * while preserving user custom panels (`isCustom: true` or `custom_*`).
 */
export function mergeWithSystemWidgets(
  savedMatrix: DashboardWidgetConfig[],
  fallbackWidgets: DashboardWidgetConfig[] = DEFAULT_DASHBOARD_WIDGETS,
  migrateLegacyDeDuplication: boolean = false,
  promoteKpiWidgetsToDashboard: boolean = false
): DashboardWidgetConfig[] {
  const filteredSaved = savedMatrix.filter((item) => !REMOVED_LEGACY_WIDGET_IDS.has(String(item.id)));
  const savedMap = new Map<string, DashboardWidgetConfig>();
  for (const item of filteredSaved) {
    savedMap.set(item.id, item);
  }

  const merged: DashboardWidgetConfig[] = [];
  for (const item of filteredSaved) {
    const isSystem = fallbackWidgets.some((fw) => fw.id === item.id);
    const isCustom = item.isCustom || String(item.id).startsWith('custom_');
    if (isSystem || isCustom) {
      const shouldHideOnUpgrade =
        migrateLegacyDeDuplication && DE_DUPLICATED_HIDDEN_BY_DEFAULT.has(item.id);
      const shouldPromoteKpi =
        promoteKpiWidgetsToDashboard && PROMOTED_DASHBOARD_KPI_WIDGET_IDS.has(item.id);
      const rawTitle =
        item.id === 'goals_preview' && item.customTitle === 'Long-Term Goals'
          ? 'Goals & Milestones'
          : (item.id === 'aegis_visualizer' || item.id === 'plasma_sphere') &&
            item.customTitle === 'AEGIS CORE // QUANTUM SHIELD VIZ'
          ? 'Lightning in a Bottle'
          : item.id === 'kpi_mood' && item.customTitle === 'Mood & Vitality'
          ? 'Latest Mood & Weight'
          : item.id === 'kpi_distance' && item.customTitle === 'Total Traveled'
          ? 'Run Distance'
          : item.customTitle || DEFAULT_WIDGET_TITLES[item.id] || 'Custom Panel';

      merged.push({
        ...item,
        visible: shouldPromoteKpi ? true : shouldHideOnUpgrade ? false : item.visible,
        colSpan: normalizeColSpan(item.colSpan),
        panelType:
          item.panelType && VALID_PANEL_TYPES.includes(item.panelType)
            ? item.panelType
            : isCustom
            ? 'checklist'
            : undefined,
        panelColor:
          item.panelColor && VALID_PANEL_COLORS.includes(item.panelColor)
            ? item.panelColor
            : isCustom
            ? 'cyan'
            : undefined,
        customTitle: sanitizeColumnTitle(
          rawTitle,
          DEFAULT_WIDGET_TITLES[item.id] || 'Custom Panel'
        ),
      });
    }
  }

  for (const fw of fallbackWidgets) {
    if (!savedMap.has(fw.id)) {
      merged.push({
        ...fw,
        colSpan: normalizeColSpan(fw.colSpan),
        order: merged.length,
        customTitle: fw.customTitle || DEFAULT_WIDGET_TITLES[fw.id] || fw.id,
      });
    }
  }

  return merged.map((w, idx) => ({ ...w, order: idx }));
}

/**
 * Persists the 2D matrix layout and custom titles to localStorage under `axioms_dailies_state`.
 */
export function saveMatrixLayoutToLocalStorage(
  widgets: DashboardWidgetConfig[],
  layoutExtras?: Partial<Omit<LayoutConfig, 'widgets'>>
): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  if (!isValidMatrixLayout(widgets)) return false;

  try {
    let existingState: Record<string, unknown> = {};
    const raw = window.localStorage.getItem(AXIOMS_STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          existingState = parsed as Record<string, unknown>;
        }
      } catch {
        existingState = {};
      }
    }

    const sanitizedWidgets = widgets.map((w, idx) => ({
      ...w,
      colSpan: normalizeColSpan(w.colSpan),
      order: idx,
      customTitle: w.customTitle
        ? sanitizeColumnTitle(w.customTitle, DEFAULT_WIDGET_TITLES[w.id] || 'Custom Panel')
        : DEFAULT_WIDGET_TITLES[w.id] || 'Custom Panel',
    }));

    const existingLayoutConfig =
      existingState.layoutConfig && typeof existingState.layoutConfig === 'object'
        ? (existingState.layoutConfig as Partial<LayoutConfig>)
        : {};

    const nextLayoutConfig: LayoutConfig = sanitizeLayoutConfig({
      ...DEFAULT_LAYOUT_CONFIG,
      ...existingLayoutConfig,
      ...(layoutExtras || {}),
      layoutVersion: 4,
      widgets: sanitizedWidgets,
    });

    const payload = {
      ...existingState,
      matrixLayout: sanitizedWidgets,
      layoutConfig: nextLayoutConfig,
      updatedAt: Date.now(),
    };

    window.localStorage.setItem(AXIOMS_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads the persisted 2D matrix layout and custom panel titles from localStorage with graceful fallback.
 */
export function loadMatrixLayoutFromLocalStorage(
  fallbackWidgets: DashboardWidgetConfig[] = DEFAULT_DASHBOARD_WIDGETS
): DashboardWidgetConfig[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallbackWidgets;
  }

  try {
    runCleanSlateMigrationV1101(window.localStorage);
    const raw = window.localStorage.getItem(AXIOMS_STORAGE_KEY);
    if (!raw) return fallbackWidgets;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallbackWidgets;

    const rawLayoutConfig = (parsed as { layoutConfig?: Partial<LayoutConfig> }).layoutConfig;
    const savedMatrix =
      rawLayoutConfig?.widgets ?? (parsed as { matrixLayout?: unknown }).matrixLayout;

    if (!isValidMatrixLayout(savedMatrix)) return fallbackWidgets;

    const isLegacy = !rawLayoutConfig?.layoutVersion || rawLayoutConfig.layoutVersion < 4;
    return mergeWithSystemWidgets(savedMatrix, fallbackWidgets, isLegacy);
  } catch {
    return fallbackWidgets;
  }
}

/**
 * Loads the full LayoutConfig (widgets, gridColumns, pageWidth, fontScale, density) from localStorage.
 */
export function loadLayoutConfigFromLocalStorage(
  fallbackConfig: LayoutConfig = DEFAULT_LAYOUT_CONFIG
): LayoutConfig {
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallbackConfig;
  }

  try {
    runCleanSlateMigrationV1101(window.localStorage);
    const raw = window.localStorage.getItem(AXIOMS_STORAGE_KEY);
    if (!raw) return fallbackConfig;

    const parsed = JSON.parse(raw) as Record<string, any>;
    if (!parsed || typeof parsed !== 'object') return fallbackConfig;

    const rawLayout = parsed.layoutConfig ?? parsed.settings?.layoutConfig;
    if (rawLayout) {
      return sanitizeLayoutConfig(rawLayout, fallbackConfig);
    }

    const rawWidgets =
      parsed.matrixLayout ?? parsed.panels ?? parsed.settings?.dashboardWidgets;
    if (isValidMatrixLayout(rawWidgets)) {
      return sanitizeLayoutConfig(
        {
          ...fallbackConfig,
          layoutVersion: 4,
          widgets: rawWidgets,
        },
        fallbackConfig
      );
    }

    return fallbackConfig;
  } catch {
    return fallbackConfig;
  }
}

/**
 * Sanitizes user-input strings for task descriptions, expense names, and goal titles
 * against injection and trims leading/trailing whitespace prior to state insertion.
 */
export function sanitizeTextInput(
  rawInput: unknown,
  fallback: string = '',
  maxLength: number = 140
): string {
  if (typeof rawInput !== 'string') return fallback;
  const cleaned = rawInput
    .replace(/<[^>]*>/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}

/**
 * Strictly validates and normalizes all state objects (timeline, expenses/funds, stats/lifeStats,
 * distance/distances, shortTermGoals, longTermGoals, layoutConfig) against predefined schemas,
 * falling back gracefully to factory defaults if any field is missing or corrupted.
 */
export function validateAndSanitizeAppData(
  candidate: unknown,
  customName?: string,
  customUserName?: string
): AppData {
  const initial = createInitialAppData(customName, customUserName);
  if (!candidate || typeof candidate !== 'object') {
    return initial;
  }

  const raw = candidate as Record<string, any>;
  const rawSettings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const rawLayoutCandidate =
    rawSettings.layoutConfig ??
    raw.layoutConfig ??
    (Array.isArray(rawSettings.dashboardWidgets ?? raw.matrixLayout ?? raw.panels)
      ? {
          ...DEFAULT_LAYOUT_CONFIG,
          layoutVersion: 4,
          widgets: rawSettings.dashboardWidgets ?? raw.matrixLayout ?? raw.panels,
        }
      : undefined);
  const layoutConfig = sanitizeLayoutConfig(rawLayoutCandidate, DEFAULT_LAYOUT_CONFIG);

  const rawTimeline = Array.isArray(raw.timeline) ? raw.timeline : initial.timeline;
  const timeline = rawTimeline
    .filter((t: any) => t && typeof t === 'object' && typeof t.id === 'string')
    .map((t: any) => {
      const startTime = typeof t.startTime === 'string' && t.startTime ? t.startTime : '09:00';
      const endTime = typeof t.endTime === 'string' && t.endTime ? t.endTime : '10:00';
      const computedDur = calculateDurationMinutes(startTime, endTime);
      return {
        ...t,
        title: sanitizeTextInput(t.title, 'Untitled Activity', 120),
        date:
          typeof t.date === 'string' && t.date
            ? t.date
            : initial.timeline[0]?.date || '2026-10-22',
        startTime,
        endTime,
        durationMinutes:
          typeof t.durationMinutes === 'number' && t.durationMinutes > 0
            ? t.durationMinutes
            : computedDur > 0
            ? computedDur
            : 60,
        notes: t.notes ? sanitizeTextInput(t.notes, '', 300) : undefined,
        customFields: sanitizeCustomFields(t.customFields),
        createdAt: typeof t.createdAt === 'number' ? t.createdAt : Date.now(),
      };
    });

  const rawFunds = Array.isArray(raw.funds)
    ? raw.funds
    : Array.isArray(raw.expenses)
    ? raw.expenses
    : initial.funds;
  const mappedFunds = rawFunds
    .filter((f: any) => f && typeof f === 'object' && typeof f.id === 'string')
    .map((f: any) => ({
      ...f,
      type: f.type === 'income' ? 'income' : 'expense',
      // Precision integer-cent rounding
      amount:
        typeof f.amount === 'number' && !isNaN(f.amount) && f.amount > 0
          ? Math.round(f.amount * 100) / 100
          : 0.01,
      category: sanitizeTextInput(f.category, 'Operations', 60),
      description: sanitizeTextInput(f.description, '', 100),
      date:
        typeof f.date === 'string' && f.date
          ? f.date
          : new Date().toISOString().split('T')[0],
      recurrence:
        f.recurrence === 'weekly' ||
        f.recurrence === 'biweekly' ||
        f.recurrence === 'monthly' ||
        f.recurrence === 'none'
          ? f.recurrence
          : undefined,
      customFields: sanitizeCustomFields(f.customFields),
      createdAt: typeof f.createdAt === 'number' ? f.createdAt : Date.now(),
    }));
  const { sanitized: funds } = sanitizeFundEntries(mappedFunds);

  const rawBills = Array.isArray(raw.bills) ? raw.bills : initial.bills || [];
  const validBillFrequencies: BillFrequency[] = ['monthly', 'biweekly', 'weekly', 'yearly', 'once'];
  const bills: BillEntry[] = rawBills
    .filter((b: any) => b && typeof b === 'object' && typeof b.id === 'string')
    .map((b: any) => {
      const freq: BillFrequency = validBillFrequencies.includes(b.frequency)
        ? b.frequency
        : 'monthly';
      return {
        id: sanitizeTextInput(b.id, `bill-${Date.now()}`, 64),
        name: sanitizeTextInput(b.name, 'Recurring Bill', 100),
        amount:
          typeof b.amount === 'number' && !isNaN(b.amount) && b.amount >= 0
            ? Math.round(b.amount * 100) / 100
            : 0,
        dueDate:
          typeof b.dueDate === 'string' && b.dueDate.trim()
            ? sanitizeTextInput(b.dueDate.trim(), new Date().toISOString().split('T')[0], 32)
            : new Date().toISOString().split('T')[0],
        frequency: freq,
        category: sanitizeTextInput(b.category, 'Utilities', 60),
        autoPay: Boolean(b.autoPay),
        isPaid: Boolean(b.isPaid),
        lastPaidDate:
          typeof b.lastPaidDate === 'string' && b.lastPaidDate.trim()
            ? sanitizeTextInput(b.lastPaidDate.trim(), '', 32)
            : undefined,
        notes: b.notes ? sanitizeTextInput(b.notes, '', 240) : undefined,
        createdAt: typeof b.createdAt === 'number' ? b.createdAt : Date.now(),
        updatedAt: typeof b.updatedAt === 'number' ? b.updatedAt : Date.now(),
      };
    });

  const rawStats = Array.isArray(raw.lifeStats)
    ? raw.lifeStats
    : Array.isArray(raw.stats)
    ? raw.stats
    : initial.lifeStats;
  const lifeStats = rawStats
    .filter((ls: any) => ls && typeof ls === 'object' && typeof ls.id === 'string')
    .map((ls: any) => ({
      ...ls,
      weightLbs:
        ls.weightLbs ??
        (typeof ls.weightKg === 'number'
          ? Math.round(ls.weightKg * 2.20462 * 10) / 10
          : 172.8),
      heightFt: ls.heightFt ?? 5,
      heightIn: ls.heightIn ?? 11,
      mood: typeof ls.mood === 'number' ? Math.min(10, Math.max(1, ls.mood)) : 8,
      moodNote: ls.moodNote ? sanitizeTextInput(ls.moodNote, '', 200) : undefined,
      createdAt: typeof ls.createdAt === 'number' ? ls.createdAt : Date.now(),
    }));

  const rawDistances = Array.isArray(raw.distances)
    ? raw.distances
    : Array.isArray(raw.distance)
    ? raw.distance
    : initial.distances;
  const distances = rawDistances
    .filter((d: any) => d && typeof d === 'object' && typeof d.id === 'string')
    .map((d: any) => ({
      ...d,
      distance:
        typeof d.distance === 'number' && !isNaN(d.distance) && d.distance > 0
          ? Math.round(d.distance * 100) / 100
          : 1.0,
      unit: d.unit === 'km' ? 'km' : 'mi',
      description: sanitizeTextInput(d.description, 'Route session', 120),
      createdAt: typeof d.createdAt === 'number' ? d.createdAt : Date.now(),
    }));

  const rawGoals = Array.isArray(raw.goals)
    ? raw.goals
    : Array.isArray(raw.longTermGoals)
    ? raw.longTermGoals
    : initial.goals;
  const startingBalance =
    typeof rawSettings.startingBalance === 'number' && !isNaN(rawSettings.startingBalance)
      ? rawSettings.startingBalance
      : initial.settings.startingBalance;
  const liveNetBalance = calculateFundsSummary(funds, startingBalance).currentBalance;

  const parsedGoals = rawGoals
    .filter((g: any) => g && typeof g === 'object' && typeof g.id === 'string')
    .map((g: any) => {
      const milestones = Array.isArray(g.milestones)
        ? g.milestones.map((m: any, idx: number) => ({
            id: typeof m?.id === 'string' ? m.id : `m-${idx}`,
            title: sanitizeTextInput(m?.title, 'Milestone', 100),
            completed: Boolean(m?.completed),
            manualOverride: m?.manualOverride ? true : undefined,
          }))
        : [];
      const allDone = milestones.length > 0 && milestones.every((m: any) => m.completed);
      return {
        ...g,
        title: sanitizeTextInput(g.title, 'Strategic Goal', 120),
        milestones,
        manualOverride: g.manualOverride ? true : undefined,
        autoSyncSource:
          g.autoSyncSource === 'funds' ||
          g.autoSyncSource === 'lifestats' ||
          g.autoSyncSource === 'distance' ||
          g.autoSyncSource === 'none'
            ? g.autoSyncSource
            : undefined,
        status: allDone
          ? 'completed'
          : g.status === 'completed' && !allDone
          ? 'in_progress'
          : g.status || 'in_progress',
        createdAt: typeof g.createdAt === 'number' ? g.createdAt : Date.now(),
      };
    });
  const goals = syncGoalsWithLiveModules(parsedGoals, liveNetBalance, lifeStats);

  const rawQuoteState = rawSettings.quoteState ?? raw.quoteState;
  const sanitizedQuoteState = (() => {
    if (!rawQuoteState || typeof rawQuoteState !== 'object') {
      return {
        customQuotes: [],
        activeQuoteId: undefined,
        isPinned: false,
        lastSelectedDate: undefined,
      };
    }
    const customQuotes = Array.isArray(rawQuoteState.customQuotes)
      ? rawQuoteState.customQuotes
          .filter((q: any) => q && typeof q === 'object' && typeof q.id === 'string')
          .map((q: any) => ({
            id: sanitizeTextInput(q.id, `custom-quote-${Date.now()}`, 64),
            text: sanitizeTextInput(q.text, '', 280),
            author: sanitizeTextInput(q.author, 'Personal Maxim', 80),
            category: 'custom' as const,
            isCustom: true,
          }))
          .filter((q: any) => q.text.length > 0)
      : [];
    const activeQuoteId =
      typeof rawQuoteState.activeQuoteId === 'string' && rawQuoteState.activeQuoteId.trim()
        ? sanitizeTextInput(rawQuoteState.activeQuoteId, '', 64)
        : undefined;
    const isPinned = Boolean(rawQuoteState.isPinned);
    const lastSelectedDate =
      typeof rawQuoteState.lastSelectedDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(rawQuoteState.lastSelectedDate.trim())
        ? rawQuoteState.lastSelectedDate.trim()
        : undefined;
    return {
      customQuotes,
      activeQuoteId: activeQuoteId || undefined,
      isPinned,
      lastSelectedDate,
    };
  })();

  const defaultFundsCols = ['date', 'type', 'category', 'description', 'amount', 'actions'];
  const defaultTimelineCols = ['time', 'category', 'title', 'duration', 'notes', 'actions'];

  const fundsColumnsOrder: string[] = Array.isArray(rawSettings.columns?.fundsColumnsOrder)
    ? rawSettings.columns.fundsColumnsOrder
    : defaultFundsCols;
  const timelineColumnsOrder: string[] = Array.isArray(rawSettings.columns?.timelineColumnsOrder)
    ? rawSettings.columns.timelineColumnsOrder
    : defaultTimelineCols;

  const validAccent = isValidAccentColor(rawSettings.accentColor)
    ? rawSettings.accentColor
    : initial.settings.accentColor;
  const sanitizedCustomAccentHex =
    typeof rawSettings.customAccentHex === 'string' &&
    /^#[0-9A-Fa-f]{6}$/.test(rawSettings.customAccentHex.trim())
      ? rawSettings.customAccentHex.trim().toUpperCase()
      : undefined;
  const resolvedAccentTheme = resolveAccentTheme(validAccent, sanitizedCustomAccentHex);
  const sanitizedTextColorConfig = resolveTextColorConfig(
    rawSettings.textColorConfig,
    resolvedAccentTheme.hex
  );
  const sanitizedSurfaceConfig = resolveSurfaceConfig(rawSettings.surfaceConfig);

  // Migrate legacy default appName ("Axiom's Dailies") to "Axiom Aegis" and strip any legacy v1.x.x suffixes
  const rawAppNameStr =
    typeof rawSettings.appName === 'string'
      ? rawSettings.appName
          .replace(/\s*[-—•]?\s*\bv1\.\d+\.\d+(?:\s*(?:BETA|ALPHA))?\b/gi, '')
          .trim()
      : '';
  const migratedAppName =
    rawAppNameStr === "Axiom's Dailies" && (!raw.version || raw.version < 40)
      ? 'Axiom Aegis'
      : rawAppNameStr;

  const rawFrequentEvents = Array.isArray(raw.frequentEvents)
    ? raw.frequentEvents
    : initial.frequentEvents || [];
  const sanitizedFrequentEvents = rawFrequentEvents
    .filter((fe: any) => fe && typeof fe === 'object' && typeof fe.title === 'string')
    .map((fe: any, idx: number) => ({
      id: typeof fe.id === 'string' && fe.id ? fe.id : `fe-${idx}-${Date.now()}`,
      title: sanitizeTextInput(fe.title, 'Frequent Event', 100),
      category: sanitizeTextInput(fe.category, 'work', 48),
      durationMinutes:
        typeof fe.durationMinutes === 'number' && fe.durationMinutes >= 5
          ? Math.min(720, Math.round(fe.durationMinutes))
          : 60,
      startTime:
        typeof fe.startTime === 'string' && /^\d{2}:\d{2}$/.test(fe.startTime.trim())
          ? fe.startTime.trim()
          : '09:00',
      endTime:
        typeof fe.endTime === 'string' && /^\d{2}:\d{2}$/.test(fe.endTime.trim())
          ? fe.endTime.trim()
          : undefined,
      notes: fe.notes ? sanitizeTextInput(fe.notes, '', 240) : undefined,
    }));

  const resolvedCategories = resolveCategoriesForAppData({
    categories: raw.categories ?? rawSettings.categories,
    settings: rawSettings,
    timeline,
    frequentEvents: sanitizedFrequentEvents,
    funds,
    goals,
    dailyNotes: Array.isArray(raw.dailyNotes) ? raw.dailyNotes : initial.dailyNotes,
    gallery: Array.isArray(raw.gallery) ? raw.gallery : initial.gallery,
  });

  // Migrate legacy default userName ("Axiom") to "User" and clear legacy default location on upgrade
  const rawUserNameStr =
    typeof rawSettings.userName === 'string'
      ? rawSettings.userName.trim()
      : typeof rawSettings.commanderName === 'string'
      ? rawSettings.commanderName.trim()
      : '';
  const migratedUserName =
    rawUserNameStr === 'Axiom' && (!raw.version || raw.version < 42)
      ? 'User'
      : rawUserNameStr;

  const rawCommanderStr =
    typeof rawSettings.commanderName === 'string' && rawSettings.commanderName.trim()
      ? rawSettings.commanderName.trim()
      : migratedUserName;

  const rawWeatherLocationStr =
    typeof rawSettings.weatherLocation === 'string' ? rawSettings.weatherLocation.trim() : '';
  const isLegacyDefaultWeather =
    (!raw.version || raw.version < 42) &&
    (rawSettings.weatherCoords?.lat === 42.5378 || !raw.version);
  const migratedWeatherLocation = isLegacyDefaultWeather ? '' : rawWeatherLocationStr;
  const migratedWeatherCoords =
    isLegacyDefaultWeather || !migratedWeatherLocation
      ? { lat: 0, lon: 0 }
      : rawSettings.weatherCoords &&
        typeof rawSettings.weatherCoords.lat === 'number' &&
        typeof rawSettings.weatherCoords.lon === 'number'
      ? rawSettings.weatherCoords
      : { lat: 0, lon: 0 };

  const rawShortcuts = Array.isArray(raw.shortcuts)
    ? raw.shortcuts
    : initial.shortcuts || [];
  const sanitizedShortcuts: ShortcutItem[] = rawShortcuts
    .filter((s: any) => s && typeof s === 'object' && typeof s.url === 'string' && s.url.trim())
    .map((s: any, idx: number) => {
      let cleanUrl = sanitizeTextInput(s.url.trim(), '', 500);
      if (cleanUrl && !/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = `https://${cleanUrl}`;
      }
      return {
        id: typeof s.id === 'string' && s.id.trim() ? sanitizeTextInput(s.id.trim(), `sc-${idx}`, 64) : `sc-${idx}-${Date.now()}`,
        title: sanitizeTextInput(s.title, cleanUrl.replace(/^https?:\/\//i, '').split('/')[0] || 'Shortcut', 80),
        url: cleanUrl,
        category: s.category ? sanitizeTextInput(s.category, 'General', 40) : 'General',
        icon: s.icon ? sanitizeTextInput(s.icon, '', 40) : undefined,
        order: typeof s.order === 'number' && !isNaN(s.order) ? s.order : idx,
        createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
      };
    });

  const validPriorities = new Set(['Low', 'Medium', 'High', 'Critical']);
  const validStatuses = new Set(['Idea', 'Planned', 'In Progress', 'Completed']);
  const rawSiteImprovements = Array.isArray(raw.siteImprovements)
    ? raw.siteImprovements
    : initial.siteImprovements || [];
  const sanitizedSiteImprovements = rawSiteImprovements
    .filter((it: any) => it && typeof it === 'object' && typeof it.title === 'string' && it.title.trim())
    .map((it: any, idx: number) => ({
      id:
        typeof it.id === 'string' && it.id.trim()
          ? sanitizeTextInput(it.id.trim(), `si-${idx}`, 64)
          : `si-${idx}-${Date.now()}`,
      title: sanitizeTextInput(it.title, 'Site Improvement', 140),
      categoryTag: sanitizeTextInput(it.categoryTag, 'General', 48),
      priority: (validPriorities.has(it.priority) ? it.priority : 'Medium') as
        | 'Low'
        | 'Medium'
        | 'High'
        | 'Critical',
      status: (validStatuses.has(it.status) ? it.status : 'Idea') as
        | 'Idea'
        | 'Planned'
        | 'In Progress'
        | 'Completed',
      notes: typeof it.notes === 'string' ? sanitizeTextInput(it.notes, '', 2000) : '',
      createdAt: typeof it.createdAt === 'number' ? it.createdAt : Date.now(),
      updatedAt: typeof it.updatedAt === 'number' ? it.updatedAt : Date.now(),
    }));

  const rawCustomNavCategories = Array.isArray(raw.customNavCategories)
    ? raw.customNavCategories
    : initial.customNavCategories || [];
  const sanitizedCustomNavCategories = rawCustomNavCategories
    .filter((c: any) => c && typeof c === 'object' && typeof c.name === 'string' && c.name.trim())
    .map((c: any, idx: number) => {
      const rawId = typeof c.id === 'string' && c.id.trim() ? c.id.trim() : `custom_cat_${idx}_${Date.now()}`;
      const normalizedId = rawId.startsWith('custom_cat_')
        ? sanitizeTextInput(rawId, `custom_cat_${idx}`, 64)
        : `custom_cat_${sanitizeTextInput(rawId, `${idx}`, 48)}`;
      const checklist = Array.isArray(c.checklist)
        ? c.checklist
            .filter((item: any) => item && typeof item === 'object' && typeof item.text === 'string')
            .map((item: any, cIdx: number) => ({
              id:
                typeof item.id === 'string' && item.id.trim()
                  ? sanitizeTextInput(item.id.trim(), `chk-${cIdx}`, 64)
                  : `chk-${cIdx}-${Date.now()}`,
              text: sanitizeTextInput(item.text, 'Checklist item', 200),
              completed: Boolean(item.completed),
            }))
        : [];
      const statusCards = Array.isArray(c.statusCards)
        ? c.statusCards
            .filter((sc: any) => sc && typeof sc === 'object' && typeof sc.title === 'string')
            .map((sc: any, sIdx: number) => ({
              id:
                typeof sc.id === 'string' && sc.id.trim()
                  ? sanitizeTextInput(sc.id.trim(), `scard-${sIdx}`, 64)
                  : `scard-${sIdx}-${Date.now()}`,
              title: sanitizeTextInput(sc.title, 'Status Metric', 80),
              status: sanitizeTextInput(sc.status, 'Nominal', 32),
              value: sanitizeTextInput(sc.value, 'Active', 80),
              notes: sc.notes ? sanitizeTextInput(sc.notes, '', 240) : undefined,
            }))
        : [];

      return {
        id: normalizedId,
        name: sanitizeTextInput(c.name, 'Custom Category', 48),
        visibility: (c.visibility === 'all_users' ? 'all_users' : 'admin_only') as
          | 'admin_only'
          | 'all_users',
        parentGroupId:
          typeof c.parentGroupId === 'string' &&
          ['daily_ops', 'biometrics', 'wealth', 'vault_sys'].includes(c.parentGroupId)
            ? c.parentGroupId
            : 'vault_sys',
        icon: typeof c.icon === 'string' ? sanitizeTextInput(c.icon, 'terminal', 32) : 'terminal',
        order: typeof c.order === 'number' && !isNaN(c.order) ? c.order : idx,
        notes: typeof c.notes === 'string' ? sanitizeTextInput(c.notes, '', 8000) : '',
        checklist,
        statusCards,
        createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
        updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
      };
    });

  const resolvedSidebarPosition: SidebarPositionMode =
    rawSettings.sidebarPosition === 'bottom' || rawSettings.sidebarPosition === 'left'
      ? rawSettings.sidebarPosition
      : layoutConfig.sidebarPosition || 'left';

  const resolvedSidebarIconColor =
    typeof rawSettings.sidebarIconColor === 'string' &&
    /^#[0-9A-Fa-f]{6}$/.test(rawSettings.sidebarIconColor.trim())
      ? rawSettings.sidebarIconColor.trim()
      : layoutConfig.sidebarIconColor || '#00E5FF';

  const sanitizedGuildName =
    typeof rawSettings.guildName === 'string'
      ? sanitizeTextInput(rawSettings.guildName, 'Aegis Vanguard', 60)
      : initial.settings.guildName || 'Aegis Vanguard';

  const sanitizedAvatarDataUrl =
    typeof rawSettings.avatarDataUrl === 'string' &&
    (rawSettings.avatarDataUrl.startsWith('data:image/') || rawSettings.avatarDataUrl === '')
      ? rawSettings.avatarDataUrl
      : '';

  const isPreV43PersonalizedLabels = typeof raw.version !== 'number' || raw.version < 43;

  const migrateLegacyGroupLabels = (
    labels?: Record<string, string> | null
  ): Record<string, string> => {
    const sanitized = sanitizeSidebarGroupLabels(labels);
    if (isPreV43PersonalizedLabels && sanitized.daily_ops === 'Daily Operations') {
      sanitized.daily_ops = 'Personal';
    }
    return sanitized;
  };

  const migrateLegacyItemLabels = (
    labels?: Record<string, string> | null
  ): Record<string, string> => {
    const sanitized = sanitizeSidebarItemLabels(labels, sanitizedCustomNavCategories);
    if (isPreV43PersonalizedLabels) {
      const legacyReplacements: Record<string, [string, string]> = {
        'nav-calendar': ['Calendar & Timeline', 'Calendar'],
        'nav-notes': ['Daily Notes', 'Notes'],
        'nav-frequent-events': ['Frequent Events', 'Quick Add'],
        'nav-lifestats': ['Life Statistics', 'Life Stats'],
        'nav-distance': ['Distance Tracker', 'Distance'],
        'nav-funds': ['Funds Ledger', 'Funds'],
        'nav-import-hub': ['Data Import Hub', 'Import'],
        'nav-changelog': ['Changelog & Releases', 'Changelog'],
      };
      for (const [itemId, [oldDefault, newDefault]] of Object.entries(legacyReplacements)) {
        if (sanitized[itemId] === oldDefault) {
          sanitized[itemId] = newDefault;
        }
      }
    }
    return sanitized;
  };

  const resolvedSidebarGroupOrder = Array.isArray(rawSettings.sidebarGroupOrder)
    ? sanitizeSidebarGroupOrder(rawSettings.sidebarGroupOrder)
    : layoutConfig.sidebarGroupOrder;

  const resolvedSidebarGroupItems =
    rawSettings.sidebarGroupItems && typeof rawSettings.sidebarGroupItems === 'object'
      ? sanitizeSidebarGroupItems(rawSettings.sidebarGroupItems, sanitizedCustomNavCategories)
      : sanitizeSidebarGroupItems(layoutConfig.sidebarGroupItems, sanitizedCustomNavCategories);

  const resolvedSidebarGroupLabels =
    rawSettings.sidebarGroupLabels && typeof rawSettings.sidebarGroupLabels === 'object'
      ? migrateLegacyGroupLabels(rawSettings.sidebarGroupLabels)
      : migrateLegacyGroupLabels(layoutConfig.sidebarGroupLabels);

  const resolvedSidebarItemLabels =
    rawSettings.sidebarItemLabels && typeof rawSettings.sidebarItemLabels === 'object'
      ? migrateLegacyItemLabels(rawSettings.sidebarItemLabels)
      : migrateLegacyItemLabels(layoutConfig.sidebarItemLabels);

  return {
    version: 43,
    categories: resolvedCategories,
    settings: {
      ...DEFAULT_SETTINGS,
      ...rawSettings,
      startingBalance,
      userName: sanitizeTextInput(migratedUserName, initial.settings.userName, 60),
      commanderName: sanitizeTextInput(rawCommanderStr, initial.settings.userName, 60),
      guildName: sanitizedGuildName,
      avatarDataUrl: sanitizedAvatarDataUrl,
      sidebarPosition: resolvedSidebarPosition,
      sidebarIconColor: resolvedSidebarIconColor,
      appName: sanitizeTextInput(migratedAppName, initial.settings.appName, 60),
      appShortName: sanitizeTextInput(rawSettings.appShortName, 'AA', 12),
      weatherLocation: sanitizeTextInput(migratedWeatherLocation, '', 80),
      weatherCoords: migratedWeatherCoords,
      accentColor: validAccent,
      customAccentHex: sanitizedCustomAccentHex,
      textColorConfig: sanitizedTextColorConfig,
      surfaceConfig: sanitizedSurfaceConfig,
      categories: resolvedCategories,
      columns: {
        fundsColumnsOrder: defaultFundsCols,
        timelineColumnsOrder: defaultTimelineCols,
        hiddenFundsColumns: [],
        hiddenTimelineColumns: [],
        customFundsColumns: [],
        customTimelineColumns: [],
      },
      dashboardWidgets: layoutConfig.widgets,
      layoutConfig: {
        ...layoutConfig,
        sidebarPosition: resolvedSidebarPosition,
        sidebarIconColor: resolvedSidebarIconColor,
        sidebarGroupOrder: resolvedSidebarGroupOrder,
        sidebarGroupItems: resolvedSidebarGroupItems,
        sidebarGroupLabels: resolvedSidebarGroupLabels,
        sidebarItemLabels: resolvedSidebarItemLabels,
      },
      sidebarGroupOrder: resolvedSidebarGroupOrder,
      sidebarGroupItems: resolvedSidebarGroupItems,
      sidebarGroupLabels: resolvedSidebarGroupLabels,
      sidebarItemLabels: resolvedSidebarItemLabels,
      quoteState: sanitizedQuoteState,
    },
    quoteState: sanitizedQuoteState,
    frequentEvents: sanitizedFrequentEvents,
    shortcuts: sanitizedShortcuts,
    siteImprovements: sanitizedSiteImprovements,
    customNavCategories: sanitizedCustomNavCategories,
    timeline,
    lifeStats,
    distances,
    funds,
    bills,
    goals,
    gallery: Array.isArray(raw.gallery) ? raw.gallery : initial.gallery,
    dailyNotes: Array.isArray(raw.dailyNotes)
      ? raw.dailyNotes
          .filter((n: any) => n && typeof n === 'object' && typeof n.id === 'string')
          .map((n: any) => ({
            id: sanitizeTextInput(n.id, `note-${Date.now()}`, 64),
            date:
              typeof n.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.date.trim())
                ? n.date.trim()
                : new Date().toISOString().split('T')[0],
            title: sanitizeTextInput(n.title, 'Daily Note', 120),
            content:
              typeof n.content === 'string'
                ? n.content
                    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
                    .trim()
                    .slice(0, 16000)
                : '',
            tags: Array.isArray(n.tags)
              ? n.tags
                  .map((t: any) => sanitizeTextInput(t, '', 32))
                  .filter(Boolean)
                  .slice(0, 15)
              : [],
            mood:
              typeof n.mood === 'number' && !isNaN(n.mood)
                ? Math.min(10, Math.max(1, Math.round(n.mood)))
                : undefined,
            isPinned: Boolean(n.isPinned ?? n.pinned),
            createdAt: typeof n.createdAt === 'number' ? n.createdAt : Date.now(),
            updatedAt: typeof n.updatedAt === 'number' ? n.updatedAt : Date.now(),
          }))
      : initial.dailyNotes,
    chores: sanitizeChoresList(
      Array.isArray(raw.chores) ? raw.chores : initial.chores || []
    ),
    deletedItemTombstones: (() => {
      const next: Record<string, number> = {};
      const src = raw.deletedItemTombstones;
      if (src && typeof src === 'object' && !Array.isArray(src)) {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        for (const [k, v] of Object.entries(src)) {
          if (
            typeof k === 'string' &&
            k.trim() &&
            typeof v === 'number' &&
            Number.isFinite(v) &&
            v >= cutoff
          ) {
            next[k.trim().slice(0, 80)] = v;
          }
        }
      }
      return next;
    })(),
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : Date.now(),
  };
}

/**
 * Synchronizes full validated state (timeline, expenses, bills, stats, distance, shortTermGoals,
 * longTermGoals, layoutConfig, quoteState, categories, and appData) to localStorage under `axioms_dailies_state`.
 */
export function saveAppDataToLocalStorage(appData: AppData, layoutConfig: LayoutConfig): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const validated = validateAndSanitizeAppData(appData);
    const cleanLayout = sanitizeLayoutConfig(
      {
        ...layoutConfig,
        sidebarGroupOrder:
          appData.settings?.sidebarGroupOrder ||
          layoutConfig.sidebarGroupOrder ||
          DEFAULT_LAYOUT_CONFIG.sidebarGroupOrder,
        sidebarGroupItems:
          appData.settings?.sidebarGroupItems ||
          layoutConfig.sidebarGroupItems ||
          DEFAULT_LAYOUT_CONFIG.sidebarGroupItems,
        sidebarGroupLabels:
          appData.settings?.sidebarGroupLabels ||
          layoutConfig.sidebarGroupLabels ||
          DEFAULT_LAYOUT_CONFIG.sidebarGroupLabels,
        sidebarItemLabels:
          appData.settings?.sidebarItemLabels ||
          layoutConfig.sidebarItemLabels ||
          DEFAULT_LAYOUT_CONFIG.sidebarItemLabels,
        sidebarPosition:
          appData.settings?.sidebarPosition ||
          layoutConfig.sidebarPosition ||
          DEFAULT_LAYOUT_CONFIG.sidebarPosition,
        sidebarIconColor:
          appData.settings?.sidebarIconColor ||
          layoutConfig.sidebarIconColor ||
          DEFAULT_LAYOUT_CONFIG.sidebarIconColor,
        layoutVersion: 5,
      },
      DEFAULT_LAYOUT_CONFIG,
      validated.customNavCategories
    );
    const shortTermGoals = validated.goals.flatMap((g) =>
      (g.milestones || []).map((m) => ({
        ...m,
        parentGoalId: g.id,
        parentGoalTitle: g.title,
      }))
    );

    const payload = {
      version: 43,
      categories: validated.categories,
      timeline: validated.timeline,
      expenses: validated.funds,
      funds: validated.funds,
      bills: validated.bills || [],
      stats: validated.lifeStats,
      lifeStats: validated.lifeStats,
      distance: validated.distances,
      distances: validated.distances,
      shortTermGoals,
      longTermGoals: validated.goals,
      goals: validated.goals,
      gallery: validated.gallery,
      dailyNotes: validated.dailyNotes,
      chores: validated.chores || [],
      deletedItemTombstones: validated.deletedItemTombstones || {},
      frequentEvents: validated.frequentEvents,
      shortcuts: validated.shortcuts || [],
      siteImprovements: validated.siteImprovements || [],
      customNavCategories: validated.customNavCategories || [],
      quoteState: validated.quoteState,
      settings: {
        ...validated.settings,
        categories: validated.categories,
        dashboardWidgets: cleanLayout.widgets,
        layoutConfig: cleanLayout,
        sidebarPosition: cleanLayout.sidebarPosition,
        sidebarIconColor: cleanLayout.sidebarIconColor,
        sidebarGroupOrder: cleanLayout.sidebarGroupOrder,
        sidebarGroupItems: cleanLayout.sidebarGroupItems,
        sidebarGroupLabels: cleanLayout.sidebarGroupLabels,
        sidebarItemLabels: cleanLayout.sidebarItemLabels,
        quoteState: validated.quoteState,
      },
      matrixLayout: cleanLayout.widgets,
      layoutConfig: cleanLayout,
      updatedAt: validated.updatedAt || Date.now(),
    };

    window.localStorage.setItem(AXIOMS_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads full AppData from localStorage (`axioms_dailies_state`) on initialization.
 * If localStorage returns corrupted JSON or empty data, instantiates the default factory state
 * without crashing or throwing unhandled exceptions.
 */
export function loadAppDataFromLocalStorage(): AppData {
  if (typeof window === 'undefined' || !window.localStorage) {
    return createInitialAppData();
  }

  try {
    runCleanSlateMigrationV1101(window.localStorage);
    const raw = window.localStorage.getItem(AXIOMS_STORAGE_KEY);
    if (!raw) {
      return createInitialAppData();
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return createInitialAppData();
    }
    return validateAndSanitizeAppData(parsed);
  } catch {
    return createInitialAppData();
  }
}
