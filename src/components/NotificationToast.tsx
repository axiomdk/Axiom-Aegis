import React from 'react';
import { useVault } from '../context/VaultContext';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { notification } = useVault();

  if (!notification) return null;

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-sky-400 shrink-0" />;
    }
  };

  const getBorder = () => {
    switch (notification.type) {
      case 'success':
        return 'border-emerald-500/40 bg-zinc-900/95 text-emerald-300';
      case 'error':
        return 'border-rose-500/40 bg-zinc-900/95 text-rose-300';
      default:
        return 'border-zinc-700 bg-zinc-900/95 text-zinc-200';
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full transition-all animate-bounce-short">
      <div
        className={`flex items-center gap-3 p-3.5 rounded-xl border shadow-2xl backdrop-blur-md text-xs font-medium ${getBorder()}`}
      >
        {getIcon()}
        <span className="flex-1 leading-snug">{notification.message}</span>
      </div>
    </div>
  );
};
