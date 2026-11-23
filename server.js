import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "data");
const ACCOUNTS_DB_FILE = path.join(DATA_DIR, "accounts-db.json");
const VAULT_SYNC_FILE = path.join(__dirname, ".aegis-cloud-vault.json");
const MASTER_ADMIN_EMAIL = "axiomdk99@gmail.com";
const MASTER_ADMIN_VERIFIER = "av1_026e574facf73013";
const MASTER_ADMIN_SALT_HEX = "9f4b2c8e1a7d6035c4e8912b7a6d5f03";
const MASTER_ADMIN_SCRYPT_HASH_HEX = "9a1a03ebc7ec0578eaa3629e6f1fc42b3498a10aa76df078e399925c13dc3ef9bf56655af74f650d8b423da4164527c90a90cb0fda48d2827b3a1cead087ef8f";
const MASTER_ADMIN_DEFAULT_DISPLAY_NAME = "Axiom Creator";
function isMasterAdminIdentifier(usernameOrEmail) {
  if (typeof usernameOrEmail !== "string") return false;
  return usernameOrEmail.trim().toLowerCase() === MASTER_ADMIN_EMAIL;
}
function isMasterAdminCredentials(usernameOrEmail, password) {
  if (!isMasterAdminIdentifier(usernameOrEmail) || typeof password !== "string") return false;
  const cleanPass = password.trim();
  if (!cleanPass) return false;
  return computeLocalPasswordVerifier(MASTER_ADMIN_EMAIL, cleanPass) === MASTER_ADMIN_VERIFIER && verifyPassword(cleanPass, MASTER_ADMIN_SCRYPT_HASH_HEX, MASTER_ADMIN_SALT_HEX);
}
function resolveAccountRole(usernameOrEmail, candidateRole) {
  if (isMasterAdminIdentifier(usernameOrEmail)) {
    return "The App Creator";
  }
  if (candidateRole === "VIP") {
    return "VIP";
  }
  return "User";
}
function computeLocalPasswordVerifier(username, password) {
  const input = `axiom-aegis-local-auth-v1:${username.trim().toLowerCase()}:${password.trim()}`;
  let h1 = 3735928559 ^ input.length;
  let h2 = 1103547991 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return `av1_${(h1 >>> 0).toString(16).padStart(8, "0")}${(h2 >>> 0).toString(16).padStart(8, "0")}`;
}
const accountsStore = /* @__PURE__ */ new Map();
const deletedAccountsStore = /* @__PURE__ */ new Set([
  "commander_alex",
  "test_user",
  "testuser@example.com",
  "newsyncuser@example.com",
  "sync_commander"
]);
function ensureDataDirectory() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn("Could not create data directory:", err);
  }
}
function persistAccountsDatabase() {
  ensureDataDirectory();
  try {
    const accountsObj = {};
    for (const [key, record] of accountsStore.entries()) {
      const normalizedUser = key.trim().toLowerCase();
      if (!isMasterAdminIdentifier(normalizedUser) && deletedAccountsStore.has(normalizedUser)) {
        continue;
      }
      accountsObj[normalizedUser] = {
        ...record,
        username: normalizedUser,
        role: resolveAccountRole(normalizedUser, record.role)
      };
    }
    const payload = {
      version: 1,
      updatedAt: Date.now(),
      deletedAccounts: Array.from(deletedAccountsStore).filter(
        (u) => u && !isMasterAdminIdentifier(u)
      ),
      accounts: accountsObj
    };
    const tmpFile = `${ACCOUNTS_DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2), "utf8");
    fs.renameSync(tmpFile, ACCOUNTS_DB_FILE);
  } catch (err) {
    console.warn("Could not persist data/accounts-db.json:", err);
  }
}
function normalizeUsername(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().toLowerCase();
}
function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password.trim(), salt, 64).toString("hex");
  return { hashHex: derived, saltHex: salt };
}
function verifyPassword(password, storedHashHex, storedSaltHex) {
  try {
    if (!storedHashHex || !storedSaltHex) return false;
    const { hashHex } = hashPassword(password.trim(), storedSaltHex);
    const a = Buffer.from(hashHex, "hex");
    const b = Buffer.from(storedHashHex, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
function createSessionToken(username, passwordHash, passwordVerifier) {
  const randomPart = crypto.randomBytes(16).toString("hex");
  if (passwordVerifier && passwordVerifier.startsWith("av1_")) {
    return `aegis_tok_${passwordVerifier}_${randomPart}`;
  }
  const deterministicDigest = crypto.createHmac("sha256", passwordHash).update(`axiom-aegis-session:${username.trim().toLowerCase()}`).digest("hex").slice(0, 24);
  return `aegis_tok_${deterministicDigest}_${randomPart}`;
}
function ensureMasterAdminSeededInStore() {
  const existing = accountsStore.get(MASTER_ADMIN_EMAIL);
  const expectedVerifier = MASTER_ADMIN_VERIFIER;
  const now = Date.now();
  if (!existing) {
    const token = createSessionToken(
      MASTER_ADMIN_EMAIL,
      MASTER_ADMIN_SCRYPT_HASH_HEX,
      expectedVerifier
    );
    accountsStore.set(MASTER_ADMIN_EMAIL, {
      userId: "usr_master_axiomdk99",
      username: MASTER_ADMIN_EMAIL,
      displayName: MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
      role: "The App Creator",
      passwordHash: MASTER_ADMIN_SCRYPT_HASH_HEX,
      passwordSalt: MASTER_ADMIN_SALT_HEX,
      passwordVerifier: expectedVerifier,
      sessionTokens: [token],
      createdAt: now,
      updatedAt: now,
      workspaceData: null
    });
    return true;
  }
  const roleValid = existing.role === "The App Creator";
  const verifierValid = existing.passwordVerifier === expectedVerifier;
  const hashPresent = Boolean(existing.passwordHash && existing.passwordSalt);
  if (!hashPresent || !roleValid || !verifierValid) {
    const hashHex = verifierValid && existing.passwordHash ? existing.passwordHash : MASTER_ADMIN_SCRYPT_HASH_HEX;
    const saltHex = verifierValid && existing.passwordSalt ? existing.passwordSalt : MASTER_ADMIN_SALT_HEX;
    const token = createSessionToken(MASTER_ADMIN_EMAIL, hashHex, expectedVerifier);
    accountsStore.set(MASTER_ADMIN_EMAIL, {
      ...existing,
      userId: existing.userId || "usr_master_axiomdk99",
      username: MASTER_ADMIN_EMAIL,
      displayName: existing.displayName && existing.displayName !== "User" ? existing.displayName : MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
      role: "The App Creator",
      passwordHash: hashHex,
      passwordSalt: saltHex,
      passwordVerifier: expectedVerifier,
      sessionTokens: Array.isArray(existing.sessionTokens) && existing.sessionTokens.length > 0 ? [...existing.sessionTokens.slice(-9), token] : [token],
      updatedAt: existing.updatedAt || now
    });
    return true;
  }
  return false;
}
function loadAccountsDatabase() {
  ensureDataDirectory();
  try {
    let needsUpgradeSave = false;
    accountsStore.clear();
    if (fs.existsSync(ACCOUNTS_DB_FILE)) {
      const raw = fs.readFileSync(ACCOUNTS_DB_FILE, "utf8");
      if (raw.trim()) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.deletedAccounts)) {
          for (const delItem of parsed.deletedAccounts) {
            if (typeof delItem === "string" && delItem.trim()) {
              const cleanDel = delItem.trim().toLowerCase();
              if (!isMasterAdminIdentifier(cleanDel)) {
                deletedAccountsStore.add(cleanDel);
              }
            }
          }
        }
        if (parsed && parsed.accounts && typeof parsed.accounts === "object") {
          for (const [usernameKey, record] of Object.entries(parsed.accounts)) {
            if (record && typeof record === "object" && typeof record.username === "string") {
              const normalizedUser = (record.username || usernameKey).trim().toLowerCase();
              const normalizedId = (record.userId || "").trim().toLowerCase();
              if (!isMasterAdminIdentifier(normalizedUser) && (deletedAccountsStore.has(normalizedUser) || normalizedId && deletedAccountsStore.has(normalizedId))) {
                needsUpgradeSave = true;
                continue;
              }
              const resolvedRole = resolveAccountRole(normalizedUser, record.role);
              if (record.role !== resolvedRole) {
                needsUpgradeSave = true;
              }
              accountsStore.set(normalizedUser, {
                ...record,
                username: normalizedUser,
                role: resolvedRole,
                sessionTokens: Array.isArray(record.sessionTokens) ? record.sessionTokens : []
              });
            }
          }
        }
      }
    }
    if (ensureMasterAdminSeededInStore()) {
      needsUpgradeSave = true;
    }
    if (needsUpgradeSave) {
      persistAccountsDatabase();
    }
  } catch (err) {
    console.warn("Could not read data/accounts-db.json:", err);
    if (ensureMasterAdminSeededInStore()) {
      persistAccountsDatabase();
    }
  }
}
loadAccountsDatabase();
function isValidTokenForAccount(record, token) {
  if (!token || typeof token !== "string") return false;
  if (record.sessionTokens.includes(token)) return true;
  if (record.passwordVerifier && token.startsWith(`aegis_tok_${record.passwordVerifier}_`)) {
    return true;
  }
  if (isMasterAdminIdentifier(record.username)) {
    if (token.startsWith(`aegis_tok_${MASTER_ADMIN_VERIFIER}_`)) {
      return true;
    }
  }
  if (record.passwordHash) {
    const expectedPrefix = `aegis_tok_${crypto.createHmac("sha256", record.passwordHash).update(`axiom-aegis-session:${record.username}`).digest("hex").slice(0, 24)}_`;
    if (token.startsWith(expectedPrefix)) {
      return true;
    }
  }
  return false;
}
function extractVerifierFromToken(token) {
  if (!token || typeof token !== "string") return null;
  const match = /^aegis_tok_(av1_[0-9a-f]{16})_/i.exec(token.trim());
  return match ? match[1].toLowerCase() : null;
}
function findAuthenticatedAccount(req) {
  loadAccountsDatabase();
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const bodyObj = req.body && typeof req.body === "object" ? req.body : {};
  const token = bearerToken || (typeof bodyObj.token === "string" ? bodyObj.token.trim() : "") || (typeof req.query.token === "string" ? req.query.token.trim() : "");
  const usernameHint = normalizeUsername(
    bodyObj.username || req.query.username || req.headers["x-axiom-username"]
  );
  if (usernameHint) {
    const record = accountsStore.get(usernameHint);
    if (record && token && isValidTokenForAccount(record, token)) {
      record.role = resolveAccountRole(record.username, record.role);
      return record;
    }
    const tokenVerifier = extractVerifierFromToken(token);
    const isMasterAllowed = !isMasterAdminIdentifier(usernameHint) || tokenVerifier === MASTER_ADMIN_VERIFIER;
    if (!record && tokenVerifier && isMasterAllowed && req.method === "POST" && !deletedAccountsStore.has(usernameHint)) {
      const now = Date.now();
      const { hashHex, saltHex } = hashPassword(tokenVerifier);
      const displayName = typeof bodyObj.displayName === "string" && bodyObj.displayName.trim() ? bodyObj.displayName.trim() : usernameHint;
      const healedRecord = {
        userId: `usr_${crypto.randomBytes(8).toString("hex")}`,
        username: usernameHint,
        displayName,
        role: resolveAccountRole(usernameHint, "User"),
        passwordHash: hashHex,
        passwordSalt: saltHex,
        passwordVerifier: tokenVerifier,
        sessionTokens: [token],
        createdAt: now,
        updatedAt: now,
        workspaceData: null
      };
      accountsStore.set(usernameHint, healedRecord);
      persistAccountsDatabase();
      return healedRecord;
    }
  }
  if (token) {
    for (const record of accountsStore.values()) {
      if (isValidTokenForAccount(record, token)) {
        record.role = resolveAccountRole(record.username, record.role);
        return record;
      }
    }
  }
  return null;
}
function requireMasterAdmin(req, res) {
  const caller = findAuthenticatedAccount(req);
  if (!caller || !isMasterAdminIdentifier(caller.username) || resolveAccountRole(caller.username, caller.role) !== "The App Creator") {
    res.status(403).json({
      ok: false,
      error: '403 Forbidden: Master Admin ("The App Creator") authorization required.'
    });
    return null;
  }
  return caller;
}
function mergeWorkspaceServerSide(existingWs, incomingWs) {
  if (!existingWs || typeof existingWs !== "object") return incomingWs;
  const existingTs = Number(existingWs.updatedAt) || 0;
  const incomingTs = Number(incomingWs.updatedAt) || 0;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1e3;
  const tombstones = {};
  for (const src of [existingWs.deletedItemTombstones, incomingWs.deletedItemTombstones]) {
    if (src && typeof src === "object") {
      for (const [id, ts] of Object.entries(src)) {
        if (id && typeof ts === "number" && Number.isFinite(ts) && ts >= cutoff) {
          tombstones[id] = Math.max(tombstones[id] || 0, ts);
        }
      }
    }
  }
  const applyTombstonesOnly = (arr) => {
    if (!Array.isArray(arr)) return arr;
    return arr.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const obj = item;
      if (!obj.id) return false;
      const tombTs = tombstones[obj.id];
      if (!tombTs) return true;
      const itemTs = obj.updatedAt ?? obj.createdAt ?? 0;
      return itemTs > tombTs;
    });
  };
  const collectionKeys = [
    "categories",
    "goals",
    "funds",
    "bills",
    "distances",
    "dailyNotes",
    "chores",
    "lifeStats",
    "gallery",
    "timeline",
    "frequentEvents",
    "shortcuts",
    "siteImprovements",
    "customNavCategories"
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
  const mergeById = (arrPrimary, arrSecondary) => {
    const map = /* @__PURE__ */ new Map();
    if (Array.isArray(arrSecondary)) {
      for (const item of arrSecondary) {
        if (item && typeof item === "object" && item.id) {
          map.set(item.id, item);
        }
      }
    }
    if (Array.isArray(arrPrimary)) {
      for (const item of arrPrimary) {
        if (item && typeof item === "object" && item.id) {
          const obj = item;
          const prev = map.get(obj.id);
          if (!prev) {
            map.set(obj.id, obj);
          } else {
            const itemTs = obj.updatedAt ?? obj.createdAt ?? 0;
            const prevTs = prev.updatedAt ?? prev.createdAt ?? 0;
            if (itemTs >= prevTs) map.set(obj.id, obj);
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
      ...incomingWs.settings && typeof incomingWs.settings === "object" ? incomingWs.settings : {},
      ...existingWs.settings && typeof existingWs.settings === "object" ? existingWs.settings : {}
    },
    updatedAt: Math.max(existingTs, incomingTs, Date.now())
  };
  for (const key of collectionKeys) {
    merged[key] = mergeById(existingWs[key], incomingWs[key]);
  }
  return merged;
}
function computeWorkspaceRecordSummary(workspaceData) {
  if (!workspaceData || typeof workspaceData !== "object") {
    return {
      timelineCount: 0,
      fundsCount: 0,
      goalsCount: 0,
      notesCount: 0,
      choresCount: 0,
      distancesCount: 0,
      lifeStatsCount: 0,
      galleryCount: 0,
      totalRecords: 0
    };
  }
  const timelineCount = Array.isArray(workspaceData.timeline) ? workspaceData.timeline.length : 0;
  const rawFundsCount = Array.isArray(workspaceData.funds) ? workspaceData.funds.length : 0;
  const billsCount = Array.isArray(workspaceData.bills) ? workspaceData.bills.length : 0;
  const fundsCount = rawFundsCount + billsCount;
  const goalsCount = Array.isArray(workspaceData.goals) ? workspaceData.goals.length : 0;
  const notesCount = Array.isArray(workspaceData.dailyNotes) ? workspaceData.dailyNotes.length : 0;
  const choresCount = Array.isArray(workspaceData.chores) ? workspaceData.chores.length : 0;
  const distancesCount = Array.isArray(workspaceData.distances) ? workspaceData.distances.length : 0;
  const lifeStatsCount = Array.isArray(workspaceData.lifeStats) ? workspaceData.lifeStats.length : 0;
  const galleryCount = Array.isArray(workspaceData.gallery) ? workspaceData.gallery.length : 0;
  const frequentCount = Array.isArray(workspaceData.frequentEvents) ? workspaceData.frequentEvents.length : 0;
  return {
    timelineCount,
    fundsCount,
    goalsCount,
    notesCount,
    choresCount,
    distancesCount,
    lifeStatsCount,
    galleryCount,
    totalRecords: timelineCount + fundsCount + goalsCount + notesCount + choresCount + distancesCount + lifeStatsCount + galleryCount + frequentCount
  };
}
function syncDisplayNameIntoWorkspace(workspaceData, displayName, username) {
  if (!workspaceData || typeof workspaceData !== "object") return null;
  const clone = { ...workspaceData };
  const currentSettings = clone.settings && typeof clone.settings === "object" ? { ...clone.settings } : {};
  currentSettings.userName = displayName;
  currentSettings.commanderName = displayName;
  clone.settings = currentSettings;
  clone.profile = {
    ...clone.profile && typeof clone.profile === "object" ? clone.profile : {},
    username,
    displayName,
    name: displayName,
    role: resolveAccountRole(username)
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
    token: activeToken,
    workspaceData: syncDisplayNameIntoWorkspace(
      record.workspaceData,
      record.displayName,
      record.username
    )
  };
}
let inMemoryVaultChannels = {};
try {
  if (fs.existsSync(VAULT_SYNC_FILE)) {
    const raw = fs.readFileSync(VAULT_SYNC_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (parsed.format === "axiom-aegis-cloud-vault-v1" && parsed.payload) {
        inMemoryVaultChannels["default"] = parsed;
      } else if (parsed.channels && typeof parsed.channels === "object") {
        inMemoryVaultChannels = parsed.channels;
      }
    }
  }
} catch {
}
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3e3;
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Accept, Authorization, X-Axiom-Username"
    );
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: "50mb" }));
  app.get("/api/health", (_req, res) => {
    loadAccountsDatabase();
    res.json({
      ok: true,
      status: "ok",
      mode: "account-database-sync",
      version: "v26.11.20",
      accountsCount: accountsStore.size,
      timestamp: Date.now()
    });
  });
  const handleRegister = (req, res) => {
    try {
      loadAccountsDatabase();
      const username = normalizeUsername(req.body?.username);
      const rawDisplayName = typeof req.body?.displayName === "string" && req.body.displayName.trim() ? req.body.displayName.trim() : username;
      const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
      const rawVerifier = typeof req.body?.passwordVerifier === "string" && /^av1_[0-9a-f]{16}$/i.test(req.body.passwordVerifier.trim()) ? req.body.passwordVerifier.trim().toLowerCase() : "";
      const initialWorkspace = req.body?.workspaceData && typeof req.body.workspaceData === "object" ? req.body.workspaceData : null;
      if (!username || username.length < 2) {
        res.status(400).json({
          ok: false,
          error: "Username or Email must be at least 2 characters."
        });
        return;
      }
      if (!rawDisplayName) {
        res.status(400).json({
          ok: false,
          error: "Display Name is required."
        });
        return;
      }
      if ((!password || password.length < 4) && !rawVerifier) {
        res.status(400).json({
          ok: false,
          error: "Password must be at least 4 characters."
        });
        return;
      }
      const existing = accountsStore.get(username);
      const verifier = password ? computeLocalPasswordVerifier(username, password) : rawVerifier;
      if (existing) {
        const isMasterMatch = password ? isMasterAdminCredentials(username, password) : isMasterAdminIdentifier(username) && verifier === MASTER_ADMIN_VERIFIER;
        const passwordMatches = isMasterMatch || password && verifyPassword(password, existing.passwordHash, existing.passwordSalt) || existing.passwordVerifier && existing.passwordVerifier === verifier;
        if (passwordMatches) {
          if (password && isMasterMatch && !verifyPassword(password, existing.passwordHash, existing.passwordSalt)) {
            const repaired = hashPassword(password);
            existing.passwordHash = repaired.hashHex;
            existing.passwordSalt = repaired.saltHex;
          }
          existing.passwordVerifier = verifier;
          existing.role = resolveAccountRole(existing.username, existing.role);
          if (rawDisplayName && rawDisplayName !== existing.username && rawDisplayName !== "User") {
            existing.displayName = rawDisplayName;
          }
          if (initialWorkspace) {
            const incomingTs = Number(initialWorkspace.updatedAt) || 0;
            const existingTs = Number(existing.workspaceData?.updatedAt) || 0;
            if (!existing.workspaceData || incomingTs >= existingTs) {
              existing.workspaceData = syncDisplayNameIntoWorkspace(
                initialWorkspace,
                existing.displayName,
                existing.username
              );
              existing.updatedAt = Math.max(existing.updatedAt || 0, incomingTs, Date.now());
            }
          }
          const token2 = createSessionToken(existing.username, existing.passwordHash, verifier);
          existing.sessionTokens = [...existing.sessionTokens.slice(-9), token2];
          accountsStore.set(existing.username, existing);
          persistAccountsDatabase();
          res.status(200).json({
            ok: true,
            account: sanitizeAccountResponse(existing, token2)
          });
          return;
        }
        res.status(409).json({
          ok: false,
          error: `Account "${username}" already exists. Please switch to Log In.`
        });
        return;
      }
      const now = Date.now();
      const { hashHex, saltHex } = hashPassword(password || verifier);
      const token = createSessionToken(username, hashHex, verifier);
      const userId = isMasterAdminIdentifier(username) ? "usr_master_axiomdk99" : typeof req.body?.userId === "string" && req.body.userId.trim().startsWith("usr_") ? req.body.userId.trim() : `usr_${crypto.randomBytes(8).toString("hex")}`;
      const assignedRole = resolveAccountRole(username, req.body?.role || "User");
      const syncedWorkspace = syncDisplayNameIntoWorkspace(
        initialWorkspace,
        rawDisplayName,
        username
      );
      const createdAtTs = Number(req.body?.createdAt) || now;
      const updatedAtTs = Number(req.body?.updatedAt) || Number(initialWorkspace?.updatedAt) || now;
      if (syncedWorkspace) {
        syncedWorkspace.updatedAt = updatedAtTs;
      }
      const newRecord = {
        userId,
        username,
        displayName: rawDisplayName,
        role: assignedRole,
        passwordHash: hashHex,
        passwordSalt: saltHex,
        passwordVerifier: verifier,
        sessionTokens: [token],
        createdAt: createdAtTs,
        updatedAt: updatedAtTs,
        workspaceData: syncedWorkspace
      };
      deletedAccountsStore.delete(username);
      accountsStore.set(username, newRecord);
      persistAccountsDatabase();
      res.status(201).json({
        ok: true,
        account: sanitizeAccountResponse(newRecord, token)
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Account registration failed.";
      res.status(500).json({ ok: false, error: msg });
    }
  };
  app.post("/api/auth/register", handleRegister);
  app.post("/api/accounts/register", handleRegister);
  app.post("/api/accounts", handleRegister);
  const handleReconcileAccounts = (req, res) => {
    try {
      loadAccountsDatabase();
      const rawAccounts = Array.isArray(req.body?.accounts) ? req.body.accounts : [];
      let reconciledCount = 0;
      const now = Date.now();
      for (const item of rawAccounts) {
        if (!item || typeof item !== "object") continue;
        const username = normalizeUsername(item.username);
        if (!username || username.length < 2) continue;
        if (!isMasterAdminIdentifier(username) && deletedAccountsStore.has(username)) {
          continue;
        }
        const incomingVerifier = typeof item.passwordVerifier === "string" && /^av1_[0-9a-f]{16}$/i.test(item.passwordVerifier.trim()) ? item.passwordVerifier.trim().toLowerCase() : "";
        const incomingToken = typeof item.token === "string" ? item.token.trim() : "";
        const verifier = incomingVerifier || extractVerifierFromToken(incomingToken) || (isMasterAdminIdentifier(username) ? MASTER_ADMIN_VERIFIER : "");
        if (!verifier) continue;
        const rawDisplayName = typeof item.displayName === "string" && item.displayName.trim() ? item.displayName.trim() : username;
        const incomingWorkspace = item.workspaceData && typeof item.workspaceData === "object" ? item.workspaceData : null;
        const incomingUpdatedAt = Number(item.updatedAt) || Number(incomingWorkspace?.updatedAt) || now;
        const incomingCreatedAt = Number(item.createdAt) || incomingUpdatedAt;
        const existing = accountsStore.get(username);
        if (!existing) {
          const { hashHex, saltHex } = hashPassword(verifier);
          const token = incomingToken && incomingToken.startsWith("aegis_tok_") ? incomingToken : createSessionToken(username, hashHex, verifier);
          const userId = isMasterAdminIdentifier(username) ? "usr_master_axiomdk99" : typeof item.userId === "string" && item.userId.trim().startsWith("usr_") ? item.userId.trim() : `usr_${crypto.randomBytes(8).toString("hex")}`;
          const syncedWs = syncDisplayNameIntoWorkspace(
            incomingWorkspace,
            rawDisplayName,
            username
          );
          if (syncedWs) {
            syncedWs.updatedAt = incomingUpdatedAt;
          }
          accountsStore.set(username, {
            userId,
            username,
            displayName: rawDisplayName,
            role: resolveAccountRole(username, item.role),
            passwordHash: hashHex,
            passwordSalt: saltHex,
            passwordVerifier: verifier,
            sessionTokens: [token],
            createdAt: incomingCreatedAt,
            updatedAt: incomingUpdatedAt,
            workspaceData: syncedWs
          });
          reconciledCount++;
        } else {
          const verifierMatches = (!existing.passwordVerifier || existing.passwordVerifier === verifier) && (!isMasterAdminIdentifier(username) || verifier === MASTER_ADMIN_VERIFIER);
          if (verifierMatches) {
            if (!existing.passwordVerifier) {
              existing.passwordVerifier = verifier;
            }
            if (rawDisplayName && rawDisplayName !== username && rawDisplayName !== "User" && (existing.displayName === existing.username || existing.displayName === "User")) {
              existing.displayName = rawDisplayName;
            }
            const existingWsTs = Number(existing.workspaceData?.updatedAt) || 0;
            if (incomingWorkspace && (!existing.workspaceData || incomingUpdatedAt > existingWsTs)) {
              const syncedWs = syncDisplayNameIntoWorkspace(
                incomingWorkspace,
                existing.displayName,
                existing.username
              );
              if (syncedWs) {
                syncedWs.updatedAt = incomingUpdatedAt;
                existing.workspaceData = syncedWs;
              }
              existing.updatedAt = Math.max(existing.updatedAt || 0, incomingUpdatedAt);
            }
            if (incomingToken && incomingToken.startsWith("aegis_tok_") && !existing.sessionTokens.includes(incomingToken)) {
              existing.sessionTokens = [...existing.sessionTokens.slice(-9), incomingToken];
            }
            accountsStore.set(username, existing);
            reconciledCount++;
          }
        }
      }
      if (reconciledCount > 0) {
        persistAccountsDatabase();
      }
      res.json({
        ok: true,
        reconciledCount,
        totalAccounts: accountsStore.size
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ghost account reconciliation failed.";
      res.status(500).json({ ok: false, error: msg });
    }
  };
  app.post("/api/accounts/reconcile", handleReconcileAccounts);
  app.post("/api/admin/accounts/reconcile", handleReconcileAccounts);
  const handleLogin = (req, res) => {
    try {
      loadAccountsDatabase();
      const username = normalizeUsername(req.body?.username);
      const password = typeof req.body?.password === "string" ? req.body.password.trim() : "";
      if (!username || !password) {
        res.status(400).json({
          ok: false,
          error: "Please enter both your Username (or Email) and Password."
        });
        return;
      }
      const verifier = computeLocalPasswordVerifier(username, password);
      const isMasterMatch = isMasterAdminCredentials(username, password);
      let record = accountsStore.get(username);
      if (!record && isMasterMatch) {
        ensureMasterAdminSeededInStore();
        persistAccountsDatabase();
        record = accountsStore.get(MASTER_ADMIN_EMAIL);
      }
      if (!record) {
        res.status(404).json({
          ok: false,
          error: `No account found for "${username}". Check your username or click Create Account.`
        });
        return;
      }
      const isValid = isMasterMatch || verifyPassword(password, record.passwordHash, record.passwordSalt) || record.passwordVerifier && record.passwordVerifier === verifier;
      if (!isValid) {
        res.status(401).json({
          ok: false,
          error: "Incorrect password for this account."
        });
        return;
      }
      if (!verifyPassword(password, record.passwordHash, record.passwordSalt)) {
        const repaired = hashPassword(password);
        record.passwordHash = repaired.hashHex;
        record.passwordSalt = repaired.saltHex;
      }
      record.passwordVerifier = verifier;
      record.role = resolveAccountRole(record.username, record.role);
      const token = createSessionToken(record.username, record.passwordHash, verifier);
      record.sessionTokens = [...record.sessionTokens.slice(-9), token];
      accountsStore.set(record.username, record);
      persistAccountsDatabase();
      res.json({
        ok: true,
        account: sanitizeAccountResponse(record, token)
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed.";
      res.status(500).json({ ok: false, error: msg });
    }
  };
  app.post("/api/auth/login", handleLogin);
  app.post("/api/accounts/login", handleLogin);
  app.get("/api/account/sync", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const record = findAuthenticatedAccount(req);
    if (!record) {
      res.status(401).json({
        ok: false,
        error: "Session expired or unauthorized. Please log in again."
      });
      return;
    }
    const activeToken = record.sessionTokens[record.sessionTokens.length - 1] || "";
    res.json({
      ok: true,
      account: sanitizeAccountResponse(record, activeToken)
    });
  });
  app.post("/api/account/sync", (req, res) => {
    try {
      const record = findAuthenticatedAccount(req);
      if (!record) {
        res.status(401).json({
          ok: false,
          error: "Session expired or unauthorized. Please log in again."
        });
        return;
      }
      const now = Date.now();
      const incomingDisplayName = typeof req.body?.displayName === "string" && req.body.displayName.trim() ? req.body.displayName.trim() : "";
      const incomingWorkspace = req.body?.workspaceData && typeof req.body.workspaceData === "object" ? req.body.workspaceData : null;
      if (incomingDisplayName) {
        record.displayName = incomingDisplayName;
      } else if (incomingWorkspace?.settings && typeof incomingWorkspace.settings === "object") {
        const s = incomingWorkspace.settings;
        const candidateName = typeof s.commanderName === "string" && s.commanderName.trim() || typeof s.userName === "string" && s.userName.trim() || "";
        if (candidateName && candidateName !== "User") {
          record.displayName = candidateName;
        }
      }
      record.role = resolveAccountRole(record.username, record.role);
      if (incomingWorkspace) {
        const mergedWs = mergeWorkspaceServerSide(record.workspaceData, incomingWorkspace);
        const synced = syncDisplayNameIntoWorkspace(
          mergedWs,
          record.displayName,
          record.username
        );
        if (synced) {
          synced.updatedAt = Math.max(Number(synced.updatedAt) || 0, Number(incomingWorkspace.updatedAt) || now);
          record.workspaceData = synced;
        }
      } else if (record.workspaceData) {
        record.workspaceData = syncDisplayNameIntoWorkspace(
          record.workspaceData,
          record.displayName,
          record.username
        );
      }
      record.updatedAt = Number(record.workspaceData?.updatedAt) || now;
      accountsStore.set(record.username, record);
      persistAccountsDatabase();
      const activeToken = record.sessionTokens[record.sessionTokens.length - 1] || "";
      res.json({
        ok: true,
        account: sanitizeAccountResponse(record, activeToken)
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Account sync failed.";
      res.status(500).json({ ok: false, error: msg });
    }
  });
  app.get("/api/admin/accounts", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const admin = requireMasterAdmin(req, res);
    if (!admin) return;
    const accountsList = Array.from(accountsStore.values()).map((record) => {
      const enforcedRole = resolveAccountRole(record.username, record.role);
      const counts = computeWorkspaceRecordSummary(record.workspaceData);
      return {
        userId: record.userId,
        username: record.username,
        displayName: record.displayName,
        role: enforcedRole,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        ...counts
      };
    }).sort((a, b) => {
      if (a.role === "The App Creator") return -1;
      if (b.role === "The App Creator") return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    res.json({
      ok: true,
      totalAccounts: accountsList.length,
      accounts: accountsList
    });
  });
  app.get("/api/admin/accounts/:userId", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const admin = requireMasterAdmin(req, res);
    if (!admin) return;
    const targetParam = decodeURIComponent(req.params.userId || "").trim().toLowerCase();
    let targetRecord = accountsStore.get(targetParam);
    if (!targetRecord) {
      for (const rec of accountsStore.values()) {
        if (rec.userId.toLowerCase() === targetParam || rec.username.toLowerCase() === targetParam) {
          targetRecord = rec;
          break;
        }
      }
    }
    if (!targetRecord) {
      res.status(404).json({ ok: false, error: "Target account not found." });
      return;
    }
    const enforcedRole = resolveAccountRole(targetRecord.username, targetRecord.role);
    const counts = computeWorkspaceRecordSummary(targetRecord.workspaceData);
    res.json({
      ok: true,
      account: {
        userId: targetRecord.userId,
        username: targetRecord.username,
        displayName: targetRecord.displayName,
        role: enforcedRole,
        createdAt: targetRecord.createdAt,
        updatedAt: targetRecord.updatedAt,
        ...counts,
        workspaceData: targetRecord.workspaceData
      }
    });
  });
  app.patch("/api/admin/accounts/:userId/role", (req, res) => {
    const admin = requireMasterAdmin(req, res);
    if (!admin) return;
    const targetParam = decodeURIComponent(req.params.userId || "").trim().toLowerCase();
    const requestedRole = req.body?.role;
    if (requestedRole !== "VIP" && requestedRole !== "User") {
      res.status(400).json({
        ok: false,
        error: 'Invalid role. Allowed target ranks are "VIP" or "User".'
      });
      return;
    }
    let targetRecord = accountsStore.get(targetParam);
    if (!targetRecord) {
      for (const rec of accountsStore.values()) {
        if (rec.userId.toLowerCase() === targetParam || rec.username.toLowerCase() === targetParam) {
          targetRecord = rec;
          break;
        }
      }
    }
    if (!targetRecord) {
      res.status(404).json({ ok: false, error: "Target account not found in database." });
      return;
    }
    if (isMasterAdminIdentifier(targetRecord.username)) {
      res.status(400).json({
        ok: false,
        error: 'Axiomdk99@gmail.com is permanently designated as "The App Creator".'
      });
      return;
    }
    targetRecord.role = requestedRole;
    targetRecord.updatedAt = Date.now();
    accountsStore.set(targetRecord.username, targetRecord);
    persistAccountsDatabase();
    const counts = computeWorkspaceRecordSummary(targetRecord.workspaceData);
    res.json({
      ok: true,
      account: {
        userId: targetRecord.userId,
        username: targetRecord.username,
        displayName: targetRecord.displayName,
        role: targetRecord.role,
        createdAt: targetRecord.createdAt,
        updatedAt: targetRecord.updatedAt,
        ...counts
      }
    });
  });
  app.delete("/api/admin/accounts/:userId", (req, res) => {
    const admin = requireMasterAdmin(req, res);
    if (!admin) return;
    const targetParam = decodeURIComponent(req.params.userId || "").trim().toLowerCase();
    if (!targetParam) {
      res.status(400).json({ ok: false, error: "Target account identifier required." });
      return;
    }
    if (isMasterAdminIdentifier(targetParam)) {
      res.status(400).json({
        ok: false,
        error: 'Cannot delete the Master Admin ("The App Creator") account.'
      });
      return;
    }
    let targetRecord = accountsStore.get(targetParam);
    if (!targetRecord) {
      for (const rec of accountsStore.values()) {
        if (rec.userId.toLowerCase() === targetParam || rec.username.toLowerCase() === targetParam) {
          targetRecord = rec;
          break;
        }
      }
    }
    if (targetRecord && isMasterAdminIdentifier(targetRecord.username)) {
      res.status(400).json({
        ok: false,
        error: 'Cannot delete the Master Admin ("The App Creator") account.'
      });
      return;
    }
    deletedAccountsStore.add(targetParam);
    if (targetRecord) {
      deletedAccountsStore.add(targetRecord.username.toLowerCase());
      if (targetRecord.userId) {
        deletedAccountsStore.add(targetRecord.userId.toLowerCase());
      }
      accountsStore.delete(targetRecord.username);
    }
    persistAccountsDatabase();
    res.json({
      ok: true,
      deletedUsername: targetRecord?.username || targetParam,
      deletedUserId: targetRecord?.userId || targetParam
    });
  });
  app.post("/api/admin/database/export", (req, res) => {
    const admin = requireMasterAdmin(req, res);
    if (!admin) return;
    const sanitizedAccounts = {};
    for (const [key, rec] of accountsStore.entries()) {
      sanitizedAccounts[key] = {
        userId: rec.userId,
        username: rec.username,
        displayName: rec.displayName,
        role: resolveAccountRole(rec.username, rec.role),
        createdAt: rec.createdAt,
        updatedAt: rec.updatedAt,
        ...computeWorkspaceRecordSummary(rec.workspaceData),
        workspaceData: rec.workspaceData
      };
    }
    res.json({
      ok: true,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      exportedBy: admin.username,
      totalAccounts: accountsStore.size,
      accounts: sanitizedAccounts
    });
  });
  app.get("/api/vault-sync", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const rawChannel = typeof req.query.channel === "string" ? req.query.channel.trim() : "";
    const channelKey = rawChannel ? rawChannel.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) : "default";
    const envelope = inMemoryVaultChannels[channelKey] || null;
    if (!envelope) {
      res.json({ hasVault: false, channel: channelKey, envelope: null });
      return;
    }
    res.json({ hasVault: true, channel: channelKey, envelope });
  });
  app.post("/api/vault-sync", (req, res) => {
    try {
      const candidate = req.body?.envelope || req.body;
      const rawChannel = (typeof req.query.channel === "string" ? req.query.channel.trim() : "") || (typeof req.body?.channel === "string" ? req.body.channel.trim() : "");
      const channelKey = rawChannel ? rawChannel.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) : "default";
      if (!candidate || candidate.format !== "axiom-aegis-cloud-vault-v1" || !candidate.payload || typeof candidate.payload.ciphertext !== "string") {
        res.status(400).json({ error: "Invalid vault envelope." });
        return;
      }
      inMemoryVaultChannels[channelKey] = candidate;
      res.json({ ok: true, channel: channelKey, updatedAt: candidate.updatedAt, envelope: candidate });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to store vault envelope";
      res.status(500).json({ error: msg });
    }
  });
  app.get("/api/standalone-html", (_req, res) => {
    const publicBundle = path.join(__dirname, "public", "Axiom-Aegis.html");
    const distBundle = path.join(__dirname, "dist", "Axiom-Aegis.html");
    let targetPath = "";
    if (fs.existsSync(distBundle) && fs.existsSync(publicBundle)) {
      const distMtime = fs.statSync(distBundle).mtimeMs;
      const pubMtime = fs.statSync(publicBundle).mtimeMs;
      targetPath = distMtime >= pubMtime ? distBundle : publicBundle;
    } else if (fs.existsSync(distBundle)) {
      targetPath = distBundle;
    } else if (fs.existsSync(publicBundle)) {
      targetPath = publicBundle;
    }
    if (targetPath) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="index.html"');
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(targetPath);
    } else {
      res.status(404).send("Standalone HTML bundle not found.");
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".html") || filePath.endsWith("sw.js")) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          }
        }
      })
    );
    app.get("*all", (_req, res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
export {
  MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_VERIFIER,
  computeLocalPasswordVerifier,
  isMasterAdminCredentials,
  isMasterAdminIdentifier,
  resolveAccountRole
};
