import React from 'react';
import { X, Download, HardDrive } from 'lucide-react';
import { useVault } from '../context/VaultContext';
import { downloadStandaloneApp } from '../utils/downloadApp';
import { APP_VERSION } from '../utils/version';

interface RunnableProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RunnableProgramModal: React.FC<RunnableProgramModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { showNotification } = useVault();

  if (!isOpen) return null;

  const handleDownloadClean = async () => {
    await downloadStandaloneApp(false);
    showNotification('Downloaded clean index.html copy of Axiom Aegis!', 'success');
  };

  return (
    <div
      data-testid="runnable-program-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onDoubleClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-[#000000] border border-[#1E222B] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 bg-[#08090C] border-b border-[#1E222B] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Download Clean HTML (<code className="font-mono text-emerald-400">index.html</code>)
                </h2>
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-300">
                  {APP_VERSION}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            data-testid="close-runnable-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/70 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <div className="p-4 rounded-2xl bg-[#08090C] border border-[#1E222B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">
                Clean Standalone Single-File HTML (<code className="font-mono text-emerald-400">index.html</code>)
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Downloads a clean, self-contained <code className="font-mono text-zinc-200">index.html</code> copy of Axiom Aegis with zero embedded personal session data.
              </p>
            </div>
            <button
              type="button"
              data-testid="download-clean-program-btn"
              onClick={handleDownloadClean}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center gap-2 shrink-0 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download index.html</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
