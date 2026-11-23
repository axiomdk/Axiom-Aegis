import React from 'react';
import { AccountRole } from '../types';
import { Crown, Sparkles, User } from 'lucide-react';

export interface RoleBadgeProps {
  role?: AccountRole | null;
  size?: 'xs' | 'sm';
  testId?: string;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role = 'User',
  size = 'xs',
  testId = 'account-role-badge',
}) => {
  const effectiveRole: AccountRole =
    role === 'The App Creator' || role === 'VIP' ? role : 'User';

  const padClass = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-1.5 py-0.5 text-[9px]';
  const iconClass = size === 'sm' ? 'w-3 h-3' : 'w-2.5 h-2.5';

  if (effectiveRole === 'The App Creator') {
    return (
      <span
        data-testid={testId}
        data-role="The App Creator"
        title="Master Admin — The App Creator (Axiomdk99@gmail.com)"
        className={`inline-flex items-center gap-1 rounded font-mono font-extrabold uppercase tracking-wider whitespace-nowrap shrink-0 bg-amber-500/15 text-amber-300 border border-amber-400/50 shadow-[0_0_10px_rgba(245,158,11,0.2)] ${padClass}`}
      >
        <Crown className={`${iconClass} text-cyan-400 shrink-0`} />
        <span>THE APP CREATOR</span>
      </span>
    );
  }

  if (effectiveRole === 'VIP') {
    return (
      <span
        data-testid={testId}
        data-role="VIP"
        title="VIP Prestige Member Rank"
        className={`inline-flex items-center gap-1 rounded font-mono font-extrabold uppercase tracking-wider whitespace-nowrap shrink-0 bg-purple-500/15 text-emerald-300 border border-purple-400/50 shadow-[0_0_8px_rgba(168,85,247,0.18)] ${padClass}`}
      >
        <Sparkles className={`${iconClass} text-purple-300 shrink-0`} />
        <span>VIP</span>
      </span>
    );
  }

  return (
    <span
      data-testid={testId}
      data-role="User"
      title="Standard Member Rank"
      className={`inline-flex items-center gap-1 rounded font-mono font-bold uppercase tracking-wider whitespace-nowrap shrink-0 bg-[#111319] text-zinc-400 border border-[#232732] ${padClass}`}
    >
      <User className={`${iconClass} text-zinc-500 shrink-0`} />
      <span>USER</span>
    </span>
  );
};
