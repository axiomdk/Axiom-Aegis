import { test } from 'node:test';
import assert from 'node:assert';
import {
  addDaysToIsoDate,
  buildCalendarMonthGrid,
  computeDayVisualFlowBlocks,
  createTimelineEntryForCalendarDate,
  DEFAULT_CALENDAR_OVERLAYS,
  expandTimelineEntryToDailySegments,
  getCalendarDayInspectorData,
  getUpcomingScheduleSegments,
  minutesToTimeString,
  parseTimeToMinutes,
} from './calendarEngine';
import { createInitialAppData, DEFAULT_FREQUENT_EVENTS } from './defaults';
import { TimelineEntry } from '../types';

test('Calendar Engine: parseTimeToMinutes, minutesToTimeString & addDaysToIsoDate work accurately', () => {
  assert.strictEqual(parseTimeToMinutes('00:00'), 0);
  assert.strictEqual(parseTimeToMinutes('09:30'), 570);
  assert.strictEqual(parseTimeToMinutes('23:45'), 1425);

  assert.strictEqual(minutesToTimeString(0), '00:00');
  assert.strictEqual(minutesToTimeString(570), '09:30');
  assert.strictEqual(minutesToTimeString(1440), '24:00');

  assert.strictEqual(addDaysToIsoDate('2026-10-30', 1), '2026-10-31');
  assert.strictEqual(addDaysToIsoDate('2026-10-31', 1), '2026-11-01');
  assert.strictEqual(addDaysToIsoDate('2026-10-26', -2), '2026-10-24');
});

test('Calendar Engine: expandTimelineEntryToDailySegments splits overnight and >24h multi-day trips across dates', () => {
  // 1. Standard single-day activity
  const singleEntry: TimelineEntry = {
    id: 't-single',
    title: 'Deep Architecture Session',
    category: 'work',
    date: '2026-10-26',
    startTime: '09:00',
    endTime: '11:30',
    durationMinutes: 150,
    createdAt: Date.now(),
  };
  const singleSegs = expandTimelineEntryToDailySegments(singleEntry);
  assert.strictEqual(singleSegs.length, 1);
  assert.strictEqual(singleSegs[0].isMultiDay, false);
  assert.strictEqual(singleSegs[0].spanPosition, 'single');
  assert.strictEqual(singleSegs[0].segmentDurationMinutes, 150);

  // 2. Overnight activity crossing midnight (22:00 -> 02:00 = 240 mins)
  const overnightEntry: TimelineEntry = {
    id: 't-overnight',
    title: 'Night Flight to Austin',
    category: 'personal',
    date: '2026-10-26',
    startTime: '22:00',
    endTime: '02:00',
    durationMinutes: 240,
    createdAt: Date.now(),
  };
  const overnightSegs = expandTimelineEntryToDailySegments(overnightEntry);
  assert.strictEqual(overnightSegs.length, 2);
  assert.strictEqual(overnightSegs[0].date, '2026-10-26');
  assert.strictEqual(overnightSegs[0].spanPosition, 'start');
  assert.strictEqual(overnightSegs[0].displayStartTime, '22:00');
  assert.strictEqual(overnightSegs[0].displayEndTime, '24:00');
  assert.strictEqual(overnightSegs[0].segmentDurationMinutes, 120);

  assert.strictEqual(overnightSegs[1].date, '2026-10-27');
  assert.strictEqual(overnightSegs[1].spanPosition, 'end');
  assert.strictEqual(overnightSegs[1].displayStartTime, '00:00');
  assert.strictEqual(overnightSegs[1].displayEndTime, '02:00');
  assert.strictEqual(overnightSegs[1].segmentDurationMinutes, 120);

  // 3. Multi-day >24h trip (e.g., 50 hours = 3000 mins starting 10:00 on 2026-10-26)
  // Day 1 (Oct 26): 10:00 -> 24:00 (14h = 840m)
  // Day 2 (Oct 27): 00:00 -> 24:00 (24h = 1440m)
  // Day 3 (Oct 28): 00:00 -> 12:00 (12h = 720m)
  const multiDayTrip: TimelineEntry = {
    id: 't-multiday',
    title: 'Cross-State OCR Expedition',
    category: 'other',
    date: '2026-10-26',
    startTime: '10:00',
    endTime: '12:00',
    durationMinutes: 3000,
    createdAt: Date.now(),
  };
  const multiSegs = expandTimelineEntryToDailySegments(multiDayTrip);
  assert.strictEqual(multiSegs.length, 3);
  assert.strictEqual(multiSegs[0].date, '2026-10-26');
  assert.strictEqual(multiSegs[0].spanPosition, 'start');
  assert.strictEqual(multiSegs[0].segmentDurationMinutes, 840);
  assert.strictEqual(multiSegs[1].date, '2026-10-27');
  assert.strictEqual(multiSegs[1].spanPosition, 'middle');
  assert.strictEqual(multiSegs[1].segmentDurationMinutes, 1440);
  assert.strictEqual(multiSegs[2].date, '2026-10-28');
  assert.strictEqual(multiSegs[2].spanPosition, 'end');
  assert.strictEqual(multiSegs[2].segmentDurationMinutes, 720);
});

test('Calendar Engine: buildCalendarMonthGrid & cross-module overlays respect category & layer toggles', () => {
  const appData = createInitialAppData('Axiom Aegis', 'User');
  const targetDate = '2026-10-26';
  appData.timeline = [
    {
      id: 't-cal-1',
      title: 'Deep Work Block',
      category: 'work',
      date: targetDate,
      startTime: '08:00',
      endTime: '10:00',
      durationMinutes: 120,
      createdAt: Date.now(),
    },
    {
      id: 't-cal-2',
      title: 'Evening Trail Run',
      category: 'health',
      date: targetDate,
      startTime: '17:00',
      endTime: '18:00',
      durationMinutes: 60,
      createdAt: Date.now(),
    },
  ];
  appData.dailyNotes = [
    {
      id: 'n-cal-1',
      date: targetDate,
      title: 'Oct 26 Briefing',
      content: 'Focus on calendar sync.',
      tags: ['ops'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];
  appData.goals = [
    {
      id: 'g-cal-1',
      title: 'Launch Unified Calendar',
      category: 'career',
      targetDate: targetDate,
      milestones: [],
      status: 'in_progress',
      createdAt: Date.now(),
    },
  ];
  appData.funds = [
    {
      id: 'f-cal-1',
      date: targetDate,
      type: 'income',
      amount: 500,
      category: 'Retainer',
      description: 'Milestone payout',
      createdAt: Date.now(),
    },
    {
      id: 'f-cal-2',
      date: targetDate,
      type: 'expense',
      amount: 45.5,
      category: 'Hardware',
      description: 'Cable adapter',
      createdAt: Date.now(),
    },
  ];
  appData.distances = [
    {
      id: 'd-cal-1',
      date: targetDate,
      distance: 5.2,
      unit: 'mi',
      type: 'run',
      description: 'Lake loop',
      createdAt: Date.now(),
    },
  ];

  // Build October 2026 grid (month = 9)
  const fullGrid = buildCalendarMonthGrid(
    2026,
    9,
    appData,
    'all',
    DEFAULT_CALENDAR_OVERLAYS,
    targetDate
  );
  assert.strictEqual(fullGrid.length, 42);

  const cell = fullGrid.find((c) => c.date === targetDate);
  assert.ok(cell);
  assert.strictEqual(cell.isToday, true);
  assert.strictEqual(cell.segments.length, 2);
  assert.strictEqual(cell.totalFocusMinutes, 180);
  assert.strictEqual(cell.notes.length, 1);
  assert.strictEqual(cell.goalsDue.length, 1);
  assert.strictEqual(cell.netFundsAmount, 454.5);
  assert.strictEqual(cell.totalDistanceMiles, 5.2);

  // Filter by 'work' category and disable overlays
  const filteredCell = getCalendarDayInspectorData(
    targetDate,
    appData,
    'work',
    {
      showNotes: false,
      showGoals: false,
      showFunds: false,
      showDistances: false,
    },
    targetDate
  );
  assert.strictEqual(filteredCell.segments.length, 1);
  assert.strictEqual(filteredCell.segments[0].entry.title, 'Deep Work Block');
  assert.strictEqual(filteredCell.notes.length, 0);
  assert.strictEqual(filteredCell.goalsDue.length, 0);
  assert.strictEqual(filteredCell.funds.length, 0);
  assert.strictEqual(filteredCell.distances.length, 0);

  // Verify 24h visual flow blocks
  const flowBlocks = computeDayVisualFlowBlocks(cell.segments);
  assert.strictEqual(flowBlocks.length, 2);
  assert.ok(flowBlocks[0].leftPercent > 0);
  assert.ok(flowBlocks[0].widthPercent > 0);
});

test('Calendar Engine: createTimelineEntryForCalendarDate & getUpcomingScheduleSegments', () => {
  assert.strictEqual(DEFAULT_FREQUENT_EVENTS.length, 0);
  const fe = {
    id: 'fe-test-1',
    title: 'Architecture Review',
    category: 'work',
    durationMinutes: 90,
    startTime: '09:00',
    endTime: '10:30',
  };
  const entry = createTimelineEntryForCalendarDate(fe, '2026-11-15');
  assert.strictEqual(entry.date, '2026-11-15');
  assert.strictEqual(entry.title, fe.title);
  assert.strictEqual(entry.durationMinutes, fe.durationMinutes);

  const upcoming = getUpcomingScheduleSegments([entry], '2026-11-01', 5);
  assert.strictEqual(upcoming.length, 1);
  assert.strictEqual(upcoming[0].date, '2026-11-15');
});
