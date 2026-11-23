import React, { useState, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import { FrequentEvent, TimelineCategory, TimelineEntry } from '../types';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Zap,
  Filter,
  Layers,
  BookOpen,
  Target,
  Wallet,
  Compass,
  Edit2,
  Trash2,
  ArrowUpRight,
  X,
  Sparkles,
  CheckCircle2,
  CalendarRange,
} from 'lucide-react';
import {
  buildCalendarMonthGrid,
  CalendarOverlayToggles,
  CalendarSpanSegment,
  computeDayVisualFlowBlocks,
  createTimelineEntryForCalendarDate,
  DEFAULT_CALENDAR_OVERLAYS,
  getCalendarDayInspectorData,
} from '../utils/calendarEngine';
import { calculateDurationMinutes, formatMinutes } from '../utils/calculations';
import { getCategoriesByDomain } from '../utils/categoryEngine';
import { InlineCategoryBadge } from './InlineCategoryBadge';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';
import { isFormStateDirty } from '../utils/modalGuardEngine';
import { TimelineView } from './TimelineView';

const WEEKDAY_HEADERS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getCategoryStyleMeta(cat: string): {
  text: string;
  border: string;
  dot: string;
  barBg: string;
  hex: string;
} {
  switch ((cat || '').toLowerCase()) {
    case 'work':
      return {
        text: 'text-blue-400',
        border: 'border-blue-500/40',
        dot: 'bg-blue-400',
        barBg: 'bg-blue-500',
        hex: '#3b82f6',
      };
    case 'health':
      return {
        text: 'text-emerald-400',
        border: 'border-emerald-500/40',
        dot: 'bg-emerald-400',
        barBg: 'bg-emerald-500',
        hex: '#10b981',
      };
    case 'learning':
      return {
        text: 'text-purple-400',
        border: 'border-purple-500/40',
        dot: 'bg-purple-400',
        barBg: 'bg-purple-500',
        hex: '#a855f7',
      };
    case 'creative':
      return {
        text: 'text-amber-400',
        border: 'border-amber-500/40',
        dot: 'bg-amber-400',
        barBg: 'bg-amber-500',
        hex: '#f59e0b',
      };
    case 'social':
      return {
        text: 'text-pink-400',
        border: 'border-pink-500/40',
        dot: 'bg-pink-400',
        barBg: 'bg-pink-500',
        hex: '#ec4899',
      };
    case 'personal':
      return {
        text: 'text-cyan-400',
        border: 'border-cyan-500/40',
        dot: 'bg-cyan-400',
        barBg: 'bg-cyan-500',
        hex: '#06b6d4',
      };
    default:
      return {
        text: 'text-zinc-300',
        border: 'border-[#232732]',
        dot: 'bg-zinc-400',
        barBg: 'bg-zinc-500',
        hex: '#a1a1aa',
      };
  }
}

interface EventModalFormState {
  id?: string;
  title: string;
  category: TimelineCategory;
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  useCustomMultiDayDuration: boolean;
  notes: string;
}

export const CalendarView: React.FC = () => {
  const {
    appData,
    updateAppData,
    isEditMode,
    accent,
    selectedCalendarDate,
    setSelectedCalendarDate,
    setFocusedTimelineDate,
    setActiveTab,
    openImportHub,
    showNotification,
  } = useVault();

  const todayStr = new Date().toISOString().slice(0, 10);
  const activeDate = selectedCalendarDate || todayStr;

  const initialDateObj = useMemo(() => {
    const parsed = new Date(`${activeDate}T12:00:00Z`);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  }, []);

  const [viewYear, setViewYear] = useState<number>(initialDateObj.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDateObj.getUTCMonth());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [overlays, setOverlays] = useState<CalendarOverlayToggles>(DEFAULT_CALENDAR_OVERLAYS);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [showEmbeddedTimeline, setShowEmbeddedTimeline] = useState<boolean>(false);
  const [justLoggedTemplateId, setJustLoggedTemplateId] = useState<string | null>(null);

  // Event Add/Edit Modal State (explicit Save/Cancel guard)
  const [isEventModalOpen, setIsEventModalOpen] = useState<boolean>(false);
  const [initialModalSnapshot, setInitialModalSnapshot] = useState<EventModalFormState | null>(
    null
  );
  const [eventForm, setEventForm] = useState<EventModalFormState>({
    title: '',
    category: 'work',
    date: activeDate,
    startTime: '09:00',
    endTime: '10:30',
    durationMinutes: 90,
    useCustomMultiDayDuration: false,
    notes: '',
  });

  const timelineCategoryConfigs = useMemo(
    () => getCategoriesByDomain(appData, 'timeline'),
    [appData]
  );

  const monthCells = useMemo(
    () =>
      buildCalendarMonthGrid(
        viewYear,
        viewMonth,
        appData,
        selectedCategory,
        overlays,
        todayStr
      ),
    [viewYear, viewMonth, appData, selectedCategory, overlays, todayStr]
  );

  const inspectorData = useMemo(
    () =>
      getCalendarDayInspectorData(
        activeDate,
        appData,
        selectedCategory,
        overlays,
        todayStr
      ),
    [activeDate, appData, selectedCategory, overlays, todayStr]
  );

  const visualFlowBlocks = useMemo(
    () => computeDayVisualFlowBlocks(inspectorData.segments),
    [inspectorData.segments]
  );

  const monthStats = useMemo(() => {
    const currentMonthCells = monthCells.filter((c) => c.isCurrentMonth);
    const totalMinutes = currentMonthCells.reduce((acc, c) => acc + c.totalFocusMinutes, 0);
    const activeDays = currentMonthCells.filter((c) => c.segments.length > 0).length;
    const totalSegments = currentMonthCells.reduce((acc, c) => acc + c.segments.length, 0);
    const multiDayCount = new Set(
      currentMonthCells
        .flatMap((c) => c.segments)
        .filter((s) => s.isMultiDay)
        .map((s) => s.entry.id)
    ).size;
    return {
      totalMinutes,
      activeDays,
      totalSegments,
      multiDayCount,
    };
  }, [monthCells]);

  // Modal dirty check & guard
  const isEventModalDirty = useMemo(() => {
    if (!isEventModalOpen || !initialModalSnapshot) return false;
    return isFormStateDirty(
      initialModalSnapshot as unknown as Record<string, unknown>,
      eventForm as unknown as Record<string, unknown>
    );
  }, [isEventModalOpen, initialModalSnapshot, eventForm]);

  const {
    showConfirmClose,
    requestExplicitClose,
    handleBackdropDoubleClick,
    confirmDiscardAndClose,
    cancelClose,
  } = useModalGuard({
    isOpen: isEventModalOpen,
    isDirty: isEventModalDirty,
    onClose: () => {
      setIsEventModalOpen(false);
      setInitialModalSnapshot(null);
    },
  });

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    const nowObj = new Date(`${todayStr}T12:00:00Z`);
    setViewYear(nowObj.getUTCFullYear());
    setViewMonth(nowObj.getUTCMonth());
    setSelectedCalendarDate(todayStr);
    setIsInspectorOpen(true);
  };

  const handleSelectDateCell = (isoDate: string, monthOffset: -1 | 0 | 1) => {
    setSelectedCalendarDate(isoDate);
    setIsInspectorOpen(true);
    if (monthOffset !== 0) {
      const dObj = new Date(`${isoDate}T12:00:00Z`);
      setViewYear(dObj.getUTCFullYear());
      setViewMonth(dObj.getUTCMonth());
    }
  };

  const handleOpenInDailyTimeline = (isoDate: string) => {
    setFocusedTimelineDate(isoDate);
    setShowEmbeddedTimeline((prev) => !prev);
  };

  const handleInstantLogFrequentToSelectedDate = async (fe: FrequentEvent) => {
    const newEntry = createTimelineEntryForCalendarDate(fe, activeDate);
    await updateAppData((prev) => ({
      ...prev,
      timeline: [newEntry, ...prev.timeline],
    }));
    setJustLoggedTemplateId(fe.id);
    setTimeout(() => {
      setJustLoggedTemplateId((curr) => (curr === fe.id ? null : curr));
    }, 1500);
    showNotification(`⚡ Logged "${fe.title}" onto ${activeDate} (Synced with Timeline)`, 'success');
  };

  const handleOpenAddEventModal = (targetDate: string = activeDate) => {
    const initial: EventModalFormState = {
      title: '',
      category: selectedCategory !== 'all' ? selectedCategory : 'work',
      date: targetDate,
      startTime: '09:00',
      endTime: '10:30',
      durationMinutes: 90,
      useCustomMultiDayDuration: false,
      notes: '',
    };
    setEventForm(initial);
    setInitialModalSnapshot(initial);
    setIsEventModalOpen(true);
  };

  const handleOpenEditEventModal = (entry: TimelineEntry) => {
    const standardDur = calculateDurationMinutes(entry.startTime, entry.endTime);
    const isMultiDayDur = entry.durationMinutes > 1440 || entry.durationMinutes !== standardDur;
    const initial: EventModalFormState = {
      id: entry.id,
      title: entry.title,
      category: entry.category,
      date: entry.date,
      startTime: entry.startTime,
      endTime: entry.endTime,
      durationMinutes: entry.durationMinutes || standardDur || 60,
      useCustomMultiDayDuration: isMultiDayDur,
      notes: entry.notes || '',
    };
    setEventForm(initial);
    setInitialModalSnapshot(initial);
    setIsEventModalOpen(true);
  };

  const handleSaveEventModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title.trim()) return;

    const computedDur = calculateDurationMinutes(eventForm.startTime, eventForm.endTime) || 60;
    const finalDuration = eventForm.useCustomMultiDayDuration
      ? Math.max(5, Math.round(Number(eventForm.durationMinutes) || computedDur))
      : computedDur;

    if (eventForm.id) {
      await updateAppData((prev) => ({
        ...prev,
        timeline: prev.timeline.map((item) =>
          item.id === eventForm.id
            ? {
                ...item,
                title: eventForm.title.trim(),
                category: eventForm.category,
                date: eventForm.date,
                startTime: eventForm.startTime,
                endTime: eventForm.endTime,
                durationMinutes: finalDuration,
                notes: eventForm.notes.trim() || undefined,
              }
            : item
        ),
      }));
      showNotification(`Updated "${eventForm.title.trim()}" across Calendar & Timeline`, 'success');
    } else {
      const newEntry: TimelineEntry = {
        id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: eventForm.title.trim(),
        category: eventForm.category,
        date: eventForm.date,
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        durationMinutes: finalDuration,
        notes: eventForm.notes.trim() || undefined,
        customFields: {},
        createdAt: Date.now(),
      };
      await updateAppData((prev) => ({
        ...prev,
        timeline: [newEntry, ...prev.timeline],
      }));
      setSelectedCalendarDate(eventForm.date);
      showNotification(`Scheduled "${newEntry.title}" on ${newEntry.date}`, 'success');
    }

    setIsEventModalOpen(false);
    setInitialModalSnapshot(null);
  };

  const handleDeleteTimelineEntry = async (entry: TimelineEntry) => {
    await updateAppData((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((t) => t.id !== entry.id),
    }));
    showNotification(`Removed "${entry.title}" from Calendar & Timeline`, 'info');
  };

  const toggleOverlay = (key: keyof CalendarOverlayToggles) => {
    setOverlays((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const now = new Date();
  const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();

  return (
    <div className="space-y-5 bg-[#000000]" data-testid="calendar-view-container">
      {/* TOP HEADER BAR: Title, Month Navigation, & Primary Actions */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#000000] border border-[#1E222B] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <CalendarIcon className="w-5 h-5 shrink-0" style={{ color: accent.hex }} />
            <h2 className="text-xl font-extrabold text-white tracking-tight">
              Calendar &amp; Daily Timeline
            </h2>
          </div>
          <p className="text-xs text-zinc-400 font-mono tabular-nums">
            {MONTH_NAMES[viewMonth]} {viewYear} •{' '}
            <strong className="text-zinc-200">{formatMinutes(monthStats.totalMinutes)}</strong>{' '}
            logged across <strong className="text-zinc-200">{monthStats.activeDays}</strong> active
            days ({monthStats.totalSegments} blocks
            {monthStats.multiDayCount > 0 ? ` · ${monthStats.multiDayCount} multi-day` : ''})
          </p>
        </div>

        {/* Month Navigation + Actions */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center bg-[#000000] border border-[#1E222B] rounded-xl p-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              data-testid="calendar-prev-month-btn"
              title="Previous Month"
              aria-label="Previous Month"
              className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-[#111319] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              data-testid="calendar-current-month-label"
              className="px-3 text-xs font-mono font-bold text-white tabular-nums min-w-[130px] text-center"
            >
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              data-testid="calendar-next-month-btn"
              title="Next Month"
              aria-label="Next Month"
              className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-[#111319] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleJumpToToday}
            data-testid="calendar-today-btn"
            className="px-3 py-2 rounded-xl text-xs font-mono font-semibold bg-[#000000] hover:bg-[#111319] text-zinc-200 hover:text-white border border-[#1E222B] transition-colors"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => openImportHub('timeline_ocr')}
            data-testid="calendar-ocr-import-btn"
            title="Import Timeline Screenshot via Gemini Vision OCR"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#000000] hover:bg-[#111319] text-zinc-300 hover:text-white border border-[#1E222B] transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Timeline OCR</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddEventModal(activeDate)}
            data-testid="calendar-add-event-btn"
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${accent.primaryBg}`}
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Activity</span>
          </button>
        </div>
      </div>

      {/* INTEGRATED FREQUENT EVENTS QUICK-TRAY (1-Click Log onto Selected Calendar Date) */}
      {(appData?.frequentEvents || []).length > 0 && (
        <div
          data-testid="calendar-frequent-events-tray"
          className="p-3.5 rounded-2xl bg-[#000000] border border-[#1E222B]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 pb-2 border-b border-[#1E222B]">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Frequent Events Quick-Tray</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono tabular-nums bg-[#000000] border border-[#1E222B] text-amber-300">
                Target Date: {activeDate}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              1-Click logs template directly onto selected date ({activeDate})
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(appData?.frequentEvents || []).map((fe) => {
              const styles = getCategoryStyleMeta(fe.category);
              const isJustLogged = justLoggedTemplateId === fe.id;
              return (
                <div
                  key={fe.id}
                  className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-[#2E3442] shrink-0 text-xs text-zinc-200 transition-all"
                >
                  <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                  <span className="font-semibold">{fe.title}</span>
                  <span className="text-[11px] text-zinc-400 font-mono tabular-nums">
                    ({fe.durationMinutes}m)
                  </span>
                  <button
                    type="button"
                    data-testid={`calendar-frequent-log-${fe.id}`}
                    onClick={() => handleInstantLogFrequentToSelectedDate(fe)}
                    title={`Instant 1-Click Log "${fe.title}" onto ${activeDate}`}
                    className={`ml-1 px-2 py-1 rounded-lg border text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors ${
                      isJustLogged
                        ? 'bg-emerald-500 text-black border-emerald-400'
                        : 'bg-[#000000] hover:bg-[#111319] text-amber-300 border-[#1E222B]'
                    }`}
                  >
                    {isJustLogged ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Logged</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3 text-amber-400" />
                        <span>Log</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER & CROSS-MODULE OVERLAY CONTROLS BAR */}
      <div className="p-3.5 rounded-2xl bg-[#000000] border border-[#1E222B] flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        {/* Left: Category Layer Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 xl:pb-0 scrollbar-none">
          <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0 mr-1" />
          <button
            type="button"
            data-testid="calendar-filter-all"
            onClick={() => setSelectedCategory('all')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize shrink-0 transition-colors border bg-[#000000] ${
              selectedCategory === 'all'
                ? 'text-white border-[#2E3442] font-semibold'
                : 'text-zinc-400 border-[#1E222B] hover:text-zinc-200'
            }`}
            style={
              selectedCategory === 'all'
                ? { color: accent.hex, borderColor: accent.hex }
                : undefined
            }
          >
            All
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

        {/* Right: Cross-Module Overlay Toggles */}
        <div className="flex items-center flex-wrap gap-1.5 pt-2 xl:pt-0 border-t xl:border-t-0 border-[#1E222B]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mr-1">
            Overlays:
          </span>
          <button
            type="button"
            data-testid="calendar-overlay-notes"
            onClick={() => toggleOverlay('showNotes')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border bg-[#000000] transition-colors ${
              overlays.showNotes
                ? 'text-amber-300 border-amber-500/50'
                : 'text-zinc-500 border-[#1E222B] hover:text-zinc-300'
            }`}
          >
            <BookOpen className="w-3 h-3 text-amber-400" />
            <span>Daily Notes</span>
          </button>

          <button
            type="button"
            data-testid="calendar-overlay-goals"
            onClick={() => toggleOverlay('showGoals')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border bg-[#000000] transition-colors ${
              overlays.showGoals
                ? 'text-emerald-300 border-emerald-500/50'
                : 'text-zinc-500 border-[#1E222B] hover:text-zinc-300'
            }`}
          >
            <Target className="w-3 h-3 text-emerald-400" />
            <span>Strategic Goals</span>
          </button>

          <button
            type="button"
            data-testid="calendar-overlay-funds"
            onClick={() => toggleOverlay('showFunds')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border bg-[#000000] transition-colors ${
              overlays.showFunds
                ? 'text-lime-300 border-lime-500/50'
                : 'text-zinc-500 border-[#1E222B] hover:text-zinc-300'
            }`}
          >
            <Wallet className="w-3 h-3 text-lime-400" />
            <span>Funds Totals</span>
          </button>

          <button
            type="button"
            data-testid="calendar-overlay-distances"
            onClick={() => toggleOverlay('showDistances')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border bg-[#000000] transition-colors ${
              overlays.showDistances
                ? 'text-sky-300 border-sky-500/50'
                : 'text-zinc-500 border-[#1E222B] hover:text-zinc-300'
            }`}
          >
            <Compass className="w-3 h-3 text-sky-400" />
            <span>Distance / OCR</span>
          </button>
        </div>
      </div>

      {/* MAIN WORKSPACE SPLIT: 7-COLUMN MONTH GRID + DAY INSPECTOR DRAWER */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT/MAIN: 7-COLUMN CALENDAR GRID (Flat #000000 cells + 1px #1E222B structural borders) */}
        <div
          className={`${
            isInspectorOpen ? 'xl:col-span-8' : 'xl:col-span-12'
          } rounded-2xl bg-[#000000] border border-[#1E222B] overflow-hidden`}
        >
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-[#1E222B] bg-[#000000]">
            {WEEKDAY_HEADERS.map((dayName) => (
              <div
                key={dayName}
                className="py-2.5 px-2 text-center text-[11px] font-mono font-bold tracking-wider text-zinc-400 border-r last:border-r-0 border-[#1E222B] bg-[#000000]"
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* 42-Cell 6-Week Matrix */}
          <div className="grid grid-cols-7 bg-[#000000]" data-testid="calendar-month-grid">
            {monthCells.map((cell) => {
              const isSelected = cell.date === activeDate;
              const visibleSegments = cell.segments.slice(0, 3);
              const overflowCount = Math.max(0, cell.segments.length - visibleSegments.length);

              return (
                <div
                  key={cell.date}
                  role="button"
                  tabIndex={0}
                  data-testid={`calendar-cell-${cell.date}`}
                  data-selected={String(isSelected)}
                  onClick={() => handleSelectDateCell(cell.date, cell.monthOffset)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectDateCell(cell.date, cell.monthOffset);
                    }
                  }}
                  className={`min-h-[118px] sm:min-h-[134px] p-1.5 sm:p-2 bg-[#000000] border-b border-r border-[#1E222B] flex flex-col justify-between text-left transition-all cursor-pointer select-none focus:outline-none ${
                    !cell.isCurrentMonth ? 'opacity-45' : ''
                  }`}
                  style={
                    isSelected
                      ? {
                          boxShadow: `inset 0 0 0 1.5px ${accent.hex}`,
                        }
                      : undefined
                  }
                >
                  {/* Top Row: Day Number + Total Focus Duration */}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1">
                      <span
                        className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-xs font-mono font-bold tabular-nums bg-[#000000] ${
                          cell.isToday
                            ? 'border text-white'
                            : isSelected
                            ? 'text-white'
                            : 'text-zinc-300'
                        }`}
                        style={
                          cell.isToday
                            ? { borderColor: accent.hex, color: accent.hex }
                            : undefined
                        }
                      >
                        {cell.dayOfMonth}
                      </span>
                      {cell.isToday && (
                        <span className="hidden sm:inline text-[9px] font-mono uppercase tracking-wider text-emerald-400">
                          TODAY
                        </span>
                      )}
                    </div>

                    {cell.totalFocusMinutes > 0 && (
                      <span className="text-[10px] font-mono tabular-nums text-zinc-400">
                        {formatMinutes(cell.totalFocusMinutes)}
                      </span>
                    )}
                  </div>

                  {/* Middle: Activity Blocks & Multi-Day Spanning Bars */}
                  <div className="flex-1 space-y-1 my-0.5 overflow-hidden">
                    {visibleSegments.map((seg) => {
                      const styleMeta = getCategoryStyleMeta(seg.entry.category);
                      const spanBadge =
                        seg.spanPosition === 'start'
                          ? `D1/${seg.spanTotalDays} →`
                          : seg.spanPosition === 'middle'
                          ? `↔ D${seg.spanDayIndex}/${seg.spanTotalDays}`
                          : seg.spanPosition === 'end'
                          ? `→ D${seg.spanDayIndex}/${seg.spanTotalDays}`
                          : null;

                      return (
                        <div
                          key={seg.segmentId}
                          data-testid={`calendar-segment-${seg.segmentId}`}
                          title={`${seg.displayStartTime} → ${seg.displayEndTime} (${formatMinutes(
                            seg.segmentDurationMinutes
                          )}) • ${seg.entry.title}${
                            seg.isMultiDay
                              ? ` [Multi-Day Span: Day ${seg.spanDayIndex} of ${seg.spanTotalDays}]`
                              : ''
                          }`}
                          className={`px-1.5 py-0.5 bg-[#000000] border ${styleMeta.border} text-[10px] font-mono flex items-center justify-between gap-1 truncate ${
                            seg.spanPosition === 'start'
                              ? 'rounded-l-md rounded-r-none border-r-dashed'
                              : seg.spanPosition === 'middle'
                              ? 'rounded-none border-x-dashed'
                              : seg.spanPosition === 'end'
                              ? 'rounded-r-md rounded-l-none border-l-dashed'
                              : 'rounded-md'
                          }`}
                        >
                          <div className="flex items-center gap-1 min-w-0 truncate">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${styleMeta.dot}`} />
                            <span className="text-zinc-100 font-sans font-medium truncate">
                              {seg.entry.title}
                            </span>
                          </div>
                          <span className={`shrink-0 tabular-nums text-[9px] ${styleMeta.text}`}>
                            {spanBadge || seg.displayStartTime}
                          </span>
                        </div>
                      );
                    })}

                    {overflowCount > 0 && (
                      <div className="text-[10px] font-mono tabular-nums text-zinc-400 pl-1">
                        +{overflowCount} more
                      </div>
                    )}
                  </div>

                  {/* Bottom: Cross-Module Overlay Indicators */}
                  {(cell.notes.length > 0 ||
                    cell.goalsDue.length > 0 ||
                    cell.funds.length > 0 ||
                    cell.distances.length > 0) && (
                    <div className="pt-1 mt-1 border-t border-[#1E222B] flex items-center flex-wrap gap-1 font-mono text-[9px] tabular-nums">
                      {cell.notes.length > 0 && (
                        <span
                          title={`${cell.notes.length} Daily Note(s): ${cell.notes
                            .map((n) => n.title)
                            .join(', ')}`}
                          className="px-1 py-0.2 rounded bg-[#000000] border border-[#1E222B] text-amber-300 inline-flex items-center gap-0.5"
                        >
                          <BookOpen className="w-2.5 h-2.5 text-amber-400" />
                          <span>{cell.notes.length}</span>
                        </span>
                      )}

                      {cell.goalsDue.length > 0 && (
                        <span
                          title={`${cell.goalsDue.length} Strategic Goal(s) Due: ${cell.goalsDue
                            .map((g) => g.title)
                            .join(', ')}`}
                          className="px-1 py-0.2 rounded bg-[#000000] border border-[#1E222B] text-emerald-300 inline-flex items-center gap-0.5"
                        >
                          <Target className="w-2.5 h-2.5 text-emerald-400" />
                          <span>{cell.goalsDue.length}</span>
                        </span>
                      )}

                      {cell.funds.length > 0 && (
                        <span
                          title={`Net Funds on ${cell.date}: ${
                            cell.netFundsAmount >= 0 ? '+' : '-'
                          }$${Math.abs(cell.netFundsAmount).toFixed(2)} (${
                            cell.funds.length
                          } txns)`}
                          className={`px-1 py-0.2 rounded bg-[#000000] border border-[#1E222B] ${
                            cell.netFundsAmount >= 0 ? 'text-lime-300' : 'text-rose-300'
                          }`}
                        >
                          {cell.netFundsAmount >= 0 ? '+' : '-'}$
                          {Math.abs(cell.netFundsAmount).toFixed(0)}
                        </span>
                      )}

                      {cell.distances.length > 0 && (
                        <span
                          title={`Distance Logged on ${cell.date}: ${cell.totalDistanceMiles} mi`}
                          className="px-1 py-0.2 rounded bg-[#000000] border border-[#1E222B] text-sky-300 inline-flex items-center gap-0.5"
                        >
                          <Compass className="w-2.5 h-2.5 text-sky-400" />
                          <span>{cell.totalDistanceMiles}m</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: DAY INSPECTOR DRAWER (24-Hour Visual Flow Bar + Chronological Track + Cross-Module Overlays) */}
        {isInspectorOpen && (
          <aside
            data-testid="calendar-day-inspector"
            className="xl:col-span-4 rounded-2xl bg-[#000000] border border-[#1E222B] p-4 sm:p-5 space-y-5 sticky top-20"
          >
            {/* Inspector Header */}
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#1E222B]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Day Inspector
                  </span>
                  {inspectorData.isToday && (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-[#000000] border border-emerald-500/40 text-emerald-400">
                      Today
                    </span>
                  )}
                </div>
                <h3
                  data-testid="calendar-inspector-date-heading"
                  className="text-lg font-extrabold text-white font-mono tabular-nums mt-0.5"
                >
                  {inspectorData.date}
                </h3>
                <p className="text-xs text-zinc-400 font-mono tabular-nums mt-0.5">
                  {inspectorData.segments.length} activities •{' '}
                  <strong className="text-zinc-200">
                    {formatMinutes(inspectorData.totalFocusMinutes)}
                  </strong>{' '}
                  ({((inspectorData.totalFocusMinutes / 1440) * 100).toFixed(1)}% of 24h)
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="calendar-open-in-timeline-btn"
                  onClick={() => handleOpenInDailyTimeline(inspectorData.date)}
                  title="Toggle full Daily Timeline view for this date inside Calendar"
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-xs font-mono font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  <span>{showEmbeddedTimeline ? 'Hide Daily Timeline' : 'Daily Timeline'}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 24-HOUR VISUAL FLOW BAR FOR SELECTED DATE */}
            <div className="space-y-1.5" data-testid="calendar-inspector-visual-flow">
              <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>24-Hour Visual Flow Bar</span>
                </span>
                <span>00:00 — 24:00</span>
              </div>

              <div className="relative h-10 w-full bg-[#000000] rounded-xl border border-[#1E222B] overflow-hidden">
                {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
                  <div
                    key={h}
                    className="absolute top-0 bottom-0 w-px bg-[#1E222B]"
                    style={{ left: `${(h / 24) * 100}%` }}
                  />
                ))}

                {inspectorData.isToday && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-20"
                    style={{ left: `${(currentMinuteOfDay / 1440) * 100}%` }}
                    title="Current Time"
                  />
                )}

                {visualFlowBlocks.map((block) => {
                  const styleMeta = getCategoryStyleMeta(block.category);
                  return (
                    <div
                      key={block.segmentId}
                      onClick={() => {
                        const target = (appData?.timeline || []).find(
                          (t) => t.id === block.entryId
                        );
                        if (target && isEditMode) handleOpenEditEventModal(target);
                      }}
                      title={`${block.displayTimeRange} (${formatMinutes(
                        block.durationMinutes
                      )}): ${block.title}`}
                      className={`absolute rounded ${styleMeta.barBg} border ${styleMeta.border} px-1 flex items-center overflow-hidden cursor-pointer transition-transform hover:scale-y-105 ${
                        block.isOverlapping ? 'top-2 bottom-0.5' : 'top-1 bottom-1'
                      }`}
                      style={{
                        left: `${block.leftPercent}%`,
                        width: `${block.widthPercent}%`,
                      }}
                    >
                      <span className="text-[9px] font-bold text-white truncate">
                        {block.title}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between text-[9px] font-mono tabular-nums text-zinc-500">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>

            {/* CHRONOLOGICAL ACTIVITIES LIST */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Scheduled Activities ({inspectorData.segments.length})</span>
                </span>
                <button
                  type="button"
                  data-testid="calendar-inspector-add-btn"
                  onClick={() => handleOpenAddEventModal(inspectorData.date)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-xs font-mono font-semibold text-zinc-200 hover:text-white transition-colors"
                  style={{ borderColor: accent.hex, color: accent.hex }}
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Activity</span>
                </button>
              </div>

              {inspectorData.segments.length === 0 ? (
                <div className="p-5 rounded-xl bg-[#000000] border border-[#1E222B] text-center space-y-2">
                  <p className="text-xs text-zinc-400">
                    No timeline activities logged for{' '}
                    <span className="font-mono text-zinc-200">{inspectorData.date}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleOpenAddEventModal(inspectorData.date)}
                    className="px-3 py-1.5 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-xs font-mono font-semibold text-emerald-400"
                  >
                    + Log First Activity on {inspectorData.date}
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {inspectorData.segments.map((seg: CalendarSpanSegment) => {
                    const styleMeta = getCategoryStyleMeta(seg.entry.category);
                    return (
                      <div
                        key={seg.segmentId}
                        data-testid={`inspector-activity-${seg.entry.id}`}
                        className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-[#2E3442] space-y-1.5 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${styleMeta.dot}`}
                              />
                              <span className="text-xs font-bold text-white truncate">
                                {seg.entry.title}
                              </span>
                              {seg.isMultiDay && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-[#000000] border border-cyan-500/40 text-cyan-300">
                                  Day {seg.spanDayIndex}/{seg.spanTotalDays}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-zinc-400 mt-0.5">
                              <span>
                                {seg.displayStartTime} → {seg.displayEndTime}
                              </span>
                              <span>•</span>
                              <span className="text-emerald-400 font-semibold">
                                {formatMinutes(seg.segmentDurationMinutes)}
                              </span>
                              <span>•</span>
                              <span className={`uppercase ${styleMeta.text}`}>
                                {seg.entry.category}
                              </span>
                            </div>
                          </div>

                          {isEditMode && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                data-testid={`inspector-edit-${seg.entry.id}`}
                                onClick={() => handleOpenEditEventModal(seg.entry)}
                                title="Edit Activity"
                                className="p-1 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-zinc-300 hover:text-white"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                data-testid={`inspector-delete-${seg.entry.id}`}
                                onClick={() => handleDeleteTimelineEntry(seg.entry)}
                                title="Delete Activity"
                                className="p-1 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-rose-400 hover:text-rose-300"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        {seg.entry.notes && (
                          <p className="text-[11px] text-zinc-400 line-clamp-2 pl-3.5">
                            {seg.entry.notes}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* CROSS-MODULE TELEMETRY FOR SELECTED DATE */}
            <div className="pt-3 border-t border-[#1E222B] space-y-2.5">
              <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                Cross-Module Overlays ({inspectorData.date})
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono text-xs tabular-nums">
                {/* Daily Notes Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab('notes')}
                  className="p-2.5 rounded-xl bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-left transition-colors"
                >
                  <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                    <span>Daily Notes</span>
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    {inspectorData.notes.length} logged
                  </div>
                </button>

                {/* Strategic Goals Due Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab('goals')}
                  className="p-2.5 rounded-xl bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-left transition-colors"
                >
                  <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                    <span>Goals Target</span>
                    <Target className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-sm font-bold text-white mt-1">
                    {inspectorData.goalsDue.length} target(s)
                  </div>
                </button>

                {/* Funds Ledger Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab('funds')}
                  className="p-2.5 rounded-xl bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-left transition-colors"
                >
                  <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                    <span>Funds Net</span>
                    <Wallet className="w-3.5 h-3.5 text-lime-400" />
                  </div>
                  <div
                    className={`text-sm font-bold mt-1 ${
                      inspectorData.netFundsAmount >= 0 ? 'text-lime-400' : 'text-rose-400'
                    }`}
                  >
                    {inspectorData.netFundsAmount >= 0 ? '+' : '-'}$
                    {Math.abs(inspectorData.netFundsAmount).toFixed(2)}
                  </div>
                </button>

                {/* Distance / OCR Card */}
                <button
                  type="button"
                  onClick={() => setActiveTab('distance')}
                  className="p-2.5 rounded-xl bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-left transition-colors"
                >
                  <div className="flex items-center justify-between text-zinc-400 text-[10px]">
                    <span>Distance / OCR</span>
                    <Compass className="w-3.5 h-3.5 text-sky-400" />
                  </div>
                  <div className="text-sm font-bold text-sky-400 mt-1">
                    {inspectorData.totalDistanceMiles} mi
                  </div>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* EMBEDDED DAILY TIMELINE INSIDE CALENDAR VIEW (Only when inspecting a day's full timeline) */}
      {showEmbeddedTimeline && (
        <div
          data-testid="calendar-embedded-daily-timeline"
          className="pt-4 border-t border-[#1E222B]"
        >
          <TimelineView />
        </div>
      )}

      {/* EXPLICIT SAVE / CANCEL EVENT CREATION & EDIT MODAL (Backdrop Click Auto-Close Disabled) */}
      {isEventModalOpen && (
        <div
          data-testid="calendar-event-modal-backdrop"
          onDoubleClick={handleBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto"
        >
          <div
            data-testid="calendar-event-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl bg-[#000000] border border-[#1E222B] p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1E222B]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#000000] border border-[#1E222B]">
                  <CalendarRange className="w-4 h-4" style={{ color: accent.hex }} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {eventForm.id ? 'Edit Activity' : 'Schedule Activity'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Saved locally to your Calendar &amp; Daily Timeline
                  </p>
                </div>
              </div>
              <button
                type="button"
                data-testid="calendar-event-modal-close-btn"
                onClick={requestExplicitClose}
                aria-label="Close modal"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-[#111319] border border-transparent hover:border-[#1E222B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnsavedChangesBanner
              show={showConfirmClose}
              onKeepEditing={cancelClose}
              onDiscardAndClose={confirmDiscardAndClose}
            />

            <form onSubmit={handleSaveEventModal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Activity Title *
                </label>
                <input
                  type="text"
                  required
                  data-testid="calendar-modal-title-input"
                  value={eventForm.title}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Deep Architecture Sprint, Multi-Day Trip..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#000000] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                  <select
                    data-testid="calendar-modal-category-select"
                    value={eventForm.category}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, category: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#000000] border border-[#1E222B] text-xs text-white focus:outline-none"
                  >
                    {timelineCategoryConfigs.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    data-testid="calendar-modal-date-input"
                    value={eventForm.date}
                    onChange={(e) => setEventForm((prev) => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl bg-[#000000] border border-[#1E222B] text-xs text-white font-mono tabular-nums focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    data-testid="calendar-modal-start-input"
                    value={eventForm.startTime}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, startTime: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#000000] border border-[#1E222B] text-xs text-white font-mono tabular-nums focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    data-testid="calendar-modal-end-input"
                    value={eventForm.endTime}
                    onChange={(e) =>
                      setEventForm((prev) => ({ ...prev, endTime: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#000000] border border-[#1E222B] text-xs text-white font-mono tabular-nums focus:outline-none"
                  />
                </div>
              </div>

              {/* Multi-Day / >24h Duration Support */}
              <div className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] space-y-2">
                <label className="flex items-center justify-between gap-2 text-xs text-zinc-300 cursor-pointer">
                  <span className="font-medium">
                    Multi-Day / Custom Duration Override (&gt;24h Spanning)
                  </span>
                  <input
                    type="checkbox"
                    data-testid="calendar-modal-multiday-toggle"
                    checked={eventForm.useCustomMultiDayDuration}
                    onChange={(e) =>
                      setEventForm((prev) => ({
                        ...prev,
                        useCustomMultiDayDuration: e.target.checked,
                        durationMinutes: e.target.checked
                          ? Math.max(1440, prev.durationMinutes)
                          : calculateDurationMinutes(prev.startTime, prev.endTime) || 60,
                      }))
                    }
                    className="w-4 h-4 rounded bg-[#000000] border-[#1E222B]"
                  />
                </label>

                {eventForm.useCustomMultiDayDuration ? (
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="number"
                      min={15}
                      max={43200}
                      step={15}
                      data-testid="calendar-modal-duration-input"
                      value={eventForm.durationMinutes}
                      onChange={(e) =>
                        setEventForm((prev) => ({
                          ...prev,
                          durationMinutes: Number(e.target.value) || 60,
                        }))
                      }
                      className="w-32 px-3 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs font-mono tabular-nums text-white"
                    />
                    <span className="text-xs font-mono tabular-nums text-emerald-400">
                      mins ({formatMinutes(eventForm.durationMinutes)})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-zinc-400">
                    <span>Calculated Duration:</span>
                    <span className="text-emerald-400 font-bold">
                      {formatMinutes(
                        calculateDurationMinutes(eventForm.startTime, eventForm.endTime) || 60
                      )}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  data-testid="calendar-modal-notes-input"
                  value={eventForm.notes}
                  onChange={(e) => setEventForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Objectives, location details, or notes..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#000000] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1E222B]">
                <button
                  type="button"
                  data-testid="calendar-modal-cancel-btn"
                  onClick={requestExplicitClose}
                  className="px-4 py-2 rounded-xl bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="calendar-modal-save-btn"
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${accent.primaryBg}`}
                >
                  {eventForm.id ? 'Save Changes' : 'Save to Calendar & Timeline'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
