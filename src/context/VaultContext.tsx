import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  AccountRole,
  AppData,
  CategoryDomain,
  EncryptedPayload,
  FocusTimerState,
  TabType,
  AccentColor,
  TimelineCategory,
  WeatherData,
  ImportTabType,
  LayoutConfig,
} from '../types';
import {
  encryptData,
  decryptData,
  deriveKeyHex,
  deriveKeyDetails,
  generateSalt,
  deriveDeterministicAccountSalt,
  deriveUnifiedAccountCredentials,
  computeKeyFingerprint,
  formatRecoveryKey,
  verifyVaultPassphraseOrKey,
  base64ToBuffer,
  clearDerivedKeyCache,
  DEFAULT_SESSION_PASSPHRASE,
} from '../utils/crypto';
import {
  saveEncryptedPayload,
  getEncryptedPayload,
  clearEncryptedVault,
  saveSessionVaultCredential,
  getSessionVaultCredential,
  saveActiveDeviceEncryptionIdentity,
  getActiveDeviceEncryptionIdentity,
  saveUnifiedSyncAccount,
  getUnifiedSyncAccount,
  UnifiedSyncAccountSession,
  AccountSession,
  saveAccountSession,
  getAccountSession,
  saveLocalAccountCacheEntry,
  getLocalAccountCacheEntry,
  verifyLocalAccountPassword,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_VERIFIER,
  MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
  isMasterAdminIdentifier,
  isMasterAdminCredentials,
  resolveAccountRole,
  createDeterministicAccountToken,
  ensureMasterAdminAccountSeeded,
  requestPersistentStorage,
} from '../utils/storage';
import { createInitialAppData, DEFAULT_LAYOUT_CONFIG } from '../utils/defaults';
import {
  ACCENT_THEMES,
  DARK_PALETTE,
  resolveAccentTheme,
  resolveSurfaceConfig,
  resolveTextColorConfig,
} from '../utils/theme';
import {
  fetchLiveWeather,
  reverseGeocodeWeatherCoords,
  searchWeatherLocation,
} from '../utils/calculations';
import {
  CloudSyncStatus,
  buildPhonePairingUrl,
  decideTwoWaySyncAction,
  decryptVaultFromCloudSync,
  downloadDriveVaultFile,
  encryptVaultForCloudSync,
  exportCloudVaultFileOrShare,
  fetchRemoteEncryptedVault,
  findDriveVaultFile,
  isFactoryDefaultVault,
  mergeCloudAndLocalVaults,
  parsePhonePairingHash,
  pushRemoteEncryptedVault,
  requestGoogleDriveAccessToken,
  resolveReachablePairingBaseUrl,
  uploadDriveVaultFile,
  createUnifiedVaultPackage,
  parseUnifiedVaultPackage,
  encodeTransferToken,
  decodeTransferToken,
  computeSyncChannelId,
  createOfflineSyncV2Code,
  parseOfflineSyncToken,
  buildLocalSafeQrPayload,
  UnifiedVaultTransferPackage,
  registerAccountInDatabase,
  loginAccountFromDatabase,
  fetchAccountWorkspaceFromDatabase,
  pushAccountWorkspaceToDatabase,
  buildAccountSnapshotJson,
  parseAccountSnapshotJson,
} from '../utils/cloudSyncEngine';
import { readEmbeddedVaultSnapshot } from '../utils/downloadApp';
import { isFileProtocol } from '../utils/mobilePwaEngine';
import { APP_VERSION, APP_FULL_NAME, APP_SHORT_NAME } from '../utils/version';
import {
  loadAppDataFromLocalStorage,
  loadLayoutConfigFromLocalStorage,
  runCleanSlateMigrationV1101,
  saveAppDataToLocalStorage,
  saveMatrixLayoutToLocalStorage,
  sanitizeLayoutConfig,
  validateAndSanitizeAppData,
} from '../utils/matrixLayoutEngine';
import {
  addCategoryToDomain,
  renameCategoryCascading,
} from '../utils/categoryEngine';
import {
  enforceTabAccessGuard,
  isAdminOnlyTab,
} from '../utils/sidebarEngine';
import {
  BackupHealthStatus,
  buildTimelineEntryFromFocusTimer,
  countTotalVaultRecords,
  createAegisSnapshotFilename,
  DEFAULT_FOCUS_TIMER_STATE,
  detectMutationActionLabel,
  evaluateBackupHealth,
  getFocusTimerElapsedSeconds,
  hasCoreDomainMutation,
  popUndoSnapshot,
  pushUndoSnapshot,
  UndoSnapshotEntry,
} from '../utils/aegisUpgradesEngine';

export interface EncryptedPayloadMeta {
  salt: string;
  iv: string;
  version?: number;
  timestamp: number;
  keyFingerprint?: string;
  verifier?: string;
  hasCustomPassword?: boolean;
}

interface VaultContextType {
  isInitialized: boolean;
  isLocked: boolean;
  isAuthenticated: boolean;
  accountSession: AccountSession | null;
  accountRole: AccountRole;
  isMasterAdmin: boolean;
  registerAccount: (
    username: string,
    displayName: string,
    password: string
  ) => Promise<{ ok: boolean; message: string }>;
  loginAccount: (
    username: string,
    password: string
  ) => Promise<{ ok: boolean; message: string }>;
  signOutAccount: () => void;
  updateAccountDisplayName: (newDisplayName: string) => Promise<boolean>;
  exportAccountSnapshot: () => Promise<boolean>;
  importAccountSnapshot: (
    jsonContent: string
  ) => Promise<{ success: boolean; message: string }>;
  isLoading: boolean;
  isEditMode: boolean;
  isColumnEditMode: boolean;
  setIsColumnEditMode: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFrequentEventsOpen: boolean;
  setIsFrequentEventsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  layoutConfig: LayoutConfig;
  updateLayoutConfig: (updater: (prev: LayoutConfig) => LayoutConfig) => void;
  appData: AppData | null;
  activeTab: TabType;
  accent: typeof ACCENT_THEMES[AccentColor];
  isCommandPaletteOpen: boolean;
  isQuickAddOpen: boolean;
  quickAddInitialTab: 'timeline' | 'lifestats' | 'distance' | 'funds' | 'goals' | 'notes';
  quickAddDefaultDate: string | null;
  selectedCalendarDate: string;
  setSelectedCalendarDate: React.Dispatch<React.SetStateAction<string>>;
  focusedTimelineDate: string | null;
  setFocusedTimelineDate: React.Dispatch<React.SetStateAction<string | null>>;
  isImportHubOpen: boolean;
  importHubInitialTab: ImportTabType;
  notification: { type: 'success' | 'error' | 'info'; message: string } | null;
  weather: WeatherData | null;
  isWeatherLoading: boolean;
  refreshWeather: () => Promise<void>;
  detectMyWeatherLocation: () => Promise<boolean>;
  searchAndSaveWeatherLocation: (query: string) => Promise<boolean>;
  unifiedAccount: UnifiedSyncAccountSession | null;
  loginUnifiedAccount: (
    accountId: string,
    passwordOrKey: string,
    mode?: 'merge' | 'pull' | 'push'
  ) => Promise<boolean>;
  logoutUnifiedAccount: () => void;
  cloudSyncStatus: CloudSyncStatus;
  cloudSyncError: string | null;
  lastSyncFeedback: string | null;
  cloudSyncAccessToken: string | null;
  lastCloudSyncAt: number | null;
  isGoogleDriveConnected: boolean;
  syncVaultNow: (options?: { silent?: boolean; forceDirection?: 'push' | 'pull' }) => Promise<boolean>;
  syncAndShareVaultUnified: () => Promise<{ success: boolean; token?: string; downloaded?: boolean }>;
  updateOrPullVaultUnified: (providedPayloadOrToken?: string) => Promise<boolean>;
  applyUnifiedPayloadOrToken: (rawInput: string) => Promise<boolean>;
  forcePushVaultToCloud: () => Promise<boolean>;
  forcePullVaultFromCloud: () => Promise<boolean>;
  getPhonePairingUrl: () => string;
  getQrPairingPayload: () => string;
  copyOfflineSyncCode: () => Promise<string | null>;
  copyPhonePairingLink: () => Promise<string | null>;
  sharePhonePairingLink: () => Promise<boolean>;
  connectGoogleDriveSync: (customClientId?: string) => Promise<string | null>;
  connectGoogleDrive: (customClientId?: string) => Promise<string | null>;
  disconnectGoogleDriveSync: () => void;
  disconnectGoogleDrive: () => void;
  pushVaultToGoogleDrive: (customPassphrase?: string) => Promise<boolean>;
  pullVaultFromGoogleDrive: (
    mode?: 'pull' | 'auto_merge',
    customPassphrase?: string
  ) => Promise<boolean>;
  autoMergeWithGoogleDrive: (customPassphrase?: string) => Promise<boolean>;
  exportEncryptedCloudFile: (
    preferShareSheet?: boolean,
    customPassphrase?: string
  ) => Promise<boolean>;
  saveToCloudSyncedFile: () => Promise<boolean>;
  loadFromCloudSyncedFile: () => Promise<boolean>;
  shareEncryptedVaultMobile: () => Promise<boolean>;
  importEncryptedCloudFile: (
    jsonContent: string,
    passphrase: string,
    mode?: 'pull' | 'auto_merge'
  ) => Promise<boolean>;
  toggleEditMode: () => void;
  setActiveTab: (tab: TabType) => void;
  setIsCommandPaletteOpen: (open: boolean) => void;
  openQuickAdd: (
    tab?: 'timeline' | 'lifestats' | 'distance' | 'funds' | 'goals' | 'notes',
    defaultDate?: string
  ) => void;
  closeQuickAdd: () => void;
  openImportHub: (tab?: ImportTabType) => void;
  closeImportHub: () => void;
  setupVault: (
    masterPassphrase: string,
    initialName?: string,
    initialUserName?: string
  ) => Promise<boolean>;
  unlockVault: (passphraseOrKey: string) => Promise<boolean>;
  lockVault: () => void;
  changePassphrase: (newPassphrase: string) => Promise<boolean>;
  verifyCredential: (
    passphraseOrKey: string
  ) => Promise<{ valid: boolean; mode: 'password' | 'raw_key' | null; keyFingerprint?: string }>;
  activeEncryptionKeyHex: string | null;
  activeRecoveryKey: string | null;
  keyFingerprint: string | null;
  hasCustomPassword: boolean;
  encryptedPayloadMeta: EncryptedPayloadMeta | null;
  updateAppData: (
    updater: (prev: AppData) => AppData,
    options?: { skipUndo?: boolean; actionLabel?: string; label?: string }
  ) => Promise<void>;
  canUndo: boolean;
  undoStackCount: number;
  lastUndoLabel: string | null;
  undoLastAction: () => Promise<boolean>;
  backupHealth: BackupHealthStatus;
  focusTimer: FocusTimerState;
  focusElapsedSeconds: number;
  startFocusTimer: (title?: string, category?: TimelineCategory, templateId?: string) => void;
  pauseFocusTimer: () => void;
  resumeFocusTimer: () => void;
  stopAndLogFocusTimer: () => Promise<void>;
  resetFocusTimer: () => void;
  updateFocusTimerMeta: (title: string, category: TimelineCategory) => void;
  renameCategory: (
    oldName: string,
    newRawName: string,
    domain?: CategoryDomain
  ) => Promise<{ updated: boolean; merged: boolean; finalName: string; updatedItemsCount: number }>;
  addCategory: (domain: CategoryDomain, rawName: string, color?: string) => Promise<boolean>;
  exportEncryptedBackup: (format?: 'aegis' | 'json') => Promise<void>;
  importEncryptedBackup: (
    jsonContent: string,
    passphrase?: string
  ) => Promise<{ success: boolean; message: string }>;
  resetVault: () => Promise<void>;
  lastSavedTimestamp: number;
  showNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const VaultContext = createContext<VaultContextType | null>(null);

function normalizeAppData(data: any): AppData {
  const sanitized = validateAndSanitizeAppData(
    data,
    data?.settings?.appName,
    data?.settings?.userName
  );
  const candidateLayout =
    data?.settings?.layoutConfig ??
    data?.layoutConfig ??
    (Array.isArray(data?.settings?.dashboardWidgets ?? data?.matrixLayout)
      ? {
          ...DEFAULT_LAYOUT_CONFIG,
          layoutVersion: 5,
          widgets: data?.settings?.dashboardWidgets ?? data?.matrixLayout,
        }
      : undefined);
  const resolvedLayout = candidateLayout
    ? sanitizeLayoutConfig(
        {
          ...candidateLayout,
          sidebarPosition:
            data?.settings?.sidebarPosition || candidateLayout.sidebarPosition || 'left',
          sidebarIconColor:
            data?.settings?.sidebarIconColor || candidateLayout.sidebarIconColor || '#00E5FF',
          sidebarGroupOrder:
            data?.settings?.sidebarGroupOrder || candidateLayout.sidebarGroupOrder,
          sidebarGroupItems:
            data?.settings?.sidebarGroupItems || candidateLayout.sidebarGroupItems,
          sidebarGroupLabels:
            data?.settings?.sidebarGroupLabels || candidateLayout.sidebarGroupLabels,
          sidebarItemLabels:
            data?.settings?.sidebarItemLabels || candidateLayout.sidebarItemLabels,
        },
        DEFAULT_LAYOUT_CONFIG,
        sanitized.customNavCategories
      )
    : loadLayoutConfigFromLocalStorage(sanitized.settings.layoutConfig || DEFAULT_LAYOUT_CONFIG);

  return {
    ...sanitized,
    settings: {
      ...sanitized.settings,
      dashboardWidgets: resolvedLayout.widgets,
      sidebarPosition: resolvedLayout.sidebarPosition,
      sidebarIconColor: resolvedLayout.sidebarIconColor,
      sidebarGroupOrder: resolvedLayout.sidebarGroupOrder,
      sidebarGroupItems: resolvedLayout.sidebarGroupItems,
      sidebarGroupLabels: resolvedLayout.sidebarGroupLabels,
      sidebarItemLabels: resolvedLayout.sidebarItemLabels,
      layoutConfig: resolvedLayout,
    },
  };
}

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accountSession, setAccountSession] = useState<AccountSession | null>(() =>
    getAccountSession()
  );
  const [isInitialized, setIsInitialized] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(() => !Boolean(getAccountSession()));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [isColumnEditMode, setIsColumnEditMode] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isFrequentEventsOpen, setIsFrequentEventsOpen] = useState<boolean>(false);
  const [unifiedAccount, setUnifiedAccount] = useState<UnifiedSyncAccountSession | null>(() =>
    getUnifiedSyncAccount()
  );
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'disconnected';
    }
    return getAccountSession() ? 'synced' : 'disconnected';
  });
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [lastSyncFeedback, setLastSyncFeedback] = useState<string | null>(null);
  const [cloudSyncAccessToken, setCloudSyncAccessToken] = useState<string | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<number | null>(
    () => getAccountSession()?.lastSyncedAt || getUnifiedSyncAccount()?.lastSyncedAt || null
  );
  const isSyncingRef = useRef<boolean>(false);
  const hasPendingCloudPushRef = useRef<boolean>(false);
  const lastCloudPullAtRef = useRef<number>(0);
  const autoSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(() =>
    loadLayoutConfigFromLocalStorage(DEFAULT_LAYOUT_CONFIG)
  );
  const [appData, setAppData] = useState<AppData | null>(() => loadAppDataFromLocalStorage());
  const [activeTabState, setActiveTabState] = useState<TabType>('shortcuts');
  const setActiveTab = useCallback(
    (tab: TabType) => {
      const currSession = getAccountSession() || accountSession;
      const allowedAdmin = Boolean(
        currSession &&
          isMasterAdminIdentifier(currSession.username) &&
          resolveAccountRole(currSession.username, currSession.role) === 'The App Creator'
      );
      const guardedTab = enforceTabAccessGuard(
        tab,
        allowedAdmin,
        appData?.customNavCategories
      );
      setActiveTabState(guardedTab);
    },
    [accountSession, appData?.customNavCategories]
  );

  useEffect(() => {
    const currSession = getAccountSession() || accountSession;
    const allowedAdmin = Boolean(
      currSession &&
        isMasterAdminIdentifier(currSession.username) &&
        resolveAccountRole(currSession.username, currSession.role) === 'The App Creator'
    );
    if (!allowedAdmin && isAdminOnlyTab(activeTabState, appData?.customNavCategories)) {
      setActiveTabState('dashboard');
    }
  }, [activeTabState, accountSession, appData?.customNavCategories]);

  const activeTab = activeTabState;
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [quickAddInitialTab, setQuickAddInitialTab] = useState<
    'timeline' | 'lifestats' | 'distance' | 'funds' | 'goals' | 'notes'
  >('timeline');
  const [quickAddDefaultDate, setQuickAddDefaultDate] = useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [focusedTimelineDate, setFocusedTimelineDate] = useState<string | null>(null);
  const [isImportHubOpen, setIsImportHubOpen] = useState<boolean>(false);
  const [importHubInitialTab, setImportHubInitialTab] = useState<ImportTabType>('bank_csv');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState<boolean>(false);

  // Live cryptographic key telemetry state (hydrated from localStorage identity if available)
  const storedIdentity = getActiveDeviceEncryptionIdentity();
  const [activeEncryptionKeyHex, setActiveEncryptionKeyHex] = useState<string | null>(
    storedIdentity.hexKey
  );
  const [activeRecoveryKey, setActiveRecoveryKey] = useState<string | null>(
    storedIdentity.hexKey ? formatRecoveryKey(storedIdentity.hexKey) : null
  );
  const [keyFingerprint, setKeyFingerprint] = useState<string | null>(
    storedIdentity.keyFingerprint
  );
  const [hasCustomPassword, setHasCustomPassword] = useState<boolean>(false);
  const [encryptedPayloadMeta, setEncryptedPayloadMeta] = useState<EncryptedPayloadMeta | null>(
    null
  );

  // Guarantee cloudSyncStatus cannot remain stuck on 'syncing' if a network request stalls
  useEffect(() => {
    if (cloudSyncStatus !== 'syncing') return;
    const watchdog = setTimeout(() => {
      isSyncingRef.current = false;
      const isOnlineNow = typeof navigator === 'undefined' || navigator.onLine !== false;
      setCloudSyncStatus((prev) =>
        prev === 'syncing'
          ? !isOnlineNow || hasPendingCloudPushRef.current
            ? 'disconnected'
            : lastCloudSyncAt
              ? 'synced'
              : 'disconnected'
          : prev
      );
    }, 6500);
    return () => clearTimeout(watchdog);
  }, [cloudSyncStatus, lastCloudSyncAt]);

  // Global Undo Ring Buffer (up to 10 snapshots)
  const [undoBuffer, setUndoBuffer] = useState<UndoSnapshotEntry[]>([]);
  const undoBufferRef = useRef<UndoSnapshotEntry[]>([]);
  useEffect(() => {
    undoBufferRef.current = undoBuffer;
  }, [undoBuffer]);

  // Live Execution Focus Stopwatch state
  const [focusTimer, setFocusTimer] = useState<FocusTimerState>(DEFAULT_FOCUS_TIMER_STATE);
  const [focusElapsedSeconds, setFocusElapsedSeconds] = useState<number>(0);

  // In-memory master key/passphrase reference while unlocked
  const currentPassphraseRef = useRef<string | null>(
    getSessionVaultCredential() || storedIdentity.hexKey || DEFAULT_SESSION_PASSPHRASE
  );
  const latestAppDataRef = useRef<AppData | null>(appData);
  const lastActivityRef = useRef<number>(Date.now());
  const cachedEncryptedPayloadRef = useRef<EncryptedPayload | null>(null);
  const layoutDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sequence counter to prevent stale background encryptData calls from overwriting a newer password
  const encryptionSeqRef = useRef<number>(0);

  const encryptDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const telemetryKeyCacheRef = useRef<{
    cacheKey: string;
    hexKey: string;
    recoveryKey: string;
    fp: string;
  } | null>(null);

  useEffect(() => {
    latestAppDataRef.current = appData;
  }, [appData]);

  const syncKeyTelemetry = useCallback(
    async (payload: EncryptedPayload, credential: string | null) => {
      const isCustom = Boolean(payload.hasCustomPassword);

      let resolvedHexKey: string | null = null;
      let resolvedRecoveryKey: string | null = null;
      let resolvedFp: string | null = payload.keyFingerprint || null;

      if (credential) {
        const cacheKey = `${credential}::${payload.salt}`;
        if (telemetryKeyCacheRef.current && telemetryKeyCacheRef.current.cacheKey === cacheKey) {
          resolvedHexKey = telemetryKeyCacheRef.current.hexKey;
          resolvedRecoveryKey = telemetryKeyCacheRef.current.recoveryKey;
          resolvedFp = telemetryKeyCacheRef.current.fp;
        } else {
          try {
            const hexKey = await deriveKeyHex(credential, payload.salt);
            const fp = await computeKeyFingerprint(hexKey);
            resolvedHexKey = hexKey;
            resolvedRecoveryKey = formatRecoveryKey(hexKey);
            resolvedFp = fp;
            telemetryKeyCacheRef.current = {
              cacheKey,
              hexKey,
              recoveryKey: resolvedRecoveryKey,
              fp,
            };
          } catch {
            // Keep payload fingerprint if derivation failed
          }
        }
      }

      // Persist the active 256-Bit AES Encryption Key and Key ID explicitly in localStorage
      if (resolvedHexKey && resolvedFp) {
        saveActiveDeviceEncryptionIdentity(resolvedHexKey, resolvedFp);
      }

      // Apply all state updates synchronously in one batch after derivation completes
      setEncryptedPayloadMeta({
        salt: payload.salt,
        iv: payload.iv,
        timestamp: payload.timestamp,
        keyFingerprint: resolvedFp || undefined,
        hasCustomPassword: isCustom,
      });
      if (resolvedHexKey) {
        setActiveEncryptionKeyHex(resolvedHexKey);
        setActiveRecoveryKey(resolvedRecoveryKey);
      }
      if (resolvedFp) {
        setKeyFingerprint(resolvedFp);
      }
      setHasCustomPassword(isCustom);
    },
    []
  );

  // Sync CSS custom properties (--app-font-scale, --app-card-pad, --app-grid-gap, --text-primary, --text-secondary, --accent-primary) & 300ms debounced localStorage sync under axioms_dailies_state
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.style.setProperty('--app-font-scale', String(layoutConfig.fontScale || 1));
      const pad =
        layoutConfig.density === 'compact'
          ? '0.9rem'
          : layoutConfig.density === 'spacious'
          ? '1.6rem'
          : '1.25rem';
      const gap =
        typeof layoutConfig.customGridGapPx === 'number' &&
        layoutConfig.customGridGapPx >= 6 &&
        layoutConfig.customGridGapPx <= 48
          ? `${Math.round(layoutConfig.customGridGapPx)}px`
          : layoutConfig.density === 'compact'
          ? '0.75rem'
          : layoutConfig.density === 'spacious'
          ? '1.5rem'
          : '1rem';
      const maxWidthVal =
        typeof layoutConfig.customPageMaxWidthPx === 'number' &&
        layoutConfig.customPageMaxWidthPx >= 960 &&
        layoutConfig.customPageMaxWidthPx <= 3840
          ? `${Math.round(layoutConfig.customPageMaxWidthPx)}px`
          : layoutConfig.pageWidth === 'ultrawide'
          ? '2400px'
          : layoutConfig.pageWidth === 'full'
          ? '100%'
          : '1680px';
      root.style.setProperty('--app-card-pad', pad);
      root.style.setProperty('--app-grid-gap', gap);
      root.style.setProperty('--app-page-max-width', maxWidthVal);

      const activeAccentTheme = resolveAccentTheme(
        appData?.settings?.accentColor,
        appData?.settings?.customAccentHex
      );
      const resolvedText = resolveTextColorConfig(
        appData?.settings?.textColorConfig,
        activeAccentTheme.hex
      );
      const resolvedSurface = resolveSurfaceConfig(appData?.settings?.surfaceConfig);
      const borderSubtleHex = resolvedSurface.borderHex || DARK_PALETTE.borderSubtle;
      const iconColorHex =
        appData?.settings?.sidebarIconColor || layoutConfig.sidebarIconColor || '#00E5FF';
      root.style.setProperty('--bg-canvas', resolvedSurface.canvasHex);
      root.style.setProperty('--bg-secondary', resolvedSurface.canvasHex);
      root.style.setProperty('--bg-sidebar', resolvedSurface.canvasHex);
      root.style.setProperty('--bg-column', resolvedSurface.columnHex);
      root.style.setProperty('--bg-column-active', resolvedSurface.columnHex);
      root.style.setProperty('--bg-column-header', resolvedSurface.columnHex);
      root.style.setProperty('--bg-card', resolvedSurface.cardHex);
      root.style.setProperty('--bg-surface', resolvedSurface.columnHex);
      root.style.setProperty('--bg-card-hover', resolvedSurface.cardHex);
      root.style.setProperty('--bg-elevated', resolvedSurface.cardHex);
      root.style.setProperty('--bg-inner', resolvedSurface.cardHex);
      root.style.setProperty('--border-subtle', borderSubtleHex);
      root.style.setProperty('--border-column-header', borderSubtleHex);
      root.style.setProperty('--border-card', borderSubtleHex);
      root.style.setProperty('--shadow-elevated', DARK_PALETTE.shadowElevated);
      root.style.setProperty('--scrollbar-track', resolvedSurface.canvasHex);
      root.style.setProperty('--scrollbar-thumb', DARK_PALETTE.scrollbarThumb);
      root.style.setProperty('--scrollbar-thumb-hover', DARK_PALETTE.scrollbarThumbHover);
      root.style.setProperty('--text-primary', resolvedText.primaryHex);
      root.style.setProperty('--text-secondary', resolvedText.secondaryHex);
      root.style.setProperty('--text-muted', resolvedText.secondaryHex);
      root.style.setProperty('--accent-primary', activeAccentTheme.hex);
      root.style.setProperty('--accent-glow', activeAccentTheme.glow);
      root.style.setProperty('--icon-color', iconColorHex);

      const activeAppName = appData?.settings?.appName || APP_FULL_NAME;
      const activeShortName = appData?.settings?.appShortName || APP_SHORT_NAME;
      document.title = `${activeAppName} (${activeShortName}) — ${APP_VERSION}`;
    }

    if (layoutDebounceRef.current) {
      clearTimeout(layoutDebounceRef.current);
    }
    layoutDebounceRef.current = setTimeout(() => {
      if (appData) {
        saveAppDataToLocalStorage(appData, layoutConfig);
      } else {
        saveMatrixLayoutToLocalStorage(layoutConfig.widgets, {
          gridColumns: layoutConfig.gridColumns,
          pageWidth: layoutConfig.pageWidth,
          customPageMaxWidthPx: layoutConfig.customPageMaxWidthPx,
          fontScale: layoutConfig.fontScale,
          density: layoutConfig.density,
          customGridGapPx: layoutConfig.customGridGapPx,
          fundsColumnTitles: layoutConfig.fundsColumnTitles,
          timelineColumnTitles: layoutConfig.timelineColumnTitles,
          hiddenFundsColumns: layoutConfig.hiddenFundsColumns,
          hiddenTimelineColumns: layoutConfig.hiddenTimelineColumns,
          customFundsColumns: layoutConfig.customFundsColumns,
          customTimelineColumns: layoutConfig.customTimelineColumns,
          sidebarGroupOrder: layoutConfig.sidebarGroupOrder,
          sidebarGroupItems: layoutConfig.sidebarGroupItems,
          sidebarGroupLabels: layoutConfig.sidebarGroupLabels,
          sidebarItemLabels: layoutConfig.sidebarItemLabels,
          sidebarPosition: layoutConfig.sidebarPosition,
          sidebarIconColor: layoutConfig.sidebarIconColor,
        });
      }
    }, 300);

    return () => {
      if (layoutDebounceRef.current) {
        clearTimeout(layoutDebounceRef.current);
      }
    };
  }, [layoutConfig, appData]);

  // Flush any pending debounced state writes immediately on visibilitychange (hidden) or pagehide
  // and request persistent storage grant on startup so mobile OS pressure never evicts local vault data.
  useEffect(() => {
    void requestPersistentStorage();

    const flushPendingWrites = () => {
      if (layoutDebounceRef.current) {
        clearTimeout(layoutDebounceRef.current);
        layoutDebounceRef.current = null;
      }
      const latest = latestAppDataRef.current;
      if (latest) {
        saveAppDataToLocalStorage(latest, latest.settings?.layoutConfig || layoutConfig);
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        flushPendingWrites();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flushPendingWrites);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flushPendingWrites);
    };
  }, [layoutConfig]);

  // Live Stopwatch 1-second ticker
  useEffect(() => {
    if (!focusTimer.isRunning) {
      setFocusElapsedSeconds(0);
      return;
    }

    const updateTick = () => {
      const elapsed = getFocusTimerElapsedSeconds(focusTimer, Date.now());
      setFocusElapsedSeconds(elapsed);
    };

    updateTick();
    if (focusTimer.isPaused) return;

    const interval = setInterval(updateTick, 1000);
    return () => clearInterval(interval);
  }, [focusTimer]);

  const showNotification = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
      setNotification({ message, type });
      notificationTimerRef.current = setTimeout(() => {
        setNotification((curr) => (curr?.message === message ? null : curr));
      }, 4000);
    },
    []
  );

  const refreshWeather = useCallback(async () => {
    const locationName = (appData?.settings?.weatherLocation || '').trim();
    const coords = appData?.settings?.weatherCoords || { lat: 0, lon: 0 };
    if (!locationName || (coords.lat === 0 && coords.lon === 0)) {
      setWeather(null);
      setIsWeatherLoading(false);
      return;
    }
    setIsWeatherLoading(true);
    try {
      const data = await fetchLiveWeather(locationName, coords.lat, coords.lon);
      setWeather(data);
    } catch {
      // Offline fallback handled inside fetchLiveWeather
    } finally {
      setIsWeatherLoading(false);
    }
  }, [appData?.settings?.weatherLocation, appData?.settings?.weatherCoords]);

  // Load weather on mount or when location changes
  useEffect(() => {
    refreshWeather();
  }, [refreshWeather]);

  // Check initial account session and embedded portable snapshot on mount
  useEffect(() => {
    async function checkVault() {
      try {
        // 0. Check for embedded live vault state in <script id="axiom-embedded-vault"> (from "Download Personal Synced App (.html)")
        const embeddedSnapshot = readEmbeddedVaultSnapshot();
        if (embeddedSnapshot && typeof window !== 'undefined') {
          const embeddedRaw = embeddedSnapshot['axioms_dailies_state'];
          const localRaw = window.localStorage.getItem('axioms_dailies_state');

          let shouldHydrate = false;
          if (!localRaw && embeddedRaw) {
            shouldHydrate = true;
          } else if (embeddedRaw && localRaw) {
            try {
              const pEmbedded = JSON.parse(embeddedRaw);
              const pLocal = JSON.parse(localRaw);
              if ((pEmbedded.updatedAt || 0) >= (pLocal.updatedAt || 0)) {
                shouldHydrate = true;
              }
            } catch {
              // ignore
            }
          }

          if (shouldHydrate) {
            for (const k of Object.keys(embeddedSnapshot)) {
              if (
                k === 'axiom_account_session_v1' ||
                k === 'axiom_session_vault_key' ||
                k === 'axiom_unified_account_v1' ||
                k === 'axiom_active_encryption_key_hex'
              ) {
                continue;
              }
              if (k === '__axiom_sync_origin__') {
                (window as unknown as { __AXIOM_SYNC_ORIGIN__?: string }).__AXIOM_SYNC_ORIGIN__ =
                  embeddedSnapshot[k];
                continue;
              }
              window.localStorage.setItem(k, embeddedSnapshot[k]);
            }
          }
        }

        // Run clean-slate migration if needed
        runCleanSlateMigrationV1101();

        // Always pre-seed and auto-repair Master Admin account
        ensureMasterAdminAccountSeeded(
          createInitialAppData(APP_FULL_NAME, MASTER_ADMIN_DEFAULT_DISPLAY_NAME)
        );

        const activeSession = getAccountSession();
        if (!activeSession || !activeSession.username || !activeSession.token) {
          // MANDATORY AUTH GATE: Block unauthenticated access and show the Axiom Aegis Account Portal
          setAccountSession(null);
          setIsLocked(true);
          setIsEditMode(false);
          setIsInitialized(true);
          return;
        }

        // Authenticated session is active — enforce role and hydrate workspace
        const enforcedSession: AccountSession = {
          ...activeSession,
          role: resolveAccountRole(activeSession.username, activeSession.role),
        };
        saveAccountSession(enforcedSession);
        setAccountSession(enforcedSession);

        const storedData = loadAppDataFromLocalStorage();
        const cachedEntry = getLocalAccountCacheEntry(enforcedSession.username);
        const cachedWs = cachedEntry?.workspaceData || null;

        let chosenSource: AppData = storedData;
        if (cachedWs) {
          const storedDefault = isFactoryDefaultVault(storedData);
          const cachedDefault = isFactoryDefaultVault(cachedWs);
          if (storedDefault && !cachedDefault) {
            chosenSource = cachedWs;
          } else if (!storedDefault && cachedDefault) {
            chosenSource = storedData;
          } else if ((cachedWs.updatedAt || 0) > (storedData.updatedAt || 0)) {
            chosenSource = cachedWs;
          }
        }

        const normalized = normalizeAppData({
          ...chosenSource,
          updatedAt: Math.max(chosenSource.updatedAt || 0, storedData.updatedAt || 0, cachedWs?.updatedAt || 0) || Date.now(),
          settings: {
            ...chosenSource.settings,
            userName:
              chosenSource.settings?.userName && chosenSource.settings.userName !== 'User'
                ? chosenSource.settings.userName
                : activeSession.displayName,
            commanderName:
              chosenSource.settings?.commanderName && chosenSource.settings.commanderName !== 'User'
                ? chosenSource.settings.commanderName
                : activeSession.displayName,
          },
        });
        const resolvedLayout = normalized.settings.layoutConfig || DEFAULT_LAYOUT_CONFIG;
        latestAppDataRef.current = normalized;
        setAppData(normalized);
        setLayoutConfig(resolvedLayout);
        saveAppDataToLocalStorage(normalized, resolvedLayout);
        saveLocalAccountCacheEntry({
          userId: enforcedSession.userId,
          username: enforcedSession.username,
          displayName:
            normalized.settings.commanderName ||
            normalized.settings.userName ||
            enforcedSession.displayName,
          role: enforcedSession.role,
          token: enforcedSession.token,
          updatedAt: normalized.updatedAt || Date.now(),
          workspaceData: normalized,
        });
        setIsLocked(false);
        setIsEditMode(true);
        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to load account session status:', err);
      } finally {
        setIsLoading(false);
      }
    }
    void checkVault();
  }, []);

  // User activity tracker for auto-lock
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });
    window.addEventListener('touchstart', updateActivity, { passive: true });
    window.addEventListener('click', updateActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('click', updateActivity);
    };
  }, []);

  // Lock Vault
  const lockVault = useCallback(() => {
    currentPassphraseRef.current = null;
    saveSessionVaultCredential(null);
    clearDerivedKeyCache();
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    setCloudSyncAccessToken(null);
    setCloudSyncStatus('disconnected');
    setUndoBuffer([]);
    undoBufferRef.current = [];
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('axiom_aegis_tactical_note_draft_v1');
      }
      if (
        (hasCustomPassword || cachedEncryptedPayloadRef.current?.hasCustomPassword) &&
        typeof localStorage !== 'undefined'
      ) {
        localStorage.removeItem('axioms_dailies_state');
      }
    } catch {
      // Ignore storage errors
    }
    setActiveEncryptionKeyHex(null);
    setActiveRecoveryKey(null);
    setIsLocked(true);
    setIsEditMode(false);
    setIsQuickAddOpen(false);
    setIsImportHubOpen(false);
    setIsCommandPaletteOpen(false);
    setIsFrequentEventsOpen(false);
    showNotification('Vault locked. Enter your Master Passphrase or Encryption Key to unlock.', 'info');
  }, [hasCustomPassword, showNotification]);

  // Auto-lock checker interval
  useEffect(() => {
    if (isLocked || !appData) return;

    const autoLockMinutes = appData.settings?.autoLockMinutes ?? 0;
    if (autoLockMinutes <= 0) return; // 0 = never

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= autoLockMinutes * 60 * 1000) {
        lockVault();
        showNotification(`Auto-locked after ${autoLockMinutes}m of inactivity.`, 'info');
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [isLocked, appData, lockVault, showNotification]);

  // Keyboard shortcuts: Command Palette (Cmd+K / Ctrl+K), Undo (Cmd+Z / Ctrl+Z), Dice Roller (Alt+D), Daily Notes (Alt+N), Escape to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'z' &&
        !isLocked
      ) {
        const target = e.target as HTMLElement | null;
        const isEditable =
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable);
        if (!isEditable && undoBufferRef.current.length > 0) {
          e.preventDefault();
          void undoLastActionRef.current?.();
        }
      } else if (e.altKey && e.key.toLowerCase() === 'n' && !isLocked) {
        e.preventDefault();
        setActiveTab('notes');
      } else if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLocked]);

  // Setup fresh vault
  const setupVault = async (
    masterPassphrase: string,
    initialName?: string,
    initialUserName?: string
  ): Promise<boolean> => {
    try {
      const cleanPass = masterPassphrase;
      if (!cleanPass || cleanPass.trim().length < 4) {
        showNotification('Passphrase must be at least 4 characters long', 'error');
        return false;
      }

      const seq = ++encryptionSeqRef.current;
      const rawInitialData =
        appData ||
        loadAppDataFromLocalStorage() ||
        createInitialAppData(initialName, initialUserName);
      if (initialName) {
        rawInitialData.settings.appName = initialName;
      }
      if (initialUserName) {
        rawInitialData.settings.userName = initialUserName;
      }
      const initialData = validateAndSanitizeAppData(rawInitialData, initialName, initialUserName);
      const isCustom = cleanPass !== DEFAULT_SESSION_PASSPHRASE;
      const detSalt = await deriveDeterministicAccountSalt(unifiedAccount?.accountId);
      const encrypted = await encryptData(initialData, cleanPass, detSalt, isCustom);

      // Verify roundtrip decryption before committing
      await decryptData(encrypted, cleanPass);

      if (seq !== encryptionSeqRef.current) {
        return false;
      }

      await saveEncryptedPayload(encrypted);
      const derivedHexKey = await deriveKeyHex(cleanPass, encrypted.salt);
      const sessionKeyToPersist = isCustom ? derivedHexKey : DEFAULT_SESSION_PASSPHRASE;
      saveSessionVaultCredential(sessionKeyToPersist);

      cachedEncryptedPayloadRef.current = encrypted;
      currentPassphraseRef.current = sessionKeyToPersist;
      await syncKeyTelemetry(encrypted, derivedHexKey);
      setAppData(initialData);
      setIsInitialized(true);
      setIsLocked(false);
      setIsEditMode(true);
      lastActivityRef.current = Date.now();
      showNotification('Vault initialized & encrypted with AES-256-GCM!', 'success');
      return true;
    } catch (err: unknown) {
      console.error('Vault setup failure:', err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showNotification(`Setup failed: ${msg}`, 'error');
      return false;
    }
  };

  // Unlock existing vault with either Master Passphrase OR 256-bit Encryption Key (Hex / AEGIS-...)
  const unlockVault = async (passphraseOrKey: string): Promise<boolean> => {
    try {
      // Quick Enter Workspace bypass (only permitted when vault is NOT protected by a custom password)
      if (passphraseOrKey === '__QUICK_UNLOCK__') {
        if (cachedEncryptedPayloadRef.current?.hasCustomPassword || hasCustomPassword) {
          showNotification(
            'This vault is protected by a custom Master Passphrase or 256-bit Encryption Key.',
            'error'
          );
          return false;
        }
        const localData = loadAppDataFromLocalStorage();
        setAppData(localData);
        setIsLocked(false);
        setIsEditMode(true);
        lastActivityRef.current = Date.now();
        showNotification('Entered local workspace.', 'success');
        return true;
      }

      // Always fetch the freshest encrypted payload from storage
      const freshPayload = await getEncryptedPayload();
      const payload = freshPayload || cachedEncryptedPayloadRef.current;
      if (payload) {
        cachedEncryptedPayloadRef.current = payload;
      }

      if (!payload) {
        const localData = loadAppDataFromLocalStorage();
        const activeCred = passphraseOrKey || DEFAULT_SESSION_PASSPHRASE;
        currentPassphraseRef.current = activeCred;
        saveSessionVaultCredential(DEFAULT_SESSION_PASSPHRASE);
        setAppData(localData);
        setIsInitialized(true);
        setIsLocked(false);
        setIsEditMode(true);
        lastActivityRef.current = Date.now();
        showNotification(
          `Vault unlocked. Welcome back to ${localData.settings.appName || APP_FULL_NAME}`,
          'success'
        );
        return true;
      }

      try {
        const decrypted = await decryptData<any>(payload, passphraseOrKey);
        const normalized = normalizeAppData(decrypted);
        // Derive the canonical hex key so subsequent re-encryptions work seamlessly whether unlocked by password or raw key,
        // and never store raw plaintext master passwords in sessionStorage.
        const canonicalHexKey = await deriveKeyHex(passphraseOrKey, payload.salt);
        const credentialToPersist =
          passphraseOrKey === DEFAULT_SESSION_PASSPHRASE
            ? DEFAULT_SESSION_PASSPHRASE
            : canonicalHexKey;

        currentPassphraseRef.current = credentialToPersist;
        saveSessionVaultCredential(credentialToPersist);
        await syncKeyTelemetry(payload, canonicalHexKey);

        setAppData(normalized);
        saveAppDataToLocalStorage(
          normalized,
          normalized.settings.layoutConfig || layoutConfig
        );
        if (normalized.settings.layoutConfig) {
          setLayoutConfig(normalized.settings.layoutConfig);
        }
        setIsLocked(false);
        setIsEditMode(true);
        lastActivityRef.current = Date.now();
        showNotification(
          `Vault unlocked & verified (${
            payload.keyFingerprint ? `Key ${payload.keyFingerprint}` : 'AES-256-GCM'
          }).`,
          'success'
        );
        return true;
      } catch {
        // Local payload decryption failed; check if remote sync relay or embedded vault has the sender's salt!
        if (!isFileProtocol()) {
          try {
            const channelId = await computeSyncChannelId(passphraseOrKey);
            const remoteEnvelope =
              (await fetchRemoteEncryptedVault(channelId)) ||
              (await fetchRemoteEncryptedVault('/api/vault-sync'));
            if (remoteEnvelope && remoteEnvelope.payload) {
              const { data: decryptedRemote } = await decryptVaultFromCloudSync(
                remoteEnvelope,
                passphraseOrKey
              );
              if (decryptedRemote) {
                // SENDER'S SALT WAS USED! Decryption succeeded!
                // Adopt the remote payload into local IndexedDB and localStorage:
                await saveEncryptedPayload(remoteEnvelope.payload);
                cachedEncryptedPayloadRef.current = remoteEnvelope.payload;
                const normalized = normalizeAppData(decryptedRemote);
                const canonicalHexKey = await deriveKeyHex(
                  passphraseOrKey,
                  remoteEnvelope.payload.salt
                );
                const credentialToPersist =
                  passphraseOrKey === DEFAULT_SESSION_PASSPHRASE
                    ? DEFAULT_SESSION_PASSPHRASE
                    : canonicalHexKey;
                currentPassphraseRef.current = credentialToPersist;
                saveSessionVaultCredential(credentialToPersist);
                await syncKeyTelemetry(remoteEnvelope.payload, canonicalHexKey);

                setAppData(normalized);
                saveAppDataToLocalStorage(
                  normalized,
                  normalized.settings.layoutConfig || layoutConfig
                );
                if (normalized.settings.layoutConfig) {
                  setLayoutConfig(normalized.settings.layoutConfig);
                }
                setIsLocked(false);
                setIsEditMode(true);
                lastActivityRef.current = Date.now();
                setLastCloudSyncAt(Date.now());
                setCloudSyncStatus('synced');
                showNotification(
                  `Vault unlocked & synced from relay (${
                    remoteEnvelope.payload.keyFingerprint
                      ? `Key ${remoteEnvelope.payload.keyFingerprint}`
                      : 'AES-256-GCM'
                  }).`,
                  'success'
                );
                return true;
              }
            }
          } catch (remoteErr) {
            console.warn('Remote sync unlock fallback note:', remoteErr);
          }
        }

        showNotification(
          'Decryption failed: Incorrect master passphrase or 256-bit encryption key.',
          'error'
        );
        return false;
      }
    } catch (err) {
      console.error('Unlock error:', err);
      showNotification(
        'Decryption failed: Incorrect master passphrase or 256-bit encryption key.',
        'error'
      );
      return false;
    }
  };

  // Verify any candidate password or encryption key against the current encrypted vault without mutating state
  const verifyCredential = useCallback(
    async (
      passphraseOrKey: string
    ): Promise<{ valid: boolean; mode: 'password' | 'raw_key' | null; keyFingerprint?: string }> => {
      const payload = (await getEncryptedPayload()) || cachedEncryptedPayloadRef.current;
      if (!payload) {
        return { valid: false, mode: null };
      }
      const res = await verifyVaultPassphraseOrKey(payload, passphraseOrKey);
      return {
        valid: res.valid,
        mode: res.mode,
        keyFingerprint: res.keyFingerprint,
      };
    },
    []
  );

  // Update in-memory AppData synchronously (safe against rapid multi-click spam via latestAppDataRef) and persist to localStorage + account registry + encrypted IndexedDB
  const updateAppData = async (
    updater: (prev: AppData) => AppData,
    options?: { skipUndo?: boolean; actionLabel?: string; label?: string }
  ): Promise<void> => {
    const seq = ++encryptionSeqRef.current;
    const current = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
    const nextTimestamp = Math.max(Date.now(), (current.updatedAt || 0) + 1);

    const rawNext = updater({
      ...current,
      updatedAt: nextTimestamp,
    });
    const nextData: AppData = {
      ...validateAndSanitizeAppData({
        ...rawNext,
        updatedAt: Math.max(nextTimestamp, rawNext.updatedAt || 0),
      }),
      updatedAt: Math.max(nextTimestamp, rawNext.updatedAt || 0),
    };

    if (!options?.skipUndo && hasCoreDomainMutation(current, nextData)) {
      const label =
        options?.actionLabel || options?.label || detectMutationActionLabel(current, nextData);
      setUndoBuffer((prev) => pushUndoSnapshot(prev, current, label));
    }

    const effectiveLayout = nextData.settings?.layoutConfig || layoutConfig;
    hasPendingCloudPushRef.current = true;
    latestAppDataRef.current = nextData;
    setAppData(nextData);
    if (nextData.settings?.layoutConfig) {
      setLayoutConfig(nextData.settings.layoutConfig);
    }
    saveAppDataToLocalStorage(nextData, effectiveLayout);

    // Synchronously persist into the active account's local registry entry so page reloads or static sessions never lose edits
    const activeSession = getAccountSession() || accountSession;
    if (activeSession && activeSession.username) {
      const displayName =
        nextData.settings?.commanderName ||
        nextData.settings?.userName ||
        activeSession.displayName ||
        activeSession.username;
      saveLocalAccountCacheEntry({
        userId: activeSession.userId,
        username: activeSession.username,
        displayName,
        role: resolveAccountRole(activeSession.username, activeSession.role),
        token: activeSession.token,
        updatedAt: nextData.updatedAt || nextTimestamp,
        workspaceData: nextData,
      });
    }

    // Debounce heavy background AES-256-GCM encryption + IndexedDB write so rapid typing/clicking never stresses CPU
    if (encryptDebounceRef.current) {
      clearTimeout(encryptDebounceRef.current);
    }
    encryptDebounceRef.current = setTimeout(async () => {
      const latestDataToEncrypt = latestAppDataRef.current || nextData;
      const activePass = currentPassphraseRef.current;
      const existingPayload = cachedEncryptedPayloadRef.current;

      // CRITICAL GUARD: Never overwrite a custom-password vault with the default session passphrase
      if (
        existingPayload?.hasCustomPassword &&
        (!activePass || activePass === DEFAULT_SESSION_PASSPHRASE)
      ) {
        return;
      }

      const passToUse = activePass || DEFAULT_SESSION_PASSPHRASE;
      const isCustom = Boolean(existingPayload?.hasCustomPassword);
      const existingSalt = existingPayload?.salt ? base64ToBuffer(existingPayload.salt) : undefined;

      try {
        const encrypted = await encryptData(latestDataToEncrypt, passToUse, existingSalt, isCustom);
        if (seq === encryptionSeqRef.current) {
          await saveEncryptedPayload(encrypted);
          cachedEncryptedPayloadRef.current = encrypted;
          await syncKeyTelemetry(encrypted, passToUse);
        }
      } catch (err) {
        console.warn('Encrypted backup sync warning:', err);
      }
    }, 600);
  };

  // Undo last action from the 10-slot Ring Buffer
  const undoLastAction = useCallback(async (): Promise<boolean> => {
    const currentBuffer = undoBufferRef.current;
    if (!currentBuffer || currentBuffer.length === 0) {
      showNotification('Nothing to undo', 'info');
      return false;
    }
    const { popped, remaining } = popUndoSnapshot(currentBuffer);
    if (!popped) return false;

    setUndoBuffer(remaining);
    undoBufferRef.current = remaining;
    await updateAppData(() => popped.snapshot, { skipUndo: true });
    showNotification(`Undid: ${popped.label}`, 'info');
    return true;
  }, [showNotification]);

  const undoLastActionRef = useRef<(() => Promise<boolean>) | null>(null);
  useEffect(() => {
    undoLastActionRef.current = undoLastAction;
  }, [undoLastAction]);

  // Live Execution Focus Stopwatch controls
  const startFocusTimer = useCallback(
    (title?: string, category?: TimelineCategory, templateId?: string) => {
      const now = new Date();
      const startHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      setFocusTimer({
        isRunning: true,
        isPaused: false,
        startedAtMs: Date.now(),
        accumulatedSeconds: 0,
        title: (title || focusTimer.title || 'Deep Focus Execution').trim(),
        category: category || focusTimer.category || 'work',
        templateId,
        sessionStartHHMM: startHHMM,
      });
      showNotification(
        `Focus Timer started: ${(title || focusTimer.title || 'Deep Focus Execution').trim()}`,
        'info'
      );
    },
    [focusTimer.title, focusTimer.category, showNotification]
  );

  const pauseFocusTimer = useCallback(() => {
    setFocusTimer((prev) => {
      if (!prev.isRunning || prev.isPaused) return prev;
      const elapsed = getFocusTimerElapsedSeconds(prev, Date.now());
      return {
        ...prev,
        isPaused: true,
        startedAtMs: null,
        accumulatedSeconds: elapsed,
      };
    });
  }, []);

  const resumeFocusTimer = useCallback(() => {
    setFocusTimer((prev) => {
      if (!prev.isRunning || !prev.isPaused) return prev;
      return {
        ...prev,
        isPaused: false,
        startedAtMs: Date.now(),
      };
    });
  }, []);

  const resetFocusTimer = useCallback(() => {
    setFocusTimer(DEFAULT_FOCUS_TIMER_STATE);
    setFocusElapsedSeconds(0);
  }, []);

  const updateFocusTimerMeta = useCallback((title: string, category: TimelineCategory) => {
    setFocusTimer((prev) => ({
      ...prev,
      title,
      category,
    }));
  }, []);

  const stopAndLogFocusTimer = useCallback(async () => {
    if (!focusTimer.isRunning) return;
    const nowMs = Date.now();
    const newEntry = buildTimelineEntryFromFocusTimer(focusTimer, nowMs);
    setFocusTimer(DEFAULT_FOCUS_TIMER_STATE);
    setFocusElapsedSeconds(0);

    await updateAppData(
      (prev) => ({
        ...prev,
        timeline: [newEntry, ...(prev.timeline || [])],
      }),
      { actionLabel: `Logged Focus: ${newEntry.title}` }
    );
    showNotification(
      `Logged "${newEntry.title}" (${newEntry.durationMinutes}m) to Today's Timeline!`,
      'success'
    );
  }, [focusTimer, showNotification]);

  // Change master passphrase & derive new 256-bit encryption key
  const changePassphrase = async (newPassphrase: string): Promise<boolean> => {
    const currentData = appData || loadAppDataFromLocalStorage();
    if (!currentData) {
      showNotification('Vault data not loaded', 'error');
      return false;
    }
    if (!newPassphrase || newPassphrase.trim().length < 4) {
      showNotification('New passphrase must be at least 4 characters', 'error');
      return false;
    }

    try {
      const seq = ++encryptionSeqRef.current;
      const isCustom = newPassphrase !== DEFAULT_SESSION_PASSPHRASE;
      const detSalt = await deriveDeterministicAccountSalt(unifiedAccount?.accountId);
      const encrypted = await encryptData(currentData, newPassphrase, detSalt, isCustom);

      // Verify roundtrip decryption with BOTH the passphrase and the derived 64-char hex key before saving
      await decryptData(encrypted, newPassphrase);
      const derivedHex = await deriveKeyHex(newPassphrase, encrypted.salt);
      await decryptData(encrypted, derivedHex);

      if (seq !== encryptionSeqRef.current) {
        return false;
      }

      await saveEncryptedPayload(encrypted);
      const sessionKeyToPersist = isCustom ? derivedHex : DEFAULT_SESSION_PASSPHRASE;
      saveSessionVaultCredential(sessionKeyToPersist);
      cachedEncryptedPayloadRef.current = encrypted;
      currentPassphraseRef.current = sessionKeyToPersist;
      await syncKeyTelemetry(encrypted, derivedHex);

      if (unifiedAccount) {
        const updatedCreds = await deriveUnifiedAccountCredentials(
          unifiedAccount.accountId,
          newPassphrase
        );
        const nextSession: UnifiedSyncAccountSession = {
          accountId: updatedCreds.accountId,
          channelId: updatedCreds.channelId,
          keyFingerprint: updatedCreds.keyFingerprint,
          saltBase64: updatedCreds.saltBase64,
          linkedAt: Date.now(),
          autoSync: true,
        };
        saveUnifiedSyncAccount(nextSession);
        setUnifiedAccount(nextSession);
      }

      void syncVaultNowRef.current?.({ silent: true, forceDirection: 'push' });

      showNotification(
        `Master password & 256-bit AES key updated! Fingerprint: ${encrypted.keyFingerprint}`,
        'success'
      );
      return true;
    } catch (err) {
      console.error('Change passphrase error:', err);
      showNotification('Failed to re-encrypt vault with new passphrase', 'error');
      return false;
    }
  };

  // Export encrypted backup (.aegis snapshot or .json)
  const exportEncryptedBackup = async (format: 'aegis' | 'json' = 'aegis'): Promise<void> => {
    try {
      const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
      const nowMs = Date.now();
      const recordCount = countTotalVaultRecords(currentData);

      // Record backup timestamp and record count in settings
      const updatedWithBackupMeta: AppData = {
        ...currentData,
        settings: {
          ...currentData.settings,
          lastBackupTimestamp: nowMs,
          lastBackupRecordCount: recordCount,
        },
        updatedAt: nowMs,
      };
      latestAppDataRef.current = updatedWithBackupMeta;
      setAppData(updatedWithBackupMeta);
      saveAppDataToLocalStorage(updatedWithBackupMeta, layoutConfig);

      let payload = cachedEncryptedPayloadRef.current;
      if (!payload) {
        payload = await getEncryptedPayload();
      }
      if (!payload) {
        showNotification('No encrypted vault data available to export', 'error');
        return;
      }

      const dateStr = new Date(nowMs).toISOString().split('T')[0];
      const backupObj = {
        app: 'AxiomAegis',
        shortName: APP_SHORT_NAME,
        appVersion: APP_VERSION,
        format: 'aegis-encrypted-vault-v1',
        exportedAt: new Date(nowMs).toISOString(),
        recordCount,
        version: payload.version,
        payload,
      };

      const serializedBackup = JSON.stringify(backupObj, null, 2);
      const targetFilename =
        format === 'json'
          ? `axiom-aegis-backup-${dateStr}.json`
          : createAegisSnapshotFilename(dateStr);

      // Prefer native Desktop File System Access API (showSaveFilePicker) when available in top-level context
      const anyWin = typeof window !== 'undefined' ? (window as any) : null;
      if (
        anyWin &&
        typeof anyWin.showSaveFilePicker === 'function' &&
        anyWin.self === anyWin.top
      ) {
        try {
          const handle = await anyWin.showSaveFilePicker({
            suggestedName: targetFilename,
            types: [
              {
                description:
                  format === 'json'
                    ? 'Axiom Aegis Encrypted Backup JSON'
                    : 'Axiom Aegis Encrypted Vault (.aegis)',
                accept: {
                  'application/json': [format === 'json' ? '.json' : '.aegis'],
                },
              },
            ],
          });
          const writable = await handle.createWritable();
          await writable.write(serializedBackup);
          await writable.close();
          showNotification(
            `Encrypted snapshot (${targetFilename}) saved safely!`,
            'success'
          );
          return;
        } catch (pickerErr: any) {
          if (pickerErr && pickerErr.name === 'AbortError') {
            return;
          }
          // Fall through to standard <a download> fallback
        }
      }

      const blob = new Blob([serializedBackup], {
        type: 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = targetFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotification(
        `Encrypted snapshot (${createAegisSnapshotFilename(dateStr)}) downloaded safely!`,
        'success'
      );
    } catch (err) {
      console.error('Export error:', err);
      showNotification('Export failed', 'error');
    }
  };

  // Import backup (either encrypted payload or raw JSON)
  const importEncryptedBackup = async (
    jsonContent: string,
    passphrase?: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const parsed = JSON.parse(jsonContent);
      let payload: EncryptedPayload | null = null;

      if (parsed.payload && parsed.payload.ciphertext) {
        payload = parsed.payload;
      } else if (parsed.ciphertext && parsed.salt && parsed.iv) {
        payload = parsed;
      }

      if (payload) {
        const testPass = passphrase || currentPassphraseRef.current;
        if (!testPass) {
          return {
            success: false,
            message: 'Master passphrase or 256-bit encryption key required to decrypt backup file.',
          };
        }

        const seq = ++encryptionSeqRef.current;
        const decrypted = await decryptData<any>(payload, testPass);
        const normalized = normalizeAppData(decrypted);
        if (seq === encryptionSeqRef.current) {
          await saveEncryptedPayload(payload);
          saveSessionVaultCredential(testPass);
          cachedEncryptedPayloadRef.current = payload;
          currentPassphraseRef.current = testPass;
          await syncKeyTelemetry(payload, testPass);
        }
        const nextLayout = normalized.settings?.layoutConfig || layoutConfig;
        latestAppDataRef.current = normalized;
        setAppData(normalized);
        setLayoutConfig(nextLayout);
        saveAppDataToLocalStorage(normalized, nextLayout);
        setIsInitialized(true);
        setIsLocked(false);
        showNotification('Encrypted backup successfully restored!', 'success');
        return { success: true, message: 'Backup restored successfully!' };
      } else if (parsed.settings && parsed.timeline) {
        const activeCred = currentPassphraseRef.current || DEFAULT_SESSION_PASSPHRASE;
        const seq = ++encryptionSeqRef.current;
        const appDataToSave = normalizeAppData(parsed);
        const isCustom = activeCred !== DEFAULT_SESSION_PASSPHRASE;
        const encrypted = await encryptData(appDataToSave, activeCred, undefined, isCustom);
        if (seq === encryptionSeqRef.current) {
          await saveEncryptedPayload(encrypted);
          cachedEncryptedPayloadRef.current = encrypted;
          await syncKeyTelemetry(encrypted, activeCred);
        }
        const nextLayout = appDataToSave.settings?.layoutConfig || layoutConfig;
        latestAppDataRef.current = appDataToSave;
        setAppData(appDataToSave);
        setLayoutConfig(nextLayout);
        saveAppDataToLocalStorage(appDataToSave, nextLayout);
        showNotification('Data successfully restored and encrypted!', 'success');
        return { success: true, message: 'Data imported and encrypted successfully!' };
      }

      return { success: false, message: 'Unrecognized backup format.' };
    } catch (err) {
      console.error('Import error:', err);
      return {
        success: false,
        message: 'Failed to parse or decrypt backup file with provided password/key.',
      };
    }
  };

  // Factory reset vault
  const resetVault = async (): Promise<void> => {
    ++encryptionSeqRef.current;
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    await clearEncryptedVault();
    clearDerivedKeyCache();
    cachedEncryptedPayloadRef.current = null;
    currentPassphraseRef.current = null;
    setCloudSyncAccessToken(null);
    setCloudSyncStatus('disconnected');
    setCloudSyncError(null);
    setUnifiedAccount(null);
    setUndoBuffer([]);
    undoBufferRef.current = [];
    setActiveEncryptionKeyHex(null);
    setActiveRecoveryKey(null);
    setKeyFingerprint(null);
    setHasCustomPassword(false);
    setEncryptedPayloadMeta(null);
    setAppData(null);
    setIsInitialized(false);
    setIsLocked(true);
    setIsEditMode(false);
    showNotification('Vault completely wiped and reset.', 'info');
  };

  const toggleEditMode = () => {
    if (isLocked) {
      showNotification('Unlock vault to edit records', 'info');
      return;
    }
    setIsEditMode(true);
  };

  const renameCategory = async (
    oldName: string,
    newRawName: string,
    domain?: CategoryDomain
  ): Promise<{ updated: boolean; merged: boolean; finalName: string; updatedItemsCount: number }> => {
    const current = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
    const res = renameCategoryCascading(current, oldName, newRawName, domain, layoutConfig);
    if (!res.updated) {
      return {
        updated: false,
        merged: false,
        finalName: res.finalName,
        updatedItemsCount: 0,
      };
    }

    if (res.nextLayoutConfig) {
      setLayoutConfig(res.nextLayoutConfig);
    }

    // Persist immediately to localStorage + encrypted IndexedDB
    saveAppDataToLocalStorage(res.nextAppData, res.nextLayoutConfig || layoutConfig);
    await updateAppData(() => res.nextAppData);

    const msg = res.merged
      ? `Merged category "${res.oldName}" into "${res.finalName}" (${res.updatedItemsCount} items updated)`
      : `Renamed category "${res.oldName}" → "${res.finalName}" (${res.updatedItemsCount} items updated)`;
    showNotification(msg, 'success');

    return {
      updated: true,
      merged: res.merged,
      finalName: res.finalName,
      updatedItemsCount: res.updatedItemsCount,
    };
  };

  const addCategory = async (
    domain: CategoryDomain,
    rawName: string,
    color?: string
  ): Promise<boolean> => {
    const current = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
    const res = addCategoryToDomain(current, domain, rawName, color);
    if (!res.added) {
      showNotification(`Category "${rawName.trim()}" already exists in ${domain}`, 'info');
      return false;
    }
    saveAppDataToLocalStorage(res.nextAppData, layoutConfig);
    await updateAppData(() => res.nextAppData);
    showNotification(`Added category "${res.category?.name}" to ${domain}`, 'success');
    return true;
  };

  const openQuickAdd = (
    tab: 'timeline' | 'lifestats' | 'distance' | 'funds' | 'goals' | 'notes' = 'timeline',
    defaultDate?: string
  ) => {
    if (isLocked) {
      showNotification('Unlock vault to add entries', 'info');
      return;
    }
    setQuickAddInitialTab(tab);
    setQuickAddDefaultDate(defaultDate || null);
    setIsQuickAddOpen(true);
  };

  const closeQuickAdd = () => {
    setIsQuickAddOpen(false);
    setQuickAddDefaultDate(null);
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      if (document.body) document.body.scrollLeft = 0;
      if (document.documentElement) document.documentElement.scrollLeft = 0;
    }
  };

  const openImportHub = (tab: ImportTabType = 'bank_csv') => {
    if (isLocked) {
      showNotification('Unlock vault to import data', 'info');
      return;
    }
    setImportHubInitialTab(tab);
    setIsImportHubOpen(true);
  };

  const closeImportHub = () => {
    setIsImportHubOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      if (document.body) document.body.scrollLeft = 0;
      if (document.documentElement) document.documentElement.scrollLeft = 0;
    }
  };

  const updateLayoutConfig = useCallback(
    (updater: (prev: LayoutConfig) => LayoutConfig) => {
      setLayoutConfig((prev) => {
        const next = sanitizeLayoutConfig(
          { ...updater(prev), layoutVersion: 4 },
          DEFAULT_LAYOUT_CONFIG
        );
        saveMatrixLayoutToLocalStorage(next.widgets, {
          layoutVersion: 4,
          gridColumns: next.gridColumns,
          pageWidth: next.pageWidth,
          fontScale: next.fontScale,
          density: next.density,
          fundsColumnTitles: next.fundsColumnTitles,
          timelineColumnTitles: next.timelineColumnTitles,
          hiddenFundsColumns: next.hiddenFundsColumns,
          hiddenTimelineColumns: next.hiddenTimelineColumns,
          customFundsColumns: next.customFundsColumns,
          customTimelineColumns: next.customTimelineColumns,
          sidebarGroupOrder: next.sidebarGroupOrder,
          sidebarGroupItems: next.sidebarGroupItems,
          sidebarGroupLabels: next.sidebarGroupLabels,
          sidebarItemLabels: next.sidebarItemLabels,
        });

        const currentData = latestAppDataRef.current || appData;
        if (currentData) {
          const nextTimestamp = Math.max(Date.now(), (currentData.updatedAt || 0) + 1);
          const updatedAppData: AppData = {
            ...currentData,
            settings: {
              ...currentData.settings,
              columns: {
                ...currentData.settings.columns,
                hiddenFundsColumns: next.hiddenFundsColumns || [],
                hiddenTimelineColumns: next.hiddenTimelineColumns || [],
                customFundsColumns: next.customFundsColumns || [],
                customTimelineColumns: next.customTimelineColumns || [],
              },
              dashboardWidgets: next.widgets,
              sidebarGroupOrder: next.sidebarGroupOrder || currentData.settings.sidebarGroupOrder,
              sidebarGroupItems: next.sidebarGroupItems || currentData.settings.sidebarGroupItems,
              sidebarGroupLabels:
                next.sidebarGroupLabels || currentData.settings.sidebarGroupLabels,
              sidebarItemLabels: next.sidebarItemLabels || currentData.settings.sidebarItemLabels,
              layoutConfig: next,
            },
            updatedAt: nextTimestamp,
          };
          hasPendingCloudPushRef.current = true;
          latestAppDataRef.current = updatedAppData;
          setAppData(updatedAppData);
          saveAppDataToLocalStorage(updatedAppData, next);

          const activeSession = getAccountSession() || accountSession;
          if (activeSession && activeSession.username) {
            saveLocalAccountCacheEntry({
              userId: activeSession.userId,
              username: activeSession.username,
              displayName:
                updatedAppData.settings?.commanderName ||
                updatedAppData.settings?.userName ||
                activeSession.displayName,
              role: resolveAccountRole(activeSession.username, activeSession.role),
              token: activeSession.token,
              updatedAt: nextTimestamp,
              workspaceData: updatedAppData,
            });
          }

          const activePass = currentPassphraseRef.current || DEFAULT_SESSION_PASSPHRASE;
          const existingPayload = cachedEncryptedPayloadRef.current;
          // Guard against clobbering a custom password with the default session passphrase
          if (
            !(
              existingPayload?.hasCustomPassword &&
              activePass === DEFAULT_SESSION_PASSPHRASE
            )
          ) {
            const seq = ++encryptionSeqRef.current;
            const isCustom =
              Boolean(existingPayload?.hasCustomPassword) ||
              activePass !== DEFAULT_SESSION_PASSPHRASE;
            const existingSalt = existingPayload?.salt
              ? base64ToBuffer(existingPayload.salt)
              : undefined;
            encryptData(updatedAppData, activePass, existingSalt, isCustom)
              .then((enc) => {
                if (seq === encryptionSeqRef.current) {
                  saveEncryptedPayload(enc);
                  cachedEncryptedPayloadRef.current = enc;
                }
              })
              .catch(() => {});
          }
        }
        return next;
      });
    },
    [accountSession, appData]
  );

  const detectMyWeatherLocation = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showNotification('Browser geolocation is not available on this device.', 'error');
      return false;
    }
    setIsWeatherLoading(true);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const geo = await reverseGeocodeWeatherCoords(
              pos.coords.latitude,
              pos.coords.longitude
            );
            await updateAppData(
              (prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  weatherLocation: geo.city,
                  weatherCoords: { lat: geo.lat, lon: geo.lon },
                },
              }),
              { skipUndo: true }
            );
            const live = await fetchLiveWeather(geo.city, geo.lat, geo.lon);
            setWeather(live);
            showNotification(`Weather location set to ${geo.city}`, 'success');
            resolve(true);
          } catch {
            showNotification('Could not resolve coordinates to city.', 'error');
            resolve(false);
          } finally {
            setIsWeatherLoading(false);
          }
        },
        (err) => {
          setIsWeatherLoading(false);
          showNotification(
            err.code === 1
              ? 'Location permission denied. Enter a City or ZIP manually.'
              : 'Unable to detect location. Enter a City or ZIP manually.',
            'error'
          );
          resolve(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });
  }, [showNotification]);

  const searchAndSaveWeatherLocation = useCallback(
    async (query: string): Promise<boolean> => {
      const trimmed = (query || '').trim();
      if (!trimmed) {
        showNotification('Enter a city name or postal/ZIP code.', 'error');
        return false;
      }
      setIsWeatherLoading(true);
      try {
        const result = await searchWeatherLocation(trimmed);
        if (!result) {
          showNotification(`No matching city or ZIP found for "${trimmed}".`, 'error');
          return false;
        }
        await updateAppData(
          (prev) => ({
            ...prev,
            settings: {
              ...prev.settings,
              weatherLocation: result.city,
              weatherCoords: { lat: result.lat, lon: result.lon },
            },
          }),
          { skipUndo: true }
        );
        const live = await fetchLiveWeather(result.city, result.lat, result.lon);
        setWeather(live);
        showNotification(`Weather location updated to ${result.city}`, 'success');
        return true;
      } catch {
        showNotification('Weather location lookup failed.', 'error');
        return false;
      } finally {
        setIsWeatherLoading(false);
      }
    },
    [showNotification]
  );

  const connectGoogleDriveSync = useCallback(
    async (customClientId?: string): Promise<string | null> => {
      try {
        setCloudSyncError(null);
        setCloudSyncStatus('syncing');
        const clientIdToUse =
          customClientId?.trim() ||
          appData?.settings?.cloudSync?.googleClientId ||
          appData?.settings?.cloudSyncConfig?.customClientId;
        const { accessToken } = await requestGoogleDriveAccessToken(clientIdToUse, 'select_account');
        setCloudSyncAccessToken(accessToken);
        setCloudSyncStatus('connected');
        await updateAppData(
          (prev) => {
            const nextCloudSync = {
              enabled: true,
              provider: 'google_drive' as const,
              autoSync:
                prev.settings.cloudSync?.autoSync ??
                prev.settings.cloudSyncConfig?.autoSyncOnChange ??
                true,
              autoSyncOnChange:
                prev.settings.cloudSync?.autoSync ??
                prev.settings.cloudSyncConfig?.autoSyncOnChange ??
                true,
              targetFolder:
                prev.settings.cloudSync?.targetFolder || ('appDataFolder' as const),
              storageSpace:
                prev.settings.cloudSyncConfig?.storageSpace || ('appDataFolder' as const),
              conflictStrategy:
                prev.settings.cloudSyncConfig?.conflictStrategy || ('auto_merge' as const),
              ...prev.settings.cloudSyncConfig,
              ...prev.settings.cloudSync,
              ...(customClientId?.trim()
                ? {
                    googleClientId: customClientId.trim(),
                    customClientId: customClientId.trim(),
                  }
                : {}),
            };
            return {
              ...prev,
              settings: {
                ...prev.settings,
                cloudSync: nextCloudSync,
                cloudSyncConfig: nextCloudSync,
              },
            };
          },
          { skipUndo: true }
        );
        showNotification(
          'Connected to Google Drive (Zero-Knowledge AES-256-GCM Sync Ready).',
          'success'
        );
        return accessToken;
      } catch (err) {
        setCloudSyncStatus('error');
        const msg = err instanceof Error ? err.message : 'Google Drive connection failed.';
        setCloudSyncError(msg);
        showNotification(msg, 'error');
        return null;
      }
    },
    [
      appData?.settings?.cloudSync?.googleClientId,
      appData?.settings?.cloudSyncConfig?.customClientId,
      showNotification,
    ]
  );

  const disconnectGoogleDriveSync = useCallback(() => {
    setCloudSyncAccessToken(null);
    setCloudSyncStatus('disconnected');
    setCloudSyncError(null);
    void updateAppData(
      (prev) => {
        const nextCloudSync = {
          ...prev.settings.cloudSyncConfig,
          ...prev.settings.cloudSync,
          enabled: false,
          autoSync:
            prev.settings.cloudSync?.autoSync ??
            prev.settings.cloudSyncConfig?.autoSyncOnChange ??
            true,
          autoSyncOnChange:
            prev.settings.cloudSync?.autoSync ??
            prev.settings.cloudSyncConfig?.autoSyncOnChange ??
            true,
          storageSpace: prev.settings.cloudSyncConfig?.storageSpace || ('appDataFolder' as const),
          conflictStrategy:
            prev.settings.cloudSyncConfig?.conflictStrategy || ('auto_merge' as const),
        };
        return {
          ...prev,
          settings: {
            ...prev.settings,
            cloudSync: nextCloudSync,
            cloudSyncConfig: nextCloudSync,
          },
        };
      },
      { skipUndo: true }
    );
    showNotification('Disconnected Google Drive session.', 'info');
  }, [showNotification]);

  const pushVaultToGoogleDrive = useCallback(
    async (customPassphrase?: string): Promise<boolean> => {
      const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
      const passToUse =
        (customPassphrase || '').trim() ||
        currentPassphraseRef.current ||
        DEFAULT_SESSION_PASSPHRASE;
      const syncCfg = currentData.settings.cloudSync || currentData.settings.cloudSyncConfig;
      const storageSpace: 'appDataFolder' | 'drive' =
        syncCfg?.targetFolder === 'driveFile' || syncCfg?.storageSpace === 'drive'
          ? 'drive'
          : 'appDataFolder';

      try {
        setCloudSyncError(null);
        setCloudSyncStatus('syncing');
        let token = cloudSyncAccessToken;
        if (!token) {
          token = await connectGoogleDriveSync(
            syncCfg?.googleClientId || syncCfg?.customClientId
          );
          if (!token) return false;
        }

        const envelope = await encryptVaultForCloudSync(
          currentData,
          passToUse,
          syncCfg?.deviceLabel || 'Axiom Aegis Device'
        );
        const uploadedMeta = await uploadDriveVaultFile(
          token,
          envelope,
          storageSpace,
          syncCfg?.driveFileId
        );

        const remoteModMs = uploadedMeta.modifiedTime
          ? new Date(uploadedMeta.modifiedTime).getTime()
          : Date.now();

        await updateAppData(
          (prev) => {
            const nextCloudSync = {
              ...prev.settings.cloudSyncConfig,
              ...prev.settings.cloudSync,
              enabled: true,
              autoSync:
                prev.settings.cloudSync?.autoSync ??
                prev.settings.cloudSyncConfig?.autoSyncOnChange ??
                true,
              autoSyncOnChange:
                prev.settings.cloudSync?.autoSync ??
                prev.settings.cloudSyncConfig?.autoSyncOnChange ??
                true,
              storageSpace,
              driveFileId: uploadedMeta.id,
              lastSyncedAt: Date.now(),
              lastRemoteModifiedAt: remoteModMs,
            };
            return {
              ...prev,
              settings: {
                ...prev.settings,
                lastBackupTimestamp: Date.now(),
                lastBackupRecordCount: countTotalVaultRecords(prev),
                cloudSync: nextCloudSync,
                cloudSyncConfig: nextCloudSync,
              },
            };
          },
          { skipUndo: true }
        );

        setCloudSyncStatus('synced');
        showNotification(
          'Encrypted vault pushed to Google Drive (AES-256-GCM ciphertext only).',
          'success'
        );
        return true;
      } catch (err) {
        setCloudSyncStatus('error');
        const msg = err instanceof Error ? err.message : 'Google Drive upload failed.';
        setCloudSyncError(msg);
        showNotification(msg, 'error');
        return false;
      }
    },
    [appData, cloudSyncAccessToken, connectGoogleDriveSync, showNotification]
  );

  const pullVaultFromGoogleDrive = useCallback(
    async (
      mode: 'pull' | 'auto_merge' = 'auto_merge',
      customPassphrase?: string
    ): Promise<boolean> => {
      const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
      const passToUse =
        (customPassphrase || '').trim() ||
        currentPassphraseRef.current ||
        DEFAULT_SESSION_PASSPHRASE;
      const syncCfg = currentData.settings.cloudSync || currentData.settings.cloudSyncConfig;
      const storageSpace: 'appDataFolder' | 'drive' =
        syncCfg?.targetFolder === 'driveFile' || syncCfg?.storageSpace === 'drive'
          ? 'drive'
          : 'appDataFolder';

      try {
        setCloudSyncError(null);
        setCloudSyncStatus('syncing');
        let token = cloudSyncAccessToken;
        if (!token) {
          token = await connectGoogleDriveSync(
            syncCfg?.googleClientId || syncCfg?.customClientId
          );
          if (!token) return false;
        }

        const remoteMeta = await findDriveVaultFile(token, storageSpace);
        if (!remoteMeta) {
          setCloudSyncStatus('connected');
          showNotification(
            'No encrypted vault file found on Google Drive yet. Use Push to Drive first.',
            'info'
          );
          return false;
        }

        const envelope = await downloadDriveVaultFile(token, remoteMeta.id);
        const { data: decryptedRemote } = await decryptVaultFromCloudSync(envelope, passToUse);
        const sanitizedRemote = validateAndSanitizeAppData(decryptedRemote);

        const nextVault =
          mode === 'auto_merge'
            ? validateAndSanitizeAppData(mergeCloudAndLocalVaults(currentData, sanitizedRemote))
            : sanitizedRemote;

        const nextCloudSync = {
          ...nextVault.settings.cloudSyncConfig,
          ...nextVault.settings.cloudSync,
          ...currentData.settings.cloudSyncConfig,
          ...currentData.settings.cloudSync,
          enabled: true,
          autoSync:
            currentData.settings.cloudSync?.autoSync ??
            currentData.settings.cloudSyncConfig?.autoSyncOnChange ??
            true,
          autoSyncOnChange:
            currentData.settings.cloudSync?.autoSync ??
            currentData.settings.cloudSyncConfig?.autoSyncOnChange ??
            true,
          storageSpace,
          driveFileId: remoteMeta.id,
          lastSyncedAt: Date.now(),
          lastRemoteModifiedAt: new Date(remoteMeta.modifiedTime).getTime(),
        };

        await updateAppData(
          () => ({
            ...nextVault,
            settings: {
              ...nextVault.settings,
              cloudSync: nextCloudSync,
              cloudSyncConfig: nextCloudSync,
            },
          }),
          { actionLabel: mode === 'auto_merge' ? 'Cloud Auto-Merge' : 'Cloud Pull Restore' }
        );

        if (nextVault.settings.layoutConfig) {
          setLayoutConfig(nextVault.settings.layoutConfig);
        }

        setCloudSyncStatus('synced');
        showNotification(
          mode === 'auto_merge'
            ? 'Encrypted Google Drive vault decrypted & merged with local state!'
            : 'Encrypted Google Drive vault restored to this device!',
          'success'
        );
        return true;
      } catch (err) {
        setCloudSyncStatus('error');
        const msg =
          err instanceof Error
            ? err.message
            : 'Failed to decrypt or pull vault from Google Drive.';
        setCloudSyncError(msg);
        showNotification(msg, 'error');
        return false;
      }
    },
    [appData, cloudSyncAccessToken, connectGoogleDriveSync, showNotification]
  );

  const exportEncryptedCloudFile = useCallback(
    async (preferShareSheet = false, customPassphrase?: string): Promise<boolean> => {
      const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
      const passToUse =
        (customPassphrase || '').trim() ||
        currentPassphraseRef.current ||
        DEFAULT_SESSION_PASSPHRASE;
      try {
        setCloudSyncError(null);
        const envelope = await encryptVaultForCloudSync(
          currentData,
          passToUse,
          currentData.settings.cloudSyncConfig?.deviceLabel || 'Axiom Aegis Device'
        );
        const method = await exportCloudVaultFileOrShare(envelope, preferShareSheet);
        await updateAppData(
          (prev) => {
            const nextCloudSync = {
              ...prev.settings.cloudSyncConfig,
              ...prev.settings.cloudSync,
              enabled: prev.settings.cloudSyncConfig?.enabled ?? false,
              autoSync:
                prev.settings.cloudSync?.autoSync ??
                prev.settings.cloudSyncConfig?.autoSyncOnChange ??
                true,
              autoSyncOnChange:
                prev.settings.cloudSync?.autoSync ??
                prev.settings.cloudSyncConfig?.autoSyncOnChange ??
                true,
              storageSpace: prev.settings.cloudSyncConfig?.storageSpace || ('appDataFolder' as const),
              lastSyncedAt: Date.now(),
            };
            return {
              ...prev,
              settings: {
                ...prev.settings,
                lastBackupTimestamp: Date.now(),
                lastBackupRecordCount: countTotalVaultRecords(prev),
                cloudSync: nextCloudSync,
                cloudSyncConfig: nextCloudSync,
              },
            };
          },
          { skipUndo: true }
        );
        showNotification(
          method === 'shared'
            ? 'Encrypted vault shared via mobile Share Sheet.'
            : 'Encrypted cloud vault file (axiom-aegis-vault.enc.json) saved.',
          'success'
        );
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Cloud file export failed.';
        if (!msg.includes('cancelled')) {
          setCloudSyncError(msg);
          showNotification(msg, 'error');
        }
        return false;
      }
    },
    [appData, showNotification]
  );

  const importEncryptedCloudFile = useCallback(
    async (
      jsonContent: string,
      passphrase: string,
      mode: 'pull' | 'auto_merge' = 'auto_merge'
    ): Promise<boolean> => {
      const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
      const passToUse =
        (passphrase || '').trim() ||
        currentPassphraseRef.current ||
        DEFAULT_SESSION_PASSPHRASE;
      try {
        setCloudSyncError(null);
        const { data: remoteData } = await decryptVaultFromCloudSync(jsonContent, passToUse);
        const sanitizedRemote = validateAndSanitizeAppData(remoteData);
        const nextVault =
          mode === 'auto_merge'
            ? validateAndSanitizeAppData(mergeCloudAndLocalVaults(currentData, sanitizedRemote))
            : sanitizedRemote;

        const nextCloudSync = {
          ...nextVault.settings.cloudSyncConfig,
          ...nextVault.settings.cloudSync,
          ...currentData.settings.cloudSyncConfig,
          ...currentData.settings.cloudSync,
          enabled: currentData.settings.cloudSyncConfig?.enabled ?? false,
          autoSync:
            currentData.settings.cloudSync?.autoSync ??
            currentData.settings.cloudSyncConfig?.autoSyncOnChange ??
            true,
          autoSyncOnChange:
            currentData.settings.cloudSync?.autoSync ??
            currentData.settings.cloudSyncConfig?.autoSyncOnChange ??
            true,
          storageSpace: currentData.settings.cloudSyncConfig?.storageSpace || ('appDataFolder' as const),
          lastSyncedAt: Date.now(),
        };

        await updateAppData(
          () => ({
            ...nextVault,
            settings: {
              ...nextVault.settings,
              cloudSync: nextCloudSync,
              cloudSyncConfig: nextCloudSync,
            },
          }),
          { actionLabel: 'Cloud Vault File Import' }
        );
        if (nextVault.settings.layoutConfig) {
          setLayoutConfig(nextVault.settings.layoutConfig);
        }
        showNotification(
          mode === 'auto_merge'
            ? 'Cloud vault file decrypted & merged with local state!'
            : 'Cloud vault file decrypted & restored!',
          'success'
        );
        return true;
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Invalid passphrase or corrupted cloud vault file.';
        setCloudSyncError(msg);
        showNotification(msg, 'error');
        return false;
      }
    },
    [appData, showNotification]
  );

  const autoMergeWithGoogleDrive = useCallback(
    async (customPassphrase?: string): Promise<boolean> => {
      return pullVaultFromGoogleDrive('auto_merge', customPassphrase);
    },
    [pullVaultFromGoogleDrive]
  );

  const saveToCloudSyncedFile = useCallback(async (): Promise<boolean> => {
    return exportEncryptedCloudFile(false);
  }, [exportEncryptedCloudFile]);

  const shareEncryptedVaultMobile = useCallback(async (): Promise<boolean> => {
    return exportEncryptedCloudFile(true);
  }, [exportEncryptedCloudFile]);

  const loadFromCloudSyncedFile = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    try {
      const winWithPicker = window as unknown as {
        showOpenFilePicker?: (options: unknown) => Promise<Array<{ getFile: () => Promise<File> }>>;
      };
      if (typeof winWithPicker.showOpenFilePicker === 'function') {
        const [handle] = await winWithPicker.showOpenFilePicker({
          types: [
            {
              description: 'Axiom Aegis Encrypted Cloud Vault',
              accept: { 'application/json': ['.json', '.aegis'] },
            },
          ],
          multiple: false,
        });
        const file = await handle.getFile();
        const content = await file.text();
        return await importEncryptedCloudFile(
          content,
          currentPassphraseRef.current || DEFAULT_SESSION_PASSPHRASE,
          'auto_merge'
        );
      }

      return await new Promise<boolean>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.aegis,application/json';
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            resolve(false);
            return;
          }
          const content = await file.text();
          const ok = await importEncryptedCloudFile(
            content,
            currentPassphraseRef.current || DEFAULT_SESSION_PASSPHRASE,
            'auto_merge'
          );
          resolve(ok);
        };
        input.click();
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return false;
      showNotification('Failed to open cloud vault file.', 'error');
      return false;
    }
  }, [importEncryptedCloudFile, showNotification]);

  // Generate the 1-Time Phone Pairing URL (#aegis_pair=<base64url_payload>)
  // Automatically rewrites private AI Studio editor URLs (ais-dev-...) to the Shared App URL (ais-pre-...)
  const getPhonePairingUrl = useCallback((): string => {
    const baseUrl =
      typeof window !== 'undefined'
        ? resolveReachablePairingBaseUrl(window.location.origin, window.location.pathname)
        : resolveReachablePairingBaseUrl();
    const hexKey =
      activeEncryptionKeyHex ||
      currentPassphraseRef.current ||
      getSessionVaultCredential() ||
      DEFAULT_SESSION_PASSPHRASE;
    const salt = encryptedPayloadMeta?.salt || cachedEncryptedPayloadRef.current?.salt || undefined;
    const fp = keyFingerprint || encryptedPayloadMeta?.keyFingerprint || undefined;
    return buildPhonePairingUrl(baseUrl, hexKey, salt, fp);
  }, [activeEncryptionKeyHex, encryptedPayloadMeta?.salt, encryptedPayloadMeta?.keyFingerprint, keyFingerprint]);

  // Local-safe QR Code payload (AEGIS-KEY:<hexKey>:<keyId>[:<snapshot>]) — never contains file:/// paths
  const getQrPairingPayload = useCallback((): string => {
    const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
    const hexKey =
      activeEncryptionKeyHex ||
      getActiveDeviceEncryptionIdentity().hexKey ||
      currentPassphraseRef.current ||
      getSessionVaultCredential() ||
      '';
    const fp =
      keyFingerprint ||
      getActiveDeviceEncryptionIdentity().keyFingerprint ||
      encryptedPayloadMeta?.keyFingerprint ||
      '';
    return buildLocalSafeQrPayload(hexKey, fp, currentData);
  }, [activeEncryptionKeyHex, appData, encryptedPayloadMeta?.keyFingerprint, keyFingerprint]);

  // 100% Self-Contained Offline Sync Token (AEGIS-SYNC:v2:<Active_256Bit_Hex_Key>:<Compressed_Vault_Data>)
  const copyOfflineSyncCode = useCallback(async (): Promise<string> => {
    const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
    let hexKey =
      activeEncryptionKeyHex ||
      getActiveDeviceEncryptionIdentity().hexKey ||
      currentPassphraseRef.current ||
      getSessionVaultCredential() ||
      DEFAULT_SESSION_PASSPHRASE;

    if (!/^[0-9a-fA-F]{64}$/.test(hexKey)) {
      const saltStr = encryptedPayloadMeta?.salt || cachedEncryptedPayloadRef.current?.salt;
      const saltBuf = saltStr ? base64ToBuffer(saltStr) : generateSalt();
      const { rawKeyHex } = await deriveKeyDetails(hexKey, saltBuf);
      hexKey = rawKeyHex;
    }

    const fp =
      keyFingerprint ||
      getActiveDeviceEncryptionIdentity().keyFingerprint ||
      (await computeKeyFingerprint(hexKey));

    const code = createOfflineSyncV2Code(
      hexKey,
      fp,
      currentData,
      currentData.settings?.layoutConfig || layoutConfig
    );

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      }
    } catch {
      // Clipboard fallback handled by caller
    }

    setLastSyncFeedback(`Copied Self-Contained Sync Token (ID: ${fp})`);
    showNotification(`Copied Offline Sync Token (ID: ${fp})!`, 'success');
    return code;
  }, [
    activeEncryptionKeyHex,
    appData,
    encryptedPayloadMeta?.salt,
    keyFingerprint,
    layoutConfig,
    showNotification,
  ]);

  // Explicitly adopt sender's 256-Bit AES Encryption Key + Key ID and overwrite local vault & custom password state
  const adoptSyncedKeyAndVault = useCallback(
    async (
      incomingHexKey: string,
      incomingAppData: AppData | null,
      feedbackLabel?: string,
      customSaltBytes?: Uint8Array,
      markCustomPassword = false
    ): Promise<boolean> => {
      clearDerivedKeyCache();
      let cleanHex = incomingHexKey.trim().toLowerCase();
      const saltToUse =
        customSaltBytes || (await deriveDeterministicAccountSalt(unifiedAccount?.accountId));
      if (!/^[0-9a-f]{64}$/.test(cleanHex)) {
        const { rawKeyHex } = await deriveKeyDetails(cleanHex, saltToUse);
        cleanHex = rawKeyHex.toLowerCase();
      }

      const resolvedFp = await computeKeyFingerprint(cleanHex);
      const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
      const normalized = incomingAppData
        ? normalizeAppData({
            ...incomingAppData,
            updatedAt: Math.max(Date.now(), incomingAppData.updatedAt || 0),
          })
        : normalizeAppData({
            ...currentData,
            updatedAt: Date.now(),
          });

      const nextLayout = normalized.settings?.layoutConfig || layoutConfig;

      // Re-encrypt with the deterministic salt and adopted 256-Bit Hex Key
      const newPayload = await encryptData(normalized, cleanHex, saltToUse, markCustomPassword);
      newPayload.keyFingerprint = resolvedFp;
      newPayload.hasCustomPassword = markCustomPassword;
      newPayload.timestamp = Date.now();

      // Overwrite localStorage and IndexedDB with adopted key, Key ID, and unpacked vault data
      currentPassphraseRef.current = cleanHex;
      saveSessionVaultCredential(cleanHex);
      saveActiveDeviceEncryptionIdentity(cleanHex, resolvedFp);
      saveAppDataToLocalStorage(normalized, nextLayout);
      await saveEncryptedPayload(newPayload);
      cachedEncryptedPayloadRef.current = newPayload;

      // Immediately update in-memory state and displayed Key ID
      latestAppDataRef.current = normalized;
      setAppData(normalized);
      setLayoutConfig(nextLayout);
      setActiveEncryptionKeyHex(cleanHex);
      setActiveRecoveryKey(formatRecoveryKey(cleanHex));
      setKeyFingerprint(resolvedFp);
      setHasCustomPassword(markCustomPassword);
      setEncryptedPayloadMeta({
        salt: newPayload.salt,
        iv: newPayload.iv,
        version: newPayload.version,
        timestamp: newPayload.timestamp,
        keyFingerprint: resolvedFp,
        verifier: (newPayload as { verifier?: string }).verifier,
        hasCustomPassword: markCustomPassword,
      });
      setIsInitialized(true);
      setIsLocked(false);
      setIsEditMode(true);
      setCloudSyncError(null);
      setLastCloudSyncAt(Date.now());
      setCloudSyncStatus('synced');

      const finalMsg =
        feedbackLabel || `Vault & Encryption Key Synced! (ID: ${resolvedFp})`;
      setLastSyncFeedback(finalMsg);
      showNotification(finalMsg, 'success');
      return true;
    },
    [appData, layoutConfig, showNotification, unifiedAccount?.accountId]
  );

  // Sign Out of Active User Account (clears ONLY active session tokens, NEVER registered accounts)
  const signOutAccount = useCallback(() => {
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    saveAccountSession(null);
    saveUnifiedSyncAccount(null);
    setAccountSession(null);
    setUnifiedAccount(null);
    setActiveTabState((prev) => (prev === 'admin' ? 'dashboard' : prev));
    setCloudSyncStatus('disconnected');
    setCloudSyncError(null);
    setUndoBuffer([]);
    undoBufferRef.current = [];
    setIsLocked(true);
    setIsEditMode(false);
    setIsQuickAddOpen(false);
    setIsImportHubOpen(false);
    setIsCommandPaletteOpen(false);
    setIsFrequentEventsOpen(false);
    const msg = 'Signed out of Axiom Aegis account.';
    setLastSyncFeedback(msg);
    showNotification(msg, 'info');
  }, [showNotification]);

  // Create Account Flow: Register in backend database (server.ts) + local registry, initialize clean workspace, and log in immediately
  const registerAccount = useCallback(
    async (
      username: string,
      displayName: string,
      password: string
    ): Promise<{ ok: boolean; message: string }> => {
      const cleanUser = (username || '').trim().toLowerCase();
      const cleanDisplay = (displayName || '').trim() || cleanUser;
      const cleanPass = (password || '').trim();

      if (cleanUser.length < 2) {
        const msg = 'Username or Email must be at least 2 characters.';
        setCloudSyncError(msg);
        return { ok: false, message: msg };
      }
      if (!cleanDisplay) {
        const msg = 'Please enter a Display Name.';
        setCloudSyncError(msg);
        return { ok: false, message: msg };
      }
      if (cleanPass.length < 4) {
        const msg = 'Password must be at least 4 characters.';
        setCloudSyncError(msg);
        return { ok: false, message: msg };
      }

      isSyncingRef.current = true;
      setCloudSyncError(null);
      setCloudSyncStatus('syncing');

      try {
        const now = Date.now();
        ensureMasterAdminAccountSeeded(
          createInitialAppData(APP_FULL_NAME, MASTER_ADMIN_DEFAULT_DISPLAY_NAME)
        );
        const isMasterMatch = isMasterAdminCredentials(cleanUser, cleanPass);
        const enforcedRole = resolveAccountRole(cleanUser, 'User');
        const cachedExisting = getLocalAccountCacheEntry(cleanUser);

        const baseDisplayName =
          cleanDisplay && cleanDisplay !== cleanUser
            ? cleanDisplay
            : isMasterAdminIdentifier(cleanUser)
              ? cachedExisting?.displayName || MASTER_ADMIN_DEFAULT_DISPLAY_NAME
              : cleanDisplay || cleanUser;

        const freshWorkspace = validateAndSanitizeAppData(
          cachedExisting?.workspaceData && isMasterMatch
            ? cachedExisting.workspaceData
            : createInitialAppData(APP_FULL_NAME, baseDisplayName),
          APP_FULL_NAME,
          baseDisplayName
        );
        const initializedWorkspace: AppData = {
          ...freshWorkspace,
          updatedAt: now,
          settings: {
            ...freshWorkspace.settings,
            userName: baseDisplayName,
            commanderName: baseDisplayName,
            appName: APP_FULL_NAME,
            appShortName: APP_SHORT_NAME,
          },
        };

        const res = await registerAccountInDatabase(
          cleanUser,
          baseDisplayName,
          cleanPass,
          initializedWorkspace
        );

        let finalSession: AccountSession;
        let finalWorkspace = initializedWorkspace;

        if (!res.ok) {
          // Special Safeguard: If registering with verified Master Admin credentials, smoothly log in to the Master Admin account
          if (isMasterMatch) {
            const masterToken =
              cachedExisting?.token ||
              createDeterministicAccountToken(MASTER_ADMIN_EMAIL, MASTER_ADMIN_VERIFIER);
            finalSession = {
              userId: cachedExisting?.userId || 'usr_master_axiomdk99',
              username: MASTER_ADMIN_EMAIL,
              displayName: baseDisplayName,
              role: 'The App Creator',
              token: masterToken,
              loggedInAt: now,
              lastSyncedAt: now,
            };
            if (cachedExisting?.workspaceData) {
              finalWorkspace = normalizeAppData({
                ...cachedExisting.workspaceData,
                settings: {
                  ...cachedExisting.workspaceData.settings,
                  userName: baseDisplayName,
                  commanderName: baseDisplayName,
                },
              });
            }
          } else if (
            res.message.includes('Could not reach') ||
            (cachedExisting && verifyLocalAccountPassword(cachedExisting, cleanPass))
          ) {
            // If backend was unreachable OR local account already exists with matching password, authenticate seamlessly
            if (cachedExisting) {
              if (verifyLocalAccountPassword(cachedExisting, cleanPass)) {
                finalSession = {
                  userId: cachedExisting.userId,
                  username: cachedExisting.username,
                  displayName: baseDisplayName || cachedExisting.displayName,
                  role: resolveAccountRole(cachedExisting.username, cachedExisting.role),
                  token:
                    cachedExisting.token ||
                    createDeterministicAccountToken(cleanUser, cleanPass),
                  loggedInAt: now,
                  lastSyncedAt: now,
                };
                if (cachedExisting.workspaceData) {
                  finalWorkspace = normalizeAppData(cachedExisting.workspaceData);
                }
              } else {
                const dupMsg = `Account "${cleanUser}" already exists. Please switch to Log In.`;
                setCloudSyncError(dupMsg);
                setCloudSyncStatus('error');
                return { ok: false, message: dupMsg };
              }
            } else {
              const offlineUserId = `usr_local_${now.toString(36)}`;
              const offlineToken = createDeterministicAccountToken(cleanUser, cleanPass);
              finalSession = {
                userId: offlineUserId,
                username: cleanUser,
                displayName: baseDisplayName,
                role: enforcedRole,
                token: offlineToken,
                loggedInAt: now,
                lastSyncedAt: now,
              };
            }
          } else {
            setCloudSyncError(res.message);
            setCloudSyncStatus('error');
            return { ok: false, message: res.message };
          }
        } else {
          finalSession = {
            userId: res.userId || `usr_${now.toString(36)}`,
            username: res.username || cleanUser,
            displayName: res.displayName || baseDisplayName,
            role: resolveAccountRole(res.username || cleanUser, res.role),
            token: res.token || createDeterministicAccountToken(cleanUser, cleanPass),
            loggedInAt: now,
            lastSyncedAt: res.updatedAt || now,
          };
          if (res.workspaceData) {
            finalWorkspace = normalizeAppData({
              ...res.workspaceData,
              settings: {
                ...res.workspaceData.settings,
                userName: finalSession.displayName,
                commanderName: finalSession.displayName,
              },
            });
          }
        }

        const nextLayout = finalWorkspace.settings?.layoutConfig || DEFAULT_LAYOUT_CONFIG;
        saveAccountSession(finalSession);
        setAccountSession(finalSession);
        saveLocalAccountCacheEntry({
          userId: finalSession.userId,
          username: finalSession.username,
          displayName: finalSession.displayName,
          role: finalSession.role,
          password: cleanPass,
          token: finalSession.token,
          createdAt: cachedExisting?.createdAt || now,
          updatedAt: now,
          workspaceData: finalWorkspace,
        });

        latestAppDataRef.current = finalWorkspace;
        setAppData(finalWorkspace);
        setLayoutConfig(nextLayout);
        saveAppDataToLocalStorage(finalWorkspace, nextLayout);

        const isOnlineNow = typeof navigator === 'undefined' || navigator.onLine !== false;
        const syncedToCloud = Boolean(res.ok && res.syncedToCloud !== false && isOnlineNow);
        hasPendingCloudPushRef.current = !syncedToCloud;
        lastCloudPullAtRef.current = now;
        setIsInitialized(true);
        setIsLocked(false);
        setIsEditMode(true);
        setActiveTabState('shortcuts');
        setLastCloudSyncAt(syncedToCloud ? now : null);
        setCloudSyncStatus(syncedToCloud ? 'synced' : 'disconnected');
        const msg = syncedToCloud
          ? `Account @${finalSession.username} active! Welcome, ${finalSession.displayName} (${finalSession.role}).`
          : `Account @${finalSession.username} active offline — queued for cloud sync.`;
        setLastSyncFeedback(msg);
        showNotification(msg, 'success');
        return { ok: true, message: msg };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Account registration failed.';
        setCloudSyncError(msg);
        setCloudSyncStatus('error');
        return { ok: false, message: msg };
      } finally {
        isSyncingRef.current = false;
        setCloudSyncStatus((prev) =>
          prev === 'syncing'
            ? typeof navigator !== 'undefined' && navigator.onLine === false
              ? 'disconnected'
              : 'synced'
            : prev
        );
      }
    },
    [showNotification]
  );

  // Log In Flow: Authenticate against backend database (server.ts) + local persistent account registry
  const loginAccount = useCallback(
    async (
      username: string,
      password: string
    ): Promise<{ ok: boolean; message: string }> => {
      const cleanUser = (username || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      if (cleanUser.length < 2) {
        const msg = 'Please enter your Username or Email.';
        setCloudSyncError(msg);
        return { ok: false, message: msg };
      }
      if (cleanPass.length < 4) {
        const msg = 'Please enter your Password (min 4 characters).';
        setCloudSyncError(msg);
        return { ok: false, message: msg };
      }

      isSyncingRef.current = true;
      setCloudSyncError(null);
      setCloudSyncStatus('syncing');

      try {
        const now = Date.now();
        // Ensure Master Admin is always seeded & repaired locally
        ensureMasterAdminAccountSeeded(
          createInitialAppData(APP_FULL_NAME, MASTER_ADMIN_DEFAULT_DISPLAY_NAME)
        );
        const isMasterMatch = isMasterAdminCredentials(cleanUser, cleanPass);

        const res = await loginAccountFromDatabase(cleanUser, cleanPass);
        const cached = getLocalAccountCacheEntry(cleanUser);

        let finalSession: AccountSession;
        let resolvedWorkspace: AppData;

        if (!res.ok) {
          // Special Safeguard: Master Admin with verified credentials is ALWAYS permitted to log in and auto-repairs on the fly
          const canRecoverLocally =
            isMasterMatch || (cached && verifyLocalAccountPassword(cached, cleanPass));

          if (canRecoverLocally) {
            const fallbackDisplayName =
              cached?.displayName && cached.displayName !== 'User'
                ? cached.displayName
                : isMasterMatch
                  ? MASTER_ADMIN_DEFAULT_DISPLAY_NAME
                  : cleanUser;
            const resolvedRole = resolveAccountRole(cleanUser, cached?.role);
            const fallbackToken =
              cached?.token && cached.token.startsWith('aegis_tok_av1_')
                ? cached.token
                : createDeterministicAccountToken(cleanUser, cleanPass);

            finalSession = {
              userId:
                cached?.userId ||
                (isMasterMatch ? 'usr_master_axiomdk99' : `usr_local_${now.toString(36)}`),
              username: cleanUser,
              displayName: fallbackDisplayName,
              role: resolvedRole,
              token: fallbackToken,
              loggedInAt: now,
              lastSyncedAt: cached?.updatedAt || now,
            };
            resolvedWorkspace = normalizeAppData(
              cached?.workspaceData || createInitialAppData(APP_FULL_NAME, fallbackDisplayName)
            );

            // Self-heal backend database if online
            if (!isFileProtocol()) {
              const syncReg = await registerAccountInDatabase(
                cleanUser,
                fallbackDisplayName,
                cleanPass,
                resolvedWorkspace
              );
              if (syncReg.ok && syncReg.token) {
                finalSession = {
                  ...finalSession,
                  userId: syncReg.userId || finalSession.userId,
                  displayName: syncReg.displayName || finalSession.displayName,
                  role: resolveAccountRole(cleanUser, syncReg.role || resolvedRole),
                  token: syncReg.token,
                };
                if (syncReg.workspaceData) {
                  resolvedWorkspace = normalizeAppData(
                    mergeCloudAndLocalVaults(resolvedWorkspace, syncReg.workspaceData)
                  );
                }
              }
            }
          } else {
            const errMsg =
              cached && !verifyLocalAccountPassword(cached, cleanPass)
                ? 'Incorrect password for this account.'
                : res.message;
            setCloudSyncError(errMsg);
            setCloudSyncStatus('error');
            return { ok: false, message: errMsg };
          }
        } else {
          const resolvedRole = resolveAccountRole(
            res.username || cleanUser,
            res.role || cached?.role
          );
          finalSession = {
            userId: res.userId || `usr_${now.toString(36)}`,
            username: res.username || cleanUser,
            displayName:
              res.displayName ||
              cached?.displayName ||
              (isMasterMatch ? MASTER_ADMIN_DEFAULT_DISPLAY_NAME : cleanUser),
            role: resolvedRole,
            token: res.token || createDeterministicAccountToken(cleanUser, cleanPass),
            loggedInAt: now,
            lastSyncedAt: res.updatedAt || now,
          };

          if (res.workspaceData) {
            // Hydrate directly from the user's account database record (merging if the same user had local unsynced edits)
            const previousSession = getAccountSession();
            const currentLocal = latestAppDataRef.current || appData;
            const isSameUser =
              previousSession &&
              previousSession.username.toLowerCase() === finalSession.username.toLowerCase();

            const baseData =
              isSameUser && currentLocal && !isFactoryDefaultVault(currentLocal)
                ? mergeCloudAndLocalVaults(currentLocal, res.workspaceData)
                : res.workspaceData;

            resolvedWorkspace = normalizeAppData({
              ...baseData,
              updatedAt: Math.max(now, res.updatedAt || 0, baseData.updatedAt || 0),
              settings: {
                ...baseData.settings,
                userName:
                  res.displayName ||
                  baseData.settings?.commanderName ||
                  baseData.settings?.userName ||
                  finalSession.displayName,
                commanderName:
                  res.displayName ||
                  baseData.settings?.commanderName ||
                  baseData.settings?.userName ||
                  finalSession.displayName,
              },
            });
          } else {
            // Account existed in database with empty workspace: initialize clean workspace for this user
            const cleanInit =
              cached?.workspaceData ||
              createInitialAppData(APP_FULL_NAME, finalSession.displayName);
            resolvedWorkspace = normalizeAppData({
              ...cleanInit,
              updatedAt: now,
              settings: {
                ...cleanInit.settings,
                userName: finalSession.displayName,
                commanderName: finalSession.displayName,
              },
            });
            await pushAccountWorkspaceToDatabase(
              finalSession.token,
              finalSession.username,
              resolvedWorkspace,
              finalSession.displayName
            );
          }
        }

        const nextLayout = resolvedWorkspace.settings?.layoutConfig || DEFAULT_LAYOUT_CONFIG;
        saveAccountSession(finalSession);
        setAccountSession(finalSession);
        saveLocalAccountCacheEntry({
          userId: finalSession.userId,
          username: finalSession.username,
          displayName: finalSession.displayName,
          role: finalSession.role,
          password: cleanPass,
          token: finalSession.token,
          createdAt: cached?.createdAt || now,
          updatedAt: now,
          workspaceData: resolvedWorkspace,
        });

        latestAppDataRef.current = resolvedWorkspace;
        setAppData(resolvedWorkspace);
        setLayoutConfig(nextLayout);
        saveAppDataToLocalStorage(resolvedWorkspace, nextLayout);

        const isOnlineNow = typeof navigator === 'undefined' || navigator.onLine !== false;
        const syncedToCloud = Boolean(res.ok && res.syncedToCloud !== false && isOnlineNow);
        hasPendingCloudPushRef.current = !syncedToCloud;
        lastCloudPullAtRef.current = now;
        setIsInitialized(true);
        setIsLocked(false);
        setIsEditMode(true);
        setActiveTabState('shortcuts');
        setLastCloudSyncAt(syncedToCloud ? now : finalSession.lastSyncedAt || null);
        setCloudSyncStatus(syncedToCloud ? 'synced' : 'disconnected');

        const msg = syncedToCloud
          ? `Signed in as ${finalSession.displayName} (@${finalSession.username}) — Workspace Synced!`
          : `Signed in offline as ${finalSession.displayName} (@${finalSession.username}) — queued for cloud sync.`;
        setLastSyncFeedback(msg);
        showNotification(msg, 'success');
        return { ok: true, message: msg };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Login failed.';
        setCloudSyncError(msg);
        setCloudSyncStatus('error');
        return { ok: false, message: msg };
      } finally {
        isSyncingRef.current = false;
        setCloudSyncStatus((prev) =>
          prev === 'syncing'
            ? typeof navigator !== 'undefined' && navigator.onLine === false
              ? 'disconnected'
              : 'synced'
            : prev
        );
      }
    },
    [appData, showNotification]
  );

  // Update the logged-in account's Display Name in both local state and the backend database
  const updateAccountDisplayName = useCallback(
    async (newDisplayName: string): Promise<boolean> => {
      const cleanDisplay = (newDisplayName || '').trim();
      if (!cleanDisplay) {
        showNotification('Display Name cannot be empty.', 'error');
        return false;
      }
      const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
      const now = Date.now();
      const updatedData: AppData = {
        ...currentData,
        updatedAt: now,
        settings: {
          ...currentData.settings,
          userName: cleanDisplay,
          commanderName: cleanDisplay,
        },
      };
      latestAppDataRef.current = updatedData;
      setAppData(updatedData);
      saveAppDataToLocalStorage(updatedData, layoutConfig);

      const session = getAccountSession() || accountSession;
      if (session) {
        const nextSession: AccountSession = {
          ...session,
          displayName: cleanDisplay,
          role: resolveAccountRole(session.username, session.role),
          lastSyncedAt: now,
        };
        saveAccountSession(nextSession);
        setAccountSession(nextSession);
        saveLocalAccountCacheEntry({
          userId: nextSession.userId,
          username: nextSession.username,
          displayName: cleanDisplay,
          role: nextSession.role,
          token: nextSession.token,
          updatedAt: now,
          workspaceData: updatedData,
        });
        const pushRes = await pushAccountWorkspaceToDatabase(
          nextSession.token,
          nextSession.username,
          updatedData,
          cleanDisplay
        );
        if (pushRes.ok && pushRes.syncedToCloud) {
          hasPendingCloudPushRef.current = false;
          setLastCloudSyncAt(now);
          setCloudSyncStatus('synced');
        } else {
          hasPendingCloudPushRef.current = true;
          setCloudSyncStatus(pushRes.offline ? 'disconnected' : 'error');
        }
      }
      showNotification(`Account Display Name updated to "${cleanDisplay}"`, 'success');
      return true;
    },
    [accountSession, appData, layoutConfig, showNotification]
  );

  // Compatibility wrapper for loginUnifiedAccount
  const loginUnifiedAccount = useCallback(
    async (accountId: string, passwordOrKey: string): Promise<boolean> => {
      const loginRes = await loginAccount(accountId, passwordOrKey);
      if (loginRes.ok) return true;
      if (loginRes.message.toLowerCase().includes('no account found')) {
        const regRes = await registerAccount(accountId, accountId, passwordOrKey);
        return regRes.ok;
      }
      return false;
    },
    [loginAccount, registerAccount]
  );

  const logoutUnifiedAccount = useCallback(() => {
    signOutAccount();
  }, [signOutAccount]);

  const copyPhonePairingLink = useCallback(async (): Promise<string | null> => {
    const url = getPhonePairingUrl();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      return url;
    } catch {
      return url;
    }
  }, [getPhonePairingUrl]);

  const sharePhonePairingLink = useCallback(async (): Promise<boolean> => {
    await copyPhonePairingLink();
    return true;
  }, [copyPhonePairingLink]);

  // Automatic & 1-Click Account Database Sync (/api/account/sync)
  const syncVaultNow = useCallback(
    async (options?: {
      silent?: boolean;
      forceDirection?: 'push' | 'pull';
    }): Promise<boolean> => {
      if (isLocked) return false;
      const activeSession = getAccountSession() || accountSession;
      if (!activeSession || !activeSession.username || !activeSession.token) {
        return false;
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setCloudSyncStatus('disconnected');
        setCloudSyncError('Offline — changes queued locally until reconnected.');
        if (!options?.silent) {
          showNotification('Offline — will sync automatically when connection returns.', 'info');
        }
        return false;
      }
      if (isSyncingRef.current) {
        return false;
      }

      isSyncingRef.current = true;
      setCloudSyncError(null);
      setCloudSyncStatus('syncing');

      try {
        const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
        const localUpdatedAt = currentData?.updatedAt || 0;

        // 1. Force Pull (Reload Account from Cloud Database)
        if (options?.forceDirection === 'pull') {
          const pullRes = await fetchAccountWorkspaceFromDatabase(
            activeSession.token,
            activeSession.username
          );
          if (!pullRes.ok || !pullRes.syncedToCloud) {
            setCloudSyncStatus(pullRes.offline ? 'disconnected' : 'error');
            setCloudSyncError(pullRes.message);
            if (!options?.silent) {
              showNotification(pullRes.message, pullRes.offline ? 'info' : 'error');
            }
            return false;
          }

          if (!pullRes.workspaceData) {
            setLastCloudSyncAt(Date.now());
            setCloudSyncStatus('synced');
            return true;
          }

          const syncedNow = Date.now();
          const resolvedDisplayName =
            pullRes.displayName || activeSession.displayName;
          const resolvedRole = resolveAccountRole(
            activeSession.username,
            pullRes.role || activeSession.role
          );
          const normalized = normalizeAppData({
            ...pullRes.workspaceData,
            updatedAt: pullRes.updatedAt || pullRes.workspaceData.updatedAt || syncedNow,
            settings: {
              ...pullRes.workspaceData.settings,
              userName:
                pullRes.workspaceData.settings?.commanderName ||
                pullRes.workspaceData.settings?.userName ||
                resolvedDisplayName,
              commanderName:
                pullRes.workspaceData.settings?.commanderName ||
                pullRes.workspaceData.settings?.userName ||
                resolvedDisplayName,
            },
          });
          const nextLayout = normalized.settings?.layoutConfig || layoutConfig;
          hasPendingCloudPushRef.current = false;
          lastCloudPullAtRef.current = syncedNow;
          latestAppDataRef.current = normalized;
          setAppData(normalized);
          setLayoutConfig(nextLayout);
          saveAppDataToLocalStorage(normalized, nextLayout);

          const nextSession: AccountSession = {
            ...activeSession,
            displayName: resolvedDisplayName,
            role: resolvedRole,
            lastSyncedAt: syncedNow,
          };
          saveAccountSession(nextSession);
          setAccountSession(nextSession);
          saveLocalAccountCacheEntry({
            userId: nextSession.userId,
            username: nextSession.username,
            displayName: nextSession.displayName,
            role: nextSession.role,
            token: nextSession.token,
            updatedAt: normalized.updatedAt || syncedNow,
            workspaceData: normalized,
          });

          setLastCloudSyncAt(syncedNow);
          setCloudSyncStatus('synced');
          if (!options?.silent) {
            const msg = `Synced workspace from cloud (@${nextSession.username})`;
            setLastSyncFeedback(msg);
            showNotification(msg, 'success');
          }
          return true;
        }

        // 2. Force Push (Push Local Mutations to Cloud Database)
        if (options?.forceDirection === 'push') {
          const syncedNow = Date.now();
          const preservedUpdatedAt = options?.silent
            ? currentData.updatedAt || syncedNow
            : syncedNow;
          const currentDisplayName =
            currentData.settings?.commanderName ||
            currentData.settings?.userName ||
            activeSession.displayName;
          const dataToPush: AppData = {
            ...currentData,
            updatedAt: preservedUpdatedAt,
            settings: {
              ...currentData.settings,
              userName: currentDisplayName,
              commanderName: currentDisplayName,
            },
          };

          const pushRes = await pushAccountWorkspaceToDatabase(
            activeSession.token,
            activeSession.username,
            dataToPush,
            currentDisplayName
          );

          if (!pushRes.ok || !pushRes.syncedToCloud) {
            hasPendingCloudPushRef.current = true;
            setCloudSyncStatus(pushRes.offline ? 'disconnected' : 'error');
            setCloudSyncError(pushRes.message);
            if (!options?.silent) {
              showNotification(pushRes.message, pushRes.offline ? 'info' : 'error');
            }
            return false;
          }

          hasPendingCloudPushRef.current = false;
          lastCloudPullAtRef.current = syncedNow;
          const resolvedRole = resolveAccountRole(
            activeSession.username,
            pushRes.role || activeSession.role
          );
          const serverWorkspace = pushRes.workspaceData
            ? normalizeAppData(pushRes.workspaceData)
            : dataToPush;
          if ((serverWorkspace.updatedAt || 0) > (dataToPush.updatedAt || 0)) {
            latestAppDataRef.current = serverWorkspace;
            setAppData(serverWorkspace);
            saveAppDataToLocalStorage(serverWorkspace, serverWorkspace.settings?.layoutConfig || layoutConfig);
          }

          const nextSession: AccountSession = {
            ...activeSession,
            displayName: pushRes.displayName || currentDisplayName,
            role: resolvedRole,
            lastSyncedAt: syncedNow,
          };
          saveAccountSession(nextSession);
          setAccountSession(nextSession);
          saveLocalAccountCacheEntry({
            userId: nextSession.userId,
            username: nextSession.username,
            displayName: nextSession.displayName,
            role: nextSession.role,
            token: nextSession.token,
            updatedAt: serverWorkspace.updatedAt || preservedUpdatedAt,
            workspaceData: serverWorkspace,
          });

          setLastCloudSyncAt(syncedNow);
          setCloudSyncStatus('synced');
          if (!options?.silent) {
            const msg = `Saved device workspace to cloud (@${nextSession.username})`;
            setLastSyncFeedback(msg);
            showNotification(msg, 'success');
          }
          return true;
        }

        // 3. Default Two-Way Smart Cloud Revalidation (startup, focus, reconnect, manual sync)
        const remoteRes = await fetchAccountWorkspaceFromDatabase(
          activeSession.token,
          activeSession.username
        );

        if (!remoteRes.ok || !remoteRes.syncedToCloud) {
          setCloudSyncStatus(remoteRes.offline ? 'disconnected' : 'error');
          setCloudSyncError(remoteRes.message);
          if (!options?.silent) {
            showNotification(remoteRes.message, remoteRes.offline ? 'info' : 'error');
          }
          return false;
        }

        const syncedNow = Date.now();
        lastCloudPullAtRef.current = syncedNow;
        let finalVault: AppData = currentData;
        let finalDisplayName =
          currentData.settings?.commanderName && currentData.settings.commanderName !== 'User'
            ? currentData.settings.commanderName
            : remoteRes.displayName || activeSession.displayName;
        let shouldPushBack = !options?.silent;
        let shouldApplyToUi = !options?.silent;

        if (remoteRes.workspaceData) {
          const remoteNormalized = normalizeAppData(remoteRes.workspaceData);
          const remoteUpdatedAt =
            remoteRes.updatedAt || remoteNormalized.updatedAt || 0;
          const localIsFactory = isFactoryDefaultVault(currentData);
          const remoteIsFactory = isFactoryDefaultVault(remoteNormalized);
          const collectionsDiffer =
            JSON.stringify({
              chores: currentData.chores || [],
              dailyNotes: currentData.dailyNotes || [],
              goals: currentData.goals || [],
              funds: currentData.funds || [],
              bills: currentData.bills || [],
              timeline: currentData.timeline || [],
              deletedItemTombstones: currentData.deletedItemTombstones || {},
            }) !==
            JSON.stringify({
              chores: remoteNormalized.chores || [],
              dailyNotes: remoteNormalized.dailyNotes || [],
              goals: remoteNormalized.goals || [],
              funds: remoteNormalized.funds || [],
              bills: remoteNormalized.bills || [],
              timeline: remoteNormalized.timeline || [],
              deletedItemTombstones: remoteNormalized.deletedItemTombstones || {},
            });

          if (!hasPendingCloudPushRef.current && (remoteUpdatedAt !== localUpdatedAt || collectionsDiffer || (localIsFactory && !remoteIsFactory))) {
            // No pending local mutations -> cloud state is authoritative (preserves remote deletes/edits)
            finalVault = remoteNormalized;
            shouldApplyToUi = true;
          } else if (hasPendingCloudPushRef.current) {
            finalVault = normalizeAppData(mergeCloudAndLocalVaults(currentData, remoteNormalized));
            shouldPushBack = true;
            shouldApplyToUi = true;
          }

          if (
            !hasPendingCloudPushRef.current &&
            remoteNormalized.settings?.commanderName &&
            remoteNormalized.settings.commanderName !== 'User'
          ) {
            finalDisplayName = remoteNormalized.settings.commanderName;
          }

          const resolvedUpdatedAt = Math.max(localUpdatedAt, remoteUpdatedAt) || syncedNow;
          finalVault = {
            ...finalVault,
            updatedAt: resolvedUpdatedAt,
            settings: {
              ...finalVault.settings,
              userName: finalDisplayName,
              commanderName: finalDisplayName,
            },
          };

          if (shouldApplyToUi) {
            const nextLayout = finalVault.settings?.layoutConfig || layoutConfig;
            latestAppDataRef.current = finalVault;
            setAppData(finalVault);
            setLayoutConfig(nextLayout);
            saveAppDataToLocalStorage(finalVault, nextLayout);
          }

          if (hasPendingCloudPushRef.current || localUpdatedAt > remoteUpdatedAt) {
            shouldPushBack = true;
          }
        } else {
          finalVault = {
            ...currentData,
            updatedAt: localUpdatedAt || syncedNow,
            settings: {
              ...currentData.settings,
              userName: finalDisplayName,
              commanderName: finalDisplayName,
            },
          };
          shouldPushBack = true;
        }

        const pushedRes = shouldPushBack
          ? await pushAccountWorkspaceToDatabase(
              activeSession.token,
              activeSession.username,
              finalVault,
              finalDisplayName
            )
          : remoteRes;

        if (shouldPushBack && (!pushedRes.ok || !pushedRes.syncedToCloud)) {
          hasPendingCloudPushRef.current = true;
          setCloudSyncStatus(pushedRes.offline ? 'disconnected' : 'error');
          setCloudSyncError(pushedRes.message);
          if (!options?.silent) {
            showNotification(pushedRes.message, pushedRes.offline ? 'info' : 'error');
          }
          return false;
        }

        hasPendingCloudPushRef.current = false;
        const resolvedRole = resolveAccountRole(
          activeSession.username,
          pushedRes.role || remoteRes.role || activeSession.role
        );
        const nextSession: AccountSession = {
          ...activeSession,
          displayName: finalDisplayName,
          role: resolvedRole,
          lastSyncedAt: syncedNow,
        };
        saveAccountSession(nextSession);
        setAccountSession(nextSession);
        saveLocalAccountCacheEntry({
          userId: nextSession.userId,
          username: nextSession.username,
          displayName: nextSession.displayName,
          role: nextSession.role,
          token: nextSession.token,
          updatedAt: finalVault.updatedAt || syncedNow,
          workspaceData: finalVault,
        });

        setLastCloudSyncAt(syncedNow);
        setCloudSyncStatus('synced');
        if (!options?.silent) {
          const msg = `Account synced to cloud (@${nextSession.username})`;
          setLastSyncFeedback(msg);
          showNotification(msg, 'success');
        }
        return true;
      } catch (err) {
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        setCloudSyncStatus(offline ? 'disconnected' : 'error');
        const msg = err instanceof Error ? err.message : 'Account database sync failed.';
        setCloudSyncError(msg);
        if (!options?.silent) {
          showNotification(msg, 'error');
        }
        return false;
      } finally {
        isSyncingRef.current = false;
      }
    },
    [isLocked, accountSession, appData, layoutConfig, showNotification]
  );

  const forcePushVaultToCloud = useCallback(async (): Promise<boolean> => {
    return syncVaultNow({ silent: false, forceDirection: 'push' });
  }, [syncVaultNow]);

  const forcePullVaultFromCloud = useCallback(async (): Promise<boolean> => {
    return syncVaultNow({ silent: false, forceDirection: 'pull' });
  }, [syncVaultNow]);

  // Apply unified vault package or self-contained AEGIS-SYNC:v2 / AEGIS-KEY token 100% locally (0 network dependencies)
  const applyUnifiedPayloadOrToken = useCallback(
    async (rawInput: string): Promise<boolean> => {
      const trimmed = (rawInput || '').trim();
      if (!trimmed) {
        const msg = 'Paste an AEGIS-SYNC token or transfer payload first.';
        setLastSyncFeedback(msg);
        showNotification(msg, 'error');
        return false;
      }

      setCloudSyncError(null);
      setCloudSyncStatus('syncing');

      try {
        // 1. Check for AEGIS-SYNC:v2:..., legacy AEGIS-SYNC:ch_..., or AEGIS-KEY:... tokens (100% local)
        if (
          trimmed.startsWith('AEGIS-SYNC:') ||
          trimmed.startsWith('AEGIS-KEY:') ||
          /^[0-9a-fA-F]{64}$/.test(trimmed)
        ) {
          // Raw 64-char hex key pasted directly
          if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
            const fp = await computeKeyFingerprint(trimmed);
            await adoptSyncedKeyAndVault(
              trimmed,
              null,
              `Sync Complete — Key ID Updated (ID: ${fp})`
            );
            return true;
          }

          const parsedToken = parseOfflineSyncToken(trimmed);

          if (parsedToken.kind === 'v2' && parsedToken.hexKey && parsedToken.appData) {
            const incomingData = parsedToken.appData as AppData;
            if (parsedToken.layoutConfig && incomingData.settings) {
              incomingData.settings.layoutConfig =
                parsedToken.layoutConfig as AppData['settings']['layoutConfig'];
            }
            const fp = await computeKeyFingerprint(parsedToken.hexKey);
            await adoptSyncedKeyAndVault(
              parsedToken.hexKey,
              incomingData,
              `Vault & Encryption Key Synced! (ID: ${fp})`
            );
            return true;
          }

          if (parsedToken.kind === 'qr_key' && parsedToken.hexKey) {
            const fp = await computeKeyFingerprint(parsedToken.hexKey);
            const currentData =
              latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
            let mergedData: AppData | null = null;
            if (parsedToken.appData) {
              mergedData = {
                ...currentData,
                ...parsedToken.appData,
                settings: {
                  ...currentData.settings,
                  ...(parsedToken.appData.settings || {}),
                },
              };
            }
            await adoptSyncedKeyAndVault(
              parsedToken.hexKey,
              mergedData,
              mergedData
                ? `Vault & Encryption Key Synced via QR! (ID: ${fp})`
                : `Sync Complete — Key ID Updated (ID: ${fp})`
            );
            return true;
          }

          if (parsedToken.kind === 'legacy_channel' && parsedToken.hexKey) {
            // Immediately adopt the 64-character hex key so Encryption Key & Key ID match sender
            const fp = await computeKeyFingerprint(parsedToken.hexKey);
            let relayData: AppData | null = null;

            if (!isFileProtocol() && parsedToken.channelId) {
              try {
                const remoteEnvelope = await fetchRemoteEncryptedVault(parsedToken.channelId);
                if (remoteEnvelope && remoteEnvelope.payload) {
                  const { data: decryptedRemote } = await decryptVaultFromCloudSync(
                    remoteEnvelope,
                    parsedToken.hexKey
                  );
                  relayData = decryptedRemote;
                }
              } catch {
                // Offline or relay unreachable — still adopt the Encryption Key below
              }
            }

            if (relayData) {
              await adoptSyncedKeyAndVault(
                parsedToken.hexKey,
                relayData,
                `Vault & Encryption Key Synced! (ID: ${fp})`
              );
              return true;
            }

            await adoptSyncedKeyAndVault(
              parsedToken.hexKey,
              null,
              `Key ID Updated to ${fp} — Legacy channel token only carries the Encryption Key offline. Click "Copy Code" on sender for a v2 full-vault token.`
            );
            return true;
          }

          const errMsg =
            parsedToken.error ||
            'Incomplete or corrupted sync token. Copy the full AEGIS-SYNC:v2 token and try again.';
          setLastSyncFeedback(errMsg);
          setCloudSyncError(errMsg);
          setCloudSyncStatus('error');
          showNotification(errMsg, 'error');
          return false;
        }

        // 2. Unified Vault Transfer Package (.json or base64 package with embedded key + envelope)
        let pkg: UnifiedVaultTransferPackage | null = parseUnifiedVaultPackage(trimmed);
        if (!pkg) {
          pkg = decodeTransferToken(trimmed);
        }

        if (pkg && pkg.envelope && pkg.key) {
          const { data: decryptedRemote } = await decryptVaultFromCloudSync(
            pkg.envelope,
            pkg.key
          );
          const fp = await computeKeyFingerprint(pkg.key);
          await adoptSyncedKeyAndVault(
            pkg.key,
            decryptedRemote,
            `Vault & Encryption Key Synced! (ID: ${fp})`
          );
          return true;
        }

        // 3. Raw AppData JSON backup (plain or exported state)
        try {
          const maybeJson = JSON.parse(trimmed) as Record<string, unknown>;
          if (
            maybeJson &&
            typeof maybeJson === 'object' &&
            ('calendar' in maybeJson || 'timeline' in maybeJson || 'settings' in maybeJson)
          ) {
            const incomingKey =
              typeof maybeJson.activeEncryptionKeyHex === 'string' &&
              /^[0-9a-fA-F]{64}$/.test(maybeJson.activeEncryptionKeyHex)
                ? maybeJson.activeEncryptionKeyHex
                : activeEncryptionKeyHex ||
                  currentPassphraseRef.current ||
                  getSessionVaultCredential() ||
                  DEFAULT_SESSION_PASSPHRASE;
            const fp = await computeKeyFingerprint(incomingKey);
            await adoptSyncedKeyAndVault(
              incomingKey,
              maybeJson as unknown as AppData,
              `Vault & Encryption Key Synced! (ID: ${fp})`
            );
            return true;
          }
        } catch {
          // Not plain AppData JSON, proceed to encrypted envelope check
        }

        // 4. Standard encrypted envelope without embedded key: attempt with active credential
        const passToUse =
          activeEncryptionKeyHex ||
          currentPassphraseRef.current ||
          getSessionVaultCredential() ||
          DEFAULT_SESSION_PASSPHRASE;
        const { data: decryptedRemote } = await decryptVaultFromCloudSync(trimmed, passToUse);
        const fp = await computeKeyFingerprint(passToUse);
        await adoptSyncedKeyAndVault(
          passToUse,
          decryptedRemote,
          `Vault & Encryption Key Synced! (ID: ${fp})`
        );
        return true;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Invalid or truncated sync token. Please re-copy the full code.';
        setLastSyncFeedback(msg);
        setCloudSyncError(msg);
        setCloudSyncStatus('error');
        showNotification(msg, 'error');
        return false;
      } finally {
        setCloudSyncStatus((prev) => (prev === 'syncing' ? 'synced' : prev));
      }
    },
    [
      activeEncryptionKeyHex,
      adoptSyncedKeyAndVault,
      appData,
      showNotification,
    ]
  );

  // ACTION 1: 1-Click Sync & Share Vault (packages encrypted state + key + offline v2 token, downloads file, triggers Web Share)
  const syncAndShareVaultUnified = useCallback(
    async (): Promise<{ success: boolean; token?: string; downloaded?: boolean }> => {
      if (isLocked) {
        showNotification('Unlock vault to sync and share', 'info');
        return { success: false };
      }
      const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
      let passToUse =
        activeEncryptionKeyHex ||
        getActiveDeviceEncryptionIdentity().hexKey ||
        currentPassphraseRef.current ||
        getSessionVaultCredential() ||
        DEFAULT_SESSION_PASSPHRASE;

      setCloudSyncError(null);
      setCloudSyncStatus('syncing');

      try {
        const existingPayload = cachedEncryptedPayloadRef.current;
        const existingSalt = existingPayload?.salt
          ? base64ToBuffer(existingPayload.salt)
          : generateSalt();

        if (!/^[0-9a-fA-F]{64}$/.test(passToUse)) {
          const { rawKeyHex } = await deriveKeyDetails(passToUse, existingSalt);
          passToUse = rawKeyHex;
        }

        const resolvedFp = await computeKeyFingerprint(passToUse);
        const envelope = await encryptVaultForCloudSync(
          currentData,
          passToUse,
          'Axiom Aegis Device',
          existingSalt,
          false
        );

        // Best-effort relay push only when running on HTTP/HTTPS server
        if (!isFileProtocol()) {
          try {
            const channelId = await computeSyncChannelId(passToUse);
            await pushRemoteEncryptedVault(envelope, channelId);
            await pushRemoteEncryptedVault(envelope, '/api/vault-sync');
          } catch {
            // Relay optional — offline package & v2 token always succeed locally
          }
        }

        const pkg = createUnifiedVaultPackage(envelope, passToUse);
        const jsonStr = JSON.stringify(pkg, null, 2);
        const offlineV2Token = createOfflineSyncV2Code(
          passToUse,
          resolvedFp,
          currentData,
          currentData.settings?.layoutConfig || layoutConfig
        );

        if (typeof document !== 'undefined') {
          const blob = new Blob([jsonStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'Axiom-Aegis-Sync-Vault.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
              const file = new File([blob], 'Axiom-Aegis-Sync-Vault.json', {
                type: 'application/json',
              });
              if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                  title: 'Axiom Aegis Sync Vault',
                  text: 'Axiom Aegis Encrypted Sync Vault',
                  files: [file],
                });
              }
            } catch {
              // Share sheet dismissed or unsupported
            }
          }
        }

        setLastCloudSyncAt(Date.now());
        setCloudSyncStatus('synced');
        const msg = `Vault & Encryption Key Packaged (ID: ${resolvedFp})`;
        setLastSyncFeedback(msg);
        showNotification(msg, 'success');
        return { success: true, token: offlineV2Token, downloaded: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to package vault.';
        setLastSyncFeedback(msg);
        setCloudSyncError(msg);
        setCloudSyncStatus('error');
        showNotification(msg, 'error');
        return { success: false };
      } finally {
        setCloudSyncStatus((prev) => (prev === 'syncing' ? 'synced' : prev));
      }
    },
    [isLocked, appData, activeEncryptionKeyHex, layoutConfig, showNotification]
  );

  // ACTION 2: 1-Click Update / Pull Vault (unpacks provided token OR opens 1-click file selector to import vault & adopt sender's Encryption Key)
  const updateOrPullVaultUnified = useCallback(
    async (providedPayloadOrToken?: string): Promise<boolean> => {
      if (isLocked) {
        showNotification('Unlock vault to update state', 'info');
        return false;
      }

      if (providedPayloadOrToken && providedPayloadOrToken.trim()) {
        return await applyUnifiedPayloadOrToken(providedPayloadOrToken.trim());
      }

      if (typeof document === 'undefined') return false;
      return await new Promise<boolean>((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.aegis,application/json,text/plain';
        let settled = false;
        const finish = (result: boolean) => {
          if (!settled) {
            settled = true;
            setCloudSyncStatus((prev) => (prev === 'syncing' ? 'synced' : prev));
            resolve(result);
          }
        };

        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) {
            finish(false);
            return;
          }
          setCloudSyncStatus('syncing');
          try {
            const text = await file.text();
            const ok = await applyUnifiedPayloadOrToken(text);
            finish(ok);
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to read backup file.';
            setLastSyncFeedback(msg);
            showNotification(msg, 'error');
            finish(false);
          } finally {
            setCloudSyncStatus((prev) => (prev === 'syncing' ? 'synced' : prev));
          }
        };

        input.oncancel = () => finish(false);
        input.click();
      });
    },
    [isLocked, applyUnifiedPayloadOrToken, showNotification]
  );

  // Simplified Account Snapshot Export (.json)
  const exportAccountSnapshot = useCallback(async (): Promise<boolean> => {
    try {
      const currentData = latestAppDataRef.current || appData || loadAppDataFromLocalStorage();
      const activeSession = getAccountSession() || accountSession;
      const username = activeSession?.username || 'account';
      const displayName =
        activeSession?.displayName ||
        currentData.settings?.commanderName ||
        currentData.settings?.userName ||
        'Commander';

      const jsonStr = buildAccountSnapshotJson(username, displayName, currentData);
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Axiom-Aegis-Account-${username.replace(/[^a-z0-9_-]/gi, '_')}-${dateStr}.json`;

      if (typeof document !== 'undefined') {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      const msg = `Exported Account Snapshot (${filename})`;
      setLastSyncFeedback(msg);
      showNotification(msg, 'success');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to export account snapshot.';
      showNotification(msg, 'error');
      return false;
    }
  }, [accountSession, appData, showNotification]);

  // Simplified Account Snapshot Import (.json)
  const importAccountSnapshot = useCallback(
    async (jsonContent: string): Promise<{ success: boolean; message: string }> => {
      try {
        const parsedSnap = parseAccountSnapshotJson(jsonContent);
        if (parsedSnap && parsedSnap.workspaceData) {
          const activeSession = getAccountSession() || accountSession;
          const displayName =
            parsedSnap.displayName ||
            activeSession?.displayName ||
            parsedSnap.workspaceData.settings?.commanderName ||
            'Commander';

          const normalized = normalizeAppData({
            ...parsedSnap.workspaceData,
            updatedAt: Date.now(),
            settings: {
              ...parsedSnap.workspaceData.settings,
              userName: displayName,
              commanderName: displayName,
            },
          });

          const nextLayout = normalized.settings?.layoutConfig || layoutConfig;
          latestAppDataRef.current = normalized;
          setAppData(normalized);
          setLayoutConfig(nextLayout);
          saveAppDataToLocalStorage(normalized, nextLayout);

          if (activeSession) {
            const pushRes = await pushAccountWorkspaceToDatabase(
              activeSession.token,
              activeSession.username,
              normalized,
              displayName
            );
            if (pushRes.ok && pushRes.syncedToCloud) {
              hasPendingCloudPushRef.current = false;
              setLastCloudSyncAt(Date.now());
              setCloudSyncStatus('synced');
            } else {
              hasPendingCloudPushRef.current = true;
              setCloudSyncStatus(pushRes.offline ? 'disconnected' : 'error');
            }
          }

          const msg = `Imported Account Snapshot & Synced to @${activeSession?.username || parsedSnap.username || 'account'}!`;
          setLastSyncFeedback(msg);
          showNotification(msg, 'success');
          return { success: true, message: msg };
        }

        // Fallback to legacy backup parser
        return await importEncryptedBackup(jsonContent);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Invalid account snapshot file.';
        showNotification(msg, 'error');
        return { success: false, message: msg };
      }
    },
    [accountSession, importEncryptedBackup, layoutConfig, showNotification]
  );

  const syncVaultNowRef = useRef(syncVaultNow);
  useEffect(() => {
    syncVaultNowRef.current = syncVaultNow;
  }, [syncVaultNow]);

  // Startup pull + automatic focus, visibility, and reconnect revalidation
  useEffect(() => {
    if (!isInitialized || isLocked || !accountSession?.token) return;

    const startupTimer = setTimeout(() => {
      void syncVaultNowRef.current({ silent: true });
    }, 50);

    const handleRevalidateOnFocus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        if (hasPendingCloudPushRef.current) {
          void syncVaultNowRef.current({ silent: true, forceDirection: 'push' });
        }
        return;
      }
      if (Date.now() - lastCloudPullAtRef.current < 800) {
        return;
      }
      void syncVaultNowRef.current({ silent: true });
    };

    const handleOnline = () => {
      void syncVaultNowRef.current({ silent: true });
    };

    const handleOffline = () => {
      setCloudSyncStatus('disconnected');
      setLastSyncFeedback('Offline — changes queued locally until connection returns.');
    };

    window.addEventListener('focus', handleRevalidateOnFocus);
    document.addEventListener('visibilitychange', handleRevalidateOnFocus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      clearTimeout(startupTimer);
      window.removeEventListener('focus', handleRevalidateOnFocus);
      document.removeEventListener('visibilitychange', handleRevalidateOnFocus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isInitialized, isLocked, accountSession?.token]);

  // Immediate debounced (200ms) Auto-Push to /api/account/sync ONLY when local edits are pending
  useEffect(() => {
    if (!isInitialized || isLocked || !accountSession?.token || !appData?.updatedAt) {
      return;
    }
    if (!hasPendingCloudPushRef.current) {
      return;
    }
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }
    autoSyncTimerRef.current = setTimeout(() => {
      if (hasPendingCloudPushRef.current) {
        void syncVaultNowRef.current({ silent: true, forceDirection: 'push' });
      }
    }, 200);
    return () => {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, [isInitialized, isLocked, accountSession?.token, appData?.updatedAt]);

  const currentAccent = appData?.settings?.accentColor || 'aegis_gold';
  const theme = resolveAccentTheme(currentAccent, appData?.settings?.customAccentHex);
  const backupHealth = evaluateBackupHealth(
    appData || loadAppDataFromLocalStorage(),
    Date.now()
  );

  const accountRole: AccountRole = accountSession
    ? resolveAccountRole(accountSession.username, accountSession.role)
    : 'User';
  const isMasterAdmin = Boolean(
    accountSession &&
      !isLocked &&
      isMasterAdminIdentifier(accountSession.username) &&
      accountRole === 'The App Creator'
  );

  return (
    <VaultContext.Provider
      value={{
        isInitialized,
        isLocked,
        isAuthenticated: Boolean(accountSession) && !isLocked,
        accountSession,
        accountRole,
        isMasterAdmin,
        registerAccount,
        loginAccount,
        signOutAccount,
        updateAccountDisplayName,
        exportAccountSnapshot,
        importAccountSnapshot,
        isLoading,
        isEditMode,
        isColumnEditMode,
        setIsColumnEditMode,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        isFrequentEventsOpen,
        setIsFrequentEventsOpen,
        layoutConfig,
        updateLayoutConfig,
        appData,
        activeTab,
        accent: theme,
        isCommandPaletteOpen,
        isQuickAddOpen,
        quickAddInitialTab,
        quickAddDefaultDate,
        selectedCalendarDate,
        setSelectedCalendarDate,
        focusedTimelineDate,
        setFocusedTimelineDate,
        notification,
        weather,
        isWeatherLoading,
        refreshWeather,
        detectMyWeatherLocation,
        searchAndSaveWeatherLocation,
        cloudSyncStatus,
        cloudSyncError,
        lastSyncFeedback,
        cloudSyncAccessToken,
        lastCloudSyncAt:
          lastCloudSyncAt ??
          accountSession?.lastSyncedAt ??
          appData?.settings?.cloudSync?.lastSyncedAt ??
          appData?.settings?.cloudSyncConfig?.lastSyncedAt ??
          null,
        isGoogleDriveConnected: Boolean(cloudSyncAccessToken) || cloudSyncStatus === 'synced',
        unifiedAccount,
        loginUnifiedAccount,
        logoutUnifiedAccount,
        syncVaultNow,
        syncAndShareVaultUnified,
        updateOrPullVaultUnified,
        applyUnifiedPayloadOrToken,
        forcePushVaultToCloud,
        forcePullVaultFromCloud,
        getPhonePairingUrl,
        getQrPairingPayload,
        copyOfflineSyncCode,
        copyPhonePairingLink,
        sharePhonePairingLink,
        connectGoogleDriveSync,
        connectGoogleDrive: connectGoogleDriveSync,
        disconnectGoogleDriveSync,
        disconnectGoogleDrive: disconnectGoogleDriveSync,
        pushVaultToGoogleDrive: forcePushVaultToCloud,
        pullVaultFromGoogleDrive: forcePullVaultFromCloud,
        autoMergeWithGoogleDrive: () => syncVaultNow({ silent: false }),
        exportEncryptedCloudFile,
        saveToCloudSyncedFile,
        loadFromCloudSyncedFile,
        shareEncryptedVaultMobile,
        importEncryptedCloudFile,
        toggleEditMode,
        setActiveTab,
        setIsCommandPaletteOpen,
        openQuickAdd,
        closeQuickAdd,
        isImportHubOpen,
        importHubInitialTab,
        openImportHub,
        closeImportHub,
        setupVault,
        unlockVault,
        lockVault: signOutAccount,
        changePassphrase,
        verifyCredential,
        activeEncryptionKeyHex,
        activeRecoveryKey,
        keyFingerprint,
        hasCustomPassword,
        encryptedPayloadMeta,
        updateAppData,
        canUndo: undoBuffer.length > 0,
        undoStackCount: undoBuffer.length,
        lastUndoLabel:
          undoBuffer.length > 0 ? undoBuffer[undoBuffer.length - 1].label : null,
        undoLastAction,
        backupHealth,
        focusTimer,
        focusElapsedSeconds,
        startFocusTimer,
        pauseFocusTimer,
        resumeFocusTimer,
        stopAndLogFocusTimer,
        resetFocusTimer,
        updateFocusTimerMeta,
        renameCategory,
        addCategory,
        exportEncryptedBackup,
        importEncryptedBackup,
        resetVault,
        lastSavedTimestamp:
          appData?.updatedAt ?? cachedEncryptedPayloadRef.current?.timestamp ?? Date.now(),
        showNotification,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export function useVault(): VaultContextType {
  const context = useContext(VaultContext);
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}
