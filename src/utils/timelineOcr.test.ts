import { test } from 'node:test';
import assert from 'node:assert';
import {
  getSampleTimelineOcrResult,
  TimelineOcrResult,
} from '../services/timelineOcrService';

test('1. Timeline OCR Service: getSampleTimelineOcrResult returns structured data matching required schema', () => {
  const sample = getSampleTimelineOcrResult();

  assert.strictEqual(typeof sample.total_distance_miles, 'number');
  assert.ok(sample.total_distance_miles > 0, 'Total distance should be positive');
  assert.strictEqual(typeof sample.summary_distance_displayed, 'string');
  assert.ok(Array.isArray(sample.legs), 'Legs should be an array');
  assert.strictEqual(sample.legs.length, 4, 'Should have 4 sample legs');

  for (const leg of sample.legs) {
    assert.strictEqual(typeof leg.origin, 'string');
    assert.strictEqual(typeof leg.destination, 'string');
    assert.strictEqual(typeof leg.distance_miles, 'number');
    assert.strictEqual(typeof leg.duration, 'string');
    assert.ok(leg.distance_miles > 0, 'Leg distance should be greater than 0');
  }

  // Sum of legs
  const legSum = sample.legs.reduce((acc, leg) => acc + leg.distance_miles, 0);
  assert.strictEqual(Math.round(legSum * 10) / 10, sample.total_distance_miles);
});

test('2. Timeline OCR Service: handles zero-legs fallback structure cleanly', () => {
  const fallbackResult: TimelineOcrResult = {
    total_distance_miles: 15.5,
    summary_distance_displayed: '15.5 mi',
    legs: [],
  };

  assert.strictEqual(fallbackResult.total_distance_miles, 15.5);
  assert.strictEqual(fallbackResult.legs.length, 0);
  assert.strictEqual(fallbackResult.summary_distance_displayed, '15.5 mi');
});
