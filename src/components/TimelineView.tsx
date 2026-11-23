import React, { useState, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import {
  TimelineEntry,
  TimelineColumnId,
  FrequentEvent,
  CustomTableColumnDef,
} from '../types';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit2,
  Filter,
  Columns,
  RotateCcw,
  LayoutGrid,
  Table as TableIcon,
  Zap,
  Copy,
  Activity,
  Layers,
  X,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import {
  calculateDurationMinutes,
  formatMinutes,
  calculateTimelineSummary,
} from '../utils/calculations';
import { getCategoriesByDomain } from '../utils/categoryEngine';
import { InlineCategoryBadge } from './InlineCategoryBadge';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';
import { isFormStateDirty } from '../utils/modalGuardEngine';

const DEFAULT_TIMELINE_COLUMNS: TimelineColumnId[] = [
  'time',
  'category',
  'title',
  'duration',
  'notes',
  'actions',
];

const COLUMN_LABELS: Record<string, string> = {
  time: 'Time Range',
  category: 'Category',
  title: 'Activity Title',
  duration: 'Duration',
  notes: 'Notes',
  actions: 'Actions',
};

// Convert 'HH:mm' to minutes since 00:00
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const TimelineView: React.FC = () => {
  const {
    appData,
    updateAppData,
    isEditMode,
    isColumnEditMode,
    layoutConfig,
    updateLayoutConfig,
    openQuickAdd,
    openImportHub,
    setActiveTab,
    focusedTimelineDate,
    setFocusedTimelineDate,
    setSelectedCalendarDate,
    accent,
    showNotification,
  } = useVault();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingEntry, setEditingEntry] = useState<TimelineEntry | null>(null);
  const [viewStyle, setViewStyle] = useState<'visual' | 'cards' | 'table'>('visual');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const originalTimelineEntry = useMemo(() => {
    if (!editingEntry) return null;
    return (appData?.timeline || []).find((t) => t.id === editingEntry.id) || null;
  }, [editingEntry?.id, appData?.timeline]);

  const isEditTimelineDirty = useMemo(() => {
    if (!editingEntry || !originalTimelineEntry) return false;
    return isFormStateDirty(
      originalTimelineEntry as unknown as Record<string, unknown>,
      editingEntry as unknown as Record<string, unknown>
    );
  }, [editingEntry, originalTimelineEntry]);

  const {
    showConfirmClose: showEditConfirmClose,
    requestExplicitClose: requestCloseEditModal,
    handleBackdropDoubleClick: handleEditBackdropDoubleClick,
    confirmDiscardAndClose: confirmDiscardEditModal,
    cancelClose: cancelCloseEditModal,
  } = useModalGuard({
    isOpen: Boolean(editingEntry),
    isDirty: isEditTimelineDirty,
    onClose: () => setEditingEntry(null),
  });

  const timelineCategoryConfigs = useMemo(
    () => getCategoriesByDomain(appData, 'timeline'),
    [appData]
  );

  const visibleColumnsOrder: TimelineColumnId[] = DEFAULT_TIMELINE_COLUMNS;

  const getColLabel = (colId: TimelineColumnId) => COLUMN_LABELS[colId] || colId;

  const filteredEntries = useMemo(() => {
    if (!appData) return [];
    return appData.timeline.filter((entry) => {
      if (focusedTimelineDate && entry.date !== focusedTimelineDate) return false;
      if (selectedCategory === 'all') return true;
      return entry.category === selectedCategory;
    });
  }, [appData, selectedCategory, focusedTimelineDate]);

  // Group by date & sort chronologically per date
  const groupedByDate = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    if (focusedTimelineDate) {
      map.set(focusedTimelineDate, []);
    }
    for (const entry of filteredEntries) {
      const list = map.get(entry.date) || [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return Array.from(map.entries())
      .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime())
      .map(
        ([date, entries]) =>
          [
            date,
            entries.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
          ] as [string, TimelineEntry[]]
      );
  }, [filteredEntries, focusedTimelineDate]);

  const summary = useMemo(() => {
    return calculateTimelineSummary(appData?.timeline || []);
  }, [appData]);

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();

  const handleDelete = async (id: string) => {
    await updateAppData((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((e) => e.id !== id),
    }));
    showNotification('Activity removed from timeline.', 'info');
    setDeleteConfirmId(null);
  };

  const handleDuplicate = async (entry: TimelineEntry) => {
    const dupEntry: TimelineEntry = {
      ...entry,
      id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      date: todayStr,
      createdAt: Date.now(),
    };
    await updateAppData((prev) => ({
      ...prev,
      timeline: [dupEntry, ...prev.timeline],
    }));
    showNotification(`Duplicated "${entry.title}" to today's timeline!`, 'success');
  };

  const handleInstantLogFrequent = async (fe: FrequentEvent) => {
    const curH = String(now.getHours()).padStart(2, '0');
    const curM = String(now.getMinutes()).padStart(2, '0');
    const startStr = fe.startTime || `${curH}:${curM}`;

    let endStr = fe.endTime;
    if (!endStr) {
      const [sh, sm] = startStr.split(':').map(Number);
      const endTotal = (sh * 60 + sm + fe.durationMinutes) % 1440;
      const eh = String(Math.floor(endTotal / 60)).padStart(2, '0');
      const em = String(endTotal % 60).padStart(2, '0');
      endStr = `${eh}:${em}`;
    }

    const duration = fe.durationMinutes || calculateDurationMinutes(startStr, endStr);

    const newEntry: TimelineEntry = {
      id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: fe.title,
      category: fe.category,
      date: todayStr,
      startTime: startStr,
      endTime: endStr,
      durationMinutes: duration,
      notes: fe.notes,
      customFields: {},
      createdAt: Date.now(),
    };

    await updateAppData((prev) => ({
      ...prev,
      timeline: [newEntry, ...prev.timeline],
    }));

    showNotification(`⚡ Logged "${fe.title}" to today's timeline!`, 'success');
  };

  const handleSaveEditedEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    const duration = calculateDurationMinutes(editingEntry.startTime, editingEntry.endTime);
    const updated = {
      ...editingEntry,
      durationMinutes: duration,
    };

    await updateAppData((prev) => ({
      ...prev,
      timeline: prev.timeline.map((item) => (item.id === updated.id ? updated : item)),
    }));

    showNotification('Activity updated successfully!', 'success');
    setEditingEntry(null);
  };

  const getCategoryStyles = (cat: string) => {
    switch (cat) {
      case 'work':
        return {
          text: 'text-blue-400',
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          trackBg: 'bg-blue-500',
          flowBg: 'bg-blue-500/80',
          glowBorder: 'border-blue-500/50',
          dot: 'bg-blue-400',
        };
      case 'health':
        return {
          text: 'text-emerald-400',
          bg: 'bg-emerald-500/10',
          border: 'border-emerald-500/20',
          trackBg: 'bg-emerald-500',
          flowBg: 'bg-emerald-500/80',
          glowBorder: 'border-emerald-500/50',
          dot: 'bg-emerald-400',
        };
      case 'learning':
        return {
          text: 'text-purple-400',
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/20',
          trackBg: 'bg-purple-500',
          flowBg: 'bg-purple-500/80',
          glowBorder: 'border-purple-500/50',
          dot: 'bg-purple-400',
        };
      case 'creative':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-500/10',
          border: 'border-amber-500/20',
          trackBg: 'bg-amber-500',
          flowBg: 'bg-amber-500/80',
          glowBorder: 'border-amber-500/50',
          dot: 'bg-amber-400',
        };
      case 'social':
        return {
          text: 'text-pink-400',
          bg: 'bg-pink-500/10',
          border: 'border-pink-500/20',
          trackBg: 'bg-pink-500',
          flowBg: 'bg-pink-500/80',
          glowBorder: 'border-pink-500/50',
          dot: 'bg-pink-400',
        };
      case 'personal':
        return {
          text: 'text-cyan-400',
          bg: 'bg-cyan-500/10',
          border: 'border-cyan-500/20',
          trackBg: 'bg-cyan-500',
          flowBg: 'bg-cyan-500/80',
          glowBorder: 'border-cyan-500/50',
          dot: 'bg-cyan-400',
        };
      default:
        return {
          text: 'text-zinc-400',
          bg: 'bg-zinc-800',
          border: 'border-zinc-700',
          trackBg: 'bg-zinc-600',
          flowBg: 'bg-zinc-600/80',
          glowBorder: 'border-zinc-600/50',
          dot: 'bg-zinc-400',
        };
    }
  };

  const renderTimelineCell = (colId: TimelineColumnId, entry: TimelineEntry) => {
    const styles = getCategoryStyles(entry.category);
    switch (colId) {
      case 'time':
        return (
          <span className="font-mono text-zinc-300 font-medium tabular-nums">
            {entry.startTime} → {entry.endTime}
          </span>
        );
      case 'category':
        return (
          <InlineCategoryBadge
            domain="timeline"
            category={entry.category}
            size="xs"
            className={`${styles.text} ${styles.bg} ${styles.border} uppercase font-mono`}
          />
        );
      case 'title':
        return (
          <div>
            <div className="font-semibold text-white">{entry.title}</div>
            <div className="text-[10px] text-zinc-500 font-mono tabular-nums">{entry.date}</div>
          </div>
        );
      case 'duration':
        return (
          <span className="font-mono font-bold text-emerald-400 tabular-nums">
            {formatMinutes(entry.durationMinutes)}
          </span>
        );
      case 'notes':
        return <span className="text-zinc-400 line-clamp-1">{entry.notes || '—'}</span>;
      case 'actions':
        return isEditMode ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleDuplicate(entry)}
              title="Duplicate to Today"
              className="max-md:min-h-[40px] max-md:min-w-[40px] p-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 flex items-center justify-center"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setEditingEntry(entry)}
              data-testid={`mobile-edit-btn-timeline-table-${entry.id}`}
              title="Edit Activity"
              className="max-md:min-h-[40px] max-md:px-2.5 p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 flex items-center gap-1"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span className="md:hidden text-[11px] font-mono">[Edit]</span>
            </button>
            <button
              onClick={() => handleDelete(entry.id)}
              title="Delete Activity"
              className="max-md:min-h-[40px] max-md:min-w-[40px] p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-[11px] text-zinc-600 font-mono">View Mode</span>
        );
      default:
        return <span className="font-mono text-zinc-300">—</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5" style={{ color: accent.hex }} />
            Daily Visual Timeline Tracker
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Total Focus Logged: <strong className="text-zinc-200">{summary.formattedTotal}</strong>{' '}
            across {summary.totalCount} activities
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* View mode toggle (Visual Flow vs Cards vs Table) */}
          <div className="p-1 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center">
            <button
              onClick={() => setViewStyle('visual')}
              data-testid="timeline-view-visual"
              title="True Visual Timeline Flow"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewStyle === 'visual'
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
              style={viewStyle === 'visual' ? { color: accent.hex } : undefined}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Visual Flow</span>
            </button>
            <button
              onClick={() => setViewStyle('cards')}
              data-testid="timeline-view-cards"
              title="Cards Schedule View"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewStyle === 'cards'
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              onClick={() => setViewStyle('table')}
              data-testid="timeline-view-table"
              title="Table Ledger View"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewStyle === 'table'
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          <button
            type="button"
            data-testid="timeline-open-calendar-btn"
            onClick={() => {
              if (focusedTimelineDate) {
                setSelectedCalendarDate(focusedTimelineDate);
              }
              setActiveTab('calendar');
            }}
            title="Switch to Unified Month/Day Calendar View"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#000000] hover:bg-[#111319] text-cyan-300 hover:text-white border border-[#1E222B] transition-all"
          >
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open Calendar</span>
          </button>

          <button
            onClick={() => openImportHub('timeline_ocr')}
            title="Import Timeline Screenshot via Gemini Vision OCR directly into local vault"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#000000] hover:bg-[#111319] text-zinc-300 hover:text-white border border-[#1E222B] transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Timeline Screenshot OCR</span>
          </button>

          <button
            onClick={() => openQuickAdd('timeline', focusedTimelineDate || undefined)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${accent.primaryBg}`}
          >
            <Plus className="w-4 h-4" />
            <span>Add Activity</span>
          </button>
        </div>
      </div>

      {/* Focused Date Banner when navigated from Calendar Day Inspector */}
      {focusedTimelineDate && (
        <div
          data-testid="timeline-focused-date-banner"
          className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
        >
          <div className="flex items-center gap-2 text-zinc-200">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <span>
              Viewing Calendar Date:{' '}
              <strong className="text-white tabular-nums">{focusedTimelineDate}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="timeline-clear-focused-date-btn"
              onClick={() => setFocusedTimelineDate(null)}
              className="px-2.5 py-1 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-zinc-200 hover:text-white transition-colors"
            >
              Show All Dates
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCalendarDate(focusedTimelineDate);
                setActiveTab('calendar');
              }}
              className="px-2.5 py-1 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-cyan-300 hover:text-white transition-colors"
            >
              Back to Calendar
            </button>
          </div>
        </div>
      )}

      {/* Dedicated Frequent Events Quick-Click Tray */}
      {(appData?.frequentEvents || []).length > 0 && (
        <div className="p-3.5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-md">
          <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-[#1E222B]">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Frequent Events Quick-Tray</span>
            </div>
            <span className="text-[11px] text-zinc-500 font-mono">1-Click Instant Logging</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(appData?.frequentEvents || []).map((fe) => {
              const styles = getCategoryStyles(fe.category);
              return (
                <div
                  key={fe.id}
                  className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-zinc-700 shrink-0 text-xs text-zinc-200 transition-all shadow-sm"
                >
                  <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                  <span className="font-semibold">{fe.title}</span>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    ({fe.durationMinutes}m)
                  </span>
                  <button
                    onClick={() => handleInstantLogFrequent(fe)}
                    className="ml-1 p-1 px-2 rounded-lg bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[11px] font-mono font-medium flex items-center gap-1 transition-colors"
                    title={`Log "${fe.title}" immediately to today`}
                  >
                    <Zap className="w-3 h-3" />
                    <span>Log</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category Filter Pills (with Inline Category Rename support) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0 ml-1" />
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium capitalize shrink-0 transition-colors border ${
            selectedCategory === 'all'
              ? 'bg-zinc-800 text-white border-zinc-600 shadow-sm'
              : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800'
          }`}
          style={selectedCategory === 'all' ? { color: accent.hex } : undefined}
        >
          all
        </button>
        {timelineCategoryConfigs.map((catObj) => (
          <InlineCategoryBadge
            key={catObj.id}
            domain="timeline"
            category={catObj.name}
            isSelected={selectedCategory.toLowerCase() === catObj.name.toLowerCase()}
            onSelect={() => setSelectedCategory(catObj.name)}
            onRenamed={(oldName, newName) => {
              if (selectedCategory.toLowerCase() === oldName.toLowerCase()) {
                setSelectedCategory(newName);
              }
            }}
            size="sm"
            className="capitalize shrink-0"
          />
        ))}
      </div>

      {/* VIEW STYLE 1: TRUE VISUAL TIMELINE FLOW */}
      {viewStyle === 'visual' && (
        <div className="space-y-8">
          {groupedByDate.length === 0 ? (
            <div className="p-12 text-center bg-[#000000] border border-[#1E222B] rounded-2xl space-y-3">
              <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-300">No activities match your filter.</p>
              <button
                onClick={() => openQuickAdd('timeline')}
                className="text-xs text-emerald-400 hover:underline"
              >
                + Record a new activity
              </button>
            </div>
          ) : (
            groupedByDate.map(([date, entries]) => {
              const dayMinutes = entries.reduce((acc, c) => acc + (c.durationMinutes || 0), 0);
              const dayPercent = ((dayMinutes / 1440) * 100).toFixed(1);
              const isToday = date === todayStr;

              return (
                <div
                  key={date}
                  className="p-5 sm:p-6 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-xl space-y-6"
                >
                  {/* Date Header & Daily Focus Ratio */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E222B]">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 text-base font-extrabold text-white">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <span>{date}</span>
                        {isToday && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Today
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400">
                        {entries.length} {entries.length === 1 ? 'activity' : 'activities'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-white tabular-nums">
                          {formatMinutes(dayMinutes)} total
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 tabular-nums">
                          {dayPercent}% of 24h tracked
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 24-HOUR VISUAL FLOW BAR */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-zinc-400" />
                        24-Hour Visual Flow Bar
                      </span>
                      <span>00:00 - 24:00</span>
                    </div>

                    <div className="relative h-11 w-full bg-[#000000] rounded-xl border border-[#1E222B] overflow-hidden shadow-inner">
                      {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 w-px bg-zinc-800/50"
                          style={{ left: `${(h / 24) * 100}%` }}
                        />
                      ))}

                      {isToday && (
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20 shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                          style={{ left: `${(currentMinuteOfDay / 1440) * 100}%` }}
                          title={`Current Time: ${now.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}`}
                        >
                          <div className="absolute -top-1 -left-1 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                        </div>
                      )}

                      {entries.map((entry, index) => {
                        const startMin = timeToMinutes(entry.startTime);
                        const durMin =
                          entry.durationMinutes ||
                          calculateDurationMinutes(entry.startTime, entry.endTime);
                        const leftPct = (startMin / 1440) * 100;
                        const widthPct = Math.max(1.5, (durMin / 1440) * 100);
                        const styles = getCategoryStyles(entry.category);

                        const isOverlapping = entries.some(
                          (other, otherIdx) =>
                            otherIdx < index &&
                            timeToMinutes(other.startTime) < startMin + durMin &&
                            timeToMinutes(other.startTime) + (other.durationMinutes || 60) >
                              startMin
                        );

                        return (
                          <div
                            key={entry.id}
                            data-testid={`timeline-flow-block-${entry.id}`}
                            onDoubleClick={() => isEditMode && setEditingEntry(entry)}
                            className={`absolute rounded-md ${styles.flowBg} ${styles.glowBorder} border ring-1 ring-black/70 shadow-md hover:scale-y-110 hover:z-30 hover:ring-2 hover:ring-white/50 transition-all cursor-pointer flex items-center px-1.5 overflow-hidden group/block ${
                              isOverlapping ? 'top-2 bottom-0.5 opacity-95' : 'top-1 bottom-1'
                            }`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                            }}
                            title={`${entry.startTime} → ${entry.endTime} (${formatMinutes(
                              durMin
                            )}): ${entry.title} (Double-click to edit)`}
                          >
                            <span className="text-[10px] font-bold text-white truncate drop-shadow opacity-90 group-hover/block:opacity-100">
                              {entry.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between text-[10px] font-mono text-zinc-500 px-0.5">
                      <span>12 AM</span>
                      <span>3 AM</span>
                      <span>6 AM</span>
                      <span>9 AM</span>
                      <span>12 PM</span>
                      <span>3 PM</span>
                      <span>6 PM</span>
                      <span>9 PM</span>
                      <span>12 AM</span>
                    </div>
                  </div>

                  {/* CHRONOLOGICAL VERTICAL TRACK */}
                  <div className="pt-4 border-t border-zinc-800/70 space-y-1">
                    <div className="text-xs font-bold text-zinc-300 flex items-center gap-2 mb-4">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>Chronological Activity Flow &amp; Duration Weights</span>
                    </div>

                    <div className="relative pl-2 sm:pl-4">
                      <div className="absolute top-4 bottom-4 left-[96px] sm:left-[140px] w-0.5 bg-gradient-to-b from-zinc-700 via-zinc-800 to-zinc-900" />

                      {entries.map((entry, index) => {
                        const styles = getCategoryStyles(entry.category);
                        const dur =
                          entry.durationMinutes ||
                          calculateDurationMinutes(entry.startTime, entry.endTime);

                        const prevEntry = index > 0 ? entries[index - 1] : null;
                        const gapMinutes = prevEntry
                          ? timeToMinutes(entry.startTime) - timeToMinutes(prevEntry.endTime)
                          : 0;

                        return (
                          <React.Fragment key={entry.id}>
                            {gapMinutes >= 20 && (
                              <div className="flex items-center my-3 relative z-10">
                                <div className="w-[88px] sm:w-[130px] pr-3 text-right" />
                                <div className="w-5 flex items-center justify-center">
                                  <div className="w-2 h-2 rounded-full bg-zinc-800 border border-zinc-700" />
                                </div>
                                <div className="ml-3 sm:ml-4 py-1 px-3 rounded-full bg-zinc-900/60 border border-zinc-800/80 text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
                                  <span>☕</span>
                                  <span>{formatMinutes(gapMinutes)} transition / free flow</span>
                                </div>
                              </div>
                            )}

                            <div className="flex items-start mb-5 relative group">
                              <div className="w-[88px] sm:w-[130px] pr-3 text-right shrink-0 pt-2 space-y-1">
                                <div className="text-xs font-mono font-extrabold text-white tabular-nums">
                                  {entry.startTime}
                                </div>
                                <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
                                  → {entry.endTime}
                                </div>
                                <div className="text-[11px] font-mono font-bold text-emerald-400 tabular-nums">
                                  {formatMinutes(dur)}
                                </div>
                                <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                                  <div
                                    className={`h-full ${styles.trackBg} rounded-full`}
                                    style={{ width: `${Math.min(100, (dur / 180) * 100)}%` }}
                                  />
                                </div>
                              </div>

                              <div className="w-5 flex items-center justify-center shrink-0 pt-2 relative z-10">
                                <div
                                  className={`w-4 h-4 rounded-full bg-[#000000] border-2 ${styles.glowBorder} flex items-center justify-center shadow-lg group-hover:scale-125 transition-transform`}
                                >
                                  <div className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                                </div>
                              </div>

                              <div
                                data-testid={`timeline-card-${entry.id}`}
                                onDoubleClick={() => isEditMode && setEditingEntry(entry)}
                                title="Double-click card or click Edit icon to edit activity"
                                className={`flex-1 ml-3 sm:ml-4 p-4 rounded-2xl bg-[#000000] border border-[#1E222B] hover:border-zinc-700/80 transition-all shadow-lg relative group/card`}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="text-sm font-bold text-white group-hover/card:text-emerald-300 transition-colors">
                                      {entry.title}
                                    </h4>
                                    <InlineCategoryBadge
                                      domain="timeline"
                                      category={entry.category}
                                      size="xs"
                                      className={`font-mono uppercase ${styles.text} ${styles.bg} ${styles.border}`}
                                    />
                                  </div>

                                  <div className="flex items-center gap-1 max-md:opacity-100 opacity-80 group-hover/card:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => handleDuplicate(entry)}
                                      title="Duplicate to Today"
                                      className="max-md:min-h-[40px] max-md:min-w-[40px] p-1 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 text-xs transition-colors flex items-center justify-center"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                    </button>

                                    {isEditMode && (
                                      <>
                                        <button
                                          onClick={() => setEditingEntry(entry)}
                                          data-testid={`mobile-edit-btn-timeline-${entry.id}`}
                                          title="Edit Activity"
                                          className="max-md:min-h-[40px] max-md:px-2.5 p-1 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 text-xs transition-colors flex items-center gap-1"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                          <span className="md:hidden text-[11px] font-mono">[Edit]</span>
                                        </button>
                                        <button
                                          onClick={() => setDeleteConfirmId(entry.id)}
                                          title="Delete Activity"
                                          className="max-md:min-h-[40px] max-md:min-w-[40px] p-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs transition-colors flex items-center justify-center"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {entry.notes && (
                                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                                    {entry.notes}
                                  </p>
                                )}

                                {deleteConfirmId === entry.id && (
                                  <div className="mt-3 p-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-center justify-between text-xs text-rose-200">
                                    <span>Delete this activity?</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => handleDelete(entry.id)}
                                        className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
                                      >
                                        Delete
                                      </button>
                                      <button
                                        onClick={() => setDeleteConfirmId(null)}
                                        className="px-2 py-1 text-zinc-400 hover:text-white"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW STYLE 2: CARDS SCHEDULE */}
      {viewStyle === 'cards' && (
        <div className="space-y-6">
          {groupedByDate.length === 0 ? (
            <div className="p-12 text-center bg-[#000000] border border-[#1E222B] rounded-2xl space-y-3">
              <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-300">No activities match your filter.</p>
              <button
                onClick={() => openQuickAdd('timeline')}
                className="text-xs text-emerald-400 hover:underline"
              >
                + Create a new timeline entry
              </button>
            </div>
          ) : (
            groupedByDate.map(([date, entries]) => {
              const dayMinutes = entries.reduce((acc, c) => acc + (c.durationMinutes || 0), 0);
              return (
                <div key={date} className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-[#1E222B]">
                    <div className="flex items-center gap-2 text-sm font-bold text-zinc-200">
                      <Calendar className="w-4 h-4 text-zinc-400" />
                      <span>{date}</span>
                    </div>
                    <span className="text-xs font-mono font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {formatMinutes(dayMinutes)} total
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {entries.map((entry) => {
                      const styles = getCategoryStyles(entry.category);
                      return (
                        <div
                          key={entry.id}
                          onDoubleClick={() => isEditMode && setEditingEntry(entry)}
                          title="Double-click card or click Edit icon to edit activity"
                          className="p-4 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-zinc-700/80 transition-all flex flex-col justify-between gap-3 shadow-md"
                        >
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <InlineCategoryBadge
                                domain="timeline"
                                category={entry.category}
                                size="xs"
                                className={`font-mono uppercase ${styles.text} ${styles.bg} ${styles.border}`}
                              />
                              <span className="text-xs font-mono font-bold text-emerald-400">
                                {formatMinutes(entry.durationMinutes)}
                              </span>
                            </div>
                            <h4 className="text-sm font-semibold text-white">{entry.title}</h4>
                            {entry.notes && (
                              <p className="text-xs text-zinc-400 line-clamp-2">{entry.notes}</p>
                            )}
                          </div>

                          <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400">
                            <span>
                              {entry.startTime} → {entry.endTime}
                            </span>
                            {isEditMode && (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleDuplicate(entry)}
                                  title="Duplicate"
                                  className="max-md:min-h-[40px] max-md:min-w-[40px] p-1 text-zinc-400 hover:text-white flex items-center justify-center"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingEntry(entry)}
                                  data-testid={`mobile-edit-btn-timeline-card-${entry.id}`}
                                  title="Edit"
                                  className="max-md:min-h-[40px] max-md:px-2.5 p-1 text-zinc-300 hover:text-white flex items-center gap-1"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span className="md:hidden text-[11px] font-mono">[Edit]</span>
                                </button>
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  title="Delete"
                                  className="max-md:min-h-[40px] max-md:min-w-[40px] p-1 text-rose-400 hover:text-rose-300 flex items-center justify-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW STYLE 3: FORMATTED TABLE LEDGER */}
      {viewStyle === 'table' && (
        <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg overflow-x-auto">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1E222B]">
            <h3 className="text-sm font-bold text-white">Formatted Timeline Ledger</h3>
            <span className="text-xs text-zinc-400 font-mono">
              Showing {filteredEntries.length} activities · {visibleColumnsOrder.length} visible
              columns
            </span>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500 space-y-2">
              <p>No timeline activities match your filter.</p>
              <button
                onClick={() => openQuickAdd('timeline')}
                className="text-xs text-emerald-400 hover:underline"
              >
                + Record a new activity
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#1E222B] text-xs uppercase font-mono text-zinc-400">
                  {visibleColumnsOrder.map((colId) => (
                    <th key={colId} className="pb-3 px-3 font-semibold">
                      {getColLabel(colId)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E222B]">
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry.id}
                    data-testid={`timeline-table-row-${entry.id}`}
                    onDoubleClick={() => isEditMode && setEditingEntry(entry)}
                    title="Double-click row or click Edit icon to edit activity"
                    className="hover:bg-zinc-900/40 transition-colors"
                  >
                    {visibleColumnsOrder.map((colId) => (
                      <td key={colId} className="py-3 px-3 align-middle">
                        {renderTimelineCell(colId, entry)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div
          onDoubleClick={handleEditBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6 relative"
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                Edit Activity
              </h3>
              <button
                type="button"
                onClick={requestCloseEditModal}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnsavedChangesBanner
              isOpen={showEditConfirmClose}
              onKeepEditing={cancelCloseEditModal}
              onDiscardAndClose={confirmDiscardEditModal}
            />

            <form onSubmit={handleSaveEditedEntry} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingEntry.title}
                  onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Category</label>
                  <select
                    value={editingEntry.category}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, category: e.target.value as any })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  >
                    {timelineCategoryConfigs.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={editingEntry.date}
                    onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={editingEntry.startTime}
                    onChange={(e) =>
                      setEditingEntry({ ...editingEntry, startTime: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={editingEntry.endTime}
                    onChange={(e) => setEditingEntry({ ...editingEntry, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editingEntry.notes || ''}
                  onChange={(e) => setEditingEntry({ ...editingEntry, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={requestCloseEditModal}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-1.5 rounded-lg font-semibold text-white ${accent.primaryBg}`}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
