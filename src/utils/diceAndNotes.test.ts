import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeDailyNote,
  upsertDailyNote,
  filterAndSortDailyNotes,
  groupNotesByPinnedAndMonth,
  parseMarkdownChecklists,
  toggleMarkdownChecklistLine,
  appendQuickScratchpadBullet,
  computeNoteTelemetry,
  TACTICAL_NOTE_TEMPLATES,
  insertTemplateIntoNoteContent,
  insertTextAtCursorOrEnd,
  computeDailyOperationalContext,
  buildDailySnapshotMarkdown,
  syncNoteMoodToLifeStats,
} from './dailyNotesEngine';

test('Daily Notes Engine: sanitizeDailyNote, upsertDailyNote, and filterAndSortDailyNotes', () => {
  const sanitized = sanitizeDailyNote({
    date: '2026-10-23',
    title: '<b>Morning Briefing</b>',
    content: 'Focus on encryption & <script>alert(1)</script>architecture.',
    tags: ['Strategy', 'DEEP-WORK', 'strategy'],
    mood: 9,
    isPinned: true,
  });

  assert.ok(sanitized);
  assert.equal(sanitized.title, 'Morning Briefing');
  assert.equal(sanitized.content, 'Focus on encryption & architecture.');
  assert.deepEqual(sanitized.tags, ['strategy', 'deep-work']);
  assert.equal(sanitized.mood, 9);
  assert.equal(sanitized.isPinned, true);

  const upserted1 = upsertDailyNote([], {
    date: '2026-10-22',
    title: 'Yesterday Log',
    content: 'Completed milestone 1',
    tags: ['ops'],
    isPinned: false,
  });
  assert.ok(upserted1);

  const upserted2 = upsertDailyNote(upserted1.nextNotes, {
    date: '2026-10-23',
    title: 'Today Directive',
    content: 'Launch encrypted daily notes workspace',
    tags: ['launch', 'strategy'],
    isPinned: true,
  });
  assert.ok(upserted2);
  assert.equal(upserted2.nextNotes.length, 2);

  // Pinned note should sort first
  const sorted = filterAndSortDailyNotes(upserted2.nextNotes);
  assert.equal(sorted[0].title, 'Today Directive');

  // Search query filtering
  const searched = filterAndSortDailyNotes(upserted2.nextNotes, 'milestone');
  assert.equal(searched.length, 1);
  assert.equal(searched[0].title, 'Yesterday Log');

  // Tag filtering
  const tagged = filterAndSortDailyNotes(upserted2.nextNotes, '', 'launch');
  assert.equal(tagged.length, 1);
  assert.equal(tagged[0].title, 'Today Directive');
});

test('Tactical Journal Engine: checklist parsing/toggling, templates, cursor insert, and daily operational snapshot', () => {
  const md = `## Command Briefing\n- [ ] Execute Deep Work Block\n- [x] Morning Trail Run`;
  const items = parseMarkdownChecklists(md);
  assert.equal(items.length, 2);
  assert.equal(items[0].checked, false);
  assert.equal(items[0].text, 'Execute Deep Work Block');
  assert.equal(items[1].checked, true);

  const toggled = toggleMarkdownChecklistLine(md, items[0].lineIndex);
  const reParsed = parseMarkdownChecklists(toggled);
  assert.equal(reParsed[0].checked, true);

  const withBullet = appendQuickScratchpadBullet(toggled, 'Verify AES-256-GCM snapshot', true);
  assert.ok(withBullet.includes('- [ ] Verify AES-256-GCM snapshot'));

  const telemetry = computeNoteTelemetry(withBullet);
  assert.ok(telemetry.wordCount > 5);
  assert.equal(telemetry.actionItemCount, 3);
  assert.equal(telemetry.completedActionItemCount, 2);

  // Templates & inline cursor insert
  const withTpl = insertTemplateIntoNoteContent('', TACTICAL_NOTE_TEMPLATES[3]);
  assert.ok(withTpl.includes('Systems Architecture Specification'));

  const inserted = insertTextAtCursorOrEnd('Decision:', '[Verified · 09:30]', 9, 9);
  assert.ok(inserted.nextContent.includes('Decision: [Verified · 09:30]'));

  // Grouping by Pinned & Month
  const grouped = groupNotesByPinnedAndMonth([
    {
      id: 'n1',
      date: '2026-10-27',
      title: 'Oct Note',
      content: 'Content 1',
      tags: ['daily'],
      mood: 9,
      isPinned: true,
      createdAt: 1,
      updatedAt: 1,
    },
    {
      id: 'n2',
      date: '2026-09-15',
      title: 'Sep Note',
      content: 'Content 2',
      tags: ['archive'],
      mood: 8,
      isPinned: false,
      createdAt: 2,
      updatedAt: 2,
    },
  ]);
  assert.equal(grouped.pinned.length, 1);
  assert.equal(grouped.monthGroups.length, 2);
  assert.equal(grouped.monthGroups[0].monthLabel, 'October 2026');

  // Cross-module snapshot & mood sync
  const snapshotMd = buildDailySnapshotMarkdown('2026-10-27', {
    timeline: [
      {
        id: 't1',
        date: '2026-10-27',
        title: 'Morning Deep Work',
        category: 'work',
        startTime: '09:00',
        endTime: '11:00',
        durationMinutes: 120,
        createdAt: 1,
      },
    ],
    lifeStats: [
      {
        id: 'ls1',
        date: '2026-10-27',
        weightLbs: 170.0,
        mood: 9,
        createdAt: 1,
      },
    ],
    funds: [
      {
        id: 'f1',
        date: '2026-10-27',
        type: 'income',
        amount: 250,
        category: 'Consulting',
        description: 'Client Payout',
        createdAt: 1,
      },
    ],
    distances: [
      {
        id: 'd1',
        date: '2026-10-27',
        distance: 5.0,
        unit: 'mi',
        type: 'run',
        description: 'Morning Trail Run',
        createdAt: 1,
      },
    ],
  });
  assert.ok(snapshotMd.includes('### Daily Operational Snapshot — 2026-10-27'));
  assert.ok(snapshotMd.includes('Morning Deep Work'));
  assert.ok(snapshotMd.includes('170 lbs'));

  const ctx = computeDailyOperationalContext('2026-10-27', {
    timeline: [],
    lifeStats: [],
    funds: [],
    distances: [],
  });
  assert.equal(ctx.date, '2026-10-27');

  const syncedStats = syncNoteMoodToLifeStats([], '2026-10-27', 9, 'Command Briefing');
  assert.equal(syncedStats.length, 1);
  assert.equal(syncedStats[0].mood, 9);
  assert.equal(syncedStats[0].date, '2026-10-27');
});
