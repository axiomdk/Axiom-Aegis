import { EncryptedPayload } from '../types';

const PBKDF2_ITERATIONS = 600000;
const KEY_LENGTH_BITS = 256;
const SALT_BYTE_LENGTH = 16;
const IV_BYTE_LENGTH = 12;
export const DEFAULT_SESSION_PASSPHRASE = 'axiom-local-session';

export interface CachedKeyEntry {
  cryptoKey: CryptoKey;
  nonExtractableKey: CryptoKey;
  hexKey: string;
  fingerprint: string;
}

// In-memory session cache for deterministic (passphrase, salt, iterations) PBKDF2 derivations
// and active session raw-hex keys. Cleared whenever the vault is locked or reset.
const derivedKeyCache = new Map<string, CachedKeyEntry>();

export function clearDerivedKeyCache(): void {
  derivedKeyCache.clear();
}

export function getDerivedKeyCacheSize(): number {
  return derivedKeyCache.size;
}

export function hasCachedSessionCryptoKey(
  passphraseOrKey: string,
  saltBase64: string,
  iterations: number = PBKDF2_ITERATIONS
): boolean {
  const rawBytes = parseRawEncryptionKey(passphraseOrKey);
  if (rawBytes) {
    const rawHex = bufferToHex(rawBytes);
    return derivedKeyCache.has(`raw::${rawHex}`);
  }
  return derivedKeyCache.has(`${passphraseOrKey}::${saltBase64}::${iterations}`);
}

/**
 * Convert ArrayBuffer or Uint8Array to Base64 string
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Convert ArrayBuffer or Uint8Array to lowercase 64-character Hex string
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert Hex string to Uint8Array
 */
export function hexToBuffer(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, '').replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Parse a user-supplied string to check if it is a raw 256-bit (32-byte) AES Encryption Key
 * Supports:
 * - 64-char hex key (e.g. "a1b2c3...")
 * - Formatted AEGIS recovery key (e.g. "AEGIS-A1B2-C3D4-...")
 * - 0x-prefixed 64-char hex key
 */
export function parseRawEncryptionKey(input: string): Uint8Array | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  // Check if formatted as AEGIS-... recovery key
  if (/^AEGIS-[0-9A-Fa-f-]+$/i.test(trimmed)) {
    const stripped = trimmed.replace(/^AEGIS-/i, '').replace(/-/g, '');
    if (/^[0-9a-fA-F]{64}$/.test(stripped)) {
      return hexToBuffer(stripped);
    }
  }

  // Check if 64-char hex (optionally 0x-prefixed or hyphen/space separated in 8x8 / 16x4 groups)
  const withoutPrefix = trimmed.replace(/^0x/i, '');
  if (/^[0-9a-fA-F]{64}$/.test(withoutPrefix)) {
    return hexToBuffer(withoutPrefix);
  }

  // Also support hyphen-separated 64-char hex blocks (e.g. 8 groups of 8 hex chars or 16 groups of 4 hex chars)
  if (/^[0-9a-fA-F]{4,8}(-[0-9a-fA-F]{4,8}){7,15}$/.test(withoutPrefix)) {
    const collapsed = withoutPrefix.replace(/-/g, '');
    if (collapsed.length === 64) {
      return hexToBuffer(collapsed);
    }
  }

  return null;
}

/**
 * Format a 64-character hex key into a human-readable AEGIS Recovery Key
 */
export function formatRecoveryKey(hexKey: string): string {
  const clean = hexKey.trim().replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (clean.length !== 64) return clean;
  const groups: string[] = [];
  for (let i = 0; i < 64; i += 8) {
    groups.push(clean.slice(i, i + 8));
  }
  return `AEGIS-${groups.join('-')}`;
}

/**
 * Compute a deterministic 16-char SHA-256 fingerprint (XXXX-XXXX-XXXX-XXXX) for a 64-char hex key
 */
export async function computeKeyFingerprint(hexKey: string): Promise<string> {
  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!cryptoSubtle) {
    return hexKey.slice(0, 16).toUpperCase();
  }
  const keyBytes = hexToBuffer(hexKey);
  const digest = await cryptoSubtle.digest('SHA-256', keyBytes as unknown as BufferSource);
  const digestHex = bufferToHex(digest).toUpperCase().slice(0, 16);
  return `${digestHex.slice(0, 4)}-${digestHex.slice(4, 8)}-${digestHex.slice(8, 12)}-${digestHex.slice(12, 16)}`;
}

/**
 * Generate cryptographically secure random bytes
 */
export function getRandomBytes(length: number): Uint8Array {
  const cryptoObj = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  if (!cryptoObj || !cryptoObj.getRandomValues) {
    throw new Error('Web Crypto API is not available in this environment');
  }
  const bytes = new Uint8Array(length);
  cryptoObj.getRandomValues(bytes);
  return bytes;
}

/**
 * Generate a 16-byte (128-bit) cryptographic salt
 */
export function generateSalt(length: number = SALT_BYTE_LENGTH): Uint8Array {
  return getRandomBytes(length);
}

export interface UnifiedAccountCredentials {
  accountId: string;
  displayAccountId: string;
  saltBytes: Uint8Array;
  saltBase64: string;
  hexKey: string;
  keyFingerprint: string;
  channelId: string;
}

/**
 * Normalizes an account identifier (email or username) so two devices always derive
 * the exact same deterministic salt, 256-bit key, Key ID, and sync channel.
 */
export function normalizeUnifiedAccountId(accountId?: string | null): string {
  const cleaned = (accountId || '').trim().toLowerCase();
  return cleaned || 'axiom-unified-global-vault';
}

/**
 * Derives a 100% deterministic 16-byte PBKDF2 salt from the normalized Account ID (or passphrase domain)
 * using SHA-256. Ensures Device A and Device B never have mismatched random salts when using the same login.
 */
export async function deriveDeterministicAccountSalt(
  accountId?: string | null
): Promise<Uint8Array> {
  const normalized = normalizeUnifiedAccountId(accountId);
  const inputBytes = new TextEncoder().encode(`axiom-aegis-unified-salt-v2:${normalized}`);
  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!cryptoSubtle) {
    const fallback = new Uint8Array(SALT_BYTE_LENGTH);
    for (let i = 0; i < SALT_BYTE_LENGTH; i++) {
      fallback[i] = inputBytes[i % inputBytes.length] ^ ((i * 31 + 17) & 0xff);
    }
    return fallback;
  }
  const digest = await cryptoSubtle.digest('SHA-256', inputBytes as unknown as BufferSource);
  return new Uint8Array(digest.slice(0, SALT_BYTE_LENGTH));
}

/**
 * Import raw 32-byte key bytes as an AES-256-GCM CryptoKey
 */
export async function importRawAesKey(
  rawKeyBytes: Uint8Array,
  extractable: boolean = true
): Promise<CryptoKey> {
  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!cryptoSubtle) {
    throw new Error('crypto.subtle is not supported');
  }
  if (rawKeyBytes.byteLength !== 32) {
    throw new Error('AES-256 key must be exactly 32 bytes (256 bits)');
  }
  return cryptoSubtle.importKey(
    'raw',
    rawKeyBytes as unknown as BufferSource,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    extractable,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export an extractable AES-256-GCM CryptoKey to a 64-character lowercase hex string
 */
export async function exportKeyToHex(key: CryptoKey): Promise<string> {
  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!cryptoSubtle) {
    throw new Error('crypto.subtle is not supported');
  }
  const rawBuffer = await cryptoSubtle.exportKey('raw', key);
  return bufferToHex(rawBuffer);
}

/**
 * Retrieve or derive and cache a complete session key entry (including a non-extractable
 * CryptoKey for <2ms fast-path AES-GCM encryption and precomputed SHA-256 fingerprint).
 */
async function getOrDeriveCachedKeyEntry(
  passphrase: string,
  saltBytes: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CachedKeyEntry> {
  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!cryptoSubtle) {
    throw new Error('crypto.subtle is not supported');
  }

  // Fast path 1: Caller passed a raw 256-bit key (hex or AEGIS-...)
  const rawKeyBytes = parseRawEncryptionKey(passphrase);
  if (rawKeyBytes) {
    const hexKey = bufferToHex(rawKeyBytes);
    const rawCacheKey = `raw::${hexKey}`;
    const existingRaw = derivedKeyCache.get(rawCacheKey);
    if (existingRaw) {
      return existingRaw;
    }
    const [cryptoKey, nonExtractableKey, fingerprint] = await Promise.all([
      importRawAesKey(rawKeyBytes, true),
      importRawAesKey(rawKeyBytes, false),
      computeKeyFingerprint(hexKey),
    ]);
    const entry: CachedKeyEntry = { cryptoKey, nonExtractableKey, hexKey, fingerprint };
    derivedKeyCache.set(rawCacheKey, entry);
    return entry;
  }

  // Fast path 2: Check (passphrase, salt, iterations) in-memory cache
  const saltBase64 = bufferToBase64(saltBytes);
  const cacheKey = `${passphrase}::${saltBase64}::${iterations}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Slow path (only on initial unlock, vault setup, or passphrase change): run 600k PBKDF2
  const enc = new TextEncoder();
  const passphraseKey = await cryptoSubtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const derived = await cryptoSubtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt']
  );

  const rawBuffer = await cryptoSubtle.exportKey('raw', derived);
  const rawDerivedBytes = new Uint8Array(rawBuffer);
  const hexKey = bufferToHex(rawDerivedBytes);
  const [nonExtractableKey, fingerprint] = await Promise.all([
    importRawAesKey(rawDerivedBytes, false),
    computeKeyFingerprint(hexKey),
  ]);

  const entry: CachedKeyEntry = {
    cryptoKey: derived,
    nonExtractableKey,
    hexKey,
    fingerprint,
  };
  derivedKeyCache.set(cacheKey, entry);
  // Also populate raw::hexKey so subsequent session saves using the canonical hex key hit O(1) cache immediately
  derivedKeyCache.set(`raw::${hexKey}`, entry);
  return entry;
}

/**
 * Derive AES-256-GCM CryptoKey from passphrase and salt using PBKDF2 SHA-256
 */
export async function deriveKey(
  passphrase: string,
  saltBytes: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const entry = await getOrDeriveCachedKeyEntry(passphrase, saltBytes, iterations);
  return entry.cryptoKey;
}

/**
 * Derive the 64-character hex AES-256 key from a passphrase (or raw key) and base64 salt
 */
export async function deriveKeyHex(
  passphraseOrKey: string,
  saltBase64: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<string> {
  const rawBytes = parseRawEncryptionKey(passphraseOrKey);
  if (rawBytes) {
    return bufferToHex(rawBytes);
  }
  const cacheKey = `${passphraseOrKey}::${saltBase64}::${iterations}`;
  const cached = derivedKeyCache.get(cacheKey);
  if (cached) {
    return cached.hexKey;
  }
  const saltBytes = base64ToBuffer(saltBase64);
  const entry = await getOrDeriveCachedKeyEntry(passphraseOrKey, saltBytes, iterations);
  return entry.hexKey;
}

/**
 * Derive complete key details (64-char hex key, Key ID fingerprint, and base64 salt)
 */
export async function deriveKeyDetails(
  passphraseOrKey: string,
  saltBytes: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<{
  rawKeyHex: string;
  fingerprint: string;
  saltBase64: string;
  cryptoKey: CryptoKey;
}> {
  const entry = await getOrDeriveCachedKeyEntry(passphraseOrKey, saltBytes, iterations);
  return {
    rawKeyHex: entry.hexKey,
    fingerprint: entry.fingerprint,
    saltBase64: bufferToBase64(saltBytes),
    cryptoKey: entry.cryptoKey,
  };
}

/**
 * Derives 100% deterministic Unified Account credentials from (accountId, passwordOrKey).
 * Any two devices logging in with the same Account ID (Email/Username) and Password
 * are guaranteed to derive the exact same salt, 256-Bit AES Hex Key, Key ID (XXXX-XXXX-XXXX-XXXX),
 * and Sync Channel ID (ch_acct_...).
 */
export async function deriveUnifiedAccountCredentials(
  accountId: string,
  passwordOrKey: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<UnifiedAccountCredentials> {
  const cleanPass = (passwordOrKey || '').trim();
  if (!cleanPass || cleanPass.length < 4) {
    throw new Error('Sync password must be at least 4 characters.');
  }
  const normalizedId = normalizeUnifiedAccountId(accountId);
  const displayId = (accountId || '').trim() || 'Unified Vault';
  const saltBytes = await deriveDeterministicAccountSalt(normalizedId);
  const saltBase64 = bufferToBase64(saltBytes);
  const entry = await getOrDeriveCachedKeyEntry(cleanPass, saltBytes, iterations);

  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  let channelId = '';
  const channelSeed = `axiom-aegis-unified-channel-v2:${normalizedId}:${entry.hexKey}`;
  if (cryptoSubtle) {
    const digest = await cryptoSubtle.digest(
      'SHA-256',
      new TextEncoder().encode(channelSeed) as unknown as BufferSource
    );
    channelId = `ch_acct_${bufferToHex(new Uint8Array(digest.slice(0, 10)))}`;
  } else {
    channelId = `ch_acct_${entry.hexKey.slice(0, 20)}`;
  }

  return {
    accountId: normalizedId,
    displayAccountId: displayId,
    saltBytes,
    saltBase64,
    hexKey: entry.hexKey,
    keyFingerprint: entry.fingerprint,
    channelId,
  };
}

/**
 * Encrypt any serializable data using AES-256-GCM.
 * Uses the cached in-memory non-extractable CryptoKey during active unlocked sessions
 * so routine auto-saves complete in <2ms with a fresh 12-byte CSPRNG IV per write.
 */
export async function encryptData(
  data: unknown,
  passphrase: string,
  existingSalt?: Uint8Array,
  hasCustomPassword?: boolean
): Promise<EncryptedPayload> {
  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!cryptoSubtle) {
    throw new Error('Web Crypto subtle API not available');
  }

  const salt = existingSalt || getRandomBytes(SALT_BYTE_LENGTH);
  const iv = getRandomBytes(IV_BYTE_LENGTH);
  const keyEntry = await getOrDeriveCachedKeyEntry(passphrase, salt);

  const jsonString = JSON.stringify(data);
  const encodedData = new TextEncoder().encode(jsonString);

  const encryptedBuffer = await cryptoSubtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    keyEntry.nonExtractableKey,
    encodedData
  );

  const isCustom =
    hasCustomPassword !== undefined
      ? hasCustomPassword
      : Boolean(passphrase && passphrase !== DEFAULT_SESSION_PASSPHRASE);

  return {
    version: 1,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(encryptedBuffer),
    timestamp: Date.now(),
    keyFingerprint: keyEntry.fingerprint,
    hasCustomPassword: isCustom,
  };
}

/**
 * Decrypt payload using AES-256-GCM.
 * Supports unlocking with:
 * 1. The user's Master Passphrase (via PBKDF2 SHA-256 600,000 iterations)
 * 2. The derived 64-character Hex AES-256 Encryption Key
 * 3. The formatted AEGIS-XXXX-... Recovery Encryption Key
 * Also gracefully handles accidental leading/trailing spaces when pasting credentials.
 */
export async function decryptData<T>(
  payload: EncryptedPayload,
  passphraseOrKey: string
): Promise<T> {
  const cryptoSubtle = (typeof window !== 'undefined' ? window.crypto : globalThis.crypto)?.subtle;
  if (!cryptoSubtle) {
    throw new Error('Web Crypto subtle API not available');
  }

  const saltBytes = base64ToBuffer(payload.salt);
  const ivBytes = base64ToBuffer(payload.iv);
  const cipherBytes = base64ToBuffer(payload.ciphertext);

  // Build candidate keys to try in priority order:
  // 1. If passphraseOrKey matches a raw 256-bit hex or AEGIS-... key, try raw AES-256 key import first
  // 2. Try PBKDF2 derivation with exact passphraseOrKey
  // 3. If passphraseOrKey has leading/trailing whitespace, try trimmed passphrase via PBKDF2
  const candidateKeys: CryptoKey[] = [];

  const rawKeyBytes = parseRawEncryptionKey(passphraseOrKey);
  if (rawKeyBytes) {
    try {
      const rawCryptoKey = await importRawAesKey(rawKeyBytes);
      candidateKeys.push(rawCryptoKey);
    } catch {
      // Fall through to PBKDF2
    }
  } else {
    try {
      const derivedExact = await deriveKey(passphraseOrKey, saltBytes);
      candidateKeys.push(derivedExact);
    } catch {
      // Ignore derivation error
    }

    const trimmed = passphraseOrKey.trim();
    if (trimmed && trimmed !== passphraseOrKey && !parseRawEncryptionKey(trimmed)) {
      try {
        const derivedTrimmed = await deriveKey(trimmed, saltBytes);
        candidateKeys.push(derivedTrimmed);
      } catch {
        // Ignore
      }
    }
  }

  for (const key of candidateKeys) {
    try {
      const decryptedBuffer = await cryptoSubtle.decrypt(
        {
          name: 'AES-GCM',
          iv: ivBytes as unknown as BufferSource,
        },
        key,
        cipherBytes as unknown as BufferSource
      );

      const decoded = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(decoded) as T;
    } catch {
      // Try next candidate key
    }
  }

  throw new Error('Invalid passphrase or encryption key, or corrupted encrypted payload.');
}

/**
 * Verify whether a given passphrase or raw encryption key can decrypt the provided payload,
 * and return the resolved 64-char hex encryption key and fingerprint.
 */
export async function verifyVaultPassphraseOrKey(
  payload: EncryptedPayload,
  passphraseOrKey: string
): Promise<{
  valid: boolean;
  mode: 'password' | 'raw_key' | null;
  derivedHexKey?: string;
  keyFingerprint?: string;
}> {
  if (!payload || !passphraseOrKey) {
    return { valid: false, mode: null };
  }
  try {
    await decryptData(payload, passphraseOrKey);
    const isRaw = Boolean(parseRawEncryptionKey(passphraseOrKey));
    const hexKey = await deriveKeyHex(
      isRaw ? passphraseOrKey.trim() : passphraseOrKey,
      payload.salt
    );
    const fingerprint = await computeKeyFingerprint(hexKey);
    return {
      valid: true,
      mode: isRaw ? 'raw_key' : 'password',
      derivedHexKey: hexKey,
      keyFingerprint: fingerprint,
    };
  } catch {
    return { valid: false, mode: null };
  }
}
