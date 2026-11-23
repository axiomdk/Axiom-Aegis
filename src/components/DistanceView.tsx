import React, { useState, useMemo } from 'react';
import { useVault } from '../context/VaultContext';
import { DistanceEntry, DistanceUnit, DistanceActivityType } from '../types';
import {
  Compass,
  Plus,
  Trash2,
  Edit2,
  TrendingUp,
  MapPin,
  Footprints,
  Bike,
  Car,
  Plane,
  X,
  Milestone,
  Sparkles,
  Calendar,
} from 'lucide-react';
import {
  calculateDistanceSummary,
  convertDistance,
  formatStatementMonthLabel,
} from '../utils/calculations';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';
import { isFormStateDirty } from '../utils/modalGuardEngine';

export const DistanceView: React.FC = () => {
  const {
    appData,
    updateAppData,
    isEditMode,
    openQuickAdd,
    openImportHub,
    accent,
    showNotification,
  } = useVault();

  const [displayUnit, setDisplayUnit] = useState<DistanceUnit>(
    appData?.settings?.distanceUnit || 'mi'
  );
  const [selectedStatementMonth, setSelectedStatementMonth] = useState<string>('auto');
  const [editingDistance, setEditingDistance] = useState<DistanceEntry | null>(null);

  const distances = appData?.distances || [];

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const d of distances) {
      if (typeof d.date === 'string' && /^\d{4}-\d{2}/.test(d.date)) {
        months.add(d.date.slice(0, 7));
      }
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [distances]);

  const summary = useMemo(
    () =>
      calculateDistanceSummary(
        distances,
        displayUnit,
        selectedStatementMonth === 'auto' ? undefined : selectedStatementMonth
      ),
    [distances, displayUnit, selectedStatementMonth]
  );

  const filteredDistances = useMemo(() => {
    if (selectedStatementMonth === 'all') return distances;
    return distances.filter((d) =>
      typeof d.date === 'string' && d.date.startsWith(summary.activeStatementMonth)
    );
  }, [distances, selectedStatementMonth, summary.activeStatementMonth]);

  const originalDistanceEntry = useMemo(() => {
    if (!editingDistance) return null;
    return distances.find((d) => d.id === editingDistance.id) || null;
  }, [editingDistance?.id, distances]);

  const isEditDistanceDirty = useMemo(() => {
    if (!editingDistance || !originalDistanceEntry) return false;
    return isFormStateDirty(
      originalDistanceEntry as unknown as Record<string, unknown>,
      editingDistance as unknown as Record<string, unknown>
    );
  }, [editingDistance, originalDistanceEntry]);

  const editDistanceGuard = useModalGuard({
    isOpen: Boolean(editingDistance),
    isDirty: isEditDistanceDirty,
    onClose: () => setEditingDistance(null),
  });

  const handleUnitToggle = (unit: DistanceUnit) => {
    setDisplayUnit(unit);
  };

  const getActivityIcon = (type: DistanceActivityType) => {
    switch (type) {
      case 'walk':
        return <Footprints className="w-4 h-4 text-emerald-400" />;
      case 'run':
        return <TrendingUp className="w-4 h-4 text-cyan-400" />;
      case 'cycle':
        return <Bike className="w-4 h-4 text-purple-400" />;
      case 'drive':
        return <Car className="w-4 h-4 text-amber-400" />;
      case 'flight':
        return <Plane className="w-4 h-4 text-sky-400" />;
      default:
        return <MapPin className="w-4 h-4 text-zinc-400" />;
    }
  };

  const handleDelete = async (id: string, desc: string) => {
    await updateAppData((prev) => ({
      ...prev,
      distances: prev.distances.filter((d) => d.id !== id),
    }));
    showNotification(`Distance entry "${desc}" deleted.`, 'info');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDistance) return;

    await updateAppData((prev) => ({
      ...prev,
      distances: prev.distances.map((d) => (d.id === editingDistance.id ? editingDistance : d)),
    }));

    showNotification('Distance entry updated!', 'success');
    setEditingDistance(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Compass className="w-5 h-5" style={{ color: accent.hex }} />
            Distance Traveled &amp; Monthly Statement Logs
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Monthly Statement Cycle ({summary.activeStatementMonthLabel}) • Activity categorization • Route log archive
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          {/* Statement Month Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#000000] border border-[#1E222B]">
            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
            <select
              data-testid="distance-statement-month-select"
              value={selectedStatementMonth}
              onChange={(e) => setSelectedStatementMonth(e.target.value)}
              className="bg-transparent text-xs font-mono text-white focus:outline-none cursor-pointer"
            >
              <option value="auto" className="bg-[#000000]">
                Active Statement ({summary.activeStatementMonthLabel})
              </option>
              <option value="all" className="bg-[#000000]">
                All Logged Statements ({distances.length})
              </option>
              {availableMonths.map((ym) => (
                <option key={ym} value={ym} className="bg-[#000000]">
                  {formatStatementMonthLabel(ym)} ({ym})
                </option>
              ))}
            </select>
          </div>

          {/* Unit Toggle */}
          <div className="p-1 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center">
            <button
              onClick={() => handleUnitToggle('mi')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                displayUnit === 'mi'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Miles (mi)
            </button>
            <button
              onClick={() => handleUnitToggle('km')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                displayUnit === 'km'
                  ? 'bg-zinc-800 text-white shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Kilometers (km)
            </button>
          </div>

          <button
            onClick={() => openImportHub('timeline_ocr')}
            title="Import Monthly Statement Screenshot via OCR directly into local vault"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#111319] hover:bg-[#181B24] text-zinc-300 hover:text-white border border-[#1E222B] hover:border-[#232732] transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Timeline Screenshot OCR</span>
          </button>

          <button
            onClick={() => openQuickAdd('distance')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-lg transition-all ${accent.primaryBg}`}
          >
            <Plus className="w-4 h-4" />
            <span>Log Distance</span>
          </button>
        </div>
      </div>

      {/* Monthly Statement KPI Summary Strip */}
      <div
        data-testid="distance-monthly-statement-strip"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400">
            <span>Monthly Statement Distance</span>
            <span className="text-cyan-400 font-bold">{summary.activeStatementMonthLabel}</span>
          </div>
          <div
            data-testid="distance-monthly-statement-total"
            className="text-xl font-black font-mono text-white tabular-nums"
          >
            {summary.monthlyStatementTotal}{' '}
            <span className="text-xs font-sans text-cyan-400 uppercase">{displayUnit}</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            Calculated strictly from {summary.activeStatementMonthLabel} statement cycle
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400">
            <span>Statement Route Logs</span>
            <span className="text-emerald-400 font-bold">MONTHLY LOGS</span>
          </div>
          <div
            data-testid="distance-monthly-entries-count"
            className="text-xl font-black font-mono text-emerald-400 tabular-nums"
          >
            {summary.monthlyStatementEntriesCount}{' '}
            <span className="text-xs font-sans text-zinc-400">entries</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            Recorded during {summary.activeStatementMonthLabel}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-1">
          <div className="flex items-center justify-between text-[11px] font-mono uppercase text-zinc-400">
            <span>Cumulative Lifetime Distance</span>
            <span className="text-purple-400 font-bold">ALL STATEMENTS</span>
          </div>
          <div
            data-testid="distance-cumulative-total"
            className="text-xl font-black font-mono text-white tabular-nums"
          >
            {summary.total}{' '}
            <span className="text-xs font-sans text-purple-400 uppercase">{displayUnit}</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-500">
            Across {distances.length} total route records
          </div>
        </div>
      </div>

      {/* Activity & Transport Breakdown Matrix */}
      <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Milestone className="w-4 h-4 text-cyan-400" />
            Activity &amp; Transport Breakdown
          </h3>
          <span className="text-xs font-mono text-cyan-400 font-semibold">
            Active Mode: {displayUnit === 'mi' ? 'Imperial Miles' : 'Metric Kilometers'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(['run', 'cycle', 'walk', 'drive', 'flight', 'other'] as DistanceActivityType[]).map(
            (type) => {
              const dist = Math.round((summary.byType[type] || 0) * 10) / 10;
              return (
                <div
                  key={type}
                  className="p-3.5 rounded-xl bg-[#000000] border border-[#1E222B] flex flex-col justify-between space-y-2 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs capitalize font-medium text-zinc-300">{type}</span>
                    <div className="p-1 rounded bg-[#000000] border border-[#1E222B]">
                      {getActivityIcon(type)}
                    </div>
                  </div>
                  <div className="text-lg font-bold font-mono text-white">
                    {dist}{' '}
                    <span className="text-[10px] text-zinc-500 font-sans uppercase">
                      {displayUnit}
                    </span>
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* Distance Log Table */}
      <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#1E222B]">
          <h3 className="text-sm font-bold text-white">
            Monthly Statement Route Ledger ({selectedStatementMonth === 'all' ? 'All Months' : summary.activeStatementMonthLabel})
          </h3>
          <span className="text-xs text-zinc-400 font-mono">
            {filteredDistances.length} of {distances.length} records
          </span>
        </div>

        {filteredDistances.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500 space-y-2">
            <p>No distance entries logged for this statement cycle yet.</p>
            <button
              onClick={() => openQuickAdd('distance')}
              className="text-xs text-cyan-400 hover:underline"
            >
              + Record your first route
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#1E222B]">
            {filteredDistances.map((entry) => {
              const convertedVal =
                Math.round(convertDistance(entry.distance, entry.unit, displayUnit) * 10) / 10;
              return (
                <div
                  key={entry.id}
                  onDoubleClick={() => isEditMode && setEditingDistance(entry)}
                  title="Double-click row or click Edit icon to edit distance log"
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-[#000000] border border-[#1E222B] shrink-0">
                      {getActivityIcon(entry.type)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{entry.description}</div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">{entry.date}</span>
                        <span>•</span>
                        <span className="capitalize">{entry.type}</span>
                        <span>•</span>
                        <span className="text-zinc-500 font-mono">
                          (Original: {entry.distance} {entry.unit})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-base font-black text-cyan-400 font-mono">
                        {convertedVal}{' '}
                        <span className="text-xs font-sans text-zinc-300 uppercase">
                          {displayUnit}
                        </span>
                      </div>
                    </div>

                    {isEditMode && (
                      <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-800">
                        <button
                          onClick={() => setEditingDistance(entry)}
                          data-testid={`mobile-edit-btn-distance-${entry.id}`}
                          className="max-md:min-h-[40px] max-md:px-2.5 p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white flex items-center gap-1"
                          title="Edit Distance"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span className="md:hidden text-[11px] font-mono">[Edit]</span>
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id, entry.description)}
                          className="max-md:min-h-[40px] max-md:min-w-[40px] p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center"
                          title="Delete Distance"
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
        )}
      </div>

      {/* Edit Distance Modal */}
      {editingDistance && (
        <div
          onDoubleClick={editDistanceGuard.handleBackdropDoubleClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#1E222B] mb-4">
              <h3 className="text-sm font-bold text-white">Edit Distance Log</h3>
              <button
                type="button"
                onClick={editDistanceGuard.requestExplicitClose}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <UnsavedChangesBanner
              isOpen={editDistanceGuard.showConfirmClose}
              onKeepEditing={editDistanceGuard.cancelClose}
              onDiscardAndClose={editDistanceGuard.confirmDiscardAndClose}
            />

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Distance</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingDistance.distance}
                    onChange={(e) =>
                      setEditingDistance({
                        ...editingDistance,
                        distance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Unit</label>
                  <select
                    value={editingDistance.unit}
                    onChange={(e) =>
                      setEditingDistance({
                        ...editingDistance,
                        unit: e.target.value as DistanceUnit,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                  >
                    <option value="mi">Miles (mi)</option>
                    <option value="km">Kilometers (km)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">
                    Activity Type
                  </label>
                  <select
                    value={editingDistance.type}
                    onChange={(e) =>
                      setEditingDistance({
                        ...editingDistance,
                        type: e.target.value as DistanceActivityType,
                      })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white capitalize"
                  >
                    <option value="run">Run</option>
                    <option value="cycle">Cycle</option>
                    <option value="walk">Walk</option>
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
                    value={editingDistance.date}
                    onChange={(e) =>
                      setEditingDistance({ ...editingDistance, date: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
                <input
                  type="text"
                  required
                  value={editingDistance.description}
                  onChange={(e) =>
                    setEditingDistance({ ...editingDistance, description: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={editDistanceGuard.requestExplicitClose}
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
