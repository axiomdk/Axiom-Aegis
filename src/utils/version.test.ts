import { test } from 'node:test';
import assert from 'node:assert';
import {
  APP_VERSION,
  APP_VERSION_BARE,
  APP_FULL_NAME,
  APP_SHORT_NAME,
  formatDateBasedVersion,
  getNextDayVersion,
  resolveReleaseDateWithChanges,
  resolveVersionWithDateOnChanges,
  formatLastUpdated,
  formatExactTime,
} from './version';
import {
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_VERIFIER,
  isMasterAdminIdentifier,
  isMasterAdminCredentials,
  resolveAccountRole,
  computeLocalPasswordVerifier,
  verifyLocalAccountPassword,
  RegisteredAccountEntry,
} from './storage';

test('APP_VERSION updates with date when changes/additions exist (v26.11.20 on 2026-11-20), and stays unchanged when no changes exist', () => {
  assert.strictEqual(APP_VERSION, 'v26.11.20');
  assert.strictEqual(APP_VERSION_BARE, '26.11.20');
  assert.strictEqual(APP_FULL_NAME, 'Axiom Aegis');
  assert.strictEqual(APP_SHORT_NAME, 'AA');
  assert.match(APP_VERSION, /^v\d{2}\.\d{1,2}\.\d{2}$/);
  assert.strictEqual(formatDateBasedVersion('2026-11-02'), 'v26.11.2');
  assert.strictEqual(formatDateBasedVersion('2026-11-03', false), '26.11.3');
  assert.strictEqual(formatDateBasedVersion('2026-11-04'), 'v26.11.04');
  assert.strictEqual(formatDateBasedVersion('2026-11-20'), 'v26.11.20');
  assert.strictEqual(formatDateBasedVersion('2026-11-20', false), '26.11.20');
  assert.strictEqual(getNextDayVersion('2026-11-02', true), 'v26.11.3');
  assert.strictEqual(getNextDayVersion('2026-11-03', true), 'v26.11.04');
  assert.strictEqual(getNextDayVersion('2026-11-20', true), 'v26.11.21');

  // Confirm version updates with date ONLY when there are changes or additions:
  assert.strictEqual(
    resolveVersionWithDateOnChanges('2026-11-04', '2026-11-20', false),
    'v26.11.04',
    'Version must remain v26.11.04 when there are no changes or additions on 2026-11-20'
  );
  assert.strictEqual(
    resolveVersionWithDateOnChanges('2026-11-04', '2026-11-20', true),
    'v26.11.20',
    'Version must advance to v26.11.20 when changes or additions exist on 2026-11-20'
  );
  assert.strictEqual(
    resolveVersionWithDateOnChanges('2026-11-20', '2026-11-21', true),
    'v26.11.21',
    'Version must advance to v26.11.21 when changes or additions exist on 2026-11-21'
  );
  assert.strictEqual(
    resolveReleaseDateWithChanges('2026-11-04', '2026-11-20', true),
    '2026-11-20'
  );
});

test('Role & Rank Hierarchy: Axiomdk99@gmail.com is exclusively The App Creator, VIP and User resolve strictly', () => {
  assert.strictEqual(isMasterAdminIdentifier('Axiomdk99@gmail.com'), true);
  assert.strictEqual(isMasterAdminIdentifier('  AXIOMDK99@GMAIL.COM '), true);
  assert.strictEqual(isMasterAdminIdentifier('someone@example.com'), false);

  // Master Admin always gets 'The App Creator' regardless of requested role
  assert.strictEqual(resolveAccountRole('Axiomdk99@gmail.com', 'User'), 'The App Creator');
  assert.strictEqual(resolveAccountRole('axiomdk99@gmail.com', undefined), 'The App Creator');

  // Non-Master Admin can NEVER be assigned 'The App Creator'
  assert.strictEqual(resolveAccountRole('imposter@example.com', 'The App Creator'), 'User');
  assert.strictEqual(resolveAccountRole('vipmember@example.com', 'VIP'), 'VIP');
  assert.strictEqual(resolveAccountRole('regular@example.com', undefined), 'User');
});

test('Master Admin Pre-Seed & Cryptographic Verifier: uses irreversible hash and rejects invalid credentials', () => {
  assert.strictEqual(MASTER_ADMIN_EMAIL, 'axiomdk99@gmail.com');
  assert.match(MASTER_ADMIN_VERIFIER, /^av1_[0-9a-f]{16}$/);
  assert.strictEqual(isMasterAdminCredentials('axiomdk99@gmail.com', 'WrongPass'), false);
  assert.strictEqual(isMasterAdminCredentials('other@example.com', 'WrongPass'), false);

  const masterEntry: RegisteredAccountEntry = {
    userId: 'usr_master_axiomdk99',
    username: 'axiomdk99@gmail.com',
    displayName: 'Axiom Creator',
    role: 'The App Creator',
    passwordVerifier: MASTER_ADMIN_VERIFIER,
    token: `aegis_tok_${MASTER_ADMIN_VERIFIER}_test`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspaceData: null as unknown as RegisteredAccountEntry['workspaceData'],
  };
  assert.strictEqual(verifyLocalAccountPassword(masterEntry, 'WrongPass'), false);
});

test('Local Account Password Verifier is deterministic and case-insensitive for email', () => {
  const v1 = computeLocalPasswordVerifier('Axiomdk99@gmail.com', 'samplePass99');
  const v2 = computeLocalPasswordVerifier('  axiomdk99@gmail.com ', 'samplePass99');
  const v3 = computeLocalPasswordVerifier('AXIOMDK99@GMAIL.COM', 'samplePass99');
  const vWrong = computeLocalPasswordVerifier('axiomdk99@gmail.com', 'wrongpass');
  assert.strictEqual(v1, v2);
  assert.strictEqual(v2, v3);
  assert.notStrictEqual(v1, vWrong);
});

test('formatLastUpdated handles recent and older timestamps', () => {
  const now = Date.now();
  assert.strictEqual(formatLastUpdated(now - 10000), 'Just now');
  assert.strictEqual(formatLastUpdated(now - 5 * 60 * 1000), '5m ago');
  assert.strictEqual(formatLastUpdated(null), 'Synced');
  assert.strictEqual(formatLastUpdated(undefined), 'Synced');
  
  const formatted = formatLastUpdated(now - 3 * 3600 * 1000);
  assert.ok(formatted.includes('Today at') || formatted.includes('ago') || formatted.includes(':'));
});

test('formatExactTime formats valid date string', () => {
  const ts = 1792618100000;
  const exact = formatExactTime(ts);
  assert.ok(exact.length > 5);
});
