import { APP_VERSION } from './version';

export type ChangelogCategory = 'feature' | 'ui' | 'architecture' | 'fix';

export interface ChangelogItem {
  id: string;
  category: ChangelogCategory;
  title: string;
  description: string;
}

export interface ChangelogRelease {
  version: string;
  codename: string;
  date: string;
  isCurrent?: boolean;
  summary: string;
  highlights: string[];
  changes: ChangelogItem[];
}

export const CHANGELOG_CATEGORY_META: Record<
  ChangelogCategory,
  { label: string; badgeClass: string }
> = {
  feature: {
    label: 'Feature',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  ui: {
    label: 'UI / UX',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  },
  architecture: {
    label: 'Architecture & Security',
    badgeClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  },
  fix: {
    label: 'Quality & Fix',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
};

export const CHANGELOG_RELEASES: ChangelogRelease[] = [
  {
    version: APP_VERSION,
    codename: 'Cloud-First Cross-Platform Sync, Unified Chores & Live Sync Telemetry',
    date: '2026-11-20',
    isCurrent: true,
    summary:
      'Migrated Axiom Aegis to full cross-platform cloud persistence (v26.11.20) across Worker KV/D1 and server database sync: unified Notes and Chores directly into AppData with deletion tombstones, added automatic revalidation on startup and window/tab focus, surfaced live Synced / Syncing... / Offline telemetry in the header, and updated the workspace footer badge.',
    highlights: [
      'Removed isolated localStorage/sessionStorage silos in Chores and Notes so every mutation syncs seamlessly across devices',
      'Upgraded Cloudflare Worker (_worker.js) & server API with fresh KV/D1 multi-isolate reads, tombstone-aware cross-device merges, and strict Bearer auth',
      'Added automatic background revalidation on app startup, window focus, tab visibilitychange, and network reconnect',
      'Added live visible header sync telemetry (Synced, Syncing..., Offline) and updated footer to Cloud-Synced Multi-Device Workspace',
    ],
    changes: [
      {
        id: 'v26.11.20-cloud-first-unified-state',
        category: 'architecture',
        title: 'Unified Cloud Persistence for Chores, Notes & Core AppData',
        description:
          'Refactored ChoresView, choresStore helpers, DailyNotesView, and AppData sanitization to route all creates, edits, toggles, and deletes through the centralized cloud sync API with tombstone tracking so deletions synchronize cleanly across browsers and devices.',
      },
      {
        id: 'v26.11.20-worker-kv-d1-revalidation',
        category: 'feature',
        title: 'Multi-Isolate Cloud Sync Backend & Focus Revalidation',
        description:
          'Removed stale isolate memory caching in Cloudflare Worker KV/D1 hydration, enforced strict token verification across all endpoints, and added automatic startup + window/tab focus pull revalidation.',
      },
      {
        id: 'v26.11.20-live-sync-telemetry',
        category: 'ui',
        title: 'Live Cloud Sync Telemetry Indicator & Footer Update',
        description:
          'Surfaced real-time Synced, Syncing..., and Offline status badges in the header bar and updated the workspace footer from Local-First Private Workspace to Cloud-Synced Multi-Device Workspace.',
      },
    ],
  },
  {
    version: 'v26.11.04',
    codename: 'Rank Badge Left-Aligned Stack, Profile Telemetry Optimization & ResizeObserver Hardening',
    date: '2026-11-04',
    isCurrent: false,
    summary:
      'Advanced date-based version to v26.11.04 (2026-11-04) following key UX ergonomics refinements and browser stability hardening: repositioned the « Aegis Vanguard » rank badge directly underneath "Axiom Creator" on its own left-aligned row between the display name and telemetry strip, condensed the User Profile header telemetry and action bar, scaled vertical stature of Dashboard widgets for improved data density, and resolved the browser ResizeObserver loop notification error in visualizer widgets.',
    highlights: [
      'Repositioned the « Aegis Vanguard » rank badge directly underneath the Commander display name on its own row (stacked between name and telemetry strip)',
      'Condensed the User Profile header telemetry bar (active date, version badge, and sync status) with high-density badges',
      'Elevated Dashboard widgets and adjusted vertical stature scaling across all primary overview panels',
      'Hardened AegisVisualizerWidget with requestAnimationFrame canvas debouncing and global error suppression for ResizeObserver loop notifications',
      'Confirmed active calendar release update to v26.11.04 (2026-11-04) with two-digit day formatting convention',
    ],
    changes: [
      {
        id: 'v26.11.04-rank-badge-repositioning',
        category: 'ui',
        title: 'Repositioned Rank Badge Under Commander Display Name',
        description:
          'Moved the « Aegis Vanguard » rank badge to its own dedicated flex row directly below "Axiom Creator", neatly stacked between the display name and the condensed telemetry strip.',
      },
      {
        id: 'v26.11.04-resize-observer-loop-hardening',
        category: 'fix',
        title: 'ResizeObserver Loop Error Suppression & Animation Frame Debouncing',
        description:
          'Wrapped visualizer canvas dimension recalculations in requestAnimationFrame to eliminate synchronous layout loops and added global error boundary suppression.',
      },
      {
        id: 'v26.11.04-dashboard-density-and-elevation',
        category: 'ui',
        title: 'Dashboard Widget Elevation & Vertical Stature Scaling',
        description:
          'Refined widget heights, padding tokens, and contrast borders across the Dashboard matrix for optimal operational density.',
      },
      {
        id: 'v26.11.04-date-version-advancement',
        category: 'architecture',
        title: 'Date-Based Versioning Advancement (v26.11.04 / 26.11.04)',
        description:
          'Advanced the calendar release date to 2026-11-04, establishing the two-digit day YY.MM.DD version format (26.11.04) and updating the active changelog manifest.',
      },
    ],
  },
  {
    version: 'v26.11.3',
    codename: 'Unified Customization Studio Consolidation & Streamlined Dashboard Profile Header',
    date: '2026-11-03',
    isCurrent: false,
    summary:
      'Advanced date-based version to v26.11.3 (2026-11-03) following major architectural and UI additions: consolidated the entire Customization Studio into a unified 5-tab module with zero duplicate controls, introduced the Unified Color & Surface Engine with custom hex overrides, added 100% adjustable typography & geometry sliders, unified category management across all 6 domains, and removed the 4 top telemetry summary buttons from the Dashboard Profile header.',
    highlights: [
      'Consolidated Customization Studio into 5 zero-duplication tabs (Layout & Panels, Color & Surface Engine, Typography & Geometry, Navigation & Dock, Category Manager) with a sticky Live Telemetry & CSS Token Bar',
      'Built the Unified Color & Surface Engine with custom Accent Hex, Border Hex, Surface Contrast, and Category Color Swatch Pickers',
      'Added continuous pixel sliders for Max Canvas Width (960px–2560px), Grid Gap (8px–32px), Card Padding (12px–32px), Card Radius (0px–24px), Border Width (0px–3px), Font Size (85%–125%), and Line Height (1.2–1.8)',
      'Streamlined the Dashboard User Profile Header by removing the 4 top telemetry buttons (Net Funds, Distance, Latest Mood, Vault Records)',
      'Confirmed change-gated YY.MM.DD date versioning (resolveVersionWithDateOnChanges) advancing from v26.11.2 (2026-11-02) to v26.11.3 (2026-11-03) upon new changes and additions',
    ],
    changes: [
      {
        id: 'v26.11.3-unified-customization-studio-consolidation',
        category: 'feature',
        title: 'Unified Customization Studio Module (5-Tab Architecture & Sticky Token Bar)',
        description:
          'Eliminated all overlapping layout, preview, and panel controls across the Customization view, consolidating every setting into a single source of truth with an interactive 2D Panel Matrix.',
      },
      {
        id: 'v26.11.3-unified-color-surface-typography-geometry',
        category: 'ui',
        title: 'Unified Color & Surface Engine + 100% Adjustable Typography & Geometry Tokens',
        description:
          'Grouped all color settings (custom accent hex, border hex, surface contrast, glow intensity, icon tinting) and continuous CSS variable sliders (--app-page-max-width, --app-grid-gap, --app-card-padding, --app-card-radius, --app-border-width, --app-font-scale, --app-line-height).',
      },
      {
        id: 'v26.11.3-unified-category-manager-all-domains',
        category: 'feature',
        title: 'Unified Category Manager Across All 6 Operational Domains',
        description:
          'Added full category CRUD (create, inline rename, 10-color swatch picker, delete with item migration) across Timeline, Life Stats, Distance, Funds, Goals, and Custom Quotes.',
      },
      {
        id: 'v26.11.3-dashboard-profile-header-telemetry-cleanup',
        category: 'ui',
        title: 'Dashboard Profile Header Cleanup (Removed Top Telemetry Buttons)',
        description:
          'Removed the four top right summary buttons (Net Funds, Distance, Latest Mood, Vault Records) from the Dashboard User Profile card so metrics live exclusively inside Dashboard widgets.',
      },
      {
        id: 'v26.11.3-change-gated-date-versioning',
        category: 'architecture',
        title: 'Change-Gated Date Versioning Confirmation (v26.11.2 → v26.11.3)',
        description:
          'Implemented resolveReleaseDateWithChanges and resolveVersionWithDateOnChanges so the YY.MM.DD version automatically advances with the calendar date whenever changes or additions are recorded.',
      },
    ],
  },
  {
    version: 'v26.11.2',
    codename: 'Date-Based Versioning Era & Cross-Device Registry Sync Overhaul',
    date: '2026-11-02',
    isCurrent: false,
    summary:
      'Executed a full changelog wipe and reset for the new YY.MM.DD date-based versioning era (v26.11.2). Rewrote cross-device Account Registry syncing between localStorage and Cloudflare Workers so secondary-device ghost accounts sync reliably to the Master Admin portal, replaced the legacy Dashboard greeting/logo/quote banner with a pure-black User Profile header, and streamlined the Top Bar while retaining full Profile customization and photo management.',
    highlights: [
      'Transitioned Axiom Aegis to date-based YY.MM.DD versioning starting at v26.11.2 with a clean-slate Changelog reset',
      'Rewrote Account Registry & Ghost Account reconciliation between localStorage and Cloudflare Workers (/api/accounts/reconcile & /api/admin/accounts)',
      'Replaced the Dashboard top logo, greeting, and quote header with a flat pure-black (#000000) User Profile & Telemetry header',
      'Streamlined the Top Bar layout while preserving the full Profile selector and dropdown menu with direct photo & profile customization',
    ],
    changes: [
      {
        id: 'v26.11.2-cloudflare-ghost-account-registry-sync',
        category: 'architecture',
        title: 'Cloudflare Workers Account Registry & Secondary-Device Ghost Account Sync',
        description:
          'Removed static-host API blocking on Cloudflare Workers/Pages and single-file origins, added automatic ghost-account reconciliation (/api/accounts/reconcile), and merged remote + local registries so the Master Admin (Axiomdk99@gmail.com) reliably views all cross-device accounts.',
      },
      {
        id: 'v26.11.2-date-versioning-changelog-reset',
        category: 'architecture',
        title: 'Date-Based YY.MM.DD Versioning System (v26.11.2) & Changelog Reset',
        description:
          'Replaced semantic versioning with deterministic YY.MM.DD calendar versioning (v26.11.2 today, v26.11.3 tomorrow) and wiped legacy changelog history.',
      },
      {
        id: 'v26.11.2-dashboard-user-profile-header',
        category: 'ui',
        title: 'Dashboard Header Redesign: Pure-Black User Profile & Telemetry Card',
        description:
          'Removed the Axiom Aegis emblem, time-of-day greeting, and dynamic quote system from the top of the Dashboard, replacing them with the User Profile display, avatar, role badge, and live workspace telemetry.',
      },
      {
        id: 'v26.11.2-topbar-streamline-profile-dropdown',
        category: 'ui',
        title: 'Streamlined Top Bar with Full Profile Selector & Photo Customization Dropdown',
        description:
          'Cleaned up the Top Bar navigation while retaining the complete Profile selector and dropdown menu for changing profile photos, editing display name/guild, and syncing.',
      },
    ],
  },
];

export function formatChangelogAsMarkdown(releases: ChangelogRelease[] = CHANGELOG_RELEASES): string {
  const lines: string[] = ['# Axiom Aegis (AA) — Official Changelog', ''];
  for (const rel of releases) {
    lines.push(`## ${rel.version} — ${rel.codename} (${rel.date})`);
    lines.push(rel.summary);
    lines.push('');
    for (const item of rel.changes) {
      const catLabel = CHANGELOG_CATEGORY_META[item.category].label;
      lines.push(`- **[${catLabel}] ${item.title}**: ${item.description}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
