import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Check, Trash2 } from 'lucide-react';
import {
  evaluateModalDismissAction,
  ModalDismissTrigger,
  UNSAVED_CHANGES_MESSAGE,
} from '../utils/modalGuardEngine';

interface UseModalGuardOptions {
  isOpen: boolean;
  isDirty: boolean;
  onClose: () => void;
}

export function useModalGuard({ isOpen, isDirty, onClose }: UseModalGuardOptions) {
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setShowUnsavedConfirm(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isDirty && showUnsavedConfirm) {
      setShowUnsavedConfirm(false);
    }
  }, [isDirty, showUnsavedConfirm]);

  const triggerDismiss = useCallback(
    (trigger: ModalDismissTrigger) => {
      const decision = evaluateModalDismissAction(trigger, isDirty);
      if (decision === 'close_immediately') {
        setShowUnsavedConfirm(false);
        onClose();
      } else if (decision === 'prompt_unsaved_confirmation') {
        setShowUnsavedConfirm(true);
      }
    },
    [isDirty, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        triggerDismiss('escape_key');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, triggerDismiss]);

  const handleBackdropDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        triggerDismiss('backdrop_double_click');
      }
    },
    [triggerDismiss]
  );

  const handleRequestClose = useCallback(() => {
    triggerDismiss('close_button');
  }, [triggerDismiss]);

  const handleForceClose = useCallback(() => {
    setShowUnsavedConfirm(false);
    onClose();
  }, [onClose]);

  const handleKeepEditing = useCallback(() => {
    setShowUnsavedConfirm(false);
  }, []);

  return {
    showUnsavedConfirm,
    showConfirmClose: showUnsavedConfirm,
    handleBackdropDoubleClick,
    handleRequestClose,
    requestExplicitClose: handleRequestClose,
    handleForceClose,
    confirmDiscardAndClose: handleForceClose,
    handleKeepEditing,
    cancelClose: handleKeepEditing,
  };
}

interface UnsavedChangesBannerProps {
  show?: boolean;
  isOpen?: boolean;
  onKeepEditing: () => void;
  onDiscardAndClose: () => void;
}

export const UnsavedChangesBanner: React.FC<UnsavedChangesBannerProps> = ({
  show,
  isOpen,
  onKeepEditing,
  onDiscardAndClose,
}) => {
  const visible = Boolean(show ?? isOpen);
  if (!visible) return null;

  return (
    <div
      data-testid="unsaved-changes-guard"
      role="alertdialog"
      aria-live="assertive"
      className="mb-4 p-3.5 rounded-xl bg-amber-950/80 border border-amber-500/60 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150 shrink-0"
    >
      <div className="flex items-start sm:items-center gap-2.5 text-xs text-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
        <span className="font-semibold">{UNSAVED_CHANGES_MESSAGE}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <button
          type="button"
          data-testid="unsaved-keep-editing-btn"
          onClick={onKeepEditing}
          className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>Keep Editing</span>
        </button>
        <button
          type="button"
          data-testid="unsaved-discard-close-btn"
          onClick={onDiscardAndClose}
          className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Discard &amp; Close</span>
        </button>
      </div>
    </div>
  );
};
