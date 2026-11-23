/**
 * Axiom Aegis (AA) — Cloudflare Worker Backend & Site Registry Engine
 * 100% Web-API compliant (fetch, Request, Response, URL, URLSearchParams, caches).
 * Zero Node.js built-in modules.
 *
 * Provides persistent cross-device Account Registration, Authentication,
 * Ghost Account Reconciliation, Workspace Sync, and Master Admin Registry Overseer
 * for Axiomdk99@gmail.com ("The App Creator").
 */

const MASTER_ADMIN_EMAIL = 'axiomdk99@gmail.com';
const MASTER_ADMIN_VERIFIER = 'av1_026e574facf73013';
const MASTER_ADMIN_DEFAULT_DISPLAY_NAME = 'Axiom Creator';
const REGISTRY_CACHE_URL = 'https://axiom-aegis-registry.internal/v1/accounts-db.json';
const REGISTRY_KV_KEY = 'axiom_accounts_registry_v1';
const ACCOUNT_KV_PREFIX = 'axiom_acct_';
const APP_VERSION = 'v26.11.20';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, X-Axiom-Username',
};

const DEFAULT_DELETED_ACCOUNTS = [
  'commander_alex',
  'test_user',
  'testuser@example.com',
  'newsyncuser@example.com',
  'sync_commander',
];

// Global isolate memory store (persisted across requests & backed by Cloudflare Cache API / KV)
let memoryAccountsStore = new Map();
let memoryDeletedStore = new Set(DEFAULT_DELETED_ACCOUNTS);
let memoryVaultChannels = new Map();
let memoryHydrated = false;

function normalizeUsername(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

function isMasterAdminIdentifier(usernameOrEmail) {
  if (typeof usernameOrEmail !== 'string') return false;
  return usernameOrEmail.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}

function resolveAccountRole(usernameOrEmail, candidateRole) {
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

function computeLocalPasswordVerifier(username, password) {
  const input = `axiom-aegis-local-auth-v1:${String(username || '').trim().toLowerCase()}:${String(password || '').trim()}`;
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

function createWorkerSessionToken(username, verifier) {
  const cleanVerifier =
    verifier && String(verifier).startsWith('av1_')
      ? verifier
      : computeLocalPasswordVerifier(username, String(verifier || 'default'));
  const rand = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return `aegis_tok_${cleanVerifier}_${rand}`;
}

function extractVerifierFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  const match = /^aegis_tok_(av1_[0-9a-f]{16})_/i.exec(token.trim());
  return match ? match[1].toLowerCase() : null;
}

function ensureMasterAdminSeeded() {
  const now = Date.now();
  const existing = memoryAccountsStore.get(MASTER_ADMIN_EMAIL);
  if (!existing) {
    const token = createWorkerSessionToken(MASTER_ADMIN_EMAIL, MASTER_ADMIN_VERIFIER);
    memoryAccountsStore.set(MASTER_ADMIN_EMAIL, {
      userId: 'usr_master_axiomdk99',
      username: MASTER_ADMIN_EMAIL,
      displayName: MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
      role: 'The App Creator',
      passwordVerifier: MASTER_ADMIN_VERIFIER,
      sessionTokens: [token],
      createdAt: now,
      updatedAt: now,
      workspaceData: null,
    });
    return true;
  }
  if (existing.role !== 'The App Creator' || existing.passwordVerifier !== MASTER_ADMIN_VERIFIER) {
    existing.role = 'The App Creator';
    existing.passwordVerifier = MASTER_ADMIN_VERIFIER;
    memoryAccountsStore.set(MASTER_ADMIN_EMAIL, existing);
    return true;
  }
  return false;
}

let d1SchemaReady = false;

function getD1Binding(env) {
  if (!env || typeof env !== 'object') return null;
  const candidate = env.DB || env.AXIOM_DB || null;
  if (candidate && typeof candidate.prepare === 'function') {
    return candidate;
  }
  return null;
}

async function ensureD1Schema(db) {
  if (!db || d1SchemaReady) return;
  await db
    .prepare(
      'CREATE TABLE IF NOT EXISTS axiom_accounts (username TEXT PRIMARY KEY, user_id TEXT, display_name TEXT, role TEXT, password_verifier TEXT, session_tokens TEXT, created_at INTEGER, updated_at INTEGER, workspace_data TEXT)'
    )
    .run();
  await db
    .prepare('CREATE TABLE IF NOT EXISTS axiom_meta (meta_key TEXT PRIMARY KEY, meta_value TEXT)')
    .run();
  d1SchemaReady = true;
}

function mergeParsedRegistryIntoMemory(parsed) {
  if (!parsed || typeof parsed !== 'object') return;
  if (Array.isArray(parsed.deletedAccounts)) {
    for (const del of parsed.deletedAccounts) {
      const cleanDel = normalizeUsername(del);
      if (cleanDel && !isMasterAdminIdentifier(cleanDel)) {
        memoryDeletedStore.add(cleanDel);
        memoryAccountsStore.delete(cleanDel);
      }
    }
  }
  if (parsed.accounts && typeof parsed.accounts === 'object') {
    for (const [key, rec] of Object.entries(parsed.accounts)) {
      if (rec && typeof rec === 'object') {
        const cleanUser = normalizeUsername(rec.username || key);
        if (!cleanUser) continue;
        if (!isMasterAdminIdentifier(cleanUser) && memoryDeletedStore.has(cleanUser)) continue;
        const current = memoryAccountsStore.get(cleanUser);
        if (!current || (Number(rec.updatedAt) || 0) >= (Number(current.updatedAt) || 0)) {
          memoryAccountsStore.set(cleanUser, {
            ...rec,
            username: cleanUser,
            role: resolveAccountRole(cleanUser, rec.role),
            sessionTokens: Array.isArray(rec.sessionTokens) ? rec.sessionTokens : [],
          });
        }
      }
    }
  }
  if (parsed.vaultChannels && typeof parsed.vaultChannels === 'object') {
    for (const [chKey, envObj] of Object.entries(parsed.vaultChannels)) {
      if (chKey && envObj && typeof envObj === 'object') {
        const cur = memoryVaultChannels.get(chKey);
        if (!cur || (Number(envObj.updatedAt) || 0) >= (Number(cur.updatedAt) || 0)) {
          memoryVaultChannels.set(chKey, envObj);
        }
      }
    }
  }
}

async function hydrateRegistryState(env) {
  try {
    const db = getD1Binding(env);
    if (db) {
      await ensureD1Schema(db);
      const delRow = await db
        .prepare('SELECT meta_value FROM axiom_meta WHERE meta_key = ?')
        .bind('deleted_accounts')
        .first();
      if (delRow && delRow.meta_value) {
        try {
          const delArr = JSON.parse(delRow.meta_value);
          if (Array.isArray(delArr)) {
            for (const del of delArr) {
              const cleanDel = normalizeUsername(del);
              if (cleanDel && !isMasterAdminIdentifier(cleanDel)) {
                memoryDeletedStore.add(cleanDel);
                memoryAccountsStore.delete(cleanDel);
              }
            }
          }
        } catch {
          // Ignore malformed meta JSON
        }
      }
      const rowsResult = await db
        .prepare(
          'SELECT username, user_id, display_name, role, password_verifier, session_tokens, created_at, updated_at, workspace_data FROM axiom_accounts'
        )
        .all();
      const rows = Array.isArray(rowsResult?.results) ? rowsResult.results : [];
      for (const row of rows) {
        const cleanUser = normalizeUsername(row.username);
        if (!cleanUser) continue;
        if (!isMasterAdminIdentifier(cleanUser) && memoryDeletedStore.has(cleanUser)) continue;
        let parsedTokens = [];
        try {
          parsedTokens = row.session_tokens ? JSON.parse(row.session_tokens) : [];
        } catch {
          parsedTokens = [];
        }
        let parsedWs = null;
        try {
          parsedWs = row.workspace_data ? JSON.parse(row.workspace_data) : null;
        } catch {
          parsedWs = null;
        }
        const current = memoryAccountsStore.get(cleanUser);
        const rowUpdated = Number(row.updated_at) || 0;
        if (!current || rowUpdated >= (Number(current.updatedAt) || 0)) {
          memoryAccountsStore.set(cleanUser, {
            userId: row.user_id,
            username: cleanUser,
            displayName: row.display_name,
            role: resolveAccountRole(cleanUser, row.role),
            passwordVerifier: row.password_verifier || undefined,
            sessionTokens: Array.isArray(parsedTokens) ? parsedTokens : [],
            createdAt: Number(row.created_at) || Date.now(),
            updatedAt: rowUpdated || Date.now(),
            workspaceData: parsedWs,
          });
        }
      }
    }

    let rawJson = null;
    if (env && env.AXIOM_REGISTRY_KV && typeof env.AXIOM_REGISTRY_KV.get === 'function') {
      rawJson = await env.AXIOM_REGISTRY_KV.get(REGISTRY_KV_KEY);
    }
    if (!rawJson && typeof caches !== 'undefined' && caches.default) {
      const cachedResp = await caches.default.match(new Request(REGISTRY_CACHE_URL));
      if (cachedResp) {
        rawJson = await cachedResp.text();
      }
    }
    if (rawJson) {
      mergeParsedRegistryIntoMemory(JSON.parse(rawJson));
    }
  } catch {
    // Ignore storage hydration errors
  }
  ensureMasterAdminSeeded();
  memoryHydrated = true;
}

async function persistRegistryState(env, updatedUsername) {
  ensureMasterAdminSeeded();
  const accountsObj = {};
  for (const [key, rec] of memoryAccountsStore.entries()) {
    const cleanUser = normalizeUsername(key);
    if (!isMasterAdminIdentifier(cleanUser) && memoryDeletedStore.has(cleanUser)) continue;
    accountsObj[cleanUser] = {
      ...rec,
      username: cleanUser,
      role: resolveAccountRole(cleanUser, rec.role),
    };
  }
  const vaultChannelsObj = {};
  for (const [chKey, envObj] of memoryVaultChannels.entries()) {
    vaultChannelsObj[chKey] = envObj;
  }
  const deletedList = Array.from(memoryDeletedStore).filter(
    (u) => u && !isMasterAdminIdentifier(u)
  );
  const serialized = JSON.stringify({
    version: 1,
    updatedAt: Date.now(),
    deletedAccounts: deletedList,
    accounts: accountsObj,
    vaultChannels: vaultChannelsObj,
  });

  try {
    const db = getD1Binding(env);
    if (db) {
      await ensureD1Schema(db);
      await db
        .prepare('INSERT OR REPLACE INTO axiom_meta (meta_key, meta_value) VALUES (?, ?)')
        .bind('deleted_accounts', JSON.stringify(deletedList))
        .run();

      const targetUsers = updatedUsername
        ? [normalizeUsername(updatedUsername)].filter(Boolean)
        : Object.keys(accountsObj);
      for (const u of targetUsers) {
        const rec = accountsObj[u];
        if (rec) {
          await db
            .prepare(
              'INSERT OR REPLACE INTO axiom_accounts (username, user_id, display_name, role, password_verifier, session_tokens, created_at, updated_at, workspace_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            )
            .bind(
              rec.username,
              rec.userId,
              rec.displayName,
              rec.role,
              rec.passwordVerifier || '',
              JSON.stringify(rec.sessionTokens || []),
              Number(rec.createdAt) || Date.now(),
              Number(rec.updatedAt) || Date.now(),
              rec.workspaceData ? JSON.stringify(rec.workspaceData) : null
            )
            .run();
        } else {
          await db.prepare('DELETE FROM axiom_accounts WHERE username = ?').bind(u).run();
        }
      }
      if (deletedList.length > 0) {
        for (const delUser of deletedList) {
          if (!accountsObj[delUser]) {
            await db.prepare('DELETE FROM axiom_accounts WHERE username = ?').bind(delUser).run();
          }
        }
      }
    }
  } catch {
    // Ignore D1 write error
  }

  try {
    if (env && env.AXIOM_REGISTRY_KV && typeof env.AXIOM_REGISTRY_KV.put === 'function') {
      await env.AXIOM_REGISTRY_KV.put(REGISTRY_KV_KEY, serialized);
      if (updatedUsername) {
        const cleanTarget = normalizeUsername(updatedUsername);
        if (cleanTarget && accountsObj[cleanTarget]) {
          await env.AXIOM_REGISTRY_KV.put(
            `${ACCOUNT_KV_PREFIX}${cleanTarget}`,
            JSON.stringify(accountsObj[cleanTarget])
          );
        } else if (cleanTarget && typeof env.AXIOM_REGISTRY_KV.delete === 'function') {
          await env.AXIOM_REGISTRY_KV.delete(`${ACCOUNT_KV_PREFIX}${cleanTarget}`);
        }
      }
    }
  } catch {
    // Ignore KV write error
  }

  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const cacheResp = new Response(serialized, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=31536000',
        },
      });
      await caches.default.put(new Request(REGISTRY_CACHE_URL), cacheResp);
    }
  } catch {
    // Ignore Cache API write error
  }
}

function mergeWorkspaceServerSide(existingWs, incomingWs) {
  if (!existingWs || typeof existingWs !== 'object') return incomingWs;
  if (!incomingWs || typeof incomingWs !== 'object') return existingWs;

  const existingTs = Number(existingWs.updatedAt) || 0;
  const incomingTs = Number(incomingWs.updatedAt) || 0;

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const tombstones = {};
  for (const src of [existingWs.deletedItemTombstones, incomingWs.deletedItemTombstones]) {
    if (src && typeof src === 'object') {
      for (const [id, ts] of Object.entries(src)) {
        if (id && typeof ts === 'number' && Number.isFinite(ts) && ts >= cutoff) {
          tombstones[id] = Math.max(tombstones[id] || 0, ts);
        }
      }
    }
  }

  // When incoming is strictly newer or equal, apply tombstones to ensure deleted items stay excluded
  const applyTombstonesOnly = (arr) =>
    Array.isArray(arr)
      ? arr.filter((item) => {
          if (!item || !item.id) return false;
          const tombTs = tombstones[item.id];
          if (!tombTs) return true;
          const itemTs = item.updatedAt ?? item.createdAt ?? 0;
          return itemTs > tombTs;
        })
      : arr;

  const collectionKeys = [
    'categories',
    'goals',
    'funds',
    'bills',
    'distances',
    'dailyNotes',
    'chores',
    'lifeStats',
    'gallery',
    'timeline',
    'frequentEvents',
    'shortcuts',
    'siteImprovements',
    'customNavCategories',
  ];

  if (incomingTs >= existingTs) {
    const out = { ...incomingWs, deletedItemTombstones: tombstones };
    for (const key of collectionKeys) {
      if (Array.isArray(out[key])) {
        out[key] = applyTombstonesOnly(out[key]);
      }
    }
    return out;
  }

  // Incoming is older than existing cloud copy (stale concurrent write): merge collections by ID + tombstones
  const mergeById = (arrPrimary, arrSecondary) => {
    const map = new Map();
    if (Array.isArray(arrSecondary)) {
      for (const item of arrSecondary) {
        if (item && item.id) map.set(item.id, item);
      }
    }
    if (Array.isArray(arrPrimary)) {
      for (const item of arrPrimary) {
        if (item && item.id) {
          const prev = map.get(item.id);
          if (!prev) {
            map.set(item.id, item);
          } else {
            const itemTs = item.updatedAt ?? item.createdAt ?? 0;
            const prevTs = prev.updatedAt ?? prev.createdAt ?? 0;
            if (itemTs >= prevTs) map.set(item.id, item);
          }
        }
      }
    }
    return applyTombstonesOnly(Array.from(map.values()));
  };

  const merged = {
    ...incomingWs,
    ...existingWs,
    deletedItemTombstones: tombstones,
    settings: {
      ...(incomingWs.settings || {}),
      ...(existingWs.settings || {}),
    },
    updatedAt: Math.max(existingTs, incomingTs, Date.now()),
  };
  for (const key of collectionKeys) {
    merged[key] = mergeById(existingWs[key], incomingWs[key]);
  }
  return merged;
}

function computeWorkspaceRecordSummary(workspaceData) {
  if (!workspaceData || typeof workspaceData !== 'object') {
    return {
      timelineCount: 0,
      fundsCount: 0,
      goalsCount: 0,
      notesCount: 0,
      choresCount: 0,
      distancesCount: 0,
      lifeStatsCount: 0,
      galleryCount: 0,
      totalRecords: 0,
    };
  }
  const timelineCount = Array.isArray(workspaceData.timeline) ? workspaceData.timeline.length : 0;
  const fundsCount =
    (Array.isArray(workspaceData.funds) ? workspaceData.funds.length : 0) +
    (Array.isArray(workspaceData.bills) ? workspaceData.bills.length : 0);
  const goalsCount = Array.isArray(workspaceData.goals) ? workspaceData.goals.length : 0;
  const notesCount = Array.isArray(workspaceData.dailyNotes) ? workspaceData.dailyNotes.length : 0;
  const choresCount = Array.isArray(workspaceData.chores) ? workspaceData.chores.length : 0;
  const distancesCount = Array.isArray(workspaceData.distances) ? workspaceData.distances.length : 0;
  const lifeStatsCount = Array.isArray(workspaceData.lifeStats) ? workspaceData.lifeStats.length : 0;
  const galleryCount = Array.isArray(workspaceData.gallery) ? workspaceData.gallery.length : 0;
  const frequentCount = Array.isArray(workspaceData.frequentEvents)
    ? workspaceData.frequentEvents.length
    : 0;
  return {
    timelineCount,
    fundsCount,
    goalsCount,
    notesCount,
    choresCount,
    distancesCount,
    lifeStatsCount,
    galleryCount,
    totalRecords:
      timelineCount +
      fundsCount +
      goalsCount +
      notesCount +
      choresCount +
      distancesCount +
      lifeStatsCount +
      galleryCount +
      frequentCount,
  };
}

function syncDisplayNameIntoWorkspace(workspaceData, displayName, username) {
  if (!workspaceData || typeof workspaceData !== 'object') return null;
  const clone = { ...workspaceData };
  const currentSettings =
    clone.settings && typeof clone.settings === 'object' ? { ...clone.settings } : {};
  currentSettings.userName = displayName;
  currentSettings.commanderName = displayName;
  clone.settings = currentSettings;
  clone.profile = {
    ...(clone.profile && typeof clone.profile === 'object' ? clone.profile : {}),
    username,
    displayName,
    name: displayName,
    role: resolveAccountRole(username),
  };
  return clone;
}

function sanitizeAccountResponse(record, activeToken) {
  const enforcedRole = resolveAccountRole(record.username, record.role);
  return {
    userId: record.userId,
    username: record.username,
    displayName: record.displayName,
    role: enforcedRole,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    token: activeToken || (record.sessionTokens && record.sessionTokens[record.sessionTokens.length - 1]) || '',
    workspaceData: syncDisplayNameIntoWorkspace(
      record.workspaceData,
      record.displayName,
      record.username
    ),
  };
}

function isValidTokenForRecord(record, token) {
  if (!token || typeof token !== 'string') return false;
  if (Array.isArray(record.sessionTokens) && record.sessionTokens.includes(token)) return true;
  if (record.passwordVerifier && token.startsWith(`aegis_tok_${record.passwordVerifier}_`)) {
    return true;
  }
  if (isMasterAdminIdentifier(record.username) && token.startsWith(`aegis_tok_${MASTER_ADMIN_VERIFIER}_`)) {
    return true;
  }
  return false;
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

async function serveStaticAssetWithSpaFallback(request, env, url) {
  if (!env || !env.ASSETS || typeof env.ASSETS.fetch !== 'function') {
    return null;
  }
  const pathname = url.pathname;
  let assetResp = await env.ASSETS.fetch(request);
  if (
    (!assetResp || assetResp.status === 404) &&
    request.method === 'GET' &&
    (!pathname.includes('.') || pathname.endsWith('.html'))
  ) {
    const indexUrl = new URL('/index.html', url.origin);
    assetResp = await env.ASSETS.fetch(new Request(indexUrl.toString(), request));
  }
  if (!assetResp) return null;

  if (
    pathname === '/' ||
    pathname.endsWith('.html') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json'
  ) {
    const headers = new Headers(assetResp.headers);
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return new Response(assetResp.body, {
      status: assetResp.status,
      statusText: assetResp.statusText,
      headers,
    });
  }
  return assetResp;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    if (!pathname.startsWith('/api/')) {
      const staticResp = await serveStaticAssetWithSpaFallback(request, env, url);
      if (staticResp) {
        return staticResp;
      }
      return jsonResponse({
        ok: true,
        status: 'ok',
        service: 'Axiom Aegis Cloudflare Worker',
        version: APP_VERSION,
      });
    }

    await hydrateRegistryState(env);

    // GET /api/health
    if (pathname === '/api/health' && request.method === 'GET') {
      return jsonResponse({
        ok: true,
        status: 'ok',
        mode: 'cloudflare-worker-registry',
        version: APP_VERSION,
        accountsCount: memoryAccountsStore.size,
        timestamp: Date.now(),
      });
    }

    // Parse body if POST / PATCH / PUT
    let body = {};
    if (request.method === 'POST' || request.method === 'PATCH' || request.method === 'PUT') {
      try {
        body = await request.json();
      } catch {
        body = {};
      }
    }

    const authHeader = request.headers.get('Authorization') || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const token = bearerToken || (typeof body.token === 'string' ? body.token.trim() : '') || url.searchParams.get('token') || '';
    const usernameHint = normalizeUsername(
      body.username || url.searchParams.get('username') || request.headers.get('X-Axiom-Username')
    );

    const findAuthenticatedAccount = async () => {
      if (usernameHint) {
        let existing = memoryAccountsStore.get(usernameHint);
        if (
          !existing &&
          !memoryDeletedStore.has(usernameHint) &&
          env &&
          env.AXIOM_REGISTRY_KV &&
          typeof env.AXIOM_REGISTRY_KV.get === 'function'
        ) {
          try {
            const perAcct = await env.AXIOM_REGISTRY_KV.get(`${ACCOUNT_KV_PREFIX}${usernameHint}`);
            if (perAcct) {
              const parsed = JSON.parse(perAcct);
              if (parsed && parsed.username === usernameHint) {
                existing = parsed;
                memoryAccountsStore.set(usernameHint, parsed);
              }
            }
          } catch {
            // Ignore per-account KV read errors
          }
        }
        if (existing && token && isValidTokenForRecord(existing, token)) {
          existing.role = resolveAccountRole(existing.username, existing.role);
          return existing;
        }
        const tokenVerifier = extractVerifierFromToken(token);
        const isMasterAllowed =
          !isMasterAdminIdentifier(usernameHint) || tokenVerifier === MASTER_ADMIN_VERIFIER;
        if (
          !existing &&
          request.method === 'POST' &&
          tokenVerifier &&
          isMasterAllowed &&
          !memoryDeletedStore.has(usernameHint)
        ) {
          const now = Date.now();
          const healed = {
            userId: body.userId || `usr_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            username: usernameHint,
            displayName: (typeof body.displayName === 'string' && body.displayName.trim()) || usernameHint,
            role: resolveAccountRole(usernameHint, body.role),
            passwordVerifier: tokenVerifier,
            sessionTokens: token ? [token] : [],
            createdAt: Number(body.createdAt) || now,
            updatedAt: Number(body.updatedAt) || now,
            workspaceData: body.workspaceData || null,
          };
          memoryAccountsStore.set(usernameHint, healed);
          await persistRegistryState(env, usernameHint);
          return healed;
        }
      }
      if (token) {
        for (const rec of memoryAccountsStore.values()) {
          if (isValidTokenForRecord(rec, token)) {
            rec.role = resolveAccountRole(rec.username, rec.role);
            return rec;
          }
        }
      }
      return null;
    };

    // POST /api/auth/register | /api/accounts/register | /api/accounts
    if (
      (pathname === '/api/auth/register' ||
        pathname === '/api/accounts/register' ||
        pathname === '/api/accounts') &&
      request.method === 'POST'
    ) {
      const username = normalizeUsername(body.username);
      const displayName =
        typeof body.displayName === 'string' && body.displayName.trim()
          ? body.displayName.trim()
          : username;
      const password = typeof body.password === 'string' ? body.password.trim() : '';
      const verifier =
        typeof body.passwordVerifier === 'string' && body.passwordVerifier.startsWith('av1_')
          ? body.passwordVerifier
          : computeLocalPasswordVerifier(username, password);

      if (!username || username.length < 2) {
        return jsonResponse({ ok: false, error: 'Username or Email must be at least 2 characters.' }, 400);
      }
      if (!password && !body.passwordVerifier) {
        return jsonResponse({ ok: false, error: 'Password is required.' }, 400);
      }

      const existing = memoryAccountsStore.get(username);
      if (existing) {
        const expectedVerifier = isMasterAdminIdentifier(username)
          ? MASTER_ADMIN_VERIFIER
          : existing.passwordVerifier;
        if (expectedVerifier && expectedVerifier === verifier) {
          const newToken = createWorkerSessionToken(username, verifier);
          existing.sessionTokens = [...(existing.sessionTokens || []).slice(-9), newToken];
          if (displayName && displayName !== username && displayName !== 'User') {
            existing.displayName = displayName;
          }
          if (!existing.workspaceData && body.workspaceData) {
            existing.workspaceData = syncDisplayNameIntoWorkspace(body.workspaceData, existing.displayName, username);
          }
          memoryAccountsStore.set(username, existing);
          await persistRegistryState(env, username);
          return jsonResponse({ ok: true, account: sanitizeAccountResponse(existing, newToken) }, 200);
        }
        return jsonResponse({ ok: false, error: `Account "${username}" already exists. Please switch to Log In.` }, 409);
      }

      const now = Date.now();
      const newToken = createWorkerSessionToken(username, verifier);
      const newRecord = {
        userId: isMasterAdminIdentifier(username)
          ? 'usr_master_axiomdk99'
          : body.userId || `usr_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        username,
        displayName,
        role: resolveAccountRole(username, body.role),
        passwordVerifier: isMasterAdminIdentifier(username) ? MASTER_ADMIN_VERIFIER : verifier,
        sessionTokens: [newToken],
        createdAt: Number(body.createdAt) || now,
        updatedAt: now,
        workspaceData: syncDisplayNameIntoWorkspace(body.workspaceData || null, displayName, username),
      };
      memoryDeletedStore.delete(username);
      memoryAccountsStore.set(username, newRecord);
      await persistRegistryState(env, username);
      return jsonResponse({ ok: true, account: sanitizeAccountResponse(newRecord, newToken) }, 201);
    }

    // POST /api/auth/login | /api/accounts/login
    if ((pathname === '/api/auth/login' || pathname === '/api/accounts/login') && request.method === 'POST') {
      const username = normalizeUsername(body.username);
      const password = typeof body.password === 'string' ? body.password.trim() : '';
      if (!username || !password) {
        return jsonResponse({ ok: false, error: 'Please enter both your Username and Password.' }, 400);
      }
      const verifier = computeLocalPasswordVerifier(username, password);
      const record = memoryAccountsStore.get(username);
      if (!record) {
        return jsonResponse({ ok: false, error: `No account found for "${username}".` }, 404);
      }
      const expectedVerifier = isMasterAdminIdentifier(record.username)
        ? MASTER_ADMIN_VERIFIER
        : record.passwordVerifier;
      if (!expectedVerifier || expectedVerifier !== verifier) {
        return jsonResponse({ ok: false, error: 'Incorrect password for this account.' }, 401);
      }
      record.passwordVerifier = verifier;
      record.role = resolveAccountRole(record.username, record.role);
      const newToken = createWorkerSessionToken(record.username, verifier);
      record.sessionTokens = [...(record.sessionTokens || []).slice(-9), newToken];
      memoryAccountsStore.set(record.username, record);
      await persistRegistryState(env, record.username);
      return jsonResponse({ ok: true, account: sanitizeAccountResponse(record, newToken) }, 200);
    }

    // GET /api/auth/session
    if (pathname === '/api/auth/session' && request.method === 'GET') {
      const record = await findAuthenticatedAccount();
      if (!record) {
        return jsonResponse({ ok: false, error: 'Session expired or unauthorized.' }, 401);
      }
      return jsonResponse({ ok: true, account: sanitizeAccountResponse(record, token) });
    }

    // POST /api/accounts/reconcile | /api/admin/accounts/reconcile — Cross-Device Ghost Account Reconciliation
    if (
      (pathname === '/api/accounts/reconcile' || pathname === '/api/admin/accounts/reconcile') &&
      request.method === 'POST'
    ) {
      const incomingList = Array.isArray(body.accounts) ? body.accounts : [];
      let syncedCount = 0;
      const now = Date.now();

      for (const item of incomingList) {
        if (!item || typeof item !== 'object') continue;
        const cleanUser = normalizeUsername(item.username);
        if (!cleanUser || cleanUser.length < 2) continue;
        if (!isMasterAdminIdentifier(cleanUser) && memoryDeletedStore.has(cleanUser)) continue;

        const existing = memoryAccountsStore.get(cleanUser);
        const incomingVerifier =
          (typeof item.passwordVerifier === 'string' && item.passwordVerifier.startsWith('av1_')
            ? item.passwordVerifier
            : null) || extractVerifierFromToken(item.token);

        if (!existing) {
          const displayName =
            typeof item.displayName === 'string' && item.displayName.trim()
              ? item.displayName.trim()
              : cleanUser;
          const tokenToStore =
            typeof item.token === 'string' && item.token.trim()
              ? item.token.trim()
              : createWorkerSessionToken(cleanUser, incomingVerifier || cleanUser);

          memoryAccountsStore.set(cleanUser, {
            userId:
              item.userId ||
              (isMasterAdminIdentifier(cleanUser)
                ? 'usr_master_axiomdk99'
                : `usr_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`),
            username: cleanUser,
            displayName,
            role: resolveAccountRole(cleanUser, item.role),
            passwordVerifier: isMasterAdminIdentifier(cleanUser)
              ? MASTER_ADMIN_VERIFIER
              : incomingVerifier || undefined,
            sessionTokens: [tokenToStore],
            createdAt: Number(item.createdAt) || now,
            updatedAt: Number(item.updatedAt) || now,
            workspaceData: syncDisplayNameIntoWorkspace(
              item.workspaceData || null,
              displayName,
              cleanUser
            ),
          });
          syncedCount++;
        } else {
          const incomingUpdated = Number(item.updatedAt) || 0;
          if (incomingUpdated > (existing.updatedAt || 0) && item.workspaceData) {
            if (typeof item.displayName === 'string' && item.displayName.trim() && item.displayName !== 'User') {
              existing.displayName = item.displayName.trim();
            }
            existing.workspaceData = syncDisplayNameIntoWorkspace(
              item.workspaceData,
              existing.displayName,
              cleanUser
            );
            existing.updatedAt = incomingUpdated;
            if (typeof item.token === 'string' && item.token.trim() && !existing.sessionTokens.includes(item.token.trim())) {
              existing.sessionTokens = [...(existing.sessionTokens || []).slice(-9), item.token.trim()];
            }
            memoryAccountsStore.set(cleanUser, existing);
            syncedCount++;
          }
        }
      }

      if (syncedCount > 0) {
        await persistRegistryState(env);
      }

      const directoryRows = Array.from(memoryAccountsStore.values())
        .map((record) => ({
          userId: record.userId,
          username: record.username,
          displayName: record.displayName,
          role: resolveAccountRole(record.username, record.role),
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          ...computeWorkspaceRecordSummary(record.workspaceData),
          workspaceData: record.workspaceData,
        }))
        .sort((a, b) => {
          if (a.role === 'The App Creator') return -1;
          if (b.role === 'The App Creator') return 1;
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

      return jsonResponse({
        ok: true,
        syncedCount,
        totalAccounts: directoryRows.length,
        accounts: directoryRows,
      });
    }

    // GET & POST /api/account/sync
    if (pathname === '/api/account/sync') {
      const record = await findAuthenticatedAccount();
      if (!record) {
        return jsonResponse({ ok: false, error: 'Session expired or unauthorized.' }, 401);
      }
      if (request.method === 'GET') {
        return jsonResponse({ ok: true, account: sanitizeAccountResponse(record, token) });
      }
      if (request.method === 'POST') {
        const now = Date.now();
        if (typeof body.displayName === 'string' && body.displayName.trim()) {
          record.displayName = body.displayName.trim();
        }
        if (body.workspaceData && typeof body.workspaceData === 'object') {
          const mergedWs = mergeWorkspaceServerSide(record.workspaceData, body.workspaceData);
          const synced = syncDisplayNameIntoWorkspace(mergedWs, record.displayName, record.username);
          synced.updatedAt = Math.max(Number(synced.updatedAt) || 0, Number(body.workspaceData.updatedAt) || now);
          record.workspaceData = synced;
          record.updatedAt = synced.updatedAt;
        } else {
          record.updatedAt = now;
        }
        memoryAccountsStore.set(record.username, record);
        await persistRegistryState(env, record.username);
        return jsonResponse({ ok: true, account: sanitizeAccountResponse(record, token) });
      }
    }

    // MASTER ADMIN ENDPOINTS (/api/admin/*)
    if (pathname.startsWith('/api/admin/')) {
      const caller = await findAuthenticatedAccount();
      if (!caller || !isMasterAdminIdentifier(caller.username)) {
        return jsonResponse(
          { ok: false, error: '403 Forbidden: Master Admin ("The App Creator") authorization required.' },
          403
        );
      }

      if (pathname === '/api/admin/accounts' && request.method === 'GET') {
        const accountsList = Array.from(memoryAccountsStore.values())
          .map((record) => ({
            userId: record.userId,
            username: record.username,
            displayName: record.displayName,
            role: resolveAccountRole(record.username, record.role),
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            ...computeWorkspaceRecordSummary(record.workspaceData),
            workspaceData: record.workspaceData,
          }))
          .sort((a, b) => {
            if (a.role === 'The App Creator') return -1;
            if (b.role === 'The App Creator') return 1;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
          });

        return jsonResponse({
          ok: true,
          totalAccounts: accountsList.length,
          accounts: accountsList,
        });
      }

      if (pathname === '/api/admin/database/export' && request.method === 'POST') {
        const sanitizedAccounts = {};
        for (const [key, rec] of memoryAccountsStore.entries()) {
          sanitizedAccounts[key] = {
            userId: rec.userId,
            username: rec.username,
            displayName: rec.displayName,
            role: resolveAccountRole(rec.username, rec.role),
            createdAt: rec.createdAt,
            updatedAt: rec.updatedAt,
            ...computeWorkspaceRecordSummary(rec.workspaceData),
            workspaceData: rec.workspaceData,
          };
        }
        return jsonResponse({
          ok: true,
          exportedAt: new Date().toISOString(),
          exportedBy: caller.username,
          totalAccounts: memoryAccountsStore.size,
          accounts: sanitizedAccounts,
        });
      }

      const roleMatch = /^\/api\/admin\/accounts\/([^/]+)\/role$/.exec(pathname);
      if (roleMatch && request.method === 'PATCH') {
        const targetParam = decodeURIComponent(roleMatch[1] || '').trim().toLowerCase();
        const requestedRole = body.role;
        if (requestedRole !== 'VIP' && requestedRole !== 'User') {
          return jsonResponse({ ok: false, error: 'Invalid role.' }, 400);
        }
        let targetRecord = memoryAccountsStore.get(targetParam);
        if (!targetRecord) {
          for (const rec of memoryAccountsStore.values()) {
            if (rec.userId.toLowerCase() === targetParam || rec.username.toLowerCase() === targetParam) {
              targetRecord = rec;
              break;
            }
          }
        }
        if (!targetRecord) {
          return jsonResponse({ ok: false, error: 'Target account not found.' }, 404);
        }
        if (isMasterAdminIdentifier(targetRecord.username)) {
          return jsonResponse({ ok: false, error: 'Cannot modify Master Admin role.' }, 400);
        }
        targetRecord.role = requestedRole;
        targetRecord.updatedAt = Date.now();
        memoryAccountsStore.set(targetRecord.username, targetRecord);
        await persistRegistryState(env);
        return jsonResponse({
          ok: true,
          account: {
            userId: targetRecord.userId,
            username: targetRecord.username,
            displayName: targetRecord.displayName,
            role: targetRecord.role,
            createdAt: targetRecord.createdAt,
            updatedAt: targetRecord.updatedAt,
            ...computeWorkspaceRecordSummary(targetRecord.workspaceData),
          },
        });
      }

      const itemMatch = /^\/api\/admin\/accounts\/([^/]+)$/.exec(pathname);
      if (itemMatch) {
        const targetParam = decodeURIComponent(itemMatch[1] || '').trim().toLowerCase();
        let targetRecord = memoryAccountsStore.get(targetParam);
        if (!targetRecord) {
          for (const rec of memoryAccountsStore.values()) {
            if (rec.userId.toLowerCase() === targetParam || rec.username.toLowerCase() === targetParam) {
              targetRecord = rec;
              break;
            }
          }
        }
        if (request.method === 'GET') {
          if (!targetRecord) {
            return jsonResponse({ ok: false, error: 'Target account not found.' }, 404);
          }
          return jsonResponse({
            ok: true,
            account: {
              userId: targetRecord.userId,
              username: targetRecord.username,
              displayName: targetRecord.displayName,
              role: resolveAccountRole(targetRecord.username, targetRecord.role),
              createdAt: targetRecord.createdAt,
              updatedAt: targetRecord.updatedAt,
              ...computeWorkspaceRecordSummary(targetRecord.workspaceData),
              workspaceData: targetRecord.workspaceData,
            },
          });
        }
        if (request.method === 'DELETE') {
          if (isMasterAdminIdentifier(targetParam) || (targetRecord && isMasterAdminIdentifier(targetRecord.username))) {
            return jsonResponse({ ok: false, error: 'Cannot delete Master Admin account.' }, 400);
          }
          const deletedUser = targetRecord ? targetRecord.username : targetParam;
          memoryDeletedStore.add(targetParam);
          if (targetRecord) {
            memoryDeletedStore.add(targetRecord.username.toLowerCase());
            if (targetRecord.userId) memoryDeletedStore.add(targetRecord.userId.toLowerCase());
            memoryAccountsStore.delete(targetRecord.username);
          }
          await persistRegistryState(env, deletedUser);
          return jsonResponse({
            ok: true,
            deletedUsername: deletedUser,
          });
        }
      }
    }

    // GET & POST /api/vault-sync — Encrypted Vault Channel Relay
    if (pathname === '/api/vault-sync') {
      const rawChannel =
        url.searchParams.get('channel') ||
        (typeof body.channel === 'string' ? body.channel : '') ||
        '';
      const channelKey = rawChannel
        ? String(rawChannel).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64) || 'default'
        : 'default';

      if (request.method === 'GET') {
        const envelope = memoryVaultChannels.get(channelKey) || null;
        return jsonResponse({
          hasVault: Boolean(envelope),
          channel: channelKey,
          envelope,
        });
      }

      if (request.method === 'POST') {
        const candidate = body && body.envelope ? body.envelope : body;
        if (
          !candidate ||
          candidate.format !== 'axiom-aegis-cloud-vault-v1' ||
          !candidate.payload ||
          typeof candidate.payload.ciphertext !== 'string'
        ) {
          return jsonResponse({ ok: false, error: 'Invalid vault envelope.' }, 400);
        }
        memoryVaultChannels.set(channelKey, candidate);
        await persistRegistryState(env);
        return jsonResponse({
          ok: true,
          channel: channelKey,
          updatedAt: candidate.updatedAt || Date.now(),
          envelope: candidate,
        });
      }
    }

    if (pathname === '/api/standalone-html' && request.method === 'GET') {
      if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
        let assetResp = await env.ASSETS.fetch(
          new Request(new URL('/Axiom-Aegis.html', url.origin).toString())
        );
        if (!assetResp || !assetResp.ok) {
          assetResp = await env.ASSETS.fetch(
            new Request(new URL('/index.html', url.origin).toString())
          );
        }
        if (assetResp && assetResp.ok) {
          const htmlBody = await assetResp.text();
          return new Response(htmlBody, {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'text/html; charset=utf-8',
              'Content-Disposition': 'attachment; filename="index.html"',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          });
        }
      }
      return jsonResponse({ ok: false, error: 'Standalone HTML asset unavailable on Worker' }, 404);
    }

    return jsonResponse({ ok: false, error: 'Not Found' }, 404);
  },
};

