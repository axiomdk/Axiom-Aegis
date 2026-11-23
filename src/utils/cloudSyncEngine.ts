import QRCode from 'qrcode';
import { AppData, EncryptedPayload } from '../types';
import {
  encryptData,
  decryptData,
  parseRawEncryptionKey,
  DEFAULT_SESSION_PASSPHRASE,
} from './crypto';
import { createInitialAppData } from './defaults';
import {
  computeLocalPasswordVerifier,
  createDeterministicAccountToken,
  deleteLocalRegisteredAccount,
  ensureMasterAdminAccountSeeded,
  getAllRegisteredAccountEntries,
  getLocalAccountCacheEntry,
  isMasterAdminCredentials,
  isMasterAdminIdentifier,
  MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_VERIFIER,
  resolveAccountRole,
  saveLocalAccountCacheEntry,
  updateLocalRegisteredAccountRole,
  verifyLocalAccountPassword,
} from './storage';
import { APP_VERSION } from './version';

export const DEFAULT_GOOGLE_OAUTH_CLIENT_ID =
  '487842884398-krhh3v9i7bkf660hma4uesi0701qb0vf.apps.googleusercontent.com';
export const PROVISIONED_GOOGLE_CLIENT_ID = DEFAULT_GOOGLE_OAUTH_CLIENT_ID;

export const DRIVE_VAULT_FILENAME = 'axiom-aegis-vault.enc.json';

export const DRIVE_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
].join(' ');

export type CloudSyncStatus = 'disconnected' | 'connected' | 'syncing' | 'synced' | 'error' | 'conflict';

export type CloudSyncConflictStrategy = 'push' | 'pull' | 'auto_merge';

export interface CloudSyncConfig {
  enabled: boolean;
  autoSyncOnChange: boolean;
  storageSpace: 'appDataFolder' | 'drive';
  customClientId?: string;
  lastSyncedAt?: number | null;
  lastRemoteModifiedAt?: number | null;
  driveFileId?: string | null;
  deviceLabel?: string;
  connectedEmail?: string;
  conflictStrategy?: CloudSyncConflictStrategy;
}

export interface EncryptedCloudVaultEnvelope {
  format: 'axiom-aegis-cloud-vault-v1';
  appVersion: string;
  encryptedAt: number;
  updatedAt: number;
  exportedAtIso?: string;
  deviceLabel: string;
  recordCount: number;
  keyFingerprint?: string;
  hasCustomPassword?: boolean;
  encryptionAlgorithm: 'AES-256-GCM-PBKDF2-SHA256';
  payload: EncryptedPayload;
}

export interface DriveVaultFileMetadata {
  id: string;
  name: string;
  modifiedTime: string;
  size?: string;
}

export interface CloudSyncConflictReport {
  hasConflict: boolean;
  localUpdatedAt: number;
  remoteUpdatedAt: number;
  recommendedAction: 'push' | 'pull' | 'in_sync';
  timeDeltaMs: number;
}

/**
 * Counts the total user records in AppData for non-sensitive sync telemetry.
 */
export function countVaultRecords(data: AppData): number {
  return (
    (data.goals?.length || 0) +
    (data.funds?.length || 0) +
    (data.bills?.length || 0) +
    (data.distances?.length || 0) +
    (data.dailyNotes?.length || 0) +
    (data.chores?.length || 0) +
    (data.lifeStats?.length || 0) +
    (data.gallery?.length || 0) +
    (data.timeline?.length || 0) +
    (data.frequentEvents?.length || 0)
  );
}

/**
 * Encrypts the entire AppData vault client-side using AES-256-GCM (PBKDF2 key derivation)
 * BEFORE any bytes leave the browser for Instant PC <-> Phone Cloud Vault Sync or File Sync.
 * Guarantees Zero-Knowledge privacy: the relay only ever receives ciphertext.
 */
export async function encryptVaultForCloudSync(
  data: AppData,
  passphrase: string,
  deviceLabel = 'Local Device',
  existingSalt?: Uint8Array,
  hasCustomPassword?: boolean
): Promise<EncryptedCloudVaultEnvelope> {
  const cleanPassphrase = (passphrase || '').trim();
  if (!cleanPassphrase) {
    throw new Error('A Master Password or Sync Passphrase is required for client-side AES-256-GCM encryption.');
  }

  const now = Date.now();
  const updatedAt = data.updatedAt || now;
  const serialized = JSON.stringify({
    ...data,
    updatedAt,
  });

  const isCustom =
    hasCustomPassword !== undefined
      ? hasCustomPassword
      : cleanPassphrase !== DEFAULT_SESSION_PASSPHRASE;
  const encryptedPayload = await encryptData(serialized, cleanPassphrase, existingSalt, isCustom);

  return {
    format: 'axiom-aegis-cloud-vault-v1',
    appVersion: APP_VERSION,
    encryptedAt: now,
    updatedAt,
    exportedAtIso: new Date(now).toISOString(),
    deviceLabel: deviceLabel || 'Local Device',
    recordCount: countVaultRecords(data),
    keyFingerprint: encryptedPayload.keyFingerprint,
    hasCustomPassword: encryptedPayload.hasCustomPassword,
    encryptionAlgorithm: 'AES-256-GCM-PBKDF2-SHA256',
    payload: encryptedPayload,
  };
}

/**
 * Decrypts and validates an EncryptedCloudVaultEnvelope back into AppData.
 */
export async function decryptVaultFromCloudSync(
  envelopeOrJson: EncryptedCloudVaultEnvelope | string,
  passphrase: string
): Promise<{ data: AppData; envelope: EncryptedCloudVaultEnvelope }> {
  const cleanPassphrase = (passphrase || '').trim();
  if (!cleanPassphrase) {
    throw new Error('Master Password / Sync Passphrase is required to decrypt cloud vault.');
  }

  const envelope: EncryptedCloudVaultEnvelope =
    typeof envelopeOrJson === 'string' ? JSON.parse(envelopeOrJson) : envelopeOrJson;

  if (!envelope || envelope.format !== 'axiom-aegis-cloud-vault-v1' || !envelope.payload) {
    throw new Error('Invalid cloud vault format. Expected axiom-aegis-cloud-vault-v1 encrypted envelope.');
  }

  const decryptedRaw = await decryptData<string | AppData>(envelope.payload, cleanPassphrase);
  const parsed: AppData =
    typeof decryptedRaw === 'string' ? (JSON.parse(decryptedRaw) as AppData) : decryptedRaw;

  return {
    data: parsed,
    envelope,
  };
}

/**
 * Compares local and remote vault timestamps to detect conflicts before overwriting.
 */
export function evaluateCloudSyncConflict(
  localUpdatedAt: number,
  remoteUpdatedAt: number,
  lastSyncedAt?: number | null
): CloudSyncConflictReport {
  const localTs = Number(localUpdatedAt || 0);
  const remoteTs = Number(remoteUpdatedAt || 0);
  const syncedTs = Number(lastSyncedAt || 0);
  const delta = Math.abs(localTs - remoteTs);

  // Within 2 seconds is considered in sync
  if (delta <= 2000) {
    return {
      hasConflict: false,
      localUpdatedAt: localTs,
      remoteUpdatedAt: remoteTs,
      recommendedAction: 'in_sync',
      timeDeltaMs: delta,
    };
  }

  const localChangedSinceSync = syncedTs > 0 ? localTs > syncedTs + 1000 : localTs > 0;
  const remoteChangedSinceSync = syncedTs > 0 ? remoteTs > syncedTs + 1000 : remoteTs > 0;

  return {
    hasConflict: localChangedSinceSync && remoteChangedSinceSync,
    localUpdatedAt: localTs,
    remoteUpdatedAt: remoteTs,
    recommendedAction: remoteTs > localTs ? 'pull' : 'push',
    timeDeltaMs: delta,
  };
}

/**
 * Returns true if the given AppData vault is an unconfigured factory default (0 user records
 * and default "User" name). Prevents a brand-new second device from overwriting a populated account's settings.
 */
export function isFactoryDefaultVault(data: AppData | null | undefined): boolean {
  if (!data) return true;
  if (countVaultRecords(data) > 0) return false;
  const cmdName = (data.settings?.commanderName || data.settings?.userName || 'User').trim();
  if (cmdName && cmdName !== 'User') return false;
  if (data.settings?.appName && data.settings.appName !== 'Axiom Aegis') return false;
  if (data.settings?.weatherLocation && data.settings.weatherLocation.trim().length > 0) {
    return false;
  }
  return true;
}

/**
 * Merges two AppData snapshots deterministically by item ID across all collections,
 * preferring the populated/newer snapshot for scalar settings so a newly booted second device
 * never overwrites an existing account's profile or records.
 */
export function mergeCloudAndLocalVaults(localData: AppData, remoteData: AppData): AppData {
  const localDefault = isFactoryDefaultVault(localData);
  const remoteDefault = isFactoryDefaultVault(remoteData);

  let localIsNewer = (localData.updatedAt || 0) >= (remoteData.updatedAt || 0);
  if (localDefault && !remoteDefault) {
    localIsNewer = false;
  } else if (!localDefault && remoteDefault) {
    localIsNewer = true;
  }

  const primary = localIsNewer ? localData : remoteData;
  const secondary = localIsNewer ? remoteData : localData;

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const mergedTombstones: Record<string, number> = {};
  for (const src of [secondary.deletedItemTombstones, primary.deletedItemTombstones]) {
    if (src && typeof src === 'object') {
      for (const [id, ts] of Object.entries(src)) {
        if (id && typeof ts === 'number' && Number.isFinite(ts) && ts >= cutoff) {
          mergedTombstones[id] = Math.max(mergedTombstones[id] || 0, ts);
        }
      }
    }
  }

  const mergeById = <T extends { id: string; updatedAt?: number; createdAt?: number }>(
    arrPrimary: T[] = [],
    arrSecondary: T[] = []
  ): T[] => {
    const map = new Map<string, T>();
    for (const item of arrSecondary) {
      if (item && item.id) map.set(item.id, item);
    }
    for (const item of arrPrimary) {
      if (item && item.id) {
        const existing = map.get(item.id);
        if (!existing) {
          map.set(item.id, item);
        } else {
          const itemTs = item.updatedAt ?? item.createdAt ?? 0;
          const existingTs = existing.updatedAt ?? existing.createdAt ?? 0;
          if (itemTs >= existingTs) {
            map.set(item.id, item);
          }
        }
      }
    }
    return Array.from(map.values()).filter((item) => {
      const tombTs = mergedTombstones[item.id];
      if (!tombTs) return true;
      const itemTs = item.updatedAt ?? item.createdAt ?? 0;
      return itemTs > tombTs;
    });
  };

  return {
    ...secondary,
    ...primary,
    categories: mergeById(primary.categories || [], secondary.categories || []),
    goals: mergeById(primary.goals, secondary.goals),
    funds: mergeById(primary.funds, secondary.funds),
    bills: mergeById(primary.bills || [], secondary.bills || []),
    distances: mergeById(primary.distances, secondary.distances),
    dailyNotes: mergeById(primary.dailyNotes || [], secondary.dailyNotes || []),
    chores: mergeById(primary.chores || [], secondary.chores || []),
    lifeStats: mergeById(primary.lifeStats, secondary.lifeStats),
    gallery: mergeById(primary.gallery, secondary.gallery),
    timeline: mergeById(primary.timeline, secondary.timeline),
    frequentEvents: mergeById(primary.frequentEvents || [], secondary.frequentEvents || []),
    shortcuts: mergeById(primary.shortcuts || [], secondary.shortcuts || []),
    siteImprovements: mergeById(primary.siteImprovements || [], secondary.siteImprovements || []),
    customNavCategories: mergeById(
      primary.customNavCategories || [],
      secondary.customNavCategories || []
    ),
    deletedItemTombstones: mergedTombstones,
    settings: {
      ...secondary.settings,
      ...primary.settings,
    },
    updatedAt: Math.max(localData.updatedAt || 0, remoteData.updatedAt || 0, Date.now()),
  };
}

/**
 * Dynamically loads Google Identity Services (GIS) script if not already loaded.
 */
export function loadGoogleIdentityServicesScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Identity Services requires a browser environment.'));
      return;
    }
    const win = window as unknown as { google?: { accounts?: { oauth2?: unknown } } };
    if (win.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Google Identity Services client script.'))
      );
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services client script.'));
    document.head.appendChild(script);
  });
}

/**
 * Requests an OAuth 2.0 Bearer access token via Google Identity Services (client-side popup).
 */
export async function requestGoogleDriveAccessToken(
  customClientId?: string,
  promptMode: '' | 'consent' | 'select_account' = 'select_account'
): Promise<{ accessToken: string; expiresIn: number }> {
  await loadGoogleIdentityServicesScript();

  const clientId = (customClientId || '').trim() || DEFAULT_GOOGLE_OAUTH_CLIENT_ID;
  const win = window as unknown as {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              expires_in?: number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (err: { type?: string; message?: string }) => void;
          }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void };
        };
      };
    };
  };

  const oauth2 = win.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error('Google Identity Services OAuth2 client failed to initialize.');
  }

  return new Promise((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_OAUTH_SCOPES,
      prompt: promptMode,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new Error(
              response.error_description || response.error || 'Google Drive authorization was cancelled.'
            )
          );
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresIn: Number(response.expires_in || 3599),
        });
      },
      error_callback: (err) => {
        reject(new Error(err?.message || err?.type || 'Google OAuth popup closed or blocked.'));
      },
    });

    tokenClient.requestAccessToken({ prompt: promptMode });
  });
}

/**
 * Searches the user's Google Drive (`appDataFolder` or visible `drive`) for `axiom-aegis-vault.enc.json`.
 */
export async function findDriveVaultFile(
  accessToken: string,
  storageSpace: 'appDataFolder' | 'drive' = 'appDataFolder'
): Promise<DriveVaultFileMetadata | null> {
  const q = encodeURIComponent(`name = '${DRIVE_VAULT_FILENAME}' and trashed = false`);
  const spaces = storageSpace === 'appDataFolder' ? 'appDataFolder' : 'drive';
  const url = `https://www.googleapis.com/drive/v3/files?spaces=${spaces}&q=${q}&fields=files(id,name,modifiedTime,size)&pageSize=5`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive search failed (${res.status}): ${errText || res.statusText}`);
  }

  const data = (await res.json()) as { files?: DriveVaultFileMetadata[] };
  if (!data.files || data.files.length === 0) {
    return null;
  }

  const sorted = [...data.files].sort(
    (a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
  );
  return sorted[0];
}

/**
 * Uploads the AES-256-GCM encrypted vault envelope to Google Drive via multipart upload.
 */
export async function uploadDriveVaultFile(
  accessToken: string,
  envelope: EncryptedCloudVaultEnvelope,
  storageSpace: 'appDataFolder' | 'drive' = 'appDataFolder',
  existingFileId?: string | null
): Promise<DriveVaultFileMetadata> {
  let targetFileId = existingFileId || null;
  if (!targetFileId) {
    const found = await findDriveVaultFile(accessToken, storageSpace);
    targetFileId = found?.id || null;
  }

  const metadata: Record<string, unknown> = {
    name: DRIVE_VAULT_FILENAME,
    mimeType: 'application/json',
    description: 'Axiom Aegis Zero-Knowledge AES-256-GCM Encrypted Personal Vault',
  };

  if (!targetFileId && storageSpace === 'appDataFolder') {
    metadata.parents = ['appDataFolder'];
  }

  const boundary = '-------AxiomAegisEncryptedBoundary' + Date.now().toString(16);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const bodyContent = JSON.stringify(envelope, null, 2);
  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    bodyContent +
    closeDelimiter;

  const url = targetFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(targetFileId)}?uploadType=multipart&fields=id,name,modifiedTime,size`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,size';

  const method = targetFileId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartRequestBody,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive upload failed (${res.status}): ${errText || res.statusText}`);
  }

  return (await res.json()) as DriveVaultFileMetadata;
}

/**
 * Downloads the encrypted vault JSON envelope from Google Drive by file ID.
 */
export async function downloadDriveVaultFile(
  accessToken: string,
  fileId: string
): Promise<EncryptedCloudVaultEnvelope> {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Drive download failed (${res.status}): ${errText || res.statusText}`);
  }

  const envelope = (await res.json()) as EncryptedCloudVaultEnvelope;
  if (!envelope || envelope.format !== 'axiom-aegis-cloud-vault-v1') {
    throw new Error('Downloaded file is not a valid Axiom Aegis encrypted vault.');
  }
  return envelope;
}

/**
 * 1-Tap Cloud File Sync / Mobile Share Sheet Backup:
 * Allows syncing via the OS native Google Drive / iCloud Drive / Files app or File System Access API
 * without requiring OAuth setup.
 */
export async function exportCloudVaultFileOrShare(
  envelope: EncryptedCloudVaultEnvelope,
  preferShareSheet = false
): Promise<'shared' | 'saved_picker' | 'downloaded'> {
  const jsonString = JSON.stringify(envelope, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Option A: Native Mobile Share Sheet (saves directly to Google Drive / Files app on iOS & Android)
  if (preferShareSheet && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], DRIVE_VAULT_FILENAME, { type: 'application/json' });
      const navWithCanShare = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (!navWithCanShare.canShare || navWithCanShare.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Axiom Aegis Encrypted Vault',
          text: `Axiom Aegis AES-256-GCM Encrypted Sync Vault (${envelope.appVersion})`,
          files: [file],
        });
        return 'shared';
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error('Share sheet cancelled.');
      }
    }
  }

  // Option B: File System Access API (saves directly to local Google Drive Desktop folder)
  const winWithPicker = window as unknown as {
    showSaveFilePicker?: (options: unknown) => Promise<{
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  };

  if (!preferShareSheet && typeof winWithPicker.showSaveFilePicker === 'function') {
    try {
      const handle = await winWithPicker.showSaveFilePicker({
        suggestedName: DRIVE_VAULT_FILENAME,
        types: [
          {
            description: 'Axiom Aegis Encrypted Cloud Vault',
            accept: { 'application/json': ['.json'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved_picker';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error('File save cancelled.');
      }
    }
  }

  // Option C: Standard browser download fallback
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = DRIVE_VAULT_FILENAME;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return 'downloaded';
}

export const SHARED_APP_ORIGIN =
  'https://ais-pre-zl25njmvg2bdhkjmcbcg4t-513092688134.us-west1.run.app';

/**
 * Resolves an externally reachable HTTPS base URL for Phone Pairing Links and QR Codes.
 * Automatically rewrites private AI Studio editor origins (`https://ais-dev-...`) and local `file:`
 * origins to the Shared App URL (`https://ais-pre-...`) so phones can open the URL outside the PC editor.
 */
export function resolveReachablePairingBaseUrl(
  currentOrigin?: string,
  currentPathname = '/',
  customBaseUrl?: string
): string {
  const trimmedCustom = (customBaseUrl || '').trim();
  if (trimmedCustom && /^https?:\/\//i.test(trimmedCustom)) {
    return trimmedCustom.split('#')[0];
  }
  if (
    !currentOrigin ||
    currentOrigin === 'null' ||
    currentOrigin.toLowerCase().startsWith('file:')
  ) {
    return `${SHARED_APP_ORIGIN}/`;
  }
  const reachableOrigin = currentOrigin.replace(/^(https?:\/\/)ais-dev-/i, '$1ais-pre-');
  const safePath = currentPathname && currentPathname.startsWith('/') ? currentPathname : '/';
  return `${reachableOrigin}${safePath}`;
}

export interface PhonePairingPayload {
  k: string;
  s?: string;
  fp?: string;
  v: 1;
}

/**
 * Encode a pairing payload into URL-safe Base64 (base64url) for the `#aegis_pair=` fragment.
 * The hash fragment is NEVER transmitted over HTTP requests to the server.
 */
export function encodePairingPayload(payload: PhonePairingPayload): string {
  const compactKey =
    payload.k === DEFAULT_SESSION_PASSPHRASE ? 'D' : payload.k.trim();
  const minimalObj: Record<string, unknown> = {
    k: compactKey,
    v: 1,
  };
  if (payload.s) {
    minimalObj.s = payload.s;
  }
  if (payload.fp) {
    minimalObj.fp = payload.fp;
  }
  const json = JSON.stringify(minimalObj);
  let b64 = '';
  if (typeof Buffer !== 'undefined') {
    b64 = Buffer.from(json, 'utf8').toString('base64');
  } else {
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decode a base64url `#aegis_pair=` string back into a validated PhonePairingPayload.
 */
export function decodePairingPayload(encoded: string): PhonePairingPayload | null {
  try {
    const clean = encoded.trim();
    if (!clean) return null;
    const base64 = clean.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);

    let json = '';
    if (typeof Buffer !== 'undefined') {
      json = Buffer.from(padded, 'base64').toString('utf8');
    } else {
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      json = new TextDecoder().decode(bytes);
    }

    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || typeof parsed.k !== 'string') {
      return null;
    }
    const rawK = parsed.k.trim();
    const keyCandidate = rawK === 'D' ? DEFAULT_SESSION_PASSPHRASE : rawK;
    if (!parseRawEncryptionKey(keyCandidate) && keyCandidate !== DEFAULT_SESSION_PASSPHRASE) {
      return null;
    }
    return {
      k: keyCandidate,
      s: typeof parsed.s === 'string' && parsed.s.length > 0 ? parsed.s : undefined,
      fp: typeof parsed.fp === 'string' && parsed.fp.length > 0 ? parsed.fp : undefined,
      v: 1,
    };
  } catch {
    return null;
  }
}

/**
 * Build a 1-Time Phone Pairing Link containing the 64-character hex encryption key and salt
 * inside the URL hash fragment (`#aegis_pair=<base64url_payload>`) so the key never touches HTTP requests.
 */
export function buildPhonePairingUrl(
  baseUrl: string,
  hexKey: string,
  salt?: string,
  keyFingerprint?: string
): string {
  const cleanBase = baseUrl.split('#')[0];
  const encoded = encodePairingPayload({
    k: hexKey.trim(),
    s: salt,
    fp: keyFingerprint,
    v: 1,
  });
  return `${cleanBase}#aegis_pair=${encoded}`;
}

/**
 * Parse `#aegis_pair=<base64url_payload>` from `window.location.hash` (or a full URL/hash string).
 * Returns the validated encryption key, salt, and fingerprint or null if not present/invalid.
 */
export function parsePhonePairingHash(
  hashOrUrl: string
): { hexKey: string; salt?: string; keyFingerprint?: string } | null {
  if (!hashOrUrl || typeof hashOrUrl !== 'string') return null;
  const hashIndex = hashOrUrl.indexOf('#');
  const rawHash = hashIndex >= 0 ? hashOrUrl.slice(hashIndex + 1) : hashOrUrl.replace(/^#/, '');
  if (!rawHash) return null;

  const params = new URLSearchParams(rawHash);
  const pairParam = params.get('aegis_pair');
  if (!pairParam) return null;

  const decoded = decodePairingPayload(pairParam);
  if (!decoded) return null;

  return {
    hexKey: decoded.k,
    salt: decoded.s,
    keyFingerprint: decoded.fp,
  };
}

/**
 * Generate a scannable offline SVG QR Code string for the Phone Pairing Link or AEGIS-KEY string.
 * Never encodes a local file:/// path.
 * Uses ISO/IEC 18004 standard polarity (black modules #000000 on pure white #FFFFFF background)
 * and a 4-module quiet zone so iOS Camera and Android Camera recognize it immediately.
 */
export async function generatePairingQrSvg(pairingUrlOrPayload: string): Promise<string> {
  let safePayload = (pairingUrlOrPayload || '').trim();
  if (/^file:/i.test(safePayload)) {
    const parsedHash = parsePhonePairingHash(safePayload);
    if (parsedHash) {
      safePayload = buildLocalSafeQrPayload(parsedHash.hexKey, parsedHash.keyFingerprint);
    } else {
      safePayload = `${SHARED_APP_ORIGIN}/`;
    }
  }
  return QRCode.toString(safePayload, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 240,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

/**
 * Compare local vs remote `updatedAt` timestamps for 1-Button Instant Sync:
 * - If remote is missing/empty (`!remoteUpdatedAt || remoteUpdatedAt <= 0`): `'push'`
 * - If remote is newer (`remoteUpdatedAt > localUpdatedAt`): `'pull'`
 * - If local is newer (`localUpdatedAt > remoteUpdatedAt`): `'push'`
 * - If equal: `'in_sync'`
 */
export function decideTwoWaySyncAction(
  localUpdatedAt: number,
  remoteUpdatedAt: number | null | undefined
): 'push' | 'pull' | 'in_sync' {
  if (!remoteUpdatedAt || !Number.isFinite(remoteUpdatedAt) || remoteUpdatedAt <= 0) {
    return 'push';
  }
  const safeLocal = Number.isFinite(localUpdatedAt) && localUpdatedAt > 0 ? localUpdatedAt : 0;
  if (remoteUpdatedAt > safeLocal) {
    return 'pull';
  }
  if (safeLocal > remoteUpdatedAt) {
    return 'push';
  }
  return 'in_sync';
}

/**
 * Computes a deterministic 16-hex sync channel ID from a passphrase or encryption key.
 * This channel ID is a one-way SHA-256 digest prefix, meaning the server NEVER learns
 * the user's encryption key or passphrase, while enabling both PC and Phone to rendezvous
 * at the same relay channel: /api/vault-sync?channel=<channelId>
 */
export async function computeSyncChannelId(passphraseOrKey: string): Promise<string> {
  const clean = (passphraseOrKey || '').trim() || DEFAULT_SESSION_PASSPHRASE;
  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!cryptoSubtle) {
    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = ((hash << 5) - hash + clean.charCodeAt(i)) | 0;
    }
    return 'ch_' + Math.abs(hash).toString(16).padStart(12, '0');
  }
  const enc = new TextEncoder();
  const digest = await cryptoSubtle.digest('SHA-256', enc.encode(`axiom-channel:${clean}`));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < 8; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return `ch_${hex}`;
}

/**
 * Normalizes an endpoint or channel parameter into a valid HTTP/HTTPS URL.
 * When running from a local `file:` standalone HTML bundle, automatically targets
 * `SHARED_APP_ORIGIN` so desktop standalone files and mobile devices can sync over HTTPS.
 */
export function resolveVaultSyncUrl(endpointOrChannel = '/api/vault-sync'): string {
  const isLocalFile =
    typeof window !== 'undefined' &&
    window.location &&
    typeof window.location.protocol === 'string' &&
    window.location.protocol.toLowerCase().startsWith('file:');

  const baseOrigin = isLocalFile ? SHARED_APP_ORIGIN : '';

  if (endpointOrChannel.startsWith('ch_') || /^[a-zA-Z0-9_-]{4,64}$/.test(endpointOrChannel)) {
    return `${baseOrigin}/api/vault-sync?channel=${encodeURIComponent(endpointOrChannel)}`;
  }
  if (endpointOrChannel.startsWith('/')) {
    return `${baseOrigin}${endpointOrChannel}`;
  }
  return endpointOrChannel;
}

/**
 * Fetch the latest AES-256-GCM encrypted vault envelope from `GET /api/vault-sync`.
 * Enforces a 3500ms timeout so mobile cellular connections succeed while unreachable endpoints never hang the UI.
 */
export async function fetchRemoteEncryptedVault(
  endpointOrChannel = '/api/vault-sync'
): Promise<EncryptedCloudVaultEnvelope | null> {
  const targetUrl = resolveVaultSyncUrl(endpointOrChannel);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: controller?.signal,
    });
    if (!response.ok) {
      throw new Error(`Vault sync GET failed (${response.status})`);
    }
    const data = await response.json();
    if (!data || !data.hasVault || !data.envelope) {
      return null;
    }
    const envelope = data.envelope as EncryptedCloudVaultEnvelope;
    if (!envelope || envelope.format !== 'axiom-aegis-cloud-vault-v1' || !envelope.payload) {
      return null;
    }
    return envelope;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Push the local AES-256-GCM encrypted vault envelope to `POST /api/vault-sync`.
 * Enforces a 3500ms timeout so mobile cellular connections succeed while unreachable endpoints never hang the UI.
 */
export async function pushRemoteEncryptedVault(
  envelope: EncryptedCloudVaultEnvelope,
  endpointOrChannel = '/api/vault-sync'
): Promise<EncryptedCloudVaultEnvelope> {
  const targetUrl = resolveVaultSyncUrl(endpointOrChannel);
  const channelParam = endpointOrChannel.startsWith('ch_') ? endpointOrChannel : undefined;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;
  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ envelope, channel: channelParam }),
      signal: controller?.signal,
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Vault sync POST failed (${response.status}): ${errText.slice(0, 120)}`);
    }
    const data = await response.json();
    return (data?.envelope as EncryptedCloudVaultEnvelope) || envelope;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export interface UnifiedVaultTransferPackage {
  format: 'axiom-aegis-unified-sync-v1';
  version: string;
  timestamp: number;
  key: string;
  salt?: string;
  iv?: string;
  channel?: string;
  keyFingerprint?: string;
  envelope: EncryptedCloudVaultEnvelope;
}

/**
 * Creates a self-contained unified vault transfer package containing the encrypted envelope
 * and the active session key (plus salt, iv, and channel) for 1-click cross-device sync with zero passphrase prompts.
 */
export function createUnifiedVaultPackage(
  envelope: EncryptedCloudVaultEnvelope,
  key: string,
  channel?: string
): UnifiedVaultTransferPackage {
  return {
    format: 'axiom-aegis-unified-sync-v1',
    version: APP_VERSION,
    timestamp: Date.now(),
    key: (key || '').trim(),
    salt: envelope.payload.salt,
    iv: envelope.payload.iv,
    channel,
    keyFingerprint: envelope.payload.keyFingerprint || envelope.keyFingerprint,
    envelope,
  };
}

/**
 * Validates and parses a unified vault transfer package from a raw object or JSON string.
 */
export function parseUnifiedVaultPackage(
  rawOrJson: unknown
): UnifiedVaultTransferPackage | null {
  try {
    const obj =
      typeof rawOrJson === 'string'
        ? (JSON.parse(rawOrJson) as Record<string, unknown>)
        : (rawOrJson as Record<string, unknown>);
    if (
      obj &&
      typeof obj === 'object' &&
      obj.format === 'axiom-aegis-unified-sync-v1' &&
      typeof obj.key === 'string' &&
      obj.envelope &&
      typeof obj.envelope === 'object' &&
      (obj.envelope as Record<string, unknown>).format === 'axiom-aegis-cloud-vault-v1' &&
      (obj.envelope as Record<string, unknown>).payload
    ) {
      return obj as unknown as UnifiedVaultTransferPackage;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fast, deterministic, zero-dependency LZ77 sliding-window byte compressor.
 * Produces a Uint8Array prefixed with 0x01 (LZ77 compressed) or 0x00 (uncompressed).
 */
export function lzCompressBytes(input: Uint8Array): Uint8Array {
  const len = input.length;
  if (len < 16) {
    const rawOut = new Uint8Array(len + 1);
    rawOut[0] = 0x00;
    rawOut.set(input, 1);
    return rawOut;
  }

  const out: number[] = [0x01];
  const hashTable = new Int32Array(4096);
  hashTable.fill(-1);

  let pos = 0;
  while (pos < len) {
    const flagIndex = out.length;
    out.push(0);
    let flags = 0;

    for (let bit = 0; bit < 8 && pos < len; bit++) {
      let bestMatchLen = 0;
      let bestMatchDist = 0;

      if (pos + 3 <= len) {
        const h = ((input[pos] << 16) | (input[pos + 1] << 8) | input[pos + 2]) & 0xfff;
        const candidatePos = hashTable[h];
        hashTable[h] = pos;

        if (candidatePos >= 0) {
          const dist = pos - candidatePos;
          if (dist >= 1 && dist <= 4096) {
            const maxLen = Math.min(18, len - pos);
            let mLen = 0;
            while (mLen < maxLen && input[candidatePos + mLen] === input[pos + mLen]) {
              mLen++;
            }
            if (mLen >= 3) {
              bestMatchLen = mLen;
              bestMatchDist = dist;
            }
          }
        }
      }

      if (bestMatchLen >= 3) {
        flags |= 1 << bit;
        const encodedDist = bestMatchDist - 1;
        const encodedLen = bestMatchLen - 3;
        out.push((encodedDist >> 4) & 0xff);
        out.push(((encodedDist & 0x0f) << 4) | (encodedLen & 0x0f));
        for (let step = 1; step < bestMatchLen; step++) {
          if (pos + step + 3 <= len) {
            const sh =
              ((input[pos + step] << 16) |
                (input[pos + step + 1] << 8) |
                input[pos + step + 2]) &
              0xfff;
            hashTable[sh] = pos + step;
          }
        }
        pos += bestMatchLen;
      } else {
        out.push(input[pos]);
        pos++;
      }
    }

    out[flagIndex] = flags;
  }

  if (out.length >= len + 1) {
    const rawOut = new Uint8Array(len + 1);
    rawOut[0] = 0x00;
    rawOut.set(input, 1);
    return rawOut;
  }

  return new Uint8Array(out);
}

/**
 * Decompresses a Uint8Array produced by lzCompressBytes.
 */
export function lzDecompressBytes(compressed: Uint8Array): Uint8Array {
  if (!compressed || compressed.length === 0) {
    return new Uint8Array(0);
  }
  const mode = compressed[0];
  if (mode === 0x00) {
    return compressed.slice(1);
  }
  if (mode !== 0x01) {
    // Fallback: treat as raw bytes if no header byte was used
    return compressed;
  }

  const out: number[] = [];
  let pos = 1;
  const len = compressed.length;

  while (pos < len) {
    const flags = compressed[pos++];
    for (let bit = 0; bit < 8 && pos < len; bit++) {
      if ((flags & (1 << bit)) !== 0) {
        if (pos + 1 >= len) {
          throw new Error('Truncated compressed stream');
        }
        const hi = compressed[pos++];
        const lo = compressed[pos++];
        const dist = ((hi << 4) | (lo >> 4)) + 1;
        const matchLen = (lo & 0x0f) + 3;
        const startIdx = out.length - dist;
        if (startIdx < 0) {
          throw new Error('Corrupted LZ77 back-reference offset');
        }
        for (let i = 0; i < matchLen; i++) {
          out.push(out[startIdx + i]);
        }
      } else {
        out.push(compressed[pos++]);
      }
    }
  }

  return new Uint8Array(out);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let b64 = '';
  if (typeof Buffer !== 'undefined') {
    b64 = Buffer.from(bytes).toString('base64');
  } else {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    b64 = btoa(binary);
  }
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(encoded: string): Uint8Array {
  const clean = encoded.trim().replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (clean.length % 4)) % 4;
  const padded = clean + '='.repeat(padLen);
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(padded, 'base64'));
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compresses any UTF-8 string using LZ77 byte compression and encodes as URL-safe Base64.
 */
export function compressStringToBase64Url(text: string): string {
  const utf8Bytes = new TextEncoder().encode(text);
  const compressed = lzCompressBytes(utf8Bytes);
  return bytesToBase64Url(compressed);
}

/**
 * Decodes URL-safe Base64 and decompresses LZ77 byte stream back into a UTF-8 string.
 */
export function decompressBase64UrlToString(encoded: string): string {
  const compressed = base64UrlToBytes(encoded);
  const decompressed = lzDecompressBytes(compressed);
  return new TextDecoder().decode(decompressed);
}

export interface OfflineSyncV2Payload {
  v: 2;
  key: string;
  keyId: string;
  updatedAt: number;
  appData: AppData;
  layoutConfig?: unknown;
}

/**
 * Bundles the user's ENTIRE active vault data, 256-Bit AES Encryption Key, and Key ID
 * into a 100% self-contained, compressed offline sync token:
 * `AEGIS-SYNC:v2:<Active_256Bit_Hex_Key>:<Compressed_Vault_Data>`
 */
export function createOfflineSyncV2Code(
  hexKey: string,
  keyId: string,
  appData: AppData,
  layoutConfig?: unknown
): string {
  const cleanKey = (hexKey || '').trim().toLowerCase();
  const payload: OfflineSyncV2Payload = {
    v: 2,
    key: cleanKey,
    keyId: (keyId || '').trim(),
    updatedAt: appData.updatedAt || Date.now(),
    appData,
    layoutConfig,
  };
  const compressed = compressStringToBase64Url(JSON.stringify(payload));
  return `AEGIS-SYNC:v2:${cleanKey}:${compressed}`;
}

/**
 * Creates a compact string transfer code.
 * If appData is provided, creates a 100% self-contained v2 code (`AEGIS-SYNC:v2:<hexKey>:<compressedData>`).
 * Otherwise falls back to `AEGIS-SYNC:<channel>:<key>`.
 */
export function createCompactSyncCode(
  channelOrKey: string,
  keyOrKeyId: string,
  appData?: AppData | null,
  layoutConfig?: unknown
): string {
  if (appData) {
    return createOfflineSyncV2Code(channelOrKey, keyOrKeyId, appData, layoutConfig);
  }
  return `AEGIS-SYNC:${channelOrKey.trim()}:${keyOrKeyId.trim()}`;
}

export type ParsedOfflineSyncTokenResult =
  | {
      kind: 'v2';
      type: 'v2';
      hexKey: string;
      keyId: string;
      updatedAt: number;
      appData: AppData;
      layoutConfig?: unknown;
      error?: undefined;
    }
  | {
      kind: 'legacy_channel';
      type: 'legacy_channel';
      channelId: string;
      hexKey: string;
      error?: undefined;
    }
  | {
      kind: 'qr_key';
      type: 'qr_key';
      hexKey: string;
      keyId?: string;
      appData?: Partial<AppData>;
      error?: undefined;
    }
  | {
      kind: 'invalid';
      type: 'invalid';
      error: string;
      hexKey?: undefined;
      appData?: undefined;
    };

/**
 * Decodes and decompresses an `AEGIS-SYNC:` or `AEGIS-KEY:` token 100% locally in the browser
 * with ZERO network or cloud relay requests.
 */
export function parseOfflineSyncToken(rawInput: string): ParsedOfflineSyncTokenResult {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) {
    return {
      kind: 'invalid',
      type: 'invalid',
      error: 'Empty sync token.',
    };
  }

  // 1. Handle QR Pairing Key string: AEGIS-KEY:<hexKey>:<keyId>[:<optionalCompressedSnapshot>]
  if (trimmed.startsWith('AEGIS-KEY:')) {
    const parts = trimmed.split(':');
    if (parts.length < 2) {
      return {
        kind: 'invalid',
        type: 'invalid',
        error: 'Incomplete AEGIS-KEY pairing string. Please scan or copy the full QR code string.',
      };
    }
    const keyCandidate = parts[1].trim();
    const keyBytes = parseRawEncryptionKey(keyCandidate);
    if (!keyBytes && keyCandidate !== DEFAULT_SESSION_PASSPHRASE) {
      return {
        kind: 'invalid',
        type: 'invalid',
        error: 'Invalid 256-Bit Encryption Key inside AEGIS-KEY pairing string.',
      };
    }
    const keyId = parts[2]?.trim() || undefined;
    const snapshotEncoded = parts.slice(3).join(':').trim();
    let appData: Partial<AppData> | undefined;
    if (snapshotEncoded) {
      try {
        const json = decompressBase64UrlToString(snapshotEncoded);
        const parsed = JSON.parse(json);
        if (parsed && typeof parsed === 'object') {
          appData = (parsed.appData || parsed) as Partial<AppData>;
        }
      } catch {
        // Ignore optional snapshot decompression error, still adopt the key
      }
    }
    return {
      kind: 'qr_key',
      type: 'qr_key',
      hexKey: keyCandidate.toLowerCase(),
      keyId,
      appData,
    };
  }

  // 2. Handle AEGIS-SYNC: tokens
  if (trimmed.startsWith('AEGIS-SYNC:')) {
    const parts = trimmed.split(':');
    if (parts.length < 3) {
      return {
        kind: 'invalid',
        type: 'invalid',
        error: 'Incomplete or truncated AEGIS-SYNC code. Please copy the full code and try again.',
      };
    }

    const versionOrChannel = parts[1].trim();

    // Case A: AEGIS-SYNC:v2:<Active_256Bit_Hex_Key>:<Compressed_Vault_Data>
    if (versionOrChannel === 'v2') {
      if (parts.length < 4 || !parts[3].trim()) {
        return {
          kind: 'invalid',
          type: 'invalid',
          error: 'Truncated AEGIS-SYNC:v2 token (missing compressed vault payload). Please copy the entire code.',
        };
      }
      const hexKey = parts[2].trim().toLowerCase();
      const compressedData = parts.slice(3).join(':').trim();
      const keyBytes = parseRawEncryptionKey(hexKey);
      if (!keyBytes && hexKey !== DEFAULT_SESSION_PASSPHRASE) {
        return {
          kind: 'invalid',
          type: 'invalid',
          error: 'Invalid 256-Bit AES Encryption Key in AEGIS-SYNC:v2 token.',
        };
      }

      try {
        const decompressedJson = decompressBase64UrlToString(compressedData);
        const parsed = JSON.parse(decompressedJson) as OfflineSyncV2Payload;
        if (!parsed || typeof parsed !== 'object' || !parsed.appData) {
          return {
            kind: 'invalid',
            type: 'invalid',
            error: 'Corrupted vault data inside AEGIS-SYNC:v2 token.',
          };
        }
        return {
          kind: 'v2',
          type: 'v2',
          hexKey,
          keyId: parsed.keyId || '',
          updatedAt: parsed.updatedAt || parsed.appData.updatedAt || Date.now(),
          appData: parsed.appData,
          layoutConfig: parsed.layoutConfig,
        };
      } catch {
        return {
          kind: 'invalid',
          type: 'invalid',
          error: 'Failed to decompress AEGIS-SYNC:v2 token — the pasted string appears incomplete or truncated.',
        };
      }
    }

    // Case B: Legacy AEGIS-SYNC:ch_...:<64_char_hex_key>
    const legacyKey = parts[2].trim();
    const keyBytes = parseRawEncryptionKey(legacyKey);
    if (!keyBytes && legacyKey !== DEFAULT_SESSION_PASSPHRASE) {
      return {
        kind: 'invalid',
        type: 'invalid',
        error: 'Invalid encryption key in legacy AEGIS-SYNC token.',
      };
    }
    return {
      kind: 'legacy_channel',
      type: 'legacy_channel',
      channelId: versionOrChannel,
      hexKey: legacyKey.toLowerCase(),
    };
  }

  return {
    kind: 'invalid',
    type: 'invalid',
    error: 'Unrecognized token format.',
  };
}

/**
 * Builds a compact, local-safe `AEGIS-KEY:` QR pairing payload that NEVER contains a `file:///` path.
 * Includes the active 256-Bit AES Encryption Key, Key ID, and a lightweight compressed snapshot if under 1.4KB.
 */
export function buildLocalSafeQrPayload(
  hexKey: string,
  keyFingerprint?: string | null,
  appData?: AppData | null
): string {
  const cleanKey = (hexKey || DEFAULT_SESSION_PASSPHRASE).trim().toLowerCase();
  const cleanFp = (keyFingerprint || 'SYNC-KEY').trim();

  if (appData) {
    try {
      // First check if full appData compresses under 1200 chars
      const fullCompressed = compressStringToBase64Url(JSON.stringify({ appData }));
      if (fullCompressed.length <= 1200) {
        return `AEGIS-KEY:${cleanKey}:${cleanFp}:${fullCompressed}`;
      }
      // Otherwise build a lightweight core settings + recent items snapshot under 1350 chars
      const compactSettings = {
        userName: appData.settings?.userName,
        commanderName: appData.settings?.commanderName,
        appName: appData.settings?.appName,
        appShortName: appData.settings?.appShortName,
        accentColor: appData.settings?.accentColor,
        surfaceConfig: appData.settings?.surfaceConfig,
        textColorConfig: appData.settings?.textColorConfig,
        distanceUnit: appData.settings?.distanceUnit,
        unitSystem: appData.settings?.unitSystem,
        currencySymbol: appData.settings?.currencySymbol,
        startingBalance: appData.settings?.startingBalance,
        weatherLocation: appData.settings?.weatherLocation,
        weatherCoords: appData.settings?.weatherCoords,
      };
      const lightweight = {
        settings: compactSettings,
        timeline: (appData.timeline || []).slice(0, 4),
        goals: (appData.goals || []).slice(0, 4),
        funds: (appData.funds || []).slice(0, 4),
        dailyNotes: (appData.dailyNotes || []).slice(0, 3),
        distances: (appData.distances || []).slice(0, 4),
        lifeStats: (appData.lifeStats || []).slice(0, 4),
        updatedAt: appData.updatedAt || Date.now(),
      };
      const lightCompressed = compressStringToBase64Url(JSON.stringify({ appData: lightweight }));
      if (lightCompressed.length <= 1350) {
        return `AEGIS-KEY:${cleanKey}:${cleanFp}:${lightCompressed}`;
      }
      const profileOnly = compressStringToBase64Url(
        JSON.stringify({ appData: { settings: compactSettings, updatedAt: appData.updatedAt || Date.now() } })
      );
      if (profileOnly.length <= 1350) {
        return `AEGIS-KEY:${cleanKey}:${cleanFp}:${profileOnly}`;
      }
    } catch {
      // Fall back to key + fingerprint only
    }
  }

  return `AEGIS-KEY:${cleanKey}:${cleanFp}`;
}

/**
 * Encodes a unified package into a base64url transfer token.
 */
export function encodeTransferToken(pkg: UnifiedVaultTransferPackage): string {
  const json = JSON.stringify(pkg);
  return bytesToBase64Url(new TextEncoder().encode(json));
}

/**
 * Decodes a transfer token (either base64url or raw JSON) back into a UnifiedVaultTransferPackage.
 */
export function decodeTransferToken(token: string): UnifiedVaultTransferPackage | null {
  try {
    const clean = (token || '').trim();
    if (!clean) return null;

    // Check if it's already raw JSON
    if (clean.startsWith('{') && clean.endsWith('}')) {
      return parseUnifiedVaultPackage(clean);
    }

    const bytes = base64UrlToBytes(clean);
    const json = new TextDecoder().decode(bytes);
    return parseUnifiedVaultPackage(json);
  } catch {
    return null;
  }
}

/**
 * Generates an ISO-standard direct transfer QR Code SVG for offline sync payloads.
 * Guarantees no local file:/// URL is ever encoded.
 */
export async function generateDirectTransferQrSvg(payloadText: string): Promise<string> {
  const safeText = /^file:/i.test((payloadText || '').trim())
    ? buildLocalSafeQrPayload(DEFAULT_SESSION_PASSPHRASE, 'LOCAL')
    : payloadText;
  return QRCode.toString(safeText, {
    type: 'svg',
    errorCorrectionLevel: 'L',
    margin: 4,
    width: 240,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

// ============================================================================
// MANDATORY ACCOUNT & BACKEND DATABASE SYNC ENGINE (/api/auth/* & /api/account/sync)
// ============================================================================

export interface AccountDatabasePayload {
  ok: boolean;
  message: string;
  userId?: string;
  username?: string;
  displayName?: string;
  role?: 'The App Creator' | 'VIP' | 'User';
  createdAt?: number;
  updatedAt?: number;
  token?: string;
  workspaceData?: AppData | null;
  syncedToCloud?: boolean;
  offline?: boolean;
}

export interface AdminAccountDirectoryRow {
  userId: string;
  username: string;
  displayName: string;
  role: 'The App Creator' | 'VIP' | 'User';
  createdAt: number;
  updatedAt: number;
  timelineCount: number;
  fundsCount: number;
  goalsCount: number;
  notesCount: number;
  choresCount?: number;
  distancesCount: number;
  lifeStatsCount: number;
  galleryCount: number;
  totalRecords: number;
  workspaceData?: AppData | null;
  source?: 'database' | 'local';
}

export interface AccountSnapshotEnvelope {
  format: 'axiom-aegis-account-snapshot-v1';
  appVersion: string;
  exportedAt: string;
  username: string;
  displayName: string;
  updatedAt: number;
  workspaceData: AppData;
}

let runtimeStaticHostDetected = false;

/**
 * Returns true if the current browser origin is a purely static web host (e.g. GitHub Pages *.github.io,
 * GitLab Pages *.gitlab.io) with no Cloudflare Worker or backend API origin configured, or if a previous
 * /api/* probe returned non-JSON HTML.
 * Note: *.workers.dev and *.pages.dev run the Axiom Aegis Cloudflare Worker (_worker.js) and ARE valid backend origins.
 */
export function isStaticWebHostWithoutBackend(): boolean {
  if (runtimeStaticHostDetected) return true;
  if (typeof window === 'undefined' || !window.location) return false;
  const anyWin = window as unknown as {
    __AXIOM_SYNC_ORIGIN__?: string;
    __AXIOM_SINGLEFILE__?: boolean;
  };
  if (
    typeof anyWin.__AXIOM_SYNC_ORIGIN__ === 'string' &&
    /^https?:\/\//i.test(anyWin.__AXIOM_SYNC_ORIGIN__.trim()) &&
    !/\.(github\.io|gitlab\.io|surge\.sh)$/i.test(anyWin.__AXIOM_SYNC_ORIGIN__.trim())
  ) {
    return false;
  }
  const protocol = (window.location.protocol || '').toLowerCase();
  if (protocol.startsWith('file:')) {
    return true;
  }
  if (anyWin.__AXIOM_SINGLEFILE__ === true && protocol.startsWith('file:')) {
    return true;
  }
  const host = (window.location.hostname || '').toLowerCase();
  return /\.(github\.io|gitlab\.io|surge\.sh)$/i.test(host);
}

/**
 * Checks whether an HTTP fetch response actually returned JSON rather than a static HTML fallback page.
 */
function isJsonApiResponse(response: Response): boolean {
  const contentType = (response.headers?.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');
  if (!isJson && response.status === 200) {
    runtimeStaticHostDetected = true;
  }
  return isJson;
}

/**
 * Resolves the active backend API base URL.
 * Supports web origins (`window.location.origin`), Cloudflare Workers (`*.workers.dev` / `*.pages.dev`),
 * and downloaded standalone `.html` files (via `window.__AXIOM_SYNC_ORIGIN__` or `localStorage.getItem('__axiom_sync_origin__')`).
 */
export function getSyncApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const anyWin = window as unknown as { __AXIOM_SYNC_ORIGIN__?: string };
    if (
      typeof anyWin.__AXIOM_SYNC_ORIGIN__ === 'string' &&
      /^https?:\/\//i.test(anyWin.__AXIOM_SYNC_ORIGIN__.trim()) &&
      !/\.(github\.io|gitlab\.io|surge\.sh)$/i.test(anyWin.__AXIOM_SYNC_ORIGIN__.trim())
    ) {
      return anyWin.__AXIOM_SYNC_ORIGIN__.trim().replace(/\/+$/, '');
    }
    try {
      const storedOrigin = window.localStorage?.getItem('__axiom_sync_origin__');
      if (
        storedOrigin &&
        /^https?:\/\//i.test(storedOrigin.trim()) &&
        !/\.(github\.io|gitlab\.io|surge\.sh)$/i.test(storedOrigin.trim())
      ) {
        return storedOrigin.trim().replace(/\/+$/, '');
      }
    } catch {
      // Ignore storage error
    }
    if (
      window.location &&
      typeof window.location.protocol === 'string' &&
      /^https?:$/i.test(window.location.protocol)
    ) {
      return '';
    }
  }
  return '';
}

/**
 * Pushes all locally cached accounts (including ghost accounts created while offline or on secondary devices)
 * to the backend / Cloudflare Worker `/api/accounts/reconcile` endpoint so the Master Admin (`Axiomdk99@gmail.com`)
 * can reliably view all cross-device user accounts in the Admin Portal.
 */
export async function reconcileLocalGhostAccountsWithBackend(options?: {
  forceNetwork?: boolean;
}): Promise<{ ok: boolean; reconciledCount: number }> {
  if (options?.forceNetwork) {
    runtimeStaticHostDetected = false;
  }
  if (!options?.forceNetwork && isStaticWebHostWithoutBackend()) {
    return { ok: false, reconciledCount: 0 };
  }

  ensureMasterAdminAccountSeeded(createInitialAppData());
  const localMap = getAllRegisteredAccountEntries();
  const entries = Object.values(localMap).filter(
    (entry) => entry && typeof entry.username === 'string' && entry.username.trim().length >= 2
  );
  if (entries.length === 0) {
    return { ok: true, reconciledCount: 0 };
  }

  const baseUrl = getSyncApiBaseUrl();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 4500) : null;

  try {
    const response = await fetch(`${baseUrl}/api/accounts/reconcile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        accounts: entries.map((e) => ({
          userId: e.userId,
          username: e.username.trim().toLowerCase(),
          displayName: e.displayName,
          role: resolveAccountRole(e.username, e.role),
          passwordVerifier: e.passwordVerifier,
          token: e.token,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          workspaceData: e.workspaceData || null,
        })),
      }),
      signal: controller?.signal,
    });

    if (!isJsonApiResponse(response) || !response.ok) {
      return { ok: false, reconciledCount: 0 };
    }
    const data = await response.json().catch(() => null);
    return {
      ok: Boolean(data?.ok),
      reconciledCount: Number(data?.reconciledCount || 0),
    };
  } catch {
    return { ok: false, reconciledCount: 0 };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Merges remote AdminAccountDirectoryRow[] from Cloudflare Workers / server database with local
 * browser registry rows so zero ghost accounts are ever hidden from the Master Admin view.
 */
export function mergeAdminAccountDirectories(
  remoteRows: AdminAccountDirectoryRow[],
  localRows: AdminAccountDirectoryRow[]
): AdminAccountDirectoryRow[] {
  const mergedMap = new Map<string, AdminAccountDirectoryRow>();

  for (const localRow of localRows) {
    if (!localRow || !localRow.username) continue;
    const key = localRow.username.trim().toLowerCase();
    mergedMap.set(key, {
      ...localRow,
      username: key,
      role: resolveAccountRole(key, localRow.role),
      source: 'local',
    });
  }

  for (const remoteRow of remoteRows) {
    if (!remoteRow || !remoteRow.username) continue;
    const key = remoteRow.username.trim().toLowerCase();
    const existingLocal = mergedMap.get(key);
    if (!existingLocal) {
      mergedMap.set(key, {
        ...remoteRow,
        username: key,
        role: resolveAccountRole(key, remoteRow.role),
        source: 'database',
      });
    } else {
      const remoteNewer = (remoteRow.updatedAt || 0) >= (existingLocal.updatedAt || 0);
      const primary = remoteNewer ? remoteRow : existingLocal;
      const secondary = remoteNewer ? existingLocal : remoteRow;
      mergedMap.set(key, {
        ...secondary,
        ...primary,
        username: key,
        displayName:
          primary.displayName && primary.displayName !== 'User' && primary.displayName !== key
            ? primary.displayName
            : secondary.displayName || primary.displayName || key,
        role: resolveAccountRole(key, remoteRow.role || existingLocal.role),
        createdAt: Math.min(
          remoteRow.createdAt || Infinity,
          existingLocal.createdAt || Infinity
        ) === Infinity
          ? Date.now()
          : Math.min(
              remoteRow.createdAt || Date.now(),
              existingLocal.createdAt || Date.now()
            ),
        updatedAt: Math.max(remoteRow.updatedAt || 0, existingLocal.updatedAt || 0),
        timelineCount: Math.max(remoteRow.timelineCount || 0, existingLocal.timelineCount || 0),
        fundsCount: Math.max(remoteRow.fundsCount || 0, existingLocal.fundsCount || 0),
        goalsCount: Math.max(remoteRow.goalsCount || 0, existingLocal.goalsCount || 0),
        notesCount: Math.max(remoteRow.notesCount || 0, existingLocal.notesCount || 0),
        choresCount: Math.max(remoteRow.choresCount || 0, existingLocal.choresCount || 0),
        distancesCount: Math.max(remoteRow.distancesCount || 0, existingLocal.distancesCount || 0),
        lifeStatsCount: Math.max(remoteRow.lifeStatsCount || 0, existingLocal.lifeStatsCount || 0),
        galleryCount: Math.max(remoteRow.galleryCount || 0, existingLocal.galleryCount || 0),
        totalRecords: Math.max(remoteRow.totalRecords || 0, existingLocal.totalRecords || 0),
        workspaceData: primary.workspaceData || secondary.workspaceData || null,
        source: 'database',
      });
    }
  }

  return Array.from(mergedMap.values()).sort((a, b) => {
    if (a.role === 'The App Creator') return -1;
    if (b.role === 'The App Creator') return 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });
}

// ============================================================================
// LOCAL-FIRST ACCOUNT & DATABASE FALLBACK ENGINE (STATIC / CLOUDFLARE / OFFLINE)
// ============================================================================

export function registerAccountLocally(
  username: string,
  displayName: string,
  password: string,
  workspaceData: AppData
): AccountDatabasePayload {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  if (!cleanUser || cleanUser.length < 2) {
    return { ok: false, message: 'Email or Username must be at least 2 characters.' };
  }
  if (!cleanPass || cleanPass.length < 4) {
    return { ok: false, message: 'Password must be at least 4 characters.' };
  }

  ensureMasterAdminAccountSeeded(createInitialAppData());
  const existing = getLocalAccountCacheEntry(cleanUser);
  const isMaster = isMasterAdminIdentifier(cleanUser);

  if (isMaster && !isMasterAdminCredentials(cleanUser, cleanPass)) {
    return {
      ok: false,
      message: 'Incorrect Master Admin password for Axiomdk99@gmail.com.',
    };
  }

  // If account already exists locally and password doesn't match, reject duplicate registration
  if (existing && !isMaster && existing.passwordVerifier) {
    const matchesExisting = verifyLocalAccountPassword(existing, cleanPass);
    if (!matchesExisting) {
      return {
        ok: false,
        message: 'An account with that email/username already exists. Please sign in instead.',
      };
    }
  }

  const now = Date.now();
  const role = resolveAccountRole(cleanUser, existing?.role);
  const cleanDisplayName = (
    displayName ||
    existing?.displayName ||
    (isMaster ? MASTER_ADMIN_DEFAULT_DISPLAY_NAME : cleanUser)
  ).trim();
  const verifier = isMaster
    ? MASTER_ADMIN_VERIFIER
    : computeLocalPasswordVerifier(cleanUser, cleanPass);
  const token = createDeterministicAccountToken(cleanUser, verifier);

  const mergedWorkspace: AppData =
    existing?.workspaceData && !isFactoryDefaultVault(existing.workspaceData)
      ? mergeCloudAndLocalVaults(workspaceData, existing.workspaceData)
      : {
          ...workspaceData,
          settings: {
            ...workspaceData.settings,
            userName: cleanDisplayName,
            commanderName: cleanDisplayName,
          },
          updatedAt: Math.max(workspaceData.updatedAt || 0, now),
        };

  const saved = saveLocalAccountCacheEntry({
    userId:
      existing?.userId ||
      (isMaster ? 'usr_master_admin_axiomdk99' : `usr_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`),
    username: cleanUser,
    displayName: cleanDisplayName,
    role,
    passwordVerifier: verifier,
    token,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    workspaceData: mergedWorkspace,
  });

  return {
    ok: true,
    syncedToCloud: false,
    offline: true,
    message: 'Account created and saved in local browser vault.',
    userId: saved.userId,
    username: saved.username,
    displayName: saved.displayName,
    role: saved.role,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
    token: saved.token,
    workspaceData: saved.workspaceData,
  };
}

export function loginAccountLocally(
  username: string,
  password: string
): AccountDatabasePayload {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  if (!cleanUser || !cleanPass) {
    return { ok: false, message: 'Email/Username and Password are required.' };
  }

  ensureMasterAdminAccountSeeded(createInitialAppData());

  if (isMasterAdminIdentifier(cleanUser)) {
    if (!isMasterAdminCredentials(cleanUser, cleanPass)) {
      return { ok: false, message: 'Incorrect password for this account.' };
    }
    const masterEntry = ensureMasterAdminAccountSeeded(createInitialAppData());
    const now = Date.now();
    const token =
      masterEntry.token && masterEntry.token.includes(MASTER_ADMIN_VERIFIER)
        ? masterEntry.token
        : createDeterministicAccountToken(MASTER_ADMIN_EMAIL, MASTER_ADMIN_VERIFIER);
    const workspace = masterEntry.workspaceData || createInitialAppData();
    const updatedMaster = saveLocalAccountCacheEntry({
      userId: masterEntry.userId || 'usr_master_admin_axiomdk99',
      username: MASTER_ADMIN_EMAIL,
      displayName: masterEntry.displayName || MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
      role: 'The App Creator',
      passwordVerifier: MASTER_ADMIN_VERIFIER,
      token,
      createdAt: masterEntry.createdAt || now,
      updatedAt: masterEntry.updatedAt || now,
      workspaceData: workspace,
    });
    return {
      ok: true,
      syncedToCloud: false,
      offline: true,
      message: 'Master Admin authenticated.',
      userId: updatedMaster.userId,
      username: updatedMaster.username,
      displayName: updatedMaster.displayName,
      role: 'The App Creator',
      createdAt: updatedMaster.createdAt,
      updatedAt: updatedMaster.updatedAt,
      token: updatedMaster.token,
      workspaceData: updatedMaster.workspaceData,
    };
  }

  const cached = getLocalAccountCacheEntry(cleanUser);
  if (!cached) {
    return {
      ok: false,
      message: 'Account not found. Switch to Create Account to register this email/username.',
    };
  }

  if (!verifyLocalAccountPassword(cached, cleanPass)) {
    return {
      ok: false,
      message: 'Incorrect password for this account.',
    };
  }

  const verifier = computeLocalPasswordVerifier(cleanUser, cleanPass);
  const token = cached.token || createDeterministicAccountToken(cleanUser, verifier);
  const saved = saveLocalAccountCacheEntry({
    ...cached,
    username: cleanUser,
    role: resolveAccountRole(cleanUser, cached.role),
    passwordVerifier: verifier,
    token,
    updatedAt: cached.updatedAt || Date.now(),
    workspaceData: cached.workspaceData || createInitialAppData(),
  });

  return {
    ok: true,
    syncedToCloud: false,
    offline: true,
    message: 'Authenticated via local account vault.',
    userId: saved.userId,
    username: saved.username,
    displayName: saved.displayName,
    role: saved.role,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
    token: saved.token,
    workspaceData: saved.workspaceData,
  };
}

export function fetchAccountWorkspaceLocally(
  username: string,
  token?: string
): AccountDatabasePayload {
  const cleanUser = (username || '').trim().toLowerCase();
  if (!cleanUser) {
    return { ok: false, message: 'Missing account username.' };
  }
  ensureMasterAdminAccountSeeded(createInitialAppData());
  const cached = getLocalAccountCacheEntry(cleanUser);
  if (!cached) {
    return { ok: false, message: 'Account not found in local registry.' };
  }
  return {
    ok: true,
    message: 'Account workspace loaded from local browser storage.',
    userId: cached.userId,
    username: cached.username,
    displayName: cached.displayName,
    role: resolveAccountRole(cached.username, cached.role),
    createdAt: cached.createdAt,
    updatedAt: cached.updatedAt,
    token: cached.token || token || '',
    workspaceData: cached.workspaceData || null,
  };
}

export function pushAccountWorkspaceLocally(
  username: string,
  displayName: string,
  workspaceData: AppData,
  token?: string
): AccountDatabasePayload {
  const cleanUser = (username || '').trim().toLowerCase();
  if (!cleanUser) {
    return { ok: false, message: 'Missing account username.' };
  }
  ensureMasterAdminAccountSeeded(createInitialAppData());
  const existing = getLocalAccountCacheEntry(cleanUser);
  const now = Math.max(Date.now(), workspaceData?.updatedAt || 0);
  const cleanDisplayName = (
    displayName ||
    workspaceData?.settings?.commanderName ||
    workspaceData?.settings?.userName ||
    existing?.displayName ||
    cleanUser
  ).trim();

  const saved = saveLocalAccountCacheEntry({
    userId:
      existing?.userId ||
      (isMasterAdminIdentifier(cleanUser)
        ? 'usr_master_admin_axiomdk99'
        : `usr_${now.toString(36)}`),
    username: cleanUser,
    displayName: cleanDisplayName,
    role: resolveAccountRole(cleanUser, existing?.role),
    passwordVerifier: existing?.passwordVerifier,
    token: token || existing?.token,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    workspaceData: {
      ...workspaceData,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    message: 'Account workspace saved to local browser storage.',
    userId: saved.userId,
    username: saved.username,
    displayName: saved.displayName,
    role: saved.role,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
    token: saved.token,
    workspaceData: saved.workspaceData,
  };
}

function buildLocalAdminAccountDirectoryRows(): AdminAccountDirectoryRow[] {
  ensureMasterAdminAccountSeeded(createInitialAppData());
  const map = getAllRegisteredAccountEntries();
  return Object.values(map)
    .map((entry) => {
      const ws = entry.workspaceData;
      const timelineCount = ws?.timeline?.length || 0;
      const fundsCount = (ws?.funds?.length || 0) + (ws?.bills?.length || 0);
      const goalsCount = ws?.goals?.length || 0;
      const notesCount = ws?.dailyNotes?.length || 0;
      const choresCount = ws?.chores?.length || 0;
      const distancesCount = ws?.distances?.length || 0;
      const lifeStatsCount = ws?.lifeStats?.length || 0;
      const galleryCount = ws?.gallery?.length || 0;
      const totalRecords =
        timelineCount +
        fundsCount +
        goalsCount +
        notesCount +
        choresCount +
        distancesCount +
        lifeStatsCount +
        galleryCount;

      return {
        userId: entry.userId,
        username: entry.username,
        displayName: entry.displayName,
        role: resolveAccountRole(entry.username, entry.role),
        createdAt: entry.createdAt || entry.updatedAt || Date.now(),
        updatedAt: entry.updatedAt || Date.now(),
        timelineCount,
        fundsCount,
        goalsCount,
        notesCount,
        choresCount,
        distancesCount,
        lifeStatsCount,
        galleryCount,
        totalRecords,
        workspaceData: ws || null,
        source: 'local' as const,
      };
    })
    .sort((a, b) => {
      if (a.role === 'The App Creator') return -1;
      if (b.role === 'The App Creator') return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
}

/**
 * Registers a new user account in the persistent backend database (`POST /api/auth/register`),
 * seamlessly falling back to the Local-First Account Engine when offline and reconciling ghost accounts.
 */
export async function registerAccountInDatabase(
  username: string,
  displayName: string,
  password: string,
  workspaceData: AppData
): Promise<AccountDatabasePayload> {
  if (isStaticWebHostWithoutBackend()) {
    return registerAccountLocally(username, displayName, password, workspaceData);
  }
  const baseUrl = getSyncApiBaseUrl();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;

  try {
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();
    const verifier = computeLocalPasswordVerifier(cleanUser, cleanPass);
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        username: cleanUser,
        displayName: displayName.trim(),
        password: cleanPass,
        passwordVerifier: verifier,
        workspaceData,
      }),
      signal: controller?.signal,
    });

    if (!isJsonApiResponse(response) || response.status === 404 || response.status === 405) {
      return registerAccountLocally(username, displayName, password, workspaceData);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !data?.account) {
      if (response.status >= 500 || !data) {
        return registerAccountLocally(username, displayName, password, workspaceData);
      }
      const serverErr = typeof data?.error === 'string' ? data.error.trim() : '';
      return {
        ok: false,
        message:
          serverErr ||
          `Could not reach account database (HTTP ${response.status}).`,
      };
    }
    const acct = data.account;
    // Also mirror into local registry
    saveLocalAccountCacheEntry({
      userId: acct.userId,
      username: acct.username,
      displayName: acct.displayName,
      role: acct.role,
      password: cleanPass,
      passwordVerifier: verifier,
      token: acct.token,
      createdAt: acct.createdAt,
      updatedAt: acct.updatedAt,
      workspaceData: (acct.workspaceData as AppData | null) ?? workspaceData,
    });
    // Opportunistically reconcile any other local ghost accounts on this device
    void reconcileLocalGhostAccountsWithBackend();
    return {
      ok: true,
      syncedToCloud: true,
      offline: false,
      message: 'Account created and synced.',
      userId: acct.userId,
      username: acct.username,
      displayName: acct.displayName,
      role: acct.role,
      createdAt: acct.createdAt,
      updatedAt: acct.updatedAt,
      token: acct.token,
      workspaceData: (acct.workspaceData as AppData | null) ?? workspaceData,
    };
  } catch {
    return registerAccountLocally(username, displayName, password, workspaceData);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Authenticates an existing user account against the backend database (`POST /api/auth/login`),
 * seamlessly falling back to the Local-First Account Engine and auto-reconciling ghost accounts.
 */
export async function loginAccountFromDatabase(
  username: string,
  password: string
): Promise<AccountDatabasePayload> {
  if (isStaticWebHostWithoutBackend()) {
    return loginAccountLocally(username, password);
  }
  const baseUrl = getSyncApiBaseUrl();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;

  try {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        username: username.trim().toLowerCase(),
        password: password.trim(),
      }),
      signal: controller?.signal,
    });

    if (!isJsonApiResponse(response) || response.status === 405) {
      return loginAccountLocally(username, password);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !data?.account) {
      // If server returned 404 (account only in local registry as a ghost account), verify locally and push to backend!
      const localAttempt = loginAccountLocally(username, password);
      if (localAttempt.ok) {
        void reconcileLocalGhostAccountsWithBackend({ forceNetwork: true });
        return localAttempt;
      }
      const serverErr = typeof data?.error === 'string' ? data.error.trim() : '';
      return {
        ok: false,
        message:
          serverErr ||
          localAttempt.message ||
          `Could not reach account database (HTTP ${response.status}).`,
      };
    }
    const acct = data.account;
    // Reconcile with any newer local workspace data before returning
    const localCached = getLocalAccountCacheEntry(acct.username);
    const remoteWs = (acct.workspaceData as AppData | null) ?? null;
    const effectiveWs =
      localCached?.workspaceData && remoteWs
        ? (localCached.workspaceData.updatedAt || 0) > (remoteWs.updatedAt || 0)
          ? mergeCloudAndLocalVaults(localCached.workspaceData, remoteWs)
          : remoteWs
        : remoteWs || localCached?.workspaceData || null;

    if (effectiveWs) {
      saveLocalAccountCacheEntry({
        userId: acct.userId,
        username: acct.username,
        displayName: acct.displayName,
        role: acct.role,
        password: password.trim(),
        token: acct.token,
        createdAt: acct.createdAt,
        updatedAt: Math.max(acct.updatedAt || 0, effectiveWs.updatedAt || 0),
        workspaceData: effectiveWs,
      });
    }

    // Reconcile any secondary ghost accounts stored in this browser with the backend
    void reconcileLocalGhostAccountsWithBackend();

    return {
      ok: true,
      syncedToCloud: true,
      offline: false,
      message: 'Authenticated successfully.',
      userId: acct.userId,
      username: acct.username,
      displayName: acct.displayName,
      role: acct.role,
      createdAt: acct.createdAt,
      updatedAt: Math.max(acct.updatedAt || 0, effectiveWs?.updatedAt || 0),
      token: acct.token,
      workspaceData: effectiveWs,
    };
  } catch {
    return loginAccountLocally(username, password);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Pulls the authenticated user's latest account profile and workspace from `GET /api/account/sync`,
 * explicitly surfacing offline state (`syncedToCloud: false, offline: true`) whenever the cloud API is unreachable.
 */
export async function fetchAccountWorkspaceFromDatabase(
  tokenOrSession: string | { username: string; token: string },
  usernameArg?: string
): Promise<AccountDatabasePayload> {
  const token =
    typeof tokenOrSession === 'string' ? tokenOrSession : tokenOrSession.token;
  const username = (
    typeof tokenOrSession === 'string' ? usernameArg || '' : tokenOrSession.username
  )
    .trim()
    .toLowerCase();

  const browserOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  if (browserOffline || isStaticWebHostWithoutBackend()) {
    const localFallback = fetchAccountWorkspaceLocally(username, token);
    return {
      ...localFallback,
      ok: false,
      syncedToCloud: false,
      offline: true,
      message: browserOffline
        ? 'Offline — using cached snapshot until connection returns.'
        : 'Static host — cloud sync backend unavailable.',
    };
  }

  const baseUrl = getSyncApiBaseUrl();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 5000) : null;

  try {
    const url = `${baseUrl}/api/account/sync?username=${encodeURIComponent(username)}&_t=${Date.now()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Axiom-Username': username,
      },
      cache: 'no-store',
      signal: controller?.signal,
    });

    if (!isJsonApiResponse(response) || response.status === 404 || response.status === 405) {
      const localFallback = fetchAccountWorkspaceLocally(username, token);
      return {
        ...localFallback,
        ok: false,
        syncedToCloud: false,
        offline: true,
        message: `Cloud sync endpoint unavailable (HTTP ${response.status}).`,
      };
    }

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !data?.account) {
      if (response.status >= 500 || !data) {
        const localFallback = fetchAccountWorkspaceLocally(username, token);
        return {
          ...localFallback,
          ok: false,
          syncedToCloud: false,
          offline: true,
          message: `Cloud sync temporarily unavailable (HTTP ${response.status}).`,
        };
      }
      const serverErr = typeof data?.error === 'string' ? data.error.trim() : '';
      return {
        ok: false,
        syncedToCloud: false,
        offline: false,
        message:
          serverErr ||
          `Cloud authentication failed (HTTP ${response.status}).`,
      };
    }
    const acct = data.account;
    const remoteWs = (acct.workspaceData as AppData | null) ?? null;
    if (remoteWs) {
      const existingLocal = getLocalAccountCacheEntry(acct.username);
      saveLocalAccountCacheEntry({
        userId: acct.userId,
        username: acct.username,
        displayName: acct.displayName,
        role: acct.role,
        passwordVerifier: existingLocal?.passwordVerifier,
        token: acct.token || token,
        createdAt: acct.createdAt,
        updatedAt: acct.updatedAt,
        workspaceData: remoteWs,
      });
    }
    return {
      ok: true,
      syncedToCloud: true,
      offline: false,
      message: 'Account workspace synced from cloud.',
      userId: acct.userId,
      username: acct.username,
      displayName: acct.displayName,
      role: acct.role,
      createdAt: acct.createdAt,
      updatedAt: acct.updatedAt,
      token: acct.token || token,
      workspaceData: remoteWs,
    };
  } catch {
    const localFallback = fetchAccountWorkspaceLocally(username, token);
    return {
      ...localFallback,
      ok: false,
      syncedToCloud: false,
      offline: true,
      message: 'Network error reaching cloud sync API.',
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Pushes the authenticated user's workspace and display name to `POST /api/account/sync`,
 * returning `syncedToCloud: true` only when the cloud backend confirms persistence.
 */
export async function pushAccountWorkspaceToDatabase(
  tokenOrSession: string | { username: string; token: string },
  usernameOrDisplayName: string,
  workspaceData: AppData,
  displayNameArg?: string
): Promise<AccountDatabasePayload> {
  const token =
    typeof tokenOrSession === 'string' ? tokenOrSession : tokenOrSession.token;
  const username = (
    typeof tokenOrSession === 'string'
      ? usernameOrDisplayName
      : tokenOrSession.username
  )
    .trim()
    .toLowerCase();
  const displayName = (
    typeof tokenOrSession === 'string'
      ? displayNameArg || workspaceData.settings?.commanderName || workspaceData.settings?.userName || username
      : usernameOrDisplayName
  ).trim();

  // Keep local session recovery copy warm, never claiming cloud sync until server confirms 2xx
  const localSaved = pushAccountWorkspaceLocally(username, displayName, workspaceData, token);

  const browserOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  if (browserOffline || isStaticWebHostWithoutBackend()) {
    return {
      ...localSaved,
      ok: false,
      syncedToCloud: false,
      offline: true,
      message: browserOffline
        ? 'Offline — changes queued locally until reconnected.'
        : 'Static host — cloud sync backend unavailable.',
    };
  }

  const baseUrl = getSyncApiBaseUrl();
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 5500) : null;

  try {
    const response = await fetch(`${baseUrl}/api/account/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Axiom-Username': username,
      },
      body: JSON.stringify({
        username,
        token,
        displayName,
        workspaceData,
      }),
      signal: controller?.signal,
    });

    if (!isJsonApiResponse(response) || response.status === 404 || response.status === 405) {
      return {
        ...localSaved,
        ok: false,
        syncedToCloud: false,
        offline: true,
        message: `Cloud sync endpoint unavailable (HTTP ${response.status}).`,
      };
    }

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !data?.account) {
      if (response.status >= 500 || !data) {
        void reconcileLocalGhostAccountsWithBackend({ forceNetwork: true });
      }
      return {
        ...localSaved,
        ok: false,
        syncedToCloud: false,
        offline: response.status >= 500 || !data,
        message:
          (typeof data?.error === 'string' && data.error.trim()) ||
          `Cloud sync failed (HTTP ${response.status}).`,
      };
    }
    const acct = data.account;
    const syncedWs = (acct.workspaceData as AppData | null) ?? workspaceData;
    const existingLocal = getLocalAccountCacheEntry(acct.username);
    saveLocalAccountCacheEntry({
      userId: acct.userId,
      username: acct.username,
      displayName: acct.displayName,
      role: acct.role,
      passwordVerifier: existingLocal?.passwordVerifier,
      token: acct.token || token,
      createdAt: acct.createdAt,
      updatedAt: acct.updatedAt,
      workspaceData: syncedWs,
    });
    return {
      ok: true,
      syncedToCloud: true,
      offline: false,
      message: 'Account workspace synced to cloud.',
      userId: acct.userId,
      username: acct.username,
      displayName: acct.displayName,
      role: acct.role,
      createdAt: acct.createdAt,
      updatedAt: acct.updatedAt,
      token: acct.token || token,
      workspaceData: syncedWs,
    };
  } catch {
    return {
      ...localSaved,
      ok: false,
      syncedToCloud: false,
      offline: true,
      message: 'Network error pushing to cloud sync API.',
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// ============================================================================
// MASTER ADMIN CLIENT HELPERS (/api/admin/*) WITH LOCAL + GHOST RECONCILIATION
// ============================================================================

export async function fetchAdminAccountsList(
  session: {
    username: string;
    token: string;
  },
  options?: { forceNetwork?: boolean }
): Promise<{ ok: boolean; accounts: AdminAccountDirectoryRow[]; error?: string }> {
  if (!isMasterAdminIdentifier(session?.username)) {
    return { ok: false, accounts: [], error: 'Master Admin privileges required.' };
  }
  if (options?.forceNetwork) {
    runtimeStaticHostDetected = false;
  }
  const localRows = buildLocalAdminAccountDirectoryRows();
  if (!options?.forceNetwork && isStaticWebHostWithoutBackend()) {
    return { ok: true, accounts: localRows };
  }

  // First reconcile any local/secondary-device ghost accounts into the backend database
  await reconcileLocalGhostAccountsWithBackend({ forceNetwork: options?.forceNetwork });

  const baseUrl = getSyncApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/admin/accounts?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.token}`,
        'X-Axiom-Username': session.username.trim().toLowerCase(),
      },
      cache: 'no-store',
    });
    if (!isJsonApiResponse(response) || response.status === 404 || response.status === 405) {
      return { ok: true, accounts: localRows };
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !Array.isArray(data.accounts)) {
      if (localRows.length > 0) {
        return { ok: true, accounts: localRows };
      }
      return {
        ok: false,
        accounts: [],
        error: data?.error || `Admin directory fetch failed (${response.status})`,
      };
    }

    const remoteRows = data.accounts as AdminAccountDirectoryRow[];
    // Mirror remote accounts into local cache so offline Master Admin inspection also stays warm
    for (const remoteAcct of remoteRows) {
      if (!remoteAcct || !remoteAcct.username) continue;
      const existingLocal = getLocalAccountCacheEntry(remoteAcct.username);
      if (!existingLocal) {
        saveLocalAccountCacheEntry({
          userId: remoteAcct.userId,
          username: remoteAcct.username,
          displayName: remoteAcct.displayName,
          role: resolveAccountRole(remoteAcct.username, remoteAcct.role),
          createdAt: remoteAcct.createdAt,
          updatedAt: remoteAcct.updatedAt,
          workspaceData: remoteAcct.workspaceData || createInitialAppData(),
        });
      }
    }

    const mergedAccounts = mergeAdminAccountDirectories(remoteRows, localRows);
    return {
      ok: true,
      accounts: mergedAccounts,
    };
  } catch {
    return {
      ok: true,
      accounts: localRows,
    };
  }
}

export async function fetchAdminAccountDetail(
  session: { username: string; token: string },
  targetUserIdOrUsername: string
): Promise<{ ok: boolean; account?: AdminAccountDirectoryRow; error?: string }> {
  if (!isMasterAdminIdentifier(session?.username)) {
    return { ok: false, error: 'Master Admin privileges required.' };
  }
  const findLocalTarget = (): AdminAccountDirectoryRow | undefined => {
    const cleanTarget = (targetUserIdOrUsername || '').trim().toLowerCase();
    return buildLocalAdminAccountDirectoryRows().find(
      (r) => r.username.toLowerCase() === cleanTarget || r.userId === targetUserIdOrUsername.trim()
    );
  };

  if (isStaticWebHostWithoutBackend()) {
    const found = findLocalTarget();
    return found ? { ok: true, account: found } : { ok: false, error: 'Account not found.' };
  }

  const baseUrl = getSyncApiBaseUrl();
  try {
    const response = await fetch(
      `${baseUrl}/api/admin/accounts/${encodeURIComponent(targetUserIdOrUsername)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${session.token}`,
          'X-Axiom-Username': session.username.trim().toLowerCase(),
        },
        cache: 'no-store',
      }
    );
    if (!isJsonApiResponse(response) || response.status === 404 || response.status === 405) {
      const found = findLocalTarget();
      if (found) return { ok: true, account: found };
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !data.account) {
      const found = findLocalTarget();
      if (found) return { ok: true, account: found };
      return {
        ok: false,
        error: data?.error || `Failed to inspect account (${response.status})`,
      };
    }
    return {
      ok: true,
      account: data.account as AdminAccountDirectoryRow,
    };
  } catch {
    const found = findLocalTarget();
    return found
      ? { ok: true, account: found }
      : { ok: false, error: 'Could not inspect account.' };
  }
}

export async function updateAdminAccountRole(
  session: { username: string; token: string },
  targetUserIdOrUsername: string,
  newRole: 'VIP' | 'User'
): Promise<{ ok: boolean; account?: AdminAccountDirectoryRow; error?: string }> {
  if (!isMasterAdminIdentifier(session?.username)) {
    return { ok: false, error: 'Master Admin privileges required.' };
  }
  // Always apply locally first
  const localUpdated = updateLocalRegisteredAccountRole(targetUserIdOrUsername, newRole);
  const buildLocalResult = (): { ok: boolean; account?: AdminAccountDirectoryRow; error?: string } => {
    const rows = buildLocalAdminAccountDirectoryRows();
    const row = rows.find(
      (r) =>
        r.username.toLowerCase() === targetUserIdOrUsername.trim().toLowerCase() ||
        r.userId === targetUserIdOrUsername.trim()
    );
    if (row) return { ok: true, account: row };
    if (localUpdated) {
      return {
        ok: true,
        account: {
          userId: localUpdated.userId,
          username: localUpdated.username,
          displayName: localUpdated.displayName,
          role: localUpdated.role,
          createdAt: localUpdated.createdAt,
          updatedAt: localUpdated.updatedAt,
          timelineCount: localUpdated.workspaceData?.timeline?.length || 0,
          fundsCount: (localUpdated.workspaceData?.funds?.length || 0) + (localUpdated.workspaceData?.bills?.length || 0),
          goalsCount: localUpdated.workspaceData?.goals?.length || 0,
          notesCount: localUpdated.workspaceData?.dailyNotes?.length || 0,
          choresCount: localUpdated.workspaceData?.chores?.length || 0,
          distancesCount: localUpdated.workspaceData?.distances?.length || 0,
          lifeStatsCount: localUpdated.workspaceData?.lifeStats?.length || 0,
          galleryCount: localUpdated.workspaceData?.gallery?.length || 0,
          totalRecords: countVaultRecords(localUpdated.workspaceData || createInitialAppData()),
          workspaceData: localUpdated.workspaceData,
          source: 'local',
        },
      };
    }
    return { ok: false, error: 'Account not found.' };
  };

  if (isStaticWebHostWithoutBackend()) {
    return buildLocalResult();
  }

  const baseUrl = getSyncApiBaseUrl();
  try {
    const response = await fetch(
      `${baseUrl}/api/admin/accounts/${encodeURIComponent(targetUserIdOrUsername)}/role`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${session.token}`,
          'X-Axiom-Username': session.username.trim().toLowerCase(),
        },
        body: JSON.stringify({ role: newRole }),
      }
    );
    if (!isJsonApiResponse(response) || response.status === 404 || response.status === 405) {
      return buildLocalResult();
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !data.account) {
      const fallback = buildLocalResult();
      if (fallback.ok) return fallback;
      return {
        ok: false,
        error: data?.error || `Failed to update role (${response.status})`,
      };
    }
    return {
      ok: true,
      account: data.account as AdminAccountDirectoryRow,
    };
  } catch {
    return buildLocalResult();
  }
}

export async function deleteAdminAccount(
  session: { username: string; token: string },
  targetUserIdOrUsername: string
): Promise<{ ok: boolean; deletedUsername?: string; error?: string }> {
  if (!isMasterAdminIdentifier(session?.username)) {
    return { ok: false, error: 'Master Admin privileges required.' };
  }
  const localDeleted = deleteLocalRegisteredAccount(targetUserIdOrUsername);

  if (isStaticWebHostWithoutBackend()) {
    return localDeleted
      ? { ok: true, deletedUsername: targetUserIdOrUsername }
      : { ok: false, error: 'Account could not be deleted.' };
  }

  const baseUrl = getSyncApiBaseUrl();
  try {
    const response = await fetch(
      `${baseUrl}/api/admin/accounts/${encodeURIComponent(targetUserIdOrUsername)}`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${session.token}`,
          'X-Axiom-Username': session.username.trim().toLowerCase(),
        },
      }
    );
    if (!isJsonApiResponse(response) || response.status === 404 || response.status === 405) {
      return localDeleted
        ? { ok: true, deletedUsername: targetUserIdOrUsername }
        : { ok: false, error: 'Account not found.' };
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      if (localDeleted) {
        return { ok: true, deletedUsername: targetUserIdOrUsername };
      }
      return {
        ok: false,
        error: data?.error || `Failed to delete account (${response.status})`,
      };
    }
    return {
      ok: true,
      deletedUsername: data.deletedUsername,
    };
  } catch {
    return localDeleted
      ? { ok: true, deletedUsername: targetUserIdOrUsername }
      : { ok: false, error: 'Could not delete account.' };
  }
}

export async function exportAdminDatabaseBackup(session: {
  username: string;
  token: string;
}): Promise<{ ok: boolean; payload?: Record<string, unknown>; error?: string }> {
  if (!isMasterAdminIdentifier(session?.username)) {
    return { ok: false, error: 'Master Admin privileges required.' };
  }
  const buildLocalBackup = () => ({
    ok: true,
    payload: {
      ok: true,
      format: 'axiom-aegis-master-db-backup-v1',
      exportedAt: new Date().toISOString(),
      source: 'local_browser_registry',
      accounts: buildLocalAdminAccountDirectoryRows(),
    },
  });

  if (isStaticWebHostWithoutBackend()) {
    return buildLocalBackup();
  }

  const baseUrl = getSyncApiBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/api/admin/database/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${session.token}`,
        'X-Axiom-Username': session.username.trim().toLowerCase(),
      },
      body: JSON.stringify({}),
    });
    if (!isJsonApiResponse(response) || response.status === 404 || response.status === 405) {
      return buildLocalBackup();
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      return buildLocalBackup();
    }
    return {
      ok: true,
      payload: data as Record<string, unknown>,
    };
  } catch {
    return buildLocalBackup();
  }
}

/**
 * Creates a clean JSON snapshot of the user's Account & Workspace for offline file backup.
 */
export function buildAccountSnapshotJson(
  accountOrUsername: { username: string; displayName: string } | string,
  workspaceOrDisplayName: AppData | string,
  maybeWorkspaceData?: AppData
): string {
  const username =
    typeof accountOrUsername === 'string'
      ? accountOrUsername
      : accountOrUsername.username;
  const displayName =
    typeof accountOrUsername === 'string'
      ? (workspaceOrDisplayName as string)
      : accountOrUsername.displayName;
  const workspaceData = (
    typeof accountOrUsername === 'string'
      ? maybeWorkspaceData
      : (workspaceOrDisplayName as AppData)
  ) as AppData;

  const snapshot: AccountSnapshotEnvelope = {
    format: 'axiom-aegis-account-snapshot-v1',
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    username: (username || 'commander').trim().toLowerCase(),
    displayName: (displayName || workspaceData?.settings?.userName || 'Commander').trim(),
    updatedAt: workspaceData?.updatedAt || Date.now(),
    workspaceData,
  };
  return JSON.stringify(snapshot, null, 2);
}

/**
 * Parses an imported Account Snapshot JSON file (or plain AppData JSON) without requiring any encryption keys.
 */
export function parseAccountSnapshotJson(rawJson: string): {
  username?: string;
  displayName?: string;
  workspaceData: AppData;
} | null {
  try {
    const parsed = JSON.parse(rawJson, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
    if (!parsed || typeof parsed !== 'object') return null;

    if (
      parsed.format === 'axiom-aegis-account-snapshot-v1' &&
      parsed.workspaceData &&
      typeof parsed.workspaceData === 'object'
    ) {
      return {
        username: typeof parsed.username === 'string' ? parsed.username : undefined,
        displayName: typeof parsed.displayName === 'string' ? parsed.displayName : undefined,
        workspaceData: parsed.workspaceData as AppData,
      };
    }

    if (parsed.settings && (Array.isArray(parsed.timeline) || Array.isArray(parsed.funds))) {
      return {
        displayName: parsed.settings.commanderName || parsed.settings.userName,
        workspaceData: parsed as AppData,
      };
    }

    if (parsed.appData && typeof parsed.appData === 'object') {
      return {
        displayName: parsed.appData.settings?.commanderName || parsed.appData.settings?.userName,
        workspaceData: parsed.appData as AppData,
      };
    }

    return null;
  } catch {
    return null;
  }
}



