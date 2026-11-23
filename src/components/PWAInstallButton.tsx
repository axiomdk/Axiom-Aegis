import React, { useState } from 'react';
import { Smartphone, X, Download, CheckCircle2 } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { useVault } from '../context/VaultContext';
import { APP_VERSION } from '../utils/version';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const { accent, showNotification } = useVault();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const handleInstallClick = async () => {
    const accepted = await install();
    if (accepted) {
      showNotification(`Installed Axiom Aegis (${APP_VERSION}) as a standalone PWA!`, 'success');
    }
  };

  if (isInstalled) {
    return null;
  }

  return (
    <>
      {!isOnline && (
        <span
          data-testid="pwa-offline-badge"
          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#000000] border border-amber-500/40 text-[10px] font-mono text-amber-300"
          title="Offline Mode Active — Local AES-256 Vault Ready"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span>OFFLINE READY</span>
        </span>
      )}

      {isInstallable && (
        <button
          type="button"
          data-testid="pwa-install-btn"
          onClick={handleInstallClick}
          title="Install Axiom Aegis as a Standalone PWA"
          className={`inline-flex items-center gap-1.5 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] font-mono font-semibold text-zinc-200 hover:text-white transition-colors cursor-pointer ${
            compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
          }`}
          style={{ borderColor: accent.hex, color: accent.hex }}
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Install PWA</span>
        </button>
      )}

      {!isInstallable && isIOS && (
        <button
          type="button"
          data-testid="pwa-ios-guide-btn"
          onClick={() => setShowIOSGuide(true)}
          title="Install Axiom Aegis on iOS Home Screen"
          className={`inline-flex items-center gap-1.5 rounded-lg bg-[#000000] hover:bg-[#111319] border border-[#1E222B] font-mono font-semibold text-zinc-200 hover:text-white transition-colors cursor-pointer ${
            compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs'
          }`}
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" style={{ color: accent.hex }} />
          <span>Install iOS App</span>
        </button>
      )}

      {showIOSGuide && (
        <div
          data-testid="pwa-ios-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onDoubleClick={(e) => {
            if (e.target === e.currentTarget) setShowIOSGuide(false);
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-[#000000] border border-[#1E222B] p-5 shadow-2xl space-y-3 text-left"
          >
            <div className="flex items-center justify-between pb-2.5 border-b border-[#1E222B]">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4" style={{ color: accent.hex }} />
                <h3 className="text-sm font-bold text-white">Install on iPhone / iPad</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label="Close iOS Install Guide"
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="text-xs text-zinc-300 space-y-2 list-decimal list-inside font-mono">
              <li>
                Tap the <strong className="text-white">Share</strong> button in the Safari toolbar.
              </li>
              <li>
                Scroll down and select <strong className="text-white">Add to Home Screen</strong>.
              </li>
              <li>
                Launch <strong className="text-white">Axiom Aegis</strong> in full-screen standalone
                mode.
              </li>
            </ol>
            <div className="pt-2 border-t border-[#1E222B] flex items-center justify-between text-[11px] font-mono text-zinc-400">
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                100% Local Offline Vault
              </span>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="px-3 py-1.5 rounded-lg bg-[#000000] border border-[#1E222B] text-zinc-200 hover:text-white font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
