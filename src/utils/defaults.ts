import {
  AppData,
  AppSettings,
  DashboardWidgetConfig,
  FrequentEvent,
  LayoutConfig,
  QuoteState,
} from '../types';
import { DEFAULT_SURFACE_CONFIG, DEFAULT_TEXT_COLOR_CONFIG } from './theme';
import { DEFAULT_CATEGORIES } from './categoryEngine';

export const DEFAULT_QUOTE_STATE: QuoteState = {
  customQuotes: [],
  activeQuoteId: undefined,
  isPinned: false,
  lastSelectedDate: undefined,
};

/**
 * Clean-slate frequent events (no hardcoded demo templates).
 */
export const DEFAULT_FREQUENT_EVENTS: FrequentEvent[] = [];

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  { id: 'mini_calendar', visible: true, colSpan: 1, order: 0, customTitle: 'Calendar & Schedule' },
  { id: 'frequent_events', visible: true, colSpan: 1, order: 1, customTitle: 'Frequent Events' },
  {
    id: 'aegis_visualizer',
    visible: true,
    colSpan: 1,
    order: 2,
    customTitle: 'Lightning in a Bottle',
  },
  { id: 'funds_recent', visible: true, colSpan: 1, order: 3, customTitle: 'Expense Tracker' },
  { id: 'goals_preview', visible: true, colSpan: 1, order: 4, customTitle: 'Goals & Milestones' },
  { id: 'daily_notes', visible: true, colSpan: 1, order: 5, customTitle: 'Daily Notes' },
  {
    id: 'gallery_preview',
    visible: true,
    colSpan: 1,
    order: 6,
    customTitle: 'Private Gallery',
  },
  { id: 'weather', visible: true, colSpan: 1, order: 7, customTitle: 'Weather' },
  { id: 'kpi_funds', visible: true, colSpan: 1, order: 8, customTitle: 'Net Funds Balance' },
  { id: 'kpi_mood', visible: true, colSpan: 1, order: 9, customTitle: 'Latest Mood & Weight' },
  { id: 'kpi_distance', visible: true, colSpan: 1, order: 10, customTitle: 'Run Distance' },
  { id: 'life_stats_panel', visible: false, colSpan: 1, order: 11, customTitle: 'Life Stats' },
  { id: 'distance_panel', visible: false, colSpan: 1, order: 12, customTitle: 'Distance' },
  {
    id: 'short_term_goals',
    visible: false,
    colSpan: 1,
    order: 13,
    customTitle: 'Short-Term Milestones',
  },
  {
    id: 'quick_capture',
    visible: false,
    colSpan: 1,
    order: 14,
    customTitle: 'Quick Capture Matrix',
  },
];

export const DEFAULT_LAYOUT_CONFIG: LayoutConfig = {
  layoutVersion: 5,
  widgets: DEFAULT_DASHBOARD_WIDGETS,
  gridColumns: 3,
  pageWidth: 'standard',
  fontScale: 1,
  density: 'comfortable',
  sidebarPosition: 'left',
  sidebarIconColor: '#00E5FF',
  fundsColumnTitles: {
    date: 'Date',
    type: 'Type',
    category: 'Category',
    description: 'Description',
    amount: 'Amount (USD)',
    actions: 'Actions',
  },
  timelineColumnTitles: {
    time: 'Time Window',
    category: 'Category',
    title: 'Activity / Event',
    duration: 'Duration',
    notes: 'Notes',
    actions: 'Actions',
  },
  hiddenFundsColumns: [],
  hiddenTimelineColumns: [],
  customFundsColumns: [],
  customTimelineColumns: [],
  sidebarGroupOrder: ['daily_ops', 'biometrics', 'wealth', 'vault_sys'],
  sidebarGroupItems: {
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
  },
  sidebarGroupLabels: {
    daily_ops: 'Personal',
    biometrics: 'Biometrics & Mobility',
    wealth: 'Wealth & Strategy',
    vault_sys: 'Vault & System',
  },
  sidebarItemLabels: {
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
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  userName: 'User',
  guildName: 'Aegis Vanguard',
  avatarDataUrl: '',
  appName: 'Axiom Aegis',
  appShortName: 'AA',
  accentColor: 'aegis_gold',
  sidebarIconColor: '#00E5FF',
  sidebarPosition: 'left',
  textColorConfig: DEFAULT_TEXT_COLOR_CONFIG,
  surfaceConfig: DEFAULT_SURFACE_CONFIG,
  autoLockMinutes: 0,
  unitSystem: 'imperial',
  distanceUnit: 'mi',
  startingBalance: 0,
  currencySymbol: '$',
  weatherLocation: '',
  weatherCoords: { lat: 0, lon: 0 },
  columns: {
    fundsColumnsOrder: ['date', 'type', 'category', 'description', 'amount', 'actions'],
    timelineColumnsOrder: ['time', 'category', 'title', 'duration', 'notes', 'actions'],
  },
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
  dashboardWidgets: DEFAULT_DASHBOARD_WIDGETS,
  layoutConfig: DEFAULT_LAYOUT_CONFIG,
  sidebarGroupOrder: ['daily_ops', 'biometrics', 'wealth', 'vault_sys'],
  sidebarGroupItems: {
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
  },
  sidebarGroupLabels: {
    daily_ops: 'Personal',
    biometrics: 'Biometrics & Mobility',
    wealth: 'Wealth & Strategy',
    vault_sys: 'Vault & System',
  },
  sidebarItemLabels: {
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
  },
  quoteState: DEFAULT_QUOTE_STATE,
  cloudSyncConfig: {
    enabled: false,
    autoSyncOnChange: true,
    storageSpace: 'appDataFolder',
    conflictStrategy: 'auto_merge',
  },
};

/**
 * Creates a 100% empty, clean-slate AppData instance with zero hardcoded/mock/demo records.
 */
export function createInitialAppData(customName?: string, customUserName?: string): AppData {
  const defaultCats = DEFAULT_CATEGORIES.map((c) => ({ ...c }));

  return {
    version: 43,
    categories: defaultCats,
    settings: {
      ...DEFAULT_SETTINGS,
      userName: customUserName?.trim() || DEFAULT_SETTINGS.userName,
      appName: customName?.trim() || DEFAULT_SETTINGS.appName,
      appShortName: DEFAULT_SETTINGS.appShortName,
      categories: defaultCats,
    },
    quoteState: DEFAULT_QUOTE_STATE,
    frequentEvents: [],
    shortcuts: [],
    siteImprovements: [],
    customNavCategories: [],
    timeline: [],
    lifeStats: [],
    distances: [],
    funds: [],
    bills: [],
    goals: [],
    gallery: [],
    dailyNotes: [],
    chores: [],
    deletedItemTombstones: {},
    updatedAt: Date.now(),
  };
}


