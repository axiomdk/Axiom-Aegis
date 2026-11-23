import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialAppData } from './defaults';
import {
  buildTimelineEntryFromFocusTimer,
  calculateBiometricsCorrelation,
  calculateFinancialRunwayAndBurn,
  computeLiveGoalMetrics,
  countTotalVaultRecords,
  createAegisSnapshotFilename,
  DEFAULT_FOCUS_TIMER_STATE,
  estimateFinancialGoalRunway,
  evaluateBackupHealth,
  formatDocumentTitleWithTimer,
  formatStopwatchHMS,
  getFocusTimerElapsedSeconds,
  MAX_UNDO_HISTORY,
  popUndoSnapshot,
  projectUpcomingRecurringTransactions,
  pushUndoSnapshot,
  syncGoalsWithLiveModules,
  UndoSnapshotEntry,
} from './aegisUpgradesEngine';

test('Cross-Module Live Goal Sync: reconciles financial and biometric goals with manualOverride support', () => {
  const initial = createInitialAppData();
  const sampleGoals = [
    {
      id: 'g-1',
      title: 'Reach Optimal Body Weight',
      category: 'fitness' as const,
      targetDate: '2026-12-31',
      targetValue: 170,
      currentValue: 175,
      unit: 'lbs',
      status: 'in_progress' as const,
      milestones: [
        { id: 'm-1', title: 'Cut down to 175 lbs', completed: false },
        { id: 'm-2', title: 'Break 173 lbs plateau', completed: false },
        { id: 'm-3', title: 'Maintain 170 lbs', completed: false },
      ],
      createdAt: 1,
    },
    {
      id: 'g-2',
      title: 'Build Emergency Reserve',
      category: 'financial' as const,
      targetDate: '2026-12-31',
      targetValue: 25000,
      currentValue: 5000,
      unit: '$',
      status: 'in_progress' as const,
      milestones: [
        { id: 'm-4', title: 'Hit $10,000 foundation', completed: false },
        { id: 'm-5', title: 'Hit $15,000 milestone', completed: false },
      ],
      createdAt: 2,
    },
  ];
  const sampleStats = [
    { id: 'ls-1', date: '2026-10-27', weightLbs: 172.8, mood: 9, createdAt: 2 },
    { id: 'ls-2', date: '2026-10-20', weightLbs: 175.2, mood: 8, createdAt: 1 },
  ];

  // 1. Live Net Funds Balance = $12,500 -> should auto-check $10,000 foundation milestone on g-2
  const syncedAt12k = syncGoalsWithLiveModules(sampleGoals, 12500, sampleStats);
  const financialGoal = syncedAt12k.find((g) => g.id === 'g-2')!;
  assert.equal(financialGoal.currentValue, 12500);
  assert.equal(financialGoal.milestones[0].completed, true); // Hit $10,000 foundation
  assert.equal(financialGoal.milestones[1].completed, false); // Hit $15,000 milestone

  const metrics = computeLiveGoalMetrics(
    financialGoal,
    {
      ...initial,
      settings: { ...initial.settings, startingBalance: 3200 },
      funds: [{ id: 'f-big', date: '2026-10-20', type: 'income', amount: 9300, category: 'Retainer', description: 'Contract', createdAt: 1 }],
    },
    2500
  );
  assert.equal(metrics.isLiveSynced, true);
  assert.equal(metrics.syncSource, 'funds');
  assert.equal(metrics.liveCurrentValue, 12500);
  assert.equal(metrics.completionPercent, 50);
  assert.match(metrics.deltaFormatted, /\$12,500\.00 to target/);

  // 2. Respect manualOverride on milestone and goal
  const manualGoals = syncedAt12k.map((g) =>
    g.id === 'g-2'
      ? {
          ...g,
          manualOverride: true,
          currentValue: 18000,
          milestones: g.milestones.map((m, idx) =>
            idx === 1 ? { ...m, completed: true, manualOverride: true } : m
          ),
        }
      : g
  );
  const syncedWithManual = syncGoalsWithLiveModules(manualGoals, 5476.75, sampleStats);
  const preservedGoal = syncedWithManual.find((g) => g.id === 'g-2')!;
  assert.equal(preservedGoal.currentValue, 18000);
  assert.equal(preservedGoal.milestones[1].completed, true);

  // 3. Biometrics weight goal (g-1) syncs with latest weight from Life Statistics
  const weightGoal = syncedAt12k.find((g) => g.id === 'g-1')!;
  assert.equal(weightGoal.currentValue, 172.8);
  assert.equal(weightGoal.milestones[0].completed, true); // Cut down to 175 lbs
  assert.equal(weightGoal.milestones[1].completed, true); // Break 173 lbs plateau
  assert.equal(weightGoal.milestones[2].completed, false); // Maintain 170 lbs
});

test('Biometrics vs. Activity Correlation Engine: computes active vs rest mood lift and 7-day weight velocity', () => {
  const sampleStats = [
    { id: 'ls-1', date: '2026-10-27', weightLbs: 172.8, mood: 9, createdAt: 4 },
    { id: 'ls-2', date: '2026-10-25', weightLbs: 173.4, mood: 8, createdAt: 3 },
    { id: 'ls-3', date: '2026-10-22', weightLbs: 174.1, mood: 7, createdAt: 2 },
    { id: 'ls-4', date: '2026-10-18', weightLbs: 175.2, mood: 8, createdAt: 1 },
  ];
  const sampleTimeline = [
    {
      id: 't-1',
      title: 'Architecture Sprint',
      category: 'work',
      date: '2026-10-27',
      startTime: '09:00',
      endTime: '11:30',
      durationMinutes: 150,
      createdAt: 1,
    },
    {
      id: 't-2',
      title: 'Strength Session',
      category: 'health',
      date: '2026-10-27',
      startTime: '17:00',
      endTime: '18:00',
      durationMinutes: 60,
      createdAt: 2,
    },
  ];
  const report = calculateBiometricsCorrelation(sampleStats, sampleTimeline);

  assert.equal(report.activeDaysCount, 1);
  assert.equal(report.restDaysCount, 3);
  assert.equal(report.avgMoodActiveDays, 9);
  assert.equal(report.avgMoodRestDays, 7.7);
  assert.equal(report.moodDeltaPoints, 1.3);
  assert.equal(report.weightVelocity7dLbs, -1.9);
  assert.match(report.summaryPillText, /Mood \+1\.3 pts \(\+17%\) on >=1h Active days/);
  assert.match(report.summaryPillText, /-1\.9 lbs\/wk/);
});

test('Financial Ledger Runway, Burn Rate & Recurring Engine: projects recurring items and Safe-to-Spend', () => {
  const funds = [
    {
      id: 'f-rec-1',
      date: '2026-10-01',
      type: 'expense' as const,
      amount: 150,
      category: 'Cloud Infrastructure',
      description: 'Dedicated bare-metal cluster',
      recurrence: 'monthly' as const,
      createdAt: 1,
    },
    {
      id: 'f-rec-2',
      date: '2026-10-15',
      type: 'expense' as const,
      amount: 50,
      category: 'Health & Nutrition',
      description: 'Weekly organic CSA box',
      recurrence: 'weekly' as const,
      createdAt: 2,
    },
    {
      id: 'f-inc-1',
      date: '2026-10-10',
      type: 'income' as const,
      amount: 3000,
      category: 'Client Retainer',
      description: 'Engineering Retainer',
      recurrence: 'monthly' as const,
      createdAt: 3,
    },
  ];

  const projected = projectUpcomingRecurringTransactions(funds, '2026-10-20', 30);
  assert.ok(projected.length >= 5);
  assert.ok(projected.some((p) => p.recurrence === 'monthly' && p.amount === 150));
  assert.ok(projected.some((p) => p.recurrence === 'weekly' && p.amount === 50));
  assert.equal(projected[0].projectedDate, projected[0].date);

  const runway = calculateFinancialRunwayAndBurn(funds, 3200, '2026-10-20');
  // Current balance = 3200 + 3000 - 200 = 6000
  assert.equal(runway.currentBalance, 6000);
  assert.equal(runway.expenses30d, 200);
  assert.equal(runway.monthlyBurnRate30d, 200);
  assert.equal(runway.monthlyBurnRate30d.toFixed(2), '200.00');
  assert.equal(runway.income30d, 3000);
  assert.equal(runway.netMonthlyCashflowVelocity, 2800);
  assert.ok(runway.runwayMonths !== null && runway.runwayMonths > 0);
  assert.ok(runway.upcoming30dRecurringExpenses >= 350);
  assert.equal(
    runway.safeToSpendBalance,
    Math.round((6000 - runway.upcoming30dRecurringExpenses) * 100) / 100
  );

  const goalEst = estimateFinancialGoalRunway(
    { targetValue: 20000, currentValue: 6000 },
    6000,
    2800,
    '2026-10-20'
  );
  assert.equal(goalEst.remainingAmount, 14000);
  assert.equal(goalEst.estimatedMonths, 5);
  assert.match(goalEst.formattedRunway, /~5 mos/);
});

test('Automated .aegis Vault Snapshots & Backup Health: evaluates >7 days and >15 new records triggers', () => {
  const initial = createInitialAppData();
  const filename = createAegisSnapshotFilename('2026-10-27');
  assert.equal(filename, 'Axiom-Aegis-Vault-2026-10-27.aegis');

  assert.equal(countTotalVaultRecords(initial), 0);

  const populated = {
    ...initial,
    funds: Array.from({ length: 20 }, (_, idx) => ({
      id: `f-${idx}`,
      date: '2026-10-20',
      type: 'expense' as const,
      amount: 10,
      category: 'General',
      description: `Txn ${idx}`,
      createdAt: idx,
    })),
  };
  const total = countTotalVaultRecords(populated);
  assert.equal(total, 20);

  // Freshly backed up -> needsBackupReminder = false
  const nowMs = Date.now();
  const backedUpData = {
    ...populated,
    settings: {
      ...populated.settings,
      lastBackupTimestamp: nowMs - 86400000, // 1 day ago
      lastBackupRecordCount: total - 2, // only 2 new records
    },
  };
  const healthy = evaluateBackupHealth(backedUpData, nowMs);
  assert.equal(healthy.needsBackupReminder, false);
  assert.equal(healthy.statusLabel, 'Vault Snapshot Current');

  // >7 days elapsed -> needsBackupReminder = true
  const staleByDays = evaluateBackupHealth(
    {
      ...populated,
      settings: {
        ...populated.settings,
        lastBackupTimestamp: nowMs - 9 * 86400000,
        lastBackupRecordCount: total,
      },
    },
    nowMs
  );
  assert.equal(staleByDays.needsBackupReminder, true);
  assert.match(staleByDays.statusLabel, /Snapshot Recommended/);

  // >15 new records -> needsBackupReminder = true
  const staleByRecords = evaluateBackupHealth(
    {
      ...populated,
      settings: {
        ...populated.settings,
        lastBackupTimestamp: nowMs - 3600000,
        lastBackupRecordCount: Math.max(0, total - 16),
      },
    },
    nowMs
  );
  assert.equal(staleByRecords.needsBackupReminder, true);
  assert.match(staleByRecords.statusLabel, /\+16 records/);
});

test('Global Undo Ring Buffer: enforces max 10 snapshots and restores LIFO state accurately', () => {
  const initial = createInitialAppData();
  let buffer: UndoSnapshotEntry[] = [];

  for (let i = 1; i <= 14; i++) {
    const mutated = {
      ...initial,
      updatedAt: i,
    };
    buffer = pushUndoSnapshot(buffer, mutated, `Action #${i}`, 1000 + i);
  }

  assert.equal(buffer.length, MAX_UNDO_HISTORY);
  assert.equal(buffer[0].label, 'Action #5');
  assert.equal(buffer[buffer.length - 1].label, 'Action #14');

  const { popped, remaining } = popUndoSnapshot(buffer);
  assert.ok(popped);
  assert.equal(popped.label, 'Action #14');
  assert.equal(popped.snapshot.updatedAt, 14);
  assert.equal(remaining.length, 9);
});

test('Live Execution Focus Stopwatch: formats [HH:MM:SS] document title and creates TimelineEntry on Stop & Log', () => {
  assert.equal(formatStopwatchHMS(0), '00:00:00');
  assert.equal(formatStopwatchHMS(2535), '00:42:15');
  assert.equal(formatStopwatchHMS(3661), '01:01:01');

  assert.equal(
    formatDocumentTitleWithTimer(2535, true, 'Axiom Aegis'),
    '[00:42:15] Axiom Aegis'
  );
  assert.equal(
    formatDocumentTitleWithTimer(0, false, 'Axiom Aegis', 'Axiom Aegis (AA) — v26.11.2'),
    'Axiom Aegis (AA) — v26.11.2'
  );

  const startMs = Date.UTC(2026, 9, 27, 14, 0, 0);
  const stopMs = startMs + 42 * 60 * 1000 + 15 * 1000; // 42m 15s later
  const activeTimer = {
    ...DEFAULT_FOCUS_TIMER_STATE,
    isRunning: true,
    isPaused: false,
    startedAtMs: startMs,
    accumulatedSeconds: 0,
    title: 'Morning Deep Focus',
    category: 'work',
  };

  assert.equal(getFocusTimerElapsedSeconds(activeTimer, stopMs), 2535);
  const entry = buildTimelineEntryFromFocusTimer(activeTimer, stopMs, '2026-10-27');
  assert.equal(entry.title, 'Morning Deep Focus');
  assert.equal(entry.category, 'work');
  assert.equal(entry.date, '2026-10-27');
  assert.equal(entry.durationMinutes, 42);
  assert.match(entry.notes || '', /00:42:15 elapsed/);
});

test('Cross-Module Live Goal Sync: updates distance goals and milestones while honoring manualOverride', () => {
  const goals = [
    {
      id: 'g-dist-1',
      title: 'Run 100 Miles Challenge',
      category: 'fitness' as const,
      targetDate: '2026-12-31',
      targetValue: 100,
      currentValue: 0,
      unit: 'miles',
      status: 'in_progress' as const,
      milestones: [
        { id: 'md-1', title: 'Complete 25 miles base', completed: false },
        { id: 'md-2', title: 'Hit 50 mi halfway mark', completed: false },
        { id: 'md-3', title: 'Finish 100 miles', completed: false },
      ],
      createdAt: 1,
    },
    {
      id: 'g-dist-manual',
      title: 'Manual Hiking Distance',
      category: 'fitness' as const,
      targetDate: '2026-12-31',
      targetValue: 50,
      currentValue: 40,
      unit: 'miles',
      manualOverride: true,
      status: 'in_progress' as const,
      milestones: [
        { id: 'md-m1', title: 'Walk 20 miles', completed: true, manualOverride: true },
      ],
      createdAt: 2,
    },
  ];

  const distances = [
    { id: 'd-1', type: 'run' as const, date: '2026-11-18', distance: 30, unit: 'mi' as const, description: 'Road run', createdAt: 1 },
    { id: 'd-2', type: 'run' as const, date: '2026-11-19', distance: 25, unit: 'mi' as const, description: 'Trail run', createdAt: 2 },
  ];

  const synced = syncGoalsWithLiveModules(goals, 0, [], { distances });
  const liveGoal = synced.find((g) => g.id === 'g-dist-1')!;
  assert.equal(liveGoal.currentValue, 55);
  assert.equal(liveGoal.milestones[0].completed, true);
  assert.equal(liveGoal.milestones[1].completed, true);
  assert.equal(liveGoal.milestones[2].completed, false);

  const manualGoal = synced.find((g) => g.id === 'g-dist-manual')!;
  assert.equal(manualGoal.currentValue, 40);
  assert.equal(manualGoal.milestones[0].completed, true);
});

