import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import {
  Wallet,
  Calendar,
  Activity,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Target,
  Eye,
  Edit3,
  Flame,
  ChevronRight,
  Image as ImageIcon,
  Plus,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Check,
  CheckCircle2,
  Layers,
  EyeOff,
  GripVertical,
  Trash2,
  CloudSun,
  Wind,
  Droplets,
  RotateCw,
  MapPin,
  Scale,
  Footprints,
  Shuffle,
  Pin,
  Quote,
  Settings,
  Copy,
  FileText,
  Hash,
  ListChecks,
  KeyRound,
  X,
  Minus,
  BookOpen,
  Zap,
  Search,
  LocateFixed,
  Briefcase,
  Heart,
  User,
  Users,
  Sparkles,
  Tag,
} from 'lucide-react';
import {
  calculateFundsSummary,
  calculateDistanceSummary,
  calculateTimelineSummary,
  calculateStatsSummary,
  calculateGoalProgress,
  formatMinutes,
  calculateDurationMinutes,
} from '../utils/calculations';
import {
  syncGoalsWithLiveModules,
  computeLiveGoalMetrics,
  calculateBiometricsCorrelation,
  calculateFinancialRunwayAndBurn,
} from '../utils/aegisUpgradesEngine';
import { AegisVisualizerWidget } from './AegisVisualizerWidget';
import { RoleBadge } from './RoleBadge';
import { compressImageToDataUrl } from '../utils/imageCompressor';
import { InlineCategoryBadge } from './InlineCategoryBadge';
import {
  filterFrequentEvents,
  createTimelineEntryFromFrequentEvent,
  upsertFrequentEventTemplate,
  moveFrequentEventTemplate,
} from '../utils/frequentEventsEngine';
import { getCategoriesByDomain } from '../utils/categoryEngine';
import {
  upsertDailyNote,
  parseMarkdownChecklists,
  toggleMarkdownChecklistLine,
  appendQuickScratchpadBullet,
  computeNoteTelemetry,
} from '../utils/dailyNotesEngine';
import {
  CustomPanelColor,
  CustomPanelType,
  DashboardWidgetConfig,
  DashboardWidgetId,
  FrequentEvent,
} from '../types';
import { DEFAULT_DASHBOARD_WIDGETS, DEFAULT_LAYOUT_CONFIG } from '../utils/defaults';
import {
  DEFAULT_WIDGET_TITLES,
  MatrixDirection,
  canMoveInMatrix,
  moveCardInMatrix,
  dragReorderInMatrix,
  updateMatrixCardTitle,
  updateMatrixCardSpan,
  toggleMatrixCardVisibility,
  createCustomMatrixColumn,
  getColSpanClass,
  normalizeColSpan,
  saveAppDataToLocalStorage,
  getLast7DayStrings,
  calculateHabitStreak,
} from '../utils/matrixLayoutEngine';
import { APP_VERSION, formatLastUpdated } from '../utils/version';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';
import { getUpcomingScheduleSegments } from '../utils/calendarEngine';

// Convert 'HH:mm' to minutes since 00:00
function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface PanelStyleEntry {
  text: string;
  bg: string;
  border: string;
  bar: string;
  badge: string;
  hex: string;
}

const PANEL_COLOR_STYLES: Partial<Record<CustomPanelColor, PanelStyleEntry>> = {
  emerald: {
    text: 'text-emerald-400',
    bg: 'bg-[#000000]',
    border: 'border-[#1E222B]',
    bar: 'bg-emerald-500',
    badge: 'bg-[#000000] text-emerald-300 border-[#1E222B]',
    hex: '#10b981',
  },
  cyan: {
    text: 'text-cyan-400',
    bg: 'bg-[#000000]',
    border: 'border-[#1E222B]',
    bar: 'bg-cyan-500',
    badge: 'bg-[#000000] text-cyan-300 border-[#1E222B]',
    hex: '#06b6d4',
  },
  violet: {
    text: 'text-violet-400',
    bg: 'bg-[#000000]',
    border: 'border-[#1E222B]',
    bar: 'bg-violet-500',
    badge: 'bg-[#000000] text-violet-300 border-[#1E222B]',
    hex: '#8b5cf6',
  },
  amber: {
    text: 'text-amber-400',
    bg: 'bg-[#000000]',
    border: 'border-[#1E222B]',
    bar: 'bg-amber-500',
    badge: 'bg-[#000000] text-amber-300 border-[#1E222B]',
    hex: '#f59e0b',
  },
  rose: {
    text: 'text-rose-400',
    bg: 'bg-[#000000]',
    border: 'border-[#1E222B]',
    bar: 'bg-rose-500',
    badge: 'bg-[#000000] text-rose-300 border-[#1E222B]',
    hex: '#f43f5e',
  },
  sky: {
    text: 'text-sky-400',
    bg: 'bg-[#000000]',
    border: 'border-[#1E222B]',
    bar: 'bg-sky-500',
    badge: 'bg-[#000000] text-sky-300 border-[#1E222B]',
    hex: '#0ea5e9',
  },
};

function getPanelColorStyle(col?: CustomPanelColor): PanelStyleEntry {
  if (col && PANEL_COLOR_STYLES[col]) {
    return PANEL_COLOR_STYLES[col]!;
  }
  return PANEL_COLOR_STYLES.cyan!;
}

export const DashboardView: React.FC = () => {
  const {
    appData,
    updateAppData,
    openQuickAdd,
    setActiveTab,
    isColumnEditMode,
    setIsColumnEditMode,
    layoutConfig,
    updateLayoutConfig,
    weather,
    isWeatherLoading,
    refreshWeather,
    detectMyWeatherLocation,
    searchAndSaveWeatherLocation,
    showNotification,
    accent,
    setIsFrequentEventsOpen,
    selectedCalendarDate,
    setSelectedCalendarDate,
    accountSession,
    accountRole,
    updateAccountDisplayName,
    cloudSyncStatus,
    lastCloudSyncAt,
    syncVaultNow,
  } = useVault();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Unified Goals & Milestones Tab State
  const [goalsSubTab, setGoalsSubTab] = useState<'milestones' | 'strategic'>('milestones');

  // Custom Panel Creator / Settings Modal State
  const [showCustomPanelModal, setShowCustomPanelModal] = useState(false);
  const [editingPanelId, setEditingPanelId] = useState<string | null>(null);
  const [newPanelTitle, setNewPanelTitle] = useState('');
  const [newPanelType, setNewPanelType] = useState<CustomPanelType>('checklist');
  const [newPanelColor, setNewPanelColor] = useState<CustomPanelColor>('cyan');
  const [newPanelSpan, setNewPanelSpan] = useState<1 | 2 | 3 | 'full'>(1);
  const [newCounterTarget, setNewCounterTarget] = useState('8');
  const [newCounterUnit, setNewCounterUnit] = useState('cups');
  const [newCounterStep, setNewCounterStep] = useState('1');

  const isCustomPanelDirty = Boolean(
    showCustomPanelModal && !editingPanelId && newPanelTitle.trim().length > 0
  );

  const customPanelGuard = useModalGuard({
    isOpen: showCustomPanelModal,
    isDirty: isCustomPanelDirty,
    onClose: () => setShowCustomPanelModal(false),
  });

  // Draft inputs for custom panels
  const [customItemDrafts, setCustomItemDrafts] = useState<Record<string, string>>({});
  const [customHabitDrafts, setCustomHabitDrafts] = useState<Record<string, string>>({});
  const [customKvLabelDrafts, setCustomKvLabelDrafts] = useState<Record<string, string>>({});
  const [customKvValueDrafts, setCustomKvValueDrafts] = useState<Record<string, string>>({});

  // Dashboard User Profile Header Quick-Edit State
  const [isEditingDashboardProfile, setIsEditingDashboardProfile] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState('');
  const [profileGuildDraft, setProfileGuildDraft] = useState('');

  // Quick Daily Note & Weather Location Setup State on Dashboard
  const [quickNoteTitle, setQuickNoteTitle] = useState('');
  const [quickNoteContent, setQuickNoteContent] = useState('');
  const [dashboardNotesSubTab, setDashboardNotesSubTab] = useState<'today' | 'pinned'>('today');
  const [weatherSearchQuery, setWeatherSearchQuery] = useState('');
  const [isEditingWeatherLocation, setIsEditingWeatherLocation] = useState(false);

  // Frequent Events Quick Add Dashboard Panel State
  const [frequentSearchQuery, setFrequentSearchQuery] = useState('');
  const [frequentCategoryFilter, setFrequentCategoryFilter] = useState<string>('all');
  const [isFrequentManageMode, setIsFrequentManageMode] = useState(false);
  const [showFrequentInlineForm, setShowFrequentInlineForm] = useState(false);
  const [editingFrequentId, setEditingFrequentId] = useState<string | undefined>(undefined);
  const [freqTitleDraft, setFreqTitleDraft] = useState('');
  const [freqCategoryDraft, setFreqCategoryDraft] = useState<string>('work');
  const [freqDurationDraft, setFreqDurationDraft] = useState('60');
  const [freqStartDraft, setFreqStartDraft] = useState('09:00');
  const [freqNotesDraft, setFreqNotesDraft] = useState('');
  const [justLoggedFrequentIds, setJustLoggedFrequentIds] = useState<Record<string, boolean>>({});

  const handleQuickLogFrequentEvent = async (fe: FrequentEvent) => {
    if (isColumnEditMode) return;
    const newEntry = createTimelineEntryFromFrequentEvent(fe, new Date());
    setJustLoggedFrequentIds((prev) => ({ ...prev, [fe.id]: true }));
    window.setTimeout(() => {
      setJustLoggedFrequentIds((prev) => {
        const next = { ...prev };
        delete next[fe.id];
        return next;
      });
    }, 1200);

    await updateAppData((prev) => ({
      ...prev,
      timeline: [newEntry, ...prev.timeline],
    }));

    showNotification(
      `⚡ Logged "${fe.title}" (${formatMinutes(newEntry.durationMinutes)}) to today's timeline!`,
      'success'
    );
  };

  const handleSaveFrequentTemplateInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appData || !freqTitleDraft.trim()) return;
    const isEditingExisting = Boolean(editingFrequentId);
    const res = upsertFrequentEventTemplate(appData.frequentEvents || [], {
      id: editingFrequentId,
      title: freqTitleDraft,
      category: freqCategoryDraft,
      durationMinutes: parseInt(freqDurationDraft, 10) || 60,
      startTime: freqStartDraft,
      notes: freqNotesDraft,
    });
    if (!res) return;

    const loggedEntry = !isEditingExisting
      ? createTimelineEntryFromFrequentEvent(res.item, new Date())
      : null;

    await updateAppData((prev) => ({
      ...prev,
      frequentEvents: res.nextEvents,
      timeline: loggedEntry ? [loggedEntry, ...prev.timeline] : prev.timeline,
    }));

    showNotification(
      isEditingExisting
        ? `Updated template "${res.item.title}"!`
        : `Added & logged "${res.item.title}" (${formatMinutes(res.item.durationMinutes)}) to today's timeline!`,
      'success'
    );
    setFreqTitleDraft('');
    setFreqNotesDraft('');
    setEditingFrequentId(undefined);
    setShowFrequentInlineForm(false);
  };

  const handleStartEditFrequentTemplate = (fe: FrequentEvent) => {
    setEditingFrequentId(fe.id);
    setFreqTitleDraft(fe.title);
    setFreqCategoryDraft(fe.category || 'work');
    setFreqDurationDraft(String(fe.durationMinutes || 60));
    setFreqStartDraft(fe.startTime || '09:00');
    setFreqNotesDraft(fe.notes || '');
    setShowFrequentInlineForm(true);
  };

  const handleDeleteFrequentTemplateInline = async (id: string, title: string) => {
    await updateAppData((prev) => ({
      ...prev,
      frequentEvents: (prev.frequentEvents || []).filter((fe) => fe.id !== id),
    }));
    showNotification(`Removed template "${title}" from Frequent Events.`, 'info');
  };

  const handleMoveFrequentTemplateInline = async (index: number, direction: 'up' | 'down') => {
    if (!appData) return;
    const reordered = moveFrequentEventTemplate(appData.frequentEvents || [], index, direction);
    await updateAppData((prev) => ({
      ...prev,
      frequentEvents: reordered,
    }));
  };

  if (!appData) return null;

  const matrixCards = layoutConfig.widgets;
  const visibleCards = matrixCards.filter((w) => w.visible);
  const hiddenCards = matrixCards.filter((w) => !w.visible);
  const gridCols = layoutConfig.gridColumns || 3;

  const todayStr = new Date().toISOString().split('T')[0];
  const last7Days = getLast7DayStrings(todayStr);
  const now = new Date();
  const localTodayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
  const currentMinuteOfDay = now.getHours() * 60 + now.getMinutes();

  // Computations
  const fundsSummary = calculateFundsSummary(
    appData.funds,
    appData.settings.startingBalance || 0
  );

  const distanceSummary = calculateDistanceSummary(
    appData.distances,
    appData.settings.distanceUnit || 'mi',
    todayStr
  );

  const todayTimelineEntries = appData.timeline.filter(
    (e) => e.date === todayStr || e.date === localTodayStr
  );
  const timelineSummary = calculateTimelineSummary(todayTimelineEntries);
  const allTimelineSummary = calculateTimelineSummary(appData.timeline);
  const statsSummary = calculateStatsSummary(appData.lifeStats);
  const runwaySummary = calculateFinancialRunwayAndBurn(
    appData.funds,
    appData.settings.startingBalance || 0
  );
  const biometricsCorrelation = calculateBiometricsCorrelation(
    appData.lifeStats,
    appData.timeline
  );
  const activeGoals = syncGoalsWithLiveModules(
    appData.goals || [],
    fundsSummary.currentBalance,
    appData.lifeStats,
    { distances: appData.distances || [] }
  );
  const completedGoals = activeGoals.filter(
    (g) => g.status === 'completed' || calculateGoalProgress(g) === 100
  );

  // Extract tactical short-term milestones mapped to parent strategic goals
  const tacticalMilestones = activeGoals.flatMap((g) =>
    (g.milestones || []).map((m) => ({
      ...m,
      parentGoalId: g.id,
      parentGoalTitle: g.title,
      parentCategory: g.category,
    }))
  );
  const completedMilestonesCount = tacticalMilestones.filter((m) => m.completed).length;

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const activeProfileDisplayName =
    appData.settings.commanderName ||
    appData.settings.userName ||
    accountSession?.displayName ||
    'User';
  const activeProfileUsername = accountSession?.username || 'local_vault';
  const activeProfileGuild = appData.settings.guildName || 'Aegis Vanguard';
  const activeProfileAvatar = appData.settings.avatarDataUrl || '';

  const totalVaultRecordsCount =
    (appData.timeline?.length || 0) +
    (appData.dailyNotes?.length || 0) +
    (appData.funds?.length || 0) +
    (appData.bills?.length || 0) +
    (appData.distances?.length || 0) +
    (appData.lifeStats?.length || 0) +
    (appData.goals?.length || 0) +
    (appData.gallery?.length || 0);

  const handleOpenDashboardProfileEditor = () => {
    setProfileNameDraft(activeProfileDisplayName);
    setProfileGuildDraft(activeProfileGuild);
    setIsEditingDashboardProfile((prev) => !prev);
  };

  const handleSaveDashboardProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = profileNameDraft.trim() || 'User';
    const cleanGuild = profileGuildDraft.trim() || 'Aegis Vanguard';
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
    setIsEditingDashboardProfile(false);
    showNotification('Profile updated and synced to VaultContext.', 'success');
  };

  const handleDashboardAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
      showNotification('Could not process selected photo.', 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Interactive Milestone Checkbox Toggle right from the Dashboard
  const handleToggleGoalMilestone = async (goalId: string, milestoneId: string) => {
    await updateAppData((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const updatedMilestones = (g.milestones || []).map((m) =>
          m.id === milestoneId
            ? { ...m, completed: !m.completed, manualOverride: true }
            : m
        );
        const allDone =
          updatedMilestones.length > 0 && updatedMilestones.every((m) => m.completed);
        return {
          ...g,
          milestones: updatedMilestones,
          status: allDone ? 'completed' : 'in_progress',
        };
      }),
    }));
    showNotification('Milestone status updated & goal progress recalculated.', 'info');
  };

  // 2D Movement Handler
  const handleMoveCard2D = (visibleIndex: number, direction: MatrixDirection) => {
    if (!canMoveInMatrix(visibleIndex, visibleCards.length, direction, gridCols)) return;
    const reorderedVisible = moveCardInMatrix(visibleCards, visibleIndex, direction, gridCols);
    const combined = [...reorderedVisible, ...hiddenCards].map((w, idx) => ({
      ...w,
      order: idx,
    }));

    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: combined,
    }));

    const dirLabel =
      direction === 'left'
        ? '← Left'
        : direction === 'right'
        ? '→ Right'
        : direction === 'up'
        ? `↑ Up (Row -1)`
        : `↓ Down (Row +1)`;
    showNotification(`Moved panel ${dirLabel} & synced to cloud vault.`, 'info');
  };

  // HTML5 Drag-and-Drop Reorder Handler
  const handleDropCard = (fromVisibleIdx: number, toVisibleIdx: number) => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (fromVisibleIdx === toVisibleIdx) return;

    const reorderedVisible = dragReorderInMatrix(visibleCards, fromVisibleIdx, toVisibleIdx);
    const combined = [...reorderedVisible, ...hiddenCards].map((w, idx) => ({
      ...w,
      order: idx,
    }));

    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: combined,
    }));
    showNotification('Panel repositioned via 2D Drag & Drop and saved!', 'info');
  };

  // Inline Panel Title Edit Handler
  const handleInlineTitleCommit = (widgetId: DashboardWidgetId, rawText: string) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: updateMatrixCardTitle(prev.widgets, widgetId, rawText),
    }));
    showNotification('Panel title updated & saved to cloud vault.', 'info');
  };

  // Panel Width Span Change Handler (1x, 2x, 3x, Full)
  const handleChangeColSpan = (widgetId: DashboardWidgetId, span: 1 | 2 | 3 | 'full') => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: updateMatrixCardSpan(prev.widgets, widgetId, span),
    }));
    showNotification(
      `Panel width set to ${span === 'full' ? 'Full Row' : `${span}x Span`} & synced.`,
      'info'
    );
  };

  // Toggle Panel Visibility
  const handleToggleVisibility = (widgetId: DashboardWidgetId) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: toggleMatrixCardVisibility(prev.widgets, widgetId),
    }));
    showNotification('Panel visibility updated.', 'info');
  };

  // Open Modal to Create or Edit a Custom Panel
  const handleOpenCreatePanelModal = () => {
    setEditingPanelId(null);
    setNewPanelTitle('');
    setNewPanelType('checklist');
    setNewPanelColor('cyan');
    setNewPanelSpan(1);
    setNewCounterTarget('8');
    setNewCounterUnit('cups');
    setNewCounterStep('1');
    setShowCustomPanelModal(true);
  };

  const handleOpenEditPanelModal = (widget: DashboardWidgetConfig) => {
    setEditingPanelId(widget.id);
    setNewPanelTitle(getCardTitle(widget));
    setNewPanelType(widget.panelType || 'checklist');
    setNewPanelColor(widget.panelColor || 'cyan');
    setNewPanelSpan(normalizeColSpan(widget.colSpan));
    setNewCounterTarget(String(widget.customCounter?.targetValue ?? 8));
    setNewCounterUnit(widget.customCounter?.unit || 'units');
    setNewCounterStep(String(widget.customCounter?.step ?? 1));
    setShowCustomPanelModal(true);
  };

  const handleSaveCustomPanelModal = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newPanelTitle.trim() || 'Custom Tactical Panel';
    const targetNum = Math.max(1, parseFloat(newCounterTarget) || 8);
    const stepNum = Math.max(0.1, parseFloat(newCounterStep) || 1);

    if (editingPanelId) {
      updateLayoutConfig((prev) => ({
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === editingPanelId
            ? {
                ...w,
                customTitle: title,
                colSpan: newPanelSpan,
                panelType: w.isCustom ? newPanelType : w.panelType,
                panelColor: newPanelColor,
                customCounter:
                  newPanelType === 'counter'
                    ? {
                        currentValue: w.customCounter?.currentValue ?? 0,
                        targetValue: targetNum,
                        unit: newCounterUnit.trim() || 'units',
                        step: stepNum,
                      }
                    : w.customCounter,
              }
            : w
        ),
      }));
      showNotification(`Updated panel "${title}" settings!`, 'success');
    } else {
      updateLayoutConfig((prev) => ({
        ...prev,
        widgets: createCustomMatrixColumn(prev.widgets, title, {
          colSpan: newPanelSpan,
          panelType: newPanelType,
          panelColor: newPanelColor,
          targetValue: targetNum,
          unit: newCounterUnit.trim() || 'units',
          step: stepNum,
        }),
      }));
      showNotification(`Created custom ${newPanelType} panel "${title}"!`, 'success');
    }

    setShowCustomPanelModal(false);
    setEditingPanelId(null);
  };

  // Delete Custom Panel
  const handleDeleteCustomPanel = (widgetId: DashboardWidgetId) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets
        .filter((w) => w.id !== widgetId)
        .map((w, idx) => ({ ...w, order: idx })),
    }));
    showNotification('Custom panel removed from dashboard.', 'info');
  };

  // Custom Panel Template 1: Action Checklist Handlers
  const handleAddChecklistItem = (widgetId: DashboardWidgetId) => {
    const text = (customItemDrafts[widgetId] || '').trim();
    if (!text) return;
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customItems: [
                ...(w.customItems || []),
                { id: `ci-${Date.now()}`, text, completed: false },
              ],
            }
          : w
      ),
    }));
    setCustomItemDrafts((prev) => ({ ...prev, [widgetId]: '' }));
  };

  const handleToggleChecklistItem = (widgetId: DashboardWidgetId, itemId: string) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customItems: (w.customItems || []).map((item) =>
                item.id === itemId ? { ...item, completed: !item.completed } : item
              ),
            }
          : w
      ),
    }));
  };

  const handleEditChecklistItemText = (
    widgetId: DashboardWidgetId,
    itemId: string,
    newText: string
  ) => {
    const clean = newText.trim();
    if (!clean) return;
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customItems: (w.customItems || []).map((item) =>
                item.id === itemId ? { ...item, text: clean } : item
              ),
            }
          : w
      ),
    }));
  };

  const handleDeleteChecklistItem = (widgetId: DashboardWidgetId, itemId: string) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customItems: (w.customItems || []).filter((item) => item.id !== itemId),
            }
          : w
      ),
    }));
  };

  const handleClearCompletedChecklist = (widgetId: DashboardWidgetId) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customItems: (w.customItems || []).filter((item) => !item.completed),
            }
          : w
      ),
    }));
    showNotification('Cleared completed checklist items.', 'info');
  };

  // Custom Panel Template 2: Encrypted Notes / Scratchpad Handler
  const handleUpdateCustomNotes = (widgetId: DashboardWidgetId, notes: string) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId ? { ...w, customNotes: notes } : w
      ),
    }));
  };

  // Custom Panel Template 3: Metric & Target Counter Handler
  const handleAdjustCounter = (widgetId: DashboardWidgetId, delta: number) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        const curr = w.customCounter || {
          currentValue: 0,
          targetValue: 8,
          unit: 'units',
          step: 1,
        };
        const nextVal = Math.max(0, Math.round((curr.currentValue + delta) * 100) / 100);
        return {
          ...w,
          customCounter: {
            ...curr,
            currentValue: nextVal,
          },
        };
      }),
    }));
  };

  // Custom Panel Template 4: Daily Habit Tracker Handlers
  const handleAddHabit = (widgetId: DashboardWidgetId) => {
    const title = (customHabitDrafts[widgetId] || '').trim();
    if (!title) return;
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customHabits: [
                ...(w.customHabits || []),
                { id: `hab-${Date.now()}`, title, completedDates: [] },
              ],
            }
          : w
      ),
    }));
    setCustomHabitDrafts((prev) => ({ ...prev, [widgetId]: '' }));
  };

  const handleToggleHabitDate = (
    widgetId: DashboardWidgetId,
    habitId: string,
    dateStr: string
  ) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) => {
        if (w.id !== widgetId) return w;
        return {
          ...w,
          customHabits: (w.customHabits || []).map((h) => {
            if (h.id !== habitId) return h;
            const exists = h.completedDates.includes(dateStr);
            const nextDates = exists
              ? h.completedDates.filter((d) => d !== dateStr)
              : [...h.completedDates, dateStr];
            return { ...h, completedDates: nextDates };
          }),
        };
      }),
    }));
  };

  const handleDeleteHabit = (widgetId: DashboardWidgetId, habitId: string) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customHabits: (w.customHabits || []).filter((h) => h.id !== habitId),
            }
          : w
      ),
    }));
  };

  // Custom Panel Template 5: Key-Value Data Card Handlers
  const handleAddKeyValue = (widgetId: DashboardWidgetId) => {
    const label = (customKvLabelDrafts[widgetId] || '').trim();
    const value = (customKvValueDrafts[widgetId] || '').trim();
    if (!label || !value) return;
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customKeyValues: [
                ...(w.customKeyValues || []),
                { id: `kv-${Date.now()}`, label, value },
              ],
            }
          : w
      ),
    }));
    setCustomKvLabelDrafts((prev) => ({ ...prev, [widgetId]: '' }));
    setCustomKvValueDrafts((prev) => ({ ...prev, [widgetId]: '' }));
  };

  const handleUpdateKeyValue = (
    widgetId: DashboardWidgetId,
    kvId: string,
    field: 'label' | 'value',
    newVal: string
  ) => {
    const clean = newVal.trim();
    if (!clean) return;
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customKeyValues: (w.customKeyValues || []).map((kv) =>
                kv.id === kvId ? { ...kv, [field]: clean } : kv
              ),
            }
          : w
      ),
    }));
  };

  const handleDeleteKeyValue = (widgetId: DashboardWidgetId, kvId: string) => {
    updateLayoutConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId
          ? {
              ...w,
              customKeyValues: (w.customKeyValues || []).filter((kv) => kv.id !== kvId),
            }
          : w
      ),
    }));
  };


  const handleResetMatrixLayout = () => {
    updateLayoutConfig(() => ({
      ...DEFAULT_LAYOUT_CONFIG,
      widgets: DEFAULT_DASHBOARD_WIDGETS.map((w, idx) => ({ ...w, order: idx })),
    }));
    showNotification(`All dashboard panels reset to ${APP_VERSION} defaults.`, 'info');
  };

  const getCardTitle = (widget: DashboardWidgetConfig): string => {
    return widget.customTitle || DEFAULT_WIDGET_TITLES[widget.id] || 'Custom Panel';
  };

  const cardPadClass =
    layoutConfig.density === 'compact'
      ? 'px-4 py-5 min-h-[330px] shadow-[0_12px_34px_-6px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/[0.03]'
      : layoutConfig.density === 'spacious'
      ? 'px-7 py-8 min-h-[440px] shadow-[0_16px_44px_-6px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-white/[0.04]'
      : 'px-5 py-6 sm:px-6 sm:py-7 min-h-[380px] sm:min-h-[400px] shadow-[0_14px_38px_-6px_rgba(0,0,0,0.92)] ring-1 ring-inset ring-white/[0.03]';

  const gridGapClass =
    layoutConfig.density === 'compact'
      ? 'gap-3.5'
      : layoutConfig.density === 'spacious'
      ? 'gap-6'
      : 'gap-5';

  const gridColsClass =
    gridCols === 2
      ? 'grid-cols-1 md:grid-cols-2'
      : gridCols === 4
      ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
      : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';

  const autoFitGridStyle: React.CSSProperties = {
    gridTemplateColumns:
      gridCols === 2
        ? 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))'
        : gridCols === 4
        ? 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))'
        : 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
    gridAutoRows:
      layoutConfig.density === 'compact'
        ? 'minmax(330px, auto)'
        : layoutConfig.density === 'spacious'
        ? 'minmax(440px, auto)'
        : 'minmax(390px, auto)',
  };

  const renderEditableHeaderTitle = (
    widget: DashboardWidgetConfig,
    textClassName: string = 'text-sm font-bold text-white'
  ) => {
    const currentTitle = getCardTitle(widget);
    return (
      <h2
        contentEditable={isColumnEditMode}
        suppressContentEditableWarning
        onClick={(e) => {
          if (isColumnEditMode) {
            e.stopPropagation();
          }
        }}
        onKeyDown={(e) => {
          if (isColumnEditMode && e.key === 'Enter') {
            e.preventDefault();
            (e.currentTarget as HTMLElement).blur();
          }
        }}
        onBlur={(e) => {
          if (isColumnEditMode) {
            handleInlineTitleCommit(widget.id, e.currentTarget.textContent || '');
          }
        }}
        data-testid={`editable-title-${widget.id}`}
        title={isColumnEditMode ? 'Click to edit panel title inline' : currentTitle}
        className={`${textClassName} transition-colors ${
          isColumnEditMode
            ? 'px-2 py-0.5 rounded bg-purple-950/70 border border-dashed border-purple-400 text-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-text'
            : ''
        }`}
      >
        {currentTitle}
      </h2>
    );
  };

  // Renders any of the 5 Custom Panel Templates
  const renderCustomPanelContent = (widget: DashboardWidgetConfig) => {
    const pType: CustomPanelType = widget.panelType || 'checklist';
    const pColor: CustomPanelColor = widget.panelColor || 'cyan';
    const styles = getPanelColorStyle(pColor);

    const typeIcon =
      pType === 'checklist' ? (
        <ListChecks className={`w-4 h-4 ${styles.text} shrink-0`} />
      ) : pType === 'notes' ? (
        <FileText className={`w-4 h-4 ${styles.text} shrink-0`} />
      ) : pType === 'counter' ? (
        <Hash className={`w-4 h-4 ${styles.text} shrink-0`} />
      ) : pType === 'habits' ? (
        <Flame className={`w-4 h-4 ${styles.text} shrink-0`} />
      ) : (
        <KeyRound className={`w-4 h-4 ${styles.text} shrink-0`} />
      );

    return (
      <div
        className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full transition-colors`}
      >
        <div>
          {/* Panel Header */}
          <div className="flex flex-wrap items-center justify-between mb-3 pb-2.5 border-b border-[#1E222B] gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {typeIcon}
              {renderEditableHeaderTitle(widget)}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border ${styles.badge}`}
              >
                {pType.replace('_', '-')}
              </span>
              <button
                type="button"
                onClick={() => handleOpenEditPanelModal(widget)}
                title="Configure Panel Settings"
                className="p-1 rounded-lg bg-[#000000] hover:border-zinc-600 text-zinc-400 hover:text-white border border-[#1E222B]"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* TEMPLATE 1: ACTION CHECKLIST */}
          {pType === 'checklist' && (
            <div className="space-y-2 my-2">
              {(widget.customItems || []).length === 0 ? (
                <p className="text-xs text-zinc-500 py-3 text-center">
                  No checklist items yet. Add one below.
                </p>
              ) : (
                (widget.customItems || []).map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg bg-[#000000] hover:border-zinc-700 border border-[#1E222B] flex items-center justify-between gap-2 group transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => handleToggleChecklistItem(widget.id, item.id)}
                        data-testid={`checklist-toggle-${item.id}`}
                        className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                          item.completed
                            ? `${styles.bar} border-transparent text-black`
                            : 'border-zinc-600 hover:border-zinc-400 bg-zinc-900'
                        }`}
                      >
                        {item.completed && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                      <span
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) =>
                          handleEditChecklistItemText(
                            widget.id,
                            item.id,
                            e.currentTarget.textContent || ''
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            (e.currentTarget as HTMLElement).blur();
                          }
                        }}
                        title="Click to edit item text inline"
                        className={`text-xs font-medium flex-1 truncate cursor-text focus:outline-none focus:underline ${
                          item.completed ? 'line-through text-zinc-500' : 'text-zinc-100'
                        }`}
                      >
                        {item.text}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteChecklistItem(widget.id, item.id)}
                      data-testid={`checklist-delete-${item.id}`}
                      title="Delete item"
                      aria-label={`Delete ${item.text}`}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TEMPLATE 2: ENCRYPTED NOTES / SCRATCHPAD */}
          {pType === 'notes' && (
            <div className="space-y-2 my-2">
              <textarea
                rows={5}
                value={widget.customNotes || ''}
                onChange={(e) => handleUpdateCustomNotes(widget.id, e.target.value)}
                data-testid={`custom-notes-textarea-${widget.id}`}
                placeholder="Type encrypted scratchpad notes, protocols, or markdown snippets..."
                className="w-full p-3 rounded-lg bg-[#09090b] border border-[#18181b] text-xs text-zinc-100 placeholder-zinc-500 font-mono leading-relaxed focus:outline-none focus:border-zinc-600 resize-y"
              />
            </div>
          )}

          {/* TEMPLATE 3: METRIC & TARGET COUNTER */}
          {pType === 'counter' && (() => {
            const cnt = widget.customCounter || {
              currentValue: 0,
              targetValue: 8,
              unit: 'units',
              step: 1,
            };
            const pct = Math.min(
              100,
              Math.max(0, Math.round((cnt.currentValue / (cnt.targetValue || 1)) * 100))
            );
            return (
              <div className="space-y-3 my-2">
                <div className="p-3.5 rounded-xl bg-[#09090b] border border-[#18181b] flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-mono text-zinc-400 uppercase">
                      Current / Target
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5 font-mono tabular-nums">
                      <span
                        data-testid={`counter-value-${widget.id}`}
                        className="text-2xl font-black text-white"
                      >
                        {cnt.currentValue}
                      </span>
                      <span className="text-sm text-zinc-400">
                        / {cnt.targetValue} {cnt.unit}
                      </span>
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-bold tabular-nums ${styles.text}`}>
                    {pct}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-[#09090b] rounded-full overflow-hidden border border-[#18181b]">
                  <div
                    className={`h-full ${styles.bar} rounded-full transition-all duration-300`}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Increment / Decrement Controls */}
                <div className="grid grid-cols-4 gap-2 pt-1 font-mono">
                  <button
                    type="button"
                    onClick={() => handleAdjustCounter(widget.id, -1)}
                    data-testid={`counter-dec-${widget.id}`}
                    className="py-1.5 px-2 rounded-lg bg-[#09090b] hover:bg-zinc-800 border border-[#18181b] text-xs font-semibold text-zinc-300 flex items-center justify-center gap-1"
                  >
                    <Minus className="w-3 h-3" />1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustCounter(widget.id, 1)}
                    data-testid={`counter-inc-${widget.id}`}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-bold flex items-center justify-center gap-1 ${styles.badge}`}
                  >
                    <Plus className="w-3 h-3" />1
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustCounter(widget.id, cnt.step || 5)}
                    className="py-1.5 px-2 rounded-lg bg-[#09090b] hover:bg-zinc-800 border border-[#18181b] text-xs font-semibold text-zinc-300"
                  >
                    +{cnt.step || 5}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAdjustCounter(widget.id, -cnt.currentValue)}
                    className="py-1.5 px-2 rounded-lg bg-[#09090b] hover:bg-zinc-800 border border-[#18181b] text-xs text-zinc-400 hover:text-white"
                  >
                    Zero
                  </button>
                </div>
              </div>
            );
          })()}

          {/* TEMPLATE 4: DAILY HABIT TRACKER (7-Day Matrix + Streak) */}
          {pType === 'habits' && (
            <div className="space-y-2 my-2">
              {(widget.customHabits || []).map((hab) => {
                const streak = calculateHabitStreak(hab.completedDates, todayStr);
                return (
                  <div
                    key={hab.id}
                    className="p-2.5 rounded-lg bg-[#09090b] border border-[#18181b] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => handleDeleteHabit(widget.id, hab.id)}
                          className="text-zinc-600 hover:text-rose-400 shrink-0"
                          title="Delete habit"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-semibold text-zinc-100 truncate">
                          {hab.title}
                        </span>
                      </div>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold tabular-nums shrink-0 ${styles.badge}`}
                      >
                        {streak}d streak
                      </span>
                    </div>

                    <div className="grid grid-cols-7 gap-1 pt-0.5">
                      {last7Days.map((dStr) => {
                        const done = hab.completedDates.includes(dStr);
                        return (
                          <button
                            key={dStr}
                            type="button"
                            onClick={() => handleToggleHabitDate(widget.id, hab.id, dStr)}
                            data-testid={`habit-dot-${hab.id}-${dStr}`}
                            title={`${hab.title} on ${dStr}: ${done ? 'Completed' : 'Incomplete'}`}
                            className={`py-1 rounded-md border flex flex-col items-center justify-center gap-0.5 transition-all ${
                              done
                                ? `${styles.bar} border-transparent text-black font-bold`
                                : 'bg-zinc-900/90 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                            }`}
                          >
                            <span className="text-[9px] font-mono leading-none opacity-80">
                              {dStr.slice(8)}
                            </span>
                            {done ? (
                              <Check className="w-3 h-3 stroke-[3]" />
                            ) : (
                              <span className="w-3 h-3 flex items-center justify-center text-[9px] opacity-40">
                                ·
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TEMPLATE 5: KEY-VALUE DATA CARD */}
          {pType === 'key_value' && (
            <div className="space-y-1.5 my-2">
              {(widget.customKeyValues || []).map((kv) => (
                <div
                  key={kv.id}
                  className="p-2.5 rounded-lg bg-[#09090b] border border-[#18181b] flex items-center justify-between gap-2 text-xs"
                >
                  <span
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) =>
                      handleUpdateKeyValue(
                        widget.id,
                        kv.id,
                        'label',
                        e.currentTarget.textContent || ''
                      )
                    }
                    className="text-zinc-400 font-mono truncate cursor-text focus:outline-none focus:underline"
                    title="Click to edit label"
                  >
                    {kv.label}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      contentEditable
                      suppressContentEditableWarning
                      onBlur={(e) =>
                        handleUpdateKeyValue(
                          widget.id,
                          kv.id,
                          'value',
                          e.currentTarget.textContent || ''
                        )
                      }
                      className={`font-mono font-bold tabular-nums cursor-text focus:outline-none focus:underline ${styles.text}`}
                      title="Click to edit value"
                    >
                      {kv.value}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteKeyValue(widget.id, kv.id)}
                      className="text-zinc-600 hover:text-rose-400"
                      title="Remove pair"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Controls per Template */}
        {pType === 'checklist' && (
          <div className="pt-3 mt-2 border-t border-zinc-800/60 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customItemDrafts[widget.id] || ''}
                onChange={(e) =>
                  setCustomItemDrafts((prev) => ({ ...prev, [widget.id]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem(widget.id);
                  }
                }}
                placeholder="Add checklist item..."
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#09090b] border border-[#18181b] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
              />
              <button
                type="button"
                onClick={() => handleAddChecklistItem(widget.id)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${styles.badge}`}
              >
                Add
              </button>
              {(widget.customItems || []).some((i) => i.completed) && (
                <button
                  type="button"
                  onClick={() => handleClearCompletedChecklist(widget.id)}
                  data-testid={`checklist-clear-done-${widget.id}`}
                  className="px-2 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 text-xs font-mono whitespace-nowrap"
                >
                  Clear Done
                </button>
              )}
            </div>
          </div>
        )}

        {pType === 'notes' && (
          <div className="pt-2.5 mt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs font-mono text-zinc-400">
            <span>{(widget.customNotes || '').length} chars · Auto-saved</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(widget.customNotes || '');
                showNotification('Copied scratchpad notes to clipboard!', 'success');
              }}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 flex items-center gap-1.5"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
          </div>
        )}

        {pType === 'habits' && (
          <div className="pt-3 mt-2 border-t border-zinc-800/60 flex items-center gap-2">
            <input
              type="text"
              value={customHabitDrafts[widget.id] || ''}
              onChange={(e) =>
                setCustomHabitDrafts((prev) => ({ ...prev, [widget.id]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddHabit(widget.id);
                }
              }}
              placeholder="New daily habit..."
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#09090b] border border-[#18181b] text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleAddHabit(widget.id)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${styles.badge}`}
            >
              + Habit
            </button>
          </div>
        )}

        {pType === 'key_value' && (
          <div className="pt-3 mt-2 border-t border-zinc-800/60 flex items-center gap-1.5">
            <input
              type="text"
              value={customKvLabelDrafts[widget.id] || ''}
              onChange={(e) =>
                setCustomKvLabelDrafts((prev) => ({ ...prev, [widget.id]: e.target.value }))
              }
              placeholder="Label"
              className="w-2/5 px-2 py-1.5 rounded-lg bg-[#09090b] border border-[#18181b] text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <input
              type="text"
              value={customKvValueDrafts[widget.id] || ''}
              onChange={(e) =>
                setCustomKvValueDrafts((prev) => ({ ...prev, [widget.id]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeyValue(widget.id);
                }
              }}
              placeholder="Value"
              className="flex-1 px-2 py-1.5 rounded-lg bg-[#09090b] border border-[#18181b] text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleAddKeyValue(widget.id)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold shrink-0 ${styles.badge}`}
            >
              Add
            </button>
          </div>
        )}
      </div>
    );
  };

  // Renders any built-in panel or custom panel inside the 2D grid
  const renderMatrixCardContent = (widget: DashboardWidgetConfig) => {
    switch (widget.id) {


      case 'mini_calendar': {
        const upcomingSegments = getUpcomingScheduleSegments(appData.timeline, todayStr, 5);
        const sevenDays = getLast7DayStrings(todayStr);
        const upcomingRecurring = runwaySummary.upcomingRecurringItems.slice(0, 2);

        return (
          <div
            data-testid="dashboard-mini-calendar-widget"
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] h-full flex flex-col justify-between transition-colors`}
          >
            <div>
              {/* Anti-Truncation Header: Title + Secondary Action Row */}
              <div className="flex flex-wrap items-center justify-between mb-3.5 pb-3 border-b border-[#1E222B] gap-x-2 gap-y-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-4 h-4 text-cyan-400 shrink-0" />
                  {renderEditableHeaderTitle(widget, 'text-xs sm:text-sm font-bold text-white leading-snug')}
                </div>
                <button
                  type="button"
                  data-testid="mini-calendar-open-full-btn"
                  onClick={() => !isColumnEditMode && setActiveTab('calendar')}
                  className="px-2 py-0.5 rounded-md bg-[#000000] border border-[#1E222B] hover:border-cyan-500/40 text-[11px] text-cyan-300 hover:text-white flex items-center gap-0.5 shrink-0 whitespace-nowrap font-mono font-semibold ml-auto"
                >
                  <span>Full Calendar</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {/* 7-Day Interactive Strip */}
              <div className="grid grid-cols-7 gap-1 mb-3.5">
                {sevenDays.map((isoDay) => {
                  const dayNum = Number(isoDay.slice(8, 10));
                  const dayCount = appData.timeline.filter((t) => t.date === isoDay).length;
                  const isTodayCell = isoDay === todayStr;
                  const isSel = isoDay === (selectedCalendarDate || todayStr);
                  return (
                    <button
                      key={isoDay}
                      type="button"
                      data-testid={`mini-calendar-day-${isoDay}`}
                      onClick={() => {
                        if (isColumnEditMode) return;
                        setSelectedCalendarDate(isoDay);
                        setActiveTab('calendar');
                      }}
                      title={`Inspect ${isoDay} in Unified Calendar (${dayCount} activities)`}
                      className={`py-2 px-1 rounded-lg bg-[#000000] border text-center font-mono tabular-nums transition-colors ${
                        isTodayCell || isSel
                          ? 'border-cyan-500/60 text-white font-bold'
                          : 'border-[#1E222B] text-zinc-400 hover:text-white hover:border-[#2E3442]'
                      }`}
                    >
                      <div className="text-[10px] leading-none">{dayNum}</div>
                      <div className="mt-1.5 flex justify-center">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            dayCount > 0 ? 'bg-emerald-400' : 'bg-zinc-800'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Upcoming & Active Schedule (Two-row anti-truncation card layout) */}
              <div className="space-y-1.5">
                {upcomingSegments.length === 0 ? (
                  <div className="py-5 text-center text-xs text-zinc-400 space-y-1.5">
                    <p>No upcoming events scheduled.</p>
                    <button
                      type="button"
                      onClick={() => !isColumnEditMode && openQuickAdd('timeline', selectedCalendarDate)}
                      className="text-emerald-400 hover:underline font-medium"
                    >
                      + Add Activity
                    </button>
                  </div>
                ) : (
                  upcomingSegments.map((seg) => (
                    <button
                      key={seg.segmentId}
                      type="button"
                      onClick={() => {
                        if (isColumnEditMode) return;
                        setSelectedCalendarDate(seg.date);
                        setActiveTab('calendar');
                      }}
                      className="w-full p-2.5 rounded-lg bg-[#000000] hover:border-zinc-700 border border-[#1E222B] flex flex-col gap-1 text-left transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <span className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-snug">
                          {seg.entry.title}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums shrink-0">
                          {formatMinutes(seg.segmentDurationMinutes)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums text-zinc-400">
                        <span>
                          {seg.date} · {seg.displayStartTime} → {seg.displayEndTime}
                        </span>
                        {seg.isMultiDay && (
                          <span className="px-1 py-0.2 rounded text-[9px] font-mono bg-[#000000] border border-cyan-500/40 text-cyan-300 shrink-0">
                            D{seg.spanDayIndex}/{seg.spanTotalDays}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}

                {/* Projected Recurring Bills & Income */}
                {upcomingRecurring.length > 0 && (
                  <div
                    data-testid="mini-calendar-recurring-list"
                    className="pt-1.5 space-y-1.5"
                  >
                    {upcomingRecurring.map((rec) => (
                      <button
                        key={rec.id}
                        type="button"
                        onClick={() => !isColumnEditMode && setActiveTab('funds')}
                        className="w-full p-2 rounded-lg bg-[#000000] hover:border-cyan-500/40 border border-[#1E222B] flex flex-col gap-1 text-left transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 w-full">
                          <span className="text-xs font-semibold text-zinc-100 line-clamp-2 leading-snug">
                            {rec.description}
                          </span>
                          <span
                            className={`text-xs font-mono font-bold tabular-nums shrink-0 ${
                              rec.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {rec.type === 'income' ? '+' : '-'}${rec.amount.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-400">
                          <span>
                            Due {rec.date} ({rec.daysUntil === 0 ? 'Today' : `in ${rec.daysUntil}d`})
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-[#000000] border border-cyan-500/40 text-[9px] font-mono font-bold text-cyan-300 uppercase shrink-0">
                            RECURRING · {rec.recurrence}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2.5 mt-2.5 border-t border-[#1E222B] flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
              <span>{appData.timeline.length} scheduled</span>
              <button
                type="button"
                onClick={() => !isColumnEditMode && openQuickAdd('timeline', selectedCalendarDate)}
                className="text-emerald-400 hover:underline font-semibold"
              >
                + Schedule
              </button>
            </div>
          </div>
        );
      }

      case 'aegis_visualizer':
      case 'plasma_sphere':
        return (
          <AegisVisualizerWidget
            title={getCardTitle(widget)}
            isColumnEditMode={isColumnEditMode}
            onTitleChange={(newTitle) => handleInlineTitleCommit(widget.id, newTitle)}
          />
        );

      case 'funds_recent':
        return (
          <div
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] h-full flex flex-col justify-between transition-colors`}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between mb-3 pb-2.5 border-b border-[#1E222B] gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
                  {renderEditableHeaderTitle(widget)}
                </div>
                <button
                  onClick={() => !isColumnEditMode && setActiveTab('funds')}
                  className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 shrink-0 whitespace-nowrap font-medium"
                >
                  <span>View Ledger</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Safe-to-Spend & 30d Daily Burn Compact Strip */}
              <div
                data-testid="dashboard-funds-runway-pill"
                className="grid grid-cols-2 gap-2 mb-2.5 p-2 rounded-lg bg-[#000000] border border-[#1E222B] text-[11px] font-mono"
              >
                <div>
                  <span className="text-zinc-500 block text-[10px] uppercase">Safe-to-Spend</span>
                  <span className="text-emerald-400 font-bold tabular-nums">
                    $
                    {runwaySummary.safeToSpendBalance.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 block text-[10px] uppercase">
                    Statement Outflow ({fundsSummary.activeStatementMonthLabel})
                  </span>
                  <span className="text-rose-400 font-bold tabular-nums">
                    ${fundsSummary.monthlyStatementExpense.toFixed(2)}
                  </span>
                </div>
              </div>

              {appData.funds.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400 space-y-2">
                  <p>No funds entries recorded yet.</p>
                  <button
                    onClick={() => openQuickAdd('funds')}
                    className="text-xs text-amber-400 hover:underline font-medium"
                  >
                    + Record first transaction
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {appData.funds.slice(0, 4).map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 rounded-lg bg-[#000000] hover:border-zinc-700 border border-[#1E222B] flex items-center justify-between gap-2.5 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-semibold text-zinc-100 line-clamp-2 flex items-center gap-1.5 flex-wrap">
                          <span>{entry.description}</span>
                          {entry.recurrence && entry.recurrence !== 'none' && (
                            <span className="px-1 py-0.2 rounded bg-[#000000] border border-cyan-500/40 text-[9px] font-mono text-cyan-300 uppercase">
                              {entry.recurrence}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 font-mono tabular-nums flex items-center gap-1 flex-wrap">
                          <span>{entry.date}</span>
                          <InlineCategoryBadge
                            category={entry.category}
                            domain="funds"
                            variant="inline"
                            prefix="· "
                            className="text-xs font-mono text-zinc-400"
                            testIdPrefix="dash-fn-cat"
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0 font-mono font-bold text-xs tabular-nums">
                        <span
                          className={
                            entry.type === 'income' ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {entry.type === 'income' ? '+' : '-'}${entry.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'goals_preview':
      case 'short_term_goals':
        // UNIFIED GOALS & MILESTONES PANEL (Segmented Tab Toggle + Live Sync + Interactive Checkboxes)
        return (
          <div
            data-testid="unified-goals-panel"
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full transition-colors`}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between mb-3 pb-2.5 border-b border-[#1E222B] gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Target className="w-4 h-4 text-emerald-400 shrink-0" />
                  {renderEditableHeaderTitle(widget)}
                </div>
                <button
                  type="button"
                  onClick={() => !isColumnEditMode && setActiveTab('goals')}
                  className="text-xs text-zinc-300 hover:text-white flex items-center gap-1 shrink-0 whitespace-nowrap font-medium"
                >
                  <span>Full Matrix</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Segmented Tab Toggle: Tactical Milestones | Strategic Goals */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#000000] border border-[#1E222B] mb-3">
                <button
                  type="button"
                  data-testid="goals-tab-milestones"
                  onClick={() => setGoalsSubTab('milestones')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono transition-colors flex items-center justify-center gap-1.5 border ${
                    goalsSubTab === 'milestones'
                      ? 'bg-[#000000] text-emerald-300 border-emerald-500/40 font-semibold'
                      : 'bg-[#000000] text-zinc-400 hover:text-zinc-200 border-transparent'
                  }`}
                >
                  <span>Tactical Milestones</span>
                  <span className="text-[10px] opacity-80">
                    ({completedMilestonesCount}/{tacticalMilestones.length})
                  </span>
                </button>
                <button
                  type="button"
                  data-testid="goals-tab-strategic"
                  onClick={() => setGoalsSubTab('strategic')}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono transition-colors flex items-center justify-center gap-1.5 border ${
                    goalsSubTab === 'strategic'
                      ? 'bg-[#000000] text-cyan-300 border-cyan-500/40 font-semibold'
                      : 'bg-[#000000] text-zinc-400 hover:text-zinc-200 border-transparent'
                  }`}
                >
                  <span>Strategic Goals</span>
                  <span className="text-[10px] opacity-80">
                    ({completedGoals.length}/{activeGoals.length})
                  </span>
                </button>
              </div>

              {goalsSubTab === 'milestones' ? (
                tacticalMilestones.length === 0 ? (
                  <div className="py-6 text-center text-xs text-zinc-400 space-y-2">
                    <p>No milestones created yet.</p>
                    <button
                      type="button"
                      onClick={() => openQuickAdd('goals')}
                      className="text-emerald-400 hover:underline font-medium"
                    >
                      + Add your first goal
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 my-1">
                    {tacticalMilestones.slice(0, 5).map((ms) => (
                      <button
                        key={ms.id}
                        type="button"
                        data-testid={`toggle-milestone-${ms.id}`}
                        onClick={() => handleToggleGoalMilestone(ms.parentGoalId, ms.id)}
                        className="w-full p-2.5 rounded-lg bg-[#000000] hover:border-zinc-700 border border-[#1E222B] flex items-center justify-between gap-2.5 text-left transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                              ms.completed
                                ? 'bg-emerald-500 border-emerald-500 text-black'
                                : 'border-zinc-600 bg-[#000000]'
                            }`}
                          >
                            {ms.completed && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <div
                              className={`text-xs font-medium line-clamp-2 ${
                                ms.completed ? 'text-zinc-500 line-through' : 'text-zinc-100'
                              }`}
                            >
                              {ms.title}
                            </div>
                            <div className="text-[11px] text-zinc-500 truncate">
                              {ms.parentGoalTitle}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-mono font-semibold shrink-0 px-1.5 py-0.5 rounded bg-[#000000] border border-[#1E222B] ${
                            ms.completed ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {ms.completed ? 'DONE' : 'OPEN'}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              ) : activeGoals.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400 space-y-2">
                  <p>No strategic goals created yet.</p>
                  <button
                    type="button"
                    onClick={() => openQuickAdd('goals')}
                    className="text-emerald-400 hover:underline font-medium"
                  >
                    + Add your first goal
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5 my-2">
                  {activeGoals.slice(0, 3).map((g) => {
                    const liveMetrics = computeLiveGoalMetrics(
                      g,
                      appData,
                      runwaySummary.netMonthlyCashflowVelocity
                    );
                    const runwayEst = liveMetrics.estimatedRunwayLabel || null;
                    return (
                      <div
                        key={g.id}
                        className="p-2.5 rounded-lg bg-[#000000] hover:border-zinc-700 border border-[#1E222B] space-y-1.5 transition-colors"
                      >
                        <div className="flex items-start justify-between text-xs gap-2">
                          <div className="min-w-0">
                            <span className="text-zinc-100 font-semibold line-clamp-2">
                              {g.title}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[10px] font-mono text-zinc-400">
                                {liveMetrics.deltaFormatted}
                              </span>
                            </div>
                          </div>
                          <span className="text-emerald-400 font-mono font-bold tabular-nums shrink-0">
                            {liveMetrics.completionPercent}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-[#000000] rounded-full overflow-hidden border border-[#1E222B]">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                            style={{ width: `${liveMetrics.completionPercent}%` }}
                          />
                        </div>
                        {runwayEst && (
                          <div className="text-[10px] font-mono text-cyan-300">
                            Runway: {runwayEst}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 mt-2 border-t border-[#1E222B] flex items-center justify-between text-xs text-zinc-400">
              <button
                type="button"
                onClick={() => openQuickAdd('goals')}
                className="text-emerald-400 hover:underline font-medium"
              >
                + Add Goal
              </button>
              <span className="font-mono text-emerald-400 tabular-nums">
                {completedMilestonesCount}/{tacticalMilestones.length} Done
              </span>
            </div>
          </div>
        );

      case 'life_stats_panel':
        return (
          <div
            onClick={() => !isColumnEditMode && setActiveTab('lifestats')}
            className={`${cardPadClass} rounded-[12px] bg-[#000000] hover:border-zinc-700 border border-[#1E222B] transition-all cursor-pointer shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full`}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between mb-3 pb-2.5 border-b border-[#1E222B] gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Activity className="w-4 h-4 text-purple-400 shrink-0" />
                  {renderEditableHeaderTitle(widget)}
                </div>
                <span className="text-xs font-mono text-purple-400 font-semibold tabular-nums shrink-0">
                  Mood: {statsSummary.latestMood || '--'}/10
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 my-2">
                <div className="p-3 rounded-lg bg-[#000000] border border-[#1E222B]">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
                    <Scale className="w-3.5 h-3.5 text-purple-400" />
                    <span>Weight</span>
                  </div>
                  <div className="text-base font-bold text-white font-mono tabular-nums">
                    {statsSummary.latestWeightLbs ? `${statsSummary.latestWeightLbs} lbs` : '--'}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-[#000000] border border-[#1E222B]">
                  <div className="text-xs text-zinc-400 mb-1">Stature &amp; Avg Mood</div>
                  <div className="text-base font-bold text-white font-mono tabular-nums">
                    {statsSummary.latestHeightFormatted || '--'} ·{' '}
                    {statsSummary.averageMood || '--'}
                  </div>
                </div>
              </div>

              {/* Biometrics vs. Activity Correlation Summary Pill */}
              <div
                data-testid="dashboard-biometrics-correlation-pill"
                className="p-2 rounded-lg bg-[#000000] border border-[#1E222B] text-[11px] font-mono text-purple-300 mt-2 flex items-center justify-between gap-2"
              >
                <span className="truncate">{biometricsCorrelation.summaryPillText}</span>
                {biometricsCorrelation.weightVelocity7dLbs !== null && (
                  <span className="text-cyan-300 shrink-0">
                    {biometricsCorrelation.weightVelocity7dLbs > 0 ? '+' : ''}
                    {biometricsCorrelation.weightVelocity7dLbs} lbs/wk
                  </span>
                )}
              </div>
            </div>

            <div className="pt-3 mt-2 border-t border-[#1E222B] flex items-center justify-between text-xs text-zinc-400">
              <span>{appData.lifeStats.length} entries</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
          </div>
        );

      case 'distance_panel':
        return (
          <div
            onClick={() => !isColumnEditMode && setActiveTab('distance')}
            className={`${cardPadClass} rounded-[12px] bg-[#000000] hover:border-zinc-700 border border-[#1E222B] transition-all cursor-pointer shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full`}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between mb-3 pb-2.5 border-b border-[#1E222B] gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
                  {renderEditableHeaderTitle(widget)}
                </div>
                <span className="text-xs font-mono text-cyan-400 font-semibold tabular-nums shrink-0">
                  {distanceSummary.total} mi total
                </span>
              </div>

              {appData.distances.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400 space-y-2">
                  <p>No distance logs recorded yet.</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openQuickAdd('distance');
                    }}
                    className="text-cyan-400 hover:underline font-medium"
                  >
                    + Log first distance
                  </button>
                </div>
              ) : (
                <div className="space-y-2 my-2">
                  {appData.distances.slice(0, 3).map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-lg bg-[#000000] hover:border-zinc-700 border border-[#1E222B] flex items-center justify-between gap-2 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-100 line-clamp-2">
                          {d.description}
                        </div>
                        <div className="text-xs font-mono text-zinc-400 capitalize">
                          {d.date} · {d.type}
                        </div>
                      </div>
                      <span className="text-xs font-mono font-bold text-cyan-400 shrink-0 tabular-nums">
                        {d.distance} {d.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 mt-2 border-t border-[#1E222B] flex items-center justify-between text-xs text-zinc-400">
              <span>
                Monthly Statement ({distanceSummary.activeStatementMonthLabel}):{' '}
                {distanceSummary.monthlyStatementTotal} mi
              </span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
          </div>
        );

      case 'gallery_preview':
        return (
          <div
            onClick={() => !isColumnEditMode && setActiveTab('gallery')}
            className={`${cardPadClass} rounded-[12px] bg-[#000000] hover:border-zinc-700 border border-[#1E222B] transition-all cursor-pointer shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full`}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between mb-3 pb-2.5 border-b border-[#1E222B] gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="w-4 h-4 text-pink-400 shrink-0" />
                  {renderEditableHeaderTitle(widget)}
                </div>
                <span className="text-xs font-mono text-zinc-300 tabular-nums shrink-0">
                  {appData.gallery?.length || 0} Photos
                </span>
              </div>

              <div className="flex items-center gap-3 overflow-hidden my-3">
                {(appData.gallery || []).slice(0, 4).map((img) => (
                  <div
                    key={img.id}
                    className="w-28 h-24 rounded-lg overflow-hidden bg-[#000000] border border-[#1E222B] shrink-0"
                  >
                    <img
                      src={img.dataUrl}
                      alt={img.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                {(appData.gallery?.length || 0) === 0 && (
                  <span className="text-xs text-zinc-400 py-6 block">
                    No photos uploaded yet. Click to upload privately.
                  </span>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-[#1E222B] flex items-center justify-between text-xs text-zinc-400">
              <span>+ Upload Photo</span>
              <ChevronRight className="w-4 h-4 text-zinc-500" />
            </div>
          </div>
        );

      case 'weather': {
        const configuredLocation = (appData.settings.weatherLocation || '').trim();
        const showSetupForm = !configuredLocation || isEditingWeatherLocation;

        return (
          <div
            data-testid="dashboard-weather-card"
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full transition-colors`}
          >
            <div>
              <div className="flex flex-wrap items-center justify-between mb-3 pb-2.5 border-b border-[#1E222B] gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CloudSun className="w-4 h-4 text-amber-400 shrink-0" />
                  {renderEditableHeaderTitle(widget)}
                </div>
                <div className="flex items-center gap-1.5">
                  {configuredLocation && (
                    <button
                      type="button"
                      data-testid="weather-change-location-btn"
                      onClick={() => setIsEditingWeatherLocation((prev) => !prev)}
                      className="px-2 py-1 rounded-lg bg-[#000000] hover:bg-[#111319] text-[11px] font-mono text-zinc-300 hover:text-amber-300 border border-[#1E222B] transition-colors"
                    >
                      {isEditingWeatherLocation ? 'Cancel' : 'Location'}
                    </button>
                  )}
                  {configuredLocation && (
                    <button
                      type="button"
                      onClick={() => refreshWeather()}
                      disabled={isWeatherLoading}
                      title="Refresh weather telemetry"
                      className="p-1.5 rounded-lg bg-[#000000] hover:border-zinc-700 text-zinc-300 border border-[#1E222B] transition-colors"
                    >
                      <RotateCw
                        className={`w-3.5 h-3.5 ${
                          isWeatherLoading ? 'animate-spin text-emerald-400' : ''
                        }`}
                      />
                    </button>
                  )}
                </div>
              </div>

              {showSetupForm ? (
                <div
                  data-testid="weather-unconfigured-state"
                  className="p-3.5 rounded-lg bg-[#000000] border border-[#1E222B] space-y-2.5 my-2"
                >
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Configure your local weather station (stored strictly in your local vault).
                  </p>
                  <button
                    type="button"
                    data-testid="weather-detect-location-btn"
                    onClick={() => {
                      void detectMyWeatherLocation().then((ok) => {
                        if (ok) setIsEditingWeatherLocation(false);
                      });
                    }}
                    disabled={isWeatherLoading}
                    className="w-full py-2 px-3 rounded-lg bg-[#000000] hover:bg-[#111319] border border-amber-500/40 text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                    <span>{isWeatherLoading ? 'Detecting...' : 'Detect My Location'}</span>
                  </button>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!weatherSearchQuery.trim()) return;
                      void searchAndSaveWeatherLocation(weatherSearchQuery.trim()).then((ok) => {
                        if (ok) {
                          setWeatherSearchQuery('');
                          setIsEditingWeatherLocation(false);
                        }
                      });
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      data-testid="weather-city-search-input"
                      value={weatherSearchQuery}
                      onChange={(e) => setWeatherSearchQuery(e.target.value)}
                      placeholder="Search City / ZIP..."
                      className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="submit"
                      data-testid="weather-city-search-submit"
                      disabled={isWeatherLoading || !weatherSearchQuery.trim()}
                      className="px-2.5 py-1.5 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-xs font-semibold text-zinc-200 flex items-center gap-1 shrink-0"
                    >
                      <Search className="w-3 h-3" />
                      <span>Set</span>
                    </button>
                  </form>
                </div>
              ) : (
                <div className="p-3.5 rounded-lg bg-[#000000] border border-[#1E222B] flex items-center justify-between gap-4 my-2 transition-colors">
                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-medium">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span data-testid="weather-configured-city">
                        {weather?.city || configuredLocation}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-black text-white font-mono tabular-nums">
                        {weather ? `${weather.temperature}°F` : '--°F'}
                      </span>
                      <span className="text-xs text-zinc-300 font-medium">
                        {weather?.condition || 'Clear'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs text-zinc-300 space-y-1 font-mono">
                    <div className="flex items-center justify-end gap-1">
                      <Droplets className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{weather?.humidity ?? '--'}% RH</span>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <Wind className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{weather?.windSpeed ?? '--'} mph</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 text-xs text-zinc-400 flex items-center justify-between">
              <span>Local Weather</span>
              <span className="font-mono text-zinc-400">
                {configuredLocation ? 'Configured' : 'Unconfigured'}
              </span>
            </div>
          </div>
        );
      }

      case 'daily_notes': {
        const allNotes = appData.dailyNotes || [];
        const todayNote =
          allNotes.find((n) => n.date === todayStr || n.date === localTodayStr) || allNotes[0];
        const pinnedNotes = allNotes.filter((n) => n.isPinned);
        const todayChecklists = todayNote ? parseMarkdownChecklists(todayNote.content) : [];
        const displayedNotes =
          dashboardNotesSubTab === 'pinned' ? pinnedNotes : allNotes;

        const handleToggleDashboardNoteChecklist = (lineIndex: number) => {
          if (!todayNote || isColumnEditMode) return;
          const updatedContent = toggleMarkdownChecklistLine(todayNote.content, lineIndex);
          const upserted = upsertDailyNote(allNotes, {
            id: todayNote.id,
            date: todayNote.date,
            title: todayNote.title,
            content: updatedContent,
            tags: todayNote.tags,
            mood: todayNote.mood,
            isPinned: todayNote.isPinned,
          });
          if (upserted) {
            updateAppData(
              (prev) => ({
                ...prev,
                dailyNotes: upserted.nextNotes,
              }),
              { label: `Toggled checklist item in "${todayNote.title}"` }
            );
          }
        };

        return (
          <div
            data-testid="dashboard-daily-notes-card"
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full transition-colors`}
          >
            <div>
              {/* Header Bar */}
              <div className="flex flex-wrap items-center justify-between mb-2.5 pb-2.5 border-b border-[#1E222B] gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                  {renderEditableHeaderTitle(widget)}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => !isColumnEditMode && setActiveTab('notes')}
                    data-testid="dashboard-open-notes-btn"
                    className="px-2 py-0.5 rounded-md bg-[#000000] border border-[#1E222B] hover:border-amber-500/40 text-[11px] font-mono font-semibold text-amber-300 hover:text-white flex items-center gap-0.5 shrink-0 whitespace-nowrap cursor-pointer"
                  >
                    <span>Open Notes</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Segmented Switcher: Created Notes | Pinned Notes */}
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#000000] border border-[#1E222B] mb-2.5">
                <button
                  type="button"
                  data-testid="dashboard-notes-mode-today"
                  onClick={() => setDashboardNotesSubTab('today')}
                  className={`py-1 px-2 rounded-lg text-[11px] font-mono transition-colors flex items-center justify-center gap-1 border cursor-pointer ${
                    dashboardNotesSubTab === 'today'
                      ? 'bg-[#000000] text-amber-300 border-amber-500/40 font-semibold'
                      : 'bg-[#000000] text-zinc-400 hover:text-zinc-200 border-transparent'
                  }`}
                >
                  <span>Created ({allNotes.length})</span>
                </button>
                <button
                  type="button"
                  data-testid="dashboard-notes-mode-pinned"
                  onClick={() => setDashboardNotesSubTab('pinned')}
                  className={`py-1 px-2 rounded-lg text-[11px] font-mono transition-colors flex items-center justify-center gap-1 border cursor-pointer ${
                    dashboardNotesSubTab === 'pinned'
                      ? 'bg-[#000000] text-cyan-300 border-cyan-500/40 font-semibold'
                      : 'bg-[#000000] text-zinc-400 hover:text-zinc-200 border-transparent'
                  }`}
                >
                  <Pin className="w-2.5 h-2.5" />
                  <span>Pinned ({pinnedNotes.length})</span>
                </button>
              </div>

              {/* Created Notes Read-Only Feed */}
              {displayedNotes.length === 0 ? (
                <div
                  data-testid="dashboard-notes-empty-state"
                  className="py-8 px-3 rounded-xl bg-[#000000] border border-[#1E222B] text-center space-y-1"
                >
                  <p className="text-xs text-zinc-400 font-medium">
                    {dashboardNotesSubTab === 'pinned'
                      ? 'No pinned notes.'
                      : 'No created notes yet.'}
                  </p>
                  <p className="text-[11px] font-mono text-zinc-600">
                    Notes created in the Notes section appear here automatically.
                  </p>
                </div>
              ) : (
                <div
                  data-testid={
                    dashboardNotesSubTab === 'pinned'
                      ? 'dashboard-pinned-notes-list'
                      : 'dashboard-created-notes-list'
                  }
                  className="space-y-2.5 mt-2.5 max-h-72 overflow-y-auto pr-0.5"
                >
                  {/* Interactive Checklist Items for Latest Created Note (if present) */}
                  {dashboardNotesSubTab === 'today' && todayNote && todayChecklists.length > 0 && (
                    <div
                      data-testid="dashboard-notes-checklist"
                      className="space-y-1 pb-1.5 border-b border-[#1E222B]"
                    >
                      {todayChecklists.slice(0, 4).map((item) => (
                        <button
                          key={item.lineIndex}
                          type="button"
                          data-testid={`dashboard-note-checkbox-${item.lineIndex}`}
                          onClick={() => handleToggleDashboardNoteChecklist(item.lineIndex)}
                          className="w-full p-2 rounded-lg bg-[#000000] hover:border-zinc-700 border border-[#1E222B] flex items-center gap-2 text-left transition-colors cursor-pointer"
                        >
                          <span
                            className={`w-3.5 h-3.5 rounded flex items-center justify-center border shrink-0 transition-colors ${
                              item.checked
                                ? 'bg-emerald-500 border-emerald-500 text-black'
                                : 'bg-[#000000] border-zinc-600'
                            }`}
                          >
                            {item.checked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </span>
                          <span
                            className={`text-xs line-clamp-1 ${
                              item.checked ? 'line-through text-zinc-500' : 'text-zinc-100'
                            }`}
                          >
                            {item.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {displayedNotes.slice(0, 5).map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      data-testid={`dashboard-note-item-${note.id}`}
                      onClick={() => !isColumnEditMode && setActiveTab('notes')}
                      className="w-full p-2.5 rounded-lg bg-[#000000] hover:border-zinc-700 border border-[#1E222B] text-left space-y-1 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                        <span className="text-amber-400 flex items-center gap-1">
                          {note.isPinned && <Pin className="w-2.5 h-2.5" />}
                          <span>{note.date}</span>
                        </span>
                        {note.mood && <span className="text-zinc-400">Mood {note.mood}/10</span>}
                      </div>
                      <div className="text-xs font-semibold text-white line-clamp-1">
                        {note.title}
                      </div>
                      {note.content && (
                        <p className="text-[11px] font-mono text-zinc-400 line-clamp-2">
                          {note.content.replace(/^#+\s*/gm, '')}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2.5 mt-2 border-t border-[#1E222B] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span>Created Notes</span>
              <span className="text-amber-400 tabular-nums">{allNotes.length} notes</span>
            </div>
          </div>
        );
      }

      case 'frequent_events': {
        const allFrequent = appData.frequentEvents || [];
        const timelineCategories = getCategoriesByDomain(appData, 'timeline');
        const filteredFrequent = filterFrequentEvents(
          allFrequent,
          frequentSearchQuery,
          frequentCategoryFilter
        );

        const renderFrequentCategoryIcon = (catName: string) => {
          const catLower = (catName || '').toLowerCase();
          const catConfig = timelineCategories.find((c) => c.name.toLowerCase() === catLower);
          const colorHex = catConfig?.color || '#f59e0b';
          const iconKey = catConfig?.icon || catLower;
          const iconEl =
            iconKey === 'briefcase' || catLower === 'work' ? (
              <Briefcase className="w-3.5 h-3.5 shrink-0" style={{ color: colorHex }} />
            ) : iconKey === 'heart' || catLower === 'health' ? (
              <Heart className="w-3.5 h-3.5 shrink-0" style={{ color: colorHex }} />
            ) : iconKey === 'book' || catLower === 'learning' ? (
              <BookOpen className="w-3.5 h-3.5 shrink-0" style={{ color: colorHex }} />
            ) : iconKey === 'user' || catLower === 'personal' ? (
              <User className="w-3.5 h-3.5 shrink-0" style={{ color: colorHex }} />
            ) : iconKey === 'users' || catLower === 'social' ? (
              <Users className="w-3.5 h-3.5 shrink-0" style={{ color: colorHex }} />
            ) : iconKey === 'sparkles' || catLower === 'creative' ? (
              <Sparkles className="w-3.5 h-3.5 shrink-0" style={{ color: colorHex }} />
            ) : (
              <Tag className="w-3.5 h-3.5 shrink-0" style={{ color: colorHex }} />
            );
          return { iconEl, colorHex };
        };

        return (
          <div
            data-testid="dashboard-frequent-events-card"
            onKeyDown={(e) => {
              if (
                !isColumnEditMode &&
                !isFrequentManageMode &&
                !showFrequentInlineForm &&
                (e.target as HTMLElement)?.tagName !== 'INPUT' &&
                (e.target as HTMLElement)?.tagName !== 'SELECT'
              ) {
                const digit = parseInt(e.key, 10);
                if (digit >= 1 && digit <= 9 && filteredFrequent[digit - 1]) {
                  e.preventDefault();
                  handleQuickLogFrequentEvent(filteredFrequent[digit - 1]);
                }
              }
            }}
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full transition-colors`}
          >
            <div>
              {/* Anti-Truncation Header Bar */}
              <div className="flex flex-wrap items-center justify-between mb-3 pb-2.5 border-b border-[#1E222B] gap-x-2 gap-y-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                  {renderEditableHeaderTitle(widget, 'text-xs sm:text-sm font-bold text-white leading-snug')}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    data-testid="dashboard-frequent-add-toggle-btn"
                    onClick={() => {
                      if (!isColumnEditMode) {
                        setEditingFrequentId(undefined);
                        setFreqTitleDraft('');
                        setFreqNotesDraft('');
                        setShowFrequentInlineForm((prev) => !prev);
                      }
                    }}
                    title="Add new frequent event template"
                    className={`px-2 py-1 rounded-lg border text-[11px] font-mono font-semibold flex items-center gap-1 transition-colors bg-[#000000] ${
                      showFrequentInlineForm
                        ? 'text-amber-300 border-amber-500/40'
                        : 'text-zinc-300 hover:text-white border-[#1E222B]'
                    }`}
                  >
                    <Plus className="w-3 h-3 text-amber-400" />
                    <span>New</span>
                  </button>

                  <button
                    type="button"
                    data-testid="dashboard-frequent-manage-btn"
                    onClick={() => !isColumnEditMode && setIsFrequentManageMode((prev) => !prev)}
                    title="Manage, reorder, or edit frequent event templates"
                    className={`p-1.5 rounded-lg border transition-colors bg-[#000000] ${
                      isFrequentManageMode
                        ? 'text-amber-300 border-amber-500/40'
                        : 'text-zinc-400 hover:text-white border-[#1E222B]'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    data-testid="dashboard-open-frequent-modal-btn"
                    onClick={() => !isColumnEditMode && setIsFrequentEventsOpen(true)}
                    title="Open Full Frequent Events Quick-Tray Modal"
                    className="px-2 py-1 rounded-lg bg-[#000000] border border-[#1E222B] hover:border-amber-500/40 text-[11px] font-mono text-zinc-300 hover:text-white flex items-center gap-0.5 shrink-0 whitespace-nowrap font-semibold"
                  >
                    <span>Tray</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Search & Category Filter Bar */}
              <div className="space-y-2 mb-3">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={frequentSearchQuery}
                    onChange={(e) => setFrequentSearchQuery(e.target.value)}
                    placeholder="Filter templates by name, category, or tag..."
                    data-testid="dashboard-frequent-search-input"
                    className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
                  />
                  {frequentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFrequentSearchQuery('')}
                      aria-label="Clear search"
                      className="absolute right-2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Compact Category Filter Strip */}
                <div className="flex flex-wrap items-center gap-1">
                  <button
                    type="button"
                    data-testid="frequent-cat-filter-all"
                    onClick={() => setFrequentCategoryFilter('all')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border shrink-0 transition-colors bg-[#000000] ${
                      frequentCategoryFilter === 'all'
                        ? 'text-amber-300 border-amber-500/40 font-bold'
                        : 'text-zinc-400 border-[#1E222B] hover:text-zinc-200'
                    }`}
                  >
                    All ({allFrequent.length})
                  </button>
                  {timelineCategories.map((cat) => {
                    const isSelected =
                      frequentCategoryFilter.toLowerCase() === cat.name.toLowerCase();
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        data-testid={`frequent-cat-filter-${cat.name.toLowerCase()}`}
                        onClick={() =>
                          setFrequentCategoryFilter(isSelected ? 'all' : cat.name)
                        }
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider border shrink-0 transition-colors bg-[#000000] ${
                          isSelected
                            ? 'text-amber-300 border-amber-500/40 font-bold'
                            : 'text-zinc-400 border-[#1E222B] hover:text-zinc-200'
                        }`}
                      >
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Inline Template Creator / Editor Form */}
              {showFrequentInlineForm && (
                <form
                  onSubmit={handleSaveFrequentTemplateInline}
                  data-testid="dashboard-frequent-inline-form"
                  className="p-3 rounded-xl bg-[#000000] border border-amber-500/30 space-y-2 mb-3"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono text-amber-300 font-semibold">
                    <span>
                      {editingFrequentId ? 'Edit Frequent Event Template' : 'New 1-Click Template'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFrequentInlineForm(false);
                        setEditingFrequentId(undefined);
                      }}
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    value={freqTitleDraft}
                    onChange={(e) => setFreqTitleDraft(e.target.value)}
                    placeholder="Activity title (e.g. Deep Code Sprint)"
                    data-testid="dashboard-frequent-title-input"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />

                  <div className="grid grid-cols-3 gap-1.5">
                    <select
                      value={freqCategoryDraft}
                      onChange={(e) => setFreqCategoryDraft(e.target.value)}
                      data-testid="dashboard-frequent-category-select"
                      className="px-2 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white"
                    >
                      {timelineCategories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={freqStartDraft}
                      onChange={(e) => setFreqStartDraft(e.target.value)}
                      data-testid="dashboard-frequent-start-input"
                      className="px-2 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white font-mono"
                    />
                    <input
                      type="number"
                      min={5}
                      max={720}
                      value={freqDurationDraft}
                      onChange={(e) => setFreqDurationDraft(e.target.value)}
                      placeholder="Mins"
                      title="Duration in minutes"
                      data-testid="dashboard-frequent-duration-input"
                      className="px-2 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={freqNotesDraft}
                      onChange={(e) => setFreqNotesDraft(e.target.value)}
                      placeholder="Default notes or tags (optional)..."
                      data-testid="dashboard-frequent-notes-input"
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      data-testid="dashboard-frequent-save-btn"
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shrink-0 transition-colors"
                    >
                      {editingFrequentId ? 'Update' : '+ Save'}
                    </button>
                  </div>
                </form>
              )}

              {/* Anti-Truncation Two-Row Card Grid of Frequent Event Quick-Action Pills */}
              {filteredFrequent.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500 border border-[#1E222B] rounded-xl space-y-1.5">
                  <p>No matching frequent event templates found.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFrequentSearchQuery('');
                      setFrequentCategoryFilter('all');
                      setShowFrequentInlineForm(true);
                    }}
                    className="text-amber-400 hover:underline font-medium"
                  >
                    + Create a quick-add template
                  </button>
                </div>
              ) : (
                <div
                  data-testid="dashboard-frequent-events-grid"
                  className={`grid gap-2 ${
                    normalizeColSpan(widget.colSpan) === 'full' || normalizeColSpan(widget.colSpan) === 3
                      ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                      : normalizeColSpan(widget.colSpan) === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1'
                  }`}
                >
                  {filteredFrequent.map((fe, idx) => {
                    const isJustLogged = Boolean(justLoggedFrequentIds[fe.id]);
                    const { iconEl, colorHex } = renderFrequentCategoryIcon(fe.category);
                    const fullIdx = allFrequent.findIndex((item) => item.id === fe.id);

                    return (
                      <div
                        key={fe.id}
                        data-testid={`dashboard-frequent-pill-container-${fe.id}`}
                        className={`group relative rounded-xl border transition-all duration-200 bg-[#000000] ${
                          isJustLogged
                            ? 'border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.28)] scale-[0.99]'
                            : 'border-[#1E222B] hover:border-amber-500/40'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={isColumnEditMode}
                          data-testid={`dashboard-frequent-pill-${fe.id}`}
                          onClick={() => {
                            if (isFrequentManageMode) {
                              handleStartEditFrequentTemplate(fe);
                            } else {
                              handleQuickLogFrequentEvent(fe);
                            }
                          }}
                          title={
                            isFrequentManageMode
                              ? `Click to edit "${fe.title}"`
                              : `1-Click Log: "${fe.title}" (${formatMinutes(fe.durationMinutes)})`
                          }
                          className="w-full p-2.5 text-left flex flex-col justify-between gap-2 cursor-pointer focus:outline-none"
                        >
                          {/* Row 1: Icon + Up to 2 Lines of Un-truncated Title */}
                          <div className="flex items-start gap-2 w-full">
                            <span className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 bg-[#000000] border border-[#1E222B] mt-0.5">
                              {iconEl}
                            </span>
                            <span className="text-xs font-bold text-zinc-100 line-clamp-2 leading-snug group-hover:text-white flex-1">
                              {fe.title}
                            </span>
                          </div>

                          {/* Row 2: Category, Duration, Default Start Time & Action Badge */}
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-400 w-full pl-8">
                            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                              <span
                                className="uppercase font-semibold"
                                style={{ color: colorHex }}
                              >
                                {fe.category}
                              </span>
                              <span>·</span>
                              <span className="text-zinc-300 tabular-nums">
                                {formatMinutes(fe.durationMinutes)}
                              </span>
                              <span>·</span>
                              <span className="text-zinc-500 tabular-nums">
                                {fe.startTime || 'Now'}
                              </span>
                            </div>

                            {/* Shortcut / Instant Feedback Badge */}
                            <span
                              data-testid={`dashboard-frequent-status-${fe.id}`}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 flex items-center gap-1 border transition-all ${
                                isJustLogged
                                  ? 'bg-emerald-500 text-zinc-950 border-emerald-300'
                                  : 'bg-[#000000] text-amber-300/90 border-[#1E222B] group-hover:border-amber-500/40'
                              }`}
                            >
                              {isJustLogged ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                                  <span>LOGGED</span>
                                </>
                              ) : idx < 9 ? (
                                <>
                                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                                  <span>#{idx + 1}</span>
                                </>
                              ) : (
                                <span>1-Click</span>
                              )}
                            </span>
                          </div>
                        </button>

                        {/* Inline Management Controls Overlay when Manage Mode is Active */}
                        {isFrequentManageMode && (
                          <div className="px-2.5 pb-2 pt-1 border-t border-[#1E222B] flex items-center justify-between gap-1 bg-[#000000] rounded-b-xl">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={fullIdx <= 0}
                                onClick={() => handleMoveFrequentTemplateInline(fullIdx, 'up')}
                                title="Move earlier"
                                className="p-1 rounded bg-[#000000] border border-[#1E222B] hover:border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={fullIdx < 0 || fullIdx >= allFrequent.length - 1}
                                onClick={() => handleMoveFrequentTemplateInline(fullIdx, 'down')}
                                title="Move later"
                                className="p-1 rounded bg-[#000000] border border-[#1E222B] hover:border-zinc-700 text-zinc-400 hover:text-white disabled:opacity-30"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleStartEditFrequentTemplate(fe)}
                                className="px-1.5 py-0.5 rounded bg-[#000000] hover:border-amber-500/50 text-[10px] font-mono text-amber-300 border border-amber-500/30"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                data-testid={`dashboard-frequent-delete-${fe.id}`}
                                onClick={() => handleDeleteFrequentTemplateInline(fe.id, fe.title)}
                                title="Remove template"
                                className="p-1 rounded bg-[#000000] border border-[#1E222B] hover:border-rose-500/40 text-zinc-400 hover:text-rose-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Status Bar */}
            <div className="pt-3 mt-2.5 border-t border-[#1E222B] flex items-center justify-between text-xs text-zinc-400">
              <span>
                {isFrequentManageMode
                  ? 'Manage mode: reorder, edit, or delete templates'
                  : '1-click logs to today’s schedule'}
              </span>
              <span className="font-mono text-amber-400 tabular-nums shrink-0">
                {filteredFrequent.length}/{allFrequent.length} Ready
              </span>
            </div>
          </div>
        );
      }

      case 'kpi_funds':
        return (
          <div
            data-testid="kpi-ribbon-funds"
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] hover:border-emerald-500/40 transition-all shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full`}
          >
            <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-[#1E222B]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-lg bg-[#000000] text-emerald-400 border border-[#1E222B] shrink-0">
                  <Wallet className="w-4 h-4" />
                </div>
                {renderEditableHeaderTitle(widget)}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('funds')}
                className="text-[11px] font-mono text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Open Funds</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4 my-auto py-2">
              <div>
                <div className="text-[11px] font-mono uppercase text-zinc-500">
                  Current Net Balance
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums mt-1">
                  ${fundsSummary.currentBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#151821]">
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B]">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                    Net Cash Flow
                  </span>
                  {fundsSummary.netCashFlow >= 0 ? (
                    <span className="text-xs sm:text-sm font-mono font-bold text-emerald-400 tabular-nums flex items-center mt-1">
                      <ArrowUpRight className="w-3.5 h-3.5" />+$
                      {fundsSummary.netCashFlow.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-xs sm:text-sm font-mono font-bold text-rose-400 tabular-nums flex items-center mt-1">
                      <ArrowDownRight className="w-3.5 h-3.5" />-$
                      {Math.abs(fundsSummary.netCashFlow).toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B]">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                    Safe To Spend
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-cyan-400 tabular-nums block mt-1">
                    ${runwaySummary.safeToSpendBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3.5 border-t border-[#151821] flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
              <span>{appData.funds.length} Ledger Entries</span>
              <button
                type="button"
                onClick={() => openQuickAdd('funds')}
                className="text-emerald-400 hover:underline cursor-pointer"
              >
                + Log Transaction
              </button>
            </div>
          </div>
        );

      case 'kpi_mood':
        return (
          <div
            data-testid="kpi-ribbon-mood"
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] hover:border-purple-500/40 transition-all shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full`}
          >
            <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-[#1E222B]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-lg bg-[#000000] text-purple-400 border border-[#1E222B] shrink-0">
                  <Activity className="w-4 h-4" />
                </div>
                {renderEditableHeaderTitle(widget)}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('lifestats')}
                className="text-[11px] font-mono text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Open Life Stats</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4 my-auto py-2">
              <div className="flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono uppercase text-zinc-500">
                    Latest Mood Score
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums mt-1">
                    {statsSummary.latestMood || '--'}
                    <span className="text-xs text-zinc-500 font-normal">/10</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-mono uppercase text-zinc-500">
                    Latest Weight
                  </div>
                  <div className="text-base sm:text-lg font-bold text-purple-400 font-mono tabular-nums mt-1">
                    {statsSummary.latestWeightLbs ? `${statsSummary.latestWeightLbs} lbs` : '--'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#151821]">
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B]">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                    Average Mood
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-zinc-200 tabular-nums block mt-1">
                    {statsSummary.averageMood || '--'} / 10
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B]">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                    Correlation
                  </span>
                  <span
                    data-testid="dashboard-biometrics-correlation-pill"
                    className="text-[11px] font-mono font-semibold text-purple-300 truncate block mt-1"
                  >
                    {biometricsCorrelation.summaryPillText}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3.5 border-t border-[#151821] flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
              <span>{appData.lifeStats.length} Vitals Logged</span>
              <button
                type="button"
                onClick={() => openQuickAdd('lifestats')}
                className="text-purple-400 hover:underline cursor-pointer"
              >
                + Log Mood
              </button>
            </div>
          </div>
        );

      case 'kpi_distance':
        return (
          <div
            data-testid="kpi-ribbon-distance"
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] hover:border-cyan-500/40 transition-all shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full`}
          >
            <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-[#1E222B]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-lg bg-[#000000] text-cyan-400 border border-[#1E222B] shrink-0">
                  <Footprints className="w-4 h-4" />
                </div>
                {renderEditableHeaderTitle(widget)}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('distance')}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer shrink-0"
              >
                <span>Open Distance</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-4 my-auto py-2">
              <div>
                <div className="text-[11px] font-mono uppercase text-zinc-500">
                  {distanceSummary.activeStatementMonthLabel} Run / Distance
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono tabular-nums mt-1">
                  {distanceSummary.monthlyStatementTotal}{' '}
                  <span className="text-xs text-cyan-400 font-semibold">mi</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[#151821]">
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B]">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                    Lifetime Total
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-cyan-400 tabular-nums block mt-1">
                    {distanceSummary.total} mi
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B]">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block">
                    Sessions
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-zinc-200 tabular-nums block mt-1">
                    {appData.distances.length} runs
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 mt-3.5 border-t border-[#151821] flex items-center justify-between text-[11px] font-mono text-zinc-400 tabular-nums">
              <span>Active Statement</span>
              <button
                type="button"
                onClick={() => openQuickAdd('distance')}
                className="text-cyan-400 hover:underline cursor-pointer"
              >
                + Log Distance
              </button>
            </div>
          </div>
        );

      case 'kpi_focus':
      case 'quick_capture':
        return (
          <div
            className={`${cardPadClass} rounded-[12px] bg-[#000000] border border-[#1E222B] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] flex flex-col justify-between h-full`}
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#1E222B]">
              {renderEditableHeaderTitle(widget)}
            </div>
            <p className="text-xs text-zinc-400">
              Quick capture panel ready. Click Customize Panels to manage visibility.
            </p>
          </div>
        );

      default:
        // Render User-Created Custom Panel (supports all 5 templates!)
        return renderCustomPanelContent(widget);
    }
  };

  return (
    <div className="space-y-6" data-testid="align-columns-section">
      {/* TIER 1: USER PROFILE DISPLAY & DATA HEADER (Pure-Black #000000 Aesthetic) */}
      <div
        data-testid="dashboard-hero-command-card"
        className="relative overflow-hidden px-4 py-3.5 sm:px-5 sm:py-4 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-[#2A303D] shadow-[0_8px_30px_-4px_rgba(0,0,0,0.85)] transition-colors"
      >
        {/* Top Precision Accent Hairline */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] opacity-80"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${accent.hex} 50%, transparent 100%)`,
          }}
        />

        <div
          data-testid="dashboard-user-profile-header"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          {/* Left: User Avatar, Identity, Role Badge, Guild & Condensed Telemetry */}
          <div className="flex items-center gap-3.5 min-w-0">
            <label
              title="Click to change profile photo"
              className="group relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#000000] border flex items-center justify-center shrink-0 overflow-hidden cursor-pointer transition-all duration-200 hover:scale-[1.02]"
              style={{
                borderColor: `${accent.hex}80`,
              }}
            >
              {activeProfileAvatar ? (
                <img
                  src={activeProfileAvatar}
                  alt={activeProfileDisplayName}
                  data-testid="dashboard-profile-avatar-img"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span
                  data-testid="dashboard-profile-avatar-fallback"
                  className="text-lg sm:text-xl font-mono font-extrabold uppercase tracking-wider select-none"
                  style={{ color: accent.hex }}
                >
                  {(activeProfileDisplayName || 'U').charAt(0).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-[#000000]/85 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[9px] font-mono font-semibold text-zinc-100">
                <ImageIcon className="w-3.5 h-3.5" style={{ color: accent.hex }} />
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleDashboardAvatarUpload}
                data-testid="dashboard-profile-photo-upload-input"
                className="hidden"
              />
            </label>

            <div className="min-w-0 flex-1 flex flex-col items-start gap-1">
              {/* Primary Identity Line */}
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  data-testid="dashboard-profile-display-name"
                  className="text-base sm:text-lg font-extrabold text-white tracking-tight truncate"
                >
                  {activeProfileDisplayName}
                </h1>
                <RoleBadge
                  role={accountRole}
                  size="sm"
                  testId="dashboard-profile-role-badge"
                />
              </div>

              {/* Sub-identity Line: Guild Rank Badge directly underneath Commander's Name */}
              <div className="flex items-center">
                <span
                  data-testid="dashboard-profile-guild"
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#000000] border text-[11px] font-mono font-bold tracking-wide"
                  style={{
                    color: accent.hex,
                    borderColor: `${accent.hex}45`,
                  }}
                >
                  <span>« {activeProfileGuild} »</span>
                </span>
              </div>

              {/* Condensed Monospace Telemetry Strip */}
              <div className="inline-flex flex-wrap items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#000000] border border-[#1E222B] text-[11px] font-mono text-zinc-400">
                <span className="inline-flex items-center gap-1 text-zinc-300">
                  <Calendar className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span>{formattedDate}</span>
                </span>

                <span
                  data-testid="dashboard-profile-version"
                  className="inline-flex items-center px-1.5 py-0.2 rounded border border-[#1E222B] font-bold"
                  style={{ color: accent.hex }}
                >
                  {APP_VERSION}
                </span>

                <span className="inline-flex items-center gap-1 text-zinc-300">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      cloudSyncStatus === 'syncing'
                        ? 'bg-amber-400 animate-pulse'
                        : cloudSyncStatus === 'disconnected' || cloudSyncStatus === 'error'
                        ? 'bg-rose-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span>
                    {cloudSyncStatus === 'syncing'
                      ? 'Syncing...'
                      : cloudSyncStatus === 'disconnected' || cloudSyncStatus === 'error'
                      ? 'Offline'
                      : lastCloudSyncAt
                      ? `Synced ${formatLastUpdated(lastCloudSyncAt)}`
                      : 'Synced'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Condensed Segmented Profile Action Bar */}
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-[#000000] border border-[#1E222B] self-start sm:self-center shrink-0">
            <button
              type="button"
              onClick={handleOpenDashboardProfileEditor}
              data-testid="dashboard-profile-edit-toggle-btn"
              title="Customize Profile"
              className={`px-2.5 py-1 rounded-md bg-[#000000] border text-[11px] font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                isEditingDashboardProfile
                  ? 'border-white text-white'
                  : 'border-transparent hover:border-[#1E222B] text-zinc-300 hover:text-white'
              }`}
              style={
                isEditingDashboardProfile
                  ? { borderColor: accent.hex, color: accent.hex }
                  : undefined
              }
            >
              <Edit3 className="w-3 h-3 shrink-0" style={{ color: accent.hex }} />
              <span>{isEditingDashboardProfile ? 'Done' : 'Edit'}</span>
            </button>

            <label
              data-testid="dashboard-profile-change-photo-btn"
              title="Change Profile Photo"
              className="px-2.5 py-1 rounded-md bg-[#000000] hover:border-cyan-500/40 border border-transparent text-[11px] font-mono font-semibold text-zinc-300 hover:text-cyan-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ImageIcon className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleDashboardAvatarUpload}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => void syncVaultNow({ silent: false })}
              data-testid="dashboard-profile-sync-btn"
              title="Sync Profile"
              className="px-2.5 py-1 rounded-md bg-[#000000] hover:border-emerald-500/40 border border-transparent text-[11px] font-mono font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RotateCw
                className={`w-3 h-3 shrink-0 ${
                  cloudSyncStatus === 'syncing' ? 'animate-spin' : ''
                }`}
              />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Inline Profile Customization Form (Pure-Black #000000) */}
        {isEditingDashboardProfile && (
          <form
            onSubmit={handleSaveDashboardProfile}
            data-testid="dashboard-profile-edit-form"
            className="mt-5 pt-4 border-t border-[#1E222B] grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-[#000000]"
          >
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={profileNameDraft}
                onChange={(e) => setProfileNameDraft(e.target.value)}
                data-testid="dashboard-profile-name-input"
                placeholder="User"
                className="w-full px-3.5 py-2 rounded-xl bg-[#000000] border border-[#1E222B] text-xs font-mono text-white focus:outline-none focus:border-emerald-400 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">
                Guild / Callsign
              </label>
              <input
                type="text"
                value={profileGuildDraft}
                onChange={(e) => setProfileGuildDraft(e.target.value)}
                data-testid="dashboard-profile-guild-input"
                placeholder="Aegis Vanguard"
                className="w-full px-3.5 py-2 rounded-xl bg-[#000000] border border-[#1E222B] text-xs font-mono text-white focus:outline-none focus:border-emerald-400 transition-colors"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                data-testid="dashboard-profile-save-btn"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-bold transition-colors cursor-pointer"
              >
                Save Profile
              </button>
              {activeProfileAvatar && (
                <button
                  type="button"
                  onClick={() => {
                    void updateAppData((prev) => ({
                      ...prev,
                      settings: {
                        ...prev.settings,
                        avatarDataUrl: '',
                      },
                    }));
                    showNotification('Profile photo cleared.', 'info');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-rose-500/50 text-xs font-mono text-rose-300 transition-colors cursor-pointer"
                >
                  Reset Photo
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* TIER 2: SECTION HEADER BAR DIRECTLY ABOVE DASHBOARD GRID */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-zinc-100 tracking-tight">Operational Panels</h2>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-[#000000] border border-[#1E222B] text-zinc-400">
            {visibleCards.length} Active
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={handleOpenCreatePanelModal}
            data-testid="add-custom-column-btn"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#000000] text-cyan-300 border border-[#1E222B] hover:border-cyan-500/40 transition-all whitespace-nowrap"
          >
            <span>+ Add Custom Panel</span>
          </button>

          {isColumnEditMode && (
            <button
              type="button"
              onClick={handleResetMatrixLayout}
              data-testid="reset-matrix-layout"
              className="px-3 py-1.5 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-zinc-700 text-xs font-mono text-zinc-300 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Panels</span>
            </button>
          )}
        </div>
      </div>

      {/* Hidden Panels Restore Tray (Shown when Customize Panels mode is active) */}
      {isColumnEditMode && hiddenCards.length > 0 && (
        <div
          data-testid="hidden-panels-tray"
          className="p-3 rounded-xl bg-[#000000] border border-purple-500/40 flex flex-wrap items-center gap-2 text-xs"
        >
          <span className="text-purple-300 font-mono font-semibold">
            Hidden Panels ({hiddenCards.length}):
          </span>
          {hiddenCards.map((hc) => (
            <button
              key={hc.id}
              type="button"
              data-testid={`restore-panel-${hc.id}`}
              onClick={() => handleToggleVisibility(hc.id)}
              className="px-2.5 py-1 rounded-lg bg-[#000000] hover:border-zinc-600 border border-[#1E222B] text-zinc-200 flex items-center gap-1.5 transition-colors"
            >
              <Eye className="w-3 h-3 text-emerald-400" />
              <span>Restore {getCardTitle(hc)}</span>
            </button>
          ))}
        </div>
      )}

      {/* UNIFIED 2D RESPONSIVE AUTO-FIT PANEL GRID */}
      <div
        className={`grid ${gridColsClass} ${gridGapClass} items-stretch`}
        style={autoFitGridStyle}
        data-testid="dashboard-3col-matrix"
      >
        {visibleCards.map((widget, index) => {
          const rowNum = Math.floor(index / gridCols) + 1;
          const colNum = (index % gridCols) + 1;

          const canLeft = canMoveInMatrix(index, visibleCards.length, 'left', gridCols);
          const canRight = canMoveInMatrix(index, visibleCards.length, 'right', gridCols);
          const canUp = canMoveInMatrix(index, visibleCards.length, 'up', gridCols);
          const canDown = canMoveInMatrix(index, visibleCards.length, 'down', gridCols);
          const currentSpan = normalizeColSpan(widget.colSpan);
          const spanClass = getColSpanClass(widget.colSpan, gridCols);
          const isDragTarget = dragOverIndex === index && draggedIndex !== index;

          return (
            <div
              key={widget.id}
              data-testid={`matrix-card-${widget.id}`}
              data-matrix-index={index}
              data-col-span={String(currentSpan)}
              draggable={isColumnEditMode}
              onDragStart={() => {
                if (isColumnEditMode) setDraggedIndex(index);
              }}
              onDragOver={(e) => {
                if (isColumnEditMode) {
                  e.preventDefault();
                  setDragOverIndex(index);
                }
              }}
              onDragLeave={() => {
                if (isColumnEditMode && dragOverIndex === index) {
                  setDragOverIndex(null);
                }
              }}
              onDrop={(e) => {
                if (isColumnEditMode && draggedIndex !== null) {
                  e.preventDefault();
                  handleDropCard(draggedIndex, index);
                }
              }}
              className={`${spanClass} flex flex-col relative transition-all duration-200 rounded-[12px] ${
                isColumnEditMode
                  ? 'ring-2 ring-purple-500/80 bg-purple-950/10 p-1.5 shadow-xl'
                  : ''
              } ${isDragTarget ? 'ring-4 ring-cyan-400 bg-cyan-950/20 scale-[1.01]' : ''}`}
            >
              {/* Sleek Single-Line Floating Edit Overlay */}
              {isColumnEditMode && (
                <div
                  className="mb-1.5 px-2.5 py-1.5 rounded-lg bg-[#09090b] border border-purple-500/60 shadow-md flex items-center justify-between gap-2 text-xs overflow-x-auto scrollbar-none"
                  data-testid={`matrix-overlay-${widget.id}`}
                >
                  {/* Left: Drag Grip + R#·C# Coordinates */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <GripVertical className="w-3.5 h-3.5 text-purple-400 cursor-grab shrink-0" />
                    <span className="font-mono text-[11px] text-purple-300 font-bold whitespace-nowrap">
                      R{rowNum}·C{colNum}
                    </span>
                  </div>

                  {/* Center: 1x | 2x | 3x | Full Selector */}
                  <div className="flex items-center gap-0.5 bg-zinc-900 p-0.5 rounded-md border border-zinc-800 shrink-0">
                    {(
                      [
                        { val: 1, label: '1x' },
                        { val: 2, label: '2x' },
                        { val: 3, label: '3x' },
                        { val: 'full', label: 'Full' },
                      ] as { val: 1 | 2 | 3 | 'full'; label: string }[]
                    ).map((sp) => (
                      <button
                        key={sp.label}
                        type="button"
                        data-testid={`span-${sp.label}-${widget.id}`}
                        onClick={() => handleChangeColSpan(widget.id, sp.val)}
                        className={`px-1.5 py-0.5 rounded font-mono text-[11px] transition-colors ${
                          currentSpan === sp.val
                            ? 'bg-purple-600 text-white font-bold'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                        title={`Set panel width to ${sp.label}`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>

                  {/* Right: Compact Icon Buttons (←, →, ↑, ↓, Settings, Hide/Delete) */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={!canLeft}
                      onClick={() => handleMoveCard2D(index, 'left')}
                      data-testid={`move-left-${widget.id}`}
                      className="p-1 rounded bg-zinc-900 hover:bg-purple-600/40 border border-zinc-800 disabled:opacity-25 text-zinc-200"
                      title="Move Left"
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={!canRight}
                      onClick={() => handleMoveCard2D(index, 'right')}
                      data-testid={`move-right-${widget.id}`}
                      className="p-1 rounded bg-zinc-900 hover:bg-purple-600/40 border border-zinc-800 disabled:opacity-25 text-zinc-200"
                      title="Move Right"
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={!canUp}
                      onClick={() => handleMoveCard2D(index, 'up')}
                      data-testid={`move-up-${widget.id}`}
                      className="p-1 rounded bg-zinc-900 hover:bg-purple-600/40 border border-zinc-800 disabled:opacity-25 text-zinc-200"
                      title="Move Up 1 Row"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={!canDown}
                      onClick={() => handleMoveCard2D(index, 'down')}
                      data-testid={`move-down-${widget.id}`}
                      className="p-1 rounded bg-zinc-900 hover:bg-purple-600/40 border border-zinc-800 disabled:opacity-25 text-zinc-200"
                      title="Move Down 1 Row"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditPanelModal(widget)}
                      data-testid={`panel-settings-${widget.id}`}
                      className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white"
                      title="Panel Settings"
                    >
                      <Settings className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(widget.id)}
                      data-testid={`hide-col-${widget.id}`}
                      className="p-1 rounded bg-zinc-900 hover:bg-rose-500/20 border border-zinc-800 text-zinc-400 hover:text-rose-300"
                      title="Hide panel"
                    >
                      <EyeOff className="w-3 h-3" />
                    </button>

                    {(widget.isCustom || String(widget.id).startsWith('custom_')) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCustomPanel(widget.id)}
                        data-testid={`delete-custom-panel-${widget.id}`}
                        className="p-1 rounded bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-400"
                        title="Delete custom panel"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Panel Body */}
              <div className="flex-1 flex flex-col">{renderMatrixCardContent(widget)}</div>
            </div>
          );
        })}
      </div>

      {/* RICH CUSTOM PANEL CREATOR / SETTINGS MODAL */}
      {showCustomPanelModal && (
        <div
          onDoubleClick={customPanelGuard.handleBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            data-testid="custom-panel-modal"
            className="w-full max-w-lg bg-[#151821] border border-[#232732] rounded-2xl shadow-[0_4px_20px_-2px_rgba(0,0,0,0.5)] p-6 space-y-5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#20242E]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingPanelId ? 'Configure Dashboard Panel' : 'Create Custom Dashboard Panel'}
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Choose a functional template, accent color, and 2D column span
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={customPanelGuard.requestExplicitClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnsavedChangesBanner
              isOpen={customPanelGuard.showConfirmClose}
              onKeepEditing={customPanelGuard.cancelClose}
              onDiscardAndClose={customPanelGuard.confirmDiscardAndClose}
            />

            <form onSubmit={handleSaveCustomPanelModal} className="space-y-4">
              {/* Panel Title */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Panel Title
                </label>
                <input
                  type="text"
                  required
                  value={newPanelTitle}
                  onChange={(e) => setNewPanelTitle(e.target.value)}
                  data-testid="custom-panel-title-input"
                  placeholder="e.g. Sprint Backlog, Hydration Tracker, Bio-Protocols..."
                  className="w-full px-3.5 py-2 rounded-xl bg-[#09090b] border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Panel Type (5 Templates) */}
              {(!editingPanelId || String(editingPanelId).startsWith('custom_')) && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Panel Type (Functional Template)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: 'checklist',
                          label: 'Action Checklist',
                          desc: 'Inline edit, delete & Clear Done',
                        },
                        {
                          id: 'notes',
                          label: 'Encrypted Scratchpad',
                          desc: 'Auto-saving notes + 1-click Copy',
                        },
                        {
                          id: 'counter',
                          label: 'Metric & Target Counter',
                          desc: 'Track numbers, step & progress bar',
                        },
                        {
                          id: 'habits',
                          label: 'Daily Habit Tracker',
                          desc: '7-day matrix + streak counter',
                        },
                        {
                          id: 'key_value',
                          label: 'Key-Value Data Card',
                          desc: 'Structured Label : Value pairs',
                        },
                      ] as { id: CustomPanelType; label: string; desc: string }[]
                    ).map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        data-testid={`panel-type-${tpl.id}`}
                        onClick={() => setNewPanelType(tpl.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          newPanelType === tpl.id
                            ? 'bg-cyan-500/15 border-cyan-500/50 text-white shadow-sm'
                            : 'bg-[#09090b] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="text-xs font-bold text-zinc-100">{tpl.label}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{tpl.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Counter Specific Target & Unit Config */}
              {newPanelType === 'counter' && (
                <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-[#09090b] border border-zinc-800">
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Target Value</label>
                    <input
                      type="number"
                      step="any"
                      value={newCounterTarget}
                      onChange={(e) => setNewCounterTarget(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Unit</label>
                    <input
                      type="text"
                      value={newCounterUnit}
                      onChange={(e) => setNewCounterUnit(e.target.value)}
                      placeholder="cups, hrs, mi"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">Quick Step</label>
                    <input
                      type="number"
                      step="any"
                      value={newCounterStep}
                      onChange={(e) => setNewCounterStep(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Accent Color & Column Span */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2">
                    {(
                      ['emerald', 'cyan', 'violet', 'amber', 'rose', 'sky'] as CustomPanelColor[]
                    ).map((col) => (
                      <button
                        key={col}
                        type="button"
                        data-testid={`panel-color-${col}`}
                        onClick={() => setNewPanelColor(col)}
                        title={col}
                        className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-transform ${
                          newPanelColor === col ? 'scale-110 ring-2 ring-white border-white' : 'border-zinc-700 opacity-75 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: getPanelColorStyle(col).hex }}
                      >
                        {newPanelColor === col && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Column Span
                  </label>
                  <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-[#09090b] border border-zinc-800">
                    {(
                      [
                        { val: 1, label: '1x' },
                        { val: 2, label: '2x' },
                        { val: 3, label: '3x' },
                        { val: 'full', label: 'Full' },
                      ] as { val: 1 | 2 | 3 | 'full'; label: string }[]
                    ).map((sp) => (
                      <button
                        key={sp.label}
                        type="button"
                        onClick={() => setNewPanelSpan(sp.val)}
                        className={`py-1 rounded-lg text-xs font-mono transition-colors ${
                          newPanelSpan === sp.val
                            ? 'bg-purple-600 text-white font-bold'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={customPanelGuard.requestExplicitClose}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="save-custom-panel-btn"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold transition-colors"
                >
                  {editingPanelId ? 'Save Panel Settings' : 'Create Panel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
