import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import {
  AccentColor,
  CategoryDomain,
  CustomCategoryVisibility,
  CustomNavCategory,
  CustomPanelColor,
  CustomPanelType,
  DashboardWidgetConfig,
  DistanceUnit,
  GalleryItem,
  GridDensityMode,
  PageWidthMode,
  QuoteItem,
  SidebarPositionMode,
  SurfacePresetId,
  TabType,
  TextColorPresetId,
  UnitSystem,
} from '../types';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import {
  ACCENT_THEMES,
  BORDER_PRESETS,
  CURATED_20_ACCENTS,
  SURFACE_PRESETS,
  TEXT_COLOR_PRESETS,
  resolveSurfaceConfig,
  resolveTextColorConfig,
  evaluateWcagContrast,
  computeThemeCssVariables,
  resetToTacticalFlatBlackDefaults,
} from '../utils/theme';
import { APP_VERSION, APP_FULL_NAME, APP_SHORT_NAME } from '../utils/version';
import {
  Settings as SettingsIcon,
  Shield,
  Palette,
  KeyRound,
  Download,
  Upload,
  AlertTriangle,
  Check,
  FileUp,
  FileSpreadsheet,
  MapPin,
  Folder,
  Type,
  Info,
  Sparkles,
  Sliders,
  Maximize2,
  LayoutGrid,
  Layers,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  RotateCcw,
  Quote,
  Shuffle,
  Pin,
  Columns,
  Scale,
  Compass,
  Coins,
  CloudSun,
  ListChecks,
  FileText,
  Hash,
  Activity,
  RotateCw,
  X,
  ChevronRight,
  ExternalLink,
  Lock,
  Copy,
  Fingerprint,
  BookOpen,
  Tag,
  Cloud,
  CloudOff,
  Share2,
  HardDrive,
  QrCode,
  Smartphone,
  Globe,
} from 'lucide-react';
import {
  generatePairingQrSvg,
} from '../utils/cloudSyncEngine';
import { isFileProtocol } from '../utils/mobilePwaEngine';
import {
  downloadStandaloneApp,
  downloadWindowsDesktopLauncher,
  downloadAxiomAegisIco,
  getVersionFileSlug,
} from '../utils/downloadApp';
import { BrandLogo } from './BrandLogo';
import { RoleBadge } from './RoleBadge';
import { DEFAULT_DASHBOARD_WIDGETS, DEFAULT_LAYOUT_CONFIG } from '../utils/defaults';
import {
  DEFAULT_WIDGET_TITLES,
  createCustomMatrixColumn,
  normalizeColSpan,
  sanitizeColumnTitle,
  updateMatrixCardSpan,
  updateMatrixCardTitle,
  toggleMatrixCardVisibility,
} from '../utils/matrixLayoutEngine';
import {
  resolveActiveQuote,
  cycleToNextQuote,
  togglePinQuote,
  upsertCustomQuote,
  deleteCustomQuote,
} from '../utils/quoteEngine';
import {
  getCategoriesByDomain,
  countCategoryReferences,
  updateCategoryColorInDomain,
  deleteCategoryFromDomain,
} from '../utils/categoryEngine';
import { recordDeletedItemTombstones } from './chores/choresStore';
import { InlineCategoryBadge } from './InlineCategoryBadge';
import {
  DEFAULT_SIDEBAR_GROUP_ORDER,
  DEFAULT_SIDEBAR_GROUP_ITEMS,
  DEFAULT_SIDEBAR_GROUP_LABELS,
  DEFAULT_SIDEBAR_ITEM_LABELS,
  isAdminOnlySidebarItem,
  sanitizeSidebarGroupOrder,
  sanitizeSidebarGroupItems,
  sanitizeSidebarGroupLabels,
  sanitizeSidebarItemLabels,
  sanitizeSidebarLabel,
  moveSidebarGroupOrder,
  moveSidebarItemByDrag,
  moveSidebarItemStep,
} from '../utils/sidebarEngine';

export type CustomizationTab =
  | 'appearance'
  | 'workspace'
  | 'navigation'
  | 'panels'
  | 'categories'
  | 'quotes'
  | 'general'
  | 'units'
  | 'security'
  | 'sync'
  | 'import'
  | 'all';

export interface SettingsViewProps {
  mode?: 'customization' | 'settings';
}

const WEATHER_PRESETS: { city: string; lat: number; lon: number }[] = [
  { city: 'New York, US', lat: 40.7128, lon: -74.006 },
  { city: 'San Francisco, US', lat: 37.7749, lon: -122.4194 },
  { city: 'Chicago, US', lat: 41.8781, lon: -87.6298 },
  { city: 'Austin, US', lat: 30.2672, lon: -97.7431 },
  { city: 'London, UK', lat: 51.5074, lon: -0.1278 },
  { city: 'Paris, FR', lat: 48.8566, lon: 2.3522 },
  { city: 'Berlin, DE', lat: 52.52, lon: 13.405 },
  { city: 'Tokyo, JP', lat: 35.6762, lon: 139.6503 },
  { city: 'Sydney, AU', lat: -33.8688, lon: 151.2093 },
  { city: 'Toronto, CA', lat: 43.6532, lon: -79.3832 },
];

const CURRENCY_PRESETS = [
  { symbol: '$', label: 'USD / CAD / AUD ($)' },
  { symbol: '€', label: 'EUR (€)' },
  { symbol: '£', label: 'GBP (£)' },
  { symbol: '¥', label: 'JPY / CNY (¥)' },
  { symbol: '₹', label: 'INR (₹)' },
  { symbol: 'CHF', label: 'CHF (Fr)' },
  { symbol: 'kr', label: 'SEK / NOK (kr)' },
  { symbol: 'R$', label: 'BRL (R$)' },
];

const ICON_COLOR_SWATCHES: { hex: string; label: string }[] = [
  { hex: '#00E5FF', label: 'Cyber Cyan' },
  { hex: '#E5A93C', label: 'Aegis Gold' },
  { hex: '#10B981', label: 'Emerald Matrix' },
  { hex: '#A855F7', label: 'Quantum Violet' },
  { hex: '#F43F5E', label: 'Crimson Pulse' },
  { hex: '#84CC16', label: 'Toxic Lime' },
  { hex: '#F8FAFC', label: 'Crisp White' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({ mode }) => {
  const {
    appData,
    updateAppData,
    layoutConfig,
    updateLayoutConfig,
    accent,
    activeTab,
    setActiveTab,
    lockVault,
    changePassphrase,
    verifyCredential,
    activeEncryptionKeyHex,
    activeRecoveryKey,
    keyFingerprint,
    hasCustomPassword,
    encryptedPayloadMeta,
    exportEncryptedBackup,
    importEncryptedBackup,
    resetVault,
    openImportHub,
    showNotification,
    weather,
    isWeatherLoading,
    refreshWeather,
    detectMyWeatherLocation,
    searchAndSaveWeatherLocation,
    addCategory,
    cloudSyncStatus,
    cloudSyncError,
    lastSyncFeedback,
    lastCloudSyncAt,
    accountSession,
    accountRole,
    isMasterAdmin,
    signOutAccount,
    updateAccountDisplayName,
    exportAccountSnapshot,
    importAccountSnapshot,
    syncVaultNow,
    forcePushVaultToCloud,
    forcePullVaultFromCloud,
  } = useVault();

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [accountDisplayNameInput, setAccountDisplayNameInput] = useState(
    accountSession?.displayName ||
      appData?.settings?.commanderName ||
      appData?.settings?.userName ||
      'Commander'
  );
  const [isImportingSnapshot, setIsImportingSnapshot] = useState(false);

  useEffect(() => {
    const nextName =
      accountSession?.displayName ||
      appData?.settings?.commanderName ||
      appData?.settings?.userName;
    if (nextName) {
      setAccountDisplayNameInput(nextName);
    }
  }, [
    accountSession?.displayName,
    appData?.settings?.commanderName,
    appData?.settings?.userName,
  ]);

  const isCustomizationMode =
    (mode || (activeTab === 'customization' ? 'customization' : 'settings')) === 'customization';

  // Active section tab in current view (defaults to 'appearance' in Customization Studio so there is zero mega-scroll wall)
  const [activeCustomizationTab, setActiveCustomizationTab] = useState<CustomizationTab>(
    isCustomizationMode ? 'appearance' : 'all'
  );

  useEffect(() => {
    const rawHash = window.location.hash.replace('#', '') as CustomizationTab;
    if (isCustomizationMode) {
      if (rawHash === 'categories') {
        setActiveCustomizationTab('navigation');
      } else if (['appearance', 'workspace', 'panels', 'navigation', 'quotes'].includes(rawHash)) {
        setActiveCustomizationTab(rawHash);
      } else {
        setActiveCustomizationTab('appearance');
      }
    } else {
      const validForSettings: CustomizationTab[] = ['general', 'units', 'sync', 'import', 'all'];
      setActiveCustomizationTab(validForSettings.includes(rawHash) ? rawHash : 'all');
    }
  }, [isCustomizationMode]);

  // Settings local edit state
  const [userName, setUserName] = useState(
    appData?.settings?.commanderName || appData?.settings?.userName || 'User'
  );
  const [guildName, setGuildName] = useState(
    appData?.settings?.guildName || 'Aegis Vanguard'
  );
  const [isUploadingAvatarGallery, setIsUploadingAvatarGallery] = useState(false);
  const [appName, setAppName] = useState(appData?.settings?.appName || APP_FULL_NAME);
  const [appShortName, setAppShortName] = useState(
    appData?.settings?.appShortName || APP_SHORT_NAME
  );
  const [autoLockMinutes, setAutoLockMinutes] = useState(
    appData?.settings?.autoLockMinutes ?? 15
  );
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(
    appData?.settings?.distanceUnit || 'mi'
  );
  const [unitSystem, setUnitSystem] = useState<UnitSystem>(
    appData?.settings?.unitSystem || 'imperial'
  );
  const [currencySymbol, setCurrencySymbol] = useState(
    appData?.settings?.currencySymbol || '$'
  );
  const [startingBalance, setStartingBalance] = useState(
    String(appData?.settings?.startingBalance ?? 0)
  );

  // Weather local edit state
  const [weatherCity, setWeatherCity] = useState(
    appData?.settings?.weatherLocation || ''
  );
  const [weatherLat, setWeatherLat] = useState(
    String(appData?.settings?.weatherCoords?.lat ?? 0)
  );
  const [weatherLon, setWeatherLon] = useState(
    String(appData?.settings?.weatherCoords?.lon ?? 0)
  );
  const [weatherSearchQuery, setWeatherSearchQuery] = useState('');

  // Resolved text color & surface configs
  const resolvedTextColor = resolveTextColorConfig(
    appData?.settings?.textColorConfig,
    accent.hex
  );
  const [customPrimaryHex, setCustomPrimaryHex] = useState(resolvedTextColor.primaryHex);
  const [customSecondaryHex, setCustomSecondaryHex] = useState(resolvedTextColor.secondaryHex);

  const resolvedSurface = resolveSurfaceConfig(appData?.settings?.surfaceConfig);
  const [customCanvasHex, setCustomCanvasHex] = useState(resolvedSurface.canvasHex);
  const [customColumnHex, setCustomColumnHex] = useState(resolvedSurface.columnHex);
  const [customCardHex, setCustomCardHex] = useState(resolvedSurface.cardHex);
  const [customBorderHex, setCustomBorderHex] = useState(resolvedSurface.borderHex || '#1E222B');
  const [customAccentHexInput, setCustomAccentHexInput] = useState(
    appData?.settings?.customAccentHex || accent.hex
  );
  const [customIconHexInput, setCustomIconHexInput] = useState(
    appData?.settings?.sidebarIconColor || layoutConfig?.sidebarIconColor || '#00E5FF'
  );

  // Custom panel creation form state + collapsible drawer toggle
  const [isCustomPanelDrawerOpen, setIsCustomPanelDrawerOpen] = useState(false);
  const [newPanelTitle, setNewPanelTitle] = useState('');
  const [newPanelType, setNewPanelType] = useState<CustomPanelType>('checklist');
  const [newPanelSpan, setNewPanelSpan] = useState<1 | 2 | 3 | 'full'>(1);
  const [newPanelColor, setNewPanelColor] = useState<CustomPanelColor>('toxic_lime');
  const [newCounterTarget, setNewCounterTarget] = useState('10');
  const [newCounterUnit, setNewCounterUnit] = useState('tasks');
  const [newCounterStep, setNewCounterStep] = useState('1');

  // Quotes custom maxim state
  const [newQuoteText, setNewQuoteText] = useState('');
  const [newQuoteAuthor, setNewQuoteAuthor] = useState('');
  const [newQuoteCategory, setNewQuoteCategory] = useState<string>('discipline');

  // Category Management state
  const [activeCategoryDomain, setActiveCategoryDomain] = useState<CategoryDomain>('timeline');
  const [newCategoryNameInput, setNewCategoryNameInput] = useState('');
  const [newCategoryColorInput, setNewCategoryColorInput] = useState('#10B981');

  // Sidebar Categories & Subsections customization state
  const [studioNewCatName, setStudioNewCatName] = useState('');
  const [studioNewCatGroup, setStudioNewCatGroup] = useState('vault_sys');
  const [studioNewCatVisibility, setStudioNewCatVisibility] =
    useState<CustomCategoryVisibility>('admin_only');

  const currentSidebarGroupOrder = sanitizeSidebarGroupOrder(
    appData?.settings?.sidebarGroupOrder || layoutConfig?.sidebarGroupOrder
  );
  const currentSidebarGroupItems = sanitizeSidebarGroupItems(
    appData?.settings?.sidebarGroupItems || layoutConfig?.sidebarGroupItems,
    appData?.customNavCategories
  );
  const currentSidebarGroupLabels = sanitizeSidebarGroupLabels(
    appData?.settings?.sidebarGroupLabels || layoutConfig?.sidebarGroupLabels
  );
  const currentSidebarItemLabels = sanitizeSidebarItemLabels(
    appData?.settings?.sidebarItemLabels || layoutConfig?.sidebarItemLabels,
    appData?.customNavCategories
  );

  const [draftGroupLabels, setDraftGroupLabels] = useState<Record<string, string>>(
    currentSidebarGroupLabels
  );
  const [draftItemLabels, setDraftItemLabels] = useState<Record<string, string>>(
    currentSidebarItemLabels
  );

  useEffect(() => {
    setDraftGroupLabels(
      sanitizeSidebarGroupLabels(
        appData?.settings?.sidebarGroupLabels || layoutConfig?.sidebarGroupLabels
      )
    );
  }, [appData?.settings?.sidebarGroupLabels, layoutConfig?.sidebarGroupLabels]);

  useEffect(() => {
    setDraftItemLabels(
      sanitizeSidebarItemLabels(
        appData?.settings?.sidebarItemLabels || layoutConfig?.sidebarItemLabels,
        appData?.customNavCategories
      )
    );
  }, [
    appData?.settings?.sidebarItemLabels,
    layoutConfig?.sidebarItemLabels,
    appData?.customNavCategories,
  ]);

  const handleStudioCreateCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMasterAdmin) return;
    const cleanName = studioNewCatName.trim().slice(0, 48);
    if (!cleanName) {
      showNotification('Please enter a name for the custom category.', 'error');
      return;
    }
    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24);
    const id = `custom_cat_${slug || 'view'}_${Date.now().toString(36)}`;
    const now = Date.now();
    const created: CustomNavCategory = {
      id,
      name: cleanName,
      visibility: studioNewCatVisibility,
      parentGroupId: studioNewCatGroup,
      order: (appData?.customNavCategories || []).length,
      notes: '',
      checklist: [
        { id: `chk-${now}-1`, text: `Initialize ${cleanName} objectives`, completed: false },
      ],
      statusCards: [
        { id: `card-${now}-1`, title: 'Status', value: 'Operational', status: 'Nominal' },
        {
          id: `card-${now}-2`,
          title: 'Visibility',
          value: studioNewCatVisibility === 'admin_only' ? 'Admin Only' : 'All Users',
          status: 'Active',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    const nextCats = [...(appData?.customNavCategories || []), created];
    const sidebarItemId = `nav-custom-${id}`;
    const targetList = currentSidebarGroupItems[studioNewCatGroup] || [];
    const nextGroupItems = {
      ...currentSidebarGroupItems,
      [studioNewCatGroup]: targetList.includes(sidebarItemId)
        ? targetList
        : [...targetList, sidebarItemId],
    };
    const nextItemLabels = {
      ...currentSidebarItemLabels,
      [sidebarItemId]: cleanName,
    };
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupItems: nextGroupItems,
      sidebarItemLabels: nextItemLabels,
    }));
    await updateAppData((prev) => ({
      ...prev,
      customNavCategories: nextCats,
      settings: {
        ...prev.settings,
        sidebarGroupItems: nextGroupItems,
        sidebarItemLabels: nextItemLabels,
      },
    }));
    setStudioNewCatName('');
    showNotification(
      `Created ${
        studioNewCatVisibility === 'admin_only' ? 'Admin-Only' : 'All-Users'
      } category "${cleanName}"!`,
      'success'
    );
  };

  const handleStudioToggleCustomCategoryVisibility = async (catId: string) => {
    if (!isMasterAdmin) return;
    const nextCats = (appData?.customNavCategories || []).map((c) =>
      c.id === catId
        ? {
            ...c,
            visibility: (c.visibility === 'admin_only'
              ? 'all_users'
              : 'admin_only') as CustomCategoryVisibility,
            updatedAt: Date.now(),
          }
        : c
    );
    await updateAppData((prev) => ({
      ...prev,
      customNavCategories: nextCats,
    }));
  };

  const handleStudioDeleteCustomCategory = async (catId: string, catName: string) => {
    if (!isMasterAdmin) return;
    const nextCats = (appData?.customNavCategories || []).filter((c) => c.id !== catId);
    const sidebarItemId = `nav-custom-${catId}`;
    const cleanedGroupItems: Record<string, string[]> = {};
    for (const [gId, list] of Object.entries(currentSidebarGroupItems)) {
      cleanedGroupItems[gId] = list.filter((id) => id !== sidebarItemId);
    }
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupItems: cleanedGroupItems,
    }));
    await updateAppData((prev) => ({
      ...prev,
      customNavCategories: nextCats,
      settings: {
        ...prev.settings,
        sidebarGroupItems: cleanedGroupItems,
      },
    }));
    showNotification(`Deleted custom category "${catName}".`, 'info');
  };

  const handleRenameSidebarGroup = (groupId: string, rawVal: string, finalize = false) => {
    setDraftGroupLabels((prev) => ({ ...prev, [groupId]: rawVal }));
    const trimmed = rawVal.trim();
    if (!trimmed && !finalize) return;
    const defaultLabel = DEFAULT_SIDEBAR_GROUP_LABELS[groupId] || 'Category';
    const nextLabel = sanitizeSidebarLabel(trimmed || defaultLabel, defaultLabel);
    if (finalize && !trimmed) {
      setDraftGroupLabels((prev) => ({ ...prev, [groupId]: defaultLabel }));
    }
    const nextMap = {
      ...currentSidebarGroupLabels,
      [groupId]: nextLabel,
    };
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupLabels: nextMap,
    }));
  };

  const handleRenameSidebarItem = (itemId: string, rawVal: string, finalize = false) => {
    setDraftItemLabels((prev) => ({ ...prev, [itemId]: rawVal }));
    const trimmed = rawVal.trim();
    if (!trimmed && !finalize) return;
    const defaultLabel = DEFAULT_SIDEBAR_ITEM_LABELS[itemId] || 'Subsection';
    const nextLabel = sanitizeSidebarLabel(trimmed || defaultLabel, defaultLabel);
    if (finalize && !trimmed) {
      setDraftItemLabels((prev) => ({ ...prev, [itemId]: defaultLabel }));
    }
    const nextMap = {
      ...currentSidebarItemLabels,
      [itemId]: nextLabel,
    };
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarItemLabels: nextMap,
    }));
  };

  const handleReassignSidebarItemToGroup = (itemId: string, targetGroupId: string) => {
    const nextItems = moveSidebarItemByDrag(currentSidebarGroupItems, itemId, {
      type: 'group',
      targetGroupId,
    });
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupItems: nextItems,
    }));
    const itemLabel = currentSidebarItemLabels[itemId] || DEFAULT_SIDEBAR_ITEM_LABELS[itemId] || itemId;
    const groupLabel =
      currentSidebarGroupLabels[targetGroupId] ||
      DEFAULT_SIDEBAR_GROUP_LABELS[targetGroupId] ||
      targetGroupId;
    showNotification(`Moved "${itemLabel}" to "${groupLabel}"`, 'info');
  };

  const handleMoveSidebarGroupFromStudio = (groupId: string, direction: 'up' | 'down') => {
    const nextOrder = moveSidebarGroupOrder(currentSidebarGroupOrder, groupId, direction);
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupOrder: nextOrder,
    }));
  };

  const handleStepSidebarItemFromStudio = (itemId: string, direction: 'up' | 'down') => {
    const nextItems = moveSidebarItemStep(
      currentSidebarGroupItems,
      currentSidebarGroupOrder,
      itemId,
      direction
    );
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupItems: nextItems,
    }));
  };

  const handleResetAllSidebarCustomizations = () => {
    const defaultOrder = [...DEFAULT_SIDEBAR_GROUP_ORDER];
    const defaultItems = sanitizeSidebarGroupItems(
      DEFAULT_SIDEBAR_GROUP_ITEMS as unknown as Record<string, string[]>,
      appData?.customNavCategories
    );
    const defaultGroupLabels = { ...DEFAULT_SIDEBAR_GROUP_LABELS };
    const defaultItemLabels = sanitizeSidebarItemLabels(
      { ...DEFAULT_SIDEBAR_ITEM_LABELS },
      appData?.customNavCategories
    );
    setDraftGroupLabels(defaultGroupLabels);
    setDraftItemLabels(defaultItemLabels);
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupOrder: defaultOrder,
      sidebarGroupItems: defaultItems,
      sidebarGroupLabels: defaultGroupLabels,
      sidebarItemLabels: defaultItemLabels,
    }));
    showNotification('Sidebar categories and subsections restored to defaults', 'success');
  };

  useEffect(() => {
    if (appData?.settings) {
      setUserName(appData.settings.commanderName || appData.settings.userName || 'User');
      setGuildName(appData.settings.guildName || 'Aegis Vanguard');
      setAppName(appData.settings.appName || APP_FULL_NAME);
      setAppShortName(appData.settings.appShortName || APP_SHORT_NAME);
      setAutoLockMinutes(appData.settings.autoLockMinutes ?? 15);
      setDistanceUnit(appData.settings.distanceUnit || 'mi');
      setUnitSystem(appData.settings.unitSystem || 'imperial');
      setCurrencySymbol(appData.settings.currencySymbol || '$');
      setStartingBalance(String(appData.settings.startingBalance ?? 0));
      setWeatherCity(appData.settings.weatherLocation || '');
      setWeatherLat(String(appData.settings.weatherCoords?.lat ?? 0));
      setWeatherLon(String(appData.settings.weatherCoords?.lon ?? 0));
      const nextText = resolveTextColorConfig(appData.settings.textColorConfig, accent.hex);
      setCustomPrimaryHex(nextText.primaryHex);
      setCustomSecondaryHex(nextText.secondaryHex);
      const nextSurface = resolveSurfaceConfig(appData.settings.surfaceConfig);
      setCustomCanvasHex(nextSurface.canvasHex);
      setCustomColumnHex(nextSurface.columnHex);
      setCustomCardHex(nextSurface.cardHex);
      setCustomBorderHex(nextSurface.borderHex || '#1E222B');
      setCustomAccentHexInput(appData.settings.customAccentHex || accent.hex);
      setCustomIconHexInput(
        appData.settings.sidebarIconColor || layoutConfig?.sidebarIconColor || '#00E5FF'
      );
    }
  }, [
    appData?.settings?.userName,
    appData?.settings?.guildName,
    appData?.settings?.appName,
    appData?.settings?.appShortName,
    appData?.settings?.autoLockMinutes,
    appData?.settings?.distanceUnit,
    appData?.settings?.unitSystem,
    appData?.settings?.currencySymbol,
    appData?.settings?.startingBalance,
    appData?.settings?.weatherLocation,
    appData?.settings?.weatherCoords?.lat,
    appData?.settings?.weatherCoords?.lon,
    appData?.settings?.textColorConfig,
    appData?.settings?.surfaceConfig,
    appData?.settings?.customAccentHex,
    appData?.settings?.sidebarIconColor,
    layoutConfig?.sidebarIconColor,
    accent.hex,
  ]);

  // ---------------------------------------------------------------------------
  // 1. APPEARANCE & THEME HANDLERS
  // ---------------------------------------------------------------------------
  const currentSidebarPosition: SidebarPositionMode =
    appData?.settings?.sidebarPosition === 'bottom' || layoutConfig?.sidebarPosition === 'bottom'
      ? 'bottom'
      : 'left';

  const currentSidebarIconColor =
    appData?.settings?.sidebarIconColor || layoutConfig?.sidebarIconColor || accent.hex;

  const handleSetSidebarPosition = async (pos: SidebarPositionMode) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarPosition: pos,
    }));
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        sidebarPosition: pos,
        layoutConfig: {
          ...(prev.settings.layoutConfig || layoutConfig),
          sidebarPosition: pos,
        },
      },
    }));
    showNotification(
      `Navigation position set to ${pos === 'bottom' ? 'Bottom Bar' : 'Left Sidebar'}`,
      'info'
    );
  };

  const handleSetSidebarIconColor = async (hexColor: string) => {
    setCustomIconHexInput(hexColor);
    const clean = /^#[0-9A-Fa-f]{6}$/.test(hexColor.trim())
      ? hexColor.trim().toUpperCase()
      : null;
    if (!clean) return;
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarIconColor: clean,
    }));
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        sidebarIconColor: clean,
        layoutConfig: {
          ...(prev.settings.layoutConfig || layoutConfig),
          sidebarIconColor: clean,
        },
      },
    }));
  };

  const handleUploadProfileGalleryImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;

    setIsUploadingAvatarGallery(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const newItems: GalleryItem[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImageToDataUrl(file, 256, 0.8);
        newItems.push({
          id: `img-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
          title: file.name.replace(/\.[^/.]+$/, '') || `Avatar ${i + 1}`,
          dataUrl: compressed.dataUrl,
          date: todayStr,
          tags: ['Avatar', 'Gallery'],
          sizeKb: compressed.sizeKb,
          createdAt: Date.now() + i,
        });
      }

      const firstDataUrl = newItems[0]?.dataUrl;
      await updateAppData((prev) => ({
        ...prev,
        gallery: [...newItems, ...(prev.gallery || [])],
        settings: {
          ...prev.settings,
          avatarDataUrl: prev.settings.avatarDataUrl || firstDataUrl || '',
        },
      }));
      showNotification(
        `Uploaded & compressed ${newItems.length} image${newItems.length === 1 ? '' : 's'} to Private Gallery!`,
        'success'
      );
    } catch {
      showNotification('Failed to process uploaded image', 'error');
    } finally {
      setIsUploadingAvatarGallery(false);
      e.target.value = '';
    }
  };

  const handleSelectProfileAvatarFromGallery = async (dataUrl: string, title: string) => {
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        avatarDataUrl: dataUrl,
      },
    }));
    showNotification(`Active Profile Avatar set to "${title}"!`, 'success');
  };

  const handleDeleteGalleryImageFromSettings = async (item: GalleryItem) => {
    await updateAppData((prev) => {
      const nextGallery = (prev.gallery || []).filter((g) => g.id !== item.id);
      const isDeletingActiveAvatar = prev.settings?.avatarDataUrl === item.dataUrl;
      return {
        ...prev,
        gallery: nextGallery,
        settings: isDeletingActiveAvatar
          ? {
              ...prev.settings,
              avatarDataUrl: nextGallery[0]?.dataUrl || '',
            }
          : prev.settings,
      };
    });
    showNotification(`Deleted "${item.title}" from Private Gallery`, 'info');
  };

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const bal = parseFloat(startingBalance);
    const cleanUserName = userName.trim() || 'Commander';
    const cleanGuildName = guildName.trim().slice(0, 48) || 'Aegis Vanguard';
    const cleanAppName = appName.trim() || APP_FULL_NAME;
    const cleanShortName = appShortName.trim().slice(0, 8) || APP_SHORT_NAME;
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        userName: cleanUserName,
        commanderName: cleanUserName,
        guildName: cleanGuildName,
        appName: cleanAppName,
        appShortName: cleanShortName,
        autoLockMinutes: Number(autoLockMinutes),
        distanceUnit,
        unitSystem,
        currencySymbol: currencySymbol.trim() || '$',
        startingBalance: isNaN(bal) ? prev.settings.startingBalance : bal,
      },
    }));
    await updateAccountDisplayName(cleanUserName);
    showNotification(
      `Profile saved: ${cleanUserName} [${cleanGuildName}] • ${cleanAppName} (${cleanShortName})!`,
      'success'
    );
  };

  const handleSelectAccent = async (color: AccentColor) => {
    const themeMeta = ACCENT_THEMES[color];
    setCustomAccentHexInput(themeMeta.hex);
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        accentColor: color,
        customAccentHex: undefined,
      },
    }));
    showNotification(`Accent changed to ${themeMeta.name} (${themeMeta.hex})`, 'success');
  };

  const handleApplyCustomAccentHex = async (rawHex: string) => {
    setCustomAccentHexInput(rawHex);
    const clean = rawHex.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      const normalized = clean.toUpperCase();
      const matchingPreset = CURATED_20_ACCENTS.find((c) => c.hex.toUpperCase() === normalized);
      await updateAppData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          accentColor: matchingPreset ? (matchingPreset.id as AccentColor) : prev.settings.accentColor,
          customAccentHex: matchingPreset ? undefined : normalized,
        },
      }));
    }
  };

  const handleSelectTextPreset = async (presetId: TextColorPresetId) => {
    const nextResolved = resolveTextColorConfig(
      {
        preset: presetId,
        primaryHex: customPrimaryHex,
        secondaryHex: customSecondaryHex,
      },
      accent.hex
    );
    setCustomPrimaryHex(nextResolved.primaryHex);
    setCustomSecondaryHex(nextResolved.secondaryHex);
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        textColorConfig: nextResolved,
      },
    }));
    const presetLabel =
      TEXT_COLOR_PRESETS.find((p) => p.id === presetId)?.label || 'Custom Hex';
    showNotification(`Text color preset set to ${presetLabel}`, 'info');
  };

  const handleApplyCustomTextHex = async (nextPrimary: string, nextSecondary: string) => {
    setCustomPrimaryHex(nextPrimary);
    setCustomSecondaryHex(nextSecondary);
    const isValidPrimary = /^#[0-9A-Fa-f]{6}$/.test(nextPrimary.trim());
    const isValidSecondary = /^#[0-9A-Fa-f]{6}$/.test(nextSecondary.trim());
    if (isValidPrimary && isValidSecondary) {
      await updateAppData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          textColorConfig: {
            preset: 'custom',
            primaryHex: nextPrimary.trim().toUpperCase(),
            secondaryHex: nextSecondary.trim().toUpperCase(),
          },
        },
      }));
    }
  };

  const handleSelectSurfacePreset = async (presetId: SurfacePresetId) => {
    const nextResolved = resolveSurfaceConfig({
      preset: presetId,
      canvasHex: customCanvasHex,
      columnHex: customColumnHex,
      cardHex: customCardHex,
      borderHex: customBorderHex,
    });
    setCustomCanvasHex(nextResolved.canvasHex);
    setCustomColumnHex(nextResolved.columnHex);
    setCustomCardHex(nextResolved.cardHex);
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        surfaceConfig: nextResolved,
      },
    }));
    const presetLabel =
      SURFACE_PRESETS.find((p) => p.id === presetId)?.label || 'Custom Hex';
    showNotification(`Surface architecture set to ${presetLabel}`, 'info');
  };

  const handleResetToTacticalFlatBlackDefault = async () => {
    setCustomCanvasHex('#000000');
    setCustomColumnHex('#000000');
    setCustomCardHex('#000000');
    setCustomBorderHex('#1E222B');
    setCustomPrimaryHex('#F8FAFC');
    setCustomSecondaryHex('#94A3B8');
    setCustomAccentHexInput('#E5A93C');
    setCustomIconHexInput('#00E5FF');
    updateLayoutConfig((prev) => ({
      ...prev,
      gridColumns: 3,
      pageWidth: 'standard',
      customPageMaxWidthPx: undefined,
      fontScale: 1,
      density: 'comfortable',
      customGridGapPx: undefined,
      sidebarPosition: 'left',
      sidebarIconColor: '#00E5FF',
    }));
    await updateAppData((prev) => ({
      ...prev,
      settings: resetToTacticalFlatBlackDefaults(prev.settings),
    }));
    showNotification(
      'Reset to Tactical Flat-Black Default (#000000 surfaces • #1E222B border • #F8FAFC text • Aegis Gold)',
      'success'
    );
  };

  const handleApplyCustomSurfaceHex = async (
    nextCanvas: string,
    nextColumn: string,
    nextCard: string,
    nextBorder: string = customBorderHex
  ) => {
    setCustomCanvasHex(nextCanvas);
    setCustomColumnHex(nextColumn);
    setCustomCardHex(nextCard);
    setCustomBorderHex(nextBorder);
    const isValidCanvas = /^#[0-9A-Fa-f]{6}$/.test(nextCanvas.trim());
    const isValidColumn = /^#[0-9A-Fa-f]{6}$/.test(nextColumn.trim());
    const isValidCard = /^#[0-9A-Fa-f]{6}$/.test(nextCard.trim());
    const isValidBorder = /^#[0-9A-Fa-f]{6}$/.test(nextBorder.trim());
    if (isValidCanvas && isValidColumn && isValidCard && isValidBorder) {
      await updateAppData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          surfaceConfig: {
            preset: 'custom',
            canvasHex: nextCanvas.trim().toUpperCase(),
            columnHex: nextColumn.trim().toUpperCase(),
            cardHex: nextCard.trim().toUpperCase(),
            borderHex: nextBorder.trim().toUpperCase(),
          },
        },
      }));
    }
  };

  const handleApplyCustomBorderHex = async (nextBorder: string) => {
    setCustomBorderHex(nextBorder);
    const clean = nextBorder.trim();
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) {
      const normalized = clean.toUpperCase();
      await updateAppData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          surfaceConfig: {
            ...(prev.settings.surfaceConfig || resolvedSurface),
            borderHex: normalized,
          },
        },
      }));
    }
  };

  // ---------------------------------------------------------------------------
  // 2. DASHBOARD PANELS HANDLERS
  // ---------------------------------------------------------------------------
  const panelsList = layoutConfig.widgets || DEFAULT_DASHBOARD_WIDGETS;

  const handleTogglePanelVisibility = (id: string) => {
    const updated = toggleMatrixCardVisibility(panelsList, id);
    updateLayoutConfig((prev) => ({ ...prev, widgets: updated }));
    const p = panelsList.find((w) => w.id === id);
    const title = p?.customTitle || DEFAULT_WIDGET_TITLES[id] || id;
    showNotification(`Toggled visibility for panel "${title}"`, 'info');
  };

  const handleUpdatePanelSpan = (id: string, colSpan: 1 | 2 | 3 | 'full') => {
    const updated = updateMatrixCardSpan(panelsList, id, colSpan);
    updateLayoutConfig((prev) => ({ ...prev, widgets: updated }));
    showNotification(`Panel span updated to ${colSpan}`, 'success');
  };

  const handleMovePanel = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= panelsList.length) return;
    const nextWidgets = [...panelsList];
    const [moved] = nextWidgets.splice(index, 1);
    nextWidgets.splice(targetIndex, 0, moved);
    const normalized = nextWidgets.map((w, idx) => ({ ...w, order: idx }));
    updateLayoutConfig((prev) => ({ ...prev, widgets: normalized }));
  };

  const handleRenamePanel = (id: string, newTitle: string) => {
    const clean = sanitizeColumnTitle(newTitle, 'Custom Panel');
    const updated = updateMatrixCardTitle(panelsList, id, clean);
    updateLayoutConfig((prev) => ({ ...prev, widgets: updated }));
    showNotification(`Panel renamed to "${clean}"`, 'success');
  };

  const handleDeleteCustomPanel = (id: string) => {
    const target = panelsList.find((w) => w.id === id);
    if (!target?.isCustom) return;
    const nextWidgets = panelsList.filter((w) => w.id !== id).map((w, idx) => ({ ...w, order: idx }));
    updateLayoutConfig((prev) => ({ ...prev, widgets: nextWidgets }));
    showNotification(`Custom panel "${target.customTitle || id}" deleted`, 'info');
  };

  const handleResetPanelsLayout = () => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: DEFAULT_DASHBOARD_WIDGETS,
      gridColumns: 3,
      pageWidth: 'standard',
      customPageMaxWidthPx: undefined,
      density: 'comfortable',
      customGridGapPx: undefined,
      fontScale: 1.0,
    }));
    showNotification('Dashboard panels reset to factory default layout', 'success');
  };

  const handleCreateCustomPanel = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPanelTitle.trim() || 'Tactical Module';
    const targetVal = parseFloat(newCounterTarget) || 10;
    const stepVal = parseFloat(newCounterStep) || 1;
    const nextWidgets = createCustomMatrixColumn(panelsList, title, {
      panelType: newPanelType,
      panelColor: newPanelColor,
      colSpan: newPanelSpan,
      targetValue: targetVal,
      unit: newCounterUnit.trim() || 'units',
      step: stepVal,
    });
    updateLayoutConfig((prev) => ({ ...prev, widgets: nextWidgets }));
    setNewPanelTitle('');
    setIsCustomPanelDrawerOpen(false);
    showNotification(`Created custom panel "${title}" (${newPanelType})`, 'success');
  };

  // ---------------------------------------------------------------------------
  // 4. DAILY MAXIM & QUOTES HANDLERS
  // ---------------------------------------------------------------------------
  const currentQuote = resolveActiveQuote(appData?.quoteState);

  const handleShuffleQuote = async () => {
    const { nextState } = cycleToNextQuote(appData?.quoteState);
    await updateAppData((prev) => ({
      ...prev,
      quoteState: nextState,
      settings: { ...prev.settings, quoteState: nextState },
    }));
    showNotification('Rotated to next daily maxim', 'info');
  };

  const handleTogglePinQuote = async () => {
    const next = togglePinQuote(appData?.quoteState);
    await updateAppData((prev) => ({
      ...prev,
      quoteState: next,
      settings: { ...prev.settings, quoteState: next },
    }));
    showNotification(next.isPinned ? 'Daily maxim pinned' : 'Daily maxim unpinned', 'info');
  };

  const handleAddCustomQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuoteText.trim()) return;
    const res = upsertCustomQuote(
      appData?.quoteState,
      newQuoteText,
      newQuoteAuthor || 'Personal Maxim'
    );
    if (res) {
      await updateAppData((prev) => ({
        ...prev,
        quoteState: res.nextState,
        settings: { ...prev.settings, quoteState: res.nextState },
      }));
      setNewQuoteText('');
      setNewQuoteAuthor('');
      showNotification(`Added and activated custom maxim!`, 'success');
    }
  };

  const handleDeleteCustomQuote = async (quoteId: string) => {
    const next = deleteCustomQuote(appData?.quoteState, quoteId);
    await updateAppData((prev) => ({
      ...prev,
      quoteState: next,
      settings: { ...prev.settings, quoteState: next },
    }));
    showNotification('Custom maxim removed', 'info');
  };

  const handleSelectActiveQuote = async (quoteId: string) => {
    await updateAppData((prev) => {
      const qs = prev.quoteState || { customQuotes: [], isPinned: false };
      const next = { ...qs, activeQuoteId: quoteId };
      return {
        ...prev,
        quoteState: next,
        settings: { ...prev.settings, quoteState: next },
      };
    });
    showNotification('Selected maxim set as active quote of the day', 'success');
  };

  // ---------------------------------------------------------------------------
  // 5. WEATHER & TELEMETRY HANDLERS
  // ---------------------------------------------------------------------------
  const handleSaveWeather = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(weatherLat);
    const lon = parseFloat(weatherLon);
    if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) {
      showNotification('Please enter valid numeric latitude and longitude or use Search City / Detect Location', 'error');
      return;
    }
    const cleanCity = weatherCity.trim() || 'Custom Location';
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        weatherLocation: cleanCity,
        weatherCoords: { lat, lon },
      },
    }));
    await refreshWeather();
    showNotification(`Weather location updated to ${cleanCity} (${lat}, ${lon})`, 'success');
  };

  const handleSelectWeatherPreset = async (preset: { city: string; lat: number; lon: number }) => {
    setWeatherCity(preset.city);
    setWeatherLat(String(preset.lat));
    setWeatherLon(String(preset.lon));
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        weatherLocation: preset.city,
        weatherCoords: { lat: preset.lat, lon: preset.lon },
      },
    }));
  };

  // ---------------------------------------------------------------------------
  // 6. SNAPSHOT IMPORT & FACTORY RESET HANDLERS
  // ---------------------------------------------------------------------------
  const handleSnapshotFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingSnapshot(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = String(event.target?.result || '');
      await importAccountSnapshot(content);
      setIsImportingSnapshot(false);
      e.target.value = '';
    };
    reader.onerror = () => {
      setIsImportingSnapshot(false);
      showNotification('Failed to read snapshot file.', 'error');
    };
    reader.readAsText(file);
  };

  const handleFactoryReset = async () => {
    await resetVault();
  };

  // Contrast checks against active card surface (defaults to #000000)
  const primaryContrast = evaluateWcagContrast(
    resolvedTextColor.primaryHex,
    resolvedSurface.cardHex
  );
  const secondaryContrast = evaluateWcagContrast(
    resolvedTextColor.secondaryHex,
    resolvedSurface.cardHex
  );
  const hasLowContrastWarning = !primaryContrast.passesAA || !secondaryContrast.passesLargeAA;

  const liveCssVars = computeThemeCssVariables(
    {
      accentColor: appData?.settings?.accentColor,
      customAccentHex: appData?.settings?.customAccentHex,
      sidebarIconColor: currentSidebarIconColor,
      surfaceConfig: appData?.settings?.surfaceConfig,
      textColorConfig: appData?.settings?.textColorConfig,
    },
    layoutConfig
  );

  // 5 Clean Segmented Module Tabs for the Unified Customization Studio (No mega-scroll #all dump)
  const customizationTabs: {
    id: CustomizationTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    { id: 'appearance', label: 'Colors & Surfaces', icon: <Palette className="w-3.5 h-3.5" /> },
    { id: 'workspace', label: 'Layout & Scaling', icon: <Maximize2 className="w-3.5 h-3.5" /> },
    {
      id: 'panels',
      label: `Dashboard Panels (${panelsList.length})`,
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      count: panelsList.filter((w) => w.visible).length,
    },
    {
      id: 'navigation',
      label: 'Navigation & Categories',
      icon: <Compass className="w-3.5 h-3.5" />,
      count: (appData?.categories || []).length,
    },
    { id: 'quotes', label: 'Daily Maxim', icon: <Quote className="w-3.5 h-3.5" /> },
  ];

  const settingsTabs: {
    id: CustomizationTab;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    { id: 'general', label: 'Identity & Preferences', icon: <SettingsIcon className="w-4 h-4 text-amber-400" /> },
    { id: 'sync', label: 'Account & Database Sync', icon: <Cloud className="w-4 h-4 text-cyan-400" /> },
    { id: 'import', label: 'Data Import & Factory Reset', icon: <FileUp className="w-4 h-4 text-rose-400" /> },
    { id: 'all', label: 'All Settings', icon: <Sliders className="w-4 h-4 text-zinc-400" /> },
  ];

  const tabs = isCustomizationMode ? customizationTabs : settingsTabs;

  return (
    <div
      data-testid={isCustomizationMode ? 'unified-customization-studio-module' : 'settings-module'}
      className="space-y-4 w-full pb-12"
    >
      {/* 1. Sticky Top Control Header & Live CSS Token Strip */}
      <div className="sticky top-0 z-20 p-4 rounded-2xl bg-[#000000]/95 backdrop-blur border border-[#1E222B] shadow-[0_8px_24px_rgba(0,0,0,0.85)] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              {isCustomizationMode ? (
                <>
                  <Palette className="w-4 h-4" style={{ color: accent.hex }} />
                  <span>Customization Studio</span>
                </>
              ) : (
                <>
                  <SettingsIcon className="w-4 h-4 text-amber-400" />
                  <span>Settings &amp; Vault Security</span>
                </>
              )}
            </h2>
            <span
              data-testid="settings-version-badge"
              className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-[#000000] border border-[#1E222B]"
              style={{ color: accent.hex }}
            >
              {appName} ({appShortName}) • {APP_VERSION}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isCustomizationMode ? (
              <>
                <button
                  type="button"
                  data-testid="reset-tactical-flat-black-default-btn"
                  onClick={handleResetToTacticalFlatBlackDefault}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-[#000000] hover:bg-zinc-900 text-amber-300 border border-[#1E222B] hover:border-amber-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Tactical Flat-Black Default (#000000)</span>
                </button>
                <button
                  type="button"
                  data-testid="switch-to-settings-btn"
                  onClick={() => setActiveTab('settings')}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#000000] hover:bg-zinc-900 text-zinc-200 border border-[#1E222B] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Settings</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="switch-to-customization-btn"
                onClick={() => setActiveTab('customization')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#000000] hover:bg-zinc-900 text-purple-300 border border-purple-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Open Customization Studio</span>
              </button>
            )}
          </div>
        </div>

        {/* Single Pinned Live Telemetry & CSS Token Bar (Customization Mode) */}
        {isCustomizationMode && (
          <div
            data-testid="theme-css-variables-live-preview"
            className="px-3 py-2 rounded-xl bg-[#000000] border border-[#1E222B] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-zinc-500 uppercase font-bold">Live Tokens:</span>
              {(
                [
                  ['--bg-canvas', liveCssVars['--bg-canvas']],
                  ['--bg-card', liveCssVars['--bg-card']],
                  ['--border-subtle', liveCssVars['--border-subtle']],
                  ['--text-primary', liveCssVars['--text-primary']],
                  ['--accent-primary', liveCssVars['--accent-primary']],
                  ['--icon-color', liveCssVars['--icon-color']],
                ] as const
              ).map(([token, hexVal]) => (
                <span
                  key={token}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-zinc-300"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm border border-zinc-700 shrink-0"
                    style={{ backgroundColor: hexVal }}
                  />
                  <span className="text-zinc-500">{token}:</span>
                  <strong className="text-white">{hexVal}</strong>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span
                data-testid="primary-contrast-badge"
                className={`px-2 py-0.5 rounded border font-bold ${
                  primaryContrast.passesAA
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                }`}
              >
                Contrast: {primaryContrast.ratio}:1 ({primaryContrast.level})
              </span>
              <span
                data-testid="secondary-contrast-badge"
                className="px-2 py-0.5 rounded border bg-[#000000] text-zinc-400 border-[#1E222B]"
              >
                Muted: {secondaryContrast.ratio}:1
              </span>
            </div>
          </div>
        )}

        {/* Segmented Module Tabs */}
        <div className="p-1 rounded-xl bg-[#000000] border border-[#1E222B] flex items-center gap-1 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const isActive =
              activeCustomizationTab === tab.id ||
              (tab.id === 'navigation' && activeCustomizationTab === 'categories');
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`customization-tab-${tab.id}`}
                onClick={() => {
                  setActiveCustomizationTab(tab.id);
                  window.location.hash = tab.id;
                }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#000000] text-white border shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
                }`}
                style={isActive ? { color: accent.hex, borderColor: accent.hex } : undefined}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#000000] text-zinc-400 border border-[#1E222B]">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>


      {/* =================================================================== */}
      {/* CUSTOMIZATION TAB 1: UNIFIED COLORS, THEMES & SURFACES              */}
      {/* =================================================================== */}
      {isCustomizationMode && activeCustomizationTab === 'appearance' && (
        <div data-testid="unified-color-surface-engine" className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-5">
          {/* 1. Primary Accent & 2. Sidebar/UI Icon Color Side-by-Side Header & Custom Pickers */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-4 border-b border-[#1E222B]">
            {/* Primary Accent & Theme Palette (--accent-primary) */}
            <div className="lg:col-span-8 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Palette className="w-3.5 h-3.5" style={{ color: accent.hex }} />
                    <span>1. Primary Accent &amp; Theme Palette (`--accent-primary`)</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    20 curated dark-surface presets + custom Hex picker (`#000000` flat-black calibrated).
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-label="Custom Primary Accent Color Picker"
                    data-testid="custom-accent-color-picker"
                    value={/^#[0-9A-Fa-f]{6}$/.test(customAccentHexInput) ? customAccentHexInput : accent.hex}
                    onChange={(e) => handleApplyCustomAccentHex(e.target.value)}
                    className="w-8 h-7 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    maxLength={7}
                    aria-label="Custom Primary Accent Hex Input"
                    data-testid="custom-accent-hex-input"
                    value={customAccentHexInput}
                    onChange={(e) => handleApplyCustomAccentHex(e.target.value)}
                    placeholder="#E5A93C"
                    className="w-24 px-2 py-1 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Compact 20-Preset Accent Swatch Grid */}
              <div
                data-testid="curated-20-theme-grid"
                className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5"
              >
                {CURATED_20_ACCENTS.map((themeItem, idx) => {
                  const isSelected =
                    (!appData?.settings?.customAccentHex && appData?.settings?.accentColor === themeItem.id) ||
                    accent.hex.toUpperCase() === themeItem.hex.toUpperCase();
                  return (
                    <button
                      key={themeItem.id}
                      type="button"
                      data-testid={`accent-preset-${themeItem.id}`}
                      onClick={() => handleSelectAccent(themeItem.id)}
                      className={`px-2 py-1.5 rounded-lg border flex items-center gap-2 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#000000] border-white ring-1 ring-white/25'
                          : 'bg-[#000000] border-[#1E222B] hover:border-zinc-500'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded flex items-center justify-center shrink-0 border border-black/40"
                        style={{ backgroundColor: themeItem.hex }}
                      >
                        {isSelected && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-zinc-100 truncate">
                          {idx + 1}. {themeItem.name}
                        </div>
                        <div className="text-[9px] font-mono text-zinc-500 uppercase">
                          {themeItem.hex}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Sidebar & UI Icon Color (--icon-color) */}
            <div className="lg:col-span-4 p-3 rounded-xl bg-[#000000] border border-[#1E222B] flex flex-col justify-between space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: layoutConfig.sidebarIconColor || accent.hex }} />
                    <span>2. Sidebar &amp; UI Icon Tint</span>
                  </h4>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {layoutConfig.sidebarIconColor || accent.hex}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Controls `--icon-color` across navigation &amp; category icons.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  data-testid="icon-color-match-accent-btn"
                  onClick={() => handleSetSidebarIconColor(accent.hex)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] hover:border-zinc-500 text-[11px] font-mono font-bold text-zinc-200 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent.hex }} />
                  Match Active Accent ({accent.hex})
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                  {ICON_COLOR_SWATCHES.map((swatch) => {
                    const activeIconColor = (layoutConfig.sidebarIconColor || accent.hex).toUpperCase();
                    const isSelected = activeIconColor === swatch.hex.toUpperCase();
                    return (
                      <button
                        key={swatch.hex}
                        type="button"
                        data-testid={`sidebar-icon-swatch-${swatch.hex.replace('#', '')}`}
                        onClick={() => handleSetSidebarIconColor(swatch.hex)}
                        title={swatch.label}
                        className={`w-6 h-6 rounded-md border transition-transform cursor-pointer flex items-center justify-center ${
                          isSelected ? 'scale-110 border-white ring-1 ring-white/40' : 'border-zinc-700 opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: swatch.hex }}
                      >
                        {isSelected && <Check className="w-3 h-3 text-black stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="color"
                    aria-label="Sidebar Icon Color Picker"
                    data-testid="sidebar-icon-color-picker"
                    value={/^#[0-9A-Fa-f]{6}$/.test(customIconHexInput) ? customIconHexInput : (layoutConfig.sidebarIconColor || accent.hex)}
                    onChange={(e) => handleSetSidebarIconColor(e.target.value)}
                    className="w-8 h-7 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    maxLength={7}
                    aria-label="Sidebar Icon Custom Hex"
                    data-testid="sidebar-icon-hex-input"
                    value={customIconHexInput}
                    onChange={(e) => handleSetSidebarIconColor(e.target.value)}
                    placeholder="#E5A93C"
                    className="flex-1 px-2 py-1 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Surface Layer Architecture (#000000 Default) & 4. Structural Border (--border-subtle) */}
          <div
            data-testid="surface-layer-override-section"
            className="space-y-3 pb-4 border-b border-[#1E222B]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5" style={{ color: accent.hex }} />
                  <span>3. Surface Layer Architecture (`#000000` Default) &amp; 4. Structural Border (`--border-subtle`)</span>
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {SURFACE_PRESETS.map((preset) => {
                  const isSelected = resolvedSurface.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`surface-preset-${preset.id}`}
                      onClick={() => handleSelectSurfacePreset(preset.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#000000] border-white text-white'
                          : 'bg-[#000000] border-[#1E222B] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full border border-zinc-600" style={{ backgroundColor: preset.cardHex }} />
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4-Column Side-by-Side Pickers: Canvas, Column, Card, and Structural Border */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-xl bg-[#000000] border border-[#1E222B]">
              <div>
                <label htmlFor="custom-canvas-hex" className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Canvas Root (`--bg-canvas`)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-label="Canvas Background Color Picker"
                    value={/^#[0-9A-Fa-f]{6}$/.test(customCanvasHex) ? customCanvasHex : '#000000'}
                    onChange={(e) => handleApplyCustomSurfaceHex(e.target.value, customColumnHex, customCardHex, customBorderHex)}
                    className="w-8 h-8 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5"
                  />
                  <input
                    id="custom-canvas-hex"
                    data-testid="input-canvas-surface-hex"
                    type="text"
                    maxLength={7}
                    value={customCanvasHex}
                    onChange={(e) => handleApplyCustomSurfaceHex(e.target.value, customColumnHex, customCardHex, customBorderHex)}
                    placeholder="#000000"
                    className="flex-1 px-2.5 py-1.5 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="custom-column-hex" className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Column &amp; Panel (`--bg-column`)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-label="Column Background Color Picker"
                    value={/^#[0-9A-Fa-f]{6}$/.test(customColumnHex) ? customColumnHex : '#000000'}
                    onChange={(e) => handleApplyCustomSurfaceHex(customCanvasHex, e.target.value, customCardHex, customBorderHex)}
                    className="w-8 h-8 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5"
                  />
                  <input
                    id="custom-column-hex"
                    data-testid="input-column-surface-hex"
                    type="text"
                    maxLength={7}
                    value={customColumnHex}
                    onChange={(e) => handleApplyCustomSurfaceHex(customCanvasHex, e.target.value, customCardHex, customBorderHex)}
                    placeholder="#000000"
                    className="flex-1 px-2.5 py-1.5 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="custom-card-hex" className="block text-[11px] font-mono text-zinc-400 mb-1">
                  Card &amp; Modal (`--bg-card`)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-label="Card Surface Color Picker"
                    value={/^#[0-9A-Fa-f]{6}$/.test(customCardHex) ? customCardHex : '#000000'}
                    onChange={(e) => handleApplyCustomSurfaceHex(customCanvasHex, customColumnHex, e.target.value, customBorderHex)}
                    className="w-8 h-8 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5"
                  />
                  <input
                    id="custom-card-hex"
                    data-testid="input-card-surface-hex"
                    type="text"
                    maxLength={7}
                    value={customCardHex}
                    onChange={(e) => handleApplyCustomSurfaceHex(customCanvasHex, customColumnHex, e.target.value, customBorderHex)}
                    placeholder="#000000"
                    className="flex-1 px-2.5 py-1.5 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="custom-border-hex" className="block text-[11px] font-mono text-zinc-400">
                    Border (`--border-subtle`)
                  </label>
                  <div className="flex items-center gap-1">
                    {BORDER_PRESETS.map((bp) => (
                      <button
                        key={bp.id}
                        type="button"
                        title={bp.label}
                        data-testid={`border-preset-${bp.id}`}
                        onClick={() => handleApplyCustomBorderHex(bp.hex)}
                        className="w-3.5 h-3.5 rounded-full border border-zinc-600 cursor-pointer"
                        style={{ backgroundColor: bp.hex }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-label="Structural Border Color Picker"
                    data-testid="border-subtle-color-picker"
                    value={/^#[0-9A-Fa-f]{6}$/.test(customBorderHex) ? customBorderHex : '#1E222B'}
                    onChange={(e) => handleApplyCustomBorderHex(e.target.value)}
                    className="w-8 h-8 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5"
                  />
                  <input
                    id="custom-border-hex"
                    data-testid="input-border-subtle-hex"
                    type="text"
                    maxLength={7}
                    value={customBorderHex}
                    onChange={(e) => handleApplyCustomBorderHex(e.target.value)}
                    placeholder="#1E222B"
                    className="flex-1 px-2.5 py-1.5 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 5. Typography Colors (--text-primary & --text-muted) + Inline WCAG Contrast */}
          <div data-testid="text-color-override-section" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Type className="w-3.5 h-3.5" style={{ color: accent.hex }} />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  5. Typography Colors (`--text-primary` &amp; `--text-muted`)
                </h4>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {TEXT_COLOR_PRESETS.map((preset) => {
                  const isSelected = resolvedTextColor.preset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      data-testid={`text-preset-${preset.id}`}
                      onClick={() => handleSelectTextPreset(preset.id)}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? 'bg-[#000000] border-white text-white'
                          : 'bg-[#000000] border-[#1E222B] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-zinc-700"
                        style={{ backgroundColor: preset.id === 'accent_tint' ? accent.hex : preset.primaryHex }}
                      />
                      {preset.label}
                    </button>
                  );
                })}
                <span
                  data-testid="primary-contrast-badge"
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${
                    primaryContrast.passesAA
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  }`}
                >
                  Primary {primaryContrast.ratio}:1 ({primaryContrast.level})
                </span>
                <span
                  data-testid="secondary-contrast-badge"
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold ${
                    secondaryContrast.passesLargeAA
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  }`}
                >
                  Muted {secondaryContrast.ratio}:1 ({secondaryContrast.level})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-[#000000] border border-[#1E222B]">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor="custom-primary-text-hex" className="text-[11px] font-mono text-zinc-300">
                  Primary (`--text-primary`)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-label="Primary Text Color Picker"
                    value={/^#[0-9A-Fa-f]{6}$/.test(customPrimaryHex) ? customPrimaryHex : '#F8FAFC'}
                    onChange={(e) => handleApplyCustomTextHex(e.target.value, customSecondaryHex)}
                    className="w-8 h-7 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5"
                  />
                  <input
                    id="custom-primary-text-hex"
                    data-testid="input-primary-text-hex"
                    type="text"
                    maxLength={7}
                    value={customPrimaryHex}
                    onChange={(e) => handleApplyCustomTextHex(e.target.value, customSecondaryHex)}
                    placeholder="#F8FAFC"
                    className="w-28 px-2.5 py-1 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label htmlFor="custom-secondary-text-hex" className="text-[11px] font-mono text-zinc-300">
                  Muted (`--text-muted`)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-label="Secondary Text Color Picker"
                    value={/^#[0-9A-Fa-f]{6}$/.test(customSecondaryHex) ? customSecondaryHex : '#94A3B8'}
                    onChange={(e) => handleApplyCustomTextHex(customPrimaryHex, e.target.value)}
                    className="w-8 h-7 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5"
                  />
                  <input
                    id="custom-secondary-text-hex"
                    data-testid="input-secondary-text-hex"
                    type="text"
                    maxLength={7}
                    value={customSecondaryHex}
                    onChange={(e) => handleApplyCustomTextHex(customPrimaryHex, e.target.value)}
                    placeholder="#94A3B8"
                    className="w-28 px-2.5 py-1 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {hasLowContrastWarning && (
              <div
                data-testid="text-contrast-warning"
                className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-2 text-xs text-amber-200"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    Low contrast ({primaryContrast.ratio}:1 / {secondaryContrast.ratio}:1) vs `{resolvedSurface.cardHex}`.
                  </span>
                </div>
                <button
                  type="button"
                  data-testid="restore-accessible-contrast-btn"
                  onClick={() => handleSelectTextPreset('crisp_white')}
                  className="px-2.5 py-1 rounded bg-amber-500 text-black font-bold text-[11px] shrink-0 hover:bg-amber-400 cursor-pointer"
                >
                  Restore Crisp White
                </button>
              </div>
            )}
          </div>
        </div>
      )}


      {/* =================================================================== */}
      {/* CUSTOMIZATION TAB 2: UNIFIED LAYOUT, GRID & SCALING                 */}
      {/* =================================================================== */}
      {isCustomizationMode && activeCustomizationTab === 'workspace' && (
        <div data-testid="unified-layout-scaling-engine" className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1E222B]">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Layout, Grid &amp; Continuous Dimensional Scaling</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Single source of truth for Sidebar Docking, Grid Columns, Page Max Width (`px`), Card Density &amp; Grid Gap (`px`), and Font Scale (`85%`–`130%`).
              </p>
            </div>
            <span className="text-[11px] font-mono text-cyan-400">
              {currentSidebarPosition === 'bottom' ? 'Bottom Bar' : 'Left Sidebar'} • {layoutConfig.gridColumns} Cols • {Math.round((layoutConfig.fontScale || 1) * 100)}% Font
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 1. Navigation Docking & Grid Columns */}
            <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Navigation Bar Docking</span>
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase">
                    {currentSidebarPosition}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-lg bg-[#000000] border border-[#1E222B]">
                  {(['left', 'bottom'] as SidebarPositionMode[]).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      data-testid={`preview-sidebar-position-${pos}`}
                      onClick={() => handleSetSidebarPosition(pos)}
                      className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                        currentSidebarPosition === pos
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {pos === 'left' ? 'Left Sidebar' : 'Bottom Bar'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[#1E222B]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <LayoutGrid className="w-3.5 h-3.5 text-purple-400" />
                    <span>Dashboard Grid Columns</span>
                  </span>
                  <span className="text-[10px] font-mono text-purple-400">
                    {layoutConfig.gridColumns} Columns
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#000000] border border-[#1E222B]">
                  {([2, 3, 4] as const).map((cols) => (
                    <button
                      key={cols}
                      type="button"
                      data-testid={`preview-grid-cols-${cols}`}
                      onClick={() => updateLayoutConfig((prev) => ({ ...prev, gridColumns: cols }))}
                      className={`py-1.5 px-2 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                        layoutConfig.gridColumns === cols
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {cols} Col
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 2. Page Width Presets + Custom Max Width (px) */}
            <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Page Width &amp; Custom Max (`px`)</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  {layoutConfig.customPageMaxWidthPx
                    ? `${layoutConfig.customPageMaxWidthPx}px`
                    : layoutConfig.pageWidth}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-[#000000] border border-[#1E222B]">
                {(
                  [
                    { id: 'standard', label: '1680px' },
                    { id: 'ultrawide', label: '2400px' },
                    { id: 'full', label: '100%' },
                  ] as { id: PageWidthMode; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      updateLayoutConfig((prev) => ({
                        ...prev,
                        pageWidth: opt.id,
                        customPageMaxWidthPx: undefined,
                      }))
                    }
                    className={`py-1.5 px-1 rounded text-[11px] font-mono font-bold transition-colors cursor-pointer ${
                      !layoutConfig.customPageMaxWidthPx && layoutConfig.pageWidth === opt.id
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt.id.toUpperCase()} ({opt.label})
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-[#1E222B] space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>Custom Max Width (1200–2800px)</span>
                  <input
                    type="number"
                    min={1200}
                    max={2800}
                    step={20}
                    data-testid="custom-page-max-width-input"
                    value={
                      layoutConfig.customPageMaxWidthPx ||
                      (layoutConfig.pageWidth === 'ultrawide' ? 2400 : 1680)
                    }
                    onChange={(e) => {
                      const val = Math.min(2800, Math.max(1200, Number(e.target.value) || 1680));
                      updateLayoutConfig((prev) => ({ ...prev, customPageMaxWidthPx: val }));
                    }}
                    className="w-20 px-2 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-xs text-white font-mono text-right"
                  />
                </div>
                <input
                  type="range"
                  min={1200}
                  max={2800}
                  step={20}
                  aria-label="Custom Page Max Width Slider"
                  value={
                    layoutConfig.customPageMaxWidthPx ||
                    (layoutConfig.pageWidth === 'ultrawide' ? 2400 : 1680)
                  }
                  onChange={(e) =>
                    updateLayoutConfig((prev) => ({
                      ...prev,
                      customPageMaxWidthPx: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>

            {/* 3. Card Density + Custom Grid Gap (px) & Continuous Font Scale (%) */}
            <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span>Density &amp; Grid Gap (`px`)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={8}
                      max={32}
                      step={2}
                      data-testid="custom-grid-gap-input"
                      value={
                        layoutConfig.customGridGapPx ??
                        (layoutConfig.density === 'compact'
                          ? 12
                          : layoutConfig.density === 'spacious'
                          ? 24
                          : 16)
                      }
                      onChange={(e) => {
                        const val = Math.min(32, Math.max(8, Number(e.target.value) || 16));
                        updateLayoutConfig((prev) => ({ ...prev, customGridGapPx: val }));
                      }}
                      className="w-14 px-1.5 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-[11px] text-amber-300 font-mono text-right"
                    />
                    <span className="text-[10px] font-mono text-zinc-400">px</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-[#000000] border border-[#1E222B]">
                  {(
                    [
                      { id: 'compact', label: 'Compact (12px)' },
                      { id: 'comfortable', label: 'Comfort (16px)' },
                      { id: 'spacious', label: 'Spacious (24px)' },
                    ] as { id: GridDensityMode; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      data-testid={`preview-density-${opt.id}`}
                      onClick={() =>
                        updateLayoutConfig((prev) => ({
                          ...prev,
                          density: opt.id,
                          customGridGapPx: undefined,
                        }))
                      }
                      className={`py-1 px-1 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                        !layoutConfig.customGridGapPx && layoutConfig.density === opt.id
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-[#1E222B] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Font Scale (85%–130%)</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={85}
                      max={130}
                      step={1}
                      data-testid="custom-font-scale-input"
                      value={Math.round((layoutConfig.fontScale || 1) * 100)}
                      onChange={(e) => {
                        const pct = Math.min(130, Math.max(85, Number(e.target.value) || 100));
                        updateLayoutConfig((prev) => ({
                          ...prev,
                          fontScale: Number((pct / 100).toFixed(2)),
                        }));
                      }}
                      className="w-16 px-1.5 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-[11px] text-emerald-300 font-mono text-right"
                    />
                    <span className="text-[10px] font-mono text-zinc-400">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={85}
                  max={130}
                  step={1}
                  aria-label="Continuous Font Scale Slider"
                  value={Math.round((layoutConfig.fontScale || 1) * 100)}
                  onChange={(e) => {
                    const pct = Number(e.target.value) || 100;
                    updateLayoutConfig((prev) => ({
                      ...prev,
                      fontScale: Number((pct / 100).toFixed(2)),
                    }));
                  }}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <div className="grid grid-cols-4 gap-1">
                  {[95, 100, 110, 120].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() =>
                        updateLayoutConfig((prev) => ({ ...prev, fontScale: pct / 100 }))
                      }
                      className={`py-0.5 rounded text-[10px] font-mono border cursor-pointer ${
                        Math.round((layoutConfig.fontScale || 1) * 100) === pct
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                          : 'bg-[#000000] border-[#1E222B] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* CUSTOMIZATION TAB 3: UNIFIED 2D DASHBOARD PANEL MATRIX              */}
      {/* =================================================================== */}
      {isCustomizationMode && activeCustomizationTab === 'panels' && (
        <div
          data-testid="interactive-dashboard-preview"
          className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-4"
        >
          {/* Compact Top Bar: Panel Counts + Collapsible "+ Add Custom Panel" + Reset Panels */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1E222B]">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <LayoutGrid className="w-3.5 h-3.5 text-purple-400" />
                <span>2D Dashboard Panel Matrix ({panelsList.length} Total)</span>
              </h3>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold">
                {panelsList.filter((p) => p.visible).length} Active
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-800/60 border border-[#1E222B] text-[10px] font-mono text-zinc-400">
                {panelsList.filter((p) => !p.visible).length} Hidden
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="toggle-custom-panel-drawer-btn"
                onClick={() => setIsCustomPanelDrawerOpen((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isCustomPanelDrawerOpen ? 'Close Custom Panel Builder' : '+ Add Custom Panel'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetPanelsLayout}
                className="px-2.5 py-1 rounded-lg bg-[#000000] hover:border-zinc-500 border border-[#1E222B] text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Panels</span>
              </button>
            </div>
          </div>

          {/* Collapsible / Inline + Add Custom Panel Form */}
          {isCustomPanelDrawerOpen && (
            <form
              onSubmit={handleCreateCustomPanel}
              data-testid="custom-panel-drawer-form"
              className="p-3.5 rounded-xl bg-[#000000] border border-purple-500/40 space-y-3"
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Panel Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newPanelTitle}
                    onChange={(e) => setNewPanelTitle(e.target.value)}
                    placeholder="e.g. Daily Sprints"
                    className="w-full px-2.5 py-1.5 bg-[#000000] border border-[#1E222B] rounded-lg text-xs text-white focus:outline-none focus:border-purple-400"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Template Type
                  </label>
                  <select
                    value={newPanelType}
                    onChange={(e) => setNewPanelType(e.target.value as CustomPanelType)}
                    className="w-full px-2.5 py-1.5 bg-[#000000] border border-[#1E222B] rounded-lg text-xs text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="checklist">Checklist (Action Queue)</option>
                    <option value="notes">Notes Scratchpad</option>
                    <option value="counter">Numeric Counter</option>
                    <option value="habits">Daily Habit Streak</option>
                    <option value="key_value">Key-Value List</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono uppercase text-zinc-400 mb-1">
                    Column Span
                  </label>
                  <select
                    value={newPanelSpan}
                    onChange={(e) =>
                      setNewPanelSpan(
                        e.target.value === 'full' ? 'full' : (Number(e.target.value) as 1 | 2 | 3)
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-[#000000] border border-[#1E222B] rounded-lg text-xs text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value={1}>1x Column</option>
                    <option value={2}>2x Columns</option>
                    <option value={3}>3x Columns</option>
                    <option value="full">Full Width Row</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-500 hover:bg-purple-400 text-black flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Mount Panel</span>
                </button>
              </div>

              {newPanelType === 'counter' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-[#1E222B]">
                  <input
                    type="number"
                    value={newCounterTarget}
                    onChange={(e) => setNewCounterTarget(e.target.value)}
                    placeholder="Target (10)"
                    className="px-2.5 py-1 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono"
                  />
                  <input
                    type="text"
                    value={newCounterUnit}
                    onChange={(e) => setNewCounterUnit(e.target.value)}
                    placeholder="Unit (sets, glasses)"
                    className="px-2.5 py-1 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono"
                  />
                  <input
                    type="number"
                    value={newCounterStep}
                    onChange={(e) => setNewCounterStep(e.target.value)}
                    placeholder="Step (1)"
                    className="px-2.5 py-1 bg-[#000000] border border-[#1E222B] rounded text-xs text-white font-mono"
                  />
                </div>
              )}
            </form>
          )}

          {/* Single Interactive 2D Panel Matrix Grid */}
          <div
            className={`grid grid-cols-1 gap-2.5 ${
              layoutConfig.gridColumns === 2
                ? 'md:grid-cols-2'
                : layoutConfig.gridColumns === 4
                ? 'md:grid-cols-4'
                : 'md:grid-cols-3'
            }`}
          >
            {panelsList.map((panel, idx) => {
              const title = panel.customTitle || DEFAULT_WIDGET_TITLES[panel.id] || panel.id;
              const colSpanVal = normalizeColSpan(panel.colSpan);
              const spanClass =
                colSpanVal === 'full'
                  ? 'md:col-span-full'
                  : colSpanVal === 3
                  ? layoutConfig.gridColumns >= 3
                    ? 'md:col-span-3'
                    : 'md:col-span-full'
                  : colSpanVal === 2
                  ? 'md:col-span-2'
                  : 'md:col-span-1';

              return (
                <div
                  key={panel.id}
                  data-testid={`panel-row-${panel.id}`}
                  className={`${spanClass} p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                    panel.visible
                      ? 'bg-[#000000] border-[#1E222B] hover:border-zinc-500'
                      : 'bg-[#000000] border-[#1E222B] opacity-55'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-mono font-bold shrink-0 border"
                        style={{
                          backgroundColor: panel.visible ? `${accent.hex}20` : '#000000',
                          color: panel.visible ? accent.hex : '#71717A',
                          borderColor: panel.visible ? `${accent.hex}40` : '#1E222B',
                        }}
                      >
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        aria-label={`Rename ${title} panel`}
                        data-testid={`rename-panel-input-${panel.id}`}
                        value={title}
                        onChange={(e) => {
                          const updated = updateMatrixCardTitle(panelsList, panel.id, e.target.value);
                          updateLayoutConfig((prev) => ({ ...prev, widgets: updated }));
                        }}
                        onBlur={(e) => {
                          const fallbackTitle = DEFAULT_WIDGET_TITLES[panel.id] || 'Custom Panel';
                          const clean = sanitizeColumnTitle(e.target.value, fallbackTitle);
                          const updated = updateMatrixCardTitle(panelsList, panel.id, clean);
                          updateLayoutConfig((prev) => ({ ...prev, widgets: updated }));
                        }}
                        className="px-2 py-0.5 rounded bg-[#000000] border border-[#1E222B] focus:border-amber-400 focus:outline-none text-xs font-bold text-white min-w-0 flex-1"
                      />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        data-testid={`preview-toggle-panel-${panel.id}`}
                        onClick={() => handleTogglePanelVisibility(panel.id)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors cursor-pointer ${
                          panel.visible
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-zinc-900 text-zinc-400 border-[#1E222B]'
                        }`}
                      >
                        {panel.visible ? 'Active' : 'Hidden'}
                      </button>
                      {panel.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomPanel(panel.id)}
                          title="Delete custom panel"
                          className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-[#1E222B]">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMovePanel(idx, 'up')}
                        title="Move panel earlier"
                        className="px-1.5 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-[10px] font-mono text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ◄
                      </button>
                      <button
                        type="button"
                        disabled={idx === panelsList.length - 1}
                        onClick={() => handleMovePanel(idx, 'down')}
                        title="Move panel later"
                        className="px-1.5 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-[10px] font-mono text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                      >
                        ►
                      </button>
                      <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[110px]">
                        {panel.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5">
                      {([1, 2, 3, 'full'] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => handleUpdatePanelSpan(panel.id, s)}
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold transition-colors cursor-pointer ${
                            colSpanVal === s
                              ? 'bg-purple-500/25 text-purple-300 border border-purple-500/40'
                              : 'text-zinc-500 hover:text-zinc-200'
                          }`}
                        >
                          {s === 'full' ? 'FULL' : `${s}x`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* =================================================================== */}
      {/* CUSTOMIZATION TAB 4: TWO-COLUMN NAVIGATION & CATEGORIES WORKBENCH   */}
      {/* =================================================================== */}
      {isCustomizationMode &&
        (activeCustomizationTab === 'navigation' || activeCustomizationTab === 'categories') && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
            {/* LEFT COLUMN: Sidebar Categories & Subsections */}
            <div
              data-testid="sidebar-customization-section"
              className="xl:col-span-7 p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1E222B]">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Compass className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Sidebar Categories &amp; Subsections</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Rename categories or subsections, reorder groups, or move subsections across categories.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="reset-sidebar-labels-btn"
                  onClick={handleResetAllSidebarCustomizations}
                  className="px-2.5 py-1 rounded-lg bg-[#000000] hover:border-zinc-500 border border-[#1E222B] text-xs font-mono text-zinc-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Reset Sidebar</span>
                </button>
              </div>

              {isMasterAdmin && (
                <div
                  data-testid="studio-admin-custom-category-creator"
                  className="p-3 rounded-xl bg-[#000000] border border-amber-500/30 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Master Admin: Create Custom Navigation Category</span>
                    </span>
                  </div>
                  <form
                    onSubmit={handleStudioCreateCustomCategory}
                    data-testid="studio-create-custom-category-form"
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
                  >
                    <div className="sm:col-span-5">
                      <input
                        type="text"
                        maxLength={48}
                        data-testid="studio-new-category-name-input"
                        value={studioNewCatName}
                        onChange={(e) => setStudioNewCatName(e.target.value)}
                        placeholder="Category title..."
                        className="w-full px-2.5 py-1 rounded bg-[#000000] border border-[#1E222B] text-xs text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <select
                        data-testid="studio-new-category-group-select"
                        value={studioNewCatGroup}
                        onChange={(e) => setStudioNewCatGroup(e.target.value)}
                        className="w-full px-2 py-1 rounded bg-[#000000] border border-[#1E222B] text-xs font-mono text-white"
                      >
                        {currentSidebarGroupOrder.map((gOpt) => (
                          <option key={gOpt} value={gOpt}>
                            {currentSidebarGroupLabels[gOpt] ||
                              DEFAULT_SIDEBAR_GROUP_LABELS[gOpt] ||
                              gOpt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <select
                        data-testid="studio-new-category-visibility-select"
                        value={studioNewCatVisibility}
                        onChange={(e) =>
                          setStudioNewCatVisibility(e.target.value as CustomCategoryVisibility)
                        }
                        className="w-full px-2 py-1 rounded bg-[#000000] border border-[#1E222B] text-xs font-mono text-amber-300"
                      >
                        <option value="admin_only">Admin</option>
                        <option value="all_users">All</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="submit"
                        data-testid="studio-create-custom-category-btn"
                        className="w-full px-2.5 py-1 rounded text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Command Center Pinned Top Items */}
              <div
                data-testid="customize-sidebar-group-card-command_center"
                className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] space-y-2"
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 uppercase">
                  <span>Pinned Command Center Subsections</span>
                  <span>Home &amp; Overview</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['nav-shortcuts', 'nav-dashboard'] as const).map((cmdItemId) => {
                    const defaultLabel = DEFAULT_SIDEBAR_ITEM_LABELS[cmdItemId] || cmdItemId;
                    const activeLabel =
                      draftItemLabels[cmdItemId] ??
                      currentSidebarItemLabels[cmdItemId] ??
                      defaultLabel;
                    return (
                      <div
                        key={cmdItemId}
                        data-testid={`customize-sidebar-item-row-${cmdItemId}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          id={`rename-sidebar-item-${cmdItemId}`}
                          type="text"
                          maxLength={48}
                          data-testid={`rename-sidebar-item-${cmdItemId}`}
                          value={activeLabel}
                          onChange={(e) => handleRenameSidebarItem(cmdItemId, e.target.value)}
                          onBlur={(e) => handleRenameSidebarItem(cmdItemId, e.target.value, true)}
                          className="w-full px-2.5 py-1 rounded bg-[#000000] border border-[#1E222B] text-xs font-medium text-zinc-100 focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar Groups List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentSidebarGroupOrder.map((groupId, groupIdx) => {
                  const defaultGroupLabel = DEFAULT_SIDEBAR_GROUP_LABELS[groupId] || groupId;
                  const activeGroupLabel =
                    draftGroupLabels[groupId] ??
                    currentSidebarGroupLabels[groupId] ??
                    defaultGroupLabel;
                  const isGroupModified =
                    (currentSidebarGroupLabels[groupId] || defaultGroupLabel) !== defaultGroupLabel;
                  const itemsInGroup = (currentSidebarGroupItems[groupId] || []).filter(
                    (itemId) =>
                      isMasterAdmin ||
                      !isAdminOnlySidebarItem(itemId, appData?.customNavCategories)
                  );
                  const isFirstGroup = groupIdx === 0;
                  const isLastGroup = groupIdx === currentSidebarGroupOrder.length - 1;

                  return (
                    <div
                      key={groupId}
                      data-testid={`customize-sidebar-group-card-${groupId}`}
                      className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-[#1E222B]">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <span className="w-5 h-5 rounded bg-[#000000] border border-[#1E222B] flex items-center justify-center font-mono text-[10px] font-bold text-cyan-400 shrink-0">
                            {groupIdx + 1}
                          </span>
                          <input
                            id={`rename-sidebar-group-${groupId}`}
                            type="text"
                            maxLength={48}
                            data-testid={`rename-sidebar-group-input-${groupId}`}
                            value={activeGroupLabel}
                            onChange={(e) =>
                              handleRenameSidebarGroup(groupId, e.target.value, false)
                            }
                            onBlur={(e) =>
                              handleRenameSidebarGroup(groupId, e.target.value, true)
                            }
                            placeholder={defaultGroupLabel}
                            className="w-full px-2 py-1 rounded bg-[#000000] border border-[#1E222B] focus:border-cyan-400 focus:outline-none text-xs font-bold text-white"
                          />
                          {isGroupModified && (
                            <button
                              type="button"
                              data-testid={`reset-sidebar-group-label-btn-${groupId}`}
                              onClick={() =>
                                handleRenameSidebarGroup(groupId, defaultGroupLabel, true)
                              }
                              className="px-1.5 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-[9px] font-mono text-zinc-400 hover:text-white shrink-0"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isFirstGroup}
                            data-testid={`studio-move-group-up-${groupId}`}
                            onClick={() => handleMoveSidebarGroupFromStudio(groupId, 'up')}
                            className="p-1 rounded bg-[#000000] border border-[#1E222B] text-zinc-300 hover:text-white disabled:opacity-30"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={isLastGroup}
                            data-testid={`studio-move-group-down-${groupId}`}
                            onClick={() => handleMoveSidebarGroupFromStudio(groupId, 'down')}
                            className="p-1 rounded bg-[#000000] border border-[#1E222B] text-zinc-300 hover:text-white disabled:opacity-30"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {itemsInGroup.map((itemId, itemIdx) => {
                          const defaultItemLabel = DEFAULT_SIDEBAR_ITEM_LABELS[itemId] || itemId;
                          const activeItemLabel =
                            draftItemLabels[itemId] ??
                            currentSidebarItemLabels[itemId] ??
                            defaultItemLabel;
                          const isItemModified =
                            (currentSidebarItemLabels[itemId] || defaultItemLabel) !==
                            defaultItemLabel;
                          const isVeryFirstItem = isFirstGroup && itemIdx === 0;
                          const isVeryLastItem =
                            isLastGroup && itemIdx === itemsInGroup.length - 1;

                          return (
                            <div
                              key={itemId}
                              data-testid={`customize-sidebar-item-row-${itemId}`}
                              className="p-2 rounded-lg bg-[#000000] border border-[#1E222B] space-y-1.5"
                            >
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  maxLength={48}
                                  aria-label={`Rename ${defaultItemLabel} subsection`}
                                  data-testid={`rename-sidebar-item-input-${itemId}`}
                                  value={activeItemLabel}
                                  onChange={(e) =>
                                    handleRenameSidebarItem(itemId, e.target.value, false)
                                  }
                                  onBlur={(e) =>
                                    handleRenameSidebarItem(itemId, e.target.value, true)
                                  }
                                  placeholder={defaultItemLabel}
                                  className="w-full px-2 py-0.5 rounded bg-[#000000] border border-[#1E222B] focus:border-cyan-400 focus:outline-none text-xs font-semibold text-zinc-100"
                                />
                                {isItemModified && (
                                  <button
                                    type="button"
                                    data-testid={`reset-sidebar-item-label-btn-${itemId}`}
                                    onClick={() =>
                                      handleRenameSidebarItem(itemId, defaultItemLabel, true)
                                    }
                                    className="px-1.5 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-[9px] font-mono text-zinc-400 hover:text-white shrink-0"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>

                              <div className="flex items-center justify-between gap-1">
                                <select
                                  aria-label={`Assign category for ${defaultItemLabel}`}
                                  data-testid={`move-sidebar-item-group-select-${itemId}`}
                                  value={groupId}
                                  onChange={(e) =>
                                    handleReassignSidebarItemToGroup(itemId, e.target.value)
                                  }
                                  className="px-1.5 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-[10px] font-mono text-zinc-300"
                                >
                                  {currentSidebarGroupOrder.map((gOpt) => (
                                    <option key={gOpt} value={gOpt}>
                                      {currentSidebarGroupLabels[gOpt] ||
                                        DEFAULT_SIDEBAR_GROUP_LABELS[gOpt] ||
                                        gOpt}
                                    </option>
                                  ))}
                                </select>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={isVeryFirstItem}
                                    data-testid={`studio-move-item-up-${itemId}`}
                                    onClick={() => handleStepSidebarItemFromStudio(itemId, 'up')}
                                    className="p-0.5 rounded bg-[#000000] border border-[#1E222B] text-zinc-400 hover:text-white disabled:opacity-30"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isVeryLastItem}
                                    data-testid={`studio-move-item-down-${itemId}`}
                                    onClick={() => handleStepSidebarItemFromStudio(itemId, 'down')}
                                    className="p-0.5 rounded bg-[#000000] border border-[#1E222B] text-zinc-400 hover:text-white disabled:opacity-30"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT COLUMN: Domain Category & Tag Management (Full CRUD + Color Picker) */}
            <div
              data-testid="category-management-section"
              className="xl:col-span-5 p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-4"
            >
              <div className="space-y-2 pb-3 border-b border-[#1E222B]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-amber-400" />
                  <span>Domain Category &amp; Tag Management</span>
                </h3>
                <p className="text-[11px] text-zinc-400">
                  Cascading inline rename, custom color picker, and category creation/deletion across all 6 domains.
                </p>
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {(
                    [
                      { id: 'timeline', label: 'Timeline' },
                      { id: 'funds', label: 'Funds' },
                      { id: 'goals', label: 'Goals' },
                      { id: 'notes', label: 'Notes' },
                      { id: 'gallery', label: 'Gallery' },
                      { id: 'quotes', label: 'Maxim Tags' },
                    ] as { id: CategoryDomain; label: string }[]
                  ).map((dom) => (
                    <button
                      key={dom.id}
                      type="button"
                      data-testid={`cat-domain-tab-${dom.id}`}
                      onClick={() => setActiveCategoryDomain(dom.id)}
                      className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        activeCategoryDomain === dom.id
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-[#000000] border border-[#1E222B] text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {dom.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {getCategoriesByDomain(appData, activeCategoryDomain).map((cat) => {
                  const refCount = appData
                    ? countCategoryReferences(appData, cat.name, activeCategoryDomain)
                    : 0;
                  return (
                    <div
                      key={cat.id}
                      data-testid={`category-mgmt-row-${activeCategoryDomain}-${cat.name}`}
                      className="p-2.5 rounded-xl bg-[#000000] border border-[#1E222B] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="color"
                          aria-label={`Color for ${cat.name}`}
                          data-testid={`category-color-picker-${activeCategoryDomain}-${cat.name}`}
                          value={
                            /^#[0-9A-Fa-f]{6}$/.test(cat.color || '')
                              ? (cat.color as string)
                              : accent.hex
                          }
                          onChange={(e) => {
                            if (!appData) return;
                            const nextColor = e.target.value;
                            void updateAppData(
                              (prev) =>
                                updateCategoryColorInDomain(
                                  prev,
                                  activeCategoryDomain,
                                  cat.name,
                                  nextColor
                                ),
                              { label: `Updated color for "${cat.name}"` }
                            );
                          }}
                          className="w-6 h-6 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5 shrink-0"
                        />
                        <InlineCategoryBadge
                          domain={activeCategoryDomain}
                          category={cat.name}
                          size="sm"
                          showCount={refCount}
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-zinc-500">
                          {refCount} {refCount === 1 ? 'entry' : 'entries'}
                        </span>
                        <button
                          type="button"
                          title={`Delete ${cat.name} category`}
                          data-testid={`delete-category-btn-${activeCategoryDomain}-${cat.name}`}
                          onClick={() => {
                            if (!appData) return;
                            void updateAppData(
                              (prev) => {
                                const nextData = deleteCategoryFromDomain(
                                  prev,
                                  activeCategoryDomain,
                                  cat.name
                                );
                                const nextIds = new Set(
                                  (nextData.categories || []).map((c) => c.id)
                                );
                                const prevCats =
                                  prev.categories || prev.settings?.categories || [];
                                const removedIds = prevCats
                                  .filter((c) => !nextIds.has(c.id))
                                  .map((c) => c.id);
                                return removedIds.length > 0
                                  ? {
                                      ...nextData,
                                      deletedItemTombstones: recordDeletedItemTombstones(
                                        prev.deletedItemTombstones,
                                        removedIds
                                      ),
                                    }
                                  : nextData;
                              },
                              { label: `Deleted category "${cat.name}"` }
                            );
                          }}
                          className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* + Add New Category with Custom Color */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newCategoryNameInput.trim()) return;
                  const ok = await addCategory(
                    activeCategoryDomain,
                    newCategoryNameInput,
                    newCategoryColorInput
                  );
                  if (ok) {
                    setNewCategoryNameInput('');
                  }
                }}
                className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] flex items-center gap-2"
              >
                <input
                  type="color"
                  aria-label="New Category Color Picker"
                  data-testid="new-category-color-picker"
                  value={newCategoryColorInput}
                  onChange={(e) => setNewCategoryColorInput(e.target.value)}
                  className="w-7 h-7 rounded bg-[#000000] border border-[#1E222B] cursor-pointer p-0.5 shrink-0"
                />
                <input
                  type="text"
                  data-testid="new-category-name-input"
                  value={newCategoryNameInput}
                  onChange={(e) => setNewCategoryNameInput(e.target.value)}
                  placeholder={`New ${activeCategoryDomain} category...`}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  data-testid="add-category-submit-btn"
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold shrink-0 cursor-pointer"
                >
                  + Add
                </button>
              </form>
            </div>
          </div>
        )}

      {/* =================================================================== */}
      {/* CUSTOMIZATION TAB 5: DAILY MAXIM & QUOTES                           */}
      {/* =================================================================== */}
      {isCustomizationMode && activeCustomizationTab === 'quotes' && (
        <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#1E222B]">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Quote className="w-3.5 h-3.5 text-amber-400" />
                <span>Daily Maxim &amp; Stoic Strategy Quote Engine</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Deterministic daily rotation, shuffle, pinning, and custom personal maxim creation.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShuffleQuote}
                className="px-2.5 py-1 rounded-lg bg-[#000000] hover:border-zinc-500 border border-[#1E222B] text-xs font-mono text-zinc-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Shuffle</span>
              </button>
              <button
                type="button"
                onClick={handleTogglePinQuote}
                className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer ${
                  appData?.quoteState?.isPinned
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-[#000000] text-zinc-300 border-[#1E222B]'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
                <span>{appData?.quoteState?.isPinned ? 'Pinned' : 'Pin Maxim'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Active Quote + Custom Quotes List */}
            <div className="lg:col-span-6 space-y-3">
              <div className="p-4 rounded-xl bg-[#000000] border border-[#1E222B] space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-400">ACTIVE MAXIM</span>
                  <span className="px-2 py-0.5 rounded uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    {currentQuote.category || 'general'}
                  </span>
                </div>
                <blockquote className="text-sm font-serif italic text-zinc-100 leading-relaxed border-l-2 border-amber-400 pl-3 py-0.5">
                  "{currentQuote.text}"
                </blockquote>
                <div className="text-xs text-zinc-400 font-semibold">— {currentQuote.author}</div>
              </div>

              {(appData?.quoteState?.customQuotes || []).length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase text-zinc-400">
                    Custom Maxims Library
                  </div>
                  {(appData?.quoteState?.customQuotes || []).map((q) => {
                    const isActive = currentQuote.id === q.id;
                    return (
                      <div
                        key={q.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                          isActive
                            ? 'bg-[#000000] border-amber-500/40 text-white'
                            : 'bg-[#000000] border-[#1E222B] text-zinc-300'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs italic truncate">"{q.text}"</p>
                          <span className="text-[10px] text-zinc-400 font-mono">— {q.author}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!isActive && (
                            <button
                              type="button"
                              onClick={() => handleSelectActiveQuote(q.id)}
                              className="px-2 py-0.5 rounded bg-[#000000] border border-[#1E222B] text-[10px] font-mono text-zinc-200 cursor-pointer"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteCustomQuote(q.id)}
                            className="p-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* + Add Custom Maxim Form */}
            <form
              onSubmit={handleAddCustomQuote}
              className="lg:col-span-6 p-4 rounded-xl bg-[#000000] border border-[#1E222B] space-y-3"
            >
              <div className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>+ Add Custom Personal Maxim</span>
              </div>
              <textarea
                required
                rows={2}
                maxLength={280}
                value={newQuoteText}
                onChange={(e) => setNewQuoteText(e.target.value)}
                placeholder="Enter your personal rule, maxim, or core philosophy..."
                className="w-full px-3 py-2 bg-[#000000] border border-[#1E222B] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  maxLength={80}
                  value={newQuoteAuthor}
                  onChange={(e) => setNewQuoteAuthor(e.target.value)}
                  placeholder="Author (e.g. Personal Directive)"
                  className="px-2.5 py-1.5 bg-[#000000] border border-[#1E222B] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                />
                <select
                  value={newQuoteCategory}
                  onChange={(e) =>
                    setNewQuoteCategory(
                      e.target.value as 'discipline' | 'strategy' | 'stoicism' | 'execution' | 'custom'
                    )
                  }
                  className="px-2.5 py-1.5 bg-[#000000] border border-[#1E222B] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="discipline">Discipline</option>
                  <option value="strategy">Strategy</option>
                  <option value="stoicism">Stoicism</option>
                  <option value="execution">Execution</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <button
                type="submit"
                className="py-1.5 px-3.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Save &amp; Activate Maxim</span>
              </button>
            </form>
          </div>
        </div>
      )}


      {/* =================================================================== */}
      {/* SETTINGS SECTION 1: IDENTITY & PREFERENCES                         */}
      {/* =================================================================== */}
      {!isCustomizationMode &&
        (activeCustomizationTab === 'general' ||
          activeCustomizationTab === 'units' ||
          activeCustomizationTab === 'all') && (
        <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E222B]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <SettingsIcon className="w-4 h-4 text-amber-400" />
              <span>Identity &amp; Preferences</span>
            </h3>
            {weather && (
              <span className="text-xs font-mono text-cyan-400">
                Weather: {weather.city} • {Math.round(weather.temperature)}°F • {weather.condition}
              </span>
            )}
          </div>

          {/* Forum-Style Profile Card & Private Gallery Avatar Picker */}
          <div
            data-testid="forum-profile-settings-card"
            className="p-4 rounded-xl bg-[#08090C] border border-[#1E222B] space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#1E222B]">
              <div className="flex items-center gap-3.5">
                {appData?.settings?.avatarDataUrl ? (
                  <img
                    src={appData.settings.avatarDataUrl}
                    alt={userName}
                    data-testid="settings-forum-avatar-img"
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-cyan-500/50 shadow-lg shrink-0"
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-extrabold text-black border border-white/20 shadow-lg shrink-0"
                    style={{ backgroundColor: accent.hex }}
                  >
                    {userName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      data-testid="settings-forum-username"
                      className="text-base font-extrabold text-white tracking-tight"
                    >
                      {userName}
                    </span>
                    <RoleBadge role={accountRole} size="sm" />
                  </div>
                  <div
                    data-testid="settings-forum-guild-name"
                    className="text-xs font-mono font-bold text-cyan-400"
                  >
                    {guildName || 'Aegis Vanguard'}
                  </div>
                  <div className="text-[11px] font-mono text-zinc-500">
                    @{accountSession?.username || 'commander'} • Forum-Style Profile Header
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label
                  data-testid="settings-upload-gallery-avatar-label"
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-all ${accent.primaryBg}`}
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {isUploadingAvatarGallery
                      ? 'Compressing...'
                      : '+ Upload to Private Gallery'}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    data-testid="settings-upload-gallery-avatar-input"
                    onChange={handleUploadProfileGalleryImages}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setActiveTab('gallery')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#111319] hover:bg-[#181B24] text-zinc-200 border border-[#1E222B] cursor-pointer"
                >
                  Open Full Gallery
                </button>
              </div>
            </div>

            {/* Private Gallery Profile Avatar Picker Strip */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                <span>
                  PRIVATE GALLERY AVATAR PICKER ({(appData?.gallery || []).length} compressed images — click any image to set as Profile Picture)
                </span>
                {appData?.settings?.avatarDataUrl && (
                  <button
                    type="button"
                    onClick={() => handleSelectProfileAvatarFromGallery('', 'Default Monogram')}
                    className="text-rose-400 hover:underline cursor-pointer"
                  >
                    Reset to Monogram
                  </button>
                )}
              </div>

              {(appData?.gallery || []).length === 0 ? (
                <div className="p-3 rounded-xl bg-[#000000] border border-dashed border-[#1E222B] text-xs text-zinc-500 font-mono text-center">
                  No images in your Private Gallery yet. Upload images above (auto-compressed ≤256×256px for Cloudflare) to pick your Profile Picture.
                </div>
              ) : (
                <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5">
                  {(appData?.gallery || []).map((imgItem) => {
                    const isSelectedAvatar =
                      appData?.settings?.avatarDataUrl === imgItem.dataUrl;
                    return (
                      <div
                        key={imgItem.id}
                        data-testid={`settings-avatar-option-${imgItem.id}`}
                        className={`relative group w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 cursor-pointer transition-all ${
                          isSelectedAvatar
                            ? 'border-cyan-400 ring-2 ring-cyan-400/40 scale-105'
                            : 'border-[#1E222B] hover:border-zinc-500'
                        }`}
                        onClick={() =>
                          handleSelectProfileAvatarFromGallery(imgItem.dataUrl, imgItem.title)
                        }
                        title={`Set "${imgItem.title}" as Profile Picture`}
                      >
                        <img
                          src={imgItem.dataUrl}
                          alt={imgItem.title}
                          className="w-full h-full object-cover"
                        />
                        {isSelectedAvatar && (
                          <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center">
                            <Check className="w-5 h-5 text-white drop-shadow" />
                          </div>
                        )}
                        <button
                          type="button"
                          data-testid={`settings-delete-gallery-img-${imgItem.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteGalleryImageFromSettings(imgItem);
                          }}
                          title="Delete image from Private Gallery"
                          className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/80 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <form onSubmit={handleSaveGeneral} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Commander / Username</label>
                <input
                  type="text"
                  data-testid="input-user-name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Commander Name"
                  className="w-full px-3 py-2 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-cyan-300 mb-1">Guild Name (Under Username)</label>
                <input
                  type="text"
                  maxLength={48}
                  data-testid="input-guild-name"
                  value={guildName}
                  onChange={(e) => setGuildName(e.target.value)}
                  placeholder="e.g. Aegis Vanguard"
                  className="w-full px-3 py-2 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Application Name</label>
                <input
                  type="text"
                  data-testid="input-app-name"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Axiom Aegis"
                  className="w-full px-3 py-2 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Monogram / Abbreviation</label>
                <input
                  type="text"
                  maxLength={8}
                  data-testid="input-app-short-name"
                  value={appShortName}
                  onChange={(e) => setAppShortName(e.target.value)}
                  placeholder="AEGIS"
                  className="w-full px-3 py-2 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white font-mono uppercase focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Currency Symbol</label>
                <input
                  type="text"
                  maxLength={4}
                  value={currencySymbol}
                  onChange={(e) => setCurrencySymbol(e.target.value)}
                  placeholder="$"
                  className="w-full px-3 py-2 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white font-mono text-center focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Distance Unit</label>
                <select
                  value={distanceUnit}
                  onChange={(e) => setDistanceUnit(e.target.value as DistanceUnit)}
                  className="w-full px-3 py-2 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white focus:outline-none"
                >
                  <option value="mi">Miles (mi) — Imperial</option>
                  <option value="km">Kilometers (km) — Metric</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Unit System</label>
                <select
                  value={unitSystem}
                  onChange={(e) => setUnitSystem(e.target.value as UnitSystem)}
                  className="w-full px-3 py-2 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white focus:outline-none"
                >
                  <option value="imperial">Imperial (lbs, °F)</option>
                  <option value="metric">Metric (kg, °C)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Starting Balance ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={startingBalance}
                  onChange={(e) => setStartingBalance(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Weather City & Coordinates with Detect/Refresh */}
            <div className="pt-3 border-t border-[#1E222B] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5 font-mono">
                  <CloudSun className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Weather Station Coordinates</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="settings-weather-detect-btn"
                    disabled={isWeatherLoading}
                    onClick={async () => {
                      await detectMyWeatherLocation();
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Compass className="w-3 h-3" />
                    <span>Detect My Location</span>
                  </button>
                  <button
                    type="button"
                    disabled={isWeatherLoading}
                    onClick={async () => {
                      await refreshWeather();
                    }}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#0E1015] hover:bg-[#181B24] border border-[#232732] text-zinc-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCw className={`w-3 h-3 ${isWeatherLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh Weather</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">City / Location</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      data-testid="settings-weather-search-input"
                      value={weatherCity}
                      onChange={(e) => {
                        setWeatherCity(e.target.value);
                        setWeatherSearchQuery(e.target.value);
                      }}
                      placeholder="City Name or ZIP"
                      className="flex-1 px-3 py-1.5 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      data-testid="settings-weather-search-btn"
                      disabled={isWeatherLoading || !weatherCity.trim()}
                      onClick={async () => {
                        await searchAndSaveWeatherLocation(weatherCity.trim());
                      }}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#181B24] hover:bg-[#202430] border border-[#232732] text-zinc-200 cursor-pointer"
                    >
                      Search
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={weatherLat}
                    onChange={(e) => setWeatherLat(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={weatherLon}
                    onChange={(e) => setWeatherLon(e.target.value)}
                    className="w-full px-3 py-1.5 bg-[#0E1015] border border-[#232732] rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                data-testid="save-app-preferences-btn"
                className={`px-4 py-2 rounded-lg text-xs font-bold shadow-md cursor-pointer ${accent.primaryBg}`}
              >
                Save Preferences
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* SETTINGS SECTION 2: ACCOUNT & DATABASE SYNC                         */}
      {/* =================================================================== */}
      {!isCustomizationMode &&
        (activeCustomizationTab === 'sync' || activeCustomizationTab === 'all') && (
        <div
          data-testid="cloud-sync-console"
          className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E222B]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cloud className="w-4 h-4 text-cyan-400" />
              <span>Account &amp; Database Sync</span>
            </h3>
            <div className="flex items-center gap-2 shrink-0">
              <span
                data-testid="cloud-sync-status-badge"
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border flex items-center gap-1.5 ${
                  cloudSyncStatus === 'syncing'
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : cloudSyncStatus === 'error'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    : cloudSyncStatus === 'synced'
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-[#111319] text-zinc-400 border-[#1E222B]'
                }`}
              >
                {cloudSyncStatus === 'syncing' ? (
                  <>
                    <RotateCw className="w-3 h-3 animate-spin" />
                    <span>SYNCING ACCOUNT...</span>
                  </>
                ) : cloudSyncStatus === 'synced' ? (
                  <>
                    <Cloud className="w-3 h-3 text-emerald-400" />
                    <span>DATABASE SYNCED</span>
                  </>
                ) : (
                  <>
                    <CloudOff className="w-3 h-3 text-zinc-500" />
                    <span>LOCAL CACHE</span>
                  </>
                )}
              </span>
              {lastCloudSyncAt && (
                <span className="text-[11px] font-mono text-zinc-400">
                  {new Date(lastCloudSyncAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {cloudSyncError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{cloudSyncError}</span>
            </div>
          )}

          {lastSyncFeedback && !cloudSyncError && (
            <div
              data-testid="settings-sync-feedback-banner"
              className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 font-mono flex items-center gap-2"
            >
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{lastSyncFeedback}</span>
            </div>
          )}

          {/* 1. Logged-In Account Profile & Sign Out */}
          <div
            data-testid="unified-account-sync-card"
            className="p-4 rounded-xl bg-[#08090C] border border-[#1E222B] space-y-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1E222B]">
              <div className="flex items-center gap-2 flex-wrap">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Authenticated Account
                </span>
                <RoleBadge
                  role={accountRole}
                  size="sm"
                  testId="settings-account-role-badge"
                />
              </div>
              <div className="flex items-center gap-2">
                <span
                  data-testid="unified-account-status-badge"
                  className="px-2.5 py-0.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-[11px] font-mono font-bold text-emerald-300"
                >
                  @{accountSession?.username || 'user'}
                </span>
                <button
                  type="button"
                  data-testid="settings-signout-btn"
                  onClick={() => signOutAccount()}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 cursor-pointer transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const clean = accountDisplayNameInput.trim();
                if (!clean) return;
                setUserName(clean);
                await updateAccountDisplayName(clean);
              }}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
            >
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-400 mb-1">
                  Account Username
                </label>
                <input
                  type="text"
                  disabled
                  data-testid="account-username-display"
                  value={`@${accountSession?.username || 'user'}`}
                  className="w-full px-3 py-2 bg-[#000000] border border-[#1E222B] rounded-lg text-xs text-zinc-400 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-300 mb-1">
                  Display Name (Commander Name)
                </label>
                <input
                  type="text"
                  required
                  data-testid="account-displayname-edit-input"
                  value={accountDisplayNameInput}
                  onChange={(e) => setAccountDisplayNameInput(e.target.value)}
                  placeholder="Display Name"
                  className="w-full px-3 py-2 bg-[#000000] border border-[#232732] rounded-lg text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <button
                  type="submit"
                  data-testid="account-save-profile-btn"
                  className="w-full px-4 py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow transition-all cursor-pointer"
                >
                  Update Display Name &amp; Sync
                </button>
              </div>
            </form>
          </div>

          {/* 2. Database Sync Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              data-testid="account-sync-now-btn"
              disabled={cloudSyncStatus === 'syncing'}
              onClick={() => void syncVaultNow({ silent: false })}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-black shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${cloudSyncStatus === 'syncing' ? 'animate-spin' : ''}`} />
              <span>Sync Account Now</span>
            </button>

            <button
              type="button"
              data-testid="account-force-save-btn"
              disabled={cloudSyncStatus === 'syncing'}
              onClick={() => void forcePushVaultToCloud()}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#08090C] hover:bg-[#141720] border border-[#232732] text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Force Save This Device to Account</span>
            </button>

            <button
              type="button"
              data-testid="account-reload-db-btn"
              disabled={cloudSyncStatus === 'syncing'}
              onClick={() => void forcePullVaultFromCloud()}
              className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-[#08090C] hover:bg-[#141720] border border-[#232732] text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Reload Account from Database</span>
            </button>
          </div>

          {/* 3. Offline Account Snapshot Backup */}
          <div className="pt-3 border-t border-[#1E222B] space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                data-testid="account-export-snapshot-btn"
                onClick={() => exportAccountSnapshot()}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-[#08090C] hover:bg-[#141720] border border-[#232732] text-zinc-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export Account Snapshot (.json)</span>
              </button>

              <label
                data-testid="account-import-snapshot-label"
                className="px-3 py-2 rounded-xl text-xs font-bold bg-[#08090C] hover:bg-[#141720] border border-[#232732] text-zinc-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isImportingSnapshot ? 'Importing...' : 'Import Account Snapshot (.json)'}</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  data-testid="account-import-snapshot-input"
                  onChange={handleSnapshotFileImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* SETTINGS SECTION 4: DATA IMPORT & FACTORY RESET                    */}
      {/* =================================================================== */}
      {!isCustomizationMode &&
        (activeCustomizationTab === 'import' || activeCustomizationTab === 'all') && (
        <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg space-y-4">
          <div className="pb-3 border-b border-[#1E222B]">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileUp className="w-4 h-4 text-rose-400" />
              <span>Data Import &amp; Factory Reset</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => openImportHub('bank_csv')}
              className="p-3.5 rounded-xl bg-[#08090C] hover:bg-[#111319] border border-[#232732] hover:border-emerald-500/40 text-left transition-all cursor-pointer flex items-center gap-3"
            >
              <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-white block">Bank CSV / PDF Statement Import</span>
                <span className="text-[11px] text-zinc-400">Import bank records with duplicate detection.</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => openImportHub('timeline_ocr')}
              className="p-3.5 rounded-xl bg-[#08090C] hover:bg-[#111319] border border-[#232732] hover:border-cyan-500/40 text-left transition-all cursor-pointer flex items-center gap-3"
            >
              <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
              <div>
                <span className="text-xs font-bold text-white block">Timeline Screenshot OCR</span>
                <span className="text-[11px] text-zinc-400">Extract routes and stops via client-side OCR.</span>
              </div>
            </button>
          </div>

          {/* Danger Zone: Factory Reset */}
          <div className="pt-3 border-t border-[#1E222B] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Danger Zone</span>
              </span>
              {!confirmResetOpen ? (
                <button
                  type="button"
                  data-testid="factory-reset-btn"
                  onClick={() => setConfirmResetOpen(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 transition-colors cursor-pointer"
                >
                  Factory Reset Vault
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setConfirmResetOpen(false);
                      await handleFactoryReset();
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                  >
                    Confirm Wipe &amp; Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmResetOpen(false)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-[#141720] text-zinc-300 border border-[#232732] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
