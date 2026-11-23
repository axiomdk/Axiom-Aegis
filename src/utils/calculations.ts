import {
  BillEntry,
  BillFrequency,
  DistanceEntry,
  DistanceUnit,
  FundEntry,
  GoalEntry,
  LifeStatEntry,
  TimelineEntry,
  WeatherData,
} from '../types';

export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round((lbs / 2.20462) * 10) / 10;
}

export function cmToFtIn(cm: number): { feet: number; inches: number; formatted: string } {
  const totalInches = cm / 2.54;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches % 12);
  if (inches >= 12) {
    feet += 1;
    inches = 0;
  }
  return {
    feet,
    inches,
    formatted: `${feet}' ${inches}"`,
  };
}

export function ftInToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}

/**
 * Calculate duration in minutes between HH:mm start and end time.
 * Handles crossing midnight if end < start.
 */
export function calculateDurationMinutes(startTime: string, endTime: string): number {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  if (endMinutes < startMinutes) {
    // Crosses midnight
    endMinutes += 24 * 60;
  }

  return Math.max(0, endMinutes - startMinutes);
}

/**
 * Format minutes into readable "2h 30m" or "45m"
 */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Convert distance between mi and km
 */
export function convertDistance(value: number, fromUnit: DistanceUnit, toUnit: DistanceUnit): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'mi' && toUnit === 'km') {
    return value * 1.609344;
  }
  // km to mi
  return value * 0.621371;
}

/**
 * Resolves the active statement month (YYYY-MM) from a set of dated entries or reference date.
 * Defaults to the latest logged statement month (YYYY-MM) when entries exist, or the reference/current month.
 */
export function resolveActiveStatementMonth(
  entries: Array<{ date?: string }>,
  referenceDateStr?: string
): string {
  const fallbackMonth = (referenceDateStr || new Date().toISOString().split('T')[0]).slice(0, 7);
  if (!Array.isArray(entries) || entries.length === 0) {
    return /^\d{4}-\d{2}$/.test(fallbackMonth) ? fallbackMonth : new Date().toISOString().slice(0, 7);
  }
  // If referenceDateStr is explicitly provided as YYYY-MM or YYYY-MM-DD and matches entries, or if we want latest statement month:
  if (referenceDateStr && /^\d{4}-\d{2}/.test(referenceDateStr.trim())) {
    const requestedMonth = referenceDateStr.trim().slice(0, 7);
    const hasEntriesInRequested = entries.some(
      (e) => typeof e?.date === 'string' && e.date.slice(0, 7) === requestedMonth
    );
    if (hasEntriesInRequested) {
      return requestedMonth;
    }
  }
  let latestMonth = '';
  for (const entry of entries) {
    const d = typeof entry?.date === 'string' ? entry.date.trim().slice(0, 7) : '';
    if (/^\d{4}-\d{2}$/.test(d) && d > latestMonth) {
      latestMonth = d;
    }
  }
  return latestMonth || fallbackMonth;
}

/**
 * Formats a YYYY-MM string into a readable Monthly Statement label (e.g., "Oct 2026").
 */
export function formatStatementMonthLabel(monthIso: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec((monthIso || '').trim());
  if (!match) return monthIso || 'Current Month';
  const year = Number(match[1]);
  const monthIdx = Number(match[2]) - 1;
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
  return `${monthNames[monthIdx] || match[2]} ${year}`;
}

/**
 * Calculate funds summary strictly on all-time ledger + active Monthly Statement cycle (YYYY-MM).
 */
export function calculateFundsSummary(
  entries: FundEntry[],
  startingBalance: number = 0,
  statementMonth?: string
) {
  let totalIncome = 0;
  let totalExpense = 0;
  let monthlyStatementIncome = 0;
  let monthlyStatementExpense = 0;
  let monthlyStatementCount = 0;

  const activeStatementMonth = resolveActiveStatementMonth(entries, statementMonth);

  for (const entry of entries) {
    const amt = Number(entry.amount) || 0;
    const isStatementMonth =
      typeof entry.date === 'string' && entry.date.trim().slice(0, 7) === activeStatementMonth;

    if (entry.type === 'income') {
      totalIncome += amt;
      if (isStatementMonth) {
        monthlyStatementIncome += amt;
        monthlyStatementCount += 1;
      }
    } else if (entry.type === 'expense') {
      totalExpense += amt;
      if (isStatementMonth) {
        monthlyStatementExpense += amt;
        monthlyStatementCount += 1;
      }
    }
  }

  const netCashFlow = totalIncome - totalExpense;
  const currentBalance = startingBalance + netCashFlow;
  const monthlyStatementNet = monthlyStatementIncome - monthlyStatementExpense;

  return {
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpense: Math.round(totalExpense * 100) / 100,
    netCashFlow: Math.round(netCashFlow * 100) / 100,
    currentBalance: Math.round(currentBalance * 100) / 100,
    transactionCount: entries.length,
    activeStatementMonth,
    activeStatementMonthLabel: formatStatementMonthLabel(activeStatementMonth),
    monthlyStatementIncome: Math.round(monthlyStatementIncome * 100) / 100,
    monthlyStatementExpense: Math.round(monthlyStatementExpense * 100) / 100,
    monthlyStatementNet: Math.round(monthlyStatementNet * 100) / 100,
    monthlyStatementCount,
  };
}

/**
 * Parses a YYYY-MM-DD (or ISO) string into UTC midnight timestamp (ms) for accurate calendar-day math.
 */
export function parseCalendarDateUtcMs(dateStr: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const y = Number(isoMatch[1]);
    const m = Number(isoMatch[2]);
    const d = Number(isoMatch[3]);
    return Date.UTC(y, m - 1, d);
  }
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

/**
 * Calculate distance summary strictly on Monthly Statement calendar cycle (YYYY-MM) and all-time total.
 * Completely removes 7-day rolling distance metrics.
 */
export function calculateDistanceSummary(
  entries: DistanceEntry[],
  displayUnit: DistanceUnit = 'mi',
  statementMonthOrDateStr?: string
) {
  let total = 0;
  const byType: Record<string, number> = {
    walk: 0,
    run: 0,
    cycle: 0,
    drive: 0,
    flight: 0,
    other: 0,
  };

  const activeStatementMonth = resolveActiveStatementMonth(entries, statementMonthOrDateStr);
  let monthlyStatementTotal = 0;
  let monthlyStatementEntriesCount = 0;

  for (const entry of entries) {
    const converted = convertDistance(entry.distance, entry.unit, displayUnit);
    total += converted;
    if (byType[entry.type] !== undefined) {
      byType[entry.type] += converted;
    } else {
      byType.other += converted;
    }

    if (typeof entry.date === 'string' && entry.date.trim().slice(0, 7) === activeStatementMonth) {
      monthlyStatementTotal += converted;
      monthlyStatementEntriesCount += 1;
    }
  }

  return {
    total: Math.round(total * 10) / 10,
    displayUnit,
    byType,
    activeStatementMonth,
    activeStatementMonthLabel: formatStatementMonthLabel(activeStatementMonth),
    monthlyStatementTotal: Math.round(monthlyStatementTotal * 10) / 10,
    monthlyStatementEntriesCount,
  };
}

/**
 * Compute timeline metrics (ensuring duration fallback from startTime/endTime if durationMinutes is missing/0)
 */
export function calculateTimelineSummary(entries: TimelineEntry[]) {
  const byCategory: Record<string, number> = {};
  let totalMinutes = 0;
  let focusMinutes = 0;

  for (const entry of entries) {
    const dur =
      typeof entry.durationMinutes === 'number' && entry.durationMinutes > 0
        ? entry.durationMinutes
        : calculateDurationMinutes(entry.startTime, entry.endTime);
    totalMinutes += dur;
    const cat = entry.category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + dur;

    const lowerCat = cat.toLowerCase();
    if (
      lowerCat === 'work' ||
      lowerCat === 'learning' ||
      lowerCat === 'focus' ||
      lowerCat.includes('work') ||
      lowerCat.includes('learn') ||
      lowerCat.includes('study')
    ) {
      focusMinutes += dur;
    }
  }

  return {
    totalMinutes,
    formattedTotal: formatMinutes(totalMinutes),
    focusMinutes,
    formattedFocusTotal: formatMinutes(focusMinutes),
    byCategory,
    totalCount: entries.length,
  };
}

/**
 * Reconciles financial goals and dollar-threshold milestones against the live Net Funds Balance
 * so milestones like "Hit $10,000 foundation" or "Hit $15,000 milestone" are unchecked when
 * live Net Funds Balance is below the target threshold.
 */
export function reconcileGoalsWithNetBalance(
  goals: GoalEntry[],
  netBalance: number
): GoalEntry[] {
  if (!Array.isArray(goals)) return [];
  const safeBalance = Math.max(0, Math.round((Number(netBalance) || 0) * 100) / 100);

  return goals.map((goal) => {
    const isFinancialGoal =
      goal.category?.toLowerCase() === 'financial' ||
      goal.unit === '$' ||
      goal.id === 'g-2' ||
      /\$\s*[0-9,]+|\breserve\s+fund\b/i.test(goal.title || '');

    if (!isFinancialGoal) {
      return goal;
    }

    const updatedMilestones = (goal.milestones || []).map((ms) => {
      const thresholdMatch = /\$\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]+)?)/.exec(
        ms.title || ''
      );
      if (!thresholdMatch) {
        return ms;
      }
      const thresholdValue = parseFloat(thresholdMatch[1].replace(/,/g, ''));
      if (isNaN(thresholdValue) || thresholdValue <= 0) {
        return ms;
      }
      // If live Net Funds Balance is below the threshold, milestone cannot be marked DONE
      if (safeBalance < thresholdValue) {
        return {
          ...ms,
          completed: false,
        };
      }
      return ms;
    });

    const allDone =
      updatedMilestones.length > 0 && updatedMilestones.every((m) => m.completed);

    const shouldSyncCurrentValue =
      goal.id === 'g-2' ||
      /\breserve\s+fund\b/i.test(goal.title || '') ||
      (goal.currentValue === 18500 && safeBalance < 10000);

    return {
      ...goal,
      currentValue: shouldSyncCurrentValue ? safeBalance : goal.currentValue,
      milestones: updatedMilestones,
      status: allDone
        ? 'completed'
        : goal.status === 'completed' && !allDone
        ? 'in_progress'
        : goal.status || 'in_progress',
    };
  });
}

/**
 * Compute life stats trend (Imperial primary with pounds & feet/inches)
 */
export function calculateStatsSummary(entries: LifeStatEntry[]) {
  if (entries.length === 0) {
    return {
      averageMood: 0,
      latestMood: 0,
      latestWeightLbs: null,
      weightChangeLbs: 0,
      latestAge: null,
      latestHeightFormatted: null,
      latestIncome: null,
    };
  }

  const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const totalMood = sorted.reduce((acc, e) => acc + (e.mood || 0), 0);
  const avgMood = Math.round((totalMood / sorted.length) * 10) / 10;

  const weights = sorted
    .map((e) => {
      if (e.weightLbs !== undefined && e.weightLbs !== null && !isNaN(e.weightLbs)) {
        return e.weightLbs;
      }
      if (e.weightKg !== undefined && e.weightKg !== null && !isNaN(e.weightKg)) {
        return kgToLbs(e.weightKg);
      }
      return null;
    })
    .filter((w): w is number => w !== null);

  const latestWeightLbs = weights.length > 0 ? weights[weights.length - 1] : null;
  const firstWeightLbs = weights.length > 1 ? weights[0] : null;
  const weightChangeLbs =
    latestWeightLbs && firstWeightLbs
      ? Math.round((latestWeightLbs - firstWeightLbs) * 10) / 10
      : 0;

  const latestEntry = sorted[sorted.length - 1];

  let latestHeightFormatted = null;
  if (latestEntry.heightFt !== undefined && latestEntry.heightIn !== undefined) {
    latestHeightFormatted = `${latestEntry.heightFt}' ${latestEntry.heightIn}"`;
  } else if (latestEntry.heightCm) {
    latestHeightFormatted = cmToFtIn(latestEntry.heightCm).formatted;
  }

  return {
    averageMood: avgMood,
    latestMood: latestEntry.mood,
    latestWeightLbs,
    weightChangeLbs,
    latestAge: latestEntry.age,
    latestHeightFormatted,
    latestIncome: latestEntry.weeklyIncome,
  };
}

/**
 * Calculate goal percentage progress (0 to 100)
 */
export function calculateGoalProgress(goal: GoalEntry): number {
  if (goal.status === 'completed') return 100;

  // If milestone based
  if (goal.milestones && goal.milestones.length > 0) {
    const completedCount = goal.milestones.filter((m) => m.completed).length;
    return Math.round((completedCount / goal.milestones.length) * 100);
  }

  // If numerical target based
  if (goal.targetValue && goal.targetValue > 0 && goal.currentValue !== undefined) {
    const pct = Math.round((goal.currentValue / goal.targetValue) * 100);
    return Math.min(100, Math.max(0, pct));
  }

  return 0;
}

/**
 * Weather interpretation code mapper
 */
export function interpretWeatherCode(code: number): string {
  switch (code) {
    case 0:
      return 'Clear Sky';
    case 1:
      return 'Mainly Clear';
    case 2:
      return 'Partly Cloudy';
    case 3:
      return 'Overcast';
    case 45:
    case 48:
      return 'Foggy';
    case 51:
    case 53:
    case 55:
      return 'Drizzle';
    case 61:
    case 63:
    case 65:
      return 'Rain';
    case 71:
    case 73:
    case 75:
      return 'Snow Fall';
    case 77:
      return 'Snow Grains';
    case 80:
    case 81:
    case 82:
      return 'Rain Showers';
    case 85:
    case 86:
      return 'Snow Showers';
    case 95:
    case 96:
    case 99:
      return 'Thunderstorm';
    default:
      return 'Fair';
  }
}

export interface GeocodedLocationResult {
  city: string;
  lat: number;
  lon: number;
}

/**
 * Geocode a city name or ZIP/postal code via Open-Meteo Geocoding API (no API key required).
 */
export async function searchWeatherLocation(query: string): Promise<GeocodedLocationResult | null> {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return null;

  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      cleanQuery
    )}&count=1&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{
        name: string;
        admin1?: string;
        country_code?: string;
        latitude: number;
        longitude: number;
      }>;
    };
    const match = data.results?.[0];
    if (!match) return null;

    const region = match.admin1 || match.country_code || '';
    const cityLabel = region ? `${match.name}, ${region}` : match.name;
    return {
      city: cityLabel,
      lat: Number(match.latitude.toFixed(4)),
      lon: Number(match.longitude.toFixed(4)),
    };
  } catch {
    return null;
  }
}

/**
 * Reverse geocode browser geolocation coordinates into a clean City, Region label.
 */
export async function reverseGeocodeWeatherCoords(
  lat: number,
  lon: number
): Promise<GeocodedLocationResult> {
  const roundedLat = Number(lat.toFixed(4));
  const roundedLon = Number(lon.toFixed(4));
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${roundedLat}&longitude=${roundedLon}&localityLanguage=en`;
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as {
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryCode?: string;
      };
      const name = data.city || data.locality || '';
      const region = data.principalSubdivision || data.countryCode || '';
      if (name) {
        return {
          city: region ? `${name}, ${region}` : name,
          lat: roundedLat,
          lon: roundedLon,
        };
      }
    }
  } catch {
    // Fallback to coordinate label below
  }

  return {
    city: `Local (${roundedLat.toFixed(2)}, ${roundedLon.toFixed(2)})`,
    lat: roundedLat,
    lon: roundedLon,
  };
}

/**
 * Pull live weather for user-configured coordinates via Open-Meteo.
 * Returns null when location is unconfigured.
 */
export async function fetchLiveWeather(
  cityName: string = '',
  lat: number = 0,
  lon: number = 0
): Promise<WeatherData | null> {
  const trimmedCity = (cityName || '').trim();
  if (!trimmedCity || (lat === 0 && lon === 0)) {
    return null;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather fetch returned non-200');
    const data = await res.json();
    const current = data.current;

    return {
      city: trimmedCity,
      temperature: Math.round(current.temperature_2m),
      condition: interpretWeatherCode(current.weather_code),
      humidity: current.relative_humidity_2m,
      windSpeed: Math.round(current.wind_speed_10m),
      weatherCode: current.weather_code,
      lastUpdated: Date.now(),
    };
  } catch {
    // Offline fallback reading for configured city
    return {
      city: trimmedCity,
      temperature: 64,
      condition: 'Clear Sky',
      humidity: 55,
      windSpeed: 6,
      weatherCode: 1,
      lastUpdated: Date.now(),
    };
  }
}

export interface BillDueEvaluation {
  status: 'paid' | 'overdue' | 'due_soon' | 'upcoming';
  statusLabel: 'PAID' | 'OVERDUE' | 'DUE SOON' | 'UPCOMING';
  daysUntilDue: number | null;
  formattedDueDate: string;
}

export function normalizeBillMonthlyEquivalent(amount: number, frequency: BillFrequency): number {
  const safeAmount = Number.isFinite(Number(amount)) ? Math.max(0, Number(amount)) : 0;
  switch (frequency) {
    case 'weekly':
      return safeAmount * (52 / 12);
    case 'biweekly':
      return safeAmount * (26 / 12);
    case 'yearly':
      return safeAmount / 12;
    case 'once':
    case 'monthly':
    default:
      return safeAmount;
  }
}

export function getDaysInCalendarMonth(year: number, month1Indexed: number): number {
  const safeYear = Number.isFinite(year) && year > 1900 ? Math.trunc(year) : 2026;
  const safeMonth =
    Number.isFinite(month1Indexed) && month1Indexed >= 1 && month1Indexed <= 12
      ? Math.trunc(month1Indexed)
      : 1;
  return new Date(Date.UTC(safeYear, safeMonth, 0)).getUTCDate();
}

export function evaluateBillDueStatus(
  bill: Pick<BillEntry, 'dueDate' | 'isPaid' | 'frequency'>,
  todayIso?: string
): BillDueEvaluation {
  const rawToday = (todayIso || new Date().toISOString().slice(0, 10)).trim();
  const todayMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(rawToday);
  const currentYear = todayMatch ? Number(todayMatch[1]) : new Date().getUTCFullYear();
  const currentMonth = todayMatch ? Number(todayMatch[2]) : new Date().getUTCMonth() + 1;
  const maxCurrentMonthDays = getDaysInCalendarMonth(currentYear, currentMonth);
  const rawCurrentDay = todayMatch ? Number(todayMatch[3]) : new Date().getUTCDate();
  const currentDay = Math.min(Math.max(1, rawCurrentDay), maxCurrentMonthDays);
  const currentIso = `${String(currentYear).padStart(4, '0')}-${String(currentMonth).padStart(
    2,
    '0'
  )}-${String(currentDay).padStart(2, '0')}`;

  const rawDue = (bill.dueDate || '').trim();

  // Format display string
  let formattedDueDate = rawDue || 'No Due Date';
  let daysUntilDue: number | null = null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDue);
  if (isoMatch) {
    const dueYear = Number(isoMatch[1]);
    const dueMonth = Math.min(12, Math.max(1, Number(isoMatch[2])));
    const maxDaysInDueMonth = getDaysInCalendarMonth(dueYear, dueMonth);
    const clampedDueDay = Math.min(Math.max(1, Number(isoMatch[3])), maxDaysInDueMonth);
    const normalizedDueIso = `${String(dueYear).padStart(4, '0')}-${String(dueMonth).padStart(
      2,
      '0'
    )}-${String(clampedDueDay).padStart(2, '0')}`;

    formattedDueDate = normalizedDueIso;
    const todayMs = Date.parse(`${currentIso}T00:00:00Z`);
    const dueMs = Date.parse(`${normalizedDueIso}T00:00:00Z`);
    if (Number.isFinite(todayMs) && Number.isFinite(dueMs)) {
      daysUntilDue = Math.round((dueMs - todayMs) / 86_400_000);
    }
  } else {
    const dayMatch = rawDue.match(/(?:^|\D)(3[01]|[12]\d|[1-9])(?:st|nd|rd|th)?(?:\b|$|\D)/i);
    if (dayMatch) {
      const dueDay = Number(dayMatch[1]);
      const effectiveDueDay = Math.min(dueDay, maxCurrentMonthDays);
      daysUntilDue = effectiveDueDay - currentDay;
      const suffix =
        dueDay % 10 === 1 && dueDay !== 11
          ? 'st'
          : dueDay % 10 === 2 && dueDay !== 12
          ? 'nd'
          : dueDay % 10 === 3 && dueDay !== 13
          ? 'rd'
          : 'th';
      formattedDueDate = `Day ${dueDay} (${dueDay}${suffix})`;
    }
  }

  if (bill.isPaid) {
    return {
      status: 'paid',
      statusLabel: 'PAID',
      daysUntilDue,
      formattedDueDate,
    };
  }

  if (daysUntilDue !== null) {
    if (daysUntilDue < 0) {
      return {
        status: 'overdue',
        statusLabel: 'OVERDUE',
        daysUntilDue,
        formattedDueDate,
      };
    }
    if (daysUntilDue <= 5) {
      return {
        status: 'due_soon',
        statusLabel: 'DUE SOON',
        daysUntilDue,
        formattedDueDate,
      };
    }
  }

  return {
    status: 'upcoming',
    statusLabel: 'UPCOMING',
    daysUntilDue,
    formattedDueDate,
  };
}

export interface BillsSummaryMetrics {
  totalMonthlyBills: number;
  totalRawAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  paidCount: number;
  unpaidCount: number;
  overdueCount: number;
  dueSoonCount: number;
  autoPayCount: number;
}

export function calculateBillsSummary(
  bills: BillEntry[] | null | undefined,
  todayIso?: string
): BillsSummaryMetrics {
  const list = Array.isArray(bills) ? bills : [];
  let totalMonthlyBills = 0;
  let totalRawAmount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let autoPayCount = 0;

  for (const bill of list) {
    const amount = Number.isFinite(Number(bill.amount)) ? Math.max(0, Number(bill.amount)) : 0;
    totalRawAmount += amount;
    totalMonthlyBills += normalizeBillMonthlyEquivalent(amount, bill.frequency || 'monthly');

    if (bill.autoPay) {
      autoPayCount += 1;
    }

    if (bill.isPaid) {
      paidAmount += amount;
      paidCount += 1;
    } else {
      unpaidAmount += amount;
      unpaidCount += 1;
      const evalStatus = evaluateBillDueStatus(bill, todayIso);
      if (evalStatus.status === 'overdue') {
        overdueCount += 1;
      } else if (evalStatus.status === 'due_soon') {
        dueSoonCount += 1;
      }
    }
  }

  return {
    totalMonthlyBills: Math.round(totalMonthlyBills * 100) / 100,
    totalRawAmount: Math.round(totalRawAmount * 100) / 100,
    paidAmount: Math.round(paidAmount * 100) / 100,
    unpaidAmount: Math.round(unpaidAmount * 100) / 100,
    paidCount,
    unpaidCount,
    overdueCount,
    dueSoonCount,
    autoPayCount,
  };
}

