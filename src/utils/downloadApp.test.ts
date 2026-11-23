import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  injectPortableSeedIntoHtml,
  getVersionFileSlug,
  escapeJsonForHtmlScript,
  buildMultiSizeIcoFromPngBuffers,
  ICO_STANDARD_SIZES,
  PORTABLE_STORAGE_KEYS,
} from './downloadApp';

test('Standalone Portable HTML Injector: preserves 100% of main JS bundle without truncation and passes JS syntax check', () => {
  const htmlPath = path.join(process.cwd(), 'public', 'Axiom-Aegis.html');
  assert.ok(fs.existsSync(htmlPath), 'public/Axiom-Aegis.html must exist');

  const rawHtml = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(rawHtml.length > 500_000, 'raw standalone HTML must contain full bundle');
  assert.ok(rawHtml.includes('createRoot'), 'raw standalone HTML must contain createRoot mount');

  // 1. Test Clean Export (includeCurrentData = false)
  const cleanOut = injectPortableSeedIntoHtml(rawHtml, false);
  assert.strictEqual(cleanOut.length, rawHtml.length, 'clean export must not truncate a single byte');
  assert.ok(cleanOut.includes('createRoot'), 'clean export must retain createRoot');

  // 2. Test Portable Export (includeCurrentData = true)
  const portableOut = injectPortableSeedIntoHtml(rawHtml, true);
  assert.ok(portableOut.length > rawHtml.length, 'portable export must add seed script in <head>');
  assert.ok(
    portableOut.includes('id="axiom-portable-state-seed"'),
    'portable export must include seed script tag'
  );
  assert.ok(
    portableOut.includes('createRoot'),
    'portable export must retain createRoot at the end of the bundle'
  );

  // Extract scripts from portableOut and verify JS & JSON syntax
  const scripts = [...portableOut.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.strictEqual(scripts.length, 3, 'portable export must have exactly 3 script tags (embedded JSON + seed + main bundle)');

  const embeddedJson = scripts[0][1];
  const seedJs = scripts[1][1];
  const mainJs = scripts[2][1];
  assert.ok(mainJs.length > 500_000, 'main JS bundle must remain intact (>500KB)');
  assert.doesNotThrow(() => JSON.parse(embeddedJson), 'embedded vault JSON must be valid JSON');

  // Validate syntax of both scripts
  assert.doesNotThrow(() => new Function(seedJs), 'seed script must have valid JS syntax');
  assert.doesNotThrow(() => new Function(mainJs), 'main bundle script must have valid JS syntax');

  // 3. Test Re-Export Idempotency (exporting again from an already-seeded portable HTML)
  const reExported = injectPortableSeedIntoHtml(portableOut, true);
  const reScripts = [...reExported.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.strictEqual(reScripts.length, 3, 're-exported portable HTML must still have exactly 3 script tags');
  assert.strictEqual(reScripts[2][1].length, mainJs.length, 're-exported main JS bundle length must be identical');

  // 4. Test Clean Export from an already-seeded Personal Synced HTML strips personal seed completely
  const cleanFromSeeded = injectPortableSeedIntoHtml(portableOut, false);
  const cleanHead = cleanFromSeeded.slice(0, cleanFromSeeded.indexOf('</head>'));
  assert.ok(!cleanHead.includes('id="axiom-embedded-vault"'), 'clean export <head> must strip embedded vault JSON');
  assert.ok(!cleanHead.includes('id="axiom-portable-state-seed"'), 'clean export <head> must strip portable seed script');
  const cleanScripts = [...cleanFromSeeded.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.strictEqual(cleanScripts.length, 1, 'clean export must contain only the 1 main bundle script tag');
  assert.strictEqual(getVersionFileSlug(), 'v26.11.20');

  // 5. Verify no legacy v1.x.x BETA strings exist in rawHtml or cleanOut, and legacy strings are scrubbed on re-export
  assert.ok(!/v1\.\d+\.\d+/i.test(rawHtml), 'public/Axiom-Aegis.html must not contain any legacy v1.x.x version strings');
  const legacyHtmlSample =
    '<!doctype html><html><head><title>Axiom Aegis (AA) — ' +
    'v1' +
    '.1.18 ' +
    'BETA</title></head><body><div id="root">old</div><script>window.__AXIOM_SINGLEFILE__=true;</script></body></html>';
  const scrubbedOut = injectPortableSeedIntoHtml(legacyHtmlSample, false);
  assert.ok(scrubbedOut.includes('<title>Axiom Aegis (AA) — v26.11.20</title>'));
  assert.ok(!/1\.1\.18/i.test(scrubbedOut));
});

test('Security Audit: escapeJsonForHtmlScript neutralizes </SCRIPT>, <!--, and Unicode line separators while preserving JSON roundtrip', () => {
  const payloadWithXssVectors = {
    note: 'Testing </script><script>evil()</script> and </SCRIPT > and <!-- comment --> & \u2028\u2029',
  };
  const rawJson = JSON.stringify(payloadWithXssVectors);
  const escaped = escapeJsonForHtmlScript(rawJson);

  assert.ok(!escaped.includes('<'), 'Escaped JSON must not contain raw < character');
  assert.ok(!escaped.includes('>'), 'Escaped JSON must not contain raw > character');
  assert.ok(!escaped.includes('&'), 'Escaped JSON must not contain raw & character');
  assert.ok(!escaped.toLowerCase().includes('</script'), 'Escaped JSON must not contain </script');

  // Verify evaluating the escaped JSON literal in JavaScript reconstructs the exact original object
  const evaluated = new Function(`return ${escaped};`)();
  assert.deepStrictEqual(evaluated, payloadWithXssVectors);
});

test('Windows .ico Generator: buildMultiSizeIcoFromPngBuffers and public/Axiom-Aegis.ico contain valid 256x256, 64x64, 32x32, and 16x16 PNG frames', () => {
  assert.deepStrictEqual([...ICO_STANDARD_SIZES], [256, 64, 32, 16]);

  // Verify synthetic multi-size ICO packing
  const fakeFrames = ICO_STANDARD_SIZES.map((sz, idx) => ({
    width: sz,
    height: sz,
    pngBytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, sz & 0xff, idx]),
  }));
  const builtIco = buildMultiSizeIcoFromPngBuffers(fakeFrames);
  const view = new DataView(builtIco.buffer, builtIco.byteOffset, builtIco.byteLength);

  assert.strictEqual(view.getUint16(0, true), 0, 'ICONDIR reserved must be 0');
  assert.strictEqual(view.getUint16(2, true), 1, 'ICONDIR type must be 1 (ICO)');
  assert.strictEqual(view.getUint16(4, true), 4, 'ICONDIR image count must be 4');

  // Verify pre-rendered public/Axiom-Aegis.ico on disk
  const icoPath = path.join(process.cwd(), 'public', 'Axiom-Aegis.ico');
  assert.ok(fs.existsSync(icoPath), 'public/Axiom-Aegis.ico must exist');
  const diskIco = fs.readFileSync(icoPath);
  assert.strictEqual(diskIco.readUInt16LE(0), 0);
  assert.strictEqual(diskIco.readUInt16LE(2), 1);
  assert.strictEqual(diskIco.readUInt16LE(4), 4);

  const expectedWidths = [0, 64, 32, 16]; // 256 is encoded as 0 in ICONDIRENTRY
  const expectedIHDRSizes = [256, 64, 32, 16];

  for (let i = 0; i < 4; i++) {
    const entryOffset = 6 + i * 16;
    assert.strictEqual(diskIco.readUInt8(entryOffset + 0), expectedWidths[i]);
    assert.strictEqual(diskIco.readUInt8(entryOffset + 1), expectedWidths[i]);
    assert.strictEqual(diskIco.readUInt16LE(entryOffset + 4), 1, 'Color planes must be 1');
    assert.strictEqual(diskIco.readUInt16LE(entryOffset + 6), 32, 'BPP must be 32');

    const sizeBytes = diskIco.readUInt32LE(entryOffset + 8);
    const dataOffset = diskIco.readUInt32LE(entryOffset + 12);
    assert.ok(sizeBytes > 100, `Frame ${i} PNG payload must be non-empty`);

    // Check PNG magic header (\x89PNG\r\n\x1a\n) and IHDR width/height
    assert.strictEqual(diskIco[dataOffset], 0x89);
    assert.strictEqual(diskIco[dataOffset + 1], 0x50);
    assert.strictEqual(diskIco[dataOffset + 2], 0x4e);
    assert.strictEqual(diskIco[dataOffset + 3], 0x47);
    const ihdrWidth = diskIco.readUInt32BE(dataOffset + 16);
    const ihdrHeight = diskIco.readUInt32BE(dataOffset + 20);
    assert.strictEqual(ihdrWidth, expectedIHDRSizes[i]);
    assert.strictEqual(ihdrHeight, expectedIHDRSizes[i]);
  }
});

test('Auth Security Gate: portable seed NEVER embeds active account sessions or unlocked encryption keys', () => {
  assert.ok(!PORTABLE_STORAGE_KEYS.includes('axiom_account_session_v1'), 'Must not store session token in seed');
  assert.ok(!PORTABLE_STORAGE_KEYS.includes('axiom_session_vault_key'), 'Must not store session key in seed');
  assert.ok(!PORTABLE_STORAGE_KEYS.includes('axiom_active_encryption_key_hex'), 'Must not store encryption key in seed');
  assert.ok(!PORTABLE_STORAGE_KEYS.includes('axiom_unified_account_v1'), 'Must not store unified account in seed');

  // Verify that even if an untrusted snapshot contains a session token, seed injection ignores it
  const htmlPath = path.join(process.cwd(), 'public', 'Axiom-Aegis.html');
  const rawHtml = fs.readFileSync(htmlPath, 'utf8');
  const dirtySnapshot = {
    axiom_account_session_v1: JSON.stringify({ username: 'hacker', token: 'fake_token' }),
    axioms_dailies_state: JSON.stringify({ settings: { appName: 'Axiom Aegis' } }),
  };
  const seeded = injectPortableSeedIntoHtml(rawHtml, true, dirtySnapshot);
  assert.ok(!seeded.includes('fake_token'), 'Seeded HTML must never inject fake or active session tokens');
});
