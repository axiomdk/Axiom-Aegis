import React, { useState, useMemo } from 'react';
import {
  X,
  History,
  Search,
  Copy,
  Check,
  Sparkles,
  CheckCircle2,
  Calendar,
  Tag,
} from 'lucide-react';
import {
  CHANGELOG_RELEASES,
  CHANGELOG_CATEGORY_META,
  ChangelogCategory,
  formatChangelogAsMarkdown,
} from '../utils/changelog';
import { APP_VERSION } from '../utils/version';
import { useVault } from '../context/VaultContext';

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
  const { showNotification } = useVault();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ChangelogCategory>('all');
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  const filteredReleases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return CHANGELOG_RELEASES.map((release) => {
      const matchingChanges = release.changes.filter((item) => {
        if (selectedCategory !== 'all' && item.category !== selectedCategory) {
          return false;
        }
        if (!q) return true;
        return (
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          release.version.toLowerCase().includes(q) ||
          release.codename.toLowerCase().includes(q)
        );
      });
      return {
        ...release,
        changes: matchingChanges,
      };
    }).filter((rel) => rel.changes.length > 0);
  }, [searchQuery, selectedCategory]);

  if (!isOpen) return null;

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(formatChangelogAsMarkdown());
      setCopiedMarkdown(true);
      showNotification('Copied full changelog markdown to clipboard!', 'success');
      setTimeout(() => setCopiedMarkdown(false), 2000);
    } catch {
      showNotification('Unable to copy changelog to clipboard.', 'error');
    }
  };

  return (
    <div
      data-testid="changelog-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-3xl rounded-2xl bg-[#000000] border border-[#1E222B] shadow-[0_24px_64px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#000000] border-b border-[#1E222B] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#000000] border border-amber-500/30 flex items-center justify-center text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Axiom Aegis — Official Changelog &amp; Release Notes
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-300">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Date-based YY.MM.DD release history ({APP_VERSION})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="changelog-copy-markdown-btn"
              onClick={handleCopyMarkdown}
              className="px-3 py-1.5 rounded-xl bg-[#000000] hover:border-zinc-600 border border-[#1E222B] text-xs font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copiedMarkdown ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>
            <button
              type="button"
              data-testid="close-changelog-modal-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 hover:text-white bg-[#000000] border border-[#1E222B] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3 bg-[#000000] border-b border-[#1E222B] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              data-testid="changelog-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search releases, features, or fixes..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-[#000000] border border-[#1E222B] text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'feature', label: 'Features' },
                { id: 'ui', label: 'UI / UX' },
                { id: 'architecture', label: 'Architecture' },
                { id: 'fix', label: 'Fixes' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-testid={`changelog-filter-${tab.id}`}
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                  selectedCategory === tab.id
                    ? 'bg-[#000000] text-amber-300 border border-amber-500/40'
                    : 'bg-[#000000] text-zinc-400 hover:text-zinc-200 border border-[#1E222B]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Releases Timeline List */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-[#000000]">
          {filteredReleases.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No changelog entries match your filter criteria.
            </div>
          ) : (
            filteredReleases.map((release) => (
              <div
                key={release.version}
                data-testid={`changelog-release-${release.version}`}
                className={`p-5 rounded-2xl border transition-all space-y-4 bg-[#000000] ${
                  release.isCurrent
                    ? 'border-emerald-500/40 shadow-lg'
                    : 'border-[#1E222B]'
                }`}
              >
                {/* Release Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E222B] pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg bg-[#000000] border border-[#1E222B] font-mono text-xs font-extrabold text-white">
                      {release.version}
                    </span>
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>{release.codename}</span>
                    </h3>
                    {release.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold">
                        ACTIVE BUILD
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{release.date}</span>
                  </div>
                </div>

                {/* Summary */}
                <p className="text-xs text-zinc-300 leading-relaxed">{release.summary}</p>

                {/* Key Highlights */}
                {release.highlights.length > 0 && selectedCategory === 'all' && !searchQuery && (
                  <div className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {release.highlights.map((hl, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-[11px] text-zinc-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{hl}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Detailed Changes */}
                <div className="space-y-2.5 pt-1">
                  {release.changes.map((item) => {
                    const meta = CHANGELOG_CATEGORY_META[item.category];
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] flex flex-col sm:flex-row sm:items-start gap-2.5"
                      >
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border shrink-0 mt-0.5 ${meta.badgeClass}`}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          {meta.label}
                        </span>
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-xs font-bold text-white">{item.title}</div>
                          <p className="text-[11px] text-zinc-400 leading-relaxed">
                            {item.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#000000] border-t border-[#1E222B] flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
          <span>
            Showing {filteredReleases.reduce((acc, r) => acc + r.changes.length, 0)} documented updates across{' '}
            {filteredReleases.length} releases
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#000000] hover:border-zinc-600 border border-[#1E222B] text-zinc-200 font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
