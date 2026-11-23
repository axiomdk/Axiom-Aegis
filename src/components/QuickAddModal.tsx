import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import {
  Calendar,
  Activity,
  Compass,
  Wallet,
  Target,
  X,
  Clock,
  Plus,
  Zap,
  BookmarkPlus,
  BookOpen,
  Pin,
  Tag,
} from 'lucide-react';
import { calculateDurationMinutes, formatMinutes } from '../utils/calculations';
import {
  upsertDailyNote,
  TACTICAL_NOTE_TEMPLATES,
  insertTemplateIntoNoteContent,
  syncNoteMoodToLifeStats,
} from '../utils/dailyNotesEngine';
import { getCategoriesByDomain } from '../utils/categoryEngine';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';
import {
  DistanceActivityType,
  DistanceUnit,
  TimelineEntry,
  LifeStatEntry,
  DistanceEntry,
  FundEntry,
  GoalEntry,
  FrequentEvent,
  RecurrenceFrequency,
} from '../types';

export const QuickAddModal: React.FC = () => {
  const {
    isQuickAddOpen,
    closeQuickAdd,
    quickAddInitialTab,
    quickAddDefaultDate,
    appData,
    updateAppData,
    layoutConfig,
    accent,
    showNotification,
  } = useVault();

  type TabKey = 'timeline' | 'notes' | 'lifestats' | 'distance' | 'funds' | 'goals';
  const [activeSubTab, setActiveSubTab] = useState<TabKey>('timeline');

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (isQuickAddOpen) {
      const targetDate = quickAddDefaultDate || new Date().toISOString().split('T')[0];
      setTimelineDate(targetDate);
      setStatDate(targetDate);
      setDistanceDate(targetDate);
      setFundDate(targetDate);
      setQuickNoteDate(targetDate);
      if (quickAddInitialTab) {
        setActiveSubTab(quickAddInitialTab);
      }
    }
  }, [quickAddInitialTab, quickAddDefaultDate, isQuickAddOpen]);

  const customTimelineCols =
    layoutConfig.customTimelineColumns ||
    appData?.settings?.columns?.customTimelineColumns ||
    [];
  const customFundsCols =
    layoutConfig.customFundsColumns ||
    appData?.settings?.columns?.customFundsColumns ||
    [];

  // 1. Timeline Form State
  const [timelineTitle, setTimelineTitle] = useState('');
  const [timelineCategory, setTimelineCategory] = useState<TimelineEntry['category']>('work');
  const [timelineDate, setTimelineDate] = useState(todayStr);
  const [timelineStart, setTimelineStart] = useState('09:00');
  const [timelineEnd, setTimelineEnd] = useState('10:30');
  const [timelineNotes, setTimelineNotes] = useState('');
  const [saveAsFrequent, setSaveAsFrequent] = useState(false);
  const [timelineCustomFields, setTimelineCustomFields] = useState<Record<string, string>>({});

  // 2. Life Stats Form State (Imperial Primary: lbs, ft/in)
  const latestStat = appData?.lifeStats?.[0];
  const [statDate, setStatDate] = useState(todayStr);
  const [statAge, setStatAge] = useState<string>(latestStat?.age ? String(latestStat.age) : '');
  const [statHeightFt, setStatHeightFt] = useState<string>(latestStat?.heightFt ? String(latestStat.heightFt) : '');
  const [statHeightIn, setStatHeightIn] = useState<string>(latestStat?.heightIn ? String(latestStat.heightIn) : '');
  const [statWeightLbs, setStatWeightLbs] = useState<string>(latestStat?.weightLbs ? String(latestStat.weightLbs) : '');
  const [statMood, setStatMood] = useState<number>(8);
  const [statMoodNote, setStatMoodNote] = useState('');
  const [statWeeklyIncome, setStatWeeklyIncome] = useState<string>(latestStat?.weeklyIncome ? String(latestStat.weeklyIncome) : '');

  // 3. Distance Form State
  const [distanceAmount, setDistanceAmount] = useState('');
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>(appData?.settings?.distanceUnit || 'mi');
  const [distanceType, setDistanceType] = useState<DistanceActivityType>('run');
  const [distanceDate, setDistanceDate] = useState(todayStr);
  const [distanceDesc, setDistanceDesc] = useState('');

  // 4. Funds Form State
  const [fundType, setFundType] = useState<'income' | 'expense'>('expense');
  const [fundAmount, setFundAmount] = useState('');
  const [fundCategory, setFundCategory] = useState('Food & Groceries');
  const [fundDate, setFundDate] = useState(todayStr);
  const [fundDesc, setFundDesc] = useState('');
  const [fundRecurrence, setFundRecurrence] = useState<RecurrenceFrequency>('none');
  const [fundCustomFields, setFundCustomFields] = useState<Record<string, string>>({});

  // 5. Goals Form State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<GoalEntry['category']>('fitness');
  const [goalTargetDate, setGoalTargetDate] = useState('2026-12-31');
  const [goalCurrentVal, setGoalCurrentVal] = useState('');
  const [goalTargetVal, setGoalTargetVal] = useState('');
  const [goalUnit, setGoalUnit] = useState('lbs');

  // 6. Daily Note Form State
  const [quickNoteTitle, setQuickNoteTitle] = useState(`Daily Command Briefing — ${todayStr}`);
  const [quickNoteDate, setQuickNoteDate] = useState(todayStr);
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [quickNoteTagChips, setQuickNoteTagChips] = useState<string[]>(['briefing', 'daily']);
  const [quickNoteTagDraft, setQuickNoteTagDraft] = useState('');
  const [quickNoteMood, setQuickNoteMood] = useState<number>(8);
  const [quickNotePinned, setQuickNotePinned] = useState<boolean>(false);

  const timelineCats = getCategoriesByDomain(appData, 'timeline');
  const goalCats = getCategoriesByDomain(appData, 'goals');

  const isDirty = Boolean(
    timelineTitle.trim() ||
      timelineNotes.trim() ||
      Object.values(timelineCustomFields).some((v) => v.trim()) ||
      quickNoteContent.trim() ||
      statMoodNote.trim() ||
      distanceAmount.trim() ||
      distanceDesc.trim() ||
      fundAmount.trim() ||
      fundDesc.trim() ||
      Object.values(fundCustomFields).some((v) => v.trim()) ||
      goalTitle.trim() ||
      goalCurrentVal.trim() ||
      goalTargetVal.trim()
  );

  const resetFormsAndClose = () => {
    setTimelineTitle('');
    setTimelineNotes('');
    setTimelineCustomFields({});
    setSaveAsFrequent(false);
    setQuickNoteContent('');
    setStatMoodNote('');
    setDistanceAmount('');
    setDistanceDesc('');
    setFundAmount('');
    setFundDesc('');
    setFundRecurrence('none');
    setFundCustomFields({});
    setGoalTitle('');
    setGoalCurrentVal('');
    setGoalTargetVal('');
    closeQuickAdd();
  };

  const {
    showUnsavedConfirm,
    handleBackdropDoubleClick,
    handleRequestClose,
    handleKeepEditing,
  } = useModalGuard({
    isOpen: isQuickAddOpen,
    isDirty,
    onClose: resetFormsAndClose,
  });

  // Auto duration calculation for timeline
  const rawPreviewDuration = calculateDurationMinutes(timelineStart, timelineEnd);
  const previewDuration = rawPreviewDuration > 0 ? rawPreviewDuration : 60;

  const handleSelectFrequent = (fe: FrequentEvent) => {
    setTimelineTitle(fe.title);
    setTimelineCategory(fe.category);
    if (fe.notes) setTimelineNotes(fe.notes);
    if (fe.startTime && fe.endTime) {
      setTimelineStart(fe.startTime);
      setTimelineEnd(fe.endTime);
    } else if (fe.durationMinutes) {
      const [sh, sm] = timelineStart.split(':').map(Number);
      const endTotal = (sh * 60 + sm + fe.durationMinutes) % 1440;
      const eh = String(Math.floor(endTotal / 60)).padStart(2, '0');
      const em = String(endTotal % 60).padStart(2, '0');
      setTimelineEnd(`${eh}:${em}`);
    }
    showNotification(`Loaded frequent event "${fe.title}" into form`, 'info');
  };

  const handleInstantLogFrequent = async (fe: FrequentEvent) => {
    const now = new Date();
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

    const duration = fe.durationMinutes || calculateDurationMinutes(startStr, endStr) || 60;

    const newEntry: TimelineEntry = {
      id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: fe.title,
      category: fe.category,
      date: todayStr,
      startTime: startStr,
      endTime: endStr,
      durationMinutes: duration,
      notes: fe.notes,
      createdAt: Date.now(),
    };

    await updateAppData((prev) => ({
      ...prev,
      timeline: [newEntry, ...prev.timeline],
    }));

    showNotification(`⚡ Instantly logged "${fe.title}" for today!`, 'success');
    closeQuickAdd();
  };

  // Submit handlers
  const handleTimelineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!timelineTitle.trim()) return;

    const newEntry: TimelineEntry = {
      id: `t-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      title: timelineTitle.trim(),
      category: timelineCategory,
      date: timelineDate || todayStr,
      startTime: timelineStart,
      endTime: timelineEnd,
      durationMinutes: previewDuration,
      notes: timelineNotes.trim() || undefined,
      customFields: Object.keys(timelineCustomFields).length > 0 ? timelineCustomFields : undefined,
      createdAt: Date.now(),
    };

    await updateAppData((prev) => {
      let updatedFrequent = prev.frequentEvents || [];
      if (saveAsFrequent) {
        const existingIdx = updatedFrequent.findIndex(
          (f) => f.title.toLowerCase() === timelineTitle.trim().toLowerCase()
        );
        const feItem: FrequentEvent = {
          id: existingIdx >= 0 ? updatedFrequent[existingIdx].id : `fe-${Date.now()}`,
          title: timelineTitle.trim(),
          category: timelineCategory,
          durationMinutes: previewDuration,
          startTime: timelineStart,
          endTime: timelineEnd,
          notes: timelineNotes.trim() || undefined,
        };
        if (existingIdx >= 0) {
          updatedFrequent = updatedFrequent.map((item, idx) => (idx === existingIdx ? feItem : item));
        } else {
          updatedFrequent = [feItem, ...updatedFrequent];
        }
      }

      return {
        ...prev,
        timeline: [newEntry, ...prev.timeline],
        frequentEvents: updatedFrequent,
      };
    });

    showNotification(
      saveAsFrequent
        ? 'Timeline activity logged & saved to Frequent Events!'
        : 'Timeline activity logged successfully!',
      'success'
    );
    resetFormsAndClose();
  };

  const handleLifeStatsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newStat: LifeStatEntry = {
      id: `ls-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      date: statDate,
      age: statAge ? Number(statAge) : undefined,
      heightFt: statHeightFt ? Number(statHeightFt) : undefined,
      heightIn: statHeightIn ? Number(statHeightIn) : undefined,
      weightLbs: statWeightLbs ? Number(statWeightLbs) : undefined,
      mood: statMood,
      moodNote: statMoodNote.trim() || undefined,
      weeklyIncome: statWeeklyIncome ? Number(statWeeklyIncome) : undefined,
      createdAt: Date.now(),
    };

    await updateAppData((prev) => ({
      ...prev,
      lifeStats: [newStat, ...prev.lifeStats],
    }));

    showNotification('Life statistics & mood logged (Imperial)!', 'success');
    resetFormsAndClose();
  };

  const handleDistanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const distNum = parseFloat(distanceAmount);
    if (isNaN(distNum) || distNum <= 0) return;

    const newDist: DistanceEntry = {
      id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      date: distanceDate,
      distance: distNum,
      unit: distanceUnit,
      type: distanceType,
      description: distanceDesc.trim() || `${distanceType.toUpperCase()} session`,
      createdAt: Date.now(),
    };

    await updateAppData((prev) => ({
      ...prev,
      distances: [newDist, ...prev.distances],
    }));

    showNotification(`Logged ${distNum} ${distanceUnit.toUpperCase()} traveled!`, 'success');
    resetFormsAndClose();
  };

  const handleFundsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(fundAmount);
    if (isNaN(amt) || amt <= 0) return;

    const newFund: FundEntry = {
      id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      date: fundDate,
      type: fundType,
      amount: amt,
      category: fundCategory.trim() || 'General',
      description: fundDesc.trim() || `${fundType === 'income' ? 'Received' : 'Paid'} ${fundCategory}`,
      recurrence: fundRecurrence !== 'none' ? fundRecurrence : undefined,
      customFields: Object.keys(fundCustomFields).length > 0 ? fundCustomFields : undefined,
      createdAt: Date.now(),
    };

    await updateAppData((prev) => ({
      ...prev,
      funds: [newFund, ...prev.funds],
    }));

    showNotification(
      `${fundType === 'income' ? 'Income' : 'Expense'} of $${amt.toFixed(2)} USD recorded!`,
      'success'
    );
    resetFormsAndClose();
  };

  const handleGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalTitle.trim()) return;

    const newGoal: GoalEntry = {
      id: `g-${Date.now()}`,
      title: goalTitle.trim(),
      category: goalCategory,
      targetDate: goalTargetDate,
      currentValue: goalCurrentVal ? parseFloat(goalCurrentVal) : undefined,
      targetValue: goalTargetVal ? parseFloat(goalTargetVal) : undefined,
      unit: goalUnit.trim() || undefined,
      milestones: [],
      status: 'in_progress',
      createdAt: Date.now(),
    };

    await updateAppData((prev) => ({
      ...prev,
      goals: [newGoal, ...(prev.goals || [])],
    }));

    showNotification(`Goal "${goalTitle.trim()}" established!`, 'success');
    resetFormsAndClose();
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNoteContent.trim() && !quickNoteTitle.trim()) return;

    const extraDraftTags = quickNoteTagDraft
      .split(',')
      .map((t) => t.replace(/^#+/, '').trim().toLowerCase())
      .filter(Boolean);
    const mergedTags = Array.from(new Set([...quickNoteTagChips, ...extraDraftTags]));

    const res = upsertDailyNote(appData?.dailyNotes || [], {
      date: quickNoteDate || todayStr,
      title: quickNoteTitle.trim() || `Daily Command Briefing — ${quickNoteDate || todayStr}`,
      content: quickNoteContent,
      tags: mergedTags,
      mood: quickNoteMood,
      isPinned: quickNotePinned,
    });

    if (res) {
      await updateAppData(
        (prev) => ({
          ...prev,
          dailyNotes: res.nextNotes,
          lifeStats: syncNoteMoodToLifeStats(
            prev.lifeStats || [],
            quickNoteDate || todayStr,
            quickNoteMood,
            res.savedNote.title
          ),
        }),
        { label: `Quick-logged Daily Note "${res.savedNote.title}"` }
      );
      showNotification(
        `Daily Note encrypted & Mood (${quickNoteMood}/10) synced to Biometrics!`,
        'success'
      );
      resetFormsAndClose();
    }
  };

  const customItemLabels =
    appData?.settings?.sidebarItemLabels ||
    layoutConfig?.sidebarItemLabels ||
    {};

  const tabButtons: { id: TabKey; label: string; icon: React.ReactNode }[] = [
    {
      id: 'timeline',
      label: customItemLabels['nav-calendar'] || 'Timeline Activity',
      icon: <Calendar className="w-4 h-4 text-emerald-400" />,
    },
    {
      id: 'notes',
      label: customItemLabels['nav-notes'] || 'Daily Note',
      icon: <BookOpen className="w-4 h-4 text-amber-400" />,
    },
    {
      id: 'lifestats',
      label: customItemLabels['nav-lifestats'] || 'Life Statistic',
      icon: <Activity className="w-4 h-4 text-rose-400" />,
    },
    {
      id: 'distance',
      label: customItemLabels['nav-distance'] || 'Distance Traveled',
      icon: <Compass className="w-4 h-4 text-sky-400" />,
    },
    {
      id: 'funds',
      label: customItemLabels['nav-funds'] || 'Funds & Finance',
      icon: <Wallet className="w-4 h-4 text-lime-400" />,
    },
    {
      id: 'goals',
      label: customItemLabels['nav-goals'] || 'Strategic Goal',
      icon: <Target className="w-4 h-4 text-amber-400" />,
    },
  ];

  if (!isQuickAddOpen) return null;

  return (
    <div
      data-testid="quick-add-backdrop"
      onDoubleClick={handleBackdropDoubleClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div
        data-testid="quick-add-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-[#121215] border border-zinc-800 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800">
              <Plus className="w-4 h-4" style={{ color: accent.hex }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Quick Add Entry</h3>
                {isDirty && (
                  <span
                    data-testid="quick-add-dirty-badge"
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  >
                    Unsaved Input • Protected
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Encrypted in-place to local vault • Click Save or Close (or double-click backdrop)
              </p>
            </div>
          </div>
          <button
            type="button"
            data-testid="quick-add-close-btn"
            onClick={handleRequestClose}
            aria-label="Close modal"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unsaved Changes Confirmation Guard */}
        <UnsavedChangesBanner
          show={showUnsavedConfirm}
          onKeepEditing={handleKeepEditing}
          onDiscardAndClose={resetFormsAndClose}
        />

        {/* Tab Selector */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl mb-4 shrink-0">
          {tabButtons.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-800 text-white shadow border border-zinc-700/60'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                style={isActive ? { color: accent.hex } : undefined}
              >
                {tab.icon}
                <span className="truncate">{tab.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto pr-1 pb-1">
          {/* 1. Timeline Form */}
          {activeSubTab === 'timeline' && (
          <div className="space-y-4">
            {/* Frequent Events Quick-Click Tray */}
            {(appData?.frequentEvents || []).length > 0 && (
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Frequent Events (Quick-Click Tray)</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-mono">1-Click Auto-Fill or Log</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(appData?.frequentEvents || []).map((fe) => (
                    <div
                      key={fe.id}
                      className="group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectFrequent(fe)}
                        className="hover:text-emerald-400 transition-colors text-left"
                        title={`Click to fill form with "${fe.title}"`}
                      >
                        <span className="font-medium">{fe.title}</span>
                        <span className="text-[10px] text-zinc-400 ml-1 font-mono">({fe.durationMinutes}m)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInstantLogFrequent(fe)}
                        className="p-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[10px] font-mono flex items-center gap-0.5"
                        title="Instant 1-Click Log to Today's Timeline"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Log</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form id="form-quickadd-timeline" onSubmit={handleTimelineSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Activity Title *</label>
                <input
                  type="text"
                  required
                  data-testid="quick-add-timeline-title-input"
                  value={timelineTitle}
                  onChange={(e) => setTimelineTitle(e.target.value)}
                  placeholder="e.g. Deep Work on Cryptographic Engine"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />

                {/* Save as Frequent Event toggle - Prominently visible immediately */}
                <label className="flex items-center gap-2.5 p-2 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition-colors mt-2">
                  <input
                    type="checkbox"
                    checked={saveAsFrequent}
                    onChange={(e) => setSaveAsFrequent(e.target.checked)}
                    className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                    <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Save as Frequent Event (adds to quick-click tray for future 1-click logging)</span>
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                  <select
                    value={timelineCategory}
                    onChange={(e) => setTimelineCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                  >
                    {timelineCats.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={timelineDate}
                    onChange={(e) => setTimelineDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={timelineStart}
                    onChange={(e) => setTimelineStart(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={timelineEnd}
                    onChange={(e) => setTimelineEnd(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Calculated duration badge */}
              <div className="flex items-center justify-between p-2.5 bg-zinc-900/60 border border-zinc-800 rounded-lg text-xs text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  Calculated Duration:
                </span>
                <span className="font-semibold text-emerald-400 font-mono">
                  {formatMinutes(previewDuration)} ({previewDuration} mins)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes (Optional)</label>
                <textarea
                  rows={2}
                  value={timelineNotes}
                  onChange={(e) => setTimelineNotes(e.target.value)}
                  placeholder="Objectives achieved, breakthroughs, thoughts..."
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              {customTimelineCols.length > 0 && (
                <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                    Custom Table Columns
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {customTimelineCols.map((c) => (
                      <div key={c.id}>
                        <label className="block text-xs font-medium text-zinc-300 mb-1">
                          {layoutConfig.timelineColumnTitles?.[c.id] || c.label}
                        </label>
                        <input
                          type="text"
                          value={timelineCustomFields[c.id] || ''}
                          onChange={(e) =>
                            setTimelineCustomFields((prev) => ({
                              ...prev,
                              [c.id]: e.target.value,
                            }))
                          }
                          placeholder={`Enter ${c.label}...`}
                          className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {/* 2. Life Stats Form (Imperial: Pounds, Feet/Inches) */}
        {activeSubTab === 'lifestats' && (
          <form id="form-quickadd-lifestats" onSubmit={handleLifeStatsSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={statDate}
                  onChange={(e) => setStatDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Age</label>
                <input
                  type="number"
                  value={statAge}
                  onChange={(e) => setStatAge(e.target.value)}
                  placeholder="e.g. 27"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Weight (lbs)</label>
                <input
                  type="number"
                  step="0.1"
                  value={statWeightLbs}
                  onChange={(e) => setStatWeightLbs(e.target.value)}
                  placeholder="e.g. 172.8"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Height (ft)</label>
                <input
                  type="number"
                  value={statHeightFt}
                  onChange={(e) => setStatHeightFt(e.target.value)}
                  placeholder="5"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Height (in)</label>
                <input
                  type="number"
                  value={statHeightIn}
                  onChange={(e) => setStatHeightIn(e.target.value)}
                  placeholder="11"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            {/* Mood 1-10 selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300">Mood Rating (1-10):</label>
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-zinc-800 text-purple-400">
                  {statMood} / 10
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setStatMood(num)}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md text-xs font-semibold flex items-center justify-center transition-all ${
                      statMood === num
                        ? 'bg-purple-600 text-white shadow-md scale-105'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Mood Reflections</label>
              <input
                type="text"
                value={statMoodNote}
                onChange={(e) => setStatMoodNote(e.target.value)}
                placeholder="Good energy, steady progress..."
                className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Weekly Income ($ USD)</label>
              <input
                type="number"
                step="0.01"
                value={statWeeklyIncome}
                onChange={(e) => setStatWeeklyIncome(e.target.value)}
                placeholder="2450.00"
                className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none"
              />
            </div>
          </form>
        )}

        {/* 3. Distance Form */}
        {activeSubTab === 'distance' && (
          <form id="form-quickadd-distance" onSubmit={handleDistanceSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-zinc-300 mb-1">Distance *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={distanceAmount}
                  onChange={(e) => setDistanceAmount(e.target.value)}
                  placeholder="e.g. 5.2"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Unit</label>
                <select
                  value={distanceUnit}
                  onChange={(e) => setDistanceUnit(e.target.value as DistanceUnit)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                >
                  <option value="mi">Miles (mi)</option>
                  <option value="km">Kilometers (km)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Activity Type</label>
                <select
                  value={distanceType}
                  onChange={(e) => setDistanceType(e.target.value as DistanceActivityType)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                >
                  <option value="walk">Walk</option>
                  <option value="run">Run</option>
                  <option value="cycle">Cycle</option>
                  <option value="drive">Drive</option>
                  <option value="flight">Flight</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={distanceDate}
                  onChange={(e) => setDistanceDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Route / Description</label>
              <input
                type="text"
                value={distanceDesc}
                onChange={(e) => setDistanceDesc(e.target.value)}
                placeholder="Morning trail route, coastal highway commute, etc."
                className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
          </form>
        )}

        {/* 4. Funds Form */}
        {activeSubTab === 'funds' && (
          <form id="form-quickadd-funds" onSubmit={handleFundsSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 border border-zinc-800 rounded-xl">
              <button
                type="button"
                onClick={() => setFundType('expense')}
                className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  fundType === 'expense'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Expense Outflow (-)
              </button>
              <button
                type="button"
                onClick={() => setFundType('income')}
                className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  fundType === 'income'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Income Inflow (+)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Amount ($ USD) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={fundDate}
                  onChange={(e) => setFundDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                <input
                  type="text"
                  value={fundCategory}
                  onChange={(e) => setFundCategory(e.target.value)}
                  placeholder="e.g. Engineering Client, Groceries, Cloud Server"
                  className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Recurrence Schedule
                </label>
                <select
                  value={fundRecurrence}
                  onChange={(e) => setFundRecurrence(e.target.value as RecurrenceFrequency)}
                  data-testid="quickadd-fund-recurrence-select"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none font-mono"
                >
                  <option value="none">One-Time (None)</option>
                  <option value="weekly">Weekly Recurring</option>
                  <option value="biweekly">Bi-Weekly Recurring</option>
                  <option value="monthly">Monthly Recurring / Fixed Bill</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Description / Memo</label>
              <input
                type="text"
                value={fundDesc}
                onChange={(e) => setFundDesc(e.target.value)}
                placeholder="What was this transaction for?"
                className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            {customFundsCols.length > 0 && (
              <div className="space-y-2.5 pt-2 border-t border-zinc-800/80">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400">
                  Custom Table Columns
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {customFundsCols.map((c) => (
                    <div key={c.id}>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        {layoutConfig.fundsColumnTitles?.[c.id] || c.label}
                      </label>
                      <input
                        type="text"
                        value={fundCustomFields[c.id] || ''}
                        onChange={(e) =>
                          setFundCustomFields((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }))
                        }
                        placeholder={`Enter ${c.label}...`}
                        className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {/* 5. Goals Form */}
        {activeSubTab === 'goals' && (
          <form id="form-quickadd-goals" onSubmit={handleGoalSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Goal Title *</label>
              <input
                type="text"
                required
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                placeholder="e.g. Run 100 Miles This Quarter"
                className="w-full px-3.5 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                <select
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                >
                  {goalCats.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Target Date</label>
                <input
                  type="date"
                  required
                  value={goalTargetDate}
                  onChange={(e) => setGoalTargetDate(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Current Val</label>
                <input
                  type="number"
                  step="any"
                  value={goalCurrentVal}
                  onChange={(e) => setGoalCurrentVal(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Target Val</label>
                <input
                  type="number"
                  step="any"
                  value={goalTargetVal}
                  onChange={(e) => setGoalTargetVal(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Unit</label>
                <input
                  type="text"
                  value={goalUnit}
                  onChange={(e) => setGoalUnit(e.target.value)}
                  placeholder="lbs, $, miles"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                />
              </div>
            </div>
          </form>
        )}

        {/* 6. Daily Note & Tactical Briefing Form */}
        {activeSubTab === 'notes' && (
          <form
            id="form-quickadd-notes"
            onSubmit={handleNoteSubmit}
            className="space-y-3 p-3.5 rounded-xl bg-[#000000] border border-[#1E222B]"
          >
            {/* Seamless Inline Header Bar */}
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1E222B]">
              <input
                type="text"
                required
                data-testid="quickadd-note-title-input"
                value={quickNoteTitle}
                onChange={(e) => setQuickNoteTitle(e.target.value)}
                placeholder="Daily Command Briefing..."
                className="flex-1 bg-[#000000] text-sm font-bold text-white placeholder-zinc-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuickNotePinned((p) => !p)}
                className={`px-2 py-1 rounded-lg bg-[#000000] border text-[11px] font-mono flex items-center gap-1 transition-colors ${
                  quickNotePinned
                    ? 'text-amber-300 border-amber-500/50'
                    : 'text-zinc-400 border-[#1E222B] hover:text-white'
                }`}
              >
                <Pin className="w-3 h-3" />
                <span>{quickNotePinned ? 'Pinned' : 'Pin'}</span>
              </button>
            </div>

            {/* Metadata & Telemetry Ribbon: Date + 1-10 Segmented Mood Selector */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#000000] border border-[#1E222B]">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <input
                  type="date"
                  required
                  value={quickNoteDate}
                  onChange={(e) => setQuickNoteDate(e.target.value)}
                  className="bg-[#000000] text-xs text-white font-mono focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#000000] border border-[#1E222B]">
                <span className="text-[10px] font-mono text-zinc-400 mr-1">Mood:</span>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setQuickNoteMood(num)}
                    className={`w-5 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center transition-colors ${
                      quickNoteMood === num
                        ? 'bg-amber-400 text-black'
                        : 'bg-[#000000] text-zinc-400 hover:text-white border border-[#1E222B]'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            {/* 1-Click Tactical Templates */}
            <div className="flex flex-wrap items-center gap-1.5">
              {TACTICAL_NOTE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setQuickNoteTitle(`${tpl.defaultTitle} (${quickNoteDate})`);
                    setQuickNoteTagChips((prev) =>
                      Array.from(new Set([...prev, ...tpl.defaultTags]))
                    );
                    setQuickNoteContent((prev) => insertTemplateIntoNoteContent(prev, tpl));
                  }}
                  className="px-2 py-1 rounded-lg bg-[#000000] hover:border-amber-400/50 border border-[#1E222B] text-[10px] font-mono text-zinc-300 hover:text-white transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            <div>
              <textarea
                rows={5}
                required
                data-testid="quickadd-note-content-input"
                value={quickNoteContent}
                onChange={(e) => setQuickNoteContent(e.target.value)}
                placeholder="Write markdown briefings, - [ ] action checklists, or tactical observations..."
                className="w-full p-3 bg-[#000000] border border-[#1E222B] rounded-xl text-xs text-white font-mono leading-relaxed focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Inline #Tag Chips & Adder */}
            <div className="flex flex-wrap items-center gap-1.5">
              {quickNoteTagChips.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#000000] border border-[#1E222B] text-[11px] font-mono text-zinc-300"
                >
                  <span className="text-amber-400">#</span>
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuickNoteTagChips((prev) => prev.filter((item) => item !== t))
                    }
                    className="text-zinc-500 hover:text-rose-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <div className="flex items-center gap-1">
                <Tag className="w-3 h-3 text-amber-400" />
                <input
                  type="text"
                  value={quickNoteTagDraft}
                  onChange={(e) => setQuickNoteTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quickNoteTagDraft.trim()) {
                      e.preventDefault();
                      const cleaned = quickNoteTagDraft
                        .split(',')
                        .map((x) => x.replace(/^#+/, '').trim().toLowerCase())
                        .filter(Boolean);
                      setQuickNoteTagChips((prev) => Array.from(new Set([...prev, ...cleaned])));
                      setQuickNoteTagDraft('');
                    }
                  }}
                  placeholder="+ Add #tag..."
                  className="w-28 px-2 py-0.5 bg-[#000000] border border-[#1E222B] rounded-lg text-[11px] text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </form>
        )}
        </div>

        {/* Pinned Modal Action Footer - Always visible at bottom */}
        <div className="flex items-center justify-end gap-3 pt-3.5 border-t border-zinc-800/80 mt-3 shrink-0">
          <button
            type="button"
            data-testid="quick-add-cancel-btn"
            onClick={handleRequestClose}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-testid="quick-add-save-btn"
            form={
              activeSubTab === 'timeline'
                ? 'form-quickadd-timeline'
                : activeSubTab === 'notes'
                ? 'form-quickadd-notes'
                : activeSubTab === 'lifestats'
                ? 'form-quickadd-lifestats'
                : activeSubTab === 'distance'
                ? 'form-quickadd-distance'
                : activeSubTab === 'funds'
                ? 'form-quickadd-funds'
                : 'form-quickadd-goals'
            }
            className={`px-5 py-2 rounded-lg text-xs font-semibold shadow-lg transition-all ${
              activeSubTab === 'funds' && fundType === 'expense'
                ? 'bg-rose-500 hover:bg-rose-400 text-white'
                : accent.primaryBg
            }`}
          >
            {activeSubTab === 'timeline'
              ? 'Save Timeline Activity'
              : activeSubTab === 'notes'
              ? 'Save Daily Note'
              : activeSubTab === 'lifestats'
              ? 'Save Life Stats'
              : activeSubTab === 'distance'
              ? 'Record Distance'
              : activeSubTab === 'funds'
              ? `Record ${fundType === 'income' ? 'Income' : 'Expense'}`
              : 'Establish Strategic Goal'}
          </button>
        </div>
      </div>
    </div>
  );
};
