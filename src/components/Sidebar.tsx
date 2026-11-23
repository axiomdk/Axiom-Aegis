import React, { useState, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import { TabType } from '../types';
import {
  LayoutDashboard,
  Calendar,
  Zap,
  Activity,
  Compass,
  Wallet,
  Target,
  Image as ImageIcon,
  FileUp,
  Download,
  Palette,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ShieldCheck,
  BookOpen,
  History,
  Search,
  Plus,
  ChevronsUpDown,
  HardDriveDownload,
  Crown,
  ArrowUp,
  ArrowDown,
  GripVertical,
  RotateCcw,
  Bookmark,
  Shield,
  Wrench,
  Layers,
  CheckSquare,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { RoleBadge } from './RoleBadge';
import { APP_VERSION, formatLastUpdated, formatExactTime } from '../utils/version';
import {
  computeSidebarMetrics,
  filterSidebarGroups,
  filterSidebarGroupsByAdminAccess,
  isAdminOnlySidebarItem,
  moveSidebarGroupOrder,
  sanitizeSidebarGroupOrder,
  sanitizeSidebarGroupItems,
  sanitizeSidebarGroupLabels,
  sanitizeSidebarItemLabels,
  applySidebarCustomization,
  moveSidebarItemByDrag,
  moveSidebarItemStep,
  DEFAULT_SIDEBAR_GROUP_ORDER,
  DEFAULT_SIDEBAR_GROUP_ITEMS,
  DEFAULT_SIDEBAR_GROUP_LABELS,
  DEFAULT_SIDEBAR_ITEM_LABELS,
} from '../utils/sidebarEngine';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  tab?: TabType;
  onClick?: () => void;
  badge?: string;
  adminOnly?: boolean;
  keywords?: string[];
}

interface SidebarGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: SidebarItem[];
}

export const Sidebar: React.FC = () => {
  const {
    isLocked,
    isInitialized,
    accountSession,
    accountRole,
    isMasterAdmin,
    signOutAccount,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    setIsFrequentEventsOpen,
    setIsCommandPaletteOpen,
    openQuickAdd,
    appData,
    layoutConfig,
    updateLayoutConfig,
    activeTab,
    setActiveTab,
    accent,
    openImportHub,
    lastSavedTimestamp,
  } = useVault();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    daily_ops: true,
    biometrics: true,
    wealth: true,
    vault_sys: true,
  });
  const [filterQuery, setFilterQuery] = useState('');
  const [draggedGroupId, setDraggedGroupId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const currentGroupOrder = useMemo(
    () =>
      sanitizeSidebarGroupOrder(
        appData?.settings?.sidebarGroupOrder || layoutConfig?.sidebarGroupOrder
      ),
    [appData?.settings?.sidebarGroupOrder, layoutConfig?.sidebarGroupOrder]
  );

  const currentGroupItems = useMemo(
    () =>
      sanitizeSidebarGroupItems(
        appData?.settings?.sidebarGroupItems || layoutConfig?.sidebarGroupItems,
        appData?.customNavCategories
      ),
    [
      appData?.settings?.sidebarGroupItems,
      layoutConfig?.sidebarGroupItems,
      appData?.customNavCategories,
    ]
  );

  const currentGroupLabels = useMemo(
    () =>
      sanitizeSidebarGroupLabels(
        appData?.settings?.sidebarGroupLabels || layoutConfig?.sidebarGroupLabels
      ),
    [appData?.settings?.sidebarGroupLabels, layoutConfig?.sidebarGroupLabels]
  );

  const currentItemLabels = useMemo(
    () =>
      sanitizeSidebarItemLabels(
        appData?.settings?.sidebarItemLabels || layoutConfig?.sidebarItemLabels,
        appData?.customNavCategories
      ),
    [
      appData?.settings?.sidebarItemLabels,
      layoutConfig?.sidebarItemLabels,
      appData?.customNavCategories,
    ]
  );

  const handleMoveSidebarGroup = (
    groupId: string,
    target: 'up' | 'down' | string
  ) => {
    const nextOrder = moveSidebarGroupOrder(currentGroupOrder, groupId, target);
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupOrder: nextOrder,
    }));
  };

  const handleDropSidebarItem = (
    sourceItemId: string,
    target:
      | { type: 'item'; targetItemId: string; targetGroupId?: string }
      | { type: 'group'; targetGroupId: string }
  ) => {
    const nextItems = moveSidebarItemByDrag(currentGroupItems, sourceItemId, target);
    if (target.type === 'group') {
      setOpenGroups((prev) => ({ ...prev, [target.targetGroupId]: true }));
    } else if (target.targetGroupId) {
      setOpenGroups((prev) => ({ ...prev, [target.targetGroupId!]: true }));
    }
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupItems: nextItems,
    }));
  };

  const handleStepSidebarItem = (
    itemId: string,
    direction: 'up' | 'down',
    visibleItemIds: Set<string>
  ) => {
    const nextItems = moveSidebarItemStep(
      currentGroupItems,
      currentGroupOrder,
      itemId,
      direction,
      visibleItemIds
    );
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupItems: nextItems,
    }));
  };

  const handleResetSidebarCustomization = () => {
    const defaultOrder = [...DEFAULT_SIDEBAR_GROUP_ORDER];
    const defaultItems = sanitizeSidebarGroupItems(
      DEFAULT_SIDEBAR_GROUP_ITEMS as unknown as Record<string, string[]>,
      appData?.customNavCategories
    );
    updateLayoutConfig((prev) => ({
      ...prev,
      sidebarGroupOrder: defaultOrder,
      sidebarGroupItems: defaultItems,
      sidebarGroupLabels: { ...DEFAULT_SIDEBAR_GROUP_LABELS },
      sidebarItemLabels: sanitizeSidebarItemLabels(
        { ...DEFAULT_SIDEBAR_ITEM_LABELS },
        appData?.customNavCategories
      ),
    }));
  };

  const appName = appData?.settings?.appName || 'Axiom Aegis';
  const appShortName = appData?.settings?.appShortName || 'AA';
  const sidebarIconColor =
    appData?.settings?.sidebarIconColor || layoutConfig?.sidebarIconColor || '#00E5FF';
  const sidebarPosition =
    appData?.settings?.sidebarPosition || layoutConfig?.sidebarPosition || 'left';
  const activeDisplayName =
    appData?.settings?.commanderName ||
    appData?.settings?.userName ||
    accountSession?.displayName ||
    'Commander';
  const activeGuildName = appData?.settings?.guildName || 'Aegis Vanguard';
  const activeAvatarDataUrl = appData?.settings?.avatarDataUrl || '';
  const recentUpdateTime = formatLastUpdated(lastSavedTimestamp);
  const exactUpdateTime = formatExactTime(lastSavedTimestamp);

  const metrics = useMemo(() => computeSidebarMetrics(appData), [appData]);

  const toggleGroup = (groupId: string) => {
    if (isSidebarCollapsed) {
      setIsSidebarCollapsed(false);
      setOpenGroups((prev) => ({ ...prev, [groupId]: true }));
      return;
    }
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const allGroupsOpen =
    openGroups.daily_ops &&
    openGroups.biometrics &&
    openGroups.wealth &&
    openGroups.vault_sys;

  const toggleAllGroups = () => {
    const nextState = !allGroupsOpen;
    setOpenGroups({
      daily_ops: nextState,
      biometrics: nextState,
      wealth: nextState,
      vault_sys: nextState,
    });
  };

  const handleNavClick = (tab?: TabType, customAction?: () => void) => {
    if (customAction) {
      customAction();
    } else if (tab) {
      setActiveTab(tab);
    }
    setIsMobileSidebarOpen(false);
  };

  const navGroups: SidebarGroup[] = useMemo(() => {
    const customCats = (appData?.customNavCategories || []).filter(
      (cat) => cat.visibility === 'all_users' || isMasterAdmin
    );
    const buildCustomGroupItems = (groupId: string): SidebarItem[] =>
      customCats
        .filter((cat) => (cat.parentGroupId || 'vault_sys') === groupId)
        .map((cat) => ({
          id: `nav-custom-${cat.id}`,
          label: cat.name,
          icon: <Layers className="w-4 h-4" style={{ color: sidebarIconColor }} />,
          tab: cat.id as TabType,
          badge: `${(cat.checklist?.length || 0) + (cat.statusCards?.length || 0)}`,
          adminOnly: cat.visibility === 'admin_only',
          keywords: [
            cat.name.toLowerCase(),
            'custom',
            cat.visibility === 'admin_only' ? 'admin' : 'workspace',
          ],
        }));

    return [
      {
        id: 'daily_ops',
        label: 'Personal',
        icon: <Calendar className="w-4 h-4" style={{ color: sidebarIconColor }} />,
        items: [
          {
            id: 'nav-calendar',
            label: 'Calendar',
            icon: <Calendar className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'calendar',
            badge: `${metrics.timelineCount}`,
            keywords: ['calendar', 'timeline', 'month', 'week', 'schedule', 'dates', 'planner', 'events'],
          },
          {
            id: 'nav-notes',
            label: 'Notes',
            icon: <BookOpen className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'notes',
            badge: `${metrics.notesCount}`,
            keywords: ['journal', 'markdown', 'writing', 'memo', 'notes'],
          },
          {
            id: 'nav-chores',
            label: 'Chores',
            icon: <CheckSquare className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'chores',
            keywords: ['chores', 'tasks', 'todo', 'housework', 'clean', 'checklist'],
          },
          {
            id: 'nav-frequent-events',
            label: 'Quick Add',
            icon: <Zap className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            onClick: () => setIsFrequentEventsOpen(true),
            badge: `${metrics.frequentEventsCount}`,
            keywords: ['templates', 'presets', 'quick', 'routines', 'tray', 'frequent'],
          },
          ...buildCustomGroupItems('daily_ops'),
        ],
      },
      {
        id: 'biometrics',
        label: 'Biometrics & Mobility',
        icon: <Activity className="w-4 h-4" style={{ color: sidebarIconColor }} />,
        items: [
          {
            id: 'nav-lifestats',
            label: 'Life Stats',
            icon: <Activity className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'lifestats',
            badge: `${metrics.lifeStatsCount}`,
            keywords: ['weight', 'mood', 'health', 'vitals', 'biometrics', 'life stats'],
          },
          {
            id: 'nav-distance',
            label: 'Distance',
            icon: <Compass className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'distance',
            badge: `${metrics.distancesCount}`,
            keywords: ['miles', 'kilometers', 'walk', 'run', 'cycle', 'drive', 'mobility', 'distance'],
          },
          ...buildCustomGroupItems('biometrics'),
        ],
      },
      {
        id: 'wealth',
        label: 'Wealth & Strategy',
        icon: <Wallet className="w-4 h-4" style={{ color: sidebarIconColor }} />,
        items: [
          {
            id: 'nav-funds',
            label: 'Funds',
            icon: <Wallet className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'funds',
            badge: `${metrics.fundsCount}`,
            keywords: ['finance', 'money', 'bank', 'budget', 'expenses', 'income', 'ledger', 'funds'],
          },
          {
            id: 'nav-goals',
            label: 'Strategic Goals',
            icon: <Target className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'goals',
            badge:
              metrics.goalsCount > 0
                ? `${metrics.activeGoalsCount}/${metrics.goalsCount}`
                : '0',
            keywords: ['milestones', 'targets', 'objectives', 'okr'],
          },
          ...buildCustomGroupItems('wealth'),
        ],
      },
      {
        id: 'vault_sys',
        label: 'Vault & System',
        icon: <ShieldCheck className="w-4 h-4" style={{ color: sidebarIconColor }} />,
        items: [
          {
            id: 'nav-gallery',
            label: 'Private Gallery',
            icon: <ImageIcon className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'gallery',
            badge: `${metrics.galleryCount}`,
            keywords: ['photos', 'images', 'media', 'encrypted', 'vault'],
          },
          {
            id: 'nav-import-hub',
            label: 'Import',
            icon: <FileUp className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            onClick: () => openImportHub(),
            keywords: ['csv', 'pdf', 'ocr', 'takeout', 'sync', 'upload', 'import'],
          },
          {
            id: 'nav-changelog',
            label: 'Changelog',
            icon: <History className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            badge: APP_VERSION.split(' ')[0],
            onClick: () => {
              window.dispatchEvent(new CustomEvent('open-changelog-modal'));
            },
            keywords: ['version', 'history', 'updates', 'notes', 'changelog'],
          },
          {
            id: 'nav-customization',
            label: 'Customization',
            icon: <Palette className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'customization',
            keywords: ['theme', 'appearance', 'colors', 'layout', 'panels', 'columns', 'categories', 'quotes', 'customize'],
          },
          {
            id: 'nav-settings',
            label: 'Settings',
            icon: <SettingsIcon className="w-4 h-4" style={{ color: sidebarIconColor }} />,
            tab: 'settings',
            keywords: ['preferences', 'profile', 'identity', 'units', 'weather', 'security', 'passphrase', 'sync', 'backup', 'vault'],
          },
          ...(isMasterAdmin
            ? [
                {
                  id: 'nav-site-improvements',
                  label: 'Site Improvements',
                  icon: <Wrench className="w-4 h-4" style={{ color: sidebarIconColor }} />,
                  tab: 'site_improvements' as TabType,
                  badge: `${metrics.siteImprovementsCount}`,
                  adminOnly: true,
                  keywords: [
                    'site',
                    'improvements',
                    'roadmap',
                    'bugs',
                    'features',
                    'admin',
                    'prompt',
                    'ai studio',
                    'tracker',
                  ],
                },
                {
                  id: 'nav-master-admin',
                  label: 'Master Admin Overseer',
                  icon: <Crown className="w-4 h-4" style={{ color: sidebarIconColor }} />,
                  tab: 'admin' as TabType,
                  adminOnly: true,
                  keywords: ['admin', 'database', 'accounts', 'vip', 'creator', 'overseer', 'users', 'roles'],
                },
              ]
            : []),
          ...buildCustomGroupItems('vault_sys'),
        ],
      },
    ];
  }, [
    metrics,
    openImportHub,
    setIsFrequentEventsOpen,
    isMasterAdmin,
    sidebarIconColor,
    appData?.customNavCategories,
  ]);

  const orderedNavGroups = useMemo(
    () =>
      filterSidebarGroupsByAdminAccess(
        applySidebarCustomization(
          navGroups,
          currentGroupOrder,
          currentGroupItems,
          currentGroupLabels,
          currentItemLabels,
          appData?.customNavCategories
        ),
        isMasterAdmin,
        appData?.customNavCategories
      ),
    [
      navGroups,
      currentGroupOrder,
      currentGroupItems,
      currentGroupLabels,
      currentItemLabels,
      isMasterAdmin,
      appData?.customNavCategories,
    ]
  );

  const allAvailableItemIds = useMemo(() => {
    const set = new Set<string>();
    for (const g of navGroups) {
      for (const it of g.items) {
        set.add(it.id);
      }
    }
    return set;
  }, [navGroups]);

  const visibleGroups = useMemo(
    () => filterSidebarGroups(orderedNavGroups, filterQuery),
    [orderedNavGroups, filterQuery]
  );

  const isFiltering = filterQuery.trim().length > 0;
  const dashboardMatchesFilter =
    !isFiltering ||
    'dashboard command center overview home'.includes(filterQuery.trim().toLowerCase());

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const collapsed = !isMobileDrawer && isSidebarCollapsed;

    return (
      <nav
        aria-label="Primary Workspace Navigation"
        className="flex flex-col h-full bg-[#000000] border-r border-[#1E222B] select-none"
      >
        {/* Top Brand Header */}
        <div
          className={`h-14 px-3 bg-[#000000] border-b border-[#1E222B] flex items-center ${
            collapsed ? 'justify-center' : 'justify-between'
          } gap-2 shrink-0`}
        >
          <button
            type="button"
            onClick={() => handleNavClick('shortcuts')}
            data-testid="sidebar-brand-btn"
            className={`flex items-center gap-2.5 text-left focus:outline-none group min-w-0 ${
              collapsed ? 'flex-col justify-center gap-0.5' : ''
            }`}
            title={`${appName} (${appShortName}) — ${APP_VERSION}`}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 bg-[#000000] border border-[#1E222B] shrink-0 group-hover:scale-105 overflow-hidden"
              style={{
                backgroundColor: '#000000',
                boxShadow: `0 0 14px ${accent.glow}`,
              }}
            >
              <BrandLogo
                resolution={64}
                className="w-full h-full"
                accentColor={accent.hex}
              />
            </div>
            {collapsed ? (
              <span
                data-testid="sidebar-collapsed-monogram"
                className="text-[9px] font-mono font-extrabold tracking-wider leading-none"
                style={{ color: accent.hex }}
              >
                {appShortName}
              </span>
            ) : (
              <div className="flex flex-col min-w-0 gap-0.5">
                <div className="flex items-center gap-1.5 leading-none">
                  <span
                    data-testid="sidebar-app-name"
                    className="text-sm font-bold tracking-tight text-zinc-100 group-hover:text-white truncate"
                  >
                    {appName}
                  </span>
                  <span
                    data-testid="sidebar-app-monogram"
                    className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#000000] border border-[#232732] font-bold shrink-0"
                    style={{ color: accent.hex }}
                  >
                    {appShortName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 leading-none">
                  <span
                    data-testid="sidebar-app-version"
                    className="text-[10px] font-mono text-zinc-400 font-medium whitespace-nowrap"
                  >
                    {APP_VERSION}
                  </span>
                </div>
              </div>
            )}
          </button>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#111319] border border-transparent hover:border-[#232732] transition-colors"
              aria-label="Close mobile navigation drawer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            !collapsed && (
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(true)}
                data-testid="sidebar-collapse-btn"
                title="Collapse sidebar to icon rail"
                aria-label="Collapse sidebar"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#111319] border border-transparent hover:border-[#232732] transition-colors shrink-0"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {/* Sidebar Quick Filter & Action Bar */}
        {!isLocked && (
          <div className="px-2.5 py-1.5 border-b border-[#1E222B] bg-[#000000] shrink-0">
            {collapsed ? (
              <div className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  data-testid="sidebar-expand-top-btn"
                  onClick={() => setIsSidebarCollapsed(false)}
                  title="Expand Sidebar"
                  aria-label="Expand Sidebar"
                  className="w-9 h-7 rounded-lg bg-[#000000] hover:bg-[#111319] text-zinc-300 hover:text-white border border-[#1E222B] flex items-center justify-center transition-colors"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  data-testid="sidebar-rail-search-btn"
                  onClick={() => setIsCommandPaletteOpen(true)}
                  title="Global Command Search"
                  aria-label="Global Command Search"
                  className="w-9 h-7 rounded-lg bg-[#000000] hover:bg-[#111319] text-zinc-300 hover:text-white border border-[#1E222B] flex items-center justify-center transition-colors"
                >
                  <Search className="w-3.5 h-3.5 text-cyan-400" />
                </button>
                <button
                  type="button"
                  data-testid="sidebar-rail-quick-add-btn"
                  onClick={() => openQuickAdd()}
                  title="Quick Add Entry"
                  aria-label="Quick Add Entry"
                  className="w-9 h-7 rounded-lg bg-[#000000] hover:bg-[#111319] text-zinc-200 hover:text-white border border-[#1E222B] flex items-center justify-center transition-colors"
                  style={{ borderColor: accent.hex }}
                >
                  <Plus className="w-3.5 h-3.5" style={{ color: accent.hex }} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    data-testid="sidebar-filter-input"
                    placeholder="Filter menu..."
                    aria-label="Filter sidebar navigation items"
                    className="w-full pl-7 pr-6 py-1 rounded-lg bg-[#000000] border border-[#1E222B] focus:border-[#2E3442] text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
                  />
                  {filterQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterQuery('')}
                      aria-label="Clear menu filter"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="sidebar-quick-add-btn"
                  onClick={() => openQuickAdd()}
                  title="Quick Add Entry"
                  aria-label="Quick Add Entry"
                  className="p-1 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-zinc-200 hover:text-white shrink-0 transition-colors"
                  style={{ borderColor: accent.hex }}
                >
                  <Plus className="w-3.5 h-3.5" style={{ color: accent.hex }} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Navigation Groups */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-2 bg-[#000000]">
          {/* 1. Command Center: Shortcuts (Home) & Dashboard */}
          {dashboardMatchesFilter && (
            <div>
              {!collapsed && (
                <div className="px-2.5 mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-semibold">
                    Command Center
                  </span>
                  <button
                    type="button"
                    data-testid="sidebar-toggle-all-groups-btn"
                    onClick={toggleAllGroups}
                    title={allGroupsOpen ? 'Fold all navigation groups' : 'Expand all navigation groups'}
                    className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    <ChevronsUpDown className="w-3 h-3" />
                    <span>{allGroupsOpen ? 'Fold' : 'Expand'}</span>
                  </button>
                </div>
              )}

              {/* Primary Home Page: Shortcuts */}
              <button
                type="button"
                data-testid="sidebar-nav-shortcuts"
                aria-current={activeTab === 'shortcuts' ? 'page' : undefined}
                onClick={() => handleNavClick('shortcuts')}
                title="Home Page — Web Shortcuts & Quick Launch"
                className={`relative w-full flex items-center ${
                  collapsed ? 'justify-center px-0 py-1.5' : 'justify-between px-2.5 py-1.5'
                } rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'shortcuts'
                    ? 'bg-[#000000] text-white border border-[#232732]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#111319] border border-transparent'
                }`}
                style={
                  activeTab === 'shortcuts'
                    ? { color: accent.hex, borderColor: accent.hex }
                    : undefined
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Bookmark className="w-4 h-4 shrink-0" style={{ color: sidebarIconColor }} />
                  {!collapsed && (
                    <span className="truncate">
                      {currentItemLabels['nav-shortcuts'] || 'Shortcuts'}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-[#08090C] text-cyan-400 border border-[#1E222B]">
                      HOME
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-[#000000] text-zinc-300 border border-[#1E222B] shrink-0">
                      {metrics.shortcutsCount}
                    </span>
                  </div>
                )}
              </button>

              {/* Dashboard Overview */}
              <button
                type="button"
                data-testid="sidebar-nav-dashboard"
                aria-current={activeTab === 'dashboard' ? 'page' : undefined}
                onClick={() => handleNavClick('dashboard')}
                title="Dashboard Overview"
                className={`mt-1 relative w-full flex items-center ${
                  collapsed ? 'justify-center px-0 py-1.5' : 'justify-between px-2.5 py-1.5'
                } rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-[#000000] text-white border border-[#232732]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#111319] border border-transparent'
                }`}
                style={
                  activeTab === 'dashboard'
                    ? { color: accent.hex, borderColor: accent.hex }
                    : undefined
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <LayoutDashboard className="w-4 h-4 shrink-0" style={{ color: sidebarIconColor }} />
                  {!collapsed && (
                    <span className="truncate">
                      {currentItemLabels['nav-dashboard'] || 'Dashboard'}
                    </span>
                  )}
                </div>
                {!collapsed && activeTab === 'dashboard' && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: accent.hex }}
                    />
                  </div>
                )}
              </button>
            </div>
          )}

          {/* 2-5. Accordion Dropdown Groups (Reorderable Categories & Cross-Category Draggable Subsections) */}
          {visibleGroups.map((group, groupIndex) => {
            const isOpen = isFiltering ? true : Boolean(openGroups[group.id]);
            const hasActiveChild = group.items.some((it) => it.tab && it.tab === activeTab);
            const isFirstGroup = groupIndex === 0;
            const isLastGroup = groupIndex === visibleGroups.length - 1;
            const isGroupDragTarget =
              dragOverGroupId === group.id &&
              (draggedItemId !== null || (draggedGroupId !== null && draggedGroupId !== group.id));

            if (collapsed) {
              // Icon-only rail mode on desktop
              return (
                <div
                  key={group.id}
                  className="pt-1.5 border-t border-[#1E222B] flex flex-col items-center gap-0.5"
                >
                  {group.items.map((item) => {
                    const isActive = item.tab ? activeTab === item.tab : false;
                    const tooltipParts = [`${group.label}: ${item.label}`];
                    if (item.badge) tooltipParts.push(`(${item.badge})`);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-testid={`sidebar-rail-${item.id}`}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => handleNavClick(item.tab, item.onClick)}
                        title={tooltipParts.join(' ')}
                        aria-label={item.label}
                        className={`relative w-9 h-8 rounded-lg flex items-center justify-center transition-all ${
                          isActive
                            ? 'bg-[#000000] text-white border border-[#232732]'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#111319] border border-transparent'
                        }`}
                        style={
                          isActive
                            ? { color: accent.hex, borderColor: accent.hex }
                            : undefined
                        }
                      >
                        {item.icon}
                      </button>
                    );
                  })}
                </div>
              );
            }

            return (
              <div
                key={group.id}
                data-testid={`sidebar-group-container-${group.id}`}
                draggable={!isFiltering}
                onDragStart={(e) => {
                  if (isFiltering || draggedItemId) return;
                  setDraggedGroupId(group.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', `group:${group.id}`);
                }}
                onDragOver={(e) => {
                  if (isFiltering) return;
                  if (draggedGroupId || draggedItemId) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverGroupId !== group.id) {
                      setDragOverGroupId(group.id);
                    }
                  }
                }}
                onDragLeave={() => {
                  if (dragOverGroupId === group.id) {
                    setDragOverGroupId(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const rawTransfer = e.dataTransfer.getData('text/plain') || '';
                  const activeItem =
                    draggedItemId ||
                    (rawTransfer.startsWith('item:') ? rawTransfer.slice(5) : null);
                  const activeGroup =
                    draggedGroupId ||
                    (rawTransfer.startsWith('group:')
                      ? rawTransfer.slice(6)
                      : !rawTransfer.startsWith('item:')
                      ? rawTransfer
                      : null);

                  setDraggedGroupId(null);
                  setDragOverGroupId(null);
                  setDraggedItemId(null);
                  setDragOverItemId(null);

                  if (activeItem) {
                    handleDropSidebarItem(activeItem, {
                      type: 'group',
                      targetGroupId: group.id,
                    });
                    return;
                  }

                  if (activeGroup && activeGroup !== group.id) {
                    handleMoveSidebarGroup(activeGroup, group.id);
                  }
                }}
                onDragEnd={() => {
                  setDraggedGroupId(null);
                  setDragOverGroupId(null);
                  setDraggedItemId(null);
                  setDragOverItemId(null);
                }}
                className={`space-y-0.5 rounded-lg transition-all ${
                  isGroupDragTarget ? 'ring-1 ring-cyan-500/60 bg-cyan-950/15' : ''
                }`}
              >
                <div
                  className={`group/grp w-full flex items-center justify-between px-2 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wider font-semibold transition-colors ${
                    hasActiveChild
                      ? 'text-zinc-100 bg-[#000000] border border-[#1E222B]'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#111319] border border-transparent'
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`sidebar-group-${group.id}`}
                    aria-expanded={isOpen}
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    {!isFiltering && (
                      <GripVertical
                        className="w-3 h-3 text-zinc-600 group-hover/grp:text-zinc-400 shrink-0 cursor-grab active:cursor-grabbing"
                        aria-hidden="true"
                      />
                    )}
                    {group.icon}
                    <span className="truncate">{group.label}</span>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isFiltering && (
                      <div className="flex items-center gap-0.5 opacity-70 group-hover/grp:opacity-100 transition-opacity">
                        <button
                          type="button"
                          data-testid={`sidebar-group-up-${group.id}`}
                          disabled={isFirstGroup}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveSidebarGroup(group.id, 'up');
                          }}
                          title={`Move ${group.label} category up`}
                          aria-label={`Move ${group.label} up`}
                          className="p-0.5 rounded hover:bg-[#1A1D26] text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                        >
                          <ArrowUp className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          data-testid={`sidebar-group-down-${group.id}`}
                          disabled={isLastGroup}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveSidebarGroup(group.id, 'down');
                          }}
                          title={`Move ${group.label} category down`}
                          aria-label={`Move ${group.label} down`}
                          className="p-0.5 rounded hover:bg-[#1A1D26] text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                        >
                          <ArrowDown className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    )}
                    {!isOpen && hasActiveChild && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: accent.hex }}
                      />
                    )}
                    <span className="text-[10px] font-mono tabular-nums text-zinc-500">
                      {group.items.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      aria-label={`Toggle ${group.label}`}
                      className="p-0.5 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                    >
                      {isOpen ? (
                        <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="pl-2 space-y-0.5 border-l border-[#1E222B] ml-3">
                    {group.items.length === 0 ? (
                      <div
                        data-testid={`sidebar-group-empty-dropzone-${group.id}`}
                        className="px-2.5 py-1.5 rounded-lg border border-dashed border-[#1E222B] text-[10px] font-mono text-zinc-600 text-center"
                      >
                        Drop subsections here
                      </div>
                    ) : (
                      group.items.map((item, itemIdx) => {
                        const isActive = item.tab ? activeTab === item.tab : false;
                        const isVeryFirstItem = isFirstGroup && itemIdx === 0;
                        const isVeryLastItem =
                          isLastGroup && itemIdx === group.items.length - 1;
                        const isItemDragTarget =
                          dragOverItemId === item.id && draggedItemId !== item.id;

                        return (
                          <div
                            key={item.id}
                            data-testid={`sidebar-item-row-${item.id}`}
                            draggable={!isFiltering}
                            onDragStart={(e) => {
                              if (isFiltering) return;
                              e.stopPropagation();
                              setDraggedItemId(item.id);
                              setDraggedGroupId(null);
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', `item:${item.id}`);
                            }}
                            onDragOver={(e) => {
                              if (isFiltering || !draggedItemId) return;
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = 'move';
                              if (dragOverItemId !== item.id) {
                                setDragOverItemId(item.id);
                              }
                              if (dragOverGroupId !== null) {
                                setDragOverGroupId(null);
                              }
                            }}
                            onDragLeave={(e) => {
                              e.stopPropagation();
                              if (dragOverItemId === item.id) {
                                setDragOverItemId(null);
                              }
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rawTransfer = e.dataTransfer.getData('text/plain') || '';
                              const sourceItem =
                                draggedItemId ||
                                (rawTransfer.startsWith('item:')
                                  ? rawTransfer.slice(5)
                                  : null);
                              setDraggedItemId(null);
                              setDragOverItemId(null);
                              setDraggedGroupId(null);
                              setDragOverGroupId(null);

                              if (sourceItem && sourceItem !== item.id) {
                                handleDropSidebarItem(sourceItem, {
                                  type: 'item',
                                  targetItemId: item.id,
                                  targetGroupId: group.id,
                                });
                              }
                            }}
                            onDragEnd={(e) => {
                              e.stopPropagation();
                              setDraggedItemId(null);
                              setDragOverItemId(null);
                              setDraggedGroupId(null);
                              setDragOverGroupId(null);
                            }}
                            className={`group/item flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                              isItemDragTarget
                                ? 'ring-1 ring-cyan-400 bg-cyan-950/20'
                                : isActive
                                ? 'bg-[#000000] text-white font-semibold border border-[#232732]'
                                : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#111319] border border-transparent'
                            }`}
                            style={
                              isActive && !isItemDragTarget
                                ? { color: accent.hex, borderColor: accent.hex }
                                : undefined
                            }
                          >
                            <button
                              type="button"
                              data-testid={`sidebar-item-${item.id}`}
                              aria-current={isActive ? 'page' : undefined}
                              onClick={() => handleNavClick(item.tab, item.onClick)}
                              title={`${item.label} (Drag to move between categories)`}
                              className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                            >
                              {!isFiltering && (
                                <GripVertical
                                  className="w-3 h-3 text-zinc-700 group-hover/item:text-zinc-400 shrink-0 cursor-grab active:cursor-grabbing"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="shrink-0">{item.icon}</span>
                              <span className="truncate">{item.label}</span>
                              {(item.adminOnly ||
                                isAdminOnlySidebarItem(
                                  item.id,
                                  appData?.customNavCategories
                                )) && (
                                <span
                                  data-testid={`sidebar-admin-lock-${item.id}`}
                                  title="Admin-Only Category (Strictly Private to The App Creator)"
                                  className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 shrink-0"
                                >
                                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                                  <span>ADMIN</span>
                                </span>
                              )}
                            </button>

                            <div className="flex items-center gap-1 shrink-0">
                              {!isFiltering && (
                                <div className="hidden group-hover/item:flex focus-within:flex items-center gap-0.5 transition-opacity">
                                  <button
                                    type="button"
                                    data-testid={`sidebar-item-up-${item.id}`}
                                    disabled={isVeryFirstItem}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStepSidebarItem(
                                        item.id,
                                        'up',
                                        allAvailableItemIds
                                      );
                                    }}
                                    title={`Move ${item.label} up (or into previous category)`}
                                    aria-label={`Move ${item.label} up`}
                                    className="p-0.5 rounded hover:bg-[#1A1D26] text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                                  >
                                    <ArrowUp className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    data-testid={`sidebar-item-down-${item.id}`}
                                    disabled={isVeryLastItem}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStepSidebarItem(
                                        item.id,
                                        'down',
                                        allAvailableItemIds
                                      );
                                    }}
                                    title={`Move ${item.label} down (or into next category)`}
                                    aria-label={`Move ${item.label} down`}
                                    className="p-0.5 rounded hover:bg-[#1A1D26] text-zinc-500 hover:text-zinc-200 disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                                  >
                                    <ArrowDown className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}
                              {item.badge !== undefined && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono tabular-nums bg-[#000000] text-zinc-300 border border-[#1E222B] shrink-0">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty Filter State */}
          {!collapsed && !dashboardMatchesFilter && visibleGroups.length === 0 && (
            <div
              data-testid="sidebar-filter-empty"
              className="px-3 py-6 text-center rounded-xl border border-[#1E222B] bg-[#000000] space-y-2"
            >
              <p className="text-xs text-zinc-400">
                No menu items match <span className="font-mono text-zinc-200">"{filterQuery}"</span>
              </p>
              <button
                type="button"
                onClick={() => setFilterQuery('')}
                className="px-2.5 py-1 rounded-lg text-[11px] font-mono bg-[#000000] hover:bg-[#111319] text-zinc-200 border border-[#232732] transition-colors"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>

        {/* Pinned Sidebar Footer: Forum-Style Profile Card + Sign Out Control */}
        <div className="p-2 border-t border-[#1E222B] bg-[#000000] space-y-1.5 shrink-0">
          {!collapsed ? (
            <div
              data-testid="sidebar-encryption-badge"
              className="px-2.5 py-2 rounded-lg bg-[#000000] border border-[#1E222B] space-y-1.5"
              title={`${appName} (${appShortName}) ${APP_VERSION} • ${metrics.totalRecordsCount} Records • Exact Update: ${exactUpdateTime}`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg bg-[#0A0C10] border border-[#1E222B] flex items-center justify-center overflow-hidden shrink-0"
                  style={{ borderColor: `${accent.hex}55` }}
                >
                  {activeAvatarDataUrl ? (
                    <img
                      src={activeAvatarDataUrl}
                      alt={activeDisplayName}
                      data-testid="sidebar-profile-avatar-img"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-xs font-mono font-bold uppercase"
                      style={{ color: accent.hex }}
                    >
                      {(activeDisplayName || accountSession?.username || 'U')
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      data-testid="sidebar-forum-username"
                      className="truncate text-xs font-bold text-white"
                    >
                      {activeDisplayName}
                    </span>
                    <RoleBadge role={accountRole} size="xs" testId="sidebar-role-badge" />
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-300 truncate mt-0.5">
                    <Shield className="w-2.5 h-2.5 shrink-0" style={{ color: sidebarIconColor }} />
                    <span data-testid="sidebar-forum-guild" className="truncate">
                      {activeGuildName}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-zinc-400 tabular-nums pt-1 border-t border-[#151821]">
                <span className="truncate text-emerald-400">
                  @{accountSession?.username || 'synced'}
                </span>
                <span className="shrink-0" title="Total synced account records">
                  {metrics.totalRecordsCount} rec • {recentUpdateTime}
                </span>
              </div>
            </div>
          ) : (
            <div
              className="flex justify-center py-0.5"
              title={`${activeDisplayName} (${activeGuildName}) • @${accountSession?.username || 'synced'} • ${metrics.totalRecordsCount} records`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          )}

          {isInitialized && (
            <div className={`flex ${collapsed ? 'flex-col' : 'items-center'} gap-1.5`}>
              <button
                type="button"
                data-testid="sidebar-lock-vault-btn"
                onClick={() => {
                  if (!isLocked) signOutAccount();
                }}
                disabled={isLocked}
                title="Sign Out of Account"
                className={`${
                  collapsed ? 'w-9 h-8 mx-auto' : 'w-full py-1.5 px-2.5'
                } rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors bg-[#000000] hover:bg-[#111319] text-zinc-200 hover:text-rose-300 border-[#232732] hover:border-rose-500/40 cursor-pointer`}
              >
                <Unlock className="w-3.5 h-3.5 shrink-0" style={{ color: sidebarIconColor }} />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </div>
          )}
        </div>
      </nav>
    );
  };

  const bottomBarItems: SidebarItem[] = useMemo(() => {
    const items: SidebarItem[] = [
      {
        id: 'nav-shortcuts',
        label: currentItemLabels['nav-shortcuts'] || 'Shortcuts',
        icon: <Bookmark className="w-4 h-4" style={{ color: sidebarIconColor }} />,
        tab: 'shortcuts',
        badge: `${metrics.shortcutsCount}`,
      },
      {
        id: 'nav-dashboard',
        label: currentItemLabels['nav-dashboard'] || 'Dashboard',
        icon: <LayoutDashboard className="w-4 h-4" style={{ color: sidebarIconColor }} />,
        tab: 'dashboard',
      },
    ];
    for (const grp of orderedNavGroups) {
      for (const it of grp.items) {
        items.push(it);
      }
    }
    return items;
  }, [orderedNavGroups, sidebarIconColor, currentItemLabels, metrics.shortcutsCount]);

  return (
    <>
      {sidebarPosition === 'bottom' ? (
        /* Horizontal Bottom Dock Navigation Bar (Desktop) */
        <aside
          data-testid="desktop-bottom-bar"
          data-sidebar-position="bottom"
          className="hidden lg:flex fixed bottom-0 left-0 right-0 h-16 bg-[#000000] border-t border-[#1E222B] z-40 px-4 items-center justify-between gap-3 select-none shadow-2xl"
        >
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleNavClick('shortcuts')}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-[#08090C] border border-[#1E222B] hover:border-[#2E3646] cursor-pointer"
            >
              <BrandLogo resolution={32} className="w-5 h-5" accentColor={accent.hex} />
              <span className="text-xs font-bold text-white">{appShortName}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar flex-1">
            {bottomBarItems.map((item) => {
              const isActive = item.tab ? activeTab === item.tab : false;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-testid={`bottom-dock-${item.id}`}
                  onClick={() => handleNavClick(item.tab, item.onClick)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-[#0D1017] text-white font-semibold border-[#2E3646]'
                      : 'bg-[#000000] text-zinc-400 hover:text-zinc-100 hover:bg-[#0D1017] border-transparent'
                  }`}
                  style={isActive ? { borderColor: accent.hex, color: accent.hex } : undefined}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <span className="whitespace-nowrap">{item.label}</span>
                  {(item.adminOnly ||
                    isAdminOnlySidebarItem(item.id, appData?.customNavCategories)) && (
                    <span
                      data-testid={`bottom-dock-admin-lock-${item.id}`}
                      title="Admin-Only Category (Strictly Private to The App Creator)"
                      className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 shrink-0"
                    >
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      <span>ADMIN</span>
                    </span>
                  )}
                  {item.badge !== undefined && (
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-[#08090C] border border-[#1E222B] text-zinc-300 tabular-nums">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Forum-Style Compact Profile Pill in Bottom Bar */}
          <div className="flex items-center gap-2 shrink-0 pl-2 border-l border-[#1E222B]">
            <div className="flex flex-col text-right leading-tight">
              <div className="flex items-center justify-end gap-1">
                <span className="text-[11px] font-bold text-white truncate max-w-[100px]">
                  {activeDisplayName}
                </span>
                <RoleBadge role={accountRole} size="xs" />
              </div>
              <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[120px]">
                {activeGuildName}
              </span>
            </div>
          </div>
        </aside>
      ) : (
        /* Desktop Collapsible Left Sidebar (w-64 expanded, w-16 icon-only rail collapsed) */
        <aside
          data-testid="desktop-sidebar"
          data-collapsed={String(isSidebarCollapsed)}
          data-sidebar-position="left"
          className={`hidden lg:flex flex-col shrink-0 sticky top-0 h-[100dvh] z-40 transition-all duration-200 ${
            isSidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {renderSidebarBody(false)}
        </aside>
      )}

      {/* Mobile Slide-Over Sidebar Drawer */}
      {isMobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <aside
            data-testid="mobile-sidebar-drawer"
            className="relative w-64 max-w-[85vw] h-[100dvh] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] z-10 shadow-2xl bg-[#000000]"
          >
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}
    </>
  );
};
