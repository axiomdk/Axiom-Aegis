import React, { useState, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import { GoalEntry, GoalMilestone } from '../types';
import {
  Target,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  Edit2,
  X,
} from 'lucide-react';
import {
  calculateFundsSummary,
} from '../utils/calculations';
import {
  calculateFinancialRunwayAndBurn,
  computeLiveGoalMetrics,
  syncGoalsWithLiveModules,
} from '../utils/aegisUpgradesEngine';
import { getCategoriesByDomain } from '../utils/categoryEngine';
import { InlineCategoryBadge } from './InlineCategoryBadge';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';
import { isFormStateDirty } from '../utils/modalGuardEngine';

export const GoalsView: React.FC = () => {
  const { appData, updateAppData, isEditMode, accent, showNotification } = useVault();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingGoal, setEditingGoal] = useState<GoalEntry | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New goal state
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<GoalEntry['category']>('fitness');
  const [newTargetDate, setNewTargetDate] = useState('2026-12-31');
  const [newCurrentVal, setNewCurrentVal] = useState('');
  const [newTargetVal, setNewTargetVal] = useState('');
  const [newUnit, setNewUnit] = useState('lbs');
  const [newMilestonesText, setNewMilestonesText] = useState('');
  const [newNotes, setNewNotes] = useState('');

  const netBalance = useMemo(() => {
    return calculateFundsSummary(
      appData?.funds || [],
      appData?.settings?.startingBalance || 0
    ).currentBalance;
  }, [appData?.funds, appData?.settings?.startingBalance]);

  const runwaySummary = useMemo(() => {
    return calculateFinancialRunwayAndBurn(
      appData?.funds || [],
      appData?.settings?.startingBalance || 0
    );
  }, [appData?.funds, appData?.settings?.startingBalance]);

  const goals = useMemo(() => {
    return syncGoalsWithLiveModules(
      appData?.goals || [],
      netBalance,
      appData?.lifeStats || [],
      { distances: appData?.distances || [] }
    );
  }, [appData?.goals, netBalance, appData?.lifeStats, appData?.distances]);

  const isCreateGoalDirty =
    isCreateModalOpen &&
    (newTitle.trim().length > 0 ||
      newCurrentVal.trim().length > 0 ||
      newTargetVal.trim().length > 0 ||
      newMilestonesText.trim().length > 0 ||
      newNotes.trim().length > 0);

  const createGoalGuard = useModalGuard({
    isOpen: isCreateModalOpen,
    isDirty: isCreateGoalDirty,
    onClose: () => setIsCreateModalOpen(false),
  });

  const originalGoalEntry = useMemo(() => {
    if (!editingGoal) return null;
    return goals.find((g) => g.id === editingGoal.id) || null;
  }, [editingGoal?.id, goals]);

  const isEditGoalDirty = useMemo(() => {
    if (!editingGoal || !originalGoalEntry) return false;
    return isFormStateDirty(
      originalGoalEntry as unknown as Record<string, unknown>,
      editingGoal as unknown as Record<string, unknown>
    );
  }, [editingGoal, originalGoalEntry]);

  const editGoalGuard = useModalGuard({
    isOpen: Boolean(editingGoal),
    isDirty: isEditGoalDirty,
    onClose: () => setEditingGoal(null),
  });

  const filteredGoals = useMemo(() => {
    return goals.filter((g) => {
      if (selectedCategory === 'all') return true;
      return g.category === selectedCategory;
    });
  }, [goals, selectedCategory]);

  const toggleMilestone = async (goalId: string, milestoneId: string) => {
    await updateAppData((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const updatedMilestones = g.milestones.map((m) =>
          m.id === milestoneId
            ? { ...m, completed: !m.completed, manualOverride: true }
            : m
        );
        const allCompleted = updatedMilestones.every((m) => m.completed);
        return {
          ...g,
          milestones: updatedMilestones,
          status: allCompleted ? 'completed' : g.status === 'completed' ? 'in_progress' : g.status,
        };
      }),
    }));
  };

  const toggleGoalManualOverride = async (goalId: string) => {
    await updateAppData((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => {
        if (g.id !== goalId) return g;
        const nextOverride = !g.manualOverride;
        return {
          ...g,
          manualOverride: nextOverride,
          milestones: nextOverride
            ? g.milestones
            : g.milestones.map((m) => ({ ...m, manualOverride: undefined })),
        };
      }),
    }));
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const milestonesList: GoalMilestone[] = newMilestonesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((title, i) => ({
        id: `m-${Date.now()}-${i}`,
        title,
        completed: false,
      }));

    const newGoal: GoalEntry = {
      id: `g-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      targetDate: newTargetDate,
      currentValue: newCurrentVal ? parseFloat(newCurrentVal) : undefined,
      targetValue: newTargetVal ? parseFloat(newTargetVal) : undefined,
      unit: newUnit.trim() || undefined,
      milestones: milestonesList,
      status: 'in_progress',
      notes: newNotes.trim() || undefined,
      createdAt: Date.now(),
    };

    await updateAppData((prev) => ({
      ...prev,
      goals: [newGoal, ...prev.goals],
    }));

    showNotification('Goal created and encrypted!', 'success');
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewMilestonesText('');
    setNewNotes('');
  };

  const handleDelete = async (id: string, title: string) => {
    await updateAppData((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== id),
    }));
    showNotification(`Goal "${title}" deleted.`, 'info');
  };

  const handleUpdateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGoal) return;

    await updateAppData((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === editingGoal.id ? editingGoal : g)),
    }));

    showNotification('Goal updated!', 'success');
    setEditingGoal(null);
  };

  const goalCategoryConfigs = useMemo(
    () => getCategoriesByDomain(appData, 'goals'),
    [appData]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5" style={{ color: accent.hex }} />
            Strategic Life Goals
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Track milestones, numerical targets, and completion rates with zero server sync
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${accent.primaryBg}`}
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Category Pills (with Inline Category Rename support) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium capitalize shrink-0 transition-colors border bg-[#000000] ${
            selectedCategory === 'all'
              ? 'text-white border-zinc-600 shadow-sm'
              : 'text-zinc-400 border-[#1E222B] hover:text-zinc-200'
          }`}
          style={selectedCategory === 'all' ? { color: accent.hex } : undefined}
        >
          all
        </button>
        {goalCategoryConfigs.map((catObj) => (
          <InlineCategoryBadge
            key={catObj.id}
            domain="goals"
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

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="p-12 text-center bg-[#000000] border border-[#1E222B] rounded-2xl space-y-3">
          <Target className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-sm text-zinc-300">No goals found for this category.</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="text-xs text-emerald-400 hover:underline"
          >
            + Create your first goal
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGoals.map((goal) => {
            const liveMetrics = computeLiveGoalMetrics(
              goal,
              {
                funds: appData?.funds || [],
                lifeStats: appData?.lifeStats || [],
                distances: appData?.distances || [],
                settings: appData?.settings!,
              },
              runwaySummary.netMonthlyCashflowVelocity
            );
            const progress = liveMetrics.completionPercent;
            const isCompleted = progress === 100 || goal.status === 'completed';

            return (
              <div
                key={goal.id}
                data-testid={`goal-card-${goal.id}`}
                onDoubleClick={() => isEditMode && setEditingGoal(goal)}
                title="Double-click card or click Edit icon to edit goal"
                className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg flex flex-col justify-between space-y-4 hover:border-zinc-700/80 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <InlineCategoryBadge
                        domain="goals"
                        category={goal.category}
                        size="xs"
                        className="uppercase font-mono bg-[#000000] text-zinc-400 border-[#1E222B]"
                      />
                      {goal.manualOverride && (
                        <button
                          type="button"
                          data-testid={`goal-live-sync-badge-${goal.id}`}
                          onClick={() => toggleGoalManualOverride(goal.id)}
                          title="Manual Override active — Click to re-enable auto-sync"
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border transition-colors bg-[#000000] text-amber-300 border-amber-500/40"
                        >
                          MANUAL OVERRIDE
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded font-mono tabular-nums bg-[#000000] border border-[#1E222B] ${
                          isCompleted ? 'text-emerald-400' : 'text-zinc-300'
                        }`}
                      >
                        {progress}% Completed
                      </span>
                      {isEditMode && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingGoal(goal)}
                            data-testid={`mobile-edit-btn-goal-${goal.id}`}
                            className="max-md:min-h-[40px] max-md:px-2.5 max-md:border max-md:border-[#1E222B] max-md:rounded-lg p-1 text-zinc-400 hover:text-white flex items-center gap-1"
                            aria-label={`Edit goal ${goal.title}`}
                          >
                            <Edit2 className="w-3 h-3" />
                            <span className="md:hidden text-[11px] font-mono">[Edit]</span>
                          </button>
                          <button
                            onClick={() => handleDelete(goal.id, goal.title)}
                            className="max-md:min-h-[40px] max-md:min-w-[40px] max-md:border max-md:border-[#1E222B] max-md:rounded-lg p-1 text-rose-400/80 hover:text-rose-400 flex items-center justify-center"
                            aria-label={`Delete goal ${goal.title}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-sm font-bold text-white tracking-tight">{goal.title}</h3>

                  {goal.targetValue !== undefined && (
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between text-xs text-zinc-400 font-mono tabular-nums">
                        <span>
                          Current:{' '}
                          <strong className="text-zinc-100">
                            {goal.unit === '$'
                              ? `$${liveMetrics.liveCurrentValue.toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}`
                              : `${liveMetrics.liveCurrentValue} ${goal.unit || ''}`}
                          </strong>
                        </span>
                        <span>
                          Target:{' '}
                          <strong className="text-zinc-300">
                            {goal.unit === '$'
                              ? `$${goal.targetValue.toLocaleString()}`
                              : `${goal.targetValue} ${goal.unit || ''}`}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-cyan-400">{liveMetrics.deltaFormatted}</span>
                        {liveMetrics.estimatedRunwayLabel && (
                          <span className="text-amber-300" title="Estimated Runway based on Net Monthly Savings Velocity">
                            Runway: {liveMetrics.estimatedRunwayLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="w-full h-2 bg-[#000000] rounded-full overflow-hidden mt-3 border border-[#1E222B]">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${progress}%`,
                        backgroundColor: isCompleted ? '#10b981' : accent.hex,
                      }}
                    />
                  </div>

                  {/* Milestones Checklist */}
                  {goal.milestones && goal.milestones.length > 0 && (
                    <div className="mt-4 space-y-1.5 pt-3 border-t border-[#1E222B]">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 mb-1">
                        <span>Tactical Milestones:</span>
                        <span className="font-mono text-[10px]">
                          {goal.milestones.filter((m) => m.completed).length}/{goal.milestones.length}
                        </span>
                      </div>
                      {goal.milestones.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => toggleMilestone(goal.id, m.id)}
                          className="w-full flex items-center justify-between gap-2 text-left text-xs py-1 px-1.5 rounded hover:bg-[#111319] transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {m.completed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                            )}
                            <span
                              className={`truncate ${
                                m.completed ? 'line-through text-zinc-500' : 'text-zinc-300'
                              }`}
                            >
                              {m.title}
                            </span>
                          </div>
                          {m.manualOverride && (
                            <span className="text-[9px] font-mono text-amber-400 shrink-0">
                              MANUAL
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {goal.notes && (
                    <p className="mt-3 text-xs text-zinc-500 italic line-clamp-2">"{goal.notes}"</p>
                  )}
                </div>

                <div className="pt-3 border-t border-[#1E222B] flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-zinc-500" />
                    <span>Target: {goal.targetDate}</span>
                  </div>
                  <span className={isCompleted ? 'text-emerald-400 font-semibold' : ''}>
                    {isCompleted ? 'Achieved' : 'Active'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Goal Modal */}
      {isCreateModalOpen && (
        <div
          onDoubleClick={createGoalGuard.handleBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1E222B] mb-4">
              <h3 className="text-sm font-bold text-white">Create Strategic Goal</h3>
              <button
                type="button"
                onClick={createGoalGuard.requestExplicitClose}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnsavedChangesBanner
              isOpen={createGoalGuard.showConfirmClose}
              onKeepEditing={createGoalGuard.cancelClose}
              onDiscardAndClose={createGoalGuard.confirmDiscardAndClose}
            />

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Goal Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Reach 170 lbs Target Lean Weight"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                  >
                    {goalCategoryConfigs.map((c) => (
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
                    value={newTargetDate}
                    onChange={(e) => setNewTargetDate(e.target.value)}
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
                    value={newCurrentVal}
                    onChange={(e) => setNewCurrentVal(e.target.value)}
                    placeholder="175"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Target Val</label>
                  <input
                    type="number"
                    step="any"
                    value={newTargetVal}
                    onChange={(e) => setNewTargetVal(e.target.value)}
                    placeholder="170"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Unit</label>
                  <input
                    type="text"
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    placeholder="lbs, $, mi"
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Milestones (1 per line)
                </label>
                <textarea
                  rows={3}
                  value={newMilestonesText}
                  onChange={(e) => setNewMilestonesText(e.target.value)}
                  placeholder="Phase 1 complete&#10;Phase 2 test&#10;Final deployment"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Notes / Strategy</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Key habits and tactics to succeed"
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={createGoalGuard.requestExplicitClose}
                  className="flex-1 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold ${accent.primaryBg}`}
                >
                  Create Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Goal Modal */}
      {editingGoal && (
        <div
          onDoubleClick={editGoalGuard.handleBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1E222B] mb-4">
              <h3 className="text-sm font-bold text-white">Edit Goal</h3>
              <button
                type="button"
                onClick={editGoalGuard.requestExplicitClose}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnsavedChangesBanner
              isOpen={editGoalGuard.showConfirmClose}
              onKeepEditing={editGoalGuard.cancelClose}
              onDiscardAndClose={editGoalGuard.confirmDiscardAndClose}
            />

            <form onSubmit={handleUpdateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={editingGoal.title}
                  onChange={(e) => setEditingGoal({ ...editingGoal, title: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Current Val</label>
                  <input
                    type="number"
                    step="any"
                    value={editingGoal.currentValue ?? ''}
                    onChange={(e) =>
                      setEditingGoal({
                        ...editingGoal,
                        currentValue: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Target Val</label>
                  <input
                    type="number"
                    step="any"
                    value={editingGoal.targetValue ?? ''}
                    onChange={(e) =>
                      setEditingGoal({
                        ...editingGoal,
                        targetValue: e.target.value ? parseFloat(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Status</label>
                <select
                  value={editingGoal.status}
                  onChange={(e) =>
                    setEditingGoal({ ...editingGoal, status: e.target.value as any })
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                >
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On Hold</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={editGoalGuard.requestExplicitClose}
                  className="flex-1 py-2 rounded-lg bg-zinc-800 text-xs text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold ${accent.primaryBg}`}
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
