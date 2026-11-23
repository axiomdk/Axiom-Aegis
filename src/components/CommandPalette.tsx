import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useVault } from '../context/VaultContext';
import { TabType } from '../types';
import {
  Search,
  Calendar,
  Activity,
  Compass,
  Wallet,
  Palette,
  Settings as SettingsIcon,
  Plus,
  Lock,
  Download,
  LayoutDashboard,
  ArrowRight,
  ShieldAlert,
  Target,
  Image as ImageIcon,
  FileUp,
  FileSpreadsheet,
  Folder,
  Sparkles,
  BookOpen,
  X,
} from 'lucide-react';
import { downloadStandaloneApp } from '../utils/downloadApp';

interface SearchResultItem {
  id: string;
  category:
    | 'Navigation'
    | 'Actions'
    | 'Timeline'
    | 'Daily Notes'
    | 'Life Stats'
    | 'Distance'
    | 'Funds'
    | 'Goals'
    | 'Gallery';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    isLocked,
    isMasterAdmin,
    appData,
    accent,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setActiveTab,
    setSelectedCalendarDate,
    openQuickAdd,
    openImportHub,
    signOutAccount,
    exportAccountSnapshot,
  } = useVault();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  const results: SearchResultItem[] = useMemo(() => {
    if (isLocked || !appData) return [];

    const items: SearchResultItem[] = [];
    const q = query.toLowerCase().trim();

    // 1. Navigation Actions (reflecting custom sidebarItemLabels)
    const itemLabels =
      appData.settings?.sidebarItemLabels ||
      appData.settings?.layoutConfig?.sidebarItemLabels ||
      {};
    const navs: { tab: TabType; title: string; icon: React.ReactNode }[] = [
      {
        tab: 'dashboard',
        title: `Go to ${itemLabels['nav-dashboard'] || 'Dashboard'}`,
        icon: <LayoutDashboard className="w-4 h-4 text-cyan-400" />,
      },
      {
        tab: 'calendar',
        title: `Go to ${itemLabels['nav-calendar'] || 'Calendar & Daily Timeline'}`,
        icon: <Calendar className="w-4 h-4 text-cyan-400" />,
      },
      {
        tab: 'notes',
        title: `Go to ${itemLabels['nav-notes'] || 'Daily Notes & Journal'}`,
        icon: <BookOpen className="w-4 h-4 text-amber-400" />,
      },
      {
        tab: 'lifestats',
        title: `Go to ${itemLabels['nav-lifestats'] || 'Life Statistics & Mood'}`,
        icon: <Activity className="w-4 h-4 text-rose-400" />,
      },
      {
        tab: 'distance',
        title: `Go to ${itemLabels['nav-distance'] || 'Distance Tracker'}`,
        icon: <Compass className="w-4 h-4 text-sky-400" />,
      },
      {
        tab: 'funds',
        title: `Go to ${itemLabels['nav-funds'] || 'Funds & Financial Balance'}`,
        icon: <Wallet className="w-4 h-4 text-lime-400" />,
      },
      {
        tab: 'goals',
        title: `Go to ${itemLabels['nav-goals'] || 'Strategic Goals'}`,
        icon: <Target className="w-4 h-4 text-amber-400" />,
      },
      {
        tab: 'gallery',
        title: `Go to ${itemLabels['nav-gallery'] || 'Private Gallery'}`,
        icon: <ImageIcon className="w-4 h-4 text-purple-400" />,
      },
      {
        tab: 'shortcuts',
        title: `Go to ${itemLabels['nav-shortcuts'] || 'Shortcuts'}`,
        icon: <Folder className="w-4 h-4 text-cyan-400" />,
      },
      {
        tab: 'customization',
        title: `Go to ${itemLabels['nav-customization'] || 'Customization (Themes, Panels, Sidebar & Quotes)'}`,
        icon: <Palette className="w-4 h-4 text-purple-400" />,
      },
      {
        tab: 'settings',
        title: `Go to ${itemLabels['nav-settings'] || 'Settings (Preferences, Units & Account Sync)'}`,
        icon: <SettingsIcon className="w-4 h-4 text-amber-400" />,
      },
      ...(isMasterAdmin
        ? [
            {
              tab: 'site_improvements' as TabType,
              title: `Go to ${itemLabels['nav-site-improvements'] || 'Site Improvements (Admin Roadmap & AI Prompt Builder)'}`,
              icon: <Sparkles className="w-4 h-4 text-amber-400" />,
            },
            {
              tab: 'admin' as TabType,
              title: `Go to ${itemLabels['nav-master-admin'] || itemLabels['nav-admin'] || 'Master Admin Overseer (Accounts & Ranks)'}`,
              icon: <Sparkles className="w-4 h-4 text-amber-400" />,
            },
          ]
        : []),
      ...((appData.customNavCategories || [])
        .filter((cat) => cat.visibility === 'all_users' || isMasterAdmin)
        .map((cat) => ({
          tab: cat.id as TabType,
          title: `Go to ${itemLabels[`nav-custom-${cat.id}`] || cat.name}${
            cat.visibility === 'admin_only' ? ' (Admin Only)' : ''
          }`,
          icon:
            cat.visibility === 'admin_only' ? (
              <Lock className="w-4 h-4 text-amber-400" />
            ) : (
              <Folder className="w-4 h-4 text-cyan-400" />
            ),
        }))),
    ];

    navs.forEach((n) => {
      if (!q || n.title.toLowerCase().includes(q)) {
        items.push({
          id: `nav-${n.tab}`,
          category: 'Navigation',
          title: n.title,
          icon: n.icon,
          onSelect: () => {
            setActiveTab(n.tab);
            setIsCommandPaletteOpen(false);
          },
        });
      }
    });

    // 2. Quick Actions
    const actions: { id: string; title: string; icon: React.ReactNode; action: () => void }[] = [
      {
        id: 'action-quick-add-timeline',
        title: 'Quick Add: Timeline Activity',
        icon: <Plus className="w-4 h-4 text-emerald-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          openQuickAdd('timeline');
        },
      },
      {
        id: 'action-quick-add-note',
        title: 'Quick Add: Daily Note & Tactical Journal',
        icon: <Plus className="w-4 h-4 text-amber-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          openQuickAdd('notes');
        },
      },
      {
        id: 'action-quick-add-stat',
        title: 'Quick Add: Life Statistic Log',
        icon: <Plus className="w-4 h-4 text-purple-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          openQuickAdd('lifestats');
        },
      },
      {
        id: 'action-quick-add-distance',
        title: 'Quick Add: Distance Traveled',
        icon: <Plus className="w-4 h-4 text-cyan-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          openQuickAdd('distance');
        },
      },
      {
        id: 'action-quick-add-funds',
        title: 'Quick Add: Fund Transaction',
        icon: <Plus className="w-4 h-4 text-amber-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          openQuickAdd('funds');
        },
      },
      {
        id: 'action-quick-add-goal',
        title: 'Quick Add: Strategic Goal & Milestone',
        icon: <Plus className="w-4 h-4 text-emerald-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          openQuickAdd('goals');
        },
      },
      {
        id: 'action-open-import-hub',
        title: 'Open Data Import Hub (Bank CSV & Google Takeout)',
        icon: <FileUp className="w-4 h-4 text-cyan-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          openImportHub();
        },
      },
      {
        id: 'action-import-bank-csv',
        title: 'Import Bank Statement CSV (Funds & Deduplication)',
        icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          openImportHub('bank_csv');
        },
      },
      {
        id: 'action-import-timeline-ocr',
        title: 'OCR Timeline Screenshot (Gemini Vision Mobility Import)',
        icon: <Sparkles className="w-4 h-4 text-cyan-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          openImportHub('timeline_ocr');
        },
      },
      {
        id: 'action-export-backup',
        title: 'Export Account Snapshot (.json)',
        icon: <Download className="w-4 h-4 text-zinc-300" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          void exportAccountSnapshot();
        },
      },
      {
        id: 'action-lock',
        title: 'Sign Out of Account',
        icon: <Lock className="w-4 h-4 text-rose-400" />,
        action: () => {
          setIsCommandPaletteOpen(false);
          signOutAccount();
        },
      },
    ];

    actions.forEach((a) => {
      if (!q || a.title.toLowerCase().includes(q)) {
        items.push({
          id: a.id,
          category: 'Actions',
          title: a.title,
          icon: a.icon,
          onSelect: a.action,
        });
      }
    });

    // 3. Timeline Entries search (including custom table columns & date)
    appData.timeline.forEach((entry) => {
      const customFieldMatches = Object.values(entry.customFields || {}).some((val) =>
        val.toLowerCase().includes(q)
      );
      if (
        q &&
        (entry.title.toLowerCase().includes(q) ||
          entry.category.toLowerCase().includes(q) ||
          entry.date.includes(q) ||
          entry.notes?.toLowerCase().includes(q) ||
          customFieldMatches)
      ) {
        items.push({
          id: `timeline-${entry.id}`,
          category: 'Timeline',
          title: entry.title,
          subtitle: `${entry.date} • ${entry.startTime}-${entry.endTime} (${entry.durationMinutes}m) [${entry.category}]`,
          icon: <Calendar className="w-4 h-4 text-emerald-400" />,
          onSelect: () => {
            setSelectedCalendarDate(entry.date);
            setActiveTab('calendar');
            setIsCommandPaletteOpen(false);
          },
        });
      }
    });

    // 4. Life Stats search
    appData.lifeStats.forEach((entry) => {
      if (
        q &&
        (entry.moodNote?.toLowerCase().includes(q) ||
          entry.notes?.toLowerCase().includes(q) ||
          entry.date.includes(q) ||
          `mood ${entry.mood}`.includes(q))
      ) {
        items.push({
          id: `stat-${entry.id}`,
          category: 'Life Stats',
          title: `Mood Score: ${entry.mood}/10 - ${entry.moodNote || 'Logged'}`,
          subtitle: `${entry.date} • Weight: ${entry.weightLbs || '--'} lbs • Income: $${entry.weeklyIncome || '--'}`,
          icon: <Activity className="w-4 h-4 text-purple-400" />,
          onSelect: () => {
            setActiveTab('lifestats');
            setIsCommandPaletteOpen(false);
          },
        });
      }
    });

    // 5. Distance logs search
    appData.distances.forEach((entry) => {
      if (
        q &&
        (entry.description.toLowerCase().includes(q) ||
          entry.type.toLowerCase().includes(q) ||
          entry.date.includes(q) ||
          `${entry.distance}`.includes(q))
      ) {
        items.push({
          id: `dist-${entry.id}`,
          category: 'Distance',
          title: `${entry.distance} ${entry.unit.toUpperCase()} - ${entry.description}`,
          subtitle: `${entry.date} • Type: ${entry.type}`,
          icon: <Compass className="w-4 h-4 text-cyan-400" />,
          onSelect: () => {
            setActiveTab('distance');
            setIsCommandPaletteOpen(false);
          },
        });
      }
    });

    // 6. Funds transactions search (including custom table columns & date)
    appData.funds.forEach((entry) => {
      const customFieldMatches = Object.values(entry.customFields || {}).some((val) =>
        val.toLowerCase().includes(q)
      );
      if (
        q &&
        (entry.description.toLowerCase().includes(q) ||
          entry.category.toLowerCase().includes(q) ||
          entry.type.toLowerCase().includes(q) ||
          entry.date.includes(q) ||
          `${entry.amount}`.includes(q) ||
          customFieldMatches)
      ) {
        items.push({
          id: `fund-${entry.id}`,
          category: 'Funds',
          title: `${entry.type === 'income' ? '+' : '-'}$${entry.amount.toFixed(2)} - ${entry.description}`,
          subtitle: `${entry.date} • Category: ${entry.category}`,
          icon: <Wallet className="w-4 h-4 text-amber-400" />,
          onSelect: () => {
            setActiveTab('funds');
            setIsCommandPaletteOpen(false);
          },
        });
      }
    });

    // 7. Goals search (including milestones & target date)
    (appData.goals || []).forEach((goal) => {
      const milestoneMatches = (goal.milestones || []).some((m) =>
        m.title.toLowerCase().includes(q)
      );
      if (
        q &&
        (goal.title.toLowerCase().includes(q) ||
          goal.category.toLowerCase().includes(q) ||
          goal.targetDate.includes(q) ||
          goal.notes?.toLowerCase().includes(q) ||
          milestoneMatches)
      ) {
        items.push({
          id: `goal-${goal.id}`,
          category: 'Goals',
          title: `Goal: ${goal.title}`,
          subtitle: `${goal.category.toUpperCase()} • Target: ${goal.targetDate}`,
          icon: <Target className="w-4 h-4 text-emerald-400" />,
          onSelect: () => {
            setActiveTab('goals');
            setIsCommandPaletteOpen(false);
          },
        });
      }
    });

    // 8. Gallery items search
    (appData.gallery || []).forEach((item) => {
      if (
        q &&
        (item.title.toLowerCase().includes(q) ||
          item.date.includes(q) ||
          item.tags.some((t) => t.toLowerCase().includes(q)) ||
          item.notes?.toLowerCase().includes(q))
      ) {
        items.push({
          id: `gallery-${item.id}`,
          category: 'Gallery',
          title: `Photo: ${item.title}`,
          subtitle: `${item.date} • Tags: ${item.tags.map((t) => `#${t}`).join(' ')}`,
          icon: <ImageIcon className="w-4 h-4 text-pink-400" />,
          onSelect: () => {
            setActiveTab('gallery');
            setIsCommandPaletteOpen(false);
          },
        });
      }
    });

    // 9. Daily Notes search
    (appData.dailyNotes || []).forEach((note) => {
      if (
        q &&
        (note.title.toLowerCase().includes(q) ||
          note.content.toLowerCase().includes(q) ||
          note.date.includes(q) ||
          (note.tags || []).some((t) => t.toLowerCase().includes(q)))
      ) {
        items.push({
          id: `note-${note.id}`,
          category: 'Daily Notes',
          title: `Note: ${note.title}`,
          subtitle: `${note.date} • ${(note.tags || []).map((t) => `#${t}`).join(' ')}`,
          icon: <BookOpen className="w-4 h-4 text-amber-400" />,
          onSelect: () => {
            setActiveTab('notes');
            setIsCommandPaletteOpen(false);
          },
        });
      }
    });

    return items;
  }, [
    isLocked,
    appData,
    query,
    setActiveTab,
    setSelectedCalendarDate,
    setIsCommandPaletteOpen,
    openQuickAdd,
    openImportHub,
    signOutAccount,
    exportAccountSnapshot,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length, query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      setIsCommandPaletteOpen(false);
    }
  };

  if (!isCommandPaletteOpen) return null;

  return (
    <div
      data-testid="command-palette-backdrop"
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) {
          setIsCommandPaletteOpen(false);
        }
      }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/80 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[#111319] border border-[#1E222B] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#20242E] bg-[#181B24]">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            data-testid="command-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLocked
                ? 'Vault is locked. Unlock to search data...'
                : 'Search Timeline, Notes, Goals, Funds, Gallery, or commands...'
            }
            disabled={isLocked}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 text-[10px] bg-[#111319] text-zinc-400 rounded border border-[#232732] font-mono">
            ESC
          </kbd>
          <button
            type="button"
            data-testid="command-palette-close-btn"
            onClick={() => setIsCommandPaletteOpen(false)}
            aria-label="Close Command Palette"
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div ref={listRef} className="max-h-96 overflow-y-auto p-2 divide-y divide-zinc-800/40">
          {isLocked ? (
            <div className="p-8 text-center space-y-2">
              <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
              <p className="text-sm font-semibold text-zinc-200">Vault Is Locked</p>
              <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                Search queries remain encrypted until you provide your master passphrase.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500">
              No matching commands or encrypted entries found.
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  onClick={item.onSelect}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-[#181B24] text-white' : 'text-zinc-300 hover:bg-[#181B24]/60'
                  }`}
                  style={isSelected ? { borderLeft: `3px solid ${accent.hex}` } : undefined}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="p-1.5 rounded-lg bg-[#111319] border border-[#232732] shrink-0">
                      {item.icon}
                    </div>
                    <div className="truncate">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      {item.subtitle && (
                        <div className="text-[11px] text-zinc-400 font-mono truncate">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-[#111319] text-zinc-400 border border-[#232732] font-mono">
                      {item.category}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="px-4 py-2 bg-[#0D0F14] border-t border-[#1E222B] flex items-center justify-between text-[11px] text-zinc-400">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>Double-click backdrop or ESC to close</span>
          </div>
          <span className="font-mono text-zinc-400">Encrypted Local Index</span>
        </div>
      </div>
    </div>
  );
};
