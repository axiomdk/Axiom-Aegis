import React, { useState, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import {
  SiteImprovementItem,
  SiteImprovementPriority,
  SiteImprovementStatus,
} from '../types';
import {
  cycleSiteImprovementStatus,
  formatSiteImprovementsAsPrompt,
} from '../utils/sidebarEngine';
import { RoleBadge } from './RoleBadge';
import {
  Wrench,
  Shield,
  Lock,
  Plus,
  Copy,
  Check,
  Trash2,
  Edit3,
  Search,
  Filter,
  Sparkles,
  RefreshCw,
  CheckSquare,
  Square,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lightbulb,
} from 'lucide-react';

const APP_SECTION_PRESETS = [
  'General',
  'Dashboard',
  'Navigation & Sidebar',
  'Calendar & Timeline',
  'Daily Notes',
  'Funds & Bills',
  'Strategic Goals',
  'Distance & Biometrics',
  'Private Gallery',
  'Shortcuts',
  'Customization & Theme',
  'Admin & Security',
  'Performance & Cloudflare',
];

const PRIORITY_LEVELS: SiteImprovementPriority[] = ['Low', 'Medium', 'High', 'Critical'];
const STATUS_LEVELS: SiteImprovementStatus[] = ['Idea', 'Planned', 'In Progress', 'Completed'];

const PRIORITY_RANK: Record<SiteImprovementPriority, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const STATUS_RANK: Record<SiteImprovementStatus, number> = {
  'In Progress': 4,
  Planned: 3,
  Idea: 2,
  Completed: 1,
};

export const SiteImprovementsView: React.FC = () => {
  const {
    appData,
    updateAppData,
    isMasterAdmin,
    accountSession,
    accent,
    showNotification,
  } = useVault();

  // Quick-Add Form State
  const [title, setTitle] = useState('');
  const [categoryTag, setCategoryTag] = useState('General');
  const [customSectionInput, setCustomSectionInput] = useState('');
  const [priority, setPriority] = useState<SiteImprovementPriority>('High');
  const [status, setStatus] = useState<SiteImprovementStatus>('Planned');
  const [notes, setNotes] = useState('');

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | SiteImprovementStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | SiteImprovementPriority>('ALL');
  const [sectionFilter, setSectionFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'priority' | 'newest' | 'status'>('priority');

  // Selection & Inline Edit State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    title: string;
    categoryTag: string;
    priority: SiteImprovementPriority;
    status: SiteImprovementStatus;
    notes: string;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [promptPreviewText, setPromptPreviewText] = useState<string | null>(null);

  const items: SiteImprovementItem[] = useMemo(
    () => appData?.siteImprovements || [],
    [appData?.siteImprovements]
  );

  const availableSections = useMemo(() => {
    const set = new Set<string>(APP_SECTION_PRESETS);
    for (const item of items) {
      if (item.categoryTag) set.add(item.categoryTag);
    }
    return Array.from(set);
  }, [items]);

  const filteredAndSortedItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && item.priority !== priorityFilter) return false;
      if (sectionFilter !== 'ALL' && item.categoryTag !== sectionFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.categoryTag.toLowerCase().includes(q) ||
        item.notes.toLowerCase().includes(q) ||
        item.priority.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'priority') {
        const diff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
        if (diff !== 0) return diff;
        return (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt);
      }
      if (sortBy === 'status') {
        const diff = STATUS_RANK[b.status] - STATUS_RANK[a.status];
        if (diff !== 0) return diff;
        return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];
      }
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [items, searchQuery, statusFilter, priorityFilter, sectionFilter, sortBy]);

  const kpis = useMemo(() => {
    const total = items.length;
    const criticalOrHigh = items.filter(
      (i) => (i.priority === 'Critical' || i.priority === 'High') && i.status !== 'Completed'
    ).length;
    const inProgress = items.filter((i) => i.status === 'In Progress').length;
    const completed = items.filter((i) => i.status === 'Completed').length;
    return { total, criticalOrHigh, inProgress, completed };
  }, [items]);

  // Strict security guard: only Master Admin ("The App Creator") can view or interact
  if (!isMasterAdmin) {
    return null;
  }

  const handleAddImprovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      showNotification('Please enter a title for the site improvement.', 'error');
      return;
    }
    const finalSection =
      categoryTag === '__custom__' && customSectionInput.trim()
        ? customSectionInput.trim()
        : categoryTag || 'General';
    const now = Date.now();
    const newItem: SiteImprovementItem = {
      id: `si-${now}-${Math.random().toString(36).slice(2, 7)}`,
      title: cleanTitle,
      categoryTag: finalSection,
      priority,
      status,
      notes: notes.trim(),
      createdAt: now,
      updatedAt: now,
    };

    await updateAppData(
      (prev) => ({
        ...prev,
        siteImprovements: [newItem, ...(prev.siteImprovements || [])],
      }),
      { actionLabel: 'Site Improvement Added' }
    );

    setTitle('');
    setNotes('');
    setCustomSectionInput('');
    showNotification(`Added "${cleanTitle}" to Site Improvements roadmap!`, 'success');
  };

  const handleCycleStatus = async (item: SiteImprovementItem) => {
    const nextStatus = cycleSiteImprovementStatus(item.status);
    const now = Date.now();
    await updateAppData(
      (prev) => ({
        ...prev,
        siteImprovements: (prev.siteImprovements || []).map((it) =>
          it.id === item.id ? { ...it, status: nextStatus, updatedAt: now } : it
        ),
      }),
      { actionLabel: 'Site Improvement Status Updated' }
    );
    showNotification(`Updated "${item.title}" status to ${nextStatus}`, 'info');
  };

  const handleStartEdit = (item: SiteImprovementItem) => {
    setEditingId(item.id);
    setEditDraft({
      title: item.title,
      categoryTag: item.categoryTag,
      priority: item.priority,
      status: item.status,
      notes: item.notes,
    });
  };

  const handleSaveEdit = async (id: string) => {
    if (!editDraft || !editDraft.title.trim()) return;
    const now = Date.now();
    await updateAppData(
      (prev) => ({
        ...prev,
        siteImprovements: (prev.siteImprovements || []).map((it) =>
          it.id === id
            ? {
                ...it,
                title: editDraft.title.trim(),
                categoryTag: editDraft.categoryTag.trim() || 'General',
                priority: editDraft.priority,
                status: editDraft.status,
                notes: editDraft.notes.trim(),
                updatedAt: now,
              }
            : it
        ),
      }),
      { actionLabel: 'Site Improvement Edited' }
    );
    setEditingId(null);
    setEditDraft(null);
    showNotification('Saved changes to site improvement item.', 'success');
  };

  const handleDeleteItem = async (id: string, itemTitle: string) => {
    await updateAppData(
      (prev) => ({
        ...prev,
        siteImprovements: (prev.siteImprovements || []).filter((it) => it.id !== id),
      }),
      { actionLabel: 'Site Improvement Deleted' }
    );
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showNotification(`Removed "${itemTitle}" from Site Improvements.`, 'info');
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    if (
      filteredAndSortedItems.length > 0 &&
      filteredAndSortedItems.every((it) => selectedIds.has(it.id))
    ) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedItems.map((it) => it.id)));
    }
  };

  const copyPromptToClipboard = async (targetItems: SiteImprovementItem[], badgeKey: string) => {
    const formatted = formatSiteImprovementsAsPrompt(targetItems);
    if (!formatted) return;
    setPromptPreviewText(formatted);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formatted);
      }
    } catch {
      // Fallback preview modal is also shown
    }
    setCopiedId(badgeKey);
    setTimeout(() => {
      setCopiedId((curr) => (curr === badgeKey ? null : curr));
    }, 2200);
    showNotification(
      targetItems.length === 1
        ? `Copied "${targetItems[0].title}" as AI Studio development prompt!`
        : `Copied ${targetItems.length} improvements as a batch AI Studio prompt!`,
      'success'
    );
  };

  const getPriorityBadgeStyle = (p: SiteImprovementPriority) => {
    switch (p) {
      case 'Critical':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
      case 'High':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
      case 'Medium':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';
      case 'Low':
      default:
        return 'bg-zinc-800/80 text-zinc-300 border-zinc-700';
    }
  };

  const getStatusBadgeStyle = (s: SiteImprovementStatus) => {
    switch (s) {
      case 'Completed':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
      case 'In Progress':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/40';
      case 'Planned':
        return 'bg-sky-500/15 text-sky-300 border-sky-500/40';
      case 'Idea':
      default:
        return 'bg-amber-500/10 text-amber-200 border-amber-500/30';
    }
  };

  const getStatusIcon = (s: SiteImprovementStatus) => {
    switch (s) {
      case 'Completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'In Progress':
        return <RefreshCw className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'Planned':
        return <Clock className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      case 'Idea':
      default:
        return <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    }
  };

  const selectedItemsList = useMemo(
    () => items.filter((it) => selectedIds.has(it.id)),
    [items, selectedIds]
  );

  return (
    <div data-testid="site-improvements-view" className="space-y-6">
      {/* Top Admin-Only Header Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#000000] border border-[#1E222B] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              className="w-9 h-9 rounded-xl bg-[#08090C] border flex items-center justify-center shrink-0"
              style={{ borderColor: `${accent.hex}66` }}
            >
              <Wrench className="w-5 h-5" style={{ color: accent.hex }} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  Site Improvements &amp; Roadmap Tracker
                </h1>
                <span
                  data-testid="site-improvements-admin-lock-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/40"
                >
                  <Lock className="w-2.5 h-2.5" />
                  <span>ADMIN ONLY</span>
                </span>
                <RoleBadge role="The App Creator" size="xs" />
              </div>
              <p className="text-xs font-mono text-zinc-400">
                Private Creator Development Ledger ({accountSession?.username || 'axiomdk99@gmail.com'}) • Log features, bugs, and export 1-click AI Studio prompts
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {selectedItemsList.length > 0 && (
            <button
              type="button"
              data-testid="copy-batch-prompt-btn"
              onClick={() => void copyPromptToClipboard(selectedItemsList, 'batch')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black shadow flex items-center gap-1.5 cursor-pointer transition-all"
            >
              {copiedId === 'batch' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>
                Copy {selectedItemsList.length} Selected as AI Studio Prompt
              </span>
            </button>
          )}
          {filteredAndSortedItems.length > 0 && selectedItemsList.length === 0 && (
            <button
              type="button"
              data-testid="copy-all-filtered-prompt-btn"
              onClick={() =>
                void copyPromptToClipboard(
                  filteredAndSortedItems.filter((i) => i.status !== 'Completed').length > 0
                    ? filteredAndSortedItems.filter((i) => i.status !== 'Completed')
                    : filteredAndSortedItems,
                  'all-filtered'
                )
              }
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0A0D14] hover:bg-[#131824] text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Copy Open Roadmap as Prompt</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              Total Tracked
            </span>
            <span
              data-testid="site-improvements-kpi-total"
              className="text-2xl font-extrabold text-white font-mono tabular-nums mt-0.5 block"
            >
              {kpis.total}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
            <Wrench className="w-4 h-4 text-cyan-400" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              Critical / High Open
            </span>
            <span
              data-testid="site-improvements-kpi-high"
              className="text-2xl font-extrabold text-rose-400 font-mono tabular-nums mt-0.5 block"
            >
              {kpis.criticalOrHigh}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              In Progress
            </span>
            <span
              data-testid="site-improvements-kpi-progress"
              className="text-2xl font-extrabold text-purple-400 font-mono tabular-nums mt-0.5 block"
            >
              {kpis.inProgress}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
            <RefreshCw className="w-4 h-4 text-purple-400" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block">
              Completed
            </span>
            <span
              data-testid="site-improvements-kpi-completed"
              className="text-2xl font-extrabold text-emerald-400 font-mono tabular-nums mt-0.5 block"
            >
              {kpis.completed}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
      </div>

      {/* Quick-Add Site Improvement Form */}
      <form
        onSubmit={handleAddImprovement}
        data-testid="site-improvement-quick-add-form"
        className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-4"
      >
        <div className="flex items-center justify-between border-b border-[#1E222B] pb-3">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4" style={{ color: accent.hex }} />
            <h2 className="text-sm font-bold text-white">
              Log New Site Improvement, Feature Idea, or Bug Fix
            </h2>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            Synced to Master Admin Vault
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label
              htmlFor="si-title-input"
              className="block text-[11px] font-mono uppercase text-zinc-400 mb-1"
            >
              Improvement Title *
            </label>
            <input
              id="si-title-input"
              type="text"
              required
              data-testid="si-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add keyboard shortcut for quick expense filter..."
              className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="md:col-span-3">
            <label
              htmlFor="si-section-select"
              className="block text-[11px] font-mono uppercase text-zinc-400 mb-1"
            >
              Category / App Section
            </label>
            <select
              id="si-section-select"
              data-testid="si-section-select"
              value={categoryTag}
              onChange={(e) => setCategoryTag(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
              <option value="__custom__">+ Custom Section Tag...</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="si-priority-select"
              className="block text-[11px] font-mono uppercase text-zinc-400 mb-1"
            >
              Priority Level
            </label>
            <select
              id="si-priority-select"
              data-testid="si-priority-select"
              value={priority}
              onChange={(e) => setPriority(e.target.value as SiteImprovementPriority)}
              className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              {PRIORITY_LEVELS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="si-status-select"
              className="block text-[11px] font-mono uppercase text-zinc-400 mb-1"
            >
              Initial Status
            </label>
            <select
              id="si-status-select"
              data-testid="si-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as SiteImprovementStatus)}
              className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-white focus:outline-none focus:border-cyan-400"
            >
              {STATUS_LEVELS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        {categoryTag === '__custom__' && (
          <div>
            <label
              htmlFor="si-custom-section-input"
              className="block text-[11px] font-mono uppercase text-zinc-400 mb-1"
            >
              Custom App Section Name
            </label>
            <input
              id="si-custom-section-input"
              type="text"
              value={customSectionInput}
              onChange={(e) => setCustomSectionInput(e.target.value)}
              placeholder="e.g. Mobile Bottom Bar"
              className="w-full sm:w-72 px-3 py-1.5 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-white"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="si-notes-input"
            className="block text-[11px] font-mono uppercase text-zinc-400 mb-1"
          >
            Detailed Implementation Notes &amp; Prompt Spec
          </label>
          <textarea
            id="si-notes-input"
            rows={3}
            data-testid="si-notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe exact UI behavior, edge cases, state persistence requirements, or layout expectations..."
            className="w-full px-3 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
          />
        </div>

        <div className="flex items-center justify-end">
          <button
            type="submit"
            data-testid="si-submit-btn"
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${accent.primaryBg}`}
          >
            <Plus className="w-4 h-4" />
            <span>Add to Site Improvements</span>
          </button>
        </div>
      </form>

      {/* Filter, Search & Sort Controls Bar */}
      <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              data-testid="si-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter improvements by title, notes, section, or priority..."
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

          {/* Dropdown Filters: Section & Sort */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <select
                aria-label="Filter by App Section"
                data-testid="si-filter-section"
                value={sectionFilter}
                onChange={(e) => setSectionFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-zinc-200 font-mono"
              >
                <option value="ALL">All Sections</option>
                {availableSections.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            <select
              aria-label="Filter by Priority"
              data-testid="si-filter-priority"
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(e.target.value as 'ALL' | SiteImprovementPriority)
              }
              className="px-2.5 py-1.5 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-zinc-200 font-mono"
            >
              <option value="ALL">All Priorities</option>
              {PRIORITY_LEVELS.map((p) => (
                <option key={p} value={p}>
                  Priority: {p}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort Improvements"
              data-testid="si-sort-select"
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'priority' | 'newest' | 'status')
              }
              className="px-2.5 py-1.5 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-zinc-200 font-mono"
            >
              <option value="priority">Sort: Priority (Critical → Low)</option>
              <option value="status">Sort: Status (In Progress → Completed)</option>
              <option value="newest">Sort: Newest Added</option>
            </select>
          </div>
        </div>

        {/* Status Filter Pills + Batch Select Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#151821]">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['ALL', ...STATUS_LEVELS] as const).map((st) => (
              <button
                key={st}
                type="button"
                data-testid={`si-status-tab-${st.toLowerCase().replace(/\s+/g, '-')}`}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-xl text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-400/50'
                    : 'bg-[#08090C] text-zinc-400 border-[#232732] hover:text-zinc-200'
                }`}
              >
                {st === 'ALL' ? `All (${items.length})` : st}
              </button>
            ))}
          </div>

          {filteredAndSortedItems.length > 0 && (
            <button
              type="button"
              data-testid="si-select-all-btn"
              onClick={toggleSelectAllFiltered}
              className="px-2.5 py-1 rounded-lg bg-[#08090C] hover:bg-[#141720] border border-[#232732] text-[11px] font-mono text-zinc-300 flex items-center gap-1.5 cursor-pointer"
            >
              {filteredAndSortedItems.every((it) => selectedIds.has(it.id)) ? (
                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Square className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <span>
                {selectedIds.size > 0
                  ? `${selectedIds.size} Selected`
                  : 'Select All Filtered'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Copied Prompt Preview Drawer (when user clicks Copy as AI Studio Prompt) */}
      {promptPreviewText && (
        <div
          data-testid="si-prompt-preview-box"
          className="p-4 rounded-2xl bg-[#05070B] border border-cyan-500/40 space-y-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-300">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>AI Studio Prompt Ready (Copied to Clipboard)</span>
            </div>
            <button
              type="button"
              onClick={() => setPromptPreviewText(null)}
              aria-label="Close prompt preview"
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <pre
            data-testid="si-prompt-preview-content"
            className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] text-xs font-mono text-zinc-200 whitespace-pre-wrap overflow-x-auto max-h-56"
          >
            {promptPreviewText}
          </pre>
        </div>
      )}

      {/* Roadmap Items List */}
      <div className="space-y-3">
        {filteredAndSortedItems.length === 0 ? (
          <div
            data-testid="si-empty-state"
            className="p-10 rounded-2xl bg-[#000000] border border-[#1E222B] text-center space-y-2"
          >
            <Shield className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-200">
              {items.length === 0
                ? 'No Site Improvements Logged Yet'
                : 'No Site Improvements Match Your Filter'}
            </p>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Use the quick-add form above to log feature ideas, UI refinements, or bug reports, then export any item or batch directly as an AI Studio prompt.
            </p>
          </div>
        ) : (
          filteredAndSortedItems.map((item) => {
            const isSelected = selectedIds.has(item.id);
            const isEditing = editingId === item.id && editDraft !== null;

            return (
              <div
                key={item.id}
                data-testid={`si-item-card-${item.id}`}
                className={`p-4 rounded-2xl bg-[#000000] border transition-all ${
                  isSelected
                    ? 'border-cyan-400/60 shadow-[0_0_15px_rgba(0,229,255,0.08)]'
                    : 'border-[#1E222B] hover:border-[#2B3140]'
                }`}
              >
                {isEditing && editDraft ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <input
                        type="text"
                        data-testid={`si-edit-title-${item.id}`}
                        value={editDraft.title}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, title: e.target.value })
                        }
                        className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-[#08090C] border border-[#232732] text-xs font-bold text-white"
                      />
                      <select
                        value={editDraft.priority}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            priority: e.target.value as SiteImprovementPriority,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-[#08090C] border border-[#232732] text-xs text-white font-mono"
                      >
                        {PRIORITY_LEVELS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      <select
                        value={editDraft.status}
                        onChange={(e) =>
                          setEditDraft({
                            ...editDraft,
                            status: e.target.value as SiteImprovementStatus,
                          })
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-[#08090C] border border-[#232732] text-xs text-white font-mono"
                      >
                        {STATUS_LEVELS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <input
                        type="text"
                        value={editDraft.categoryTag}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, categoryTag: e.target.value })
                        }
                        placeholder="Category / Section tag"
                        className="px-3 py-1.5 rounded-lg bg-[#08090C] border border-[#232732] text-xs text-zinc-200 font-mono"
                      />
                    </div>
                    <textarea
                      rows={3}
                      data-testid={`si-edit-notes-${item.id}`}
                      value={editDraft.notes}
                      onChange={(e) =>
                        setEditDraft({ ...editDraft, notes: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg bg-[#08090C] border border-[#232732] text-xs text-zinc-200"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft(null);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#141720] text-xs text-zinc-300 border border-[#232732] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        data-testid={`si-save-edit-btn-${item.id}`}
                        onClick={() => void handleSaveEdit(item.id)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold cursor-pointer"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <button
                        type="button"
                        data-testid={`si-select-checkbox-${item.id}`}
                        onClick={() => toggleSelectId(item.id)}
                        aria-label={`Select ${item.title}`}
                        className="mt-0.5 text-zinc-400 hover:text-cyan-400 cursor-pointer shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            data-testid={`si-item-title-${item.id}`}
                            className={`text-sm font-bold ${
                              item.status === 'Completed'
                                ? 'line-through text-zinc-400'
                                : 'text-white'
                            }`}
                          >
                            {item.title}
                          </span>

                          {/* Priority Badge */}
                          <span
                            data-testid={`si-item-priority-${item.id}`}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border uppercase ${getPriorityBadgeStyle(
                              item.priority
                            )}`}
                          >
                            {item.priority}
                          </span>

                          {/* Section Tag */}
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-[#0C0E14] text-zinc-300 border border-[#1E222B]">
                            {item.categoryTag}
                          </span>

                          {/* 1-Click Status Cycling Button */}
                          <button
                            type="button"
                            data-testid={`si-cycle-status-btn-${item.id}`}
                            onClick={() => void handleCycleStatus(item)}
                            title="Click to cycle status (Idea → Planned → In Progress → Completed)"
                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold border inline-flex items-center gap-1 cursor-pointer transition-transform active:scale-95 ${getStatusBadgeStyle(
                              item.status
                            )}`}
                          >
                            {getStatusIcon(item.status)}
                            <span>{item.status}</span>
                          </button>
                        </div>

                        {item.notes && (
                          <p
                            data-testid={`si-item-notes-${item.id}`}
                            className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed bg-[#06070A] p-2.5 rounded-xl border border-[#151821]"
                          >
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Item Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                      <button
                        type="button"
                        data-testid={`si-copy-prompt-btn-${item.id}`}
                        onClick={() => void copyPromptToClipboard([item], item.id)}
                        title="Format & copy this improvement as an AI Studio development prompt"
                        className="px-2.5 py-1.5 rounded-xl bg-[#0A0D14] hover:bg-[#141926] text-cyan-300 border border-cyan-500/30 text-[11px] font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Copy as AI Studio Prompt</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        data-testid={`si-edit-btn-${item.id}`}
                        onClick={() => handleStartEdit(item)}
                        title={`Edit ${item.title}`}
                        aria-label={`Edit ${item.title}`}
                        className="p-1.5 rounded-xl bg-[#08090C] hover:bg-[#141720] text-zinc-300 hover:text-white border border-[#232732] cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        data-testid={`si-delete-btn-${item.id}`}
                        onClick={() => void handleDeleteItem(item.id, item.title)}
                        title={`Delete ${item.title}`}
                        aria-label={`Delete ${item.title}`}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
