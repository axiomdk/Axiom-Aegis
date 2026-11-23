import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialAppData } from './defaults';
import {
  countVaultRecords,
  fetchAccountWorkspaceFromDatabase,
  loginAccountLocally,
  mergeAdminAccountDirectories,
  mergeCloudAndLocalVaults,
  pushAccountWorkspaceToDatabase,
  registerAccountLocally,
} from './cloudSyncEngine';
import { recordDeletedItemTombstones } from '../components/chores/choresStore';

test('countVaultRecords includes chores alongside notes, goals, funds, and other collections', () => {
  const base = createInitialAppData('Axiom Aegis', 'Commander');
  const populated = {
    ...base,
    chores: [
      { id: 'ch_1', title: 'Vacuum office', completed: false, createdAt: 100 },
      { id: 'ch_2', title: 'Filter water', completed: true, createdAt: 200 },
    ],
    dailyNotes: [
      { id: 'note_1', date: '2026-11-20', title: 'Sync check', content: 'Cloud ready', tags: [], createdAt: 100, updatedAt: 100 },
    ],
  };

  assert.equal(countVaultRecords(populated), 3);
});

test('mergeCloudAndLocalVaults merges chores across devices and prevents deleted chore/note resurrection via tombstones', () => {
  const baseNow = Date.now();
  const deviceA = createInitialAppData('Axiom Aegis', 'Commander');
  const deviceB = createInitialAppData('Axiom Aegis', 'Commander');

  deviceA.updatedAt = baseNow - 500;
  deviceA.chores = [
    { id: 'ch_shared_keep', title: 'Shared chore', completed: true, createdAt: baseNow - 10_000, updatedAt: baseNow - 200 },
    { id: 'ch_deleted_on_b', title: 'Old chore', completed: false, createdAt: baseNow - 10_000, updatedAt: baseNow - 5_000 },
  ];
  deviceA.dailyNotes = [
    { id: 'note_deleted_on_b', date: '2026-11-20', title: 'Stale note', content: 'old', tags: [], createdAt: baseNow - 10_000, updatedAt: baseNow - 4_000 },
  ];

  deviceB.updatedAt = baseNow;
  deviceB.chores = [
    { id: 'ch_shared_keep', title: 'Shared chore', completed: false, createdAt: baseNow - 10_000, updatedAt: baseNow - 1_000 },
    { id: 'ch_new_from_b', title: 'Restock filters', completed: false, createdAt: baseNow - 300, updatedAt: baseNow - 300 },
  ];
  deviceB.dailyNotes = [
    { id: 'note_new_from_b', date: '2026-11-20', title: 'Device B Note', content: 'Synced!', tags: [], createdAt: baseNow - 250, updatedAt: baseNow - 250 },
  ];
  deviceB.deletedItemTombstones = recordDeletedItemTombstones(
    {},
    ['ch_deleted_on_b', 'note_deleted_on_b'],
    baseNow - 100
  );

  const merged = mergeCloudAndLocalVaults(deviceA, deviceB);

  const choreIds = (merged.chores || []).map((c) => c.id);
  assert.ok(choreIds.includes('ch_shared_keep'));
  assert.ok(choreIds.includes('ch_new_from_b'));
  assert.ok(!choreIds.includes('ch_deleted_on_b'), 'Deleted chore must NOT resurrect across devices');

  // Shared chore edited more recently on Device A keeps completed: true
  const sharedChore = (merged.chores || []).find((c) => c.id === 'ch_shared_keep');
  assert.equal(sharedChore?.completed, true);

  const noteIds = (merged.dailyNotes || []).map((n) => n.id);
  assert.ok(noteIds.includes('note_new_from_b'));
  assert.ok(!noteIds.includes('note_deleted_on_b'), 'Deleted note must NOT resurrect across devices');
});

test('fetchAccountWorkspaceFromDatabase & pushAccountWorkspaceToDatabase surface offline state when network is offline', async () => {
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: false },
    });

    const pullRes = await fetchAccountWorkspaceFromDatabase('tok_test_123', 'user@example.com');
    assert.equal(pullRes.ok, false);
    assert.equal(pullRes.syncedToCloud, false);
    assert.equal(pullRes.offline, true);

    const workspace = createInitialAppData('Axiom Aegis', 'Commander');
    const pushRes = await pushAccountWorkspaceToDatabase('tok_test_123', 'user@example.com', workspace, 'Commander');
    assert.equal(pushRes.ok, false);
    assert.equal(pushRes.syncedToCloud, false);
    assert.equal(pushRes.offline, true);
  } finally {
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDesc);
    } else {
      delete (globalThis as Record<string, unknown>).navigator;
    }
  }
});

test('mergeAdminAccountDirectories preserves max choresCount across remote and local rows', () => {
  const merged = mergeAdminAccountDirectories(
    [
      {
        userId: 'usr_1',
        username: 'pilot@example.com',
        displayName: 'Pilot',
        role: 'User',
        createdAt: 1000,
        updatedAt: 3000,
        timelineCount: 1,
        fundsCount: 0,
        goalsCount: 0,
        notesCount: 2,
        choresCount: 5,
        distancesCount: 0,
        lifeStatsCount: 0,
        galleryCount: 0,
        totalRecords: 8,
        source: 'database',
      },
    ],
    [
      {
        userId: 'usr_1',
        username: 'pilot@example.com',
        displayName: 'Pilot',
        role: 'User',
        createdAt: 1000,
        updatedAt: 2000,
        timelineCount: 1,
        fundsCount: 0,
        goalsCount: 0,
        notesCount: 3,
        choresCount: 2,
        distancesCount: 0,
        lifeStatsCount: 0,
        galleryCount: 0,
        totalRecords: 6,
        source: 'local',
      },
    ]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].choresCount, 5);
  assert.equal(merged[0].notesCount, 3);
});

test('registerAccountLocally and loginAccountLocally explicitly report syncedToCloud=false and offline=true', () => {
  const store = new Map<string, string>();
  const originalLocalStorageDesc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
        clear: () => {
          store.clear();
        },
      },
    });

    const workspace = createInitialAppData('Axiom Aegis', 'Offline Tester');
    const reg = registerAccountLocally('offline_tester@example.com', 'Offline Tester', 'pass1234', workspace);
    assert.equal(reg.ok, true);
    assert.equal(reg.syncedToCloud, false);
    assert.equal(reg.offline, true);

    const login = loginAccountLocally('offline_tester@example.com', 'pass1234');
    assert.equal(login.ok, true);
    assert.equal(login.syncedToCloud, false);
    assert.equal(login.offline, true);
  } finally {
    if (originalLocalStorageDesc) {
      Object.defineProperty(globalThis, 'localStorage', originalLocalStorageDesc);
    } else {
      delete (globalThis as Record<string, unknown>).localStorage;
    }
  }
});

