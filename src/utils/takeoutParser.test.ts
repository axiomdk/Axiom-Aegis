import { test } from 'node:test';
import assert from 'node:assert';
import { parseGoogleTakeoutJson } from './takeoutParser';

test('parseGoogleTakeoutJson parses semantic timelineObjects into distances and timeline entries', () => {
  const takeoutData = {
    timelineObjects: [
      {
        activitySegment: {
          startLocation: { latitudeE7: 425330000, longitudeE7: -835150000 },
          endLocation: { latitudeE7: 425400000, longitudeE7: -835200000 },
          duration: {
            startTimestamp: "2026-10-21T07:15:00Z",
            endTimestamp: "2026-10-21T08:00:00Z"
          },
          distance: 5240, // ~3.26 miles
          activityType: "RUNNING"
        }
      },
      {
        placeVisit: {
          location: {
            address: "Central Park Trail, US",
            name: "Central Park Trail"
          },
          duration: {
            startTimestamp: "2026-10-21T08:00:00Z",
            endTimestamp: "2026-10-21T08:45:00Z"
          }
        }
      }
    ]
  };

  const res = parseGoogleTakeoutJson(JSON.stringify(takeoutData), 'mi', [], []);
  assert.strictEqual(res.sourceFormat, 'semantic_timeline');
  assert.strictEqual(res.totalDistanceFound, 1);
  assert.strictEqual(res.totalTimelineFound, 2);

  const dist = res.distances[0];
  assert.strictEqual(dist.type, 'run');
  assert.strictEqual(dist.distance, 3.26);
  assert.strictEqual(dist.isDuplicate, false);
  assert.strictEqual(dist.selected, true);

  const timeRun = res.timeline[0];
  assert.strictEqual(timeRun.category, 'health');
  assert.strictEqual(timeRun.durationMinutes, 45);

  const timePlace = res.timeline[1];
  assert.strictEqual(timePlace.category, 'personal');
  assert.ok(timePlace.title.includes('Central Park Trail'));
});

test('parseGoogleTakeoutJson detects duplicate entries against existing logs', () => {
  const takeoutData = {
    timelineObjects: [
      {
        activitySegment: {
          duration: {
            startTimestamp: "2026-10-21T07:15:00Z",
            endTimestamp: "2026-10-21T08:00:00Z"
          },
          distance: 5240,
          activityType: "RUNNING"
        }
      }
    ]
  };

  const existingDistances = [
    {
      id: 'd1',
      date: '2026-10-21',
      distance: 3.26,
      unit: 'mi' as const,
      type: 'run' as const,
      description: 'Morning run',
      createdAt: 1000
    }
  ];

  const res = parseGoogleTakeoutJson(JSON.stringify(takeoutData), 'mi', existingDistances, []);
  assert.strictEqual(res.distances[0].isDuplicate, true);
  assert.strictEqual(res.distances[0].selected, false);
});
