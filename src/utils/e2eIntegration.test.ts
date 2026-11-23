import { test } from 'node:test';
import assert from 'node:assert';
import { encryptData, decryptData, bufferToBase64, base64ToBuffer } from './crypto';
import { createInitialAppData, DEFAULT_SETTINGS } from './defaults';
import { parseBankCsv, generateTransactionHash, parseAmount, normalizeDate, inferCategory } from './bankCsvParser';
import { parseGoogleTakeoutJson } from './takeoutParser';
import {
  calculateDurationMinutes,
  formatMinutes,
  convertDistance,
  cmToFtIn,
  kgToLbs,
  calculateGoalProgress,
  calculateDistanceSummary,
  calculateFundsSummary,
} from './calculations';
import { APP_VERSION, formatLastUpdated, formatExactTime } from './version';
import { FundEntry, DistanceEntry, TimelineEntry } from '../types';

test('1. Core Vault Crypto: encryptData, decryptData and tamper rejection', async () => {
  const secretData = {
    appName: "Axiom's Dailies",
    secretNote: 'Local offline vault 100% private',
    records: [1, 2, 3],
  };
  const passphrase = 'UltraSecureLocalPassword99!';

  const encrypted = await encryptData(secretData, passphrase);
  assert.ok(encrypted.ciphertext, 'Ciphertext should exist');
  assert.ok(encrypted.salt, 'Salt should exist');
  assert.ok(encrypted.iv, 'IV should exist');
  assert.strictEqual(encrypted.version, 1);

  // Successful decryption
  const decrypted = await decryptData<typeof secretData>(encrypted, passphrase);
  assert.deepStrictEqual(decrypted, secretData);

  // Wrong passphrase failure
  await assert.rejects(
    async () => {
      await decryptData(encrypted, 'WrongPassword123');
    },
    /invalid passphrase/i
  );
});

test('2. Bank CSV Importer: comprehensive parsing, auto-categorization & deduplication', () => {
  const existingFunds: FundEntry[] = [
    {
      id: 'f-existing-1',
      date: '2026-10-21',
      amount: 58.40,
      type: 'expense',
      category: 'Groceries',
      description: "Trader Joe's Market",
      createdAt: 1792618000000,
    },
  ];

  const csv = `Date,Description,Amount\n2026-10-21,"Trader Joe's Market",-58.40\n10/22/2026,"Chevron Fuel Pump",-45.50\n2026-10-23,"Stripe Client Payout",1450.00\n10/24/2026,"Netflix Streaming",$(15.99)\n2026-10-22,"Chevron Fuel Pump",-45.50\n`;

  const result = parseBankCsv(csv, existingFunds);

  // Total lines parsed = 5 (Trader Joe's, Chevron, Stripe, Netflix, duplicate Chevron)
  assert.strictEqual(result.totalFound, 5);
  // Duplicate count: Trader Joe's (already in existingFunds) + 2nd Chevron (duplicate within CSV) = 2
  assert.strictEqual(result.duplicatesCount, 2);
  assert.strictEqual(result.newCount, 3);

  // Check categories inferred
  const netflix = result.transactions.find((t) => t.description.includes('Netflix'));
  assert.ok(netflix);
  assert.strictEqual(netflix.category, 'Subscriptions & Entertainment');
  assert.strictEqual(netflix.type, 'expense');
  assert.strictEqual(netflix.amount, 15.99);

  const stripe = result.transactions.find((t) => t.description.includes('Stripe'));
  assert.ok(stripe);
  assert.strictEqual(stripe.category, 'Client / Income');
  assert.strictEqual(stripe.type, 'income');
  assert.strictEqual(stripe.amount, 1450.0);
});

test('3. Google Takeout JSON Importer: semantic location history & deduplication', () => {
  const existingDist: DistanceEntry[] = [
    {
      id: 'd-exist-1',
      date: '2026-10-21',
      distance: 3.11,
      unit: 'mi',
      type: 'run',
      description: 'Morning 5K',
      createdAt: 1792618000000,
    },
  ];

  const takeoutPayload = {
    timelineObjects: [
      {
        activitySegment: {
          activityType: 'RUNNING',
          distance: 5005, // ~3.11 miles
          duration: {
            startTimestamp: '2026-10-21T07:00:00.000Z',
            endTimestamp: '2026-10-21T07:30:00.000Z',
          },
        },
      },
      {
        activitySegment: {
          activityType: 'CYCLING',
          distance: 16093, // ~10 miles
          duration: {
            startTimestamp: '2026-10-22T14:00:00.000Z',
            endTimestamp: '2026-10-22T14:45:00.000Z',
          },
        },
      },
      {
        placeVisit: {
          location: {
            name: 'Central Tech Lab',
            address: '100 Innovation Way, Austin, TX',
          },
          duration: {
            startTimestamp: '2026-10-22T09:00:00.000Z',
            endTimestamp: '2026-10-22T12:00:00.000Z',
          },
        },
      },
    ],
  };

  const result = parseGoogleTakeoutJson(JSON.stringify(takeoutPayload), 'mi', existingDist, []);

  assert.strictEqual(result.sourceFormat, 'semantic_timeline');
  assert.strictEqual(result.totalDistanceFound, 2);
  assert.strictEqual(result.totalTimelineFound, 3); // 2 activity segments + 1 place visit

  // The 1st run should be flagged as duplicate since ~3.11 mi run on 2026-10-21 matches existingDist
  assert.strictEqual(result.duplicateDistances, 1);

  // Cycling segment verification
  const bike = result.distances.find((d) => d.type === 'cycle');
  assert.ok(bike);
  assert.strictEqual(bike.distance, 10.0);
  assert.strictEqual(bike.isDuplicate, false);
  assert.strictEqual(bike.selected, true);

  // Place visit verification
  const pv = result.timeline.find((t) => t.title.includes('Central Tech Lab'));
  assert.ok(pv);
  assert.strictEqual(pv.category, 'personal');
  assert.strictEqual(pv.durationMinutes, 180);
});

test('4. Calculation & Metrics Engine: midnight crossing, unit math, summaries', () => {
  // Midnight duration
  const minsCrossMidnight = calculateDurationMinutes('23:30', '01:00');
  assert.strictEqual(minsCrossMidnight, 90);
  assert.strictEqual(formatMinutes(minsCrossMidnight), '1h 30m');

  // Imperial unit math
  const { feet, inches } = cmToFtIn(182.88);
  assert.strictEqual(feet, 6);
  assert.strictEqual(inches, 0);

  const lbs = kgToLbs(75);
  assert.strictEqual(lbs, 165.3);

  // Distance convert
  assert.strictEqual(Math.round(convertDistance(10, 'mi', 'km') * 100) / 100, 16.09);
  assert.strictEqual(Math.round(convertDistance(16.09344, 'km', 'mi') * 10) / 10, 10.0);

  // Goal calculation
  const progressPct = calculateGoalProgress({
    id: 'g1',
    title: 'Run 100 Miles',
    category: 'fitness',
    targetValue: 100,
    currentValue: 45,
    unit: 'miles',
    status: 'in_progress',
    targetDate: '2026-12-31',
    milestones: [],
    createdAt: Date.now(),
  });
  assert.strictEqual(progressPct, 45);
});

test('5. Version and Signatures: date-based YY.MM.DD versioning format', () => {
  assert.strictEqual(APP_VERSION, 'v26.11.20');
  const now = Date.now();
  assert.strictEqual(formatLastUpdated(now), 'Just now');
  assert.strictEqual(formatLastUpdated(null), 'Synced');
  assert.ok(formatExactTime(now).length > 5);
});

test('6. Takeout Settings Metadata Parser: parses generic settings metadata JSON cleanly', () => {
  const sampleSettingsMetadata = JSON.stringify({
    deviceSettings: [
      {
        deviceTag: 1001,
        reportingEnabled: true,
        devicePrettyName: 'Mobile Device',
        platformType: 'ANDROID',
        lastRequestTime: '2026-10-21T18:00:00Z',
        deviceSpec: { manufacturer: 'Generic', model: 'Device-1' },
      },
    ],
  });
  const result = parseGoogleTakeoutJson(sampleSettingsMetadata);
  assert.strictEqual(result.sourceFormat, 'settings_metadata');
  assert.ok(result.standardizedEntries.length >= 1);
});

test('7. Bank Statement CSV Importer: parses CSV statement with duplicate hashing', () => {
  const existingFunds: FundEntry[] = [
    {
      id: 'f-1',
      date: '2026-10-20',
      amount: 42.5,
      type: 'expense',
      category: 'Transportation',
      description: 'Chevron Fuel Station',
      createdAt: 1792600000000,
    },
  ];

  const bankCsvPayload = `Date,Description,Amount,Category
2026-10-21,"Axiom Consulting Retainer Deposit",3400.00,"Client / Income"
2026-10-20,"Chevron Fuel Station",-42.50,"Transportation"
2026-10-19,"Whole Foods Market",-88.25,"Groceries"`;

  const parsed = parseBankCsv(bankCsvPayload, existingFunds);
  assert.strictEqual(parsed.totalFound, 3);
  assert.strictEqual(parsed.duplicatesCount, 1); // Chevron is duplicate
  assert.strictEqual(parsed.newCount, 2);

  const retainer = parsed.transactions.find((t) => t.description.includes('Retainer'));
  assert.ok(retainer);
  assert.strictEqual(retainer.type, 'income');
  assert.strictEqual(retainer.amount, 3400);
  assert.strictEqual(retainer.selected, true);

  const wf = parsed.transactions.find((t) => t.description.includes('Whole Foods'));
  assert.ok(wf);
  assert.strictEqual(wf.type, 'expense');
  assert.strictEqual(wf.amount, 88.25);
  assert.strictEqual(wf.category, 'Groceries');
});

test('8. Distance JSON Importer: parses custom JSON arrays and { distances: [...] } objects', () => {
  const existingDist: DistanceEntry[] = [
    {
      id: 'd-1',
      date: '2026-10-20',
      distance: 12.0,
      unit: 'mi',
      type: 'cycle',
      description: 'Evening Ride',
      createdAt: 1792600000000,
    },
  ];

  const customDistJson = JSON.stringify({
    distances: [
      {
        date: '2026-10-21',
        distance: 5.5,
        unit: 'mi',
        type: 'run',
        description: 'Morning Lake Trail Run',
      },
      {
        date: '2026-10-20',
        distance: 12.0,
        unit: 'mi',
        type: 'cycle',
        description: 'Evening Ride',
      },
    ],
  });

  const res = parseGoogleTakeoutJson(customDistJson, 'mi', existingDist, []);
  assert.strictEqual(res.sourceFormat, 'custom_array');
  assert.strictEqual(res.totalDistanceFound, 2);
  assert.strictEqual(res.duplicateDistances, 1);

  const newRun = res.distances.find((d) => d.type === 'run');
  assert.ok(newRun);
  assert.strictEqual(newRun.distance, 5.5);
  assert.strictEqual(newRun.isDuplicate, false);
  assert.strictEqual(newRun.selected, true);
});

test('9. Multi-Resolution Brand Logo Assets: verifies all uploaded Axiom Aegis emblem files exist and map cleanly', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { BRAND_LOGO_ASSETS, BRAND_LOGO_SRCSET, BRAND_LOGO_ALT } = await import('../components/BrandLogo');

  assert.strictEqual(BRAND_LOGO_ALT, 'Axiom Aegis Brand Emblem');
  assert.strictEqual(
    BRAND_LOGO_ASSETS[32],
    '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__1__93b00a1f.jpg'
  );
  assert.strictEqual(
    BRAND_LOGO_ASSETS[64],
    '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__1__93b00a1f.jpg'
  );
  assert.strictEqual(
    BRAND_LOGO_ASSETS[128],
    '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw_31b1850b.jpg'
  );
  assert.strictEqual(
    BRAND_LOGO_ASSETS[256],
    '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__2__e45572b5.jpg'
  );

  assert.ok(
    BRAND_LOGO_SRCSET.includes(
      '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__1__93b00a1f.jpg 32w'
    )
  );
  assert.ok(
    BRAND_LOGO_SRCSET.includes(
      '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__1__93b00a1f.jpg 64w'
    )
  );
  assert.ok(
    BRAND_LOGO_SRCSET.includes(
      '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw_31b1850b.jpg 128w'
    )
  );
  assert.ok(
    BRAND_LOGO_SRCSET.includes(
      '/assets/aistudio/Gemini_Generated_Image_rvkwforvkwforvkw__2__e45572b5.jpg 256w'
    )
  );

  for (const relPath of Object.values(BRAND_LOGO_ASSETS)) {
    const diskPath = path.join(process.cwd(), 'public', relPath);
    assert.ok(fs.existsSync(diskPath), `Expected asset file to exist at ${diskPath}`);
    const stat = fs.statSync(diskPath);
    assert.ok(stat.size > 0, `Expected non-empty asset file at ${diskPath}`);
  }
});

test('10. Centralized Theme CSS Custom Properties & Tactical Flat-Black Reset: verifies --bg-surface, --bg-elevated, --border-subtle, --text-primary, --text-muted, --accent-primary and 1-click reset', async () => {
  const {
    computeThemeCssVariables,
    resetToTacticalFlatBlackDefaults,
  } = await import('./theme');

  // Default flat-black variables
  const defaultVars = computeThemeCssVariables(null);
  assert.strictEqual(defaultVars['--bg-surface'], '#000000');
  assert.strictEqual(defaultVars['--bg-elevated'], '#000000');
  assert.strictEqual(defaultVars['--bg-canvas'], '#000000');
  assert.strictEqual(defaultVars['--border-subtle'], '#1E222B');
  assert.strictEqual(defaultVars['--text-primary'], '#F8FAFC');
  assert.strictEqual(defaultVars['--text-muted'], '#94A3B8');
  assert.strictEqual(defaultVars['--accent-primary'], '#E5A93C');

  // Customized state
  const customVars = computeThemeCssVariables({
    accentColor: 'toxic_lime',
    surfaceConfig: {
      preset: 'obsidian_slate',
    },
    textColorConfig: {
      preset: 'muted_silver',
    },
  });
  assert.strictEqual(customVars['--bg-surface'], '#0A0B0E');
  assert.strictEqual(customVars['--bg-elevated'], '#111318');
  assert.strictEqual(customVars['--text-primary'], '#CBD5E1');
  assert.strictEqual(customVars['--text-muted'], '#8E9BAE');
  assert.strictEqual(customVars['--accent-primary'], '#84CC16');

  // Reset to Tactical Flat-Black Default
  const resetSettings = resetToTacticalFlatBlackDefaults({
    userName: 'User',
    accentColor: 'toxic_lime',
    surfaceConfig: { preset: 'obsidian_slate', canvasHex: '#000000', columnHex: '#0A0B0E', cardHex: '#111318' },
    textColorConfig: { preset: 'muted_silver', primaryHex: '#CBD5E1', secondaryHex: '#8E9BAE' },
  });
  assert.strictEqual(resetSettings.userName, 'User');
  assert.strictEqual(resetSettings.accentColor, 'aegis_gold');
  assert.strictEqual(resetSettings.surfaceConfig.preset, 'flat_black');
  assert.strictEqual(resetSettings.surfaceConfig.canvasHex, '#000000');
  assert.strictEqual(resetSettings.surfaceConfig.columnHex, '#000000');
  assert.strictEqual(resetSettings.surfaceConfig.cardHex, '#000000');
  assert.strictEqual(resetSettings.textColorConfig.preset, 'crisp_white');
  assert.strictEqual(resetSettings.textColorConfig.primaryHex, '#F8FAFC');
  assert.strictEqual(resetSettings.textColorConfig.secondaryHex, '#94A3B8');
});



