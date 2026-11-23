import React, { useState, useEffect } from 'react';
import { useVault } from '../context/VaultContext';
import {
  CustomCategoryVisibility,
  CustomNavCategory,
} from '../types';
import {
  DEFAULT_SIDEBAR_GROUP_LABELS,
} from '../utils/sidebarEngine';
import {
  Lock,
  Globe,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  FileText,
  Activity,
  ListChecks,
  Edit3,
  Check,
  Shield,
} from 'lucide-react';

interface CustomCategoryWorkspaceViewProps {
  categoryId: string;
}

const STATUS_CARD_CYCLE = ['Nominal', 'Active', 'Warning', 'Completed'] as const;

export const CustomCategoryWorkspaceView: React.FC<CustomCategoryWorkspaceViewProps> = ({
  categoryId,
}) => {
  const {
    appData,
    updateAppData,
    isMasterAdmin,
    accent,
    setActiveTab,
    showNotification,
  } = useVault();

  const category: CustomNavCategory | undefined = (
    appData?.customNavCategories || []
  ).find((c) => c.id === categoryId);

  const [isRenaming, setIsRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(category?.name || '');
  const [notesDraft, setNotesDraft] = useState(category?.notes || '');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newCardTitle, setNewCardTitle] = useState('');
  const [newCardValue, setNewCardValue] = useState('');
  const [newCardStatus, setNewCardStatus] = useState<string>('Nominal');

  useEffect(() => {
    if (category) {
      setNameDraft(category.name);
      setNotesDraft(category.notes || '');
    }
  }, [category?.id, category?.name, category?.notes]);

  // Strict security guard: if category does not exist or is admin_only and user is not Master Admin
  if (!category) {
    return null;
  }
  if (category.visibility === 'admin_only' && !isMasterAdmin) {
    return null;
  }

  const updateCategory = async (
    updater: (cat: CustomNavCategory) => CustomNavCategory,
    label = 'Custom Category Updated'
  ) => {
    await updateAppData(
      (prev) => ({
        ...prev,
        customNavCategories: (prev.customNavCategories || []).map((c) =>
          c.id === category.id ? { ...updater(c), updatedAt: Date.now() } : c
        ),
      }),
      { actionLabel: label }
    );
  };

  const handleSaveRename = async () => {
    const cleaned = nameDraft.trim();
    if (!cleaned) return;
    await updateCategory((cat) => ({ ...cat, name: cleaned }), 'Category Renamed');
    setIsRenaming(false);
    showNotification(`Renamed category to "${cleaned}"`, 'success');
  };

  const handleToggleVisibility = async (nextVis: CustomCategoryVisibility) => {
    if (!isMasterAdmin) return;
    await updateCategory(
      (cat) => ({ ...cat, visibility: nextVis }),
      'Category Visibility Updated'
    );
    showNotification(
      nextVis === 'admin_only'
        ? `"${category.name}" is now strictly locked to Admin Only.`
        : `"${category.name}" is now visible to All Users.`,
      'info'
    );
  };

  const handleNotesChange = (val: string) => {
    setNotesDraft(val);
    void updateAppData(
      (prev) => ({
        ...prev,
        customNavCategories: (prev.customNavCategories || []).map((c) =>
          c.id === category.id ? { ...c, notes: val, updatedAt: Date.now() } : c
        ),
      }),
      { skipUndo: true }
    );
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newChecklistText.trim();
    if (!text) return;
    await updateCategory((cat) => ({
      ...cat,
      checklist: [
        ...(cat.checklist || []),
        {
          id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text,
          completed: false,
        },
      ],
    }));
    setNewChecklistText('');
  };

  const handleToggleChecklistItem = async (itemId: string) => {
    await updateCategory((cat) => ({
      ...cat,
      checklist: (cat.checklist || []).map((it) =>
        it.id === itemId ? { ...it, completed: !it.completed } : it
      ),
    }));
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    await updateCategory((cat) => ({
      ...cat,
      checklist: (cat.checklist || []).filter((it) => it.id !== itemId),
    }));
  };

  const handleAddStatusCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = newCardTitle.trim();
    const v = newCardValue.trim();
    if (!t || !v) return;
    await updateCategory((cat) => ({
      ...cat,
      statusCards: [
        ...(cat.statusCards || []),
        {
          id: `scard-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: t,
          value: v,
          status: newCardStatus,
        },
      ],
    }));
    setNewCardTitle('');
    setNewCardValue('');
  };

  const handleCycleCardStatus = async (cardId: string, currentStatus: string) => {
    const idx = STATUS_CARD_CYCLE.indexOf(currentStatus as any);
    const nextStatus =
      STATUS_CARD_CYCLE[(idx + 1) % STATUS_CARD_CYCLE.length] || 'Nominal';
    await updateCategory((cat) => ({
      ...cat,
      statusCards: (cat.statusCards || []).map((sc) =>
        sc.id === cardId ? { ...sc, status: nextStatus } : sc
      ),
    }));
  };

  const handleDeleteStatusCard = async (cardId: string) => {
    await updateCategory((cat) => ({
      ...cat,
      statusCards: (cat.statusCards || []).filter((sc) => sc.id !== cardId),
    }));
  };

  const handleDeleteCategory = async () => {
    if (!isMasterAdmin) return;
    const catName = category.name;
    await updateAppData(
      (prev) => ({
        ...prev,
        customNavCategories: (prev.customNavCategories || []).filter(
          (c) => c.id !== category.id
        ),
      }),
      { actionLabel: 'Custom Category Deleted' }
    );
    setActiveTab('dashboard');
    showNotification(`Deleted custom category "${catName}".`, 'info');
  };

  const checklist = category.checklist || [];
  const completedCount = checklist.filter((i) => i.completed).length;
  const statusCards = category.statusCards || [];

  const getStatusCardStyle = (st: string) => {
    switch (st) {
      case 'Completed':
      case 'Nominal':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
      case 'Active':
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40';
      case 'Warning':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  return (
    <div
      data-testid={`custom-category-workspace-${category.id}`}
      className="space-y-6"
    >
      {/* Top Category Banner */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#000000] border border-[#1E222B] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              className="w-9 h-9 rounded-xl bg-[#08090C] border flex items-center justify-center shrink-0"
              style={{ borderColor: `${accent.hex}66` }}
            >
              <Shield className="w-5 h-5" style={{ color: accent.hex }} />
            </div>

            {isRenaming ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  data-testid="custom-category-rename-input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-[#08090C] border border-cyan-400 text-sm font-bold text-white"
                />
                <button
                  type="button"
                  data-testid="custom-category-rename-save-btn"
                  onClick={() => void handleSaveRename()}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-bold cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  data-testid="custom-category-heading"
                  className="text-lg sm:text-xl font-extrabold text-white tracking-tight"
                >
                  {category.name}
                </h1>
                {isMasterAdmin && (
                  <button
                    type="button"
                    data-testid="custom-category-rename-btn"
                    onClick={() => setIsRenaming(true)}
                    title="Rename custom category"
                    className="p-1 rounded-lg bg-[#08090C] hover:bg-[#141720] text-zinc-400 hover:text-white border border-[#232732] cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {category.visibility === 'admin_only' ? (
              <span
                data-testid="custom-category-visibility-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/40"
              >
                <Lock className="w-2.5 h-2.5" />
                <span>ADMIN ONLY</span>
              </span>
            ) : (
              <span
                data-testid="custom-category-visibility-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/40"
              >
                <Globe className="w-2.5 h-2.5" />
                <span>ALL USERS</span>
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-zinc-400">
            Group:{' '}
            <span className="text-zinc-200">
              {DEFAULT_SIDEBAR_GROUP_LABELS[category.parentGroupId || 'vault_sys'] ||
                'Vault & System'}
            </span>{' '}
            • Structured Notes, Action Checklists &amp; Telemetry Cards
          </p>
        </div>

        {/* Admin Controls: Visibility Toggle & Delete */}
        {isMasterAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-xl bg-[#08090C] border border-[#232732] p-0.5 text-[11px] font-mono">
              <button
                type="button"
                data-testid="custom-cat-vis-admin"
                onClick={() => void handleToggleVisibility('admin_only')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors ${
                  category.visibility === 'admin_only'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Admin Only</span>
              </button>
              <button
                type="button"
                data-testid="custom-cat-vis-all"
                onClick={() => void handleToggleVisibility('all_users')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1 cursor-pointer transition-colors ${
                  category.visibility === 'all_users'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span>All Users</span>
              </button>
            </div>

            <button
              type="button"
              data-testid="custom-category-delete-btn"
              onClick={() => void handleDeleteCategory()}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Category</span>
            </button>
          </div>
        )}
      </div>

      {/* Section 1: Status Cards Telemetry Grid */}
      <div className="p-5 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E222B] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">
              Status Cards &amp; Operational Telemetry ({statusCards.length})
            </h2>
          </div>
          <form
            onSubmit={handleAddStatusCard}
            className="flex items-center gap-2 flex-wrap"
          >
            <input
              type="text"
              data-testid="custom-cat-card-title-input"
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              placeholder="Card Label (e.g. Build Status)"
              className="px-2.5 py-1.5 rounded-lg bg-[#08090C] border border-[#232732] text-xs text-white"
            />
            <input
              type="text"
              data-testid="custom-cat-card-value-input"
              value={newCardValue}
              onChange={(e) => setNewCardValue(e.target.value)}
              placeholder="Value (e.g. v2.0.0 Nominal)"
              className="px-2.5 py-1.5 rounded-lg bg-[#08090C] border border-[#232732] text-xs text-white font-mono"
            />
            <select
              value={newCardStatus}
              onChange={(e) => setNewCardStatus(e.target.value)}
              className="px-2 py-1.5 rounded-lg bg-[#08090C] border border-[#232732] text-xs text-white font-mono"
            >
              {STATUS_CARD_CYCLE.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
            <button
              type="submit"
              data-testid="custom-cat-add-card-btn"
              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Card</span>
            </button>
          </form>
        </div>

        {statusCards.length === 0 ? (
          <div className="p-4 rounded-xl bg-[#06070A] border border-[#151821] text-xs text-zinc-500 font-mono text-center">
            No status cards added yet. Add a card above to track metrics or system states.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {statusCards.map((sc) => (
              <div
                key={sc.id}
                data-testid={`custom-cat-status-card-${sc.id}`}
                className="p-3.5 rounded-xl bg-[#06070A] border border-[#1E222B] flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-zinc-400 truncate">
                    {sc.title}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleCycleCardStatus(sc.id, sc.status)}
                      title="Click to cycle status"
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border cursor-pointer ${getStatusCardStyle(
                        sc.status
                      )}`}
                    >
                      {sc.status}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteStatusCard(sc.id)}
                      aria-label={`Delete ${sc.title}`}
                      className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-base font-extrabold text-white font-mono">
                  {sc.value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2 & 3: Action Checklist + Structured Notes Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Checklist */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-[#1E222B] pb-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Action Checklist</h2>
            </div>
            <span className="text-xs font-mono text-emerald-400">
              {completedCount}/{checklist.length} Done
            </span>
          </div>

          <form onSubmit={handleAddChecklistItem} className="flex items-center gap-2">
            <input
              type="text"
              data-testid="custom-cat-checklist-input"
              value={newChecklistText}
              onChange={(e) => setNewChecklistText(e.target.value)}
              placeholder="Add checklist task..."
              className="flex-1 px-3 py-2 rounded-xl bg-[#08090C] border border-[#232732] text-xs text-white"
            />
            <button
              type="submit"
              data-testid="custom-cat-checklist-add-btn"
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="space-y-2 flex-1 overflow-y-auto max-h-80">
            {checklist.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#06070A] border border-[#151821] text-xs text-zinc-500 font-mono text-center">
                No checklist tasks yet.
              </div>
            ) : (
              checklist.map((item) => (
                <div
                  key={item.id}
                  data-testid={`custom-cat-checklist-item-${item.id}`}
                  className="p-2.5 rounded-xl bg-[#06070A] border border-[#1E222B] flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => void handleToggleChecklistItem(item.id)}
                    className="flex items-center gap-2.5 text-left flex-1 min-w-0 cursor-pointer"
                  >
                    {item.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-500 shrink-0" />
                    )}
                    <span
                      className={`text-xs truncate ${
                        item.completed ? 'line-through text-zinc-500' : 'text-zinc-100'
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteChecklistItem(item.id)}
                    aria-label={`Delete ${item.text}`}
                    className="text-zinc-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Structured Scratchpad & Notes */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-3 flex flex-col">
          <div className="flex items-center justify-between border-b border-[#1E222B] pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">
                Structured Workspace Notes
              </h2>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              Auto-Saving • {notesDraft.length} chars
            </span>
          </div>

          <textarea
            rows={12}
            data-testid="custom-cat-notes-textarea"
            value={notesDraft}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder={`Write structured notes, logs, or documentation for ${category.name}...`}
            className="w-full flex-1 p-3.5 rounded-xl bg-[#06070A] border border-[#1E222B] focus:border-cyan-400 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
};
