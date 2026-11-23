import React, { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { CategoryDomain } from '../types';
import { useVault } from '../context/VaultContext';

export interface InlineCategoryBadgeProps {
  category: string;
  domain?: CategoryDomain;
  colorHex?: string;
  selected?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  onSelect?: () => void;
  onRenamed?: (oldName: string, newName: string) => void;
  prefix?: string;
  suffixCount?: number;
  showCount?: number;
  variant?: 'pill' | 'tag' | 'inline' | 'row';
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  testIdPrefix?: string;
}

export const InlineCategoryBadge: React.FC<InlineCategoryBadgeProps> = ({
  category,
  domain,
  colorHex,
  selected = false,
  isSelected,
  onClick,
  onSelect,
  onRenamed,
  prefix,
  suffixCount,
  variant = 'pill',
  className = '',
  testIdPrefix = 'category',
}) => {
  const effectiveSelected = isSelected ?? selected;
  const effectiveOnClick = onSelect ?? onClick;
  const { renameCategory, isEditMode } = useVault();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(category);
  const inputRef = useRef<HTMLInputElement>(null);
  const canceledRef = useRef(false);

  useEffect(() => {
    if (!isEditing) {
      setDraft(category);
    }
  }, [category, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const startEditing = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!isEditMode || category.toLowerCase() === 'all') return;
    canceledRef.current = false;
    setDraft(category);
    setIsEditing(true);
  };

  const cancelEditing = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
    }
    canceledRef.current = true;
    setDraft(category);
    setIsEditing(false);
  };

  const commitRename = async (e?: React.MouseEvent | React.FocusEvent | React.KeyboardEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (canceledRef.current) {
      canceledRef.current = false;
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed || trimmed === category) {
      setDraft(category);
      setIsEditing(false);
      return;
    }

    setIsEditing(false);
    const res = await renameCategory(category, trimmed, domain);
    if (res.updated && onRenamed) {
      onRenamed(category, res.finalName);
    } else if (!res.updated) {
      setDraft(category);
    }
  };

  if (category.toLowerCase() === 'all') {
    return (
      <button
        type="button"
        onClick={effectiveOnClick}
        data-testid={`${testIdPrefix}-pill-all`}
        className={`px-3 py-1 rounded-lg text-xs font-medium capitalize shrink-0 transition-colors border bg-[#000000] ${
          effectiveSelected
            ? 'text-white border-zinc-600 shadow-sm'
            : 'text-zinc-400 border-[#1E222B] hover:text-zinc-200'
        } ${className}`}
      >
        All{typeof suffixCount === 'number' ? ` (${suffixCount})` : ''}
      </button>
    );
  }

  if (isEditing) {
    return (
      <span
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0E1015] border border-cyan-500/60 shadow-md shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={draft}
          data-testid={`${testIdPrefix}-rename-input-${category}`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename(e);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelEditing(e);
            }
          }}
          onBlur={(e) => commitRename(e)}
          className="w-28 px-1.5 py-0.5 rounded bg-[#181B24] text-xs font-mono text-white focus:outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            commitRename(e);
          }}
          data-testid={`${testIdPrefix}-rename-save-${category}`}
          title="Save category name (Enter)"
          className="p-0.5 rounded text-emerald-400 hover:bg-emerald-500/20 transition-colors"
        >
          <Check className="w-3 h-3" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            cancelEditing(e);
          }}
          data-testid={`${testIdPrefix}-rename-cancel-${category}`}
          title="Cancel (Escape)"
          className="p-0.5 rounded text-zinc-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </span>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        onDoubleClick={startEditing}
        data-testid={`${testIdPrefix}-inline-${category}`}
        title="Double-click or click pencil to rename category across all items"
        className={`inline-flex items-center gap-1 group/cat cursor-pointer ${className}`}
      >
        {colorHex && (
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: colorHex }}
          />
        )}
        <span>
          {prefix}
          {category}
        </span>
        {isEditMode && (
          <button
            type="button"
            onClick={startEditing}
            data-testid={`${testIdPrefix}-edit-btn-${category}`}
            aria-label={`Rename category ${category}`}
            title={`Rename "${category}" across all items`}
            className="opacity-70 group-hover/cat:opacity-100 p-0.5 rounded text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all"
          >
            <Edit2 className="w-2.5 h-2.5" />
          </button>
        )}
      </span>
    );
  }

  return (
    <div
      onClick={effectiveOnClick}
      onDoubleClick={startEditing}
      data-testid={`${testIdPrefix}-pill-${category}`}
      title="Click to filter • Double-click or click pencil to rename category across all items"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium capitalize shrink-0 transition-colors border cursor-pointer group/cat bg-[#000000] ${
        effectiveSelected
          ? 'text-white border-zinc-600 shadow-sm'
          : 'text-zinc-400 border-[#1E222B] hover:text-zinc-200'
      } ${className}`}
    >
      {colorHex && (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: colorHex }}
        />
      )}
      <span>
        {prefix}
        {category}
        {typeof suffixCount === 'number' ? ` (${suffixCount})` : ''}
      </span>
      {isEditMode && (
        <button
          type="button"
          onClick={startEditing}
          data-testid={`${testIdPrefix}-edit-btn-${category}`}
          aria-label={`Rename category ${category}`}
          title={`Rename "${category}" across all items`}
          className="p-0.5 rounded text-zinc-500 hover:text-cyan-400 hover:bg-cyan-500/15 transition-colors"
        >
          <Edit2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};
