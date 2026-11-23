import React, { useMemo, useState } from 'react';
import { useVault } from '../context/VaultContext';
import { ShortcutItem } from '../types';
import {
  Bookmark,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Search,
  Globe,
  X,
  Sparkles,
  Code,
  Briefcase,
  Shield,
  Terminal,
  LayoutDashboard,
  Calendar,
  BookOpen,
  Wallet,
  SlidersHorizontal,
} from 'lucide-react';

const SHORTCUT_CATEGORIES = [
  'General',
  'Work & Ops',
  'Finance',
  'Development',
  'Research & AI',
  'Media & Social',
  'Security',
];

function normalizeShortcutUrl(raw: string): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function extractDomainLabel(url: string): string {
  try {
    const normalized = normalizeShortcutUrl(url);
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./i, '');
  } catch {
    return url.replace(/^https?:\/\//i, '').split('/')[0] || 'web';
  }
}

export const ShortcutsView: React.FC = () => {
  const { appData, updateAppData, accent, setActiveTab, showNotification } = useVault();

  const shortcuts: ShortcutItem[] = useMemo(() => {
    const list = appData?.shortcuts || [];
    return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [appData?.shortcuts]);

  const [googleSearchQuery, setGoogleSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isManageMode, setIsManageMode] = useState(false);
  const [failedFavicons, setFailedFavicons] = useState<Record<string, boolean>>({});

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<ShortcutItem | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('General');
  const [iconInput, setIconInput] = useState('favicon');
  const [closeWarnArmed, setCloseWarnArmed] = useState(false);

  const hasUnsavedChanges = useMemo(() => {
    if (!isModalOpen) return false;
    if (editingShortcut) {
      return (
        titleInput.trim() !== editingShortcut.title ||
        urlInput.trim() !== editingShortcut.url ||
        categoryInput.trim() !== (editingShortcut.category || 'General')
      );
    }
    return titleInput.trim().length > 0 || urlInput.trim().length > 0;
  }, [isModalOpen, editingShortcut, titleInput, urlInput, categoryInput]);

  const handleGoogleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = googleSearchQuery.trim();
    if (!q) return;
    const isLikelyUrl =
      /^https?:\/\//i.test(q) || (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(q) && !q.includes(' '));
    const targetUrl = isLikelyUrl
      ? normalizeShortcutUrl(q)
      : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    const anchor = document.createElement('a');
    anchor.href = targetUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setGoogleSearchQuery('');
  };

  const openAddModal = () => {
    setEditingShortcut(null);
    setTitleInput('');
    setUrlInput('');
    setCategoryInput('General');
    setIconInput('favicon');
    setCloseWarnArmed(false);
    setIsModalOpen(true);
  };

  const openEditModal = (item: ShortcutItem) => {
    setEditingShortcut(item);
    setTitleInput(item.title);
    setUrlInput(item.url);
    setCategoryInput(item.category || 'General');
    setIconInput(item.icon || 'favicon');
    setCloseWarnArmed(false);
    setIsModalOpen(true);
  };

  const handleRequestCloseModal = () => {
    if (hasUnsavedChanges && !closeWarnArmed) {
      setCloseWarnArmed(true);
      return;
    }
    setIsModalOpen(false);
    setEditingShortcut(null);
    setCloseWarnArmed(false);
  };

  const handleSaveShortcut = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedUrl = normalizeShortcutUrl(urlInput);
    if (!normalizedUrl) {
      showNotification('Please enter a valid website URL.', 'error');
      return;
    }

    const domainFallback = extractDomainLabel(normalizedUrl);
    const finalTitle = titleInput.trim() || domainFallback;
    const finalCategory = categoryInput.trim() || 'General';

    if (editingShortcut) {
      await updateAppData(
        (prev) => {
          const nextShortcuts = (prev.shortcuts || []).map((item) =>
            item.id === editingShortcut.id
              ? {
                  ...item,
                  title: finalTitle,
                  url: normalizedUrl,
                  category: finalCategory,
                  icon: iconInput,
                }
              : item
          );
          return {
            ...prev,
            shortcuts: nextShortcuts,
          };
        },
        { actionLabel: 'Shortcut Updated' }
      );
      showNotification(`Updated shortcut "${finalTitle}"`, 'success');
    } else {
      const newShortcut: ShortcutItem = {
        id: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: finalTitle,
        url: normalizedUrl,
        category: finalCategory,
        icon: iconInput,
        order: shortcuts.length,
        createdAt: Date.now(),
      };
      await updateAppData(
        (prev) => ({
          ...prev,
          shortcuts: [...(prev.shortcuts || []), newShortcut],
        }),
        { actionLabel: 'Shortcut Added' }
      );
      showNotification(`Added shortcut "${finalTitle}"`, 'success');
    }

    setIsModalOpen(false);
    setEditingShortcut(null);
    setCloseWarnArmed(false);
  };

  const handleDeleteShortcut = async (id: string, title: string) => {
    await updateAppData(
      (prev) => {
        const remaining = (prev.shortcuts || [])
          .filter((s) => s.id !== id)
          .map((s, idx) => ({ ...s, order: idx }));
        return {
          ...prev,
          shortcuts: remaining,
        };
      },
      { actionLabel: 'Shortcut Removed' }
    );
    showNotification(`Removed shortcut "${title}"`, 'info');
  };

  const handleMoveShortcut = async (id: string, direction: 'up' | 'down') => {
    const idx = shortcuts.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= shortcuts.length) return;

    const reordered = [...shortcuts];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(targetIdx, 0, moved);
    const normalized = reordered.map((item, i) => ({ ...item, order: i }));

    await updateAppData(
      (prev) => ({
        ...prev,
        shortcuts: normalized,
      }),
      { skipUndo: true }
    );
  };

  const allCategories = useMemo(() => {
    const set = new Set<string>(['ALL']);
    for (const s of shortcuts) {
      if (s.category && s.category !== 'General') set.add(s.category);
    }
    return Array.from(set);
  }, [shortcuts]);

  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return shortcuts.filter((item) => {
      if (selectedCategory !== 'ALL' && (item.category || 'General') !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        (item.category || '').toLowerCase().includes(q)
      );
    });
  }, [shortcuts, searchQuery, selectedCategory]);

  const renderShortcutIcon = (item: ShortcutItem) => {
    const domain = extractDomainLabel(item.url);
    const iconName = item.icon;

    if (iconName === 'code') {
      return <Code className="w-6 h-6" style={{ color: accent.hex }} />;
    }
    if (iconName === 'briefcase') {
      return <Briefcase className="w-6 h-6" style={{ color: accent.hex }} />;
    }
    if (iconName === 'shield') {
      return <Shield className="w-6 h-6" style={{ color: accent.hex }} />;
    }
    if (iconName === 'terminal') {
      return <Terminal className="w-6 h-6" style={{ color: accent.hex }} />;
    }
    if (iconName === 'sparkles') {
      return <Sparkles className="w-6 h-6" style={{ color: accent.hex }} />;
    }

    if (iconName !== 'monogram' && !failedFavicons[item.id] && domain && domain.includes('.')) {
      return (
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
          alt=""
          className="w-6 h-6 rounded-sm object-contain pointer-events-none select-none"
          onError={() =>
            setFailedFavicons((prev) => ({
              ...prev,
              [item.id]: true,
            }))
          }
        />
      );
    }

    const letter = (item.title || domain || 'W').trim().charAt(0).toUpperCase() || 'W';
    return (
      <span
        className="text-base font-mono font-extrabold uppercase select-none"
        style={{ color: accent.hex }}
      >
        {letter}
      </span>
    );
  };

  return (
    <div
      data-testid="shortcuts-view"
      className="min-h-[calc(100dvh-7rem)] flex flex-col justify-between py-6 px-2 sm:px-6 max-w-5xl mx-auto select-none"
    >
      <div className="space-y-8">
        {/* Top Right Subtle Controls */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#000000] border border-[#1E222B] text-[11px] font-mono text-zinc-400">
              <Bookmark className="w-3.5 h-3.5" style={{ color: accent.hex }} />
              <span>HOME // SHORTCUTS</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-200 tabular-nums">{shortcuts.length}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {shortcuts.length > 0 && (
              <button
                type="button"
                onClick={() => setIsManageMode((prev) => !prev)}
                data-testid="shortcuts-manage-toggle-btn"
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isManageMode
                    ? 'bg-[#10141D] text-white border-cyan-500/50'
                    : 'bg-[#000000] text-zinc-400 hover:text-white border-[#1E222B]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{isManageMode ? 'Done Editing' : 'Edit Icons'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={openAddModal}
              data-testid="add-shortcut-btn"
              className={`px-3.5 py-1.5 rounded-lg text-xs ${accent.primaryBg} transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Shortcut</span>
            </button>
          </div>
        </div>

        {/* Google-Style Center Search Hero */}
        <div className="max-w-2xl mx-auto text-center space-y-5 pt-2 sm:pt-4">
          <form
            onSubmit={handleGoogleSearch}
            data-testid="shortcuts-google-search-form"
            className="relative flex items-center w-full rounded-2xl bg-[#000000] border border-[#1E222B] focus-within:border-[#323A4E] transition-all overflow-hidden"
          >
            <Globe
              className="w-4 h-4 ml-4 shrink-0 pointer-events-none"
              style={{ color: accent.hex }}
            />
            <input
              type="text"
              value={googleSearchQuery}
              onChange={(e) => setGoogleSearchQuery(e.target.value)}
              placeholder="Search Google or type a URL..."
              data-testid="shortcuts-google-search-input"
              className="w-full px-3.5 py-3.5 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
            />
            {googleSearchQuery && (
              <button
                type="button"
                onClick={() => setGoogleSearchQuery('')}
                className="p-2 text-zinc-500 hover:text-white cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              type="submit"
              data-testid="shortcuts-google-search-submit"
              className="px-4 py-3.5 bg-[#080A0F] hover:bg-[#111520] border-l border-[#1E222B] text-xs font-mono text-zinc-200 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Search className="w-4 h-4" style={{ color: accent.hex }} />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>

          {/* Subtle Filter Input & Category Pills (Only shown if user has > 6 shortcuts or active filter) */}
          {(shortcuts.length > 6 || searchQuery.trim().length > 0 || allCategories.length > 1) && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="relative w-48 sm:w-56">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter icons..."
                  data-testid="shortcuts-search-input"
                  className="w-full pl-8 pr-6 py-1 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {allCategories.length > 1 &&
                allCategories.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer border ${
                        active
                          ? 'bg-[#10141D] text-white border-[#2E3646]'
                          : 'bg-[#000000] text-zinc-400 border-[#1E222B] hover:text-zinc-200'
                      }`}
                      style={
                        active ? { borderColor: `${accent.hex}66`, color: accent.hex } : undefined
                      }
                    >
                      {cat}
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {/* Google-Style 1-Click Icon Grid */}
        <div
          data-testid="shortcuts-grid"
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4 max-w-4xl mx-auto pt-2"
        >
          {filteredShortcuts.map((item) => {
            const domain = extractDomainLabel(item.url);
            const globalIdx = shortcuts.findIndex((s) => s.id === item.id);
            return (
              <div
                key={item.id}
                data-testid={`shortcut-card-${item.id}`}
                className="relative group flex flex-col items-center"
              >
                {/* 1-Click Icon Tile Anchor */}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid={`shortcut-link-${item.id}`}
                  title={`${item.title} (${domain})`}
                  className="w-full py-3.5 px-2 rounded-2xl bg-[#000000] hover:bg-[#0B0E14] border border-transparent hover:border-[#1E222B] transition-all flex flex-col items-center gap-2.5 cursor-pointer group/tile"
                >
                  <div
                    className="w-13 h-13 rounded-full bg-[#080A0F] border border-[#1E222B] group-hover/tile:border-[#2E3646] group-hover/tile:scale-105 transition-all flex items-center justify-center shrink-0"
                    style={{ borderColor: `${accent.hex}35` }}
                  >
                    {renderShortcutIcon(item)}
                  </div>
                  <span className="text-xs font-medium text-zinc-200 group-hover/tile:text-white truncate w-full text-center leading-tight">
                    {item.title}
                  </span>
                </a>

                {/* Hover / Edit Mode Action Pill (Does not block 1-click launch) */}
                <div
                  className={`absolute top-1 right-1 flex items-center gap-0.5 rounded-lg bg-[#050608]/95 border border-[#1E222B] p-0.5 transition-opacity z-10 ${
                    isManageMode
                      ? 'opacity-100'
                      : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                  }`}
                >
                  {isManageMode && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMoveShortcut(item.id, 'up');
                        }}
                        disabled={globalIdx <= 0}
                        title="Move Left"
                        data-testid={`shortcut-up-${item.id}`}
                        className="p-1 rounded hover:bg-[#141820] text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMoveShortcut(item.id, 'down');
                        }}
                        disabled={globalIdx === -1 || globalIdx >= shortcuts.length - 1}
                        title="Move Right"
                        data-testid={`shortcut-down-${item.id}`}
                        className="p-1 rounded hover:bg-[#141820] text-zinc-400 hover:text-white disabled:opacity-25 cursor-pointer"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditModal(item);
                    }}
                    title="Edit Shortcut"
                    data-testid={`shortcut-edit-${item.id}`}
                    className="p-1 rounded hover:bg-[#141820] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteShortcut(item.id, item.title);
                    }}
                    title="Remove Shortcut"
                    data-testid={`shortcut-delete-${item.id}`}
                    className="p-1 rounded hover:bg-rose-950/70 text-zinc-400 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Google-Style "+ Add Shortcut" 1-Click Icon Tile */}
          <button
            type="button"
            onClick={openAddModal}
            data-testid="shortcut-add-tile-btn"
            title="Add new 1-click web shortcut"
            className="w-full py-3.5 px-2 rounded-2xl bg-[#000000] hover:bg-[#0B0E14] border border-dashed border-[#1E222B] hover:border-[#2E3646] transition-all flex flex-col items-center gap-2.5 cursor-pointer group/add"
          >
            <div className="w-13 h-13 rounded-full bg-[#080A0F] border border-[#1E222B] group-hover/add:scale-105 transition-transform flex items-center justify-center shrink-0">
              <Plus className="w-5 h-5 text-zinc-400 group-hover/add:text-white" />
            </div>
            <span className="text-xs font-medium text-zinc-400 group-hover/add:text-zinc-200 truncate w-full text-center leading-tight">
              Add shortcut
            </span>
          </button>
        </div>

        {shortcuts.length === 0 && (
          <div
            data-testid="shortcuts-empty-state"
            className="text-center max-w-md mx-auto pt-2"
          >
            <p className="text-xs text-zinc-500">
              Click <span className="text-zinc-300 font-medium">+ Add shortcut</span> to pin your
              favorite websites as 1-click icons.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Workspace Quick-Jump Bar */}
      <div className="pt-8 mt-6 border-t border-[#141720] flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          data-testid="shortcuts-jump-dashboard"
          className="px-3 py-1.5 rounded-xl bg-[#000000] hover:bg-[#0C0F16] border border-[#1E222B] text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <LayoutDashboard className="w-3.5 h-3.5" style={{ color: accent.hex }} />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('calendar')}
          data-testid="shortcuts-jump-calendar"
          className="px-3 py-1.5 rounded-xl bg-[#000000] hover:bg-[#0C0F16] border border-[#1E222B] text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5" style={{ color: accent.hex }} />
          <span>Calendar</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          data-testid="shortcuts-jump-notes"
          className="px-3 py-1.5 rounded-xl bg-[#000000] hover:bg-[#0C0F16] border border-[#1E222B] text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5" style={{ color: accent.hex }} />
          <span>Notes</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('funds')}
          data-testid="shortcuts-jump-funds"
          className="px-3 py-1.5 rounded-xl bg-[#000000] hover:bg-[#0C0F16] border border-[#1E222B] text-xs text-zinc-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Wallet className="w-3.5 h-3.5" style={{ color: accent.hex }} />
          <span>Funds</span>
        </button>
      </div>

      {/* Add / Edit Shortcut Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={handleRequestCloseModal}
        >
          <div
            data-testid="shortcut-modal"
            className="w-full max-w-md rounded-xl bg-[#000000] border border-[#1E222B] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1E222B]">
              <div className="flex items-center gap-2">
                <Bookmark className="w-4 h-4" style={{ color: accent.hex }} />
                <h2 className="text-sm font-bold text-white">
                  {editingShortcut ? 'Edit Shortcut' : 'Add Shortcut'}
                </h2>
              </div>
              <button
                type="button"
                onClick={handleRequestCloseModal}
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {closeWarnArmed && (
              <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-500/40 text-[11px] text-amber-200 flex items-center justify-between">
                <span>Unsaved shortcut input detected. Click close again to discard.</span>
              </div>
            )}

            <form onSubmit={handleSaveShortcut} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => {
                    setTitleInput(e.target.value);
                    setCloseWarnArmed(false);
                  }}
                  placeholder="e.g. YouTube, GitHub, Gmail"
                  data-testid="shortcut-title-input"
                  className="w-full px-3 py-2 rounded-lg bg-[#08090C] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                  URL
                </label>
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setCloseWarnArmed(false);
                  }}
                  placeholder="e.g. youtube.com"
                  data-testid="shortcut-url-input"
                  className="w-full px-3 py-2 rounded-lg bg-[#08090C] border border-[#1E222B] text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/60"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                    Category
                  </label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    data-testid="shortcut-category-select"
                    className="w-full px-3 py-2 rounded-lg bg-[#08090C] border border-[#1E222B] text-xs text-white focus:outline-none focus:border-cyan-500/60"
                  >
                    {SHORTCUT_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-mono uppercase text-zinc-400 mb-1">
                    Icon Style
                  </label>
                  <select
                    value={iconInput}
                    onChange={(e) => setIconInput(e.target.value)}
                    data-testid="shortcut-icon-select"
                    className="w-full px-3 py-2 rounded-lg bg-[#08090C] border border-[#1E222B] text-xs text-white focus:outline-none focus:border-cyan-500/60"
                  >
                    <option value="favicon">Auto Site Icon (Favicon)</option>
                    <option value="monogram">Letter Monogram</option>
                    <option value="code">Code / Dev</option>
                    <option value="briefcase">Work / Ops</option>
                    <option value="shield">Security / Cloud</option>
                    <option value="terminal">Terminal</option>
                    <option value="sparkles">AI / Research</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleRequestCloseModal}
                  className="px-3.5 py-2 rounded-lg bg-[#0A0C10] hover:bg-[#141820] text-xs font-medium text-zinc-300 border border-[#1E222B] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="shortcut-save-btn"
                  className={`px-4 py-2 rounded-lg text-xs ${accent.primaryBg} cursor-pointer`}
                >
                  {editingShortcut ? 'Done' : 'Add Shortcut'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
