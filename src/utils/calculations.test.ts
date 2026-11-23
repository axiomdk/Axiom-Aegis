import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDurationMinutes,
  formatMinutes,
  convertDistance,
  calculateFundsSummary,
  calculateDistanceSummary,
  kgToLbs,
  lbsToKg,
  cmToFtIn,
  ftInToCm,
  calculateGoalProgress,
} from './calculations';
import { DistanceEntry, FundEntry, GoalEntry } from '../types';

test('calculateDurationMinutes handles same-day and midnight crossing', () => {
  assert.equal(calculateDurationMinutes('09:00', '10:30'), 90);
  assert.equal(calculateDurationMinutes('14:15', '15:00'), 45);
  // Midnight crossing: 23:30 to 01:00 is 90 mins
  assert.equal(calculateDurationMinutes('23:30', '01:00'), 90);
  assert.equal(calculateDurationMinutes('', ''), 0);
});

test('formatMinutes formats minutes accurately', () => {
  assert.equal(formatMinutes(45), '45m');
  assert.equal(formatMinutes(120), '2h');
  assert.equal(formatMinutes(150), '2h 30m');
  assert.equal(formatMinutes(0), '0m');
});

test('convertDistance converts miles and km accurately', () => {
  const miToKm = convertDistance(10, 'mi', 'km');
  assert.ok(Math.abs(miToKm - 16.0934) < 0.01);

  const kmToMi = convertDistance(16.09344, 'km', 'mi');
  assert.ok(Math.abs(kmToMi - 10) < 0.01);
});

test('Imperial unit conversions for pounds and feet/inches work properly', () => {
  // 78.4 kg -> ~172.8 lbs
  const lbs = kgToLbs(78.4);
  assert.equal(lbs, 172.8);

  const kg = lbsToKg(172.8);
  assert.ok(Math.abs(kg - 78.4) <= 0.1);

  // 182 cm -> 5 ft 12 in (approx 6 ft 0 in)
  const ftIn = cmToFtIn(182);
  assert.ok(ftIn.formatted.length > 0);

  // 5 ft 11 in -> ~180 cm
  const cm = ftInToCm(5, 11);
  assert.equal(cm, 180);
});

test('calculateGoalProgress computes milestones and numerical targets correctly', () => {
  const milestoneGoal: GoalEntry = {
    id: 'g1',
    title: 'Complete System Migration',
    category: 'career',
    targetDate: '2026-12-31',
    milestones: [
      { id: 'm1', title: 'Phase 1', completed: true },
      { id: 'm2', title: 'Phase 2', completed: false },
      { id: 'm3', title: 'Phase 3', completed: true },
      { id: 'm4', title: 'Phase 4', completed: false },
    ],
    status: 'in_progress',
    createdAt: 1,
  };

  assert.equal(calculateGoalProgress(milestoneGoal), 50);

  const numericalGoal: GoalEntry = {
    id: 'g2',
    title: 'Bench Press Target',
    category: 'fitness',
    targetDate: '2026-11-01',
    currentValue: 200,
    targetValue: 250,
    unit: 'lbs',
    milestones: [],
    status: 'in_progress',
    createdAt: 2,
  };

  assert.equal(calculateGoalProgress(numericalGoal), 80);
});

test('calculateDistanceSummary strictly computes monthly statement distance and separates months', () => {
  const entries: DistanceEntry[] = [
    { id: 'd1', date: '2026-11-15', distance: 6.2, unit: 'mi', type: 'run', description: 'Run', createdAt: 1 },
    { id: 'd2', date: '2026-11-08', distance: 11.5, unit: 'mi', type: 'cycle', description: 'Cycle', createdAt: 2 },
    { id: 'd3', date: '2026-11-02', distance: 3.8, unit: 'mi', type: 'walk', description: 'Walk', createdAt: 3 },
    { id: 'd4', date: '2026-10-18', distance: 12.5, unit: 'mi', type: 'cycle', description: 'Cycle', createdAt: 4 },
  ];

  const novSummary = calculateDistanceSummary(entries, 'mi', '2026-11');
  assert.equal(novSummary.total, 34);
  assert.equal(novSummary.activeStatementMonth, '2026-11');
  assert.equal(novSummary.monthlyStatementTotal, 21.5);
  assert.equal(novSummary.monthlyStatementEntriesCount, 3);

  const octSummary = calculateDistanceSummary(entries, 'mi', '2026-10');
  assert.equal(octSummary.activeStatementMonth, '2026-10');
  assert.equal(octSummary.monthlyStatementTotal, 12.5);
  assert.equal(octSummary.monthlyStatementEntriesCount, 1);
});

test('calculateFundsSummary strictly computes monthly statement inflow, outflow, and net', () => {
  const funds: FundEntry[] = [
    { id: 'f1', date: '2026-11-10', type: 'income', amount: 5000, category: 'Salary', description: 'Paycheck', createdAt: 1 },
    { id: 'f2', date: '2026-11-12', type: 'expense', amount: 1200, category: 'Housing', description: 'Rent', createdAt: 2 },
    { id: 'f3', date: '2026-10-15', type: 'expense', amount: 800, category: 'Utilities', description: 'Oct Bills', createdAt: 3 },
  ];

  const novFunds = calculateFundsSummary(funds, 0, '2026-11');
  assert.equal(novFunds.activeStatementMonth, '2026-11');
  assert.equal(novFunds.monthlyStatementIncome, 5000);
  assert.equal(novFunds.monthlyStatementExpense, 1200);
  assert.equal(novFunds.monthlyStatementNet, 3800);
  assert.equal(novFunds.monthlyStatementCount, 2);
  assert.equal(novFunds.currentBalance, 3000);
});


test('reconcileGoalsWithNetBalance unchecks financial milestones exceeding live net balance', async () => {
  const { reconcileGoalsWithNetBalance } = await import('./calculations');
  const goals: GoalEntry[] = [
    {
      id: 'g-2',
      title: 'Build $25,000 Liquid Reserve Fund',
      category: 'financial',
      targetDate: '2026-12-31',
      targetValue: 25000,
      currentValue: 18500,
      unit: 'USD',
      status: 'in_progress',
      createdAt: 1,
      milestones: [
        { id: 'm-3', title: 'Hit $5,000 baseline', completed: true },
        { id: 'm-4', title: 'Hit $10,000 foundation', completed: true },
        { id: 'm-5', title: 'Hit $15,000 milestone', completed: true },
        { id: 'm-6', title: 'Complete $25,000 reserve', completed: false },
      ],
    },
  ];

  const reconciled = reconcileGoalsWithNetBalance(goals, 5476.75);
  assert.equal(reconciled[0].currentValue, 5476.75);
  assert.equal(reconciled[0].milestones[0].completed, true); // $5,000 <= 5476.75
  assert.equal(reconciled[0].milestones[1].completed, false); // $10,000 > 5476.75
  assert.equal(reconciled[0].milestones[2].completed, false); // $15,000 > 5476.75
  assert.equal(reconciled[0].milestones[3].completed, false); // $25,000 > 5476.75
});

