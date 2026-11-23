import React, { useState, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import { LifeStatEntry } from '../types';
import {
  Activity,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  Smile,
  DollarSign,
  User,
  X,
  Scale,
} from 'lucide-react';
import { calculateStatsSummary, kgToLbs } from '../utils/calculations';
import { calculateBiometricsCorrelation } from '../utils/aegisUpgradesEngine';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';
import { isFormStateDirty } from '../utils/modalGuardEngine';

export const LifeStatsView: React.FC = () => {
  const {
    appData,
    updateAppData,
    isEditMode,
    openQuickAdd,
    accent,
    showNotification,
  } = useVault();

  const [editingStat, setEditingStat] = useState<LifeStatEntry | null>(null);

  const stats = appData?.lifeStats || [];
  const summary = useMemo(() => calculateStatsSummary(stats), [stats]);
  const correlation = useMemo(
    () => calculateBiometricsCorrelation(stats, appData?.timeline || []),
    [stats, appData?.timeline]
  );

  const originalStatEntry = useMemo(() => {
    if (!editingStat) return null;
    return stats.find((s) => s.id === editingStat.id) || null;
  }, [editingStat?.id, stats]);

  const isEditStatDirty = useMemo(() => {
    if (!editingStat || !originalStatEntry) return false;
    return isFormStateDirty(
      originalStatEntry as unknown as Record<string, unknown>,
      editingStat as unknown as Record<string, unknown>
    );
  }, [editingStat, originalStatEntry]);

  const editStatGuard = useModalGuard({
    isOpen: Boolean(editingStat),
    isDirty: isEditStatDirty,
    onClose: () => setEditingStat(null),
  });

  // Sort chronological for charts
  const chronologicalStats = useMemo(() => {
    return [...stats].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [stats]);

  // Weight history SVG chart data in Imperial Pounds (lbs)
  const weightPoints = useMemo(() => {
    return chronologicalStats
      .map((s) => ({
        id: s.id,
        date: s.date,
        weightLbs:
          s.weightLbs !== undefined && s.weightLbs !== null
            ? s.weightLbs
            : s.weightKg
            ? kgToLbs(s.weightKg)
            : null,
      }))
      .filter((p): p is { id: string; date: string; weightLbs: number } => p.weightLbs !== null);
  }, [chronologicalStats]);

  const minWeight = useMemo(() => {
    if (weightPoints.length === 0) return 160;
    const min = Math.min(...weightPoints.map((p) => p.weightLbs));
    return Math.floor(min - 3);
  }, [weightPoints]);

  const maxWeight = useMemo(() => {
    if (weightPoints.length === 0) return 190;
    const max = Math.max(...weightPoints.map((p) => p.weightLbs));
    return Math.ceil(max + 3);
  }, [weightPoints]);

  const chartWidth = 600;
  const chartHeight = 180;
  const padding = 35;

  const pointsSvg = useMemo(() => {
    if (weightPoints.length < 2) return '';
    return weightPoints
      .map((p, idx) => {
        const x = padding + (idx / (weightPoints.length - 1)) * (chartWidth - padding * 2);
        const y =
          chartHeight -
          padding -
          ((p.weightLbs - minWeight) / (maxWeight - minWeight || 1)) * (chartHeight - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }, [weightPoints, minWeight, maxWeight]);

  const handleDelete = async (id: string, date: string) => {
    await updateAppData((prev) => ({
      ...prev,
      lifeStats: prev.lifeStats.filter((s) => s.id !== id),
    }));
    showNotification(`Life statistics entry for ${date} deleted.`, 'info');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStat) return;

    await updateAppData((prev) => ({
      ...prev,
      lifeStats: prev.lifeStats.map((item) => (item.id === editingStat.id ? editingStat : item)),
    }));

    showNotification('Life stats updated!', 'success');
    setEditingStat(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-5 h-5" style={{ color: accent.hex }} />
            Life Statistics & Body Metrics
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Imperial tracking (lbs, ft/in) • Weight trend curve • 1-10 Mood matrix
          </p>
        </div>

        <button
          onClick={() => openQuickAdd('lifestats')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${accent.primaryBg}`}
        >
          <Plus className="w-4 h-4" />
          <span>Log Metrics</span>
        </button>
      </div>

      {/* Unique Body Measurement & Vitality Banner */}
      <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] text-purple-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Current Benchmark Weight</span>
            <div className="text-2xl font-black text-white font-mono">
              {summary.latestWeightLbs ? `${summary.latestWeightLbs} lbs` : '--'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] text-sky-400">
            <User className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Height & Stature</span>
            <div className="text-2xl font-black text-white font-mono">
              {summary.latestHeightFormatted || '--'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] text-amber-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-mono text-zinc-400 uppercase">Reported Weekly Rate</span>
            <div className="text-2xl font-black text-white font-mono">
              {summary.latestIncome !== undefined && summary.latestIncome !== null
                ? `$${summary.latestIncome.toLocaleString()}`
                : '--'}{' '}
              <span className="text-xs text-zinc-500 font-sans">USD</span>
            </div>
          </div>
        </div>
      </div>

      {/* Biometrics vs. Activity Correlation Engine */}
      <div
        data-testid="biometrics-correlation-panel"
        className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-[#1E222B]">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <span>Biometrics vs. Activity Correlation Engine</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Cross-module correlation between scheduled activities (&gt;=1h Health/Work) and logged Biometrics
            </p>
          </div>
          <span
            data-testid="biometrics-correlation-pill"
            className="px-2.5 py-1 rounded-lg bg-[#000000] border border-[#1E222B] text-[11px] font-mono font-bold text-emerald-400"
          >
            {correlation.summaryPillText}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-400">
              Avg Mood (Active Days)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-emerald-400">
                {correlation.avgMoodActiveDays > 0 ? `${correlation.avgMoodActiveDays}/10` : '--'}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                ({correlation.activeDaysCount} active {correlation.activeDaysCount === 1 ? 'day' : 'days'})
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-400">
              Avg Mood (Rest Days)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-purple-400">
                {correlation.avgMoodRestDays > 0 ? `${correlation.avgMoodRestDays}/10` : '--'}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                ({correlation.moodDeltaPoints >= 0 ? '+' : ''}
                {correlation.moodDeltaPoints} pts delta)
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] space-y-1">
            <span className="text-[10px] font-mono uppercase text-zinc-400">
              7-Day Weight Trend Velocity
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-black font-mono text-cyan-400">
                {correlation.weightVelocity7dLbs !== null
                  ? `${correlation.weightVelocity7dLbs > 0 ? '+' : ''}${correlation.weightVelocity7dLbs} lbs/wk`
                  : '--'}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                7d trend
              </span>
            </div>
          </div>
        </div>
        <p className="text-xs text-zinc-400 font-mono">{correlation.detailedInsightText}</p>
      </div>

      {/* Weight History Visual Chart in Imperial Pounds (lbs) */}
      <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1E222B]">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Weight Progression Curve (Pounds / lbs)
            </h3>
            <p className="text-xs text-zinc-400">Pounds tracked chronologically</p>
          </div>
          <div className="text-xs font-mono text-zinc-400">
            Range: {minWeight} lbs – {maxWeight} lbs
          </div>
        </div>

        {weightPoints.length < 2 ? (
          <div className="py-12 text-center text-xs text-zinc-500">
            Log at least 2 life statistics entries with weight to display trend curve.
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full h-44 overflow-visible"
            >
              {/* Grid lines */}
              <line
                x1={padding}
                y1={chartHeight - padding}
                x2={chartWidth - padding}
                y2={chartHeight - padding}
                stroke="#27272a"
                strokeWidth="1"
              />
              <line
                x1={padding}
                y1={padding}
                x2={chartWidth - padding}
                y2={padding}
                stroke="#27272a"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Trend Polyline */}
              <polyline
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsSvg}
              />

              {/* Data Dots and Labels */}
              {weightPoints.map((p, idx) => {
                const x = padding + (idx / (weightPoints.length - 1)) * (chartWidth - padding * 2);
                const y =
                  chartHeight -
                  padding -
                  ((p.weightLbs - minWeight) / (maxWeight - minWeight || 1)) * (chartHeight - padding * 2);

                return (
                  <g key={p.id}>
                    <circle
                      cx={x}
                      cy={y}
                      r="4.5"
                      fill="#10b981"
                      stroke="#09090b"
                      strokeWidth="2"
                    />
                    <text
                      x={x}
                      y={y - 10}
                      fill="#e4e4e7"
                      fontSize="10"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {p.weightLbs} lbs
                    </text>
                    <text
                      x={x}
                      y={chartHeight - 10}
                      fill="#71717a"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {p.date.slice(5)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>

      {/* Mood Matrix Strip (Unique to Life Stats page) */}
      <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg">
        <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Smile className="w-4 h-4 text-purple-400" />
          Mood State Heatmap & Reflections
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          Daily subjective focus and vitality rating on a 1–10 scale
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {stats.slice(0, 7).map((entry) => (
            <div
              key={entry.id}
              onDoubleClick={() => isEditMode && setEditingStat(entry)}
              className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] flex flex-col justify-between space-y-1.5"
            >
              <div className="text-[10px] font-mono text-zinc-500">{entry.date}</div>
              <div className="text-lg font-black font-mono text-purple-400">
                {entry.mood}<span className="text-[10px] text-zinc-500 font-sans">/10</span>
              </div>
              <p className="text-[10px] text-zinc-400 truncate italic">
                {entry.moodNote || 'Logged'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Life Stats History Ledger */}
      <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1E222B]">
          <h3 className="text-sm font-bold text-white">Historical Vitality Logs (Imperial)</h3>
          <span className="text-xs text-zinc-400 font-mono">{stats.length} logs recorded</span>
        </div>

        {stats.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            No statistics logged yet.
          </div>
        ) : (
          <div className="divide-y divide-[#1E222B]">
            {stats.map((entry) => {
              const weightDisplay = entry.weightLbs
                ? `${entry.weightLbs} lbs`
                : entry.weightKg
                ? `${kgToLbs(entry.weightKg)} lbs`
                : null;

              const heightDisplay =
                entry.heightFt !== undefined && entry.heightIn !== undefined
                  ? `${entry.heightFt}' ${entry.heightIn}"`
                  : null;

              return (
                <div
                  key={entry.id}
                  onDoubleClick={() => isEditMode && setEditingStat(entry)}
                  title="Double-click row or click Edit icon to edit log"
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">{entry.date}</span>
                      <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold font-mono">
                        Mood: {entry.mood}/10
                      </span>
                      {weightDisplay && (
                        <span className="font-mono text-zinc-200 font-semibold">
                          {weightDisplay}
                        </span>
                      )}
                      {heightDisplay && (
                        <span className="font-mono text-sky-400">
                          {heightDisplay}
                        </span>
                      )}
                      {entry.weeklyIncome && (
                        <span className="text-emerald-400 font-mono">
                          ${entry.weeklyIncome.toLocaleString()} USD/wk
                        </span>
                      )}
                    </div>
                    {entry.moodNote && (
                      <p className="text-zinc-400 italic">"{entry.moodNote}"</p>
                    )}
                    {entry.notes && (
                      <p className="text-zinc-500">{entry.notes}</p>
                    )}
                  </div>

                  {isEditMode && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setEditingStat(entry)}
                        data-testid={`mobile-edit-btn-stat-${entry.id}`}
                        className="max-md:min-h-[40px] max-md:px-2.5 p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1"
                        title="Edit Log"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span className="md:hidden text-[11px] font-mono">[Edit]</span>
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id, entry.date)}
                        className="max-md:min-h-[40px] max-md:min-w-[40px] p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center"
                        title="Delete Log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Stat Modal */}
      {editingStat && (
        <div
          onDoubleClick={editStatGuard.handleBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1E222B] mb-4">
              <h3 className="text-sm font-bold text-white">Edit Life Statistic Log</h3>
              <button
                type="button"
                onClick={editStatGuard.requestExplicitClose}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnsavedChangesBanner
              isOpen={editStatGuard.showConfirmClose}
              onKeepEditing={editStatGuard.cancelClose}
              onDiscardAndClose={editStatGuard.confirmDiscardAndClose}
            />

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={editingStat.date}
                  onChange={(e) => setEditingStat({ ...editingStat, date: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Weight (lbs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingStat.weightLbs ?? ''}
                    onChange={(e) =>
                      setEditingStat({
                        ...editingStat,
                        weightLbs: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Height (ft)</label>
                  <input
                    type="number"
                    value={editingStat.heightFt ?? 5}
                    onChange={(e) =>
                      setEditingStat({
                        ...editingStat,
                        heightFt: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Height (in)</label>
                  <input
                    type="number"
                    value={editingStat.heightIn ?? 11}
                    onChange={(e) =>
                      setEditingStat({
                        ...editingStat,
                        heightIn: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Mood Rating (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  required
                  value={editingStat.mood}
                  onChange={(e) => setEditingStat({ ...editingStat, mood: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Mood Reflections</label>
                <input
                  type="text"
                  value={editingStat.moodNote || ''}
                  onChange={(e) => setEditingStat({ ...editingStat, moodNote: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Weekly Income ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingStat.weeklyIncome ?? ''}
                  onChange={(e) =>
                    setEditingStat({
                      ...editingStat,
                      weeklyIncome: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={editStatGuard.requestExplicitClose}
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
