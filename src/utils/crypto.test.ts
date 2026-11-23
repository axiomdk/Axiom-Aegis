import test from 'node:test';
import assert from 'node:assert/strict';
import {
  encryptData,
  decryptData,
  bufferToBase64,
  base64ToBuffer,
  deriveKeyHex,
  formatRecoveryKey,
  computeKeyFingerprint,
  verifyVaultPassphraseOrKey,
  clearDerivedKeyCache,
  getDerivedKeyCacheSize,
  hasCachedSessionCryptoKey,
} from './crypto';

test('Base64 conversion roundtrip preserves bytes', () => {
  const original = new Uint8Array([0, 1, 2, 255, 128, 64, 32, 16]);
  const b64 = bufferToBase64(original);
  const restored = base64ToBuffer(b64);
  assert.deepEqual(Array.from(restored), Array.from(original));
});

test('encryptData and decryptData roundtrip correctly with valid passphrase', async () => {
  const sample = {
    appName: "Axiom's Dailies",
    timeline: [{ id: '1', title: 'Deep Work Session', durationMinutes: 90 }],
    funds: [{ id: 'f1', type: 'income', amount: 2500 }],
  };
  const passphrase = 'UltraSecureMasterPassphrase#2026!';

  const payload = await encryptData(sample, passphrase);
  assert.ok(payload.ciphertext);
  assert.ok(payload.salt);
  assert.ok(payload.iv);
  assert.ok(payload.keyFingerprint);
  assert.equal(payload.hasCustomPassword, true);

  const decrypted = await decryptData<typeof sample>(payload, passphrase);
  assert.deepEqual(decrypted, sample);
});

test('decryptData unlocks using derived 64-char Hex AES-256 Encryption Key or AEGIS Recovery Key', async () => {
  const sample = {
    secretVault: 'Axiom Sovereign Data',
    balance: 18420.55,
  };
  const passphrase = 'MyCustomPassword2026';

  const payload = await encryptData(sample, passphrase);
  const hexKey = await deriveKeyHex(passphrase, payload.salt);
  assert.equal(hexKey.length, 64);

  const recoveryKey = formatRecoveryKey(hexKey);
  assert.ok(recoveryKey.startsWith('AEGIS-'));

  // 1. Unlock using raw 64-character hex key
  const decryptedByHex = await decryptData<typeof sample>(payload, hexKey);
  assert.deepEqual(decryptedByHex, sample);

  // 2. Unlock using formatted AEGIS-XXXX-... recovery key
  const decryptedByRecovery = await decryptData<typeof sample>(payload, recoveryKey);
  assert.deepEqual(decryptedByRecovery, sample);

  // 3. Unlock with leading/trailing whitespace around key or password
  const decryptedTrimmedPass = await decryptData<typeof sample>(payload, `  ${passphrase}  `);
  assert.deepEqual(decryptedTrimmedPass, sample);

  // 4. Verify helper identifies both password and raw key modes
  const verifyPass = await verifyVaultPassphraseOrKey(payload, passphrase);
  assert.equal(verifyPass.valid, true);
  assert.equal(verifyPass.mode, 'password');

  const verifyHex = await verifyVaultPassphraseOrKey(payload, hexKey);
  assert.equal(verifyHex.valid, true);
  assert.equal(verifyHex.mode, 'raw_key');
  assert.equal(verifyHex.keyFingerprint, await computeKeyFingerprint(hexKey));
});

test('Re-encrypting with existingSalt preserves both password and 64-char hex key validity', async () => {
  const initialData = { step: 1 };
  const updatedData = { step: 2 };
  const passphrase = 'StableKeyPassword!';

  const firstPayload = await encryptData(initialData, passphrase);
  const derivedHexKey = await deriveKeyHex(passphrase, firstPayload.salt);

  // Simulate unlocking with raw hex key and saving updated data while preserving salt
  const secondPayload = await encryptData(
    updatedData,
    derivedHexKey,
    base64ToBuffer(firstPayload.salt),
    true
  );

  // Both the original password AND the 64-char hex key must unlock the updated payload
  const unlockedWithPassword = await decryptData<typeof updatedData>(secondPayload, passphrase);
  assert.deepEqual(unlockedWithPassword, updatedData);

  const unlockedWithHexKey = await decryptData<typeof updatedData>(secondPayload, derivedHexKey);
  assert.deepEqual(unlockedWithHexKey, updatedData);
});

test('decryptData fails with incorrect passphrase or wrong hex key', async () => {
  const sample = { secretNote: 'Classified Axiom Entry' };
  const payload = await encryptData(sample, 'CorrectKey123');

  await assert.rejects(
    async () => {
      await decryptData(payload, 'WrongKey456');
    },
    /Invalid passphrase or encryption key/
  );

  const wrongHexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  await assert.rejects(
    async () => {
      await decryptData(payload, wrongHexKey);
    },
    /Invalid passphrase or encryption key/
  );
});

test('In-memory CryptoKey session cache: subsequent writes reuse cached non-extractable CryptoKey in <5ms with fresh 12-byte IVs', async () => {
  clearDerivedKeyCache();
  assert.equal(getDerivedKeyCacheSize(), 0);

  const passphrase = 'SessionCachePerformancePassphrase#2026';
  const initialPayload = await encryptData({ counter: 1, note: 'Initial unlock' }, passphrase);
  const saltBytes = base64ToBuffer(initialPayload.salt);
  const derivedHex = await deriveKeyHex(passphrase, initialPayload.salt);

  // Both passphrase+salt and canonical raw hex key should now be cached in memory
  assert.equal(hasCachedSessionCryptoKey(passphrase, initialPayload.salt), true);
  assert.equal(hasCachedSessionCryptoKey(derivedHex, initialPayload.salt), true);

  // Subsequent routine auto-saves using existingSalt must hit the O(1) non-extractable CryptoKey cache
  const seenIvs = new Set<string>([initialPayload.iv]);
  const startMs = performance.now();
  const iterations = 10;
  for (let i = 0; i < iterations; i++) {
    const nextPayload = await encryptData(
      { counter: i + 2, note: `Fast auto-save #${i}` },
      derivedHex,
      saltBytes,
      true
    );
    assert.ok(!seenIvs.has(nextPayload.iv), 'Each write must generate a fresh 12-byte CSPRNG IV');
    seenIvs.add(nextPayload.iv);
  }
  const avgMsPerWrite = (performance.now() - startMs) / iterations;
  assert.ok(
    avgMsPerWrite < 5,
    `Expected cached AES-256-GCM encryption to average <5ms per write, got ${avgMsPerWrite.toFixed(2)}ms`
  );

  // Locking vault clears the in-memory CryptoKey cache
  clearDerivedKeyCache();
  assert.equal(getDerivedKeyCacheSize(), 0);
  assert.equal(hasCachedSessionCryptoKey(passphrase, initialPayload.salt), false);
});

