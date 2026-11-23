import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useVault } from '../context/VaultContext';
import { DailyNoteEntry } from '../types';
import {
  upsertDailyNote,
  filterAndSortDailyNotes,
  groupNotesByPinnedAndMonth,
  parseMarkdownChecklists,
  toggleMarkdownChecklistLine,
  computeNoteTelemetry,
  TACTICAL_NOTE_TEMPLATES,
  TacticalNoteTemplate,
  TacticalEditorViewMode,
  insertTemplateIntoNoteContent,
  insertTextAtCursorOrEnd,
  computeDailyOperationalContext,
  buildDailySnapshotMarkdown,
  syncNoteMoodToLifeStats,
} from '../utils/dailyNotesEngine';
import { recordDeletedItemTombstones } from './chores/choresStore';
import {
  BookOpen,
  Plus,
  Pin,
  Trash2,
  Copy,
  Check,
  Search,
  Calendar,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Eye,
  Columns,
  Edit3,
  Clock,
  Activity,
  Wallet,
  Compass,
  ShieldCheck,
  X,
  Tag,
  Save,
  CheckSquare,
  Square,
} from 'lucide-react';

export const DailyNotesView: React.FC = () => {
  const {
    appData,
    updateAppData,
    isEditMode,
    accent,
    showNotification,
    setActiveTab,
  } = useVault();

  const todayStr = new Date().toISOString().split('T')[0];
  const notes = appData?.dailyNotes || [];

  const initialTodayNote = notes.find((n) => n.date === todayStr) || notes[0];

  const [editingNoteId, setEditingNoteId] = useState<string | undefined>(() => initialTodayNote?.id);
  const editingNoteIdRef = useRef<string | undefined>(initialTodayNote?.id);

  const [noteDate, setNoteDate] = useState<string>(() => initialTodayNote?.date || todayStr);
  const [noteTitle, setNoteTitle] = useState<string>(
    () => initialTodayNote?.title || `Daily Command Briefing — ${todayStr}`
  );
  const [noteContent, setNoteContent] = useState<string>(() => initialTodayNote?.content ?? '');
  const [noteTags, setNoteTags] = useState<string[]>(
    () => initialTodayNote?.tags || ['briefing', 'daily']
  );
  const [noteMood, setNoteMood] = useState<number>(() => initialTodayNote?.mood ?? 8);
  const [notePinned, setNotePinned] = useState<boolean>(() => Boolean(initialTodayNote?.isPinned));

  // Tag adder inline state
  const [isAddingTag, setIsAddingTag] = useState<boolean>(false);
  const [newTagDraft, setNewTagDraft] = useState<string>('');

  // Left Explorer Rail & Editor View Mode
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<TacticalEditorViewMode>('write');
  const [syncMoodToBiometrics, setSyncMoodToBiometrics] = useState<boolean>(true);
  const [isDirtyDraft, setIsDirtyDraft] = useState<boolean>(false);
  const [lastSavedLabel, setLastSavedLabel] = useState<string>('✓ Saved');

  // Filter & search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncedNoteUpdatedAtRef = useRef<number>(initialTodayNote?.updatedAt || 0);

  useEffect(() => {
    editingNoteIdRef.current = editingNoteId;
  }, [editingNoteId]);

  // Keep active editor synchronized with cloud-revalidated notes when not actively editing a dirty draft
  useEffect(() => {
    if (isDirtyDraft) return;
    const activeId = editingNoteIdRef.current;
    if (!activeId) {
      if (!noteContent.trim() && notes.length > 0) {
        const target = notes.find((n) => n.date === todayStr) || notes[0];
        if (target) {
          editingNoteIdRef.current = target.id;
          syncedNoteUpdatedAtRef.current = target.updatedAt || 0;
          setEditingNoteId(target.id);
          setNoteDate(target.date);
          setNoteTitle(target.title);
          setNoteContent(target.content);
          setNoteTags(target.tags && target.tags.length > 0 ? target.tags : ['daily']);
          setNoteMood(target.mood ?? 8);
          setNotePinned(Boolean(target.isPinned));
        }
      }
      return;
    }

    const remoteMatch = notes.find((n) => n.id === activeId);
    if (remoteMatch) {
      const remoteTs = remoteMatch.updatedAt || 0;
      if (
        remoteTs > syncedNoteUpdatedAtRef.current ||
        remoteMatch.content !== noteContent ||
        remoteMatch.title !== noteTitle
      ) {
        syncedNoteUpdatedAtRef.current = remoteTs;
        setNoteDate(remoteMatch.date);
        setNoteTitle(remoteMatch.title);
        setNoteContent(remoteMatch.content);
        setNoteTags(
          remoteMatch.tags && remoteMatch.tags.length > 0 ? remoteMatch.tags : ['daily']
        );
        setNoteMood(remoteMatch.mood ?? 8);
        setNotePinned(Boolean(remoteMatch.isPinned));
      }
    } else if (syncedNoteUpdatedAtRef.current > 0) {
      // Previously loaded note was deleted on another device
      const fallback = notes.find((n) => n.date === todayStr) || notes[0];
      if (fallback) {
        editingNoteIdRef.current = fallback.id;
        syncedNoteUpdatedAtRef.current = fallback.updatedAt || 0;
        setEditingNoteId(fallback.id);
        setNoteDate(fallback.date);
        setNoteTitle(fallback.title);
        setNoteContent(fallback.content);
        setNoteTags(fallback.tags && fallback.tags.length > 0 ? fallback.tags : ['daily']);
        setNoteMood(fallback.mood ?? 8);
        setNotePinned(Boolean(fallback.isPinned));
      } else {
        editingNoteIdRef.current = undefined;
        syncedNoteUpdatedAtRef.current = 0;
        setEditingNoteId(undefined);
        setNoteDate(todayStr);
        setNoteTitle(`Daily Command Briefing — ${todayStr}`);
        setNoteContent('');
        setNoteTags(['briefing', 'daily']);
        setNoteMood(8);
        setNotePinned(false);
      }
    }
  }, [notes, todayStr, isDirtyDraft, noteContent, noteTitle]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      for (const t of n.tags || []) {
        set.add(t.toLowerCase());
      }
    }
    return Array.from(set).sort();
  }, [notes]);

  const filteredNotes = useMemo(
    () => filterAndSortDailyNotes(notes, searchQuery, selectedTag),
    [notes, searchQuery, selectedTag]
  );

  const groupedExplorer = useMemo(
    () => groupNotesByPinnedAndMonth(filteredNotes),
    [filteredNotes]
  );

  const telemetry = useMemo(() => computeNoteTelemetry(noteContent), [noteContent]);

  const dailyContext = useMemo(
    () =>
      computeDailyOperationalContext(noteDate, {
        timeline: appData?.timeline || [],
        lifeStats: appData?.lifeStats || [],
        funds: appData?.funds || [],
        distances: appData?.distances || [],
        settings: appData?.settings,
      }),
    [
      noteDate,
      appData?.timeline,
      appData?.lifeStats,
      appData?.funds,
      appData?.distances,
      appData?.settings,
    ]
  );

  const commitSaveNote = useCallback(
    async (
      overrideContent?: string,
      overrideMood?: number,
      overridePinned?: boolean,
      silent?: boolean,
      overrideTags?: string[],
      overrideTitle?: string,
      overrideDate?: string
    ) => {
      if (!appData) return;
      const contentToSave = overrideContent !== undefined ? overrideContent : noteContent;
      const moodToSave = overrideMood !== undefined ? overrideMood : noteMood;
      const pinnedToSave = overridePinned !== undefined ? overridePinned : notePinned;
      const tagsToSave = overrideTags !== undefined ? overrideTags : noteTags;
      const titleToSave = overrideTitle !== undefined ? overrideTitle : noteTitle;
      const dateToSave = overrideDate !== undefined ? overrideDate : noteDate;
      const activeId = editingNoteIdRef.current || editingNoteId;

      if (!contentToSave.trim() && !titleToSave.trim()) {
        if (!silent) {
          showNotification('Please enter a title or note content before saving.', 'error');
        }
        return;
      }

      // If silent auto-save and content is completely empty on a brand-new uncreated default note, wait until user types
      if (
        silent &&
        !activeId &&
        !contentToSave.trim() &&
        titleToSave.trim() === `Daily Command Briefing — ${todayStr}`
      ) {
        return;
      }

      let savedId = activeId || `dn-${Date.now()}`;
      editingNoteIdRef.current = savedId;

      await updateAppData(
        (prev) => {
          const currentNotes = prev.dailyNotes || [];
          const res = upsertDailyNote(currentNotes, {
            id: savedId,
            date: dateToSave || todayStr,
            title: titleToSave.trim() || `Daily Command Briefing — ${dateToSave || todayStr}`,
            content: contentToSave,
            tags: tagsToSave,
            mood: moodToSave,
            isPinned: pinnedToSave,
          });
          if (!res) return prev;
          savedId = res.savedNote.id;
          editingNoteIdRef.current = savedId;

          const nextLifeStats = syncMoodToBiometrics
            ? syncNoteMoodToLifeStats(
                prev.lifeStats || [],
                dateToSave || todayStr,
                moodToSave,
                res.savedNote.title
              )
            : prev.lifeStats;
          return {
            ...prev,
            dailyNotes: res.nextNotes,
            lifeStats: nextLifeStats,
          };
        },
        {
          skipUndo: Boolean(silent),
          label: `Saved Daily Note "${titleToSave.trim() || dateToSave || todayStr}"`,
        }
      );

      syncedNoteUpdatedAtRef.current = Date.now();
      setEditingNoteId(savedId);
      setIsDirtyDraft(false);
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSavedLabel(`✓ Saved ${timeStr}`);
      if (!silent) {
        showNotification(
          syncMoodToBiometrics
            ? `Daily Note saved & Mood (${moodToSave}/10) synced to Biometrics!`
            : 'Daily Note saved to vault!',
          'success'
        );
      }
    },
    [
      appData,
      noteContent,
      noteMood,
      notePinned,
      noteTitle,
      editingNoteId,
      noteDate,
      todayStr,
      noteTags,
      updateAppData,
      syncMoodToBiometrics,
      showNotification,
    ]
  );

  // Automatic real-time save to VaultContext + localStorage whenever user edits note fields
  const commitSaveNoteRef = useRef(commitSaveNote);
  useEffect(() => {
    commitSaveNoteRef.current = commitSaveNote;
  }, [commitSaveNote]);

  useEffect(() => {
    if (!isDirtyDraft) return;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      void commitSaveNoteRef.current(undefined, undefined, undefined, true);
    }, 220);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [isDirtyDraft, noteTitle, noteContent, noteTags, noteMood, noteDate, notePinned]);

  // Flush any pending unsaved note edits immediately on unmount / tab switch
  const isDirtyRef = useRef(isDirtyDraft);
  useEffect(() => {
    isDirtyRef.current = isDirtyDraft;
  }, [isDirtyDraft]);

  useEffect(() => {
    return () => {
      if (isDirtyRef.current) {
        void commitSaveNoteRef.current(undefined, undefined, undefined, true);
      }
    };
  }, []);

  // Global Ctrl+S / Cmd+S shortcut inside Daily Notes View
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void commitSaveNote();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commitSaveNote]);

  if (!appData) return null;

  const handleLoadNoteIntoEditor = (note: DailyNoteEntry) => {
    if (isDirtyDraft) {
      void commitSaveNote(undefined, undefined, undefined, true);
    }
    editingNoteIdRef.current = note.id;
    syncedNoteUpdatedAtRef.current = note.updatedAt || 0;
    setEditingNoteId(note.id);
    setNoteDate(note.date);
    setNoteTitle(note.title);
    setNoteContent(note.content);
    setNoteTags(note.tags && note.tags.length > 0 ? note.tags : ['daily']);
    setNoteMood(note.mood ?? 8);
    setNotePinned(Boolean(note.isPinned));
    setIsDirtyDraft(false);
    setLastSavedLabel('✓ Saved');
  };

  const handleStartFreshNote = () => {
    if (isDirtyDraft) {
      void commitSaveNote(undefined, undefined, undefined, true);
    }
    const freshId = `dn-${Date.now()}`;
    editingNoteIdRef.current = freshId;
    syncedNoteUpdatedAtRef.current = 0;
    setEditingNoteId(freshId);
    setNoteDate(todayStr);
    setNoteTitle(`Daily Command Briefing — ${todayStr}`);
    setNoteContent('');
    setNoteTags(['briefing', 'daily']);
    setNoteMood(8);
    setNotePinned(false);
    setIsDirtyDraft(false);
    setViewMode('write');
  };

  const handleAddTagChip = (rawTag: string) => {
    const cleaned = rawTag
      .split(',')
      .map((t) => t.replace(/^#+/, '').trim().toLowerCase())
      .filter(Boolean);
    if (cleaned.length === 0) return;
    const nextTags = Array.from(new Set([...noteTags, ...cleaned])).slice(0, 15);
    setNoteTags(nextTags);
    setNewTagDraft('');
    setIsAddingTag(false);
    setIsDirtyDraft(true);
    void commitSaveNote(noteContent, noteMood, notePinned, true, nextTags);
  };

  const handleRemoveTagChip = (tagToRemove: string) => {
    const nextTags = noteTags.filter((t) => t !== tagToRemove);
    setNoteTags(nextTags);
    setIsDirtyDraft(true);
    void commitSaveNote(noteContent, noteMood, notePinned, true, nextTags);
  };

  const handleApplyTemplate = (tpl: TacticalNoteTemplate) => {
    const nextTitle =
      !noteTitle.trim() || noteTitle.startsWith('Daily Note —')
        ? `${tpl.defaultTitle} (${noteDate})`
        : noteTitle;
    const nextTags = Array.from(new Set([...noteTags, ...tpl.defaultTags])).slice(0, 15);
    const nextContent = insertTemplateIntoNoteContent(noteContent, tpl);
    setNoteTitle(nextTitle);
    setNoteTags(nextTags);
    setNoteContent(nextContent);
    setIsDirtyDraft(true);
    void commitSaveNote(nextContent, noteMood, notePinned, true, nextTags, nextTitle);
    showNotification(`Inserted "${tpl.shortLabel}" section`, 'info');
  };

  const handleStampDailySnapshot = () => {
    const snapshotMd = buildDailySnapshotMarkdown(noteDate, appData);
    const el = textareaRef.current;
    const { nextContent } = insertTextAtCursorOrEnd(
      noteContent,
      `\n\n${snapshotMd}\n`,
      el?.selectionStart,
      el?.selectionEnd
    );
    const trimmedNext = nextContent.trimStart();
    setNoteContent(trimmedNext);
    setIsDirtyDraft(true);
    void commitSaveNote(trimmedNext, noteMood, notePinned, true);
    showNotification(`Stamped ${noteDate} Operational Snapshot into note!`, 'success');
  };

  const handleToggleChecklistInPreview = async (lineIndex: number) => {
    const updatedContent = toggleMarkdownChecklistLine(noteContent, lineIndex);
    setNoteContent(updatedContent);
    await commitSaveNote(updatedContent, noteMood, notePinned, true);
  };

  const handleTogglePinNote = async (note: DailyNoteEntry) => {
    const nextNotes = notes.map((n) =>
      n.id === note.id ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n
    );
    await updateAppData(
      (prev) => ({
        ...prev,
        dailyNotes: nextNotes,
      }),
      { label: `${!note.isPinned ? 'Pinned' : 'Unpinned'} note "${note.title}"` }
    );
    if (editingNoteId === note.id) {
      setNotePinned(!note.isPinned);
    }
    showNotification(
      !note.isPinned ? 'Pinned note to top of Explorer.' : 'Unpinned daily note.',
      'info'
    );
  };

  const handleDeleteNote = async (id: string) => {
    const target = notes.find((n) => n.id === id);
    await updateAppData(
      (prev) => ({
        ...prev,
        dailyNotes: (prev.dailyNotes || []).filter((n) => n.id !== id),
        deletedItemTombstones: recordDeletedItemTombstones(prev.deletedItemTombstones, [id]),
      }),
      { label: `Deleted note "${target?.title || id}"` }
    );
    if (editingNoteId === id) {
      handleStartFreshNote();
    }
    showNotification('Daily note deleted from cloud vault (Press ⌘Z to undo).', 'info');
  };

  const handleCopyNote = async (note: DailyNoteEntry) => {
    try {
      await navigator.clipboard.writeText(`${note.title} (${note.date})\n\n${note.content}`);
      setCopiedId(note.id);
      showNotification('Daily note copied to clipboard!', 'success');
      setTimeout(() => {
        setCopiedId((curr) => (curr === note.id ? null : curr));
      }, 2000);
    } catch {
      showNotification('Could not copy note', 'error');
    }
  };

  // Format inline markdown spans (bold, inline code, 1d6 roll stamps)
  const renderInlineFormattedText = (text: string) => {
    const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[🎲\s*1d6 Roll:[^\]]+\])/g);
    return tokens.map((token, idx) => {
      if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
        return (
          <strong key={idx} className="font-bold text-white">
            {token.slice(2, -2)}
          </strong>
        );
      }
      if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-[#000000] border border-[#1E222B] font-mono text-xs text-cyan-300"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith('[🎲') && token.endsWith(']')) {
        return (
          <span
            key={idx}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#000000] border border-purple-500/40 font-mono text-xs font-bold text-purple-300"
          >
            {token.slice(1, -1)}
          </span>
        );
      }
      return <React.Fragment key={idx}>{token}</React.Fragment>;
    });
  };

  // Interactive Markdown Document Renderer for Split Preview & Read Mode
  const renderTacticalMarkdownPreview = () => {
    if (!noteContent.trim()) {
      return (
        <div className="py-12 text-center text-xs text-zinc-500 font-mono">
          Empty tactical document. Type in Write mode, apply a template, or stamp today&apos;s snapshot.
        </div>
      );
    }

    const lines = noteContent.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBuffer: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre
              key={`code-${i}`}
              className="p-3.5 my-2 rounded-xl bg-[#000000] border border-[#1E222B] font-mono text-xs text-emerald-300 overflow-x-auto"
            >
              <code>{codeBuffer.join('\n')}</code>
            </pre>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      if (/^---\s*$/.test(line.trim())) {
        elements.push(<hr key={`hr-${i}`} className="my-3 border-[#1E222B]" />);
        continue;
      }

      if (line.startsWith('### ')) {
        elements.push(
          <h4
            key={`h3-${i}`}
            className="text-xs sm:text-sm font-bold text-amber-300 tracking-tight mt-3 mb-1"
          >
            {renderInlineFormattedText(line.slice(4))}
          </h4>
        );
        continue;
      }

      if (line.startsWith('## ')) {
        elements.push(
          <h3
            key={`h2-${i}`}
            className="text-sm sm:text-base font-extrabold text-white tracking-tight mt-4 mb-1.5 pb-1 border-b border-[#1E222B]"
          >
            {renderInlineFormattedText(line.slice(3))}
          </h3>
        );
        continue;
      }

      if (line.startsWith('# ')) {
        elements.push(
          <h2
            key={`h1-${i}`}
            className="text-base sm:text-lg font-extrabold text-white tracking-tight mt-4 mb-2 pb-1.5 border-b border-[#1E222B]"
          >
            {renderInlineFormattedText(line.slice(2))}
          </h2>
        );
        continue;
      }

      // Interactive Checklist Item (- [ ] or - [x])
      const checklistMatch = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/.exec(line);
      if (checklistMatch) {
        const isChecked = checklistMatch[1].toLowerCase() === 'x';
        const itemText = checklistMatch[2];
        const lineIdx = i;
        elements.push(
          <button
            key={`chk-${i}`}
            type="button"
            data-testid={`markdown-checkbox-line-${lineIdx}`}
            onClick={() => {
              void handleToggleChecklistInPreview(lineIdx);
            }}
            className="w-full py-1.5 px-2.5 my-0.5 rounded-lg bg-[#000000] hover:border-zinc-700 border border-[#1E222B] flex items-start gap-2.5 text-left transition-colors group"
          >
            <span
              className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                isChecked
                  ? 'bg-emerald-500 border-emerald-500 text-black'
                  : 'bg-[#000000] border-zinc-600 group-hover:border-amber-400'
              }`}
            >
              {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
            </span>
            <span
              className={`text-xs sm:text-sm leading-relaxed ${
                isChecked ? 'line-through text-zinc-500' : 'text-zinc-100'
              }`}
            >
              {renderInlineFormattedText(itemText)}
            </span>
          </button>
        );
        continue;
      }

      // Standard Bullet Item
      const bulletMatch = /^\s*[-*]\s+(.*)$/.exec(line);
      if (bulletMatch) {
        elements.push(
          <div key={`li-${i}`} className="flex items-start gap-2 py-0.5 pl-1 text-xs sm:text-sm text-zinc-200">
            <span className="text-amber-400 font-mono select-none">•</span>
            <span className="leading-relaxed">{renderInlineFormattedText(bulletMatch[1])}</span>
          </div>
        );
        continue;
      }

      if (!line.trim()) {
        elements.push(<div key={`sp-${i}`} className="h-2" />);
        continue;
      }

      elements.push(
        <p key={`p-${i}`} className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
          {renderInlineFormattedText(line)}
        </p>
      );
    }

    return <div className="space-y-1">{elements}</div>;
  };

  const renderExplorerNoteItem = (note: DailyNoteEntry) => {
    const isSelected = editingNoteId === note.id;
    const noteTelem = computeNoteTelemetry(note.content);

    return (
      <div
        key={note.id}
        data-testid={`daily-note-card-${note.id}`}
        onClick={() => handleLoadNoteIntoEditor(note)}
        className={`p-3 rounded-xl bg-[#000000] border transition-all cursor-pointer space-y-1.5 ${
          isSelected
            ? 'border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.25)]'
            : 'border-[#1E222B] hover:border-zinc-700'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {note.isPinned && <Pin className="w-3 h-3 text-amber-400 shrink-0" />}
              <h3 className="text-xs font-bold text-white truncate">{note.title}</h3>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 mt-0.5 tabular-nums flex-wrap">
              <span className="text-emerald-400">{note.date}</span>
              {note.mood !== undefined && (
                <>
                  <span>·</span>
                  <span className="text-amber-300">{note.mood}/10</span>
                </>
              )}
              <span>·</span>
              <span>{noteTelem.wordCount}w</span>
              {noteTelem.actionItemCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-cyan-300">
                    {noteTelem.completedActionItemCount}/{noteTelem.actionItemCount} tasks
                  </span>
                </>
              )}
            </div>
          </div>

          <div
            className="flex items-center gap-1 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleTogglePinNote(note)}
              title={note.isPinned ? 'Unpin note' : 'Pin note'}
              className={`p-1 rounded-lg bg-[#000000] border transition-colors ${
                note.isPinned
                  ? 'text-amber-300 border-amber-500/40'
                  : 'text-zinc-500 hover:text-white border-[#1E222B]'
              }`}
            >
              <Pin className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => handleCopyNote(note)}
              title="Copy note markdown"
              className="p-1 rounded-lg bg-[#000000] text-zinc-500 hover:text-white border border-[#1E222B] transition-colors"
            >
              {copiedId === note.id ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
            {isEditMode && (
              <button
                type="button"
                onClick={() => handleDeleteNote(note.id)}
                title="Delete note"
                className="p-1 rounded-lg bg-[#000000] text-zinc-500 hover:text-rose-400 border border-[#1E222B] hover:border-rose-500/40 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 line-clamp-2 font-mono leading-relaxed">
          {note.content.replace(/^#+\s*/gm, '')}
        </p>

        {note.tags && note.tags.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 truncate pt-0.5">
            {note.tags.slice(0, 4).map((t, idx) => (
              <React.Fragment key={t}>
                {idx > 0 && <span>·</span>}
                <span className="text-zinc-400">#{t}</span>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div data-testid="daily-notes-view" className="space-y-4 pb-12">
      {/* Top Workspace Command Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            data-testid="toggle-notes-explorer-btn"
            onClick={() => setIsExplorerCollapsed((prev) => !prev)}
            title={isExplorerCollapsed ? 'Expand Note Explorer Rail' : 'Collapse Note Explorer Rail'}
            className="p-2 rounded-xl bg-[#000000] border border-[#1E222B] hover:border-zinc-700 text-zinc-300 hover:text-white transition-colors"
          >
            {isExplorerCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-amber-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-amber-400" />
            )}
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: accent.hex }} />
              <span>Daily Notes &amp; Tactical Journal</span>
            </h1>
            <p className="text-xs text-zinc-400">
              Split-pane encrypted markdown workspace and cross-module daily telemetry snapshots.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="daily-note-save-status"
            className={`px-2.5 py-1.5 rounded-xl bg-[#000000] border text-[11px] font-mono font-semibold flex items-center gap-1.5 ${
              isDirtyDraft
                ? 'border-amber-500/40 text-amber-300'
                : 'border-emerald-500/30 text-emerald-400'
            }`}
          >
            <Check className="w-3 h-3" />
            <span>{isDirtyDraft ? 'Saving...' : lastSavedLabel}</span>
          </span>

          <button
            type="button"
            data-testid="new-daily-note-btn"
            onClick={handleStartFreshNote}
            className="px-3.5 py-2 rounded-xl bg-[#000000] hover:border-amber-400 border border-[#1E222B] text-xs font-bold text-white flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>New Tactical Note</span>
          </button>

          <button
            type="button"
            data-testid="header-save-note-btn"
            onClick={() => {
              void commitSaveNote();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${accent.primaryBg}`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Note (⌘S)</span>
          </button>
        </div>
      </div>

      {/* Unified Split-Pane Command Workspace */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch min-h-[720px]">
        {/* LEFT RAIL: Collapsible Note Explorer & Timeline Feed (280px-320px) */}
        {!isExplorerCollapsed && (
          <aside
            data-testid="notes-explorer-rail"
            className="w-full lg:w-[310px] shrink-0 rounded-2xl bg-[#000000] border border-[#1E222B] p-3.5 flex flex-col justify-between gap-3"
          >
            <div className="space-y-3 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-200 tracking-tight">
                  Note Explorer ({filteredNotes.length})
                </span>
                <span className="text-[11px] font-mono text-zinc-500 tabular-nums">
                  {notes.filter((n) => n.isPinned).length} pinned
                </span>
              </div>

              {/* Instant Search Input */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  data-testid="daily-notes-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, markdown, date, #tag..."
                  className="w-full pl-8 pr-7 py-1.5 bg-[#000000] border border-[#1E222B] rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Clean Tag Filter Strip (No cluttered pencil icons on filter chips) */}
              {allTags.length > 0 && (
                <div
                  data-testid="notes-tag-filter-strip"
                  className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTag('all')}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono border shrink-0 transition-colors bg-[#000000] ${
                      selectedTag === 'all'
                        ? 'text-amber-300 border-amber-500/50 font-bold'
                        : 'text-zinc-400 border-[#1E222B] hover:text-white'
                    }`}
                  >
                    All ({notes.length})
                  </button>
                  {allTags.map((tag) => {
                    const active = selectedTag.toLowerCase() === tag.toLowerCase();
                    return (
                      <button
                        key={tag}
                        type="button"
                        data-testid={`notes-filter-tag-${tag}`}
                        onClick={() => setSelectedTag(active ? 'all' : tag)}
                        className={`px-2 py-0.5 rounded-lg text-[11px] font-mono border shrink-0 transition-colors bg-[#000000] ${
                          active
                            ? 'text-amber-300 border-amber-500/50 font-bold'
                            : 'text-zinc-400 border-[#1E222B] hover:text-white'
                        }`}
                      >
                        #{tag}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Grouped Notes Feed: Pinned + Chronological Month/Date Sections */}
              <div
                data-testid="daily-notes-list"
                className="space-y-3 overflow-y-auto pr-1 flex-1 max-h-[600px]"
              >
                {filteredNotes.length === 0 ? (
                  <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-[#1E222B] rounded-xl">
                    No encrypted notes match your filter.
                  </div>
                ) : (
                  <>
                    {groupedExplorer.pinned.length > 0 && (
                      <div data-testid="notes-group-pinned" className="space-y-1.5">
                        <div className="text-[10px] font-mono uppercase tracking-wider text-amber-400/90 px-1 flex items-center gap-1">
                          <Pin className="w-2.5 h-2.5" />
                          <span>Pinned Briefings ({groupedExplorer.pinned.length})</span>
                        </div>
                        <div className="space-y-2">
                          {groupedExplorer.pinned.map((n) => renderExplorerNoteItem(n))}
                        </div>
                      </div>
                    )}

                    {groupedExplorer.monthGroups.map((group) => (
                      <div
                        key={group.monthKey}
                        data-testid={`notes-group-month-${group.monthKey}`}
                        className="space-y-1.5 pt-1"
                      >
                        <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-1">
                          {group.monthLabel} ({group.notes.length})
                        </div>
                        <div className="space-y-2">
                          {group.notes.map((n) => renderExplorerNoteItem(n))}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div className="pt-2.5 border-t border-[#1E222B] flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span>AES-256-GCM Vault</span>
              <span className="text-zinc-400 tabular-nums">{notes.length} Total Notes</span>
            </div>
          </aside>
        )}

        {/* MAIN EDITOR CANVAS: Full-Height Tactical Document Surface */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void commitSaveNote();
          }}
          data-testid="daily-note-editor-form"
          className="flex-1 rounded-2xl bg-[#000000] border border-[#1E222B] flex flex-col justify-between overflow-hidden"
        >
          <div>
            {/* 1. SEAMLESS INLINE DOCUMENT HEADER BAR */}
            <div className="p-4 sm:p-5 border-b border-[#1E222B] space-y-3 bg-[#000000]">
              <div className="flex items-center justify-between gap-3">
                <input
                  data-testid="daily-note-title-input"
                  type="text"
                  value={noteTitle}
                  onChange={(e) => {
                    setNoteTitle(e.target.value);
                    setIsDirtyDraft(true);
                  }}
                  onBlur={() => {
                    if (isDirtyDraft) {
                      void commitSaveNote(undefined, undefined, undefined, true);
                    }
                  }}
                  disabled={!isEditMode}
                  placeholder="Untitled Tactical Briefing..."
                  className="w-full bg-[#000000] text-lg sm:text-xl font-extrabold text-white placeholder-zinc-600 focus:outline-none tracking-tight border-b border-transparent focus:border-amber-400/60 pb-0.5 transition-colors"
                />

                <button
                  type="button"
                  data-testid="note-pin-toggle-btn"
                  onClick={() => {
                    const nextPin = !notePinned;
                    setNotePinned(nextPin);
                    setIsDirtyDraft(true);
                    void commitSaveNote(noteContent, noteMood, nextPin, true);
                  }}
                  title={notePinned ? 'Pinned to top of Explorer' : 'Pin this note'}
                  className={`px-2.5 py-1 rounded-lg bg-[#000000] border text-xs font-mono font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                    notePinned
                      ? 'text-amber-300 border-amber-500/50'
                      : 'text-zinc-400 hover:text-white border-[#1E222B]'
                  }`}
                >
                  <Pin className="w-3.5 h-3.5" />
                  <span>{notePinned ? 'Pinned' : 'Pin'}</span>
                </button>
              </div>

              {/* 2. METADATA & TELEMETRY RIBBON (Date Picker + 1-10 Segmented Mood Bar + Inline #Tag Chip Adder) */}
              <div
                data-testid="note-metadata-ribbon"
                className="flex flex-wrap items-center gap-2.5 pt-1 text-xs"
              >
                {/* Date Picker Pill */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#000000] border border-[#1E222B]">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <input
                    data-testid="daily-note-date-input"
                    type="date"
                    value={noteDate}
                    onChange={(e) => {
                      const nextDate = e.target.value;
                      setNoteDate(nextDate);
                      setIsDirtyDraft(true);
                      void commitSaveNote(
                        noteContent,
                        noteMood,
                        notePinned,
                        true,
                        noteTags,
                        noteTitle,
                        nextDate
                      );
                    }}
                    disabled={!isEditMode}
                    className="bg-[#000000] text-xs font-mono text-zinc-200 focus:outline-none"
                  />
                </div>

                {/* Interactive 1–10 Segmented Mood Selector Pill */}
                <div
                  data-testid="note-mood-segmented-bar"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#000000] border border-[#1E222B]"
                >
                  <span className="text-[11px] font-mono text-zinc-400 mr-1">Mood:</span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
                      const active = noteMood === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          data-testid={`note-mood-btn-${num}`}
                          onClick={() => {
                            setNoteMood(num);
                            setIsDirtyDraft(true);
                            void commitSaveNote(noteContent, num, notePinned, true);
                          }}
                          disabled={!isEditMode}
                          className={`w-5 h-5 rounded text-[10px] font-mono font-bold transition-colors flex items-center justify-center ${
                            active
                              ? 'bg-amber-400 text-black'
                              : 'bg-[#000000] text-zinc-400 hover:text-white border border-[#1E222B]'
                          }`}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    data-testid="sync-mood-biometrics-toggle"
                    onClick={() => setSyncMoodToBiometrics((prev) => !prev)}
                    title="Automatically sync this Note's Mood score to Life Statistics on save"
                    className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors bg-[#000000] ${
                      syncMoodToBiometrics
                        ? 'text-emerald-300 border-emerald-500/40'
                        : 'text-zinc-500 border-[#1E222B]'
                    }`}
                  >
                    {syncMoodToBiometrics ? 'Biometrics Sync ON' : 'Sync OFF'}
                  </button>
                </div>

                {/* Inline #Tag Chip Adder */}
                <div
                  data-testid="note-inline-tags-bar"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {noteTags.map((tag) => (
                    <span
                      key={tag}
                      data-testid={`editor-tag-chip-${tag}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#000000] border border-[#1E222B] text-[11px] font-mono text-zinc-300"
                    >
                      <span className="text-amber-400">#</span>
                      <span>{tag}</span>
                      {isEditMode && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTagChip(tag)}
                          aria-label={`Remove tag ${tag}`}
                          className="text-zinc-500 hover:text-rose-400 ml-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}

                  {isAddingTag ? (
                    <div className="inline-flex items-center gap-1">
                      <input
                        data-testid="daily-note-tags-input"
                        type="text"
                        autoFocus
                        value={newTagDraft}
                        onChange={(e) => setNewTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTagChip(newTagDraft);
                          } else if (e.key === 'Escape') {
                            setIsAddingTag(false);
                            setNewTagDraft('');
                          }
                        }}
                        onBlur={() => {
                          if (newTagDraft.trim()) {
                            handleAddTagChip(newTagDraft);
                          } else {
                            setIsAddingTag(false);
                          }
                        }}
                        placeholder="tag name..."
                        className="w-28 px-2 py-0.5 rounded-lg bg-[#000000] border border-amber-400 text-[11px] font-mono text-white focus:outline-none"
                      />
                    </div>
                  ) : (
                    <button
                      type="button"
                      data-testid="note-add-tag-trigger"
                      onClick={() => setIsAddingTag(true)}
                      className="px-2 py-0.5 rounded-lg bg-[#000000] hover:border-amber-400/50 border border-[#1E222B] text-[11px] font-mono text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      <Tag className="w-3 h-3 text-amber-400" />
                      <span>+ Tag</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 3. CROSS-MODULE DAILY OPERATIONAL CONTEXT BAR */}
            <div
              data-testid="daily-operational-context-bar"
              className="px-4 sm:px-5 py-2.5 border-b border-[#1E222B] bg-[#000000] flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                <span className="text-zinc-500 uppercase tracking-wider">
                  Linked ({dailyContext.date}):
                </span>

                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="text-zinc-300 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                  title="Inspect date in Calendar"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {dailyContext.formattedFocusTime} Scheduled ({dailyContext.timelineEntries.length}{' '}
                    blocks)
                  </span>
                </button>

                <span className="text-zinc-700">·</span>

                <button
                  type="button"
                  onClick={() => setActiveTab('lifestats')}
                  className="text-zinc-300 hover:text-purple-300 flex items-center gap-1 transition-colors"
                  title="Inspect Biometrics in Life Statistics"
                >
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    {dailyContext.biometrics.weightLbs !== null
                      ? `${dailyContext.biometrics.weightLbs} lbs`
                      : '-- lbs'}{' '}
                    / Mood {dailyContext.biometrics.mood ?? noteMood}/10
                  </span>
                </button>

                <span className="text-zinc-700">·</span>

                <button
                  type="button"
                  onClick={() => setActiveTab('funds')}
                  className="text-zinc-300 hover:text-amber-300 flex items-center gap-1 transition-colors"
                  title="Inspect date in Funds Ledger"
                >
                  <Wallet className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {dailyContext.funds.netDelta >= 0 ? '+' : '-'}$
                    {Math.abs(dailyContext.funds.netDelta).toFixed(2)} (
                    {dailyContext.funds.transactionCount} txns)
                  </span>
                </button>

                <span className="text-zinc-700">·</span>

                <button
                  type="button"
                  onClick={() => setActiveTab('distance')}
                  className="text-zinc-300 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  title="Inspect date in Distance Tracker"
                >
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{dailyContext.distances.totalMiles} mi</span>
                </button>
              </div>

              <button
                type="button"
                data-testid="stamp-daily-snapshot-btn"
                onClick={handleStampDailySnapshot}
                className="px-2.5 py-1 rounded-lg bg-[#000000] hover:border-cyan-400/60 border border-[#1E222B] text-[11px] font-mono font-semibold text-cyan-300 hover:text-white flex items-center gap-1.5 transition-colors shrink-0"
              >
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>+ Stamp Daily Snapshot</span>
              </button>
            </div>

            {/* 4. TACTICAL EDITOR TOOLBAR (View Modes + 1-Click Templates + Integrated 1d6 Roll Button) */}
            <div
              data-testid="tactical-editor-toolbar"
              className="px-4 sm:px-5 py-2.5 border-b border-[#1E222B] bg-[#000000] flex flex-wrap items-center justify-between gap-2"
            >
              {/* View Mode Switcher: Write | Split Preview | Read Mode */}
              <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[#000000] border border-[#1E222B]">
                <button
                  type="button"
                  data-testid="editor-mode-write"
                  onClick={() => setViewMode('write')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                    viewMode === 'write'
                      ? 'bg-amber-400 text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Write</span>
                </button>
                <button
                  type="button"
                  data-testid="editor-mode-split"
                  onClick={() => setViewMode('split')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                    viewMode === 'split'
                      ? 'bg-amber-400 text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Columns className="w-3 h-3" />
                  <span>Split Preview</span>
                </button>
                <button
                  type="button"
                  data-testid="editor-mode-read"
                  onClick={() => setViewMode('read')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-colors ${
                    viewMode === 'read'
                      ? 'bg-amber-400 text-black font-bold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Read Mode</span>
                </button>
              </div>

              {/* 1-Click Tactical Templates */}
              <div className="flex flex-wrap items-center gap-1.5">
                {TACTICAL_NOTE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    data-testid={`template-btn-${tpl.id}`}
                    onClick={() => handleApplyTemplate(tpl)}
                    className="px-2.5 py-1 rounded-lg bg-[#000000] hover:border-zinc-600 border border-[#1E222B] text-[11px] font-mono text-zinc-300 hover:text-white transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. MAIN DOCUMENT SURFACE (Write | Split Preview | Interactive Read Mode) */}
            <div className="p-4 sm:p-5 bg-[#000000]">
              {viewMode === 'write' && (
                <textarea
                  ref={textareaRef}
                  data-testid="daily-note-content-input"
                  rows={18}
                  value={noteContent}
                  onChange={(e) => {
                    setNoteContent(e.target.value);
                    setIsDirtyDraft(true);
                  }}
                  onBlur={() => {
                    if (isDirtyDraft) {
                      void commitSaveNote(undefined, undefined, undefined, true);
                    }
                  }}
                  disabled={!isEditMode}
                  placeholder="Write tactical briefings, markdown checklists (- [ ] task), architecture specs, or click [+ Stamp Daily Snapshot] above..."
                  className="w-full min-h-[420px] p-4 bg-[#000000] border border-[#1E222B] rounded-xl text-xs sm:text-sm text-zinc-100 leading-relaxed font-mono focus:outline-none focus:border-amber-400/60 resize-y"
                />
              )}

              {viewMode === 'split' && (
                <div
                  data-testid="daily-note-split-surface"
                  className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[420px]"
                >
                  <textarea
                    ref={textareaRef}
                    data-testid="daily-note-content-input"
                    rows={18}
                    value={noteContent}
                    onChange={(e) => {
                      setNoteContent(e.target.value);
                      setIsDirtyDraft(true);
                    }}
                    onBlur={() => {
                      if (isDirtyDraft) {
                        void commitSaveNote(undefined, undefined, undefined, true);
                      }
                    }}
                    disabled={!isEditMode}
                    placeholder="Write markdown on the left, interact with live checkboxes on the right..."
                    className="w-full min-h-[420px] p-4 bg-[#000000] border border-[#1E222B] rounded-xl text-xs sm:text-sm text-zinc-100 leading-relaxed font-mono focus:outline-none focus:border-amber-400/60 resize-y"
                  />
                  <div
                    data-testid="daily-note-markdown-preview"
                    className="p-4 rounded-xl bg-[#000000] border border-[#1E222B] min-h-[420px] overflow-y-auto"
                  >
                    {renderTacticalMarkdownPreview()}
                  </div>
                </div>
              )}

              {viewMode === 'read' && (
                <div
                  data-testid="daily-note-markdown-preview"
                  className="p-4 sm:p-5 rounded-xl bg-[#000000] border border-[#1E222B] min-h-[420px]"
                >
                  {renderTacticalMarkdownPreview()}
                </div>
              )}
            </div>
          </div>

          {/* 6. SLIM LIVE STATUS FOOTER */}
          <div
            data-testid="tactical-editor-status-footer"
            className="px-4 sm:px-5 py-3 border-t border-[#1E222B] bg-[#000000] flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-zinc-400"
          >
            <div className="flex flex-wrap items-center gap-2.5 tabular-nums">
              <span>{telemetry.wordCount} words</span>
              <span>·</span>
              <span>{telemetry.charCount} chars</span>
              <span>·</span>
              <span>{telemetry.readingTimeLabel}</span>
              {telemetry.actionItemCount > 0 && (
                <>
                  <span>·</span>
                  <span className="text-cyan-300 flex items-center gap-1">
                    {telemetry.completedActionItemCount === telemetry.actionItemCount ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span>
                      {telemetry.completedActionItemCount}/{telemetry.actionItemCount} tasks done
                    </span>
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>AES-256-GCM Encrypted</span>
              </span>
              <span
                className={`text-[11px] font-semibold ${
                  isDirtyDraft ? 'text-amber-300' : 'text-emerald-400'
                }`}
              >
                {isDirtyDraft ? 'Auto-saving...' : lastSavedLabel}
              </span>
              <button
                data-testid="save-daily-note-btn"
                type="submit"
                disabled={!isEditMode}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${accent.primaryBg}`}
              >
                {editingNoteId ? 'Save Note (⌘S)' : 'Save New Note (⌘S)'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
export const NotesView = DailyNotesView;
