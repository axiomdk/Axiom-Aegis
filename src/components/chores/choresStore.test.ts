import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHORES_STORAGE_KEY,
  ChoreItem,
  addChore,
  deleteChore,
  getChoresSummary,
  loadChoresFromStorage,
  parseChoresFromStorage,
  recordDeletedItemTombstones,
  sanitizeChoreTitle,
  saveChoresToStorage,
  toggleChore,
} from './choresStore';

test('sanitizeChoreTitle trims whitespace and collapses control characters', () => {
  assert.equal(sanitizeChoreTitle('  Take out trash \n\t '), 'Take out trash');
  assert.equal(sanitizeChoreTitle('   \t\n  '), '');
  assert.equal(sanitizeChoreTitle(null), '');
  assert.equal(sanitizeChoreTitle(42), '');
});

test('addChore rejects empty or whitespace-only titles without mutating list', () => {
  const initial: ChoreItem[] = [
    { id: 'c1', title: 'Sweep porch', completed: false, createdAt: 100 },
  ];

  const emptyResult = addChore(initial, '   \n ', 200);
  assert.equal(emptyResult.added, null);
  assert.deepEqual(emptyResult.items, initial);
  assert.notEqual(emptyResult.items, initial);
});

test('addChore prepends sanitized chore item with default incomplete status', () => {
  const existing: ChoreItem[] = [
    { id: 'c1', title: 'Wash dishes', completed: true, createdAt: 100 },
  ];

  const { items, added } = addChore(existing, '  Take out trash  ', 500, 'c2');
  assert.ok(added);
  assert.equal(added.id, 'c2');
  assert.equal(added.title, 'Take out trash');
  assert.equal(added.completed, false);
  assert.equal(added.createdAt, 500);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, 'c2');
  assert.equal(items[1].id, 'c1');
});

test('toggleChore flips completion state immutably for matching ID only', () => {
  const initial: ChoreItem[] = [
    { id: 'c1', title: 'Take out trash', completed: false, createdAt: 100 },
    { id: 'c2', title: 'Wash dishes', completed: true, createdAt: 90 },
  ];

  const toggledOnce = toggleChore(initial, 'c1');
  assert.equal(toggledOnce[0].completed, true);
  assert.equal(toggledOnce[1].completed, true);
  assert.equal(initial[0].completed, false);

  const toggledTwice = toggleChore(toggledOnce, 'c1', 900);
  assert.equal(toggledTwice[0].completed, false);
  assert.equal(toggledTwice[0].updatedAt, 900);

  const missingId = toggleChore(initial, 'nonexistent');
  assert.deepEqual(missingId, initial);
});

test('deleteChore removes matching ID immutably', () => {
  const initial: ChoreItem[] = [
    { id: 'c1', title: 'Take out trash', completed: false, createdAt: 100 },
    { id: 'c2', title: 'Wash dishes', completed: true, createdAt: 90 },
  ];

  const afterDelete = deleteChore(initial, 'c1');
  assert.equal(afterDelete.length, 1);
  assert.equal(afterDelete[0].id, 'c2');
  assert.equal(initial.length, 2);
});

test('getChoresSummary reports accurate total, completed, and remaining counts', () => {
  assert.deepEqual(getChoresSummary([]), { total: 0, completed: 0, remaining: 0 });

  const items: ChoreItem[] = [
    { id: '1', title: 'A', completed: false, createdAt: 1 },
    { id: '2', title: 'B', completed: true, createdAt: 2 },
    { id: '3', title: 'C', completed: false, createdAt: 3 },
  ];
  assert.deepEqual(getChoresSummary(items), { total: 3, completed: 1, remaining: 2 });
});

test('parseChoresFromStorage handles valid, malformed, duplicate, and corrupted data safely', () => {
  assert.deepEqual(parseChoresFromStorage(null), []);
  assert.deepEqual(parseChoresFromStorage('not-json'), []);
  assert.deepEqual(parseChoresFromStorage('{"not":"an-array"}'), []);

  const raw = JSON.stringify([
    null,
    { id: '', title: 'Missing ID', completed: false, createdAt: 1 },
    { id: 'bad-title', title: '   ', completed: false, createdAt: 2 },
    { id: 'c1', title: '  Fold laundry  ', completed: 1, createdAt: 1234 },
    { id: 'c1', title: 'Duplicate ID ignored', completed: false, createdAt: 9999 },
    { id: 'c2', title: 'Vacuum', completed: false, createdAt: 'invalid' },
  ]);

  assert.deepEqual(parseChoresFromStorage(raw), [
    { id: 'c1', title: 'Fold laundry', completed: true, createdAt: 1234 },
    { id: 'c2', title: 'Vacuum', completed: false, createdAt: 0 },
  ]);
});

test('recordDeletedItemTombstones preserves recent tombstones and prunes expired ones (>30d)', () => {
  const now = 5_000_000_000_000;
  const expiredTs = now - (31 * 24 * 60 * 60 * 1000);
  const recentTs = now - (2 * 24 * 60 * 60 * 1000);

  const next = recordDeletedItemTombstones(
    { old_chore: expiredTs, recent_note: recentTs },
    ['deleted_chore_1', '  '],
    now
  );

  assert.equal(next.old_chore, undefined);
  assert.equal(next.recent_note, recentTs);
  assert.equal(next.deleted_chore_1, now);
});

test('saveChoresToStorage and loadChoresFromStorage roundtrip using storage helper', () => {
  const backing = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return backing.size;
    },
    clear() {
      backing.clear();
    },
    getItem(key: string) {
      return backing.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(backing.keys())[index] ?? null;
    },
    removeItem(key: string) {
      backing.delete(key);
    },
    setItem(key: string, value: string) {
      backing.set(key, value);
    },
  };

  const items: ChoreItem[] = [
    { id: 'c1', title: 'Take out trash', completed: false, createdAt: 1000 },
    { id: 'c2', title: 'Mop kitchen', completed: true, createdAt: 900 },
  ];

  saveChoresToStorage(items, mockStorage);
  assert.ok(backing.has(CHORES_STORAGE_KEY));
  assert.deepEqual(loadChoresFromStorage(mockStorage), items);
});
