import { AccountRole, AppData, EncryptedPayload } from '../types';

const DB_NAME = 'AxiomDailiesVault';
const DB_VERSION = 1;
const STORE_NAME = 'vault';
const PAYLOAD_KEY = 'primary_encrypted_payload';
const LOCAL_STORAGE_KEY = 'axiom_dailies_encrypted_vault';
const SESSION_CREDENTIAL_KEY = 'axiom_session_vault_key';
const REMEMBERED_DEVICE_KEY = 'axiom_remembered_device_key_v1';

export const MASTER_ADMIN_EMAIL = 'axiomdk99@gmail.com';
export const MASTER_ADMIN_DISPLAY_EMAIL = 'Axiomdk99@gmail.com';
export const MASTER_ADMIN_VERIFIER = 'av1_026e574facf73013';
const MASTER_ADMIN_AUTH_DIGEST = 'md2_f7d6ce054d797b18';
export const MASTER_ADMIN_DEFAULT_DISPLAY_NAME = 'Axiom Creator';
export const ACCOUNT_REGISTRY_STORAGE_KEY = 'axiom_accounts_registry_v1';

/**
 * Checks case-insensitively whether an account identifier (username or email)
 * is the permanent Master Admin ("Axiomdk99@gmail.com").
 */
export function isMasterAdminIdentifier(usernameOrEmail?: string | null): boolean {
  if (typeof usernameOrEmail !== 'string') return false;
  return usernameOrEmail.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}

function computeMasterAuthDigest(password: string): string {
  const s = `aegis-master-kdf-v2:${password.trim()}:creator-seal`;
  let a = 0x811c9dc5;
  let b = 0xc9dc5118;
  for (let round = 0; round < 64; round++) {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i) ^ round;
      a = Math.imul(a ^ c, 0x01000193);
      b = Math.imul(b ^ (c + round), 0x85ebca6b);
    }
  }
  return `md2_${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Checks whether the provided email/username and password match the permanent
 * Master Admin cryptographic verifier without storing the plaintext password in code.
 */
export function isMasterAdminCredentials(
  usernameOrEmail?: string | null,
  password?: string | null
): boolean {
  if (!isMasterAdminIdentifier(usernameOrEmail)) return false;
  if (typeof password !== 'string') return false;
  const cleanPass = password.trim();
  if (!cleanPass) return false;
  return (
    computeLocalPasswordVerifier(MASTER_ADMIN_EMAIL, cleanPass) === MASTER_ADMIN_VERIFIER &&
    computeMasterAuthDigest(cleanPass) === MASTER_ADMIN_AUTH_DIGEST
  );
}

/**
 * Enforces the forum-style Role & Rank hierarchy:
 * - "Axiomdk99@gmail.com" (case-insensitive) is ALWAYS "The App Creator".
 * - No other account can ever be assigned "The App Creator".
 * - Other accounts are either "VIP" (if explicitly granted) or "User" (default).
 */
export function resolveAccountRole(
  usernameOrEmail?: string | null,
  candidateRole?: unknown
): AccountRole {
  if (isMasterAdminIdentifier(usernameOrEmail)) {
    return 'The App Creator';
  }
  if (
    candidateRole === 'VIP' ||
    (typeof candidateRole === 'string' && candidateRole.trim().toUpperCase() === 'VIP')
  ) {
    return 'VIP';
  }
  return 'User';
}

/**
 * Deterministic password verifier for local/offline multi-account registry verification.
 * Uses normalized lowercase email/username and trimmed password so case variations
 * always produce the exact same hash.
 */
export function computeLocalPasswordVerifier(username: string, password: string): string {
  const cleanUser = (username || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();
  const input = `axiom-aegis-local-auth-v1:${cleanUser}:${cleanPass}`;
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `av1_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Generates a deterministic session token prefix tied to the account's password verifier
 * so sessions created offline or via local seed are seamlessly recognized by server.ts.
 */
export function createDeterministicAccountToken(username: string, passwordOrVerifier: string): string {
  const cleanUser = (username || '').trim().toLowerCase();
  const verifier = passwordOrVerifier.startsWith('av1_')
    ? passwordOrVerifier
    : computeLocalPasswordVerifier(cleanUser, passwordOrVerifier);
  const randSuffix = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `aegis_tok_${verifier}_${randSuffix}`;
}

export interface AccountSession {
  userId: string;
  username: string;
  displayName: string;
  role: AccountRole;
  token: string;
  createdAt?: number;
  updatedAt?: number;
  loggedInAt?: number;
  lastSyncedAt?: number;
  autoSync?: boolean;
}

export interface UnifiedSyncAccountSession {
  accountId: string;
  displayAccountId?: string;
  username?: string;
  displayName?: string;
  role?: AccountRole;
  token?: string;
  userId?: string;
  channelId: string;
  keyFingerprint: string;
  saltBase64: string;
  autoSync: boolean;
  linkedAt: number;
  lastSyncedAt?: number;
}

const ACCOUNT_SESSION_STORAGE_KEY = 'axiom_account_session_v1';
const UNIFIED_ACCOUNT_STORAGE = 'axiom_unified_account_v1';
const LOCAL_ACCOUNTS_CACHE_KEY = 'axiom_local_accounts_cache_v1';
export const DELETED_ACCOUNTS_TOMBSTONE_KEY = 'axiom_deleted_accounts_v1';

const DEFAULT_TOMBSTONED_DUMMY_ACCOUNTS = [
  'commander_alex',
  'test_user',
  'testuser@example.com',
  'newsyncuser@example.com',
  'sync_commander',
];

export function getDeletedAccountsTombstones(): Set<string> {
  const set = new Set<string>(DEFAULT_TOMBSTONED_DUMMY_ACCOUNTS);
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DELETED_ACCOUNTS_TOMBSTONE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === 'string' && item.trim()) {
              const clean = item.trim().toLowerCase();
              if (!isMasterAdminIdentifier(clean)) {
                set.add(clean);
              }
            }
          }
        }
      }
    }
  } catch {
    // Ignore storage parse errors
  }
  return set;
}

function saveDeletedAccountsTombstones(tombstones: Set<string>): void {
  try {
    if (typeof localStorage !== 'undefined') {
      const cleanList = Array.from(tombstones).filter(
        (u) => u && !isMasterAdminIdentifier(u)
      );
      localStorage.setItem(DELETED_ACCOUNTS_TOMBSTONE_KEY, JSON.stringify(cleanList));
    }
  } catch {
    // Ignore storage write errors
  }
}

export function clearAccountDeletionTombstone(usernameOrUserId: string): void {
  const clean = (usernameOrUserId || '').trim().toLowerCase();
  if (!clean) return;
  const tombstones = getDeletedAccountsTombstones();
  if (tombstones.has(clean)) {
    tombstones.delete(clean);
    saveDeletedAccountsTombstones(tombstones);
  }
}

export function isAccountTombstoned(usernameOrUserId?: string | null): boolean {
  if (!usernameOrUserId || typeof usernameOrUserId !== 'string') return false;
  const clean = usernameOrUserId.trim().toLowerCase();
  if (!clean || isMasterAdminIdentifier(clean)) return false;
  const activeSession = getAccountSession();
  if (activeSession && activeSession.username.trim().toLowerCase() === clean) {
    return false;
  }
  return getDeletedAccountsTombstones().has(clean);
}

export function saveAccountSession(session: AccountSession | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (session) {
        const cleanUsername = session.username.trim().toLowerCase();
        const normalized: AccountSession = {
          ...session,
          username: cleanUsername,
          displayName: session.displayName.trim() || session.username.trim(),
          role: resolveAccountRole(cleanUsername, session.role),
        };
        localStorage.setItem(ACCOUNT_SESSION_STORAGE_KEY, JSON.stringify(normalized));
      } else {
        localStorage.removeItem(ACCOUNT_SESSION_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function getAccountSession(): AccountSession | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(ACCOUNT_SESSION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.username === 'string' &&
          parsed.username.trim().length > 0 &&
          typeof parsed.token === 'string'
        ) {
          const cleanUsername = parsed.username.trim().toLowerCase();
          return {
            ...(parsed as AccountSession),
            username: cleanUsername,
            role: resolveAccountRole(cleanUsername, parsed.role),
          };
        }
      }
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export interface RegisteredAccountEntry {
  userId: string;
  username: string;
  displayName: string;
  role: AccountRole;
  passwordVerifier?: string;
  password?: string;
  token?: string;
  createdAt: number;
  updatedAt: number;
  workspaceData: AppData;
  encryptedPayload?: EncryptedPayload | null;
}

export type CachedLocalAccountEntry = RegisteredAccountEntry;

function readRegistryMapFromStorage(key: string): Record<string, RegisteredAccountEntry> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, RegisteredAccountEntry>;
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

/**
 * Loads all persistent registered accounts from `axiom_accounts_registry_v1`
 * (and reconciles with `axiom_local_accounts_cache_v1` if present), enforcing roles,
 * filtering out deleted/tombstoned accounts, and guaranteeing that the Master Admin account
 * (`axiomdk99@gmail.com`) is always pre-seeded and auto-repaired against stale password hashes.
 */
export function getAllRegisteredAccountEntries(): Record<string, RegisteredAccountEntry> {
  const primary = readRegistryMapFromStorage(ACCOUNT_REGISTRY_STORAGE_KEY);
  const legacy = readRegistryMapFromStorage(LOCAL_ACCOUNTS_CACHE_KEY);
  const tombstones = getDeletedAccountsTombstones();
  const activeSessionUser = getAccountSession()?.username?.trim().toLowerCase() || '';
  const merged: Record<string, RegisteredAccountEntry> = {};

  for (const [rawKey, entry] of Object.entries({ ...legacy, ...primary })) {
    if (!entry || typeof entry !== 'object') continue;
    const cleanKey = (entry.username || rawKey || '').trim().toLowerCase();
    if (!cleanKey) continue;
    const cleanUserId = (entry.userId || '').trim().toLowerCase();
    if (
      !isMasterAdminIdentifier(cleanKey) &&
      cleanKey !== activeSessionUser &&
      (tombstones.has(cleanKey) || (cleanUserId && tombstones.has(cleanUserId)))
    ) {
      continue;
    }
    const existing = merged[cleanKey];
    if (!existing || (entry.updatedAt || 0) >= (existing.updatedAt || 0)) {
      const isMaster = isMasterAdminIdentifier(cleanKey);
      const canonicalMasterVerifier = isMaster ? MASTER_ADMIN_VERIFIER : undefined;
      merged[cleanKey] = {
        ...existing,
        ...entry,
        username: cleanKey,
        displayName: (
          entry.displayName ||
          existing?.displayName ||
          (isMaster ? MASTER_ADMIN_DEFAULT_DISPLAY_NAME : cleanKey)
        ).trim(),
        role: resolveAccountRole(cleanKey, entry.role ?? existing?.role),
        passwordVerifier: isMaster
          ? canonicalMasterVerifier
          : entry.passwordVerifier ||
            existing?.passwordVerifier ||
            (entry.password ? computeLocalPasswordVerifier(cleanKey, entry.password) : undefined),
        createdAt: entry.createdAt || existing?.createdAt || entry.updatedAt || Date.now(),
        updatedAt: entry.updatedAt || existing?.updatedAt || Date.now(),
      };
    }
  }

  // Guarantee Master Admin (axiomdk99@gmail.com) is always present and repaired
  const masterVerifier = MASTER_ADMIN_VERIFIER;
  const existingMaster = merged[MASTER_ADMIN_EMAIL];
  const now = Date.now();
  if (
    !existingMaster ||
    existingMaster.passwordVerifier !== masterVerifier ||
    existingMaster.role !== 'The App Creator'
  ) {
    merged[MASTER_ADMIN_EMAIL] = {
      userId: existingMaster?.userId || 'usr_master_admin_axiomdk99',
      username: MASTER_ADMIN_EMAIL,
      displayName: existingMaster?.displayName || MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
      role: 'The App Creator',
      passwordVerifier: masterVerifier,
      token:
        existingMaster?.token && existingMaster.token.includes(masterVerifier)
          ? existingMaster.token
          : createDeterministicAccountToken(MASTER_ADMIN_EMAIL, masterVerifier),
      createdAt: existingMaster?.createdAt || now,
      updatedAt: existingMaster?.updatedAt || now,
      workspaceData: (existingMaster?.workspaceData || null) as unknown as AppData,
      encryptedPayload: existingMaster?.encryptedPayload ?? null,
    };
  }

  return merged;
}

/**
 * Explicitly seeds or repairs the Master Admin account in `localStorage`
 * (`axiom_accounts_registry_v1`) on startup so both live web sessions and
 * standalone `Axiom-Aegis.html` builds immediately recognize the Master Admin account.
 */
export function ensureMasterAdminAccountSeeded(defaultWorkspace?: AppData): RegisteredAccountEntry {
  const map = getAllRegisteredAccountEntries();
  const masterEntry = map[MASTER_ADMIN_EMAIL];
  const masterVerifier = MASTER_ADMIN_VERIFIER;
  const now = Date.now();

  const repaired: RegisteredAccountEntry = {
    userId: masterEntry?.userId || 'usr_master_admin_axiomdk99',
    username: MASTER_ADMIN_EMAIL,
    displayName: masterEntry?.displayName || MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
    role: 'The App Creator',
    passwordVerifier: masterVerifier,
    token:
      masterEntry?.token && masterEntry.token.includes(masterVerifier)
        ? masterEntry.token
        : createDeterministicAccountToken(MASTER_ADMIN_EMAIL, masterVerifier),
    createdAt: masterEntry?.createdAt || now,
    updatedAt: masterEntry?.updatedAt || now,
    workspaceData: masterEntry?.workspaceData || (defaultWorkspace as AppData),
    encryptedPayload: masterEntry?.encryptedPayload ?? null,
  };

  map[MASTER_ADMIN_EMAIL] = repaired;

  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(map);
      localStorage.setItem(ACCOUNT_REGISTRY_STORAGE_KEY, serialized);
      localStorage.setItem(LOCAL_ACCOUNTS_CACHE_KEY, serialized);
    }
  } catch {
    // Ignore storage errors
  }

  return repaired;
}

export function saveLocalAccountCacheEntry(
  entry: Partial<RegisteredAccountEntry> & {
    userId: string;
    username: string;
    displayName: string;
    updatedAt: number;
    workspaceData: AppData;
  }
): RegisteredAccountEntry {
  const key = (entry.username || '').trim().toLowerCase();
  if (key) {
    clearAccountDeletionTombstone(key);
  }
  if (entry.userId) {
    clearAccountDeletionTombstone(entry.userId);
  }
  const map = getAllRegisteredAccountEntries();
  const existing = map[key];
  const now = Date.now();
  const isMaster = isMasterAdminIdentifier(key);
  const resolvedRole = resolveAccountRole(key, entry.role ?? existing?.role);
  const resolvedVerifier = isMaster
    ? MASTER_ADMIN_VERIFIER
    : entry.passwordVerifier ||
      (entry.password
        ? computeLocalPasswordVerifier(key, entry.password)
        : existing?.passwordVerifier);

  const nextEntry: RegisteredAccountEntry = {
    userId: entry.userId || existing?.userId || `usr_${now.toString(36)}`,
    username: key,
    displayName: (entry.displayName || existing?.displayName || key).trim(),
    role: resolvedRole,
    passwordVerifier: resolvedVerifier,
    token:
      entry.token ||
      existing?.token ||
      (resolvedVerifier ? createDeterministicAccountToken(key, resolvedVerifier) : ''),
    createdAt: entry.createdAt || existing?.createdAt || entry.updatedAt || now,
    updatedAt: entry.updatedAt || now,
    workspaceData: entry.workspaceData || existing?.workspaceData,
    encryptedPayload: entry.encryptedPayload ?? existing?.encryptedPayload ?? null,
  };

  map[key] = nextEntry;

  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(map);
      localStorage.setItem(ACCOUNT_REGISTRY_STORAGE_KEY, serialized);
      localStorage.setItem(LOCAL_ACCOUNTS_CACHE_KEY, serialized);
    }
  } catch {
    // Ignore storage errors
  }

  return nextEntry;
}

export function getLocalAccountCacheEntry(username: string): RegisteredAccountEntry | null {
  const key = (username || '').trim().toLowerCase();
  if (!key) return null;
  const map = getAllRegisteredAccountEntries();
  return map[key] || null;
}

export function verifyLocalAccountPassword(
  entry: RegisteredAccountEntry | null | undefined,
  password: string
): boolean {
  const cleanPass = (password || '').trim();
  if (!cleanPass) return false;
  if (entry && isMasterAdminCredentials(entry.username, cleanPass)) {
    return true;
  }
  if (!entry) return false;
  if (isMasterAdminIdentifier(entry.username)) {
    return isMasterAdminCredentials(entry.username, cleanPass);
  }
  const expectedVerifier = computeLocalPasswordVerifier(entry.username, cleanPass);
  if (entry.passwordVerifier && entry.passwordVerifier === expectedVerifier) {
    return true;
  }
  if (entry.password && entry.password.trim() === cleanPass) {
    return true;
  }
  // If an account was cached earlier before passwordVerifier was stored, allow adopting the password
  if (!entry.passwordVerifier && !entry.password) {
    return true;
  }
  return false;
}

export function updateLocalRegisteredAccountRole(
  usernameOrUserId: string,
  newRole: AccountRole
): RegisteredAccountEntry | null {
  const map = getAllRegisteredAccountEntries();
  const targetKey = Object.keys(map).find(
    (k) =>
      k === usernameOrUserId.trim().toLowerCase() ||
      map[k].userId === usernameOrUserId.trim()
  );
  if (!targetKey) return null;
  const record = map[targetKey];
  if (isMasterAdminIdentifier(record.username)) {
    return record;
  }
  const updated: RegisteredAccountEntry = {
    ...record,
    role: resolveAccountRole(record.username, newRole),
    updatedAt: Date.now(),
  };
  map[targetKey] = updated;
  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(map);
      localStorage.setItem(ACCOUNT_REGISTRY_STORAGE_KEY, serialized);
      localStorage.setItem(LOCAL_ACCOUNTS_CACHE_KEY, serialized);
    }
  } catch {
    // Ignore
  }
  return updated;
}

export function deleteLocalRegisteredAccount(usernameOrUserId: string): boolean {
  const cleanParam = (usernameOrUserId || '').trim().toLowerCase();
  if (!cleanParam || isMasterAdminIdentifier(cleanParam)) return false;

  const tombstones = getDeletedAccountsTombstones();
  tombstones.add(cleanParam);

  const primary = readRegistryMapFromStorage(ACCOUNT_REGISTRY_STORAGE_KEY);
  const legacy = readRegistryMapFromStorage(LOCAL_ACCOUNTS_CACHE_KEY);
  let foundAndRemoved = false;

  for (const storeObj of [primary, legacy]) {
    for (const [rawKey, entry] of Object.entries(storeObj)) {
      const entryUser = (entry?.username || rawKey || '').trim().toLowerCase();
      const entryId = (entry?.userId || '').trim().toLowerCase();
      if (entryUser === cleanParam || entryId === cleanParam || rawKey.toLowerCase() === cleanParam) {
        if (isMasterAdminIdentifier(entryUser)) {
          return false;
        }
        if (entryUser) tombstones.add(entryUser);
        if (entryId) tombstones.add(entryId);
        delete storeObj[rawKey];
        foundAndRemoved = true;
      }
    }
  }

  saveDeletedAccountsTombstones(tombstones);

  const map = getAllRegisteredAccountEntries();
  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(map);
      localStorage.setItem(ACCOUNT_REGISTRY_STORAGE_KEY, serialized);
      localStorage.setItem(LOCAL_ACCOUNTS_CACHE_KEY, serialized);
    }
  } catch {
    // Ignore
  }
  return foundAndRemoved || true;
}

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

function isValidPayload(p: unknown): p is EncryptedPayload {
  if (!p || typeof p !== 'object') return false;
  const candidate = p as Record<string, unknown>;
  return (
    typeof candidate.ciphertext === 'string' &&
    candidate.ciphertext.length > 0 &&
    typeof candidate.salt === 'string' &&
    candidate.salt.length > 0 &&
    typeof candidate.iv === 'string' &&
    candidate.iv.length > 0
  );
}

export async function saveEncryptedPayload(payload: EncryptedPayload): Promise<void> {
  const json = JSON.stringify(payload);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, json);
    }
  } catch (err) {
    console.warn('localStorage save warning:', err);
  }

  try {
    const db = await openIndexedDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.put(payload, PAYLOAD_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB write failed, relied on localStorage fallback:', err);
  }
}

export async function getEncryptedPayload(): Promise<EncryptedPayload | null> {
  let idbPayload: EncryptedPayload | null = null;
  let lsPayload: EncryptedPayload | null = null;

  try {
    const db = await openIndexedDB();
    const result = await new Promise<EncryptedPayload | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.get(PAYLOAD_KEY);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });

    if (isValidPayload(result)) {
      idbPayload = result;
    }
  } catch {
    // Ignore IndexedDB error
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (item) {
        const parsed = JSON.parse(item);
        if (isValidPayload(parsed)) {
          lsPayload = parsed;
        }
      }
    }
  } catch {
    // Ignore localStorage error
  }

  if (idbPayload && lsPayload) {
    return (lsPayload.timestamp || 0) >= (idbPayload.timestamp || 0) ? lsPayload : idbPayload;
  }

  return lsPayload || idbPayload || null;
}

const ACTIVE_HEX_KEY_STORAGE = 'axiom_active_encryption_key_hex';
const ACTIVE_FINGERPRINT_STORAGE = 'axiom_active_key_fingerprint';

export function saveActiveDeviceEncryptionIdentity(
  hexKey: string | null,
  keyFingerprint: string | null
): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (hexKey) {
        localStorage.setItem(ACTIVE_HEX_KEY_STORAGE, hexKey);
      } else {
        localStorage.removeItem(ACTIVE_HEX_KEY_STORAGE);
      }
      if (keyFingerprint) {
        localStorage.setItem(ACTIVE_FINGERPRINT_STORAGE, keyFingerprint);
      } else {
        localStorage.removeItem(ACTIVE_FINGERPRINT_STORAGE);
      }
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function saveUnifiedSyncAccount(session: UnifiedSyncAccountSession | null): void {
  try {
    if (typeof localStorage !== 'undefined') {
      if (session) {
        localStorage.setItem(UNIFIED_ACCOUNT_STORAGE, JSON.stringify(session));
      } else {
        localStorage.removeItem(UNIFIED_ACCOUNT_STORAGE);
      }
    }
  } catch {
    // Ignore localStorage errors
  }
}

export function getUnifiedSyncAccount(): UnifiedSyncAccountSession | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(UNIFIED_ACCOUNT_STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && typeof parsed.accountId === 'string') {
          return parsed as UnifiedSyncAccountSession;
        }
      }
    }
  } catch {
    // Ignore
  }
  return null;
}

export function getActiveDeviceEncryptionIdentity(): {
  hexKey: string | null;
  keyFingerprint: string | null;
} {
  try {
    if (typeof localStorage !== 'undefined') {
      return {
        hexKey: localStorage.getItem(ACTIVE_HEX_KEY_STORAGE),
        keyFingerprint: localStorage.getItem(ACTIVE_FINGERPRINT_STORAGE),
      };
    }
  } catch {
    // Ignore
  }
  return { hexKey: null, keyFingerprint: null };
}

export function saveSessionVaultCredential(credential: string | null): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (!credential) {
        sessionStorage.removeItem(SESSION_CREDENTIAL_KEY);
      } else {
        sessionStorage.setItem(SESSION_CREDENTIAL_KEY, credential);
      }
    }
  } catch {
    // Ignore
  }

  try {
    if (typeof localStorage !== 'undefined') {
      if (!credential) {
        localStorage.removeItem(REMEMBERED_DEVICE_KEY);
      } else {
        localStorage.setItem(REMEMBERED_DEVICE_KEY, credential);
      }
    }
  } catch {
    // Ignore
  }
}

export function getSessionVaultCredential(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const sessionVal = sessionStorage.getItem(SESSION_CREDENTIAL_KEY);
      if (sessionVal) return sessionVal;
    }
  } catch {
    // Ignore
  }

  try {
    if (typeof localStorage !== 'undefined') {
      const rememberedVal = localStorage.getItem(REMEMBERED_DEVICE_KEY);
      if (rememberedVal) {
        return rememberedVal;
      }
    }
  } catch {
    // Ignore
  }

  return null;
}

export async function hasExistingVault(): Promise<boolean> {
  const payload = await getEncryptedPayload();
  return payload !== null;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage &&
      typeof navigator.storage.persist === 'function'
    ) {
      const alreadyPersisted =
        typeof navigator.storage.persisted === 'function'
          ? await navigator.storage.persisted()
          : false;
      if (alreadyPersisted) {
        return true;
      }
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore
  }
  return false;
}

export async function clearEncryptedVault(): Promise<void> {
  saveSessionVaultCredential(null);
  saveActiveDeviceEncryptionIdentity(null, null);
  saveUnifiedSyncAccount(null);
  saveAccountSession(null);

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('axiom_aegis_tactical_note_draft_v1');
    }
  } catch {
    // Ignore
  }

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.removeItem('axioms_dailies_state');
      localStorage.removeItem('axioms_dailies_vault');
    }
  } catch {
    // Ignore
  }

  try {
    const db = await openIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const req = store.delete(PAYLOAD_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Ignore
  }
}
