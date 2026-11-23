import React from 'react';
import { useVault } from '../context/VaultContext';
import { MOBILE_BOTTOM_NAV_ITEMS } from '../utils/mobilePwaEngine';
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  Wallet,
  Target,
  Menu,
} from 'lucide-react';

export const MobileBottomNav: React.FC = () => {
  const {
    isLocked,
    activeTab,
    setActiveTab,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    accent,
    appData,
    layoutConfig,
  } = useVault();

  if (isLocked) return null;

  const sidebarIconColor =
    appData?.settings?.sidebarIconColor || layoutConfig?.sidebarIconColor || accent.hex;

  const getIcon = (id: string) => {
    switch (id) {
      case 'dashboard':
        return <LayoutDashboard className="w-4 h-4 shrink-0" style={{ color: sidebarIconColor }} />;
      case 'calendar':
        return <Calendar className="w-4 h-4 shrink-0" style={{ color: sidebarIconColor }} />;
      case 'notes':
        return <BookOpen className="w-4 h-4 shrink-0" style={{ color: sidebarIconColor }} />;
      case 'funds':
        return <Wallet className="w-4 h-4 shrink-0" style={{ color: sidebarIconColor }} />;
      case 'goals':
        return <Target className="w-4 h-4 shrink-0" style={{ color: sidebarIconColor }} />;
      default:
        return <Menu className="w-4 h-4 shrink-0" style={{ color: sidebarIconColor }} />;
    }
  };

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#000000] border-t border-[#1E222B] pb-[env(safe-area-inset-bottom)] select-none"
    >
      <div className="grid grid-cols-6 items-stretch h-14 px-1">
        {MOBILE_BOTTOM_NAV_ITEMS.map((item) => {
          const isActive = item.isDrawerToggle
            ? isMobileSidebarOpen
            : item.tab === activeTab && !isMobileSidebarOpen;

          return (
            <button
              key={item.id}
              type="button"
              data-testid={`mobile-bottom-nav-${item.id}`}
              aria-label={item.isDrawerToggle ? 'More Views Menu' : `${item.label} View`}
              aria-current={isActive && !item.isDrawerToggle ? 'page' : undefined}
              onClick={() => {
                if (item.isDrawerToggle) {
                  setIsMobileSidebarOpen((prev) => !prev);
                } else if (item.tab) {
                  setActiveTab(item.tab);
                  setIsMobileSidebarOpen(false);
                }
              }}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-1 rounded-lg bg-[#000000] transition-colors relative ${
                isActive ? 'text-white font-bold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              style={isActive ? { color: accent.hex } : undefined}
            >
              {isActive && (
                <span
                  className="absolute top-0 left-2 right-2 h-0.5 rounded-full"
                  style={{ backgroundColor: accent.hex }}
                />
              )}
              {getIcon(item.id)}
              <span className="text-[10px] font-mono leading-none tracking-tight truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
