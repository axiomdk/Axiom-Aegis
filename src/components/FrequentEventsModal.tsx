import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { FrequentEvent, TimelineEntry } from '../types';
import { Zap, X, Plus, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { calculateDurationMinutes, formatMinutes } from '../utils/calculations';
import { useModalGuard, UnsavedChangesBanner } from './UnsavedChangesBanner';

export const FrequentEventsModal: React.FC = () => {
  const {
    isFrequentEventsOpen,
    setIsFrequentEventsOpen,
    appData,
    updateAppData,
    accent,
    showNotification,
  } = useVault();

  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<FrequentEvent['category']>('work');
  const [newDuration, setNewDuration] = useState('60');
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newNotes, setNewNotes] = useState('');

  const isFrequentFormDirty = newTitle.trim().length > 0 || newNotes.trim().length > 0;

  const {
    showConfirmClose,
    requestExplicitClose,
    handleBackdropDoubleClick,
    confirmDiscardAndClose,
    cancelClose,
  } = useModalGuard({
    isOpen: Boolean(isFrequentEventsOpen && appData),
    isDirty: isFrequentFormDirty,
    onClose: () => {
      setNewTitle('');
      setNewNotes('');
      setIsFrequentEventsOpen(false);
    },
  });

  if (!isFrequentEventsOpen || !appData) return null;

  const frequentEvents = appData.frequentEvents || [];
  const todayStr = new Date().toISOString().split('T')[0];

  const handleInstantLog = async (fe: FrequentEvent) => {
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

    const duration = fe.durationMinutes || calculateDurationMinutes(startStr, endStr);

    const newEntry: TimelineEntry = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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

    showNotification(`⚡ Logged "${fe.title}" (${formatMinutes(duration)}) to today's timeline!`, 'success');
  };

  const handleAddFrequent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const dur = Math.max(5, parseInt(newDuration, 10) || 60);
    const [sh, sm] = newStartTime.split(':').map(Number);
    const endTotal = ((sh || 9) * 60 + (sm || 0) + dur) % 1440;
    const endStr = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(
      endTotal % 60
    ).padStart(2, '0')}`;

    const item: FrequentEvent = {
      id: `fe-${Date.now()}`,
      title: newTitle.trim(),
      category: newCategory,
      durationMinutes: dur,
      startTime: newStartTime,
      endTime: endStr,
      notes: newNotes.trim() || undefined,
    };

    const loggedEntry: TimelineEntry = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: item.title,
      category: item.category,
      date: todayStr,
      startTime: item.startTime || '09:00',
      endTime: item.endTime || endStr,
      durationMinutes: item.durationMinutes,
      notes: item.notes,
      customFields: {},
      createdAt: Date.now(),
    };

    await updateAppData((prev) => ({
      ...prev,
      frequentEvents: [item, ...(prev.frequentEvents || [])],
      timeline: [loggedEntry, ...prev.timeline],
    }));

    setNewTitle('');
    setNewNotes('');
    showNotification(
      `Added & logged "${item.title}" (${formatMinutes(dur)}) to today's timeline!`,
      'success'
    );
  };

  const handleDeleteFrequent = async (id: string, title: string) => {
    await updateAppData((prev) => ({
      ...prev,
      frequentEvents: (prev.frequentEvents || []).filter((fe) => fe.id !== id),
    }));
    showNotification(`Removed "${title}" from Frequent Events.`, 'info');
  };

  return (
    <div
      onDoubleClick={handleBackdropDoubleClick}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-testid="frequent-events-modal"
        className="w-full max-w-xl bg-[#000000] border border-[#1E222B] rounded-2xl shadow-2xl p-6 max-h-[88vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#1E222B] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#000000] border border-[#1E222B] text-amber-400">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Frequent Events Quick-Tray</h3>
              <p className="text-xs text-zinc-400">
                1-Click instant timeline logging & reusable protocol templates
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={requestExplicitClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <UnsavedChangesBanner
          isOpen={showConfirmClose}
          onKeepEditing={cancelClose}
          onDiscardAndClose={confirmDiscardAndClose}
        />

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Quick-Click List */}
          <div className="space-y-2">
            {frequentEvents.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 border border-zinc-800/80 rounded-xl">
                No frequent events saved yet. Add a template below for 1-click logging.
              </div>
            ) : (
              frequentEvents.map((fe) => (
                <div
                  key={fe.id}
                  className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-zinc-700 flex items-center justify-between gap-3 transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-100 truncate">{fe.title}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#000000] text-zinc-300 border border-[#1E222B]">
                        {fe.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400 mt-1">
                      <Clock className="w-3 h-3 text-emerald-400" />
                      <span>
                        {fe.startTime || 'Now'} ({formatMinutes(fe.durationMinutes)})
                      </span>
                      {fe.notes && <span className="truncate text-zinc-500">· {fe.notes}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleInstantLog(fe)}
                      data-testid={`quick-log-${fe.id}`}
                      className="px-3 py-1.5 rounded-lg bg-[#000000] hover:border-amber-500/50 text-amber-300 border border-[#1E222B] text-xs font-mono font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>1-Click Log</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFrequent(fe.id, fe.title)}
                      className="p-1.5 rounded-lg bg-[#000000] hover:border-rose-500/40 text-zinc-500 hover:text-rose-400 border border-[#1E222B] transition-colors"
                      title="Remove template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add New Frequent Event Template */}
          <form
            onSubmit={handleAddFrequent}
            className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-3"
          >
            <div className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>Create New Frequent Event Template</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Template title (e.g. Deep System Architecture)"
                className="px-3 py-1.5 rounded-lg bg-[#09090b] border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
              />
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="px-2 py-1.5 rounded-lg bg-[#09090b] border border-zinc-800 text-xs text-white"
                >
                  <option value="work">Work</option>
                  <option value="health">Health</option>
                  <option value="learning">Learning</option>
                  <option value="personal">Personal</option>
                  <option value="social">Social</option>
                  <option value="creative">Creative</option>
                </select>
                <input
                  type="time"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="px-2 py-1.5 rounded-lg bg-[#09090b] border border-zinc-800 text-xs text-white font-mono"
                />
                <input
                  type="number"
                  min={5}
                  max={720}
                  value={newDuration}
                  onChange={(e) => setNewDuration(e.target.value)}
                  placeholder="Mins"
                  title="Duration in minutes"
                  className="px-2 py-1.5 rounded-lg bg-[#09090b] border border-zinc-800 text-xs text-white font-mono"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Default notes (optional)..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-[#09090b] border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold shrink-0 ${accent.primaryBg}`}
              >
                + Save Template
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
