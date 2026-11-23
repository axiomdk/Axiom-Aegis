import React, { useState, useEffect, useRef } from 'react';
import { useVault } from '../context/VaultContext';
import { APP_VERSION, formatLastUpdated, formatExactTime } from '../utils/version';
import { isFileProtocol } from '../utils/mobilePwaEngine';
import { RoleBadge } from './RoleBadge';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import {
  Plus,
  Search,
  Menu,
  PanelLeft,
  Undo2,
  Cloud,
  RefreshCw,
  UserCheck,
  LogOut,
  Upload,
  Download,
  X,
  ChevronDown,
  Globe,
  ExternalLink,
  Shield,
  Image as ImageIcon,
  Edit3,
  Check,
} from 'lucide-react';

import { resolveTabBreadcrumb } from '../utils/sidebarEngine';

export const Navbar: React.FC = () => {
  const {
    isLocked,
    accountSession,
    accountRole,
    signOutAccount,
    updateAccountDisplayName,
    exportAccountSnapshot,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    setIsMobileSidebarOpen,
    appData,
    updateAppData,
    layoutConfig,
    activeTab,
    setActiveTab,
    accent,
    setIsCommandPaletteOpen,
    openQuickAdd,
    canUndo,
    undoStackCount,
    lastUndoLabel,
    undoLastAction,
    cloudSyncStatus,
    lastSyncFeedback,
    lastCloudSyncAt,
    syncVaultNow,
    forcePushVaultToCloud,
    forcePullVaultFromCloud,
    showNotification,
  } = useVault();

  const [isSyncPopoverOpen, setIsSyncPopoverOpen] = useState(false);
  const [isEditingTopBarProfile, setIsEditingTopBarProfile] = useState(false);
  const [topBarNameDraft, setTopBarNameDraft] = useState('');
  const [topBarGuildDraft, setTopBarGuildDraft] = useState('');
  const [googleQuery, setGoogleQuery] = useState('');
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine !== false : true
  );
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const breadcrumb = resolveTabBreadcrumb(
    activeTab,
    appData?.settings?.sidebarGroupItems || layoutConfig?.sidebarGroupItems,
    appData?.settings?.sidebarGroupLabels || layoutConfig?.sidebarGroupLabels,
    appData?.settings?.sidebarItemLabels || layoutConfig?.sidebarItemLabels,
    appData?.customNavCategories
  );
  const runningOfflineFile = isFileProtocol();

  const activeDisplayName =
    appData?.settings?.commanderName ||
    appData?.settings?.userName ||
    accountSession?.displayName ||
    'User';
  const activeUsername = accountSession?.username || 'account';
  const activeGuildName = appData?.settings?.guildName || 'Aegis Vanguard';
  const activeAvatarDataUrl = appData?.settings?.avatarDataUrl || '';

  const isOfflineState =
    !isOnline ||
    runningOfflineFile ||
    cloudSyncStatus === 'disconnected' ||
    cloudSyncStatus === 'error';

  const syncStatusLabel =
    cloudSyncStatus === 'syncing'
      ? 'Syncing...'
      : isOfflineState
      ? 'Offline'
      : 'Synced';

  const lastSyncTooltip = lastCloudSyncAt
    ? `Cloud Sync (@${activeUsername}) — Status: ${syncStatusLabel} — Last synced: ${formatExactTime(
        lastCloudSyncAt
      )} (${formatLastUpdated(lastCloudSyncAt)}).`
    : `Cloud Sync (@${activeUsername}) — Status: ${syncStatusLabel}.`;

  useEffect(() => {
    if (!isSyncPopoverOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsSyncPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isSyncPopoverOpen]);

  const handleToggleTopBarProfileEdit = () => {
    setTopBarNameDraft(activeDisplayName);
    setTopBarGuildDraft(activeGuildName);
    setIsEditingTopBarProfile((prev) => !prev);
  };

  const handleSaveTopBarProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = topBarNameDraft.trim() || 'User';
    const cleanGuild = topBarGuildDraft.trim() || 'Aegis Vanguard';
    await updateAppData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        userName: cleanName,
        commanderName: cleanName,
        guildName: cleanGuild,
      },
    }));
    if (updateAccountDisplayName) {
      await updateAccountDisplayName(cleanName);
    }
    setIsEditingTopBarProfile(false);
    showNotification('Profile saved via Top Bar menu.', 'success');
  };

  const handleTopBarPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 256, 0.82);
      await updateAppData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          avatarDataUrl: compressed.dataUrl,
        },
      }));
      showNotification(`Profile photo updated (${compressed.sizeKb} KB).`, 'success');
    } catch {
      showNotification('Could not process selected image.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  const handleGoogleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = googleQuery.trim();
    if (!trimmed) return;
    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
    const link = document.createElement('a');
    link.href = targetUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setGoogleQuery('');
  };

  return (
    <header className="sticky top-0 z-30 w-full min-h-16 pt-[env(safe-area-inset-top,0px)] border-b border-[#1E222B] bg-[#000000]">
      <div className="h-16 px-3 sm:px-6 flex items-center justify-between gap-2 bg-[#000000]">
        {/* Left: Streamlined Sidebar Toggle + Active Section Indicator */}
        <div className="flex items-center gap-2 min-w-0 flex-1 sm:flex-initial">
          {/* Mobile Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
            data-testid="mobile-sidebar-toggle"
            aria-label="Open navigation menu"
            className="lg:hidden max-md:min-h-[44px] max-md:min-w-[44px] p-2 rounded-xl bg-[#000000] hover:border-zinc-600 text-zinc-300 hover:text-white border border-[#1E222B] flex items-center justify-center transition-colors shrink-0"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Desktop Sidebar Collapse Toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            data-testid="header-sidebar-toggle"
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label="Toggle Sidebar"
            className="hidden lg:flex p-2 rounded-xl bg-[#000000] hover:border-zinc-600 text-zinc-300 hover:text-white border border-[#1E222B] transition-colors shrink-0"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          {/* Minimalist Operational Section Breadcrumb */}
          <div
            data-testid="header-breadcrumb"
            className="flex items-center gap-2 text-xs sm:text-sm min-w-0 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              data-testid="header-brand-crumb"
              title={`Axiom Aegis — ${APP_VERSION}`}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#000000] hover:border-zinc-600 border border-[#1E222B] text-zinc-200 transition-colors shrink-0 cursor-pointer"
            >
              <span
                className="font-mono font-extrabold text-[11px]"
                style={{ color: accent.hex }}
              >
                {APP_VERSION}
              </span>
            </button>
            <span
              className="font-bold text-zinc-100 truncate tracking-tight max-w-[140px] sm:max-w-[200px]"
              style={{ color: activeTab === 'dashboard' ? undefined : accent.hex }}
            >
              {breadcrumb.title}
            </span>
          </div>
        </div>

        {/* Center: Pure-Black Top Bar Google Search Widget */}
        {!isLocked && (
          <form
            onSubmit={handleGoogleSearchSubmit}
            data-testid="navbar-google-search-form"
            className="hidden sm:flex items-center flex-1 max-w-xs md:max-w-sm lg:max-w-md mx-2"
          >
            <div className="relative w-full flex items-center rounded-xl bg-[#000000] border border-[#1E222B] focus-within:border-[#323949] transition-colors overflow-hidden">
              <Globe
                className="w-3.5 h-3.5 ml-3 shrink-0 pointer-events-none"
                style={{ color: accent.hex }}
              />
              <input
                type="text"
                value={googleQuery}
                onChange={(e) => setGoogleQuery(e.target.value)}
                placeholder="Google Search web..."
                aria-label="Google Search"
                data-testid="navbar-google-search-input"
                className="w-full px-2.5 py-1.5 bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
              />
              {googleQuery && (
                <button
                  type="button"
                  onClick={() => setGoogleQuery('')}
                  aria-label="Clear Google search"
                  className="p-1 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="submit"
                data-testid="navbar-google-search-submit"
                title="Search Google in a new tab"
                aria-label="Submit Google Search"
                className="px-2.5 py-1.5 border-l border-[#1E222B] bg-[#000000] hover:text-white text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Search className="w-3.5 h-3.5" style={{ color: accent.hex }} />
                <ExternalLink className="w-2.5 h-2.5 text-zinc-500 hidden lg:inline" />
              </button>
            </div>
          </form>
        )}

        {/* Right: Forum-Style Profile Selector & Drop-Down + Undo + Search ⌘K + Quick Add */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isLocked && canUndo && (
            <button
              type="button"
              onClick={() => {
                void undoLastAction();
              }}
              data-testid="navbar-undo-btn"
              aria-label="Undo Last Action"
              title={lastUndoLabel ? `Undo: ${lastUndoLabel} (⌘Z)` : 'Undo last change (⌘Z)'}
              className="max-md:min-h-[44px] max-md:px-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border border-[#1E222B] hover:border-amber-500/40 text-zinc-200 hover:text-amber-300 transition-colors bg-[#000000]"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Undo</span>
              {undoStackCount > 0 && (
                <span
                  data-testid="navbar-undo-count"
                  className="px-1 py-0.2 text-[10px] font-mono rounded bg-[#000000] border border-[#1E222B] text-amber-300 tabular-nums"
                >
                  {undoStackCount}
                </span>
              )}
            </button>
          )}

          {/* Retained Top Bar Profile Selector + Drop-Down Menu */}
          {!isLocked && (
            <div ref={popoverRef} className="relative flex items-center">
              <div
                className={`flex items-center rounded-xl border bg-[#000000] overflow-hidden transition-colors ${
                  isSyncPopoverOpen
                    ? 'border-zinc-500'
                    : 'border-[#1E222B] hover:border-[#2E3545]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    void syncVaultNow({ silent: false });
                  }}
                  disabled={cloudSyncStatus === 'syncing'}
                  data-testid="header-cloud-sync-btn"
                  title={lastSyncTooltip}
                  className="group max-md:min-h-[44px] max-md:px-2 max-md:gap-1.5 flex items-center gap-2.5 px-3 py-1.5 text-left bg-[#000000] transition-colors cursor-pointer"
                >
                  {/* Forum Avatar with Live Sync Dot */}
                  <div className="relative shrink-0">
                    <div
                      className="w-8 h-8 rounded-lg bg-[#000000] border flex items-center justify-center overflow-hidden transition-transform group-hover:scale-[1.03]"
                      style={{ borderColor: `${accent.hex}75` }}
                    >
                      {activeAvatarDataUrl ? (
                        <img
                          src={activeAvatarDataUrl}
                          alt={activeDisplayName}
                          data-testid="navbar-profile-avatar-img"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span
                          className="text-xs font-mono font-extrabold uppercase"
                          style={{ color: accent.hex }}
                        >
                          {(activeDisplayName || activeUsername).charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#000000] ${
                        syncStatusLabel === 'Syncing...'
                          ? 'bg-amber-400 animate-pulse'
                          : syncStatusLabel === 'Offline'
                          ? 'bg-rose-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                  </div>

                  {/* Forum-Style Identity Stack: Username + RoleBadge on top, Guild Name underneath */}
                  <div className="hidden md:flex flex-col justify-center leading-tight min-w-0 gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        data-testid="navbar-forum-username"
                        className="text-xs font-extrabold text-white tracking-tight truncate max-w-[115px] group-hover:text-zinc-100"
                      >
                        {activeDisplayName}
                      </span>
                      <RoleBadge role={accountRole} size="xs" testId="navbar-role-badge" />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-400 truncate max-w-[160px]">
                      <Shield className="w-2.5 h-2.5 shrink-0" style={{ color: accent.hex }} />
                      <span
                        data-testid="navbar-forum-guild"
                        className="truncate font-semibold"
                        style={{ color: accent.hex }}
                      >
                        {activeGuildName}
                      </span>
                    </div>
                  </div>

                  <span
                    data-testid="header-cloud-sync-status"
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold shrink-0 whitespace-nowrap ${
                      syncStatusLabel === 'Syncing...'
                        ? 'border-amber-500/40 text-amber-300'
                        : syncStatusLabel === 'Offline'
                        ? 'border-rose-500/40 text-rose-300'
                        : 'border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        syncStatusLabel === 'Syncing...'
                          ? 'bg-amber-400 animate-pulse'
                          : syncStatusLabel === 'Offline'
                          ? 'bg-rose-400'
                          : 'bg-emerald-400'
                      }`}
                    />
                    <span>{syncStatusLabel}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSyncPopoverOpen((prev) => !prev)}
                  data-testid="header-pair-phone-btn"
                  aria-label="Account & Sync Options"
                  title="Account & Sync Options"
                  className={`max-md:min-h-[44px] max-md:px-2 px-2.5 self-stretch border-l border-[#1E222B] bg-[#000000] transition-colors flex items-center justify-center cursor-pointer ${
                    isSyncPopoverOpen
                      ? 'text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isSyncPopoverOpen ? 'rotate-180' : ''
                    }`}
                    style={isSyncPopoverOpen ? { color: accent.hex } : undefined}
                  />
                </button>
              </div>

              {isSyncPopoverOpen && (
                <div
                  data-testid="navbar-sync-popover"
                  className="fixed sm:absolute right-2 sm:right-0 top-16 sm:top-full mt-1.5 w-[calc(100vw-1rem)] max-w-xs sm:w-80 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-2xl p-4 z-50 space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-[#1E222B]">
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                        Forum Profile &amp; Sync
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSyncPopoverOpen(false)}
                      className="p-1 rounded-lg text-zinc-400 hover:text-white bg-[#000000] border border-transparent hover:border-[#1E222B]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Mobile Google Search inside Popover for small screens */}
                  <form
                    onSubmit={handleGoogleSearchSubmit}
                    className="sm:hidden flex items-center rounded-xl bg-[#000000] border border-[#1E222B] overflow-hidden"
                  >
                    <Globe
                      className="w-3.5 h-3.5 ml-2.5 shrink-0"
                      style={{ color: accent.hex }}
                    />
                    <input
                      type="text"
                      value={googleQuery}
                      onChange={(e) => setGoogleQuery(e.target.value)}
                      placeholder="Google Search web..."
                      className="w-full px-2 py-1.5 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 bg-[#000000] border-l border-[#1E222B] text-xs font-mono text-zinc-200"
                    >
                      Go
                    </button>
                  </form>

                  {/* Forum-Style Authenticated Account Card */}
                  <div
                    data-testid="navbar-unified-account-badge"
                    className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] space-y-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <label
                        title="Click to change profile photo"
                        className="group relative w-11 h-11 rounded-xl bg-[#000000] border border-[#1E222B] flex items-center justify-center overflow-hidden shrink-0 cursor-pointer"
                        style={{ borderColor: `${accent.hex}66` }}
                      >
                        {activeAvatarDataUrl ? (
                          <img
                            src={activeAvatarDataUrl}
                            alt={activeDisplayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span
                            className="text-sm font-mono font-bold uppercase"
                            style={{ color: accent.hex }}
                          >
                            {(activeDisplayName || activeUsername).charAt(0).toUpperCase()}
                          </span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleTopBarPhotoUpload}
                          className="hidden"
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-white truncate">
                            {activeDisplayName}
                          </span>
                          <RoleBadge
                            role={accountRole}
                            size="xs"
                            testId="navbar-popover-role-badge"
                          />
                        </div>
                        <div
                          data-testid="navbar-popover-guild-name"
                          className="text-[11px] font-mono font-semibold truncate mt-0.5"
                          style={{ color: accent.hex }}
                        >
                          « {activeGuildName} »
                        </div>
                        <div className="text-[10px] font-mono text-emerald-400 truncate">
                          @{activeUsername}
                        </div>
                      </div>
                    </div>

                    {/* Direct Profile Photo & Profile Customization Controls in Top Bar Drop-Down */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-[#1E222B]">
                      <label
                        data-testid="navbar-popover-change-photo-btn"
                        className="py-1.5 px-2 rounded-lg bg-[#000000] hover:border-cyan-500/40 border border-[#1E222B] text-[10px] font-mono font-semibold text-cyan-300 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <ImageIcon className="w-3 h-3 shrink-0" />
                        <span>Change Photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleTopBarPhotoUpload}
                          data-testid="navbar-change-photo-input"
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        data-testid="navbar-popover-customize-profile-btn"
                        onClick={handleToggleTopBarProfileEdit}
                        className="py-1.5 px-2 rounded-lg bg-[#000000] hover:border-amber-500/40 border border-[#1E222B] text-[10px] font-mono font-semibold text-zinc-200 flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3 h-3 shrink-0" style={{ color: accent.hex }} />
                        <span>{isEditingTopBarProfile ? 'Close Edit' : 'Edit Profile'}</span>
                      </button>
                    </div>

                    {isEditingTopBarProfile && (
                      <form
                        onSubmit={handleSaveTopBarProfile}
                        data-testid="navbar-customize-profile-form"
                        className="pt-2 border-t border-[#1E222B] space-y-2 bg-[#000000]"
                      >
                        <input
                          type="text"
                          value={topBarNameDraft}
                          onChange={(e) => setTopBarNameDraft(e.target.value)}
                          data-testid="navbar-profile-name-input"
                          placeholder="Display Name (User)"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white focus:outline-none focus:border-emerald-400"
                        />
                        <input
                          type="text"
                          value={topBarGuildDraft}
                          onChange={(e) => setTopBarGuildDraft(e.target.value)}
                          data-testid="navbar-profile-guild-input"
                          placeholder="Guild / Callsign"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white focus:outline-none focus:border-emerald-400"
                        />
                        <div className="flex items-center gap-1.5">
                          <button
                            type="submit"
                            data-testid="navbar-profile-save-btn"
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save Profile</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsSyncPopoverOpen(false);
                              setActiveTab('customization');
                            }}
                            className="py-1.5 px-2.5 rounded-lg bg-[#000000] border border-[#1E222B] hover:border-zinc-600 text-[10px] font-mono text-zinc-300 cursor-pointer"
                          >
                            Full Studio
                          </button>
                        </div>
                      </form>
                    )}

                    <div className="text-[10px] font-mono text-zinc-400 flex items-center justify-between pt-1.5 border-t border-[#1E222B]">
                      <span className="flex items-center gap-1">
                        <Cloud
                          className={`w-3 h-3 ${
                            syncStatusLabel === 'Syncing...'
                              ? 'text-amber-400'
                              : syncStatusLabel === 'Offline'
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }`}
                        />
                        <span>{syncStatusLabel}</span>
                      </span>
                      <span>
                        {syncStatusLabel === 'Offline'
                          ? 'Offline Queue Active'
                          : lastCloudSyncAt
                          ? `Synced ${formatLastUpdated(lastCloudSyncAt)}`
                          : 'Cloud Auto-Sync Ready'}
                      </span>
                    </div>
                  </div>

                  {lastSyncFeedback && (
                    <div className="p-2 rounded-lg bg-[#000000] border border-emerald-500/40 text-[10px] font-mono text-emerald-300">
                      {lastSyncFeedback}
                    </div>
                  )}

                  {/* 1-Click Sync Now */}
                  <button
                    type="button"
                    data-testid="navbar-account-sync-now-btn"
                    onClick={() => void syncVaultNow({ silent: false })}
                    className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black shadow flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                    <span>Sync Account Now</span>
                  </button>

                  {/* Save to Account & Reload from Database */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="navbar-account-push-btn"
                      onClick={() => void forcePushVaultToCloud()}
                      className="py-2 px-2.5 rounded-xl bg-[#000000] hover:border-cyan-500/40 text-cyan-300 border border-[#1E222B] text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                      <span>Save to Account</span>
                    </button>
                    <button
                      type="button"
                      data-testid="navbar-account-pull-btn"
                      onClick={() => void forcePullVaultFromCloud()}
                      className="py-2 px-2.5 rounded-xl bg-[#000000] hover:border-amber-500/40 text-amber-300 border border-[#1E222B] text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                      <span>Reload DB</span>
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[#1E222B] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      data-testid="navbar-export-snapshot-btn"
                      onClick={() => void exportAccountSnapshot()}
                      className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#000000] hover:border-zinc-600 border border-[#1E222B] text-[11px] font-semibold text-zinc-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-emerald-400" />
                      <span>Export Snapshot</span>
                    </button>
                    <button
                      type="button"
                      data-testid="navbar-signout-btn"
                      onClick={() => {
                        setIsSyncPopoverOpen(false);
                        signOutAccount();
                      }}
                      className="py-1.5 px-3 rounded-lg bg-[#000000] hover:border-rose-500/50 border border-rose-500/30 text-[11px] font-semibold text-rose-300 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Global Search (⌘K) */}
          <button
            type="button"
            onClick={() => setIsCommandPaletteOpen(true)}
            data-testid="header-search-btn"
            aria-label="Open Command Palette"
            title="Workspace Command Palette (⌘K)"
            className="max-md:min-h-[44px] max-md:px-2.5 flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-200 bg-[#000000] border border-[#1E222B] hover:border-zinc-600 rounded-xl transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] bg-[#000000] text-zinc-400 rounded border border-[#1E222B] font-mono">
              ⌘K
            </kbd>
          </button>

          {/* Primary + Quick Add CTA (mobile <640px uses the dedicated floating + Quick Add FAB) */}
          {!isLocked && (
            <button
              type="button"
              onClick={() => openQuickAdd()}
              data-testid="header-quick-add-btn"
              aria-label="Quick Add Entry"
              className={`hidden sm:flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl shadow-sm transition-all duration-200 whitespace-nowrap ${accent.primaryBg}`}
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Quick Add</span>
              <span className="md:hidden">Add</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
