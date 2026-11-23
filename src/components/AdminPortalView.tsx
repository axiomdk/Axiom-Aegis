import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import { AccountRole, CustomCategoryVisibility, CustomNavCategory, TabType } from '../types';
import {
  AdminAccountDirectoryRow,
  fetchAdminAccountsList,
  fetchAdminAccountDetail,
  updateAdminAccountRole,
  deleteAdminAccount,
  exportAdminDatabaseBackup,
} from '../utils/cloudSyncEngine';
import {
  getAllRegisteredAccountEntries,
  updateLocalRegisteredAccountRole,
  deleteLocalRegisteredAccount,
  saveLocalAccountCacheEntry,
  ensureMasterAdminAccountSeeded,
  MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
  isMasterAdminIdentifier,
  resolveAccountRole,
  isAccountTombstoned,
} from '../utils/storage';
import { RoleBadge } from './RoleBadge';
import { formatLastUpdated, formatExactTime } from '../utils/version';
import {
  DEFAULT_SIDEBAR_GROUP_LABELS,
  DEFAULT_SIDEBAR_GROUP_ORDER,
  sanitizeSidebarGroupItems,
} from '../utils/sidebarEngine';
import {
  Crown,
  ShieldCheck,
  Users,
  Sparkles,
  UserCheck,
  Search,
  RefreshCw,
  Download,
  Eye,
  Trash2,
  X,
  Calendar,
  Wallet,
  Target,
  BookOpen,
  Compass,
  Activity,
  Image as ImageIcon,
  Clock,
  Database,
  ArrowUpRight,
  ArrowDownRight,
  Wrench,
  Layers,
  Lock,
  Globe,
  Plus,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from 'lucide-react';

function computeLocalEntryCounts(workspaceData: Record<string, unknown> | null) {
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

export const AdminPortalView: React.FC = () => {
  const {
    accountSession,
    isMasterAdmin,
    appData,
    updateAppData,
    layoutConfig,
    updateLayoutConfig,
    setActiveTab,
    showNotification,
  } = useVault();

  const [accounts, setAccounts] = useState<AdminAccountDirectoryRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | AccountRole>('ALL');
  const [inspectedAccount, setInspectedAccount] = useState<AdminAccountDirectoryRow | null>(null);
  const [isInspectLoading, setIsInspectLoading] = useState<boolean>(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<string | null>(null);
  const [busyUser, setBusyUser] = useState<string | null>(null);

  // Dynamic Custom Category Manager State
  const [newCatName, setNewCatName] = useState<string>('');
  const [newCatVisibility, setNewCatVisibility] =
    useState<CustomCategoryVisibility>('admin_only');
  const [newCatGroup, setNewCatGroup] = useState<string>('vault_sys');

  const customCategories = useMemo(
    () => appData?.customNavCategories || [],
    [appData?.customNavCategories]
  );

  const handleCreateCustomCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newCatName.trim().slice(0, 48);
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
      visibility: newCatVisibility,
      parentGroupId: newCatGroup,
      order: customCategories.length,
      notes: '',
      checklist: [
        { id: `chk-${now}-1`, text: `Initialize ${cleanName} objectives`, completed: false },
      ],
      statusCards: [
        { id: `card-${now}-1`, title: 'Status', value: 'Operational', status: 'Nominal' },
        {
          id: `card-${now}-2`,
          title: 'Visibility',
          value: newCatVisibility === 'admin_only' ? 'Admin Only' : 'All Users',
          status: 'Active',
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const nextCats = [...customCategories, created];
    const currentGroupItems = sanitizeSidebarGroupItems(
      appData?.settings?.sidebarGroupItems || layoutConfig?.sidebarGroupItems,
      nextCats
    );
    const sidebarItemId = `nav-custom-${id}`;
    const targetList = currentGroupItems[newCatGroup] || [];
    const nextGroupItems = {
      ...currentGroupItems,
      [newCatGroup]: targetList.includes(sidebarItemId)
        ? targetList
        : [...targetList, sidebarItemId],
    };
    const nextItemLabels = {
      ...(appData?.settings?.sidebarItemLabels || layoutConfig?.sidebarItemLabels || {}),
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

    setNewCatName('');
    showNotification(
      `Created ${
        newCatVisibility === 'admin_only' ? 'Admin-Only' : 'All-Users'
      } category "${cleanName}"!`,
      'success'
    );
  };

  const handleUpdateCustomCategory = async (
    catId: string,
    updater: (cat: CustomNavCategory) => CustomNavCategory
  ) => {
    const nextCats = customCategories.map((c) =>
      c.id === catId ? { ...updater(c), updatedAt: Date.now() } : c
    );
    const updatedTarget = nextCats.find((c) => c.id === catId);
    const sidebarItemId = `nav-custom-${catId}`;
    const nextItemLabels = {
      ...(appData?.settings?.sidebarItemLabels || layoutConfig?.sidebarItemLabels || {}),
      ...(updatedTarget ? { [sidebarItemId]: updatedTarget.name } : {}),
    };
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarItemLabels: nextItemLabels,
    }));
    await updateAppData((prev) => ({
      ...prev,
      customNavCategories: nextCats,
      settings: {
        ...prev.settings,
        sidebarItemLabels: nextItemLabels,
      },
    }));
  };

  const handleMoveCustomCategoryOrder = async (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= customCategories.length) return;
    const nextCats = [...customCategories];
    const [moved] = nextCats.splice(index, 1);
    nextCats.splice(targetIdx, 0, moved);
    await updateAppData((prev) => ({
      ...prev,
      customNavCategories: nextCats,
    }));
  };

  const handleDeleteCustomCategory = async (cat: CustomNavCategory) => {
    const nextCats = customCategories.filter((c) => c.id !== cat.id);
    const sidebarItemId = `nav-custom-${cat.id}`;
    const currentGroupItems = sanitizeSidebarGroupItems(
      appData?.settings?.sidebarGroupItems || layoutConfig?.sidebarGroupItems,
      nextCats
    );
    const cleanedGroupItems: Record<string, string[]> = {};
    for (const [gId, list] of Object.entries(currentGroupItems)) {
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
    showNotification(`Deleted custom category "${cat.name}".`, 'info');
  };

  const loadDirectory = useCallback(
    async (manualRefresh: boolean = false) => {
      if (!accountSession || !isMasterAdmin) return;
      setIsLoading(true);
      try {
        // Ensure Master Admin entry and current active session workspace are synced into local registry first
        if (appData) {
          ensureMasterAdminAccountSeeded(appData);
          saveLocalAccountCacheEntry({
            userId: accountSession.userId,
            username: accountSession.username,
            displayName:
              appData.settings?.commanderName ||
              appData.settings?.userName ||
              accountSession.displayName ||
              MASTER_ADMIN_DEFAULT_DISPLAY_NAME,
            role: resolveAccountRole(accountSession.username, accountSession.role),
            token: accountSession.token,
            updatedAt: appData.updatedAt || Date.now(),
            workspaceData: appData,
          });
        }

        const mergedMap = new Map<string, AdminAccountDirectoryRow>();

        // 1. Load local persistent account registry (axiom_accounts_registry_v1)
        const localEntries = Object.values(getAllRegisteredAccountEntries());
        for (const local of localEntries) {
          const key = local.username.trim().toLowerCase();
          if (!isMasterAdminIdentifier(key) && isAccountTombstoned(key)) {
            continue;
          }
          const liveWorkspace =
            key === accountSession.username.trim().toLowerCase() && appData
              ? (appData as unknown as Record<string, unknown>)
              : (local.workspaceData as unknown as Record<string, unknown>);
          const counts = computeLocalEntryCounts(liveWorkspace);
          mergedMap.set(key, {
            userId: local.userId,
            username: key,
            displayName: local.displayName,
            role: resolveAccountRole(key, local.role),
            createdAt: local.createdAt || local.updatedAt,
            updatedAt: local.updatedAt,
            ...counts,
            workspaceData: (liveWorkspace || local.workspaceData) as any,
            source: 'local',
          });
        }

        // 2. Fetch backend database directory (/api/admin/accounts)
        const remoteRes = await fetchAdminAccountsList(
          {
            username: accountSession.username,
            token: accountSession.token,
          },
          { forceNetwork: manualRefresh }
        );

        if (remoteRes.ok && Array.isArray(remoteRes.accounts)) {
          for (const remote of remoteRes.accounts) {
            const key = remote.username.trim().toLowerCase();
            if (
              !isMasterAdminIdentifier(key) &&
              (isAccountTombstoned(key) || isAccountTombstoned(remote.userId))
            ) {
              continue;
            }
            const existingLocal = mergedMap.get(key);
            const resolvedRole = resolveAccountRole(
              key,
              remote.role || existingLocal?.role
            );
            const isActiveAdminRow =
              key === accountSession.username.trim().toLowerCase() && Boolean(appData);
            const liveCounts = isActiveAdminRow
              ? computeLocalEntryCounts(appData as unknown as Record<string, unknown>)
              : null;

            mergedMap.set(key, {
              ...existingLocal,
              ...remote,
              ...(liveCounts
                ? {
                    ...liveCounts,
                    updatedAt: Math.max(remote.updatedAt || 0, appData?.updatedAt || 0),
                  }
                : {}),
              username: key,
              role: resolvedRole,
              source: 'database',
            });
            // Keep local registry role in sync with backend database
            if (
              existingLocal &&
              existingLocal.role !== resolvedRole &&
              resolvedRole !== 'The App Creator'
            ) {
              updateLocalRegisteredAccountRole(key, resolvedRole);
            }
          }
        }

        const sorted = Array.from(mergedMap.values()).sort((a, b) => {
          if (a.role === 'The App Creator') return -1;
          if (b.role === 'The App Creator') return 1;
          if (a.role === 'VIP' && b.role !== 'VIP') return -1;
          if (b.role === 'VIP' && a.role !== 'VIP') return 1;
          return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

        setAccounts(sorted);
        const nowTs = Date.now();
        setLastRefreshedAt(nowTs);
        if (manualRefresh) {
          showNotification(
            `Registry refreshed: ${sorted.length} account${
              sorted.length === 1 ? '' : 's'
            } synchronized (${formatExactTime(nowTs)}).`,
            'success'
          );
        }
      } finally {
        setIsLoading(false);
      }
    },
    [accountSession, isMasterAdmin, appData, showNotification]
  );

  useEffect(() => {
    void loadDirectory(false);
  }, [loadDirectory]);

  const handleToggleRole = async (row: AdminAccountDirectoryRow) => {
    if (!accountSession || !isMasterAdmin) return;
    if (isMasterAdminIdentifier(row.username)) {
      showNotification(
        'Axiomdk99@gmail.com is permanently designated as "The App Creator".',
        'info'
      );
      return;
    }

    const targetRole: 'VIP' | 'User' = row.role === 'VIP' ? 'User' : 'VIP';
    setBusyUser(row.username);
    try {
      // Update in local registry immediately
      updateLocalRegisteredAccountRole(row.username, targetRole);

      // Update in backend database
      const apiRes = await updateAdminAccountRole(
        { username: accountSession.username, token: accountSession.token },
        row.username,
        targetRole
      );

      setAccounts((prev) =>
        prev.map((acct) =>
          acct.username === row.username
            ? {
                ...acct,
                role: apiRes.ok && apiRes.account ? apiRes.account.role : targetRole,
                updatedAt: Date.now(),
              }
            : acct
        )
      );

      if (inspectedAccount?.username === row.username) {
        setInspectedAccount((curr) =>
          curr ? { ...curr, role: targetRole, updatedAt: Date.now() } : null
        );
      }

      showNotification(
        targetRole === 'VIP'
          ? `Promoted @${row.username} (${row.displayName}) to VIP rank!`
          : `Updated @${row.username} (${row.displayName}) to User rank.`,
        'success'
      );
    } finally {
      setBusyUser(null);
    }
  };

  const handleInspectAccount = async (row: AdminAccountDirectoryRow) => {
    if (!accountSession || !isMasterAdmin) return;
    setInspectedAccount(row);
    setIsInspectLoading(true);
    try {
      const detailRes = await fetchAdminAccountDetail(
        { username: accountSession.username, token: accountSession.token },
        row.username
      );
      if (detailRes.ok && detailRes.account) {
        setInspectedAccount(detailRes.account);
      }
    } finally {
      setIsInspectLoading(false);
    }
  };

  const handleDeleteAccount = async (row: AdminAccountDirectoryRow) => {
    if (!accountSession || !isMasterAdmin) return;
    if (isMasterAdminIdentifier(row.username)) return;

    setBusyUser(row.username);
    try {
      deleteLocalRegisteredAccount(row.username);
      await deleteAdminAccount(
        { username: accountSession.username, token: accountSession.token },
        row.username
      );

      setAccounts((prev) => prev.filter((a) => a.username !== row.username));
      setConfirmDeleteUser(null);
      if (inspectedAccount?.username === row.username) {
        setInspectedAccount(null);
      }
      showNotification(`Deleted account @${row.username} from database.`, 'info');
    } finally {
      setBusyUser(null);
    }
  };

  const handleExportFullDatabase = async () => {
    if (!accountSession || !isMasterAdmin) return;
    const res = await exportAdminDatabaseBackup({
      username: accountSession.username,
      token: accountSession.token,
    });

    const exportPayload = res.ok && res.payload
      ? res.payload
      : {
          ok: true,
          exportedAt: new Date().toISOString(),
          exportedBy: accountSession.username,
          totalAccounts: accounts.length,
          accounts,
        };

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Axiom-Aegis-Master-Accounts-DB-${dateStr}.json`;

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification(`Exported Master Accounts Database (${filename})!`, 'success');
  };

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return accounts.filter((a) => {
      if (roleFilter !== 'ALL' && a.role !== roleFilter) return false;
      if (!q) return true;
      return (
        a.username.toLowerCase().includes(q) ||
        a.displayName.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.userId.toLowerCase().includes(q)
      );
    });
  }, [accounts, searchQuery, roleFilter]);

  const stats = useMemo(() => {
    const total = accounts.length;
    const creators = accounts.filter((a) => a.role === 'The App Creator').length;
    const vips = accounts.filter((a) => a.role === 'VIP').length;
    const standardUsers = accounts.filter((a) => a.role === 'User').length;
    const latestActivity = accounts.reduce((max, a) => Math.max(max, a.updatedAt || 0), 0);
    return { total, creators, vips, standardUsers, latestActivity };
  }, [accounts]);

  // STRICT SECURITY GUARD: Zero rendering if session is not verified as Axiomdk99@gmail.com ("The App Creator")
  if (
    !isMasterAdmin ||
    !accountSession ||
    !isMasterAdminIdentifier(accountSession.username) ||
    resolveAccountRole(accountSession.username, accountSession.role) !== 'The App Creator'
  ) {
    return null;
  }

  return (
    <div data-testid="master-admin-portal-view" className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#000000] border border-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.12)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Master Admin Database Overseer
                </h1>
                <RoleBadge role="The App Creator" size="sm" testId="admin-header-creator-badge" />
              </div>
              <p className="text-xs font-mono text-zinc-400">
                Exclusive Command Authority: <span className="text-cyan-400 font-semibold">{accountSession.username}</span> • Full Account Registry &amp; Forum Rank Control
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            data-testid="admin-open-site-improvements-btn"
            onClick={() => setActiveTab('site_improvements')}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Wrench className="w-3.5 h-3.5 text-amber-400" />
            <span>Open Site Improvements</span>
          </button>

          <button
            type="button"
            data-testid="admin-refresh-accounts-btn"
            onClick={() => void loadDirectory(true)}
            disabled={isLoading}
            title={`Last synced at ${formatExactTime(lastRefreshedAt)}`}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#08090C] hover:bg-[#141720] border border-[#232732] hover:border-cyan-500/40 text-zinc-200 flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Refreshing...' : 'Refresh Registry'}</span>
            <span
              data-testid="admin-registry-last-refreshed"
              className="text-[10px] font-mono text-zinc-400 pl-1 border-l border-[#232732]"
            >
              {formatLastUpdated(lastRefreshedAt)}
            </span>
          </button>

          <button
            type="button"
            data-testid="admin-export-database-btn"
            onClick={() => void handleExportFullDatabase()}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Full Accounts Database (.json)</span>
          </button>
        </div>
      </div>

      {/* Admin-Only & Custom Navigation Categories Manager */}
      <div
        data-testid="admin-custom-categories-manager"
        className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E222B]">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              <span>Admin-Only &amp; Custom Navigation Categories Manager</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Create, rename, reorder, or delete custom sidebar categories (e.g., &ldquo;System Logs&rdquo;, &ldquo;Testing Sandbox&rdquo;, &ldquo;Admin Notes&rdquo;) and toggle visibility between <strong className="text-amber-300">Admin Only</strong> and <strong className="text-cyan-300">All Users</strong>.
            </p>
          </div>
          <span className="text-[11px] font-mono text-amber-300 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 shrink-0">
            {customCategories.length} Custom {customCategories.length === 1 ? 'Category' : 'Categories'}
          </span>
        </div>

        <form
          onSubmit={handleCreateCustomCategory}
          data-testid="admin-create-category-form"
          className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
        >
          <div className="sm:col-span-5 space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Category Name
            </label>
            <input
              type="text"
              maxLength={48}
              data-testid="admin-new-category-name-input"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g., System Logs, Testing Sandbox, Admin Notes..."
              className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="sm:col-span-3 space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Parent Section
            </label>
            <select
              data-testid="admin-new-category-group-select"
              value={newCatGroup}
              onChange={(e) => setNewCatGroup(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs font-mono text-white focus:outline-none focus:border-amber-400"
            >
              {DEFAULT_SIDEBAR_GROUP_ORDER.map((gId) => (
                <option key={gId} value={gId}>
                  {DEFAULT_SIDEBAR_GROUP_LABELS[gId] || gId}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400">
              Visibility Access
            </label>
            <select
              data-testid="admin-new-category-visibility-select"
              value={newCatVisibility}
              onChange={(e) =>
                setNewCatVisibility(e.target.value as CustomCategoryVisibility)
              }
              className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
            >
              <option value="admin_only">Admin Only (Creator)</option>
              <option value="all_users">All Users</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              data-testid="admin-create-category-submit-btn"
              className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Category</span>
            </button>
          </div>
        </form>

        {customCategories.length > 0 && (
          <div className="space-y-2 pt-2">
            {customCategories.map((cat, idx) => (
              <div
                key={cat.id}
                data-testid={`admin-custom-category-row-${cat.id}`}
                className="p-3 rounded-xl bg-[#06070A] border border-[#1E222B] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    maxLength={48}
                    data-testid={`admin-rename-category-input-${cat.id}`}
                    value={cat.name}
                    onChange={(e) =>
                      void handleUpdateCustomCategory(cat.id, (prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-[#000000] border border-[#232732] focus:border-amber-400 text-xs font-bold text-white focus:outline-none min-w-[180px]"
                  />
                  <span className="text-[10px] font-mono text-zinc-500 truncate">
                    ID: {cat.id}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    data-testid={`admin-toggle-category-visibility-${cat.id}`}
                    onClick={() =>
                      void handleUpdateCustomCategory(cat.id, (prev) => ({
                        ...prev,
                        visibility:
                          prev.visibility === 'admin_only' ? 'all_users' : 'admin_only',
                      }))
                    }
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                      cat.visibility === 'admin_only'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                        : 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                    }`}
                  >
                    {cat.visibility === 'admin_only' ? (
                      <>
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>Admin Only</span>
                      </>
                    ) : (
                      <>
                        <Globe className="w-3 h-3 text-cyan-400" />
                        <span>All Users</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => void handleMoveCustomCategoryOrder(idx, 'up')}
                    className="p-1.5 rounded-lg bg-[#0C0E14] border border-[#232732] text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Move Up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === customCategories.length - 1}
                    onClick={() => void handleMoveCustomCategoryOrder(idx, 'down')}
                    className="p-1.5 rounded-lg bg-[#0C0E14] border border-[#232732] text-zinc-400 hover:text-white disabled:opacity-30 cursor-pointer"
                    title="Move Down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    data-testid={`admin-open-custom-category-${cat.id}`}
                    onClick={() => setActiveTab(cat.id as TabType)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#0C0E14] hover:bg-[#161922] text-cyan-300 border border-[#232732] flex items-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Open</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`admin-delete-custom-category-${cat.id}`}
                    onClick={() => void handleDeleteCustomCategory(cat)}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                    title={`Delete ${cat.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Database Overview KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          data-testid="admin-kpi-total-accounts"
          className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] flex items-center justify-between"
        >
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              Total Registered
            </span>
            <span className="text-2xl font-extrabold text-white font-mono tabular-nums mt-0.5 block">
              {stats.total}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Users className="w-5 h-5 text-cyan-400" />
          </div>
        </div>

        <div
          data-testid="admin-kpi-vip-accounts"
          className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] flex items-center justify-between"
        >
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              VIP Rank Members
            </span>
            <span className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums mt-0.5 block">
              {stats.vips}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-300" />
          </div>
        </div>

        <div
          data-testid="admin-kpi-user-accounts"
          className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] flex items-center justify-between"
        >
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              Standard Users
            </span>
            <span className="text-2xl font-extrabold text-zinc-200 font-mono tabular-nums mt-0.5 block">
              {stats.standardUsers}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#111319] border border-[#232732] flex items-center justify-center">
            <UserCheck className="w-5 h-5 text-zinc-400" />
          </div>
        </div>

        <div
          data-testid="admin-kpi-last-activity"
          className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] flex items-center justify-between"
        >
          <div className="min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              Latest Database Sync
            </span>
            <span className="text-sm font-bold text-amber-300 font-mono truncate mt-1 block">
              {stats.latestActivity ? formatLastUpdated(stats.latestActivity) : 'Active'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-amber-400" />
          </div>
        </div>
      </div>

      {/* Search & Rank Filter Bar */}
      <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            data-testid="admin-accounts-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search accounts by email, username, display name, or rank..."
            className="w-full pl-10 pr-8 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(['ALL', 'The App Creator', 'VIP', 'User'] as const).map((r) => (
            <button
              key={r}
              type="button"
              data-testid={`admin-filter-role-${r.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                roleFilter === r
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/50'
                  : 'bg-[#08090C] text-zinc-400 border-[#232732] hover:text-zinc-200'
              }`}
            >
              {r === 'ALL' ? `All (${accounts.length})` : r}
            </button>
          ))}
        </div>
      </div>

      {/* All Accounts Directory Table */}
      <div className="rounded-2xl bg-[#000000] border border-[#1E222B] overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-[#1E222B] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">
              Registered Accounts Directory ({filteredAccounts.length})
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            data/accounts-db.json + Local Registry
          </span>
        </div>

        <div className="overflow-x-auto">
          <table
            data-testid="admin-accounts-table"
            className="w-full text-left border-collapse"
          >
            <thead>
              <tr className="border-b border-[#1E222B] bg-[#06070A] text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                <th className="py-3 px-4">Account &amp; Display Name</th>
                <th className="py-3 px-4">Forum Rank / Role</th>
                <th className="py-3 px-4">Workspace Telemetry</th>
                <th className="py-3 px-4">Created / Last Synced</th>
                <th className="py-3 px-4 text-right">Rank &amp; Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E222B] text-xs">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500 font-mono">
                    No registered accounts match your filter.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((row) => {
                  const isCreator = isMasterAdminIdentifier(row.username);
                  const isBusy = busyUser === row.username;

                  return (
                    <tr
                      key={row.username}
                      data-testid={`admin-account-row-${row.username}`}
                      className="hover:bg-[#090B10] transition-colors"
                    >
                      {/* Account Identity */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {row.displayName}
                            </span>
                            {isCreator && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-emerald-400">
                            {row.username}
                          </span>
                          <span className="font-mono text-[10px] text-zinc-500">
                            ID: {row.userId}
                          </span>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <RoleBadge
                          role={row.role}
                          size="sm"
                          testId={`admin-row-role-badge-${row.username}`}
                        />
                      </td>

                      {/* Workspace Record Counts */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-[#0C0E14] border border-[#1E222B] text-cyan-300">
                            {row.timelineCount || 0} Events
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#0C0E14] border border-[#1E222B] text-lime-300">
                            {row.fundsCount || 0} Funds
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#0C0E14] border border-[#1E222B] text-amber-300">
                            {row.goalsCount || 0} Goals
                          </span>
                          <span className="px-2 py-0.5 rounded bg-[#0C0E14] border border-[#1E222B] text-purple-300">
                            {row.notesCount || 0} Notes
                          </span>
                        </div>
                      </td>

                      {/* Timestamps */}
                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-400">
                        <div>
                          Updated:{' '}
                          <span className="text-zinc-200">
                            {row.updatedAt ? formatLastUpdated(row.updatedAt) : 'N/A'}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          Created:{' '}
                          {row.createdAt
                            ? new Date(row.createdAt).toLocaleDateString()
                            : 'N/A'}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2 flex-nowrap">
                          {/* 1-Click Role / Rank Toggle */}
                          {!isCreator && (
                            <button
                              type="button"
                              disabled={isBusy}
                              data-testid={`admin-toggle-role-btn-${row.username}`}
                              onClick={() => void handleToggleRole(row)}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                                row.role === 'VIP'
                                  ? 'bg-[#111319] hover:bg-[#191C26] text-zinc-300 border-[#2A2F3D]'
                                  : 'bg-purple-500/15 hover:bg-purple-500/25 text-emerald-300 border-purple-400/50'
                              }`}
                            >
                              {row.role === 'VIP' ? (
                                <>
                                  <ArrowDownRight className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Set User</span>
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="w-3.5 h-3.5 text-purple-300" />
                                  <span>Promote to VIP</span>
                                </>
                              )}
                            </button>
                          )}

                          {/* Inspect Workspace */}
                          <button
                            type="button"
                            data-testid={`admin-inspect-btn-${row.username}`}
                            onClick={() => void handleInspectAccount(row)}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#0C0E14] hover:bg-[#161922] text-cyan-300 border border-[#232732] flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Inspect</span>
                          </button>

                          {/* Delete Account */}
                          {!isCreator && (
                            <>
                              {confirmDeleteUser === row.username ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    data-testid={`admin-confirm-delete-btn-${row.username}`}
                                    disabled={isBusy}
                                    onClick={() => void handleDeleteAccount(row)}
                                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteUser(null)}
                                    className="px-2 py-1.5 rounded-lg text-[11px] bg-[#141720] text-zinc-300 border border-[#232732] cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  data-testid={`admin-delete-btn-${row.username}`}
                                  onClick={() => setConfirmDeleteUser(row.username)}
                                  title={`Delete @${row.username}`}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Workspace Inspector Modal */}
      {inspectedAccount && (
        <div
          data-testid="admin-account-inspector-modal"
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget) {
              setInspectedAccount(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-[#000000] border border-[#232732] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-[#1E222B] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Eye className="w-4 h-4 text-cyan-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Account Inspector: {inspectedAccount.displayName}
                    </h3>
                    <RoleBadge role={inspectedAccount.role} size="xs" />
                  </div>
                  <p className="text-[11px] font-mono text-emerald-400">
                    {inspectedAccount.username} • {inspectedAccount.userId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="admin-inspector-close-btn"
                onClick={() => setInspectedAccount(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#141720] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {isInspectLoading && (
                <div className="text-center py-4 font-mono text-cyan-400">
                  Loading latest account workspace snapshot...
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B]">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-mono text-[10px] uppercase">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Timeline</span>
                  </div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {inspectedAccount.timelineCount || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B]">
                  <div className="flex items-center gap-1.5 text-lime-400 font-mono text-[10px] uppercase">
                    <Wallet className="w-3.5 h-3.5" />
                    <span>Funds</span>
                  </div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {inspectedAccount.fundsCount || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B]">
                  <div className="flex items-center gap-1.5 text-amber-400 font-mono text-[10px] uppercase">
                    <Target className="w-3.5 h-3.5" />
                    <span>Goals</span>
                  </div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {inspectedAccount.goalsCount || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B]">
                  <div className="flex items-center gap-1.5 text-purple-400 font-mono text-[10px] uppercase">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Daily Notes</span>
                  </div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {inspectedAccount.notesCount || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B]">
                  <div className="flex items-center gap-1.5 text-sky-400 font-mono text-[10px] uppercase">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Distances</span>
                  </div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {inspectedAccount.distancesCount || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B]">
                  <div className="flex items-center gap-1.5 text-rose-400 font-mono text-[10px] uppercase">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Life Stats</span>
                  </div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {inspectedAccount.lifeStatsCount || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B]">
                  <div className="flex items-center gap-1.5 text-pink-400 font-mono text-[10px] uppercase">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Gallery</span>
                  </div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {inspectedAccount.galleryCount || 0}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#08090C] border border-[#1E222B]">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[10px] uppercase">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Total Records</span>
                  </div>
                  <div className="text-lg font-bold text-emerald-300 font-mono mt-1">
                    {inspectedAccount.totalRecords || 0}
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-[#08090C] border border-[#1E222B] space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Account Identifier:</span>
                  <span className="text-white">{inspectedAccount.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Display Name:</span>
                  <span className="text-white">{inspectedAccount.displayName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Created At:</span>
                  <span className="text-zinc-200">
                    {inspectedAccount.createdAt
                      ? formatExactTime(inspectedAccount.createdAt)
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Last Synced:</span>
                  <span className="text-zinc-200">
                    {inspectedAccount.updatedAt
                      ? formatExactTime(inspectedAccount.updatedAt)
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-[#1E222B] bg-[#06070A] flex items-center justify-between">
              {!isMasterAdminIdentifier(inspectedAccount.username) ? (
                <button
                  type="button"
                  onClick={() => void handleToggleRole(inspectedAccount)}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-purple-500/15 hover:bg-purple-500/25 text-emerald-300 border border-purple-400/40 cursor-pointer"
                >
                  {inspectedAccount.role === 'VIP' ? 'Demote to User' : 'Promote to VIP'}
                </button>
              ) : (
                <span className="text-[11px] font-mono text-amber-300">
                  Permanent Master Admin Account
                </span>
              )}
              <button
                type="button"
                onClick={() => setInspectedAccount(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[#141720] hover:bg-[#1E222B] text-white border border-[#232732] cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
