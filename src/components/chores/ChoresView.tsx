import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckSquare, Plus, Trash2 } from 'lucide-react';
import { useVault } from '../../context/VaultContext';
import {
  addChore,
  consumeLegacyLocalChoresOnce,
  deleteChore,
  getChoresSummary,
  recordDeletedItemTombstones,
  toggleChore,
} from './choresStore';

export const ChoresView: React.FC = () => {
  const { appData, updateAppData, accent } = useVault();
  const chores = appData?.chores || [];
  const [draftTitle, setDraftTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const migratedLegacyRef = useRef(false);

  // One-time migration: promote any legacy localStorage chores into cloud-synced AppData
  useEffect(() => {
    if (!appData || migratedLegacyRef.current) return;
    migratedLegacyRef.current = true;
    const legacy = consumeLegacyLocalChoresOnce();
    if (legacy.length > 0) {
      void updateAppData(
        (prev) => {
          const existing = prev.chores || [];
          const existingIds = new Set(existing.map((c) => c.id));
          const merged = [...existing];
          for (const item of legacy) {
            if (!existingIds.has(item.id)) {
              merged.push(item);
            }
          }
          return {
            ...prev,
            chores: merged,
          };
        },
        { actionLabel: 'Migrated Legacy Chores to Cloud Vault' }
      );
    }
  }, [appData, updateAppData]);

  const summary = useMemo(() => getChoresSummary(chores), [chores]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { added } = addChore(chores, draftTitle);
    if (!added) {
      setErrorMessage('Enter a chore before adding.');
      inputRef.current?.focus();
      return;
    }

    const cleanTitle = draftTitle;
    setDraftTitle('');
    setErrorMessage(null);
    void updateAppData(
      (prev) => {
        const res = addChore(prev.chores || [], cleanTitle);
        return {
          ...prev,
          chores: res.items,
        };
      },
      { actionLabel: `Added chore "${added.title}"` }
    );
  };

  const handleToggle = (id: string) => {
    void updateAppData(
      (prev) => ({
        ...prev,
        chores: toggleChore(prev.chores || [], id),
      }),
      { actionLabel: 'Toggled chore completion' }
    );
  };

  const handleDelete = (id: string) => {
    void updateAppData(
      (prev) => ({
        ...prev,
        chores: deleteChore(prev.chores || [], id),
        deletedItemTombstones: recordDeletedItemTombstones(prev.deletedItemTombstones, [id]),
      }),
      { actionLabel: 'Deleted chore' }
    );
  };

  return (
    <section
      aria-labelledby="chores-heading"
      data-testid="chores-view"
      className="w-full max-w-3xl mx-auto space-y-6"
    >
      <header className="flex flex-col gap-1.5">
        <h1
          id="chores-heading"
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#F8FAFC]"
        >
          Chores
        </h1>
        <p
          data-testid="chores-summary"
          className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-zinc-400 font-mono tabular-nums"
        >
          <span>{summary.remaining} remaining</span>
          <span aria-hidden="true" className="text-zinc-600">
            ·
          </span>
          <span>{summary.completed} completed</span>
        </p>
      </header>

      <div className="bg-[#000000] border border-[#1E222B] rounded-xl p-4 sm:p-5">
        <form onSubmit={handleSubmit} noValidate className="space-y-2">
          <label htmlFor="chore-title-input" className="sr-only">
            New chore
          </label>
          <div className="flex items-stretch gap-2.5">
            <input
              id="chore-title-input"
              ref={inputRef}
              type="text"
              value={draftTitle}
              onChange={(e) => {
                setDraftTitle(e.target.value);
                if (errorMessage && e.target.value.trim()) {
                  setErrorMessage(null);
                }
              }}
              placeholder="Add a chore..."
              aria-label="New chore"
              aria-invalid={Boolean(errorMessage)}
              aria-describedby={errorMessage ? 'chore-input-error' : undefined}
              data-testid="chores-input"
              className={`flex-1 min-w-0 min-h-[44px] rounded-lg bg-[#000000] border ${
                errorMessage ? 'border-rose-500/80' : 'border-[#232732]'
              } px-3.5 py-2.5 text-sm text-[#F8FAFC] placeholder:text-zinc-500 outline-none transition-colors focus-visible:ring-2 ${
                accent.borderFocus
              }`}
            />
            <button
              type="submit"
              data-testid="chores-add-btn"
              className={`inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 ${accent.primaryBg}`}
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Add</span>
            </button>
          </div>
          {errorMessage && (
            <p
              id="chore-input-error"
              role="alert"
              className="text-xs text-rose-400 pt-0.5"
            >
              {errorMessage}
            </p>
          )}
        </form>
      </div>

      {chores.length === 0 ? (
        <div
          data-testid="chores-empty-state"
          className="bg-[#000000] border border-[#1E222B] rounded-xl px-6 py-12 text-center"
        >
          <div className="w-10 h-10 rounded-lg border border-[#232732] mx-auto flex items-center justify-center text-zinc-400">
            <CheckSquare className="w-5 h-5" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-medium text-[#F8FAFC]">No chores yet</h2>
          <p className="mt-1.5 text-sm text-zinc-400 max-w-sm mx-auto">
            Add a chore above to start keeping track of what needs to get done.
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.focus()}
            className="mt-5 inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg border border-[#232732] text-sm font-medium text-[#F8FAFC] hover:border-zinc-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            Add first chore
          </button>
        </div>
      ) : (
        <ul
          data-testid="chores-list"
          aria-label="Chores list"
          className="bg-[#000000] border border-[#1E222B] rounded-xl divide-y divide-[#1E222B] overflow-hidden"
        >
          {chores.map((chore) => (
            <li
              key={chore.id}
              data-testid={`chore-item-${chore.id}`}
              className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5 sm:py-3 transition-colors hover:bg-zinc-950/60"
            >
              <button
                type="button"
                onClick={() => handleToggle(chore.id)}
                aria-pressed={chore.completed}
                aria-label={
                  chore.completed
                    ? `Mark "${chore.title}" incomplete`
                    : `Mark "${chore.title}" complete`
                }
                className="flex flex-1 min-w-0 items-center gap-3.5 text-left min-h-[44px] py-1 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 rounded-md"
              >
                <span
                  aria-hidden="true"
                  className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors"
                  style={
                    chore.completed
                      ? {
                          backgroundColor: accent.hex,
                          borderColor: accent.hex,
                          color: accent.buttonTextHex,
                        }
                      : {
                          backgroundColor: '#000000',
                          borderColor: '#373C4B',
                        }
                  }
                >
                  {chore.completed && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                </span>
                <span
                  className={`text-sm sm:text-[15px] leading-snug break-words transition-colors ${
                    chore.completed
                      ? 'line-through text-zinc-500'
                      : 'text-[#F8FAFC] group-hover:text-white'
                  }`}
                >
                  {chore.title}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDelete(chore.id)}
                aria-label={`Delete "${chore.title}"`}
                className="inline-flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg border border-transparent text-zinc-400 hover:text-rose-400 hover:border-[#232732] transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/60"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
