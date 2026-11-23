import { test } from 'node:test';
import assert from 'node:assert';
import {
  parseTimelineOcrText,
  normalizeToMiles,
  recalculateTotalDistance,
} from './timelineRegexParser';

test('1. normalizeToMiles parses miles and km correctly', () => {
  assert.strictEqual(normalizeToMiles('14.2', 'mi'), 14.2);
  assert.strictEqual(normalizeToMiles('14,2', 'miles'), 14.2);
  assert.strictEqual(normalizeToMiles('10', 'km'), 6.2); // 10 * 0.621371 = 6.21371 -> 6.2
  assert.strictEqual(normalizeToMiles('0', 'mi'), 0);
  assert.strictEqual(normalizeToMiles('invalid', 'mi'), 0);
});

test('2. recalculateTotalDistance sums legs accurately with single-decimal rounding', () => {
  const legs = [
    { origin: 'A', destination: 'B', distance_miles: 14.2, duration: '20 min' },
    { origin: 'B', destination: 'C', distance_miles: 6.8, duration: '12 min' },
    { origin: 'C', destination: 'D', distance_miles: 8.5, duration: '15 min' },
  ];
  const total = recalculateTotalDistance(legs);
  assert.strictEqual(total, 29.5);
});

test('3. parseTimelineOcrText extracts Total driving header and excludes it from legs to prevent double counting', () => {
  const rawSample = `
Google Maps Timeline
Thursday, Oct 22
Total driving: 42.6 mi · 1 hr 23 min

Residence / Home Base
Driving · 14.2 mi · 26 min
Tech Campus & Lab

Tech Campus & Lab
Driving · 6.8 mi · 14 min
Regional Park Loop

Regional Park Loop
Driving · 8.5 mi · 18 min
Organic Grocer

Organic Grocer
Driving · 13.1 mi · 25 min
Residence / Home Base
`;

  const parsed = parseTimelineOcrText(rawSample);

  // Summary detected
  assert.strictEqual(parsed.summary_miles, 42.6);
  assert.strictEqual(parsed.summary_distance_displayed, '42.6 mi');

  // Should have 4 legs
  assert.strictEqual(parsed.legs.length, 4);
  assert.strictEqual(parsed.legs[0].distance_miles, 14.2);
  assert.strictEqual(parsed.legs[1].distance_miles, 6.8);
  assert.strictEqual(parsed.legs[2].distance_miles, 8.5);
  assert.strictEqual(parsed.legs[3].distance_miles, 13.1);

  // Total should equal sum of legs (14.2 + 6.8 + 8.5 + 13.1 = 42.6) without double-counting the summary
  assert.strictEqual(parsed.total_distance_miles, 42.6);
});

test('4. parseTimelineOcrText filters out speed limits, percentages, and non-distance numbers', () => {
  const noisyText = `
Battery 98% · 5G
Speed limit: 55 mph
Route 66 highway
Stop 1 to Stop 2: 7.5 miles · 11 mins
Average speed 45 mph
Exit 14B
`;

  const parsed = parseTimelineOcrText(noisyText);

  assert.strictEqual(parsed.legs.length, 1);
  assert.strictEqual(parsed.legs[0].distance_miles, 7.5);
  assert.strictEqual(parsed.total_distance_miles, 7.5);
});

test('5. parseTimelineOcrText falls back to summary total when individual legs are not split', () => {
  const summaryOnlyText = `
Timeline Day Summary
Total distance: 28.4 mi
`;

  const parsed = parseTimelineOcrText(summaryOnlyText);

  assert.strictEqual(parsed.summary_miles, 28.4);
  assert.strictEqual(parsed.legs.length, 0);
  assert.strictEqual(parsed.total_distance_miles, 28.4);
});

test('6. parseTimelineOcrText handles empty or whitespace text gracefully', () => {
  const parsedEmpty = parseTimelineOcrText('');
  assert.strictEqual(parsedEmpty.total_distance_miles, 0);
  assert.strictEqual(parsedEmpty.legs.length, 0);

  const parsedSpaces = parseTimelineOcrText('   \n \t  ');
  assert.strictEqual(parsedSpaces.total_distance_miles, 0);
  assert.strictEqual(parsedSpaces.legs.length, 0);
});
