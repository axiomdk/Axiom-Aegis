import { test } from 'node:test';
import assert from 'node:assert';
import {
  MATRIX_GRID_COLUMNS,
  canMoveInMatrix,
  moveCardInMatrix,
  dragReorderInMatrix,
  sanitizeColumnTitle,
  updateMatrixCardTitle,
  updateMatrixCardSpan,
  toggleMatrixCardVisibility,
  createCustomMatrixColumn,
  isValidMatrixLayout,
  sanitizeLayoutConfig,
  getColSpanClass,
  sanitizeTextInput,
  validateAndSanitizeAppData,
  loadAppDataFromLocalStorage,
  calculateHabitStreak,
  sanitizeCustomFields,
  runCleanSlateMigrationV1101,
  CLEAN_SLATE_MIGRATION_KEY,
} from './matrixLayoutEngine';
import { DashboardWidgetConfig } from '../types';
import { DEFAULT_DASHBOARD_WIDGETS, DEFAULT_LAYOUT_CONFIG } from './defaults';

const SAMPLE_MATRIX: DashboardWidgetConfig[] = [
  { id: 'timeline_today', visible: true, colSpan: 1, order: 0, customTitle: 'Daily Timeline' },
  { id: 'aegis_visualizer', visible: true, colSpan: 1, order: 1, customTitle: 'AEGIS CORE // QUANTUM SHIELD VIZ' },
  { id: 'funds_recent', visible: true, colSpan: 1, order: 2, customTitle: 'Expense Tracker' },
  { id: 'short_term_goals', visible: true, colSpan: 1, order: 3, customTitle: 'Short-Term Goals' },
  { id: 'goals_preview', visible: true, colSpan: 1, order: 4, customTitle: 'Goals & Milestones' },
  { id: 'gallery_preview', visible: true, colSpan: 1, order: 5, customTitle: 'Private Encrypted Gallery' },
];

test('2D Matrix Engine: All 15 default modules (8 visible Operational Panels, excluding dice_roller, timeline_today, and kpi_focus) are registered and de-duplicated by default', () => {
  assert.strictEqual(MATRIX_GRID_COLUMNS, 3);
  assert.strictEqual(DEFAULT_DASHBOARD_WIDGETS.length, 15);
  const visiblePanels = DEFAULT_DASHBOARD_WIDGETS.filter(
    (w) => w.visible && !w.id.startsWith('kpi_')
  );
  assert.strictEqual(visiblePanels.length, 8);
  const ids = DEFAULT_DASHBOARD_WIDGETS.map((w) => w.id);
  assert.ok(!ids.includes('timeline_today'));
  assert.ok(!ids.includes('kpi_focus'));
  assert.ok(!ids.includes('dice_roller'));
  assert.ok(ids.includes('mini_calendar'));
  assert.ok(ids.includes('aegis_visualizer'));
  assert.ok(ids.includes('funds_recent'));
  assert.ok(ids.includes('life_stats_panel'));
  assert.ok(ids.includes('distance_panel'));
  assert.ok(ids.includes('short_term_goals'));
  assert.ok(ids.includes('goals_preview'));
  assert.ok(ids.includes('weather'));
  assert.ok(ids.includes('daily_notes'));
  assert.ok(ids.includes('frequent_events'));
  assert.ok(ids.includes('kpi_funds'));

  // Verify de-duplication defaults: life_stats_panel, distance_panel, quick_capture, short_term_goals are hidden by default
  assert.strictEqual(DEFAULT_DASHBOARD_WIDGETS.find((w) => w.id === 'life_stats_panel')?.visible, false);
  assert.strictEqual(DEFAULT_DASHBOARD_WIDGETS.find((w) => w.id === 'distance_panel')?.visible, false);
  assert.strictEqual(DEFAULT_DASHBOARD_WIDGETS.find((w) => w.id === 'quick_capture')?.visible, false);
  assert.strictEqual(DEFAULT_DASHBOARD_WIDGETS.find((w) => w.id === 'short_term_goals')?.visible, false);
  assert.strictEqual(DEFAULT_DASHBOARD_WIDGETS.find((w) => w.id === 'mini_calendar')?.visible, true);
  assert.strictEqual(DEFAULT_DASHBOARD_WIDGETS.find((w) => w.id === 'goals_preview')?.visible, true);
  assert.strictEqual(DEFAULT_DASHBOARD_WIDGETS.find((w) => w.id === 'daily_notes')?.visible, true);
  assert.strictEqual(DEFAULT_DASHBOARD_WIDGETS.find((w) => w.id === 'frequent_events')?.visible, true);
});

test('2D Matrix Engine: Left and Right swap linear index positions (+/- 1)', () => {
  const movedRight = moveCardInMatrix(SAMPLE_MATRIX, 0, 'right');
  assert.strictEqual(movedRight[0].id, 'aegis_visualizer');
  assert.strictEqual(movedRight[1].id, 'timeline_today');
  assert.strictEqual(movedRight[0].order, 0);
  assert.strictEqual(movedRight[1].order, 1);

  const movedLeft = moveCardInMatrix(movedRight, 1, 'left');
  assert.strictEqual(movedLeft[0].id, 'timeline_today');
  assert.strictEqual(movedLeft[1].id, 'aegis_visualizer');
});

test('2D Matrix Engine: Up and Down shift vertically across rows (index +/- cols)', () => {
  const movedDown = moveCardInMatrix(SAMPLE_MATRIX, 0, 'down', 3);
  assert.strictEqual(movedDown[0].id, 'short_term_goals');
  assert.strictEqual(movedDown[3].id, 'timeline_today');

  const movedUp = moveCardInMatrix(movedDown, 4, 'up', 3);
  assert.strictEqual(movedUp[1].id, 'goals_preview');
  assert.strictEqual(movedUp[4].id, 'aegis_visualizer');
});

test('2D Matrix Engine: Drag-and-Drop reordering works across any indices', () => {
  const dragged = dragReorderInMatrix(SAMPLE_MATRIX, 5, 0);
  assert.strictEqual(dragged[0].id, 'gallery_preview');
  assert.strictEqual(dragged[1].id, 'timeline_today');
  assert.strictEqual(dragged[0].order, 0);
});

test('2D Matrix Engine: Width span updates (1x, 2x, 3x, full) and 5-Template Custom Panel creation', () => {
  const resized = updateMatrixCardSpan(SAMPLE_MATRIX, 'timeline_today', 2);
  assert.strictEqual(resized[0].colSpan, 2);
  assert.ok(getColSpanClass(2, 3).includes('lg:col-span-2'));
  assert.ok(getColSpanClass('full', 3).includes('lg:col-span-full'));

  // 1. Checklist panel
  const withChecklist = createCustomMatrixColumn(resized, '  <b>Sprint Ops</b>  ', 1, 'checklist', 'emerald');
  assert.strictEqual(withChecklist.length, 7);
  assert.strictEqual(withChecklist[6].customTitle, 'Sprint Ops');
  assert.strictEqual(withChecklist[6].isCustom, true);
  assert.strictEqual(withChecklist[6].panelType, 'checklist');
  assert.strictEqual(withChecklist[6].panelColor, 'emerald');

  // 2. Counter panel
  const withCounter = createCustomMatrixColumn(withChecklist, 'Deep Work Counter', 1, 'counter', 'cyan');
  const counterPanel = withCounter[7];
  assert.strictEqual(counterPanel.panelType, 'counter');
  assert.strictEqual(counterPanel.panelColor, 'cyan');
  assert.ok(counterPanel.customCounter);
  assert.strictEqual(counterPanel.customCounter?.targetValue, 8);

  // 3. Habits panel & Streak Calculation
  const withHabits = createCustomMatrixColumn(withCounter, 'Daily Habits', 2, 'habits', 'violet');
  const habitsPanel = withHabits[8];
  assert.strictEqual(habitsPanel.panelType, 'habits');
  assert.ok((habitsPanel.customHabits || []).length >= 2);
  assert.strictEqual(
    calculateHabitStreak(['2026-10-20', '2026-10-21', '2026-10-22'], '2026-10-22'),
    3
  );

  // 4. Key-Value panel
  const withKV = createCustomMatrixColumn(withHabits, 'Protocol Reference', 1, 'key_value', 'amber');
  const kvPanel = withKV[9];
  assert.strictEqual(kvPanel.panelType, 'key_value');
  assert.ok((kvPanel.customKeyValues || []).length >= 2);

  // 5. Notes panel
  const withNotes = createCustomMatrixColumn(withKV, 'Encrypted Scratchpad', 1, 'notes', 'rose');
  assert.strictEqual(withNotes[10].panelType, 'notes');

  const toggled = toggleMatrixCardVisibility(withNotes, 'aegis_visualizer');
  assert.strictEqual(toggled.find((w) => w.id === 'aegis_visualizer')?.visible, false);
});

test('2D Matrix Engine: Boundary checks block out-of-range moves', () => {
  assert.strictEqual(canMoveInMatrix(0, 6, 'left'), false);
  assert.strictEqual(canMoveInMatrix(0, 6, 'up'), false);
  assert.strictEqual(canMoveInMatrix(0, 6, 'right'), true);
  assert.strictEqual(canMoveInMatrix(0, 6, 'down'), true);
});

test('2D Matrix Engine: sanitizeColumnTitle & sanitizeLayoutConfig validate state safely', () => {
  assert.strictEqual(
    sanitizeColumnTitle('  <script>alert(1)</script>Tactical Ops  ', 'Daily Timeline'),
    'alert(1)Tactical Ops'
  );
  assert.strictEqual(sanitizeColumnTitle('   ', 'Expense Tracker'), 'Expense Tracker');

  const updated = updateMatrixCardTitle(SAMPLE_MATRIX, 'funds_recent', '   Sovereign Expense Ledger  ');
  const target = updated.find((w) => w.id === 'funds_recent');
  assert.ok(target);
  assert.strictEqual(target.customTitle, 'Sovereign Expense Ledger');
  assert.strictEqual(isValidMatrixLayout(updated), true);

  const sanitizedConfig = sanitizeLayoutConfig({
    gridColumns: 4,
    pageWidth: 'full',
    fontScale: 1.1,
    density: 'spacious',
    layoutVersion: 4,
    widgets: updated,
    customTimelineColumns: [{ id: 'cf_t_1', label: '<b>Project</b>', type: 'text' }],
  });
  assert.strictEqual(sanitizedConfig.gridColumns, 4);
  assert.strictEqual(sanitizedConfig.pageWidth, 'full');
  assert.strictEqual(sanitizedConfig.fontScale, 1.1);
  assert.strictEqual(sanitizedConfig.density, 'spacious');
  assert.strictEqual(sanitizedConfig.customTimelineColumns?.[0].label, 'Project');
  assert.strictEqual(
    sanitizeLayoutConfig(null, DEFAULT_LAYOUT_CONFIG).pageWidth,
    DEFAULT_LAYOUT_CONFIG.pageWidth
  );
});

test('Data Integrity Engine: sanitizeTextInput, sanitizeCustomFields, validateAndSanitizeAppData, and loadAppDataFromLocalStorage handle state safely', () => {
  assert.strictEqual(sanitizeTextInput('  <b>Clean Entry</b>  ', 'Fallback'), 'Clean Entry');
  assert.strictEqual(sanitizeTextInput('   ', 'Fallback'), 'Fallback');

  const fields = sanitizeCustomFields({
    cf_1: '  <script>Client A</script>  ',
    cf_2: 'Tax Deductible',
  });
  assert.strictEqual(fields?.cf_1, 'Client A');
  assert.strictEqual(fields?.cf_2, 'Tax Deductible');

  const fallbackState = validateAndSanitizeAppData(null);
  assert.strictEqual(fallbackState.timeline.length, 0);
  assert.strictEqual(fallbackState.funds.length, 0);
  assert.strictEqual(fallbackState.goals.length, 0);
  assert.strictEqual(fallbackState.distances.length, 0);
  assert.strictEqual(fallbackState.lifeStats.length, 0);
  assert.strictEqual(fallbackState.dailyNotes?.length, 0);
  assert.strictEqual(fallbackState.frequentEvents?.length, 0);
  assert.strictEqual(fallbackState.gallery.length, 0);
  assert.strictEqual(fallbackState.settings.startingBalance, 0);
  assert.strictEqual(fallbackState.settings.userName, 'User');
  assert.strictEqual(fallbackState.settings.weatherLocation, '');
  assert.strictEqual(fallbackState.settings.appName, 'Axiom Aegis');
  assert.strictEqual(fallbackState.settings.appShortName, 'AA');

  // Verify runCleanSlateMigrationV1101 purges legacy localStorage demo keys once and sets migration flag
  const mockStore = new Map<string, string>([
    ['axioms_dailies_state', '{"funds":[{"id":"f-1"}]}'],
    ['axiom_dailies_encrypted_vault', '{"ciphertext":"abc"}'],
  ]);
  const mockStorage = {
    getItem: (k: string) => mockStore.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mockStore.set(k, v);
    },
    removeItem: (k: string) => {
      mockStore.delete(k);
    },
  };
  const didMigrateFirst = runCleanSlateMigrationV1101(mockStorage);
  assert.strictEqual(didMigrateFirst, true);
  assert.strictEqual(mockStore.has('axioms_dailies_state'), false);
  assert.strictEqual(mockStore.has('axiom_dailies_encrypted_vault'), false);
  assert.strictEqual(mockStore.get(CLEAN_SLATE_MIGRATION_KEY), 'true');
  assert.strictEqual(runCleanSlateMigrationV1101(mockStorage), false);

  const customizedState = validateAndSanitizeAppData({
    settings: {
      userName: '  <script>Operator</script>  ',
      appName: '  <b>Personal Command OS</b>  ',
      appShortName: '  <b>PCOS</b>  ',
    },
  });
  assert.strictEqual(customizedState.settings.userName, 'Operator');
  assert.strictEqual(customizedState.settings.appName, 'Personal Command OS');
  assert.strictEqual(customizedState.settings.appShortName, 'PCOS');

  const loaded = loadAppDataFromLocalStorage();
  assert.strictEqual(loaded.settings.userName, 'User');
  assert.strictEqual(loaded.settings.appName, 'Axiom Aegis');
  assert.strictEqual(loaded.settings.appShortName, 'AA');
});

test('Extended 20-Theme Palette & Custom Text Color Override + WCAG Contrast Engine', async () => {
  const {
    CURATED_20_ACCENTS,
    ACCENT_THEMES,
    DARK_PALETTE,
    getContrastRatio,
    evaluateWcagContrast,
    resolveTextColorConfig,
  } = await import('./theme');

  assert.strictEqual(CURATED_20_ACCENTS.length, 20);
  assert.strictEqual(CURATED_20_ACCENTS[0].id, 'aegis_gold');
  assert.strictEqual(CURATED_20_ACCENTS[0].hex, '#E5A93C');
  assert.strictEqual(CURATED_20_ACCENTS[1].id, 'cyber_cyan');
  assert.strictEqual(CURATED_20_ACCENTS[1].hex, '#00E5FF');
  assert.strictEqual(CURATED_20_ACCENTS[19].id, 'ultramarine');
  assert.strictEqual(CURATED_20_ACCENTS[19].hex, '#4F46E5');

  // Verify Pure Flat Black (#000000) Axiom Aegis (AA) palette tokens & surface resolver
  const { resolveSurfaceConfig, DEFAULT_SURFACE_CONFIG } = await import('./theme');
  assert.strictEqual(DARK_PALETTE.canvas, '#000000');
  assert.strictEqual(DARK_PALETTE.secondary, '#000000');
  assert.strictEqual(DARK_PALETTE.sidebar, '#000000');
  assert.strictEqual(DARK_PALETTE.column, '#000000');
  assert.strictEqual(DARK_PALETTE.columnActive, '#000000');
  assert.strictEqual(DARK_PALETTE.columnHeader, '#000000');
  assert.strictEqual(DARK_PALETTE.card, '#000000');
  assert.strictEqual(DARK_PALETTE.cardHover, '#000000');
  assert.strictEqual(DARK_PALETTE.borderSubtle, '#1E222B');
  assert.strictEqual(DARK_PALETTE.borderHeader, '#20242E');
  assert.strictEqual(DARK_PALETTE.borderCard, '#232732');
  assert.strictEqual(DARK_PALETTE.shadowElevated, '0 4px 20px -2px rgba(0, 0, 0, 0.5)');
  assert.strictEqual(DARK_PALETTE.scrollbarTrack, '#000000');
  assert.strictEqual(DARK_PALETTE.scrollbarThumb, '#262A35');
  assert.strictEqual(DARK_PALETTE.scrollbarThumbHover, '#373C4B');
  assert.deepStrictEqual(resolveSurfaceConfig(undefined), DEFAULT_SURFACE_CONFIG);
  assert.strictEqual(DEFAULT_SURFACE_CONFIG.canvasHex, '#000000');
  assert.strictEqual(DEFAULT_SURFACE_CONFIG.columnHex, '#000000');
  assert.strictEqual(DEFAULT_SURFACE_CONFIG.cardHex, '#000000');

  // Verify Crisp White vs #000000 passes AAA
  const crispEval = evaluateWcagContrast('#F8FAFC', DARK_PALETTE.bgCard);
  assert.strictEqual(crispEval.passesAA, true);
  assert.strictEqual(crispEval.level, 'AAA');
  assert.ok(crispEval.ratio >= 15);

  // Verify low contrast dark gray vs #181B24 triggers fail
  const lowEval = evaluateWcagContrast('#22252E', DARK_PALETTE.bgCard);
  assert.strictEqual(lowEval.passesAA, false);
  assert.strictEqual(lowEval.level, 'Fail');

  // Verify Accent Tint dynamically blends active accent hex into legible off-white
  const tinted = resolveTextColorConfig({ preset: 'accent_tint', primaryHex: '', secondaryHex: '' }, '#00E5FF');
  const tintedContrast = getContrastRatio(tinted.primaryHex, DARK_PALETTE.bgCard);
  assert.ok(tintedContrast >= 10, 'Accent tint must maintain high legibility against dark cards');

  // Verify all 20 curated accent keys are accepted by validateAndSanitizeAppData
  for (const theme of CURATED_20_ACCENTS) {
    const state = validateAndSanitizeAppData({
      settings: {
        accentColor: theme.id,
      },
    });
    assert.strictEqual(state.settings.accentColor, theme.id);
    assert.strictEqual(ACCENT_THEMES[state.settings.accentColor].hex, theme.hex);
  }
});

test('Quote of the Day Engine: 30+ quote vault, deterministic daily rotation, shuffle, pin, and custom quote sanitization', async () => {
  const {
    BUILT_IN_QUOTE_VAULT,
    getDailyQuoteIndex,
    resolveActiveQuote,
    cycleToNextQuote,
    togglePinQuote,
    upsertCustomQuote,
    deleteCustomQuote,
  } = await import('./quoteEngine');

  assert.ok(BUILT_IN_QUOTE_VAULT.length >= 30, 'Vault must contain at least 30 curated quotes');

  // Deterministic index for the same date
  const idx1 = getDailyQuoteIndex('2026-10-22', BUILT_IN_QUOTE_VAULT.length);
  const idx2 = getDailyQuoteIndex('2026-10-22', BUILT_IN_QUOTE_VAULT.length);
  assert.strictEqual(idx1, idx2);

  // Shuffle advances to the next quote
  const initialQuote = resolveActiveQuote(undefined, '2026-10-22');
  const { nextState: shuffledState, nextQuote } = cycleToNextQuote(undefined, '2026-10-22');
  assert.notStrictEqual(nextQuote.id, initialQuote.id);
  assert.strictEqual(resolveActiveQuote(shuffledState, '2026-10-22').id, nextQuote.id);

  // Pinning locks the quote across future dates
  const pinnedState = togglePinQuote(shuffledState, '2026-10-22');
  assert.strictEqual(pinnedState.isPinned, true);
  assert.strictEqual(resolveActiveQuote(pinnedState, '2026-10-25').id, nextQuote.id);

  // Custom quote creation and sanitization against HTML tags
  const customResult = upsertCustomQuote(
    pinnedState,
    '  <script>Execute</script> with relentless precision.  ',
    '  <b>Stoic Journal</b>  ',
    '2026-10-22'
  );
  assert.ok(customResult);
  assert.strictEqual(customResult.savedQuote.text, 'Execute with relentless precision.');
  assert.strictEqual(customResult.savedQuote.author, 'Stoic Journal');
  assert.strictEqual(resolveActiveQuote(customResult.nextState, '2026-10-22').text, 'Execute with relentless precision.');

  // Validate persistence inside validateAndSanitizeAppData
  const validatedApp = validateAndSanitizeAppData({
    settings: {
      quoteState: customResult.nextState,
    },
  });
  assert.strictEqual(validatedApp.settings.quoteState?.customQuotes.length, 1);
  assert.strictEqual(
    validatedApp.settings.quoteState?.customQuotes[0].text,
    'Execute with relentless precision.'
  );

  // Deleting custom quote removes it cleanly
  const afterDelete = deleteCustomQuote(customResult.nextState, customResult.savedQuote.id);
  assert.strictEqual(afterDelete.customQuotes.length, 0);
});

test('Category Engine: Inline Category Renaming with Atomic Cascading State Updates & Merge Validation', async () => {
  const { renameCategoryCascading, getCategoriesByDomain } = await import('./categoryEngine');
  const initialData = validateAndSanitizeAppData({
    timeline: [
      {
        id: 't-1',
        title: 'Architecture Review',
        category: 'work',
        date: '2026-10-24',
        startTime: '09:00',
        endTime: '10:30',
        durationMinutes: 90,
        createdAt: 1,
      },
    ],
    frequentEvents: [
      {
        id: 'fe-1',
        title: 'Engineering Block',
        category: 'work',
        durationMinutes: 60,
        startTime: '09:00',
      },
    ],
    funds: [
      {
        id: 'f-1',
        date: '2026-10-24',
        type: 'expense',
        amount: 45,
        category: 'Operations',
        description: 'Cloud Hosting',
        createdAt: 1,
      },
    ],
  });

  // 1. Reject empty/blank category rename (reverts safely)
  const emptyRes = renameCategoryCascading(initialData, 'work', '   ', 'timeline');
  assert.strictEqual(emptyRes.updated, false);
  assert.strictEqual(emptyRes.updatedItemsCount, 0);

  // 2. Rename 'work' -> 'deep_engineering' in timeline domain and verify cascading updates
  const workCountBefore =
    initialData.timeline.filter((t) => t.category === 'work').length +
    (initialData.frequentEvents || []).filter((fe) => fe.category === 'work').length;
  assert.ok(workCountBefore > 0, 'Test data should have work entries');

  const renameRes = renameCategoryCascading(initialData, 'work', 'deep_engineering', 'timeline');
  assert.strictEqual(renameRes.updated, true);
  assert.strictEqual(renameRes.updatedItemsCount, workCountBefore);
  assert.strictEqual(
    renameRes.nextAppData.timeline.filter((t) => t.category === 'work').length,
    0
  );
  assert.ok(
    renameRes.nextAppData.timeline.filter((t) => t.category === 'deep_engineering').length > 0
  );

  // Verify category color and order remained intact
  const updatedTimelineCats = getCategoriesByDomain(renameRes.nextAppData, 'timeline');
  const renamedCatConfig = updatedTimelineCats.find((c) => c.name === 'deep_engineering');
  assert.ok(renamedCatConfig);
  assert.strictEqual(renamedCatConfig?.color, '#10b981');

  // 3. Rename funds category and verify cascading across transactions
  const targetFundCat = initialData.funds[0].category;
  const fundRenameRes = renameCategoryCascading(
    renameRes.nextAppData,
    targetFundCat,
    'Sovereign Ops',
    'funds'
  );
  assert.strictEqual(fundRenameRes.updated, true);
  assert.strictEqual(fundRenameRes.nextAppData.funds[0].category, 'Sovereign Ops');

  // 4. Case-insensitive duplicate merge: renaming 'deep_engineering' into existing 'health' merges cleanly
  const mergeRes = renameCategoryCascading(
    fundRenameRes.nextAppData,
    'deep_engineering',
    'HEALTH',
    'timeline'
  );
  assert.strictEqual(mergeRes.updated, true);
  assert.strictEqual(mergeRes.merged, true);
  assert.strictEqual(
    mergeRes.nextAppData.timeline.filter((t) => t.category === 'deep_engineering').length,
    0
  );
});

test('Frequent Events Quick Add Engine: filterFrequentEvents, createTimelineEntryFromFrequentEvent, upsertFrequentEventTemplate & moveFrequentEventTemplate', async () => {
  const {
    filterFrequentEvents,
    createTimelineEntryFromFrequentEvent,
    upsertFrequentEventTemplate,
    moveFrequentEventTemplate,
    computeEndTimeFromDuration,
  } = await import('./frequentEventsEngine');
  const { DEFAULT_FREQUENT_EVENTS } = await import('./defaults');

  // Verify clean-slate empty default
  assert.strictEqual(DEFAULT_FREQUENT_EVENTS.length, 0);

  assert.strictEqual(computeEndTimeFromDuration('09:00', 120), '11:00');
  assert.strictEqual(computeEndTimeFromDuration('23:30', 60), '00:30');

  const sampleEvents = [
    {
      id: 'fe-1',
      title: 'Morning Engineering Block',
      category: 'work',
      durationMinutes: 120,
      startTime: '09:00',
      endTime: '11:00',
    },
    {
      id: 'fe-2',
      title: 'Outdoor Trail Run',
      category: 'health',
      durationMinutes: 45,
      startTime: '17:00',
      endTime: '17:45',
    },
    {
      id: 'fe-3',
      title: 'Code Review & Sync',
      category: 'work',
      durationMinutes: 30,
      startTime: '14:00',
      endTime: '14:30',
    },
  ];

  // Search and category filtering
  const filteredBySearch = filterFrequentEvents(sampleEvents, 'trail run');
  assert.strictEqual(filteredBySearch.length, 1);
  assert.strictEqual(filteredBySearch[0].id, 'fe-2');

  const filteredByCat = filterFrequentEvents(sampleEvents, '', 'work');
  assert.strictEqual(filteredByCat.length, 2);

  // 1-Click Timeline entry creation
  const refDate = new Date('2026-10-24T14:20:00Z');
  const createdEntry = createTimelineEntryFromFrequentEvent(sampleEvents[0], refDate);
  assert.strictEqual(createdEntry.title, 'Morning Engineering Block');
  assert.strictEqual(createdEntry.category, 'work');
  assert.strictEqual(createdEntry.durationMinutes, 120);
  assert.strictEqual(createdEntry.startTime, '09:00');
  assert.strictEqual(createdEntry.endTime, '11:00');

  // Upsert new template with HTML tag sanitization
  const upserted = upsertFrequentEventTemplate(sampleEvents, {
    title: '  <b>Evening Architecture Audit</b>  ',
    category: 'learning',
    durationMinutes: 90,
    startTime: '19:00',
    notes: '  <script>Review</script> zero-knowledge proofs  ',
  });
  assert.ok(upserted);
  assert.strictEqual(upserted.item.title, 'Evening Architecture Audit');
  assert.strictEqual(upserted.item.endTime, '20:30');
  assert.strictEqual(upserted.item.notes, 'Review zero-knowledge proofs');
  assert.strictEqual(upserted.nextEvents.length, sampleEvents.length + 1);

  // Reorder templates
  const reordered = moveFrequentEventTemplate(upserted.nextEvents, 0, 'down');
  assert.strictEqual(reordered[1].id, upserted.item.id);
});

test('Unified Customization Studio v26.11.2+: custom accent hex, border hex, continuous scaling, and quotes category CRUD', async () => {
  const { resolveAccentTheme, resolveSurfaceConfig, computeThemeCssVariables } = await import('./theme');
  const { getCategoriesByDomain, addCategoryToDomain, updateCategoryColorInDomain, deleteCategoryFromDomain } = await import('./categoryEngine');

  // 1. Custom Accent Hex overrides preset
  const customTheme = resolveAccentTheme('gold', '#FF3399');
  assert.strictEqual(customTheme.hex, '#FF3399');

  // 2. Structural Border Hex & CSS Variables
  const customSurface = resolveSurfaceConfig({
    preset: 'custom',
    canvasHex: '#000000',
    columnHex: '#000000',
    cardHex: '#000000',
    borderHex: '#3B4252',
  });
  assert.strictEqual(customSurface.borderHex, '#3B4252');

  const cssVars = computeThemeCssVariables(
    {
      accentColor: 'gold',
      customAccentHex: '#10B981',
      surfaceConfig: customSurface,
    },
    sanitizeLayoutConfig({
      gridColumns: 4,
      pageWidth: 'ultrawide',
      customPageMaxWidthPx: 2120,
      density: 'compact',
      customGridGapPx: 20,
      fontScale: 1.13,
      sidebarPosition: 'bottom',
      sidebarIconColor: '#38BDF8',
    })
  );
  assert.strictEqual(cssVars['--accent-primary'], '#10B981');
  assert.strictEqual(cssVars['--border-subtle'], '#3B4252');
  assert.strictEqual(cssVars['--icon-color'], '#38BDF8');
  assert.strictEqual(cssVars['--app-grid-gap'], '20px');
  assert.strictEqual(cssVars['--app-page-max-width'], '2120px');

  // 3. Quotes Category Domain CRUD + Color Update + Delete
  let appData = validateAndSanitizeAppData({});
  const initialQuotesCats = getCategoriesByDomain(appData, 'quotes');
  assert.ok(initialQuotesCats.some((c) => c.name === 'stoicism'));

  const addedRes = addCategoryToDomain(appData, 'quotes', 'Tactical Mindset', '#F43F5E');
  assert.strictEqual(addedRes.added, true);
  appData = addedRes.nextAppData;
  assert.ok(getCategoriesByDomain(appData, 'quotes').some((c) => c.name === 'Tactical Mindset' && c.color === '#F43F5E'));

  appData = updateCategoryColorInDomain(appData, 'quotes', 'Tactical Mindset', '#22D3EE');
  assert.ok(getCategoriesByDomain(appData, 'quotes').some((c) => c.name === 'Tactical Mindset' && c.color === '#22D3EE'));

  appData = deleteCategoryFromDomain(appData, 'quotes', 'Tactical Mindset');
  assert.strictEqual(getCategoriesByDomain(appData, 'quotes').some((c) => c.name === 'Tactical Mindset'), false);
});


