export type CuratedAccentColor =
  | 'aegis_gold'
  | 'cyber_cyan'
  | 'electric_violet'
  | 'emerald_core'
  | 'crimson_protocol'
  | 'neon_amber'
  | 'cobalt_pulse'
  | 'hot_magenta'
  | 'toxic_lime'
  | 'deep_indigo'
  | 'burnt_orange'
  | 'teal_matrix'
  | 'rose_quartz'
  | 'skyline_blue'
  | 'spectral_purple'
  | 'sunburst_yellow'
  | 'mint_glaze'
  | 'steel_platinum'
  | 'blood_coral'
  | 'ultramarine';

export type LegacyAccentColor =
  | 'emerald'
  | 'cyan'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'sky';

export type AccentColor = CuratedAccentColor | LegacyAccentColor;

export type TextColorPresetId =
  | 'crisp_white'
  | 'soft_gray'
  | 'muted_silver'
  | 'warm_off_white'
  | 'accent_tint'
  | 'custom';

export interface TextColorConfig {
  preset: TextColorPresetId;
  primaryHex: string;
  secondaryHex: string;
}

export type SurfacePresetId =
  | 'flat_black'
  | 'obsidian_slate'
  | 'midnight_carbon'
  | 'custom';

export interface SurfaceConfig {
  preset: SurfacePresetId;
  canvasHex: string;
  columnHex: string;
  cardHex: string;
  borderHex?: string;
}

export type UnitSystem = 'imperial' | 'metric';

export type CategoryDomain = 'timeline' | 'funds' | 'goals' | 'notes' | 'gallery' | 'quotes';

export interface CategoryConfig {
  id: string;
  name: string;
  domain: CategoryDomain;
  color: string;
  icon: string;
  order: number;
}

export type TimelineCategory =
  | 'work'
  | 'health'
  | 'learning'
  | 'personal'
  | 'social'
  | 'creative'
  | 'other'
  | string;

export type GoalCategory =
  | 'fitness'
  | 'financial'
  | 'career'
  | 'learning'
  | 'personal'
  | 'travel'
  | string;

export interface TimelineEntry {
  id: string;
  title: string;
  category: TimelineCategory;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationMinutes: number;
  notes?: string;
  importHash?: string;
  customFields?: Record<string, string>;
  createdAt: number;
}

export interface LifeStatEntry {
  id: string;
  date: string; // YYYY-MM-DD
  age?: number;
  heightFt?: number;
  heightIn?: number;
  heightCm?: number;
  weightLbs?: number; // Primary imperial weight in pounds
  weightKg?: number; // Metric fallback
  mood: number; // 1 to 10
  moodNote?: string;
  weeklyIncome?: number; // USD
  notes?: string;
  createdAt: number;
}

export type DistanceActivityType = 'walk' | 'run' | 'cycle' | 'drive' | 'flight' | 'other';
export type DistanceUnit = 'mi' | 'km';

export interface DistanceEntry {
  id: string;
  date: string; // YYYY-MM-DD
  distance: number;
  unit: DistanceUnit;
  type: DistanceActivityType;
  description: string;
  importHash?: string;
  createdAt: number;
}

export type TransactionType = 'income' | 'expense';
export type RecurrenceFrequency = 'none' | 'weekly' | 'biweekly' | 'monthly';

export interface FundEntry {
  id: string;
  date: string; // YYYY-MM-DD
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  recurrence?: RecurrenceFrequency;
  importHash?: string;
  customFields?: Record<string, string>;
  createdAt: number;
}

export type BillFrequency = 'monthly' | 'biweekly' | 'weekly' | 'yearly' | 'once';

export interface BillEntry {
  id: string;
  name: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD or day-of-month string
  frequency: BillFrequency;
  category: string;
  autoPay: boolean;
  isPaid: boolean;
  lastPaidDate?: string;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface GoalMilestone {
  id: string;
  title: string;
  completed: boolean;
  manualOverride?: boolean;
}

export type GoalSyncSource = 'funds' | 'lifestats' | 'distance' | 'none';

export interface GoalEntry {
  id: string;
  title: string;
  category: GoalCategory;
  targetDate: string;
  currentValue?: number;
  targetValue?: number;
  unit?: string; // e.g. "lbs", "$", "miles", "hrs"
  milestones: GoalMilestone[];
  status: 'in_progress' | 'completed' | 'on_hold';
  manualOverride?: boolean;
  autoSyncSource?: GoalSyncSource;
  notes?: string;
  createdAt: number;
}

export interface GalleryItem {
  id: string;
  title: string;
  dataUrl: string; // Base64 data URL
  date: string; // YYYY-MM-DD
  tags: string[];
  notes?: string;
  sizeKb: number;
  createdAt: number;
}

export interface WeatherData {
  city: string;
  temperature: number; // in °F
  condition: string;
  humidity: number;
  windSpeed: number; // in mph
  weatherCode: number;
  lastUpdated: number;
}

export type BuiltInFundsColumnId = 'date' | 'type' | 'category' | 'description' | 'amount' | 'actions';
export type BuiltInTimelineColumnId = 'time' | 'category' | 'title' | 'duration' | 'notes' | 'actions';

export type FundsColumnId = BuiltInFundsColumnId | string;
export type TimelineColumnId = BuiltInTimelineColumnId | string;

export interface CustomTableColumnDef {
  id: string;
  label: string;
  type: 'text' | 'number' | 'badge';
}

export interface ColumnFormatSettings {
  fundsColumnsOrder: FundsColumnId[];
  timelineColumnsOrder: TimelineColumnId[];
  hiddenFundsColumns?: FundsColumnId[];
  hiddenTimelineColumns?: TimelineColumnId[];
  customFundsColumns?: CustomTableColumnDef[];
  customTimelineColumns?: CustomTableColumnDef[];
}

export interface FrequentEvent {
  id: string;
  title: string;
  category: TimelineCategory;
  durationMinutes: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export type DashboardWidgetId =
  | 'weather'
  | 'kpi_funds'
  | 'kpi_focus'
  | 'kpi_mood'
  | 'kpi_distance'
  | 'timeline_today'
  | 'mini_calendar'
  | 'aegis_visualizer'
  | 'plasma_sphere'
  | 'funds_recent'
  | 'life_stats_panel'
  | 'distance_panel'
  | 'short_term_goals'
  | 'goals_preview'
  | 'gallery_preview'
  | 'daily_notes'
  | 'frequent_events'
  | 'quick_capture'
  | string;

export type WidgetColSpan = 1 | 2 | 3 | 'full' | 'quarter' | 'half';

export type CustomPanelType = 'checklist' | 'notes' | 'counter' | 'habits' | 'key_value';
export type CustomPanelColor = AccentColor;

export interface CustomColumnItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface CustomCounterConfig {
  currentValue: number;
  targetValue: number;
  unit: string;
  step: number;
}

export interface CustomHabitItem {
  id: string;
  title: string;
  completedDates: string[]; // YYYY-MM-DD
}

export interface CustomKeyValueItem {
  id: string;
  label: string;
  value: string;
}

export interface DashboardWidgetConfig {
  id: DashboardWidgetId;
  visible: boolean;
  colSpan: WidgetColSpan;
  order: number;
  customTitle?: string;
  isCustom?: boolean;
  panelType?: CustomPanelType;
  panelColor?: CustomPanelColor;
  customItems?: CustomColumnItem[];
  customNotes?: string;
  customCounter?: CustomCounterConfig;
  customHabits?: CustomHabitItem[];
  customKeyValues?: CustomKeyValueItem[];
}

export type PageWidthMode = 'standard' | 'ultrawide' | 'full';
export type GridDensityMode = 'compact' | 'comfortable' | 'spacious';
export type SidebarPositionMode = 'left' | 'bottom';

export type SiteImprovementPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type SiteImprovementStatus = 'Idea' | 'Planned' | 'In Progress' | 'Completed';

export interface SiteImprovementItem {
  id: string;
  title: string;
  categoryTag: string;
  priority: SiteImprovementPriority;
  status: SiteImprovementStatus;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export type CustomCategoryVisibility = 'admin_only' | 'all_users';

export interface CustomCategoryChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface CustomCategoryStatusCard {
  id: string;
  title: string;
  status: 'Nominal' | 'Active' | 'Warning' | 'Completed' | string;
  value: string;
  notes?: string;
}

export interface CustomNavCategory {
  id: string;
  name: string;
  visibility: CustomCategoryVisibility;
  parentGroupId?: string;
  icon?: string;
  order?: number;
  notes: string;
  checklist: CustomCategoryChecklistItem[];
  statusCards: CustomCategoryStatusCard[];
  createdAt: number;
  updatedAt: number;
}

export interface ShortcutItem {
  id: string;
  title: string;
  url: string;
  category?: string;
  icon?: string;
  order: number;
  createdAt: number;
}

export interface LayoutConfig {
  layoutVersion?: number;
  widgets: DashboardWidgetConfig[];
  gridColumns: 2 | 3 | 4;
  pageWidth: PageWidthMode;
  customPageMaxWidthPx?: number;
  fontScale: number; // 0.85 to 1.30
  density: GridDensityMode;
  customGridGapPx?: number;
  sidebarPosition?: SidebarPositionMode;
  sidebarIconColor?: string;
  fundsColumnTitles?: Record<string, string>;
  timelineColumnTitles?: Record<string, string>;
  hiddenFundsColumns?: string[];
  hiddenTimelineColumns?: string[];
  customFundsColumns?: CustomTableColumnDef[];
  customTimelineColumns?: CustomTableColumnDef[];
  sidebarGroupOrder?: string[];
  sidebarGroupItems?: Record<string, string[]>;
  sidebarGroupLabels?: Record<string, string>;
  sidebarItemLabels?: Record<string, string>;
}

export interface QuoteItem {
  id: string;
  text: string;
  author: string;
  category?: 'discipline' | 'strategy' | 'stoicism' | 'execution' | 'custom' | string;
  isCustom?: boolean;
}

export interface QuoteState {
  customQuotes: QuoteItem[];
  activeQuoteId?: string;
  isPinned: boolean;
  lastSelectedDate?: string; // YYYY-MM-DD
}

export interface CloudSyncSettings {
  enabled: boolean;
  provider?: 'google_drive';
  autoSync?: boolean;
  autoSyncOnChange?: boolean;
  targetFolder?: 'appDataFolder' | 'driveFile';
  storageSpace?: 'appDataFolder' | 'drive';
  googleClientId?: string;
  customClientId?: string;
  lastSyncedAt?: number | null;
  lastRemoteModifiedAt?: number | null;
  driveFileId?: string | null;
  deviceLabel?: string;
  connectedEmail?: string;
  conflictStrategy?: 'push' | 'pull' | 'auto_merge';
}

export interface AppSettings {
  userName: string;
  commanderName?: string;
  guildName?: string;
  avatarDataUrl?: string;
  appName: string;
  appShortName?: string;
  accentColor: AccentColor;
  customAccentHex?: string;
  sidebarIconColor?: string;
  sidebarPosition?: SidebarPositionMode;
  textColorConfig?: TextColorConfig;
  surfaceConfig?: SurfaceConfig;
  autoLockMinutes: number; // 0 for never, or 1, 5, 15, 30, 60
  unitSystem: UnitSystem;
  distanceUnit: DistanceUnit;
  startingBalance: number;
  currencySymbol: string;
  weatherLocation: string;
  weatherCoords: { lat: number; lon: number };
  columns: ColumnFormatSettings;
  categories?: CategoryConfig[];
  dashboardWidgets?: DashboardWidgetConfig[];
  layoutConfig?: LayoutConfig;
  sidebarGroupOrder?: string[];
  sidebarGroupItems?: Record<string, string[]>;
  sidebarGroupLabels?: Record<string, string>;
  sidebarItemLabels?: Record<string, string>;
  quoteState?: QuoteState;
  cloudSync?: CloudSyncSettings;
  cloudSyncConfig?: CloudSyncSettings;
  lastBackupTimestamp?: number;
  lastBackupRecordCount?: number;
}

export interface FocusTimerState {
  isRunning: boolean;
  isPaused: boolean;
  startedAtMs: number | null;
  accumulatedSeconds: number;
  title: string;
  category: TimelineCategory;
  templateId?: string;
  sessionStartHHMM?: string;
}

export interface ChoreItem {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  updatedAt?: number;
}

export interface DailyNoteEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  content: string;
  tags: string[];
  mood?: number; // 1 to 10
  isPinned?: boolean;
  updatedAt: number;
  createdAt: number;
}

export interface AppData {
  version: number;
  settings: AppSettings;
  categories?: CategoryConfig[];
  timeline: TimelineEntry[];
  lifeStats: LifeStatEntry[];
  distances: DistanceEntry[];
  funds: FundEntry[];
  bills?: BillEntry[];
  goals: GoalEntry[];
  gallery: GalleryItem[];
  dailyNotes?: DailyNoteEntry[];
  chores?: ChoreItem[];
  deletedItemTombstones?: Record<string, number>;
  frequentEvents?: FrequentEvent[];
  shortcuts?: ShortcutItem[];
  siteImprovements?: SiteImprovementItem[];
  customNavCategories?: CustomNavCategory[];
  quoteState?: QuoteState;
  updatedAt: number;
}

export interface EncryptedPayload {
  version: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
  timestamp: number;
  keyFingerprint?: string;
  hasCustomPassword?: boolean;
}

export type AccountRole = 'The App Creator' | 'VIP' | 'User';

export type TabType =
  | 'dashboard'
  | 'shortcuts'
  | 'site_improvements'
  | 'timeline'
  | 'calendar'
  | 'notes'
  | 'chores'
  | 'lifestats'
  | 'distance'
  | 'funds'
  | 'goals'
  | 'gallery'
  | 'customization'
  | 'settings'
  | 'admin'
  | `custom_cat_${string}`;

export type ImportTabType = 'funds_ocr' | 'bank_csv' | 'timeline_ocr' | 'google_takeout' | 'local_folder_sync';



