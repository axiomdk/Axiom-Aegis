import React from 'react';
import { VaultProvider, useVault } from './context/VaultContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { VaultModal } from './components/VaultModal';
import { CommandPalette } from './components/CommandPalette';
import { QuickAddModal } from './components/QuickAddModal';
import { FrequentEventsModal } from './components/FrequentEventsModal';
import { NotificationToast } from './components/NotificationToast';
import { DashboardView } from './components/DashboardView';
import { CalendarView } from './components/CalendarView';
import { LifeStatsView } from './components/LifeStatsView';
import { DistanceView } from './components/DistanceView';
import { FundsView } from './components/FundsView';
import { GoalsView } from './components/GoalsView';
import { GalleryView } from './components/GalleryView';
import { SettingsView } from './components/SettingsView';
import { DailyNotesView } from './components/DailyNotesView';
import { AdminPortalView } from './components/AdminPortalView';
import { SiteImprovementsView } from './components/SiteImprovementsView';
import { CustomCategoryWorkspaceView } from './components/CustomCategoryWorkspaceView';
import { ShortcutsView } from './components/ShortcutsView';
import { ChoresView } from './components/chores/ChoresView';
import { DataImportHubModal } from './components/DataImportHubModal';
import { RunnableProgramModal } from './components/RunnableProgramModal';
import { ChangelogModal } from './components/ChangelogModal';
import { BrandLogo } from './components/BrandLogo';
import { MobileBottomNav } from './components/MobileBottomNav';
import { PWAInstallButton } from './components/PWAInstallButton';
import { History, Monitor, Plus } from 'lucide-react';
import { APP_VERSION, formatLastUpdated, formatExactTime } from './utils/version';
import { isAdminOnlyTab } from './utils/sidebarEngine';

const MainLayout: React.FC = () => {
  const {
    isLocked,
    isAuthenticated,
    isMasterAdmin,
    activeTab,
    openQuickAdd,
    accent,
    lastSavedTimestamp,
    isImportHubOpen,
    closeImportHub,
    importHubInitialTab,
    layoutConfig,
    appData,
  } = useVault();
  const [isRunnableModalOpen, setIsRunnableModalOpen] = React.useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = React.useState(false);

  React.useEffect(() => {
    const handleOpenRunnableModal = () => setIsRunnableModalOpen(true);
    const handleOpenChangelogModal = () => setIsChangelogOpen(true);
    window.addEventListener('open-runnable-program-modal', handleOpenRunnableModal);
    window.addEventListener('open-changelog-modal', handleOpenChangelogModal);
    return () => {
      window.removeEventListener('open-runnable-program-modal', handleOpenRunnableModal);
      window.removeEventListener('open-changelog-modal', handleOpenChangelogModal);
    };
  }, []);

  const recentUpdateTime = formatLastUpdated(lastSavedTimestamp);
  const exactUpdateTime = formatExactTime(lastSavedTimestamp);
  const currentAppName = appData?.settings?.appName || 'Axiom Aegis';
  const currentShortName = appData?.settings?.appShortName || 'AA';
  const sidebarPosition =
    appData?.settings?.sidebarPosition || layoutConfig?.sidebarPosition || 'left';

  const containerWidthClass =
    typeof layoutConfig.customPageMaxWidthPx === 'number' &&
    layoutConfig.customPageMaxWidthPx >= 960 &&
    layoutConfig.pageWidth !== 'full'
      ? 'max-w-[var(--app-page-max-width,1680px)] mx-auto'
      : layoutConfig.pageWidth === 'standard'
      ? 'max-w-[1680px] mx-auto'
      : layoutConfig.pageWidth === 'ultrawide'
      ? 'max-w-[2400px] mx-auto'
      : 'w-full max-w-none';

  // Mandatory Login / Sign-Up Gate: Block unauthenticated access to the dashboard
  if (isLocked || !isAuthenticated) {
    return (
      <div className="aa-theme-shell min-h-[100dvh] bg-[#000000] text-zinc-100 font-sans selection:bg-amber-500/30 selection:text-white">
        <VaultModal />
        <NotificationToast />
      </div>
    );
  }

  return (
    <div
      data-sidebar-position={sidebarPosition}
      className="aa-theme-shell min-h-[100dvh] bg-[#000000] text-zinc-100 flex font-sans selection:bg-amber-500/30 selection:text-white pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
    >
      {/* Collapsible Left Sidebar or Bottom Dock Bar */}
      <Sidebar />

      {/* Main Content Shell */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-[100dvh] bg-[#000000] max-md:pb-[calc(4rem+env(safe-area-inset-bottom,0px))] ${
          sidebarPosition === 'bottom' ? 'lg:pb-24' : ''
        }`}
      >
        {/* Minimal Top Header Bar */}
        <Navbar />

        {/* Main Content Area — Full-screen / configurable canvas width */}
        <main
          data-testid="main-workspace-canvas"
          data-page-width={layoutConfig.pageWidth}
          className={`flex-1 w-full ${containerWidthClass} px-4 sm:px-6 lg:px-8 py-5 sm:py-7 transition-all duration-200`}
        >
          <div>
            {(activeTab === 'dashboard' ||
              (!isMasterAdmin &&
                isAdminOnlyTab(activeTab, appData?.customNavCategories))) && (
              <DashboardView />
            )}
            {activeTab === 'shortcuts' && <ShortcutsView />}
            {(activeTab === 'calendar' || activeTab === 'timeline') && <CalendarView />}
            {activeTab === 'notes' && <DailyNotesView />}
            {activeTab === 'chores' && <ChoresView />}
            {activeTab === 'lifestats' && <LifeStatsView />}
            {activeTab === 'distance' && <DistanceView />}
            {activeTab === 'funds' && <FundsView />}
            {activeTab === 'goals' && <GoalsView />}
            {activeTab === 'gallery' && <GalleryView />}
            {activeTab === 'customization' && <SettingsView mode="customization" />}
            {activeTab === 'settings' && <SettingsView mode="settings" />}
            {activeTab === 'admin' && isMasterAdmin && <AdminPortalView />}
            {activeTab === 'site_improvements' && isMasterAdmin && <SiteImprovementsView />}
            {activeTab.startsWith('custom_cat_') &&
              (!isAdminOnlyTab(activeTab, appData?.customNavCategories) || isMasterAdmin) && (
                <CustomCategoryWorkspaceView categoryId={activeTab} />
              )}
          </div>
        </main>

        {/* Footer */}
        <footer className="w-full border-t border-[#1E222B] bg-[#000000] py-5 text-center text-xs text-zinc-400">
          <div
            className={`${containerWidthClass} px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2`}
          >
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <BrandLogo
                resolution={32}
                className="w-7 h-7 rounded-lg bg-[#000000] border border-[#1E222B] shrink-0"
                accentColor={accent.hex}
              />
              <span data-testid="footer-app-name" className="font-semibold text-zinc-200">
                {currentAppName}
              </span>
              <span
                data-testid="footer-app-monogram"
                className="px-1.5 py-0.5 rounded text-[11px] font-mono bg-[#181B24] border border-[#232732] font-bold"
                style={{ color: accent.hex }}
              >
                {currentShortName}
              </span>
              <button
                type="button"
                data-testid="footer-app-version"
                onClick={() => setIsChangelogOpen(true)}
                title="View Changelog & Release Notes"
                className="px-1.5 py-0.5 rounded text-xs font-mono bg-[#111319] hover:bg-[#1A1E29] border border-[#1E222B] text-zinc-300 hover:text-white font-semibold transition-colors cursor-pointer"
              >
                {APP_VERSION}
              </button>
              <span className="text-zinc-600">•</span>
              <span>Cloud-Synced Multi-Device Workspace</span>
            </div>
            <div
              className="flex items-center gap-2 font-mono text-xs text-zinc-400 select-none flex-wrap justify-center"
              title={`Exact: ${exactUpdateTime}`}
            >
              <span>
                Updated: <strong className="text-zinc-200 font-medium">{recentUpdateTime}</strong>
              </span>
              <span className="text-zinc-600">•</span>
              <button
                type="button"
                data-testid="footer-changelog-btn"
                onClick={() => setIsChangelogOpen(true)}
                className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-semibold transition-colors cursor-pointer"
              >
                <History className="w-3 h-3" />
                <span>Changelog</span>
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Fixed Bottom Navigation Bar (< 768px only) */}
      <MobileBottomNav />

      {/* Floating Action Button for Mobile Quick Add (Positioned above MobileBottomNav) */}
      {!isLocked && (
        <button
          onClick={() => openQuickAdd()}
          aria-label="Quick Add Entry"
          className={`md:hidden fixed bottom-20 right-4 z-40 w-12 h-12 min-h-[44px] rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-95 ${accent.primaryBg}`}
          style={{ boxShadow: `0 4px 20px ${accent.glow}` }}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Global Modals & Notifications */}
      <CommandPalette />
      <QuickAddModal />
      <FrequentEventsModal />
      <DataImportHubModal
        isOpen={isImportHubOpen}
        onClose={closeImportHub}
        initialTab={importHubInitialTab}
      />
      <ChangelogModal
        isOpen={isChangelogOpen}
        onClose={() => setIsChangelogOpen(false)}
      />
      <NotificationToast />
    </div>
  );
};

export default function App() {
  return (
    <VaultProvider>
      <MainLayout />
    </VaultProvider>
  );
}
