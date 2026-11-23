import {
  AppData,
  DistanceEntry,
  FocusTimerState,
  FundEntry,
  GoalEntry,
  GoalSyncSource,
  LifeStatEntry,
  RecurrenceFrequency,
  TimelineCategory,
  TimelineEntry,
  TransactionType,
} from '../types';
import {
  calculateDistanceSummary,
  calculateFundsSummary,
  calculateStatsSummary,
  parseCalendarDateUtcMs,
} from './calculations';

// ============================================================================
// 1. CROSS-MODULE LIVE GOAL SYNC (FUNDS, BIOMETRICS & DISTANCE)
// ============================================================================

export interface LiveGoalMetrics {
  goalId: string;
  isLiveSynced: boolean;
  syncSource: GoalSyncSource;
  liveCurrentValue: number;
  targetValue: number;
  completionPercent: number;
  milestonePercent: number;
  deltaValue: number;
  deltaFormatted: string;
  estimatedRunwayLabel?: string;
  estimatedMonths?: number | null;
}

export function detectGoalSyncSource(goal: GoalEntry): GoalSyncSource {
  if (goal.autoSyncSource && goal.autoSyncSource !== 'none') {
    return goal.autoSyncSource;
  }
  if (goal.autoSyncSource === 'none') {
    return 'none';
  }

  const title = (goal.title || '').toLowerCase();
  const unit = (goal.unit || '').toLowerCase().trim();
  const category = (goal.category || '').toLowerCase().trim();

  if (
    category === 'financial' ||
    unit === '$' ||
    unit === 'usd' ||
    goal.id === 'g-2' ||
    /\$\s*[0-9,]+|\breserve\s+fund\b|\bliquid\s+reserve\b|\bsavings\b|\bnet\s+worth\b/i.test(title)
  ) {
    return 'funds';
  }

  if (
    unit === 'lbs' ||
    unit === 'kg' ||
    goal.id === 'g-1' ||
    /\bweight\b|\blbs\b|\blean\s+weight\b/i.test(title)
  ) {
    return 'lifestats';
  }

  if (
    unit === 'miles' ||
    unit === 'mi' ||
    unit === 'km' ||
    goal.id === 'g-3' ||
    /\brunning\s+miles\b|\btotal\s+miles\b/i.test(title)
  ) {
    return 'distance';
  }

  return 'none';
}

/**
 * Synchronizes Strategic Goals and Tactical Milestones with live state from
 * Funds Ledger, Life Statistics (weight), and Distance Tracker while respecting
 * manualOverride flags on both goals and individual milestones.
 */
export function syncGoalsWithLiveModules(
  goals: GoalEntry[],
  netBalance: number,
  lifeStats: LifeStatEntry[] = [],
  {
    baselineStartWeightLbs = 180,
    distances,
  }: { baselineStartWeightLbs?: number; distances?: DistanceEntry[] } = {}
): GoalEntry[] {
  if (!Array.isArray(goals)) return [];

  const safeBalance = Math.max(0, Math.round((Number(netBalance) || 0) * 100) / 100);
  const statsSummary = calculateStatsSummary(lifeStats);
  const latestWeightLbs = statsSummary.latestWeightLbs;
  const distSummaryCache: { mi?: number; km?: number } = {};

  return goals.map((goal) => {
    const syncSource = detectGoalSyncSource(goal);
    if (syncSource === 'none') {
      return goal;
    }

    if (syncSource === 'funds') {
      const updatedMilestones = (goal.milestones || []).map((ms) => {
        if (ms.manualOverride) return ms;
        const thresholdMatch = /\$\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?)/.exec(
          ms.title || ''
        );
        if (!thresholdMatch) return ms;
        const thresholdValue = parseFloat(thresholdMatch[1].replace(/,/g, ''));
        if (isNaN(thresholdValue) || thresholdValue <= 0) return ms;
        return {
          ...ms,
          completed: safeBalance >= thresholdValue,
        };
      });

      const liveVal = goal.manualOverride
        ? goal.currentValue ?? safeBalance
        : safeBalance;
      const targetReached =
        typeof goal.targetValue === 'number' && goal.targetValue > 0
          ? liveVal >= goal.targetValue
          : false;
      const allMilestonesDone =
        updatedMilestones.length > 0 && updatedMilestones.every((m) => m.completed);
      const isComplete = targetReached && (updatedMilestones.length === 0 || allMilestonesDone);

      return {
        ...goal,
        autoSyncSource: 'funds',
        currentValue: liveVal,
        milestones: updatedMilestones,
        status: isComplete
          ? 'completed'
          : goal.status === 'completed' && !isComplete
          ? 'in_progress'
          : goal.status || 'in_progress',
      };
    }

    if (syncSource === 'lifestats' && latestWeightLbs !== null) {
      const targetWeight = goal.targetValue ?? 170;
      const isWeightLossGoal = targetWeight <= Math.max(latestWeightLbs, baselineStartWeightLbs);

      const updatedMilestones = (goal.milestones || []).map((ms) => {
        if (ms.manualOverride) return ms;
        const weightMatch = /\b(\d{2,3}(?:\.\d+)?)\s*lbs\b/i.exec(ms.title || '');
        if (!weightMatch) return ms;
        const thresholdLbs = parseFloat(weightMatch[1]);
        if (isNaN(thresholdLbs) || thresholdLbs <= 0) return ms;

        // If milestone says "Maintain 170 lbs for 2 consecutive weeks", require at least 2 logs <= threshold
        const requiresStreak = /maintain|consecutive/i.test(ms.title || '');
        if (requiresStreak) {
          const recentLogsAtTarget = lifeStats.filter(
            (s) => typeof s.weightLbs === 'number' && s.weightLbs <= thresholdLbs
          ).length;
          return {
            ...ms,
            completed: recentLogsAtTarget >= 2,
          };
        }

        const completed = isWeightLossGoal
          ? latestWeightLbs <= thresholdLbs
          : latestWeightLbs >= thresholdLbs;

        return {
          ...ms,
          completed,
        };
      });

      const liveVal = goal.manualOverride
        ? goal.currentValue ?? latestWeightLbs
        : latestWeightLbs;
      const allMilestonesDone =
        updatedMilestones.length > 0 && updatedMilestones.every((m) => m.completed);
      const targetReached = isWeightLossGoal
        ? liveVal <= targetWeight
        : liveVal >= targetWeight;
      const isComplete = targetReached && (updatedMilestones.length === 0 || allMilestonesDone);

      return {
        ...goal,
        autoSyncSource: 'lifestats',
        currentValue: liveVal,
        milestones: updatedMilestones,
        status: isComplete
          ? 'completed'
          : goal.status === 'completed' && !isComplete
          ? 'in_progress'
          : goal.status || 'in_progress',
      };
    }

    if (syncSource === 'distance' && Array.isArray(distances)) {
      const targetUnit: 'mi' | 'km' =
        (goal.unit || '').toLowerCase().trim() === 'km' ? 'km' : 'mi';
      if (distSummaryCache[targetUnit] === undefined) {
        distSummaryCache[targetUnit] = calculateDistanceSummary(distances, targetUnit).total;
      }
      const liveDist = Math.round((distSummaryCache[targetUnit] || 0) * 100) / 100;
      const updatedMilestones = (goal.milestones || []).map((ms) => {
        if (ms.manualOverride) return ms;
        const distMatch = /\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:miles?|mi|km)\b/i.exec(
          ms.title || ''
        );
        if (!distMatch) return ms;
        const thresholdDist = parseFloat(distMatch[1].replace(/,/g, ''));
        if (isNaN(thresholdDist) || thresholdDist <= 0) return ms;
        return {
          ...ms,
          completed: liveDist >= thresholdDist,
        };
      });

      const liveVal = goal.manualOverride
        ? goal.currentValue ?? liveDist
        : liveDist;
      const targetReached =
        typeof goal.targetValue === 'number' && goal.targetValue > 0
          ? liveVal >= goal.targetValue
          : false;
      const allMilestonesDone =
        updatedMilestones.length > 0 && updatedMilestones.every((m) => m.completed);
      const isComplete = targetReached && (updatedMilestones.length === 0 || allMilestonesDone);

      return {
        ...goal,
        autoSyncSource: 'distance',
        currentValue: liveVal,
        milestones: updatedMilestones,
        status: isComplete
          ? 'completed'
          : goal.status === 'completed' && !isComplete
          ? 'in_progress'
          : goal.status || 'in_progress',
      };
    }

    return goal;
  });
}

/**
 * Computes rich live metrics (completion %, current vs. target delta, runway estimate,
 * and LIVE SYNC status) for a Strategic Goal.
 */
export function computeLiveGoalMetrics(
  goal: GoalEntry,
  appData: Pick<AppData, 'funds' | 'lifeStats' | 'distances' | 'settings'>,
  netMonthlyCashflowVelocity?: number
): LiveGoalMetrics {
  const syncSource = detectGoalSyncSource(goal);
  const isLiveSynced = syncSource !== 'none' && !goal.manualOverride;

  const fundsSummary = calculateFundsSummary(
    appData.funds || [],
    appData.settings?.startingBalance ?? 0
  );
  const statsSummary = calculateStatsSummary(appData.lifeStats || []);
  const distSummary = calculateDistanceSummary(appData.distances || [], 'mi');

  const totalMilestones = goal.milestones?.length || 0;
  const doneMilestones = (goal.milestones || []).filter((m) => m.completed).length;
  const milestonePercent =
    totalMilestones > 0 ? Math.round((doneMilestones / totalMilestones) * 100) : 0;

  if (syncSource === 'funds') {
    const liveCurrentValue = goal.manualOverride
      ? goal.currentValue ?? fundsSummary.currentBalance
      : fundsSummary.currentBalance;
    const targetValue = goal.targetValue ?? 25000;
    const rawPct =
      targetValue > 0 ? Math.round((liveCurrentValue / targetValue) * 100) : milestonePercent;
    const completionPercent = Math.min(100, Math.max(0, rawPct));
    const deltaValue = Math.round((targetValue - liveCurrentValue) * 100) / 100;
    const currency = appData.settings?.currencySymbol || '$';

    const deltaFormatted =
      deltaValue > 0
        ? `${currency}${deltaValue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} to target`
        : `Target reached (+${currency}${Math.abs(deltaValue).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })})`;

    const runway = estimateFinancialGoalRunway(
      goal,
      liveCurrentValue,
      netMonthlyCashflowVelocity ?? 2276.75
    );

    return {
      goalId: goal.id,
      isLiveSynced,
      syncSource,
      liveCurrentValue,
      targetValue,
      completionPercent,
      milestonePercent,
      deltaValue,
      deltaFormatted,
      estimatedRunwayLabel: runway.formattedRunway,
      estimatedMonths: runway.estimatedMonths,
    };
  }

  if (syncSource === 'lifestats') {
    const liveCurrentValue = goal.manualOverride
      ? goal.currentValue ?? statsSummary.latestWeightLbs ?? 172.8
      : statsSummary.latestWeightLbs ?? goal.currentValue ?? 172.8;
    const targetValue = goal.targetValue ?? 170;
    const deltaValue = Math.round((liveCurrentValue - targetValue) * 10) / 10;

    // For lean weight goal (e.g. from ~180 lbs baseline to 170 lbs target)
    const highestLogged = Math.max(
      180,
      ...(appData.lifeStats || []).map((s) => s.weightLbs || 0),
      liveCurrentValue
    );
    const span = Math.max(1, highestLogged - targetValue);
    const weightProgressPct =
      liveCurrentValue <= targetValue
        ? 100
        : Math.min(99, Math.max(0, Math.round(((highestLogged - liveCurrentValue) / span) * 100)));

    const completionPercent =
      totalMilestones > 0
        ? Math.round((milestonePercent + weightProgressPct) / 2)
        : weightProgressPct;

    const deltaFormatted =
      deltaValue > 0
        ? `+${deltaValue.toFixed(1)} lbs to ${targetValue} lbs target`
        : deltaValue < 0
        ? `${deltaValue.toFixed(1)} lbs below target`
        : `At ${targetValue} lbs target`;

    return {
      goalId: goal.id,
      isLiveSynced,
      syncSource,
      liveCurrentValue,
      targetValue,
      completionPercent,
      milestonePercent,
      deltaValue,
      deltaFormatted,
    };
  }

  if (syncSource === 'distance') {
    const liveCurrentValue =
      goal.manualOverride || (goal.currentValue ?? 0) > distSummary.total
        ? (goal.currentValue ?? distSummary.total)
        : distSummary.total;
    const targetValue = goal.targetValue ?? 500;
    const completionPercent =
      targetValue > 0
        ? Math.min(100, Math.max(0, Math.round((liveCurrentValue / targetValue) * 100)))
        : milestonePercent;
    const deltaValue = Math.round((targetValue - liveCurrentValue) * 10) / 10;
    const unit = goal.unit || 'miles';
    const deltaFormatted =
      deltaValue > 0
        ? `${deltaValue.toLocaleString()} ${unit} remaining`
        : `Target exceeded (+${Math.abs(deltaValue).toFixed(1)} ${unit})`;

    return {
      goalId: goal.id,
      isLiveSynced,
      syncSource,
      liveCurrentValue,
      targetValue,
      completionPercent,
      milestonePercent,
      deltaValue,
      deltaFormatted,
    };
  }

  const liveCurrentValue = goal.currentValue ?? 0;
  const targetValue = goal.targetValue ?? 100;
  const completionPercent =
    totalMilestones > 0
      ? milestonePercent
      : targetValue > 0
      ? Math.min(100, Math.max(0, Math.round((liveCurrentValue / targetValue) * 100)))
      : 0;
  const deltaValue = Math.round((targetValue - liveCurrentValue) * 10) / 10;

  return {
    goalId: goal.id,
    isLiveSynced: false,
    syncSource: 'none',
    liveCurrentValue,
    targetValue,
    completionPercent,
    milestonePercent,
    deltaValue,
    deltaFormatted:
      goal.targetValue !== undefined
        ? `${Math.max(0, deltaValue)} ${goal.unit || ''} remaining`.trim()
        : `${doneMilestones}/${totalMilestones} milestones`,
  };
}

// ============================================================================
// 2. BIOMETRICS VS. ACTIVITY CORRELATION ENGINE
// ============================================================================

export interface BiometricsCorrelationReport {
  avgMoodActiveDays: number;
  avgMoodRestDays: number;
  moodDeltaPoints: number;
  moodDeltaPercent: number;
  activeDaysCount: number;
  restDaysCount: number;
  weightVelocity7dLbs: number;
  avgActiveFocusMinutes: number;
  summaryPillText: string;
  detailedInsightText: string;
}

/**
 * Calculates correlation insights between Daily Timeline blocks (Work/Health focus >= 60m)
 * and logged Life Statistics (Mood 1-10 and 7-day Weight Trend Velocity).
 */
export function calculateBiometricsCorrelation(
  lifeStats: LifeStatEntry[],
  timeline: TimelineEntry[]
): BiometricsCorrelationReport {
  if (!Array.isArray(lifeStats) || lifeStats.length === 0) {
    return {
      avgMoodActiveDays: 0,
      avgMoodRestDays: 0,
      moodDeltaPoints: 0,
      moodDeltaPercent: 0,
      activeDaysCount: 0,
      restDaysCount: 0,
      weightVelocity7dLbs: 0,
      avgActiveFocusMinutes: 0,
      summaryPillText: 'No biometric correlation data yet',
      detailedInsightText: 'Log daily biometrics and timeline blocks to compute mood and weight velocity correlations.',
    };
  }

  // Group timeline minutes of Health + Work per date
  const activeMinutesByDate: Record<string, number> = {};
  for (const entry of timeline || []) {
    if (!entry || !entry.date) continue;
    const cat = (entry.category || '').toLowerCase();
    if (
      cat === 'health' ||
      cat === 'work' ||
      cat.includes('health') ||
      cat.includes('work') ||
      cat.includes('fitness') ||
      cat.includes('focus')
    ) {
      activeMinutesByDate[entry.date] =
        (activeMinutesByDate[entry.date] || 0) + (Number(entry.durationMinutes) || 0);
    }
  }

  const activeMoods: number[] = [];
  const restMoods: number[] = [];
  let totalActiveFocusMins = 0;

  for (const stat of lifeStats) {
    if (!stat || typeof stat.mood !== 'number') continue;
    const mins = activeMinutesByDate[stat.date] || 0;
    if (mins >= 60) {
      activeMoods.push(stat.mood);
      totalActiveFocusMins += mins;
    } else {
      restMoods.push(stat.mood);
    }
  }

  const avgMoodActiveDays =
    activeMoods.length > 0
      ? Math.round((activeMoods.reduce((a, b) => a + b, 0) / activeMoods.length) * 10) / 10
      : 0;
  const avgMoodRestDays =
    restMoods.length > 0
      ? Math.round((restMoods.reduce((a, b) => a + b, 0) / restMoods.length) * 10) / 10
      : 0;

  const moodDeltaPoints =
    activeMoods.length > 0 && restMoods.length > 0
      ? Math.round((avgMoodActiveDays - avgMoodRestDays) * 10) / 10
      : 0;

  const moodDeltaPercent =
    avgMoodRestDays > 0 && activeMoods.length > 0
      ? Math.round(((avgMoodActiveDays - avgMoodRestDays) / avgMoodRestDays) * 100)
      : 0;

  // Compute 7-day weight trend velocity (lbs/wk)
  const sortedWeights = [...lifeStats]
    .filter((s) => typeof s.weightLbs === 'number' && !isNaN(s.weightLbs))
    .sort((a, b) => (parseCalendarDateUtcMs(a.date) || 0) - (parseCalendarDateUtcMs(b.date) || 0));

  let weightVelocity7dLbs = 0;
  if (sortedWeights.length >= 2) {
    const newest = sortedWeights[sortedWeights.length - 1];
    const oldestInWindow = sortedWeights[0];
    const newestMs = parseCalendarDateUtcMs(newest.date) || Date.now();
    const oldestMs = parseCalendarDateUtcMs(oldestInWindow.date) || newestMs - 86400000;
    const elapsedDays = Math.max(1, Math.round((newestMs - oldestMs) / 86400000));
    const rawDelta = (newest.weightLbs || 0) - (oldestInWindow.weightLbs || 0);
    // Normalize or report trailing 7-day delta
    weightVelocity7dLbs =
      elapsedDays <= 7
        ? Math.round(rawDelta * 10) / 10
        : Math.round(((rawDelta / elapsedDays) * 7) * 10) / 10;
  }

  const avgActiveFocusMinutes =
    activeMoods.length > 0 ? Math.round(totalActiveFocusMins / activeMoods.length) : 0;

  const moodSign = moodDeltaPoints >= 0 ? '+' : '';
  const weightSign = weightVelocity7dLbs > 0 ? '+' : '';
  const summaryPillText =
    activeMoods.length > 0 && restMoods.length > 0
      ? `Mood ${moodSign}${moodDeltaPoints} pts (${moodSign}${moodDeltaPercent}%) on >=1h Active days • ${weightSign}${weightVelocity7dLbs} lbs/wk`
      : activeMoods.length > 0
      ? `Avg Mood ${avgMoodActiveDays}/10 on >=1h Active days • ${weightSign}${weightVelocity7dLbs} lbs/wk`
      : `Avg Mood ${avgMoodRestDays}/10 • ${weightSign}${weightVelocity7dLbs} lbs/wk`;

  const detailedInsightText =
    activeMoods.length > 0 && restMoods.length > 0
      ? `Days with >=1h of HEALTH/WORK activity average ${avgMoodActiveDays}/10 mood vs. ${avgMoodRestDays}/10 on rest days (${moodSign}${moodDeltaPercent}% lift). 7-day weight velocity: ${weightSign}${weightVelocity7dLbs} lbs/wk.`
      : `Logged ${lifeStats.length} biometric check-ins. 7-day weight velocity: ${weightSign}${weightVelocity7dLbs} lbs/wk.`;

  return {
    avgMoodActiveDays,
    avgMoodRestDays,
    moodDeltaPoints,
    moodDeltaPercent,
    activeDaysCount: activeMoods.length,
    restDaysCount: restMoods.length,
    weightVelocity7dLbs,
    avgActiveFocusMinutes,
    summaryPillText,
    detailedInsightText,
  };
}

// ============================================================================
// 3. FINANCIAL LEDGER RUNWAY, BURN RATE & RECURRING ENGINE
// ============================================================================

export interface ProjectedRecurringTransaction {
  id: string;
  sourceFundId: string;
  date: string; // YYYY-MM-DD
  projectedDate: string; // YYYY-MM-DD alias for UI callers
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  recurrence: RecurrenceFrequency;
  daysUntil: number;
}

export interface FinancialRunwaySummary {
  currentBalance: number;
  income30d: number;
  expenses30d: number;
  dailyBurnRate30d: number;
  monthlyBurnRate30d: number;
  netMonthlyCashflowVelocity: number;
  upcoming30dRecurringExpenses: number;
  upcoming30dRecurringIncome: number;
  safeToSpendBalance: number;
  runwayDays: number | null;
  runwayMonths: number | null;
  upcomingRecurringItems: ProjectedRecurringTransaction[];
}

function formatUtcMsToYMD(utcMs: number): string {
  const d = new Date(utcMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addMonthsUtc(utcMs: number, monthsToAdd: number): number {
  const d = new Date(utcMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + monthsToAdd;
  const day = d.getUTCDate();
  const candidate = new Date(Date.UTC(y, m, 1));
  const maxDaysInTargetMonth = new Date(
    Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return Date.UTC(
    candidate.getUTCFullYear(),
    candidate.getUTCMonth(),
    Math.min(day, maxDaysInTargetMonth)
  );
}

/**
 * Projects recurring income/expense transactions into the upcoming `horizonDays` window
 * (default 30 days) for Mini-Calendar & Safe-to-Spend calculations.
 */
export function projectUpcomingRecurringTransactions(
  funds: FundEntry[],
  referenceDateStr?: string,
  horizonDays: number = 30
): ProjectedRecurringTransaction[] {
  if (!Array.isArray(funds) || funds.length === 0) return [];

  const todayStr = referenceDateStr || new Date().toISOString().split('T')[0];
  const todayUtcMs = parseCalendarDateUtcMs(todayStr) ?? Date.now();
  const horizonEndUtcMs = todayUtcMs + horizonDays * 86400000;

  // Deduplicate recurring templates by normalized description + type + recurrence
  const recurringTemplates = new Map<string, FundEntry>();
  for (const entry of funds) {
    if (!entry || !entry.recurrence || entry.recurrence === 'none') continue;
    const key = `${entry.type}::${entry.recurrence}::${(entry.description || entry.category || '')
      .trim()
      .toLowerCase()}`;
    const existing = recurringTemplates.get(key);
    if (!existing || entry.date > existing.date) {
      recurringTemplates.set(key, entry);
    }
  }

  const projected: ProjectedRecurringTransaction[] = [];

  for (const template of recurringTemplates.values()) {
    const startUtcMs = parseCalendarDateUtcMs(template.date);
    if (startUtcMs === null) continue;

    const freq = template.recurrence!;
    let cursorMs = startUtcMs;
    let stepIndex = 0;

    // Advance cursor forward from template date
    while (cursorMs <= horizonEndUtcMs && stepIndex < 120) {
      stepIndex += 1;
      if (freq === 'weekly') {
        cursorMs = startUtcMs + stepIndex * 7 * 86400000;
      } else if (freq === 'biweekly') {
        cursorMs = startUtcMs + stepIndex * 14 * 86400000;
      } else if (freq === 'monthly') {
        cursorMs = addMonthsUtc(startUtcMs, stepIndex);
      } else {
        break;
      }

      if (cursorMs >= todayUtcMs && cursorMs <= horizonEndUtcMs) {
        const projDate = formatUtcMsToYMD(cursorMs);
        const daysUntil = Math.max(0, Math.round((cursorMs - todayUtcMs) / 86400000));
        projected.push({
          id: `rec-${template.id}-${projDate}`,
          sourceFundId: template.id,
          date: projDate,
          projectedDate: projDate,
          type: template.type,
          amount: Math.round((Number(template.amount) || 0) * 100) / 100,
          category: template.category,
          description: template.description,
          recurrence: freq,
          daysUntil,
        });
      }
    }
  }

  return projected.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculates Monthly Statement burn rate, net monthly statement cashflow velocity,
 * upcoming monthly recurring obligations, and Safe-to-Spend balance.
 */
export function calculateFinancialRunwayAndBurn(
  funds: FundEntry[],
  startingBalance: number = 0,
  referenceDateStr?: string
): FinancialRunwaySummary {
  const summary = calculateFundsSummary(funds || [], startingBalance, referenceDateStr);
  const todayStr = referenceDateStr || new Date().toISOString().split('T')[0];

  const income30d = summary.monthlyStatementIncome;
  const expenses30d = summary.monthlyStatementExpense;
  const dailyBurnRate30d = Math.round((expenses30d / 30) * 100) / 100;
  const monthlyBurnRate30d = expenses30d;
  const netMonthlyCashflowVelocity = summary.monthlyStatementNet;

  const upcomingRecurringItems = projectUpcomingRecurringTransactions(funds || [], todayStr, 30);
  const upcoming30dRecurringExpenses =
    Math.round(
      upcomingRecurringItems
        .filter((item) => item.type === 'expense')
        .reduce((acc, item) => acc + item.amount, 0) * 100
    ) / 100;
  const upcoming30dRecurringIncome =
    Math.round(
      upcomingRecurringItems
        .filter((item) => item.type === 'income')
        .reduce((acc, item) => acc + item.amount, 0) * 100
    ) / 100;

  const safeToSpendBalance =
    Math.round(Math.max(0, summary.currentBalance - upcoming30dRecurringExpenses) * 100) / 100;

  const runwayDays =
    dailyBurnRate30d > 0 ? Math.floor(Math.max(0, summary.currentBalance) / dailyBurnRate30d) : null;
  const runwayMonths =
    runwayDays !== null ? Math.round((runwayDays / 30) * 10) / 10 : null;

  return {
    currentBalance: summary.currentBalance,
    income30d,
    expenses30d,
    dailyBurnRate30d,
    monthlyBurnRate30d,
    netMonthlyCashflowVelocity,
    upcoming30dRecurringExpenses,
    upcoming30dRecurringIncome,
    safeToSpendBalance,
    runwayDays,
    runwayMonths,
    upcomingRecurringItems,
  };
}

/**
 * Estimates completion runway for a financial Strategic Goal based on current Net Balance
 * and Net Monthly Cashflow Velocity.
 */
export function estimateFinancialGoalRunway(
  goal: Pick<GoalEntry, 'targetValue' | 'currentValue'>,
  currentBalance: number,
  netMonthlyCashflowVelocity: number,
  referenceDateStr?: string
): {
  remainingAmount: number;
  estimatedMonths: number | null;
  estimatedCompletionMonth: string | null;
  formattedRunway: string;
} {
  const target = Number(goal.targetValue) || 0;
  const remainingAmount = Math.max(0, Math.round((target - currentBalance) * 100) / 100);

  if (remainingAmount <= 0) {
    return {
      remainingAmount: 0,
      estimatedMonths: 0,
      estimatedCompletionMonth: null,
      formattedRunway: 'Target Achieved',
    };
  }

  if (netMonthlyCashflowVelocity <= 0) {
    return {
      remainingAmount,
      estimatedMonths: null,
      estimatedCompletionMonth: null,
      formattedRunway: 'Awaiting positive monthly net velocity',
    };
  }

  const estimatedMonths = Math.round((remainingAmount / netMonthlyCashflowVelocity) * 10) / 10;
  const todayStr = referenceDateStr || new Date().toISOString().split('T')[0];
  const todayMs = parseCalendarDateUtcMs(todayStr) ?? Date.now();
  const targetUtcMs = addMonthsUtc(todayMs, Math.ceil(estimatedMonths));
  const targetDateObj = new Date(targetUtcMs);
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const estimatedCompletionMonth = `${
    monthNames[targetDateObj.getUTCMonth()]
  } ${targetDateObj.getUTCFullYear()}`;

  return {
    remainingAmount,
    estimatedMonths,
    estimatedCompletionMonth,
    formattedRunway: `~${estimatedMonths} mos (${estimatedCompletionMonth})`,
  };
}

// ============================================================================
// 4. AUTOMATED .AEGIS ENCRYPTED VAULT SNAPSHOTS & BACKUP HEALTH
// ============================================================================

export interface BackupHealthStatus {
  totalRecords: number;
  lastBackupTimestamp: number | null;
  lastBackupRecordCount: number;
  daysSinceBackup: number | null;
  newRecordsSinceBackup: number;
  needsBackupReminder: boolean;
  statusLabel: string;
}

export function createAegisSnapshotFilename(referenceDateStr?: string): string {
  const dateStr = referenceDateStr || new Date().toISOString().split('T')[0];
  return `Axiom-Aegis-Vault-${dateStr}.aegis`;
}

export function countTotalVaultRecords(
  appData: Partial<
    Pick<
      AppData,
      'timeline' | 'funds' | 'bills' | 'lifeStats' | 'distances' | 'goals' | 'dailyNotes' | 'chores' | 'gallery'
    >
  >
): number {
  if (!appData) return 0;
  return (
    (appData.timeline?.length || 0) +
    (appData.funds?.length || 0) +
    (appData.bills?.length || 0) +
    (appData.lifeStats?.length || 0) +
    (appData.distances?.length || 0) +
    (appData.goals?.length || 0) +
    (appData.dailyNotes?.length || 0) +
    (appData.chores?.length || 0) +
    (appData.gallery?.length || 0)
  );
}

export function evaluateBackupHealth(
  appData: AppData,
  nowMs: number = Date.now()
): BackupHealthStatus {
  const totalRecords = countTotalVaultRecords(appData);
  const lastBackupTimestamp = appData?.settings?.lastBackupTimestamp ?? null;
  const lastBackupRecordCount = appData?.settings?.lastBackupRecordCount ?? 0;

  const daysSinceBackup =
    typeof lastBackupTimestamp === 'number' && lastBackupTimestamp > 0
      ? Math.round(((nowMs - lastBackupTimestamp) / 86400000) * 10) / 10
      : null;

  const newRecordsSinceBackup = Math.max(0, totalRecords - lastBackupRecordCount);

  const isStaleByDays = daysSinceBackup !== null && daysSinceBackup > 7;
  const isStaleByRecords = newRecordsSinceBackup > 15;
  const neverBackedUpWithNewData = lastBackupTimestamp === null && newRecordsSinceBackup > 15;

  const needsBackupReminder = Boolean(
    isStaleByDays || isStaleByRecords || neverBackedUpWithNewData
  );

  let statusLabel = 'Vault Snapshot Current';
  if (isStaleByRecords) {
    statusLabel = `Snapshot Recommended (+${newRecordsSinceBackup} records)`;
  } else if (isStaleByDays && daysSinceBackup !== null) {
    statusLabel = `Snapshot Recommended (${Math.floor(daysSinceBackup)}d since backup)`;
  } else if (lastBackupTimestamp === null) {
    statusLabel = 'Ready for .aegis Snapshot';
  }

  return {
    totalRecords,
    lastBackupTimestamp,
    lastBackupRecordCount,
    daysSinceBackup,
    newRecordsSinceBackup,
    needsBackupReminder,
    statusLabel,
  };
}

// ============================================================================
// 5. GLOBAL UNDO RING BUFFER (MAX 10 MUTATIONS)
// ============================================================================

export const MAX_UNDO_HISTORY = 10;

export interface UndoSnapshotEntry {
  id: string;
  label: string;
  timestamp: number;
  snapshot: AppData;
}

export function detectMutationActionLabel(prevData: AppData, nextData: AppData): string {
  if ((prevData.timeline?.length || 0) !== (nextData.timeline?.length || 0)) {
    return nextData.timeline.length > prevData.timeline.length
      ? 'Timeline Block Added'
      : 'Timeline Block Removed';
  }
  if ((prevData.funds?.length || 0) !== (nextData.funds?.length || 0)) {
    return nextData.funds.length > prevData.funds.length
      ? 'Ledger Transaction Added'
      : 'Ledger Transaction Removed';
  }
  if ((prevData.bills?.length || 0) !== (nextData.bills?.length || 0)) {
    return (nextData.bills?.length || 0) > (prevData.bills?.length || 0)
      ? 'Bill Added'
      : 'Bill Removed';
  }
  if ((prevData.goals?.length || 0) !== (nextData.goals?.length || 0)) {
    return nextData.goals.length > prevData.goals.length ? 'Goal Added' : 'Goal Removed';
  }
  if ((prevData.dailyNotes?.length || 0) !== (nextData.dailyNotes?.length || 0)) {
    return (nextData.dailyNotes?.length || 0) > (prevData.dailyNotes?.length || 0)
      ? 'Daily Note Added'
      : 'Daily Note Removed';
  }
  if ((prevData.chores?.length || 0) !== (nextData.chores?.length || 0)) {
    return (nextData.chores?.length || 0) > (prevData.chores?.length || 0)
      ? 'Chore Added'
      : 'Chore Removed';
  }
  if (
    prevData.timeline !== nextData.timeline &&
    JSON.stringify(prevData.timeline) !== JSON.stringify(nextData.timeline)
  ) {
    return 'Timeline Edit';
  }
  if (
    prevData.funds !== nextData.funds &&
    JSON.stringify(prevData.funds) !== JSON.stringify(nextData.funds)
  ) {
    return 'Ledger Edit';
  }
  if (
    prevData.bills !== nextData.bills &&
    JSON.stringify(prevData.bills) !== JSON.stringify(nextData.bills)
  ) {
    return 'Bills Edit';
  }
  if (
    prevData.goals !== nextData.goals &&
    JSON.stringify(prevData.goals) !== JSON.stringify(nextData.goals)
  ) {
    return 'Goals & Milestones Edit';
  }
  if (
    prevData.dailyNotes !== nextData.dailyNotes &&
    JSON.stringify(prevData.dailyNotes) !== JSON.stringify(nextData.dailyNotes)
  ) {
    return 'Daily Notes Edit';
  }
  if (
    prevData.chores !== nextData.chores &&
    JSON.stringify(prevData.chores) !== JSON.stringify(nextData.chores)
  ) {
    return 'Chores Edit';
  }
  if (
    prevData.lifeStats !== nextData.lifeStats &&
    JSON.stringify(prevData.lifeStats) !== JSON.stringify(nextData.lifeStats)
  ) {
    return 'Biometrics Edit';
  }
  if (
    prevData.distances !== nextData.distances &&
    JSON.stringify(prevData.distances) !== JSON.stringify(nextData.distances)
  ) {
    return 'Distance Tracker Edit';
  }
  return 'Vault State Update';
}

export function hasCoreDomainMutation(prevData: AppData, nextData: AppData): boolean {
  if (prevData === nextData) return false;
  return (
    (prevData.timeline !== nextData.timeline &&
      JSON.stringify(prevData.timeline) !== JSON.stringify(nextData.timeline)) ||
    (prevData.funds !== nextData.funds &&
      JSON.stringify(prevData.funds) !== JSON.stringify(nextData.funds)) ||
    (prevData.bills !== nextData.bills &&
      JSON.stringify(prevData.bills) !== JSON.stringify(nextData.bills)) ||
    (prevData.goals !== nextData.goals &&
      JSON.stringify(prevData.goals) !== JSON.stringify(nextData.goals)) ||
    (prevData.dailyNotes !== nextData.dailyNotes &&
      JSON.stringify(prevData.dailyNotes) !== JSON.stringify(nextData.dailyNotes)) ||
    (prevData.chores !== nextData.chores &&
      JSON.stringify(prevData.chores) !== JSON.stringify(nextData.chores)) ||
    (prevData.lifeStats !== nextData.lifeStats &&
      JSON.stringify(prevData.lifeStats) !== JSON.stringify(nextData.lifeStats)) ||
    (prevData.distances !== nextData.distances &&
      JSON.stringify(prevData.distances) !== JSON.stringify(nextData.distances))
  );
}

export function pushUndoSnapshot(
  buffer: UndoSnapshotEntry[],
  prevData: AppData,
  label?: string,
  nowMs: number = Date.now()
): UndoSnapshotEntry[] {
  // Avoid deep-cloning heavy Base64 gallery strings on every undo snapshot
  const { gallery, ...restPrev } = prevData;
  const cloned = {
    ...(JSON.parse(JSON.stringify(restPrev)) as AppData),
    gallery: Array.isArray(gallery) ? [...gallery] : [],
  };
  const entry: UndoSnapshotEntry = {
    id: `undo-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    label: label || 'State Update',
    timestamp: nowMs,
    snapshot: cloned,
  };
  const next = [...buffer, entry];
  if (next.length > MAX_UNDO_HISTORY) {
    return next.slice(next.length - MAX_UNDO_HISTORY);
  }
  return next;
}

export function popUndoSnapshot(buffer: UndoSnapshotEntry[]): {
  popped: UndoSnapshotEntry | null;
  remaining: UndoSnapshotEntry[];
} {
  if (!Array.isArray(buffer) || buffer.length === 0) {
    return { popped: null, remaining: [] };
  }
  const remaining = buffer.slice(0, buffer.length - 1);
  const popped = buffer[buffer.length - 1];
  return { popped, remaining };
}

// ============================================================================
// 6. LIVE EXECUTION FOCUS STOPWATCH ENGINE
// ============================================================================

export const DEFAULT_FOCUS_TIMER_STATE: FocusTimerState = {
  isRunning: false,
  isPaused: false,
  startedAtMs: null,
  accumulatedSeconds: 0,
  title: 'Deep Focus Execution',
  category: 'work',
};

export function getFocusTimerElapsedSeconds(
  timer: FocusTimerState,
  nowMs: number = Date.now()
): number {
  if (!timer.isRunning) return 0;
  if (timer.isPaused || !timer.startedAtMs) {
    return Math.max(0, Math.floor(timer.accumulatedSeconds));
  }
  const activeDeltaSec = Math.max(0, Math.floor((nowMs - timer.startedAtMs) / 1000));
  return Math.max(0, Math.floor(timer.accumulatedSeconds) + activeDeltaSec);
}

export function formatStopwatchHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}

export function formatDocumentTitleWithTimer(
  elapsedSeconds: number,
  isActive: boolean,
  baseAppName: string = 'Axiom Aegis',
  fullDefaultTitle?: string
): string {
  if (!isActive) {
    return fullDefaultTitle || baseAppName;
  }
  return `[${formatStopwatchHMS(elapsedSeconds)}] ${baseAppName}`;
}

export function buildTimelineEntryFromFocusTimer(
  timer: FocusTimerState,
  nowMs: number = Date.now(),
  customDateStr?: string
): TimelineEntry {
  const elapsedSeconds = getFocusTimerElapsedSeconds(timer, nowMs);
  const durationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));

  const endDate = new Date(nowMs);
  const startDate = new Date(nowMs - Math.max(60000, elapsedSeconds * 1000));

  const toHHMM = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const endTime = toHHMM(endDate);
  const startTime =
    timer.sessionStartHHMM && /^\d{2}:\d{2}$/.test(timer.sessionStartHHMM)
      ? timer.sessionStartHHMM
      : toHHMM(startDate);
  const dateStr = customDateStr || endDate.toISOString().split('T')[0];

  return {
    id: `focus-${nowMs}`,
    title: (timer.title || 'Deep Focus Execution').trim(),
    category: (timer.category || 'work') as TimelineCategory,
    date: dateStr,
    startTime,
    endTime,
    durationMinutes,
    notes: `Logged via Live Execution Focus Stopwatch (${formatStopwatchHMS(elapsedSeconds)} elapsed).`,
    customFields: {},
    createdAt: nowMs,
  };
}
