import { test } from 'node:test';
import assert from 'node:assert';
import {
  computeSidebarMetrics,
  filterSidebarGroups,
  resolveSidebarShortcut,
  sanitizeSidebarGroupOrder,
  orderSidebarGroups,
  moveSidebarGroupOrder,
  sanitizeSidebarGroupItems,
  sanitizeSidebarGroupLabels,
  sanitizeSidebarItemLabels,
  resolveTabBreadcrumb,
  applySidebarCustomization,
  moveSidebarItemByDrag,
  moveSidebarItemStep,
} from './sidebarEngine';
import { calculateBillsSummary, evaluateBillDueStatus } from './calculations';
import { createInitialAppData } from './defaults';

test('computeSidebarMetrics calculates accurate counts from AppData and handles null gracefully', () => {
  const emptyMetrics = computeSidebarMetrics(null, '2026-10-26');
  assert.strictEqual(emptyMetrics.timelineCount, 0);
  assert.strictEqual(emptyMetrics.totalRecordsCount, 0);
  assert.strictEqual(emptyMetrics.activeGoalsCount, 0);

  const cleanData = createInitialAppData('Axiom Aegis', 'Operator');
  const cleanMetrics = computeSidebarMetrics(cleanData, '2026-10-26');
  assert.strictEqual(cleanMetrics.totalRecordsCount, 0);
  assert.strictEqual(cleanMetrics.calendarDaysCount, 0);

  const sampleData = {
    ...cleanData,
    timeline: [
      {
        id: 't-1',
        title: 'Architecture Review',
        category: 'work',
        date: '2026-10-26',
        startTime: '09:00',
        endTime: '10:30',
        durationMinutes: 90,
        createdAt: 1,
      },
    ],
    bills: [
      {
        id: 'b-1',
        name: 'Fiber Internet',
        amount: 85,
        dueDate: '15',
        frequency: 'monthly' as const,
        category: 'Utilities',
        autoPay: true,
        isPaid: false,
        createdAt: 1,
      },
    ],
  };
  const todayIso = '2026-10-26';
  const metrics = computeSidebarMetrics(sampleData, todayIso);

  assert.strictEqual(metrics.timelineCount, 1);
  assert.strictEqual(metrics.calendarDaysCount, 1);
  assert.strictEqual(metrics.todayTimelineCount, 1);
  assert.strictEqual(metrics.notesCount, 0);
  assert.strictEqual(metrics.frequentEventsCount, 0);
  assert.strictEqual(metrics.lifeStatsCount, 0);
  assert.strictEqual(metrics.distancesCount, 0);
  assert.strictEqual(metrics.billsCount, 1);
  assert.strictEqual(metrics.fundsCount, 1);
  assert.strictEqual(metrics.goalsCount, 0);
  assert.strictEqual(metrics.totalRecordsCount, 2);
});

test('sanitizeSidebarGroupOrder, orderSidebarGroups, and moveSidebarGroupOrder persist custom category ordering', () => {
  assert.deepStrictEqual(sanitizeSidebarGroupOrder(null), [
    'daily_ops',
    'biometrics',
    'wealth',
    'vault_sys',
  ]);

  assert.deepStrictEqual(sanitizeSidebarGroupOrder(['wealth', 'daily_ops']), [
    'wealth',
    'daily_ops',
    'biometrics',
    'vault_sys',
  ]);

  const movedUp = moveSidebarGroupOrder(
    ['daily_ops', 'biometrics', 'wealth', 'vault_sys'],
    'wealth',
    'up'
  );
  assert.deepStrictEqual(movedUp, ['daily_ops', 'wealth', 'biometrics', 'vault_sys']);

  const movedToTop = moveSidebarGroupOrder(movedUp, 'vault_sys', 'daily_ops');
  assert.deepStrictEqual(movedToTop, ['vault_sys', 'daily_ops', 'wealth', 'biometrics']);

  const ordered = orderSidebarGroups(
    [
      { id: 'daily_ops', label: 'Daily' },
      { id: 'biometrics', label: 'Bio' },
      { id: 'wealth', label: 'Wealth' },
      { id: 'vault_sys', label: 'Vault' },
    ],
    movedToTop
  );
  assert.deepStrictEqual(
    ordered.map((g) => g.id),
    ['vault_sys', 'daily_ops', 'wealth', 'biometrics']
  );
});

test('moveSidebarItemByDrag, moveSidebarItemStep, and applySidebarCustomization move subsections within and across categories', () => {
  const initialMap = sanitizeSidebarGroupItems(null);
  assert.deepStrictEqual(initialMap.biometrics, ['nav-lifestats', 'nav-distance']);
  assert.strictEqual(initialMap.vault_sys.includes('nav-gallery'), true);

  // 1. Drag 'nav-lifestats' (Life Statistics) directly onto 'vault_sys' (Vault & System) category header
  const afterDragToVault = moveSidebarItemByDrag(initialMap, 'nav-lifestats', {
    type: 'group',
    targetGroupId: 'vault_sys',
  });
  assert.strictEqual(afterDragToVault.biometrics.includes('nav-lifestats'), false);
  assert.strictEqual(afterDragToVault.vault_sys.includes('nav-lifestats'), true);

  // 2. Drag 'nav-gallery' (Private Gallery) onto 'nav-calendar' inside 'daily_ops'
  const afterDragGalleryToDaily = moveSidebarItemByDrag(afterDragToVault, 'nav-gallery', {
    type: 'item',
    targetItemId: 'nav-calendar',
  });
  assert.strictEqual(afterDragGalleryToDaily.daily_ops[0], 'nav-gallery');
  assert.strictEqual(afterDragGalleryToDaily.vault_sys.includes('nav-gallery'), false);

  // 3. Step 'nav-distance' (now the only item in 'biometrics') up into 'daily_ops'
  const afterStepAcrossGroup = moveSidebarItemStep(
    afterDragGalleryToDaily,
    ['daily_ops', 'biometrics', 'wealth', 'vault_sys'],
    'nav-distance',
    'up'
  );
  assert.strictEqual(afterStepAcrossGroup.biometrics.length, 0);
  assert.strictEqual(
    afterStepAcrossGroup.daily_ops[afterStepAcrossGroup.daily_ops.length - 1],
    'nav-distance'
  );

  // 4. Verify applySidebarCustomization builds groups with the exact cross-category item placement
  const sampleGroups = [
    {
      id: 'daily_ops',
      label: 'Daily Operations',
      items: [
        { id: 'nav-calendar', label: 'Calendar & Timeline' },
        { id: 'nav-notes', label: 'Daily Notes' },
        { id: 'nav-frequent-events', label: 'Frequent Events' },
      ],
    },
    {
      id: 'biometrics',
      label: 'Biometrics & Mobility',
      items: [
        { id: 'nav-lifestats', label: 'Life Statistics' },
        { id: 'nav-distance', label: 'Distance Tracker' },
      ],
    },
    {
      id: 'wealth',
      label: 'Wealth & Strategy',
      items: [
        { id: 'nav-funds', label: 'Funds Ledger' },
        { id: 'nav-goals', label: 'Strategic Goals' },
      ],
    },
    {
      id: 'vault_sys',
      label: 'Vault & System',
      items: [
        { id: 'nav-gallery', label: 'Private Gallery' },
        { id: 'nav-settings', label: 'Settings' },
      ],
    },
  ];
  const customized = applySidebarCustomization(
    sampleGroups,
    ['daily_ops', 'biometrics', 'wealth', 'vault_sys'],
    afterStepAcrossGroup,
    { daily_ops: 'Tactical Operations' },
    { 'nav-distance': 'Vector Telemetry' }
  );
  assert.deepStrictEqual(
    customized.find((g) => g.id === 'daily_ops')?.items.map((i) => i.id),
    ['nav-gallery', 'nav-calendar', 'nav-notes', 'nav-frequent-events', 'nav-distance']
  );
  assert.strictEqual(
    customized.find((g) => g.id === 'daily_ops')?.label,
    'Tactical Operations'
  );
  assert.strictEqual(
    customized
      .find((g) => g.id === 'daily_ops')
      ?.items.find((i) => i.id === 'nav-distance')?.label,
    'Vector Telemetry'
  );
  assert.deepStrictEqual(
    customized.find((g) => g.id === 'biometrics')?.items.map((i) => i.id),
    []
  );
  assert.deepStrictEqual(
    customized.find((g) => g.id === 'vault_sys')?.items.map((i) => i.id),
    ['nav-settings', 'nav-lifestats']
  );

  // 5. Verify resolveTabBreadcrumb uses custom category and subsection labels
  const crumb = resolveTabBreadcrumb(
    'distance',
    afterStepAcrossGroup,
    { daily_ops: 'Tactical Operations' },
    { 'nav-distance': 'Vector Telemetry' }
  );
  assert.deepStrictEqual(crumb, {
    group: 'Tactical Operations',
    title: 'Vector Telemetry',
  });
});

test('sanitizeSidebarGroupLabels and sanitizeSidebarItemLabels sanitize and preserve custom labels', () => {
  const groupLabels = sanitizeSidebarGroupLabels({
    daily_ops: '  <b>Mission Control</b>  ',
    biometrics: '   ',
  });
  assert.strictEqual(groupLabels.daily_ops, 'Mission Control');
  assert.strictEqual(groupLabels.biometrics, 'Biometrics & Mobility');

  const itemLabels = sanitizeSidebarItemLabels({
    'nav-distance': '  Route & Range Log  ',
    'nav-notes': '',
  });
  assert.strictEqual(itemLabels['nav-distance'], 'Route & Range Log');
  assert.strictEqual(itemLabels['nav-notes'], 'Notes');
});

test('calculateBillsSummary and evaluateBillDueStatus compute monthly obligations and due statuses accurately', () => {
  const bills = [
    {
      id: 'b1',
      name: 'Apartment Rent',
      amount: 1800,
      dueDate: '1',
      frequency: 'monthly' as const,
      category: 'Housing',
      autoPay: true,
      isPaid: true,
      createdAt: 1,
    },
    {
      id: 'b2',
      name: 'Electric Utility',
      amount: 120,
      dueDate: '10',
      frequency: 'monthly' as const,
      category: 'Utilities',
      autoPay: false,
      isPaid: false,
      createdAt: 2,
    },
    {
      id: 'b3',
      name: 'Cloud Server',
      amount: 45,
      dueDate: '18',
      frequency: 'monthly' as const,
      category: 'Tech',
      autoPay: true,
      isPaid: false,
      createdAt: 3,
    },
  ];

  const summary = calculateBillsSummary(bills, '2026-10-15');
  assert.strictEqual(summary.totalMonthlyBills, 1965);
  assert.strictEqual(summary.paidAmount, 1800);
  assert.strictEqual(summary.unpaidAmount, 165);
  assert.strictEqual(summary.paidCount, 1);
  assert.strictEqual(summary.unpaidCount, 2);
  assert.strictEqual(summary.overdueCount, 1);
  assert.strictEqual(summary.dueSoonCount, 1);
  assert.strictEqual(summary.autoPayCount, 2);

  assert.strictEqual(evaluateBillDueStatus(bills[0], '2026-10-15').status, 'paid');
  assert.strictEqual(evaluateBillDueStatus(bills[1], '2026-10-15').status, 'overdue');
  assert.strictEqual(evaluateBillDueStatus(bills[2], '2026-10-15').status, 'due_soon');
});

test('filterSidebarGroups filters by item label, keyword, or group title', () => {
  const groups = [
    {
      id: 'daily_ops',
      label: 'Daily Operations',
      items: [
        { id: 'nav-timeline', label: 'Daily Timeline', keywords: ['schedule', 'events'] },
        { id: 'nav-calendar', label: 'Calendar', keywords: ['month', 'agenda', 'schedule'] },
        { id: 'nav-notes', label: 'Daily Notes', keywords: ['journal', 'markdown'] },
      ],
    },
    {
      id: 'wealth',
      label: 'Wealth & Strategy',
      items: [
        { id: 'nav-funds', label: 'Funds Ledger', keywords: ['finance', 'bank', 'budget'] },
        { id: 'nav-goals', label: 'Strategic Goals', keywords: ['milestones', 'targets'] },
      ],
    },
  ];

  // Empty query returns all groups
  assert.strictEqual(filterSidebarGroups(groups, '   ').length, 2);

  // Query matching item keyword 'markdown' returns only Daily Operations -> Daily Notes
  const byKeyword = filterSidebarGroups(groups, 'markdown');
  assert.strictEqual(byKeyword.length, 1);
  assert.strictEqual(byKeyword[0].id, 'daily_ops');
  assert.strictEqual(byKeyword[0].items.length, 1);
  assert.strictEqual(byKeyword[0].items[0].id, 'nav-notes');

  // Query matching group label 'Wealth' preserves all items in that group
  const byGroup = filterSidebarGroups(groups, 'wealth');
  assert.strictEqual(byGroup.length, 1);
  assert.strictEqual(byGroup[0].id, 'wealth');
  assert.strictEqual(byGroup[0].items.length, 2);

  // Non-matching query returns empty array
  assert.strictEqual(filterSidebarGroups(groups, 'nonexistent-xyz').length, 0);
});

test('resolveSidebarShortcut maps Alt+0..9, Alt+C, and bracket collapse toggle while ignoring editable inputs', () => {
  assert.deepStrictEqual(
    resolveSidebarShortcut({ key: '1', altKey: true }, false),
    { type: 'tab', tab: 'dashboard' }
  );
  assert.deepStrictEqual(
    resolveSidebarShortcut({ key: '0', altKey: true }, false),
    { type: 'tab', tab: 'calendar' }
  );
  assert.deepStrictEqual(
    resolveSidebarShortcut({ key: 'c', altKey: true }, false),
    { type: 'tab', tab: 'calendar' }
  );
  assert.deepStrictEqual(
    resolveSidebarShortcut({ key: '6', altKey: true }, false),
    { type: 'tab', tab: 'funds' }
  );
  assert.deepStrictEqual(
    resolveSidebarShortcut({ key: '9', altKey: true }, false),
    { type: 'tab', tab: 'settings' }
  );
  assert.deepStrictEqual(
    resolveSidebarShortcut({ key: '[', altKey: false }, false),
    { type: 'toggle-collapse' }
  );

  // Ignored when inside an editable input
  assert.strictEqual(
    resolveSidebarShortcut({ key: '1', altKey: true }, true),
    null
  );
  assert.strictEqual(
    resolveSidebarShortcut({ key: '[', altKey: false }, true),
    null
  );
});

test('evaluateBillDueStatus handles edge-case dates: 31st of the month in 28/29/30-day months and leap years', () => {
  const billOn31st = {
    dueDate: '31st',
    isPaid: false,
    frequency: 'monthly' as const,
  };
  const billOn29th = {
    dueDate: '29th',
    isPaid: false,
    frequency: 'monthly' as const,
  };

  // Non-leap year February 2026 (28 days): a bill set on the 31st clamps to Feb 28 (0 days until due on 2026-02-28)
  const febNonLeapEval = evaluateBillDueStatus(billOn31st, '2026-02-28');
  assert.strictEqual(febNonLeapEval.daysUntilDue, 0);
  assert.strictEqual(febNonLeapEval.status, 'due_soon');

  // Leap year February 2024 (29 days): on 2024-02-28, a bill set on the 29th or 31st is 1 day until due (Feb 29)
  const febLeap29Eval = evaluateBillDueStatus(billOn29th, '2024-02-28');
  assert.strictEqual(febLeap29Eval.daysUntilDue, 1);
  assert.strictEqual(febLeap29Eval.status, 'due_soon');

  const febLeap31Eval = evaluateBillDueStatus(billOn31st, '2024-02-28');
  assert.strictEqual(febLeap31Eval.daysUntilDue, 1);
  assert.strictEqual(febLeap31Eval.status, 'due_soon');

  // 30-day month April 2026: on 2026-04-30, a bill set on the 31st clamps to April 30 (0 days until due)
  const apr30Eval = evaluateBillDueStatus(billOn31st, '2026-04-30');
  assert.strictEqual(apr30Eval.daysUntilDue, 0);
  assert.strictEqual(apr30Eval.status, 'due_soon');

  // Explicit ISO date clamping: '2026-02-29' in non-leap year clamps to '2026-02-28'
  const isoNonLeapEval = evaluateBillDueStatus(
    { dueDate: '2026-02-29', isPaid: false, frequency: 'once' },
    '2026-02-28'
  );
  assert.strictEqual(isoNonLeapEval.formattedDueDate, '2026-02-28');
  assert.strictEqual(isoNonLeapEval.daysUntilDue, 0);
});

test('Full workspace snapshot export/import serialization and custom sidebar label persistence roundtrip', async () => {
  const { validateAndSanitizeAppData } = await import('./matrixLayoutEngine');
  const { buildAccountSnapshotJson, parseAccountSnapshotJson } = await import('./cloudSyncEngine');
  const { createInitialAppData } = await import('./defaults');

  const initial = createInitialAppData('Axiom Aegis', 'Axiom Creator');
  const customizedData = validateAndSanitizeAppData({
    ...initial,
    bills: [
      {
        id: 'bill-edge-31',
        name: 'Starlink Satellite Link',
        amount: 120,
        dueDate: '31',
        frequency: 'monthly',
        category: 'Utilities',
        autoPay: true,
        isPaid: false,
        createdAt: 1700000000000,
      },
    ],
    dailyNotes: [
      {
        id: 'note-ops-1',
        date: '2026-11-01',
        title: 'Production Audit Log',
        content: 'Verified immediate note persistence and full snapshot serialization.',
        tags: ['audit', 'v2'],
        mood: 9,
        isPinned: true,
        createdAt: 1700000000000,
        updatedAt: 1700000005000,
      },
    ],
    settings: {
      ...initial.settings,
      sidebarGroupOrder: ['wealth', 'daily_ops', 'biometrics', 'vault_sys'],
      sidebarGroupItems: {
        wealth: ['nav-funds', 'nav-goals', 'nav-distance'],
        daily_ops: ['nav-calendar', 'nav-notes', 'nav-frequent-events'],
        biometrics: ['nav-lifestats'],
        vault_sys: ['nav-gallery', 'nav-customization', 'nav-settings'],
      },
      sidebarGroupLabels: {
        wealth: 'Capital & Strategy',
        daily_ops: 'Tactical Ops',
      },
      sidebarItemLabels: {
        'nav-funds': 'Treasury & Bills',
        'nav-distance': 'Range Telemetry',
      },
    },
  });

  // Export to Account Snapshot JSON
  const exportedJson = buildAccountSnapshotJson(
    'axiomdk99@gmail.com',
    'Axiom Creator',
    customizedData
  );

  // Import and sanitize back
  const parsedSnap = parseAccountSnapshotJson(exportedJson);
  assert.ok(parsedSnap, 'Snapshot JSON should parse cleanly');
  assert.strictEqual(parsedSnap?.username, 'axiomdk99@gmail.com');

  const restored = validateAndSanitizeAppData(parsedSnap?.workspaceData);
  assert.strictEqual(restored.bills?.length, 1);
  assert.strictEqual(restored.bills?.[0].name, 'Starlink Satellite Link');
  assert.strictEqual(restored.bills?.[0].dueDate, '31');
  assert.strictEqual(restored.dailyNotes?.length, 1);
  assert.strictEqual(restored.dailyNotes?.[0].title, 'Production Audit Log');
  assert.deepStrictEqual(restored.settings.sidebarGroupOrder, [
    'wealth',
    'daily_ops',
    'biometrics',
    'vault_sys',
  ]);
  assert.strictEqual(restored.settings.sidebarGroupLabels?.wealth, 'Capital & Strategy');
  assert.strictEqual(restored.settings.sidebarItemLabels?.['nav-funds'], 'Treasury & Bills');
  assert.strictEqual(restored.settings.sidebarItemLabels?.['nav-distance'], 'Range Telemetry');
  assert.ok(restored.settings.sidebarGroupItems?.wealth.includes('nav-distance'));
});

test('Admin-Only category access control, Site Improvements helpers, and dynamic Custom Categories persistence', async () => {
  const {
    isAdminOnlyTab,
    isAdminOnlySidebarItem,
    enforceTabAccessGuard,
    filterSidebarGroupsByAdminAccess,
    cycleSiteImprovementStatus,
    formatSiteImprovementsAsPrompt,
  } = await import('./sidebarEngine');
  const { validateAndSanitizeAppData } = await import('./matrixLayoutEngine');

  const sampleCustomCategories = [
    {
      id: 'custom_cat_system_logs',
      name: 'System Logs',
      visibility: 'admin_only' as const,
      parentGroupId: 'vault_sys',
      order: 0,
      notes: 'Internal kernel logs',
      checklist: [{ id: 'c1', text: 'Audit logs', completed: true }],
      statusCards: [{ id: 's1', title: 'Uptime', value: '99.99%', status: 'Nominal' }],
      createdAt: 1000,
      updatedAt: 2000,
    },
    {
      id: 'custom_cat_team_wiki',
      name: 'Shared Field Manual',
      visibility: 'all_users' as const,
      parentGroupId: 'daily_ops',
      order: 1,
      notes: 'Public operations guide',
      checklist: [],
      statusCards: [],
      createdAt: 1000,
      updatedAt: 2000,
    },
  ];

  // 1. Verify isAdminOnlyTab & isAdminOnlySidebarItem
  assert.strictEqual(isAdminOnlyTab('admin', sampleCustomCategories), true);
  assert.strictEqual(isAdminOnlyTab('site_improvements', sampleCustomCategories), true);
  assert.strictEqual(
    isAdminOnlyTab('custom_cat_system_logs', sampleCustomCategories),
    true
  );
  assert.strictEqual(
    isAdminOnlyTab('custom_cat_team_wiki', sampleCustomCategories),
    false
  );
  assert.strictEqual(isAdminOnlyTab('dashboard', sampleCustomCategories), false);

  assert.strictEqual(
    isAdminOnlySidebarItem('nav-site-improvements', sampleCustomCategories),
    true
  );
  assert.strictEqual(
    isAdminOnlySidebarItem('nav-master-admin', sampleCustomCategories),
    true
  );
  assert.strictEqual(
    isAdminOnlySidebarItem('nav-custom-custom_cat_system_logs', sampleCustomCategories),
    true
  );
  assert.strictEqual(
    isAdminOnlySidebarItem('nav-custom-custom_cat_team_wiki', sampleCustomCategories),
    false
  );

  // 2. Verify enforceTabAccessGuard redirects non-admins away from Admin-only views
  assert.strictEqual(
    enforceTabAccessGuard('site_improvements', false, sampleCustomCategories),
    'dashboard'
  );
  assert.strictEqual(
    enforceTabAccessGuard('admin', false, sampleCustomCategories),
    'dashboard'
  );
  assert.strictEqual(
    enforceTabAccessGuard('custom_cat_system_logs', false, sampleCustomCategories),
    'dashboard'
  );
  assert.strictEqual(
    enforceTabAccessGuard('custom_cat_team_wiki', false, sampleCustomCategories),
    'custom_cat_team_wiki'
  );
  assert.strictEqual(
    enforceTabAccessGuard('site_improvements', true, sampleCustomCategories),
    'site_improvements'
  );
  assert.strictEqual(
    enforceTabAccessGuard('custom_cat_system_logs', true, sampleCustomCategories),
    'custom_cat_system_logs'
  );

  // 3. Verify filterSidebarGroupsByAdminAccess strips Admin-only items for User/VIP
  const mockGroups = [
    {
      id: 'daily_ops',
      label: 'Daily Operations',
      items: [
        { id: 'nav-calendar', label: 'Calendar & Timeline' },
        { id: 'nav-custom-custom_cat_team_wiki', label: 'Shared Field Manual' },
      ],
    },
    {
      id: 'vault_sys',
      label: 'Vault & System',
      items: [
        { id: 'nav-settings', label: 'Settings' },
        { id: 'nav-site-improvements', label: 'Site Improvements', adminOnly: true },
        { id: 'nav-master-admin', label: 'Master Admin Overseer', adminOnly: true },
        {
          id: 'nav-custom-custom_cat_system_logs',
          label: 'System Logs',
          adminOnly: true,
        },
      ],
    },
  ];

  const userGroups = filterSidebarGroupsByAdminAccess(
    mockGroups,
    false,
    sampleCustomCategories
  );
  assert.deepStrictEqual(
    userGroups.find((g) => g.id === 'vault_sys')?.items.map((i) => i.id),
    ['nav-settings']
  );
  assert.deepStrictEqual(
    userGroups.find((g) => g.id === 'daily_ops')?.items.map((i) => i.id),
    ['nav-calendar', 'nav-custom-custom_cat_team_wiki']
  );

  const adminGroups = filterSidebarGroupsByAdminAccess(
    mockGroups,
    true,
    sampleCustomCategories
  );
  assert.strictEqual(
    adminGroups.find((g) => g.id === 'vault_sys')?.items.length,
    4
  );

  // 4. Verify cycleSiteImprovementStatus & formatSiteImprovementsAsPrompt
  assert.strictEqual(cycleSiteImprovementStatus('Idea'), 'Planned');
  assert.strictEqual(cycleSiteImprovementStatus('Planned'), 'In Progress');
  assert.strictEqual(cycleSiteImprovementStatus('In Progress'), 'Completed');
  assert.strictEqual(cycleSiteImprovementStatus('Completed'), 'Idea');

  const promptText = formatSiteImprovementsAsPrompt([
    {
      id: 'imp-1',
      title: 'Add Keyboard Shortcut for Bottom Dock Toggle',
      categoryTag: 'Sidebar & Navigation',
      priority: 'High',
      status: 'Planned',
      notes: 'Bind Alt+B to toggle Left Sidebar vs Bottom Bar layout.',
      createdAt: 1000,
      updatedAt: 2000,
    },
  ]);
  assert.ok(promptText.includes('Add Keyboard Shortcut for Bottom Dock Toggle'));
  assert.ok(promptText.includes('**Priority:** High'));
  assert.ok(promptText.includes('Bind Alt+B to toggle Left Sidebar vs Bottom Bar layout.'));

  const batchPromptText = formatSiteImprovementsAsPrompt([
    {
      id: 'imp-1',
      title: 'Add Keyboard Shortcut for Bottom Dock Toggle',
      categoryTag: 'Sidebar & Navigation',
      priority: 'High',
      status: 'Planned',
      notes: 'Bind Alt+B to toggle Left Sidebar vs Bottom Bar layout.',
      createdAt: 1000,
      updatedAt: 2000,
    },
    {
      id: 'imp-2',
      title: 'Add Custom Admin Sandbox View',
      categoryTag: 'Admin & Security',
      priority: 'Critical',
      status: 'In Progress',
      notes: 'Provide checklist and status cards.',
      createdAt: 1000,
      updatedAt: 2000,
    },
  ]);
  assert.ok(batchPromptText.includes('[HIGH | Sidebar & Navigation]'));
  assert.ok(batchPromptText.includes('[CRITICAL | Admin & Security]'));

  // 5. Verify validateAndSanitizeAppData preserves siteImprovements and customNavCategories
  const sanitized = validateAndSanitizeAppData({
    siteImprovements: [
      {
        id: 'imp-1',
        title: 'Add Keyboard Shortcut for Bottom Dock Toggle',
        categoryTag: 'Sidebar & Navigation',
        priority: 'High',
        status: 'Planned',
        notes: 'Bind Alt+B to toggle Left Sidebar vs Bottom Bar layout.',
        createdAt: 1000,
        updatedAt: 2000,
      },
    ],
    customNavCategories: sampleCustomCategories,
  });
  assert.strictEqual(sanitized.siteImprovements?.length, 1);
  assert.strictEqual(
    sanitized.siteImprovements?.[0].title,
    'Add Keyboard Shortcut for Bottom Dock Toggle'
  );
  assert.strictEqual(sanitized.customNavCategories?.length, 2);
  assert.strictEqual(sanitized.customNavCategories?.[0].visibility, 'admin_only');
  assert.strictEqual(sanitized.customNavCategories?.[1].visibility, 'all_users');

  // 6. Verify custom subsections remain in sidebarGroupItems after validateAndSanitizeAppData
  assert.ok(
    sanitized.settings.layoutConfig?.sidebarGroupItems?.vault_sys?.includes(
      'nav-custom-custom_cat_system_logs'
    )
  );
  assert.ok(
    sanitized.settings.layoutConfig?.sidebarGroupItems?.daily_ops?.includes(
      'nav-custom-custom_cat_team_wiki'
    )
  );

  // 7. Verify personalized default labels and dashboard-only KPI widgets (kpi_funds, kpi_mood, kpi_distance)
  assert.strictEqual(sanitized.settings.layoutConfig?.sidebarGroupLabels?.daily_ops, 'Personal');
  assert.strictEqual(sanitized.settings.layoutConfig?.sidebarItemLabels?.['nav-notes'], 'Notes');
  assert.strictEqual(sanitized.settings.layoutConfig?.sidebarItemLabels?.['nav-frequent-events'], 'Quick Add');
  assert.strictEqual(sanitized.settings.layoutConfig?.sidebarItemLabels?.['nav-lifestats'], 'Life Stats');
  assert.strictEqual(sanitized.settings.layoutConfig?.sidebarItemLabels?.['nav-distance'], 'Distance');
  assert.strictEqual(sanitized.settings.layoutConfig?.sidebarItemLabels?.['nav-funds'], 'Funds');
  assert.strictEqual(sanitized.settings.layoutConfig?.sidebarItemLabels?.['nav-calendar'], 'Calendar');
  assert.strictEqual(sanitized.settings.layoutConfig?.sidebarItemLabels?.['nav-import-hub'], 'Import');
  assert.strictEqual(sanitized.settings.layoutConfig?.sidebarItemLabels?.['nav-changelog'], 'Changelog');

  const kpiFunds = sanitized.settings.dashboardWidgets?.find((w) => w.id === 'kpi_funds');
  const kpiMood = sanitized.settings.dashboardWidgets?.find((w) => w.id === 'kpi_mood');
  const kpiDistance = sanitized.settings.dashboardWidgets?.find((w) => w.id === 'kpi_distance');
  assert.strictEqual(kpiFunds?.visible, true);
  assert.strictEqual(kpiMood?.visible, true);
  assert.strictEqual(kpiDistance?.visible, true);
});
