import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  MOBILE_BREAKPOINT_PX,
  MOBILE_MIN_TOUCH_TARGET_PX,
  MOBILE_MIN_INPUT_FONT_PX,
  MAX_MOBILE_DEVICE_PIXEL_RATIO,
  MOBILE_BOTTOM_NAV_ITEMS,
  isMobileViewport,
  getMobileGridColumns,
  isFileProtocol,
  shouldRegisterServiceWorker,
  getCappedDevicePixelRatio,
  shouldRunCanvasAnimation,
  verifyHtmlPwaMetaTags,
} from './mobilePwaEngine';
import { evaluateTouchBackdropTap } from './modalGuardEngine';
import { CHANGELOG_RELEASES } from './changelog';

test('mobilePwaEngine: mobile breakpoint (< 768px), 44px touch target, and 16px zero-auto-zoom input constants', () => {
  assert.strictEqual(MOBILE_BREAKPOINT_PX, 768);
  assert.strictEqual(MOBILE_MIN_TOUCH_TARGET_PX, 44);
  assert.strictEqual(MOBILE_MIN_INPUT_FONT_PX, 16);
  assert.strictEqual(MAX_MOBILE_DEVICE_PIXEL_RATIO, 2);
  assert.strictEqual(isMobileViewport(320), true);
  assert.strictEqual(isMobileViewport(390), true);
  assert.strictEqual(isMobileViewport(767), true);
  assert.strictEqual(isMobileViewport(768), false);
  assert.strictEqual(isMobileViewport(1440), false);
});

test('mobilePwaEngine: single-column stacking (< 768px) vs intact desktop columns (>= 768px)', () => {
  assert.strictEqual(getMobileGridColumns(390, 4), 1);
  assert.strictEqual(getMobileGridColumns(640, 2), 1);
  assert.strictEqual(getMobileGridColumns(767, 3), 1);
  assert.strictEqual(getMobileGridColumns(768, 2), 2);
  assert.strictEqual(getMobileGridColumns(1024, 3), 3);
  assert.strictEqual(getMobileGridColumns(1440, 4), 4);
});

test('mobilePwaEngine: file:// protocol detection, Service Worker guard, DPR cap, and Canvas lifecycle management', () => {
  assert.strictEqual(isFileProtocol('file:'), true);
  assert.strictEqual(isFileProtocol('FILE:'), true);
  assert.strictEqual(isFileProtocol('https:'), false);
  assert.strictEqual(isFileProtocol('http:'), false);

  // Service Worker must be bypassed on file:// protocol
  assert.strictEqual(shouldRegisterServiceWorker('file:', true), false);
  assert.strictEqual(shouldRegisterServiceWorker('https:', true), true);
  assert.strictEqual(shouldRegisterServiceWorker('https:', false), false);

  // DPR cap prevents mobile GPU thermal throttling above 2x
  assert.strictEqual(getCappedDevicePixelRatio(1), 1);
  assert.strictEqual(getCappedDevicePixelRatio(2), 2);
  assert.strictEqual(getCappedDevicePixelRatio(3), 2);
  assert.strictEqual(getCappedDevicePixelRatio(3.5), 2);

  // Canvas animation lifecycle pauses when off-screen, tab-hidden, or manually paused
  assert.strictEqual(
    shouldRunCanvasAnimation({ isIntersecting: true, isDocumentVisible: true, isPaused: false }),
    true
  );
  assert.strictEqual(
    shouldRunCanvasAnimation({ isIntersecting: false, isDocumentVisible: true, isPaused: false }),
    false
  );
  assert.strictEqual(
    shouldRunCanvasAnimation({ isIntersecting: true, isDocumentVisible: false, isPaused: false }),
    false
  );
  assert.strictEqual(
    shouldRunCanvasAnimation({ isIntersecting: true, isDocumentVisible: true, isPaused: true }),
    false
  );
});

test('modalGuardEngine: touch two-tap backdrop safeguard prevents single-tap accidental modal closure', () => {
  const firstTap = evaluateTouchBackdropTap(0, 1000, false);
  assert.strictEqual(firstTap.decision, 'ignore');
  assert.strictEqual(firstTap.nextLastTapMs, 1000);

  // Second tap within 450ms closes clean modal
  const secondTapClean = evaluateTouchBackdropTap(firstTap.nextLastTapMs, 1300, false);
  assert.strictEqual(secondTapClean.decision, 'close_immediately');

  // Second tap within 450ms on dirty modal prompts unsaved confirmation
  const secondTapDirty = evaluateTouchBackdropTap(1000, 1250, true);
  assert.strictEqual(secondTapDirty.decision, 'prompt_unsaved_confirmation');
});

test('mobilePwaEngine: bottom navigation items cover core views and drawer toggle without standalone timeline', () => {
  assert.strictEqual(MOBILE_BOTTOM_NAV_ITEMS.length, 6);
  const ids = MOBILE_BOTTOM_NAV_ITEMS.map((item) => item.id);
  assert.ok(ids.includes('dashboard'));
  assert.ok(!ids.includes('timeline'), 'Daily Timeline must not appear in Mobile Bottom Nav');
  assert.ok(ids.includes('calendar'));
  assert.ok(ids.includes('notes'));
  assert.ok(ids.includes('funds'));
  assert.ok(ids.includes('goals'));
  const menuToggle = MOBILE_BOTTOM_NAV_ITEMS.find((item) => item.isDrawerToggle);
  assert.ok(menuToggle, 'Must include a mobile drawer toggle item');
});

test('mobilePwaEngine: index.html, manifest.json, sw.js, and native Brand Emblem PNG/SVG icons satisfy PWA and v26.11.2 requirements', () => {
  const indexHtmlPath = path.join(process.cwd(), 'index.html');
  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  const checklist = verifyHtmlPwaMetaTags(htmlContent);

  assert.strictEqual(checklist.hasViewportFitCover, true, 'index.html must include viewport-fit=cover');
  assert.strictEqual(checklist.hasAppleMobileWebAppCapable, true, 'index.html must include apple-mobile-web-app-capable=yes');
  assert.strictEqual(checklist.hasMobileWebAppCapable, true, 'index.html must include mobile-web-app-capable=yes');
  assert.strictEqual(checklist.hasFlatBlackThemeColor, true, 'index.html must include theme-color #000000');
  assert.strictEqual(checklist.hasManifestLink, true, 'index.html must link /manifest.json');

  // Verify index.html links native Brand Emblem icons
  assert.ok(htmlContent.includes('href="/favicon.svg"'), 'index.html must link /favicon.svg');
  assert.ok(htmlContent.includes('href="/icon-180.png"'), 'index.html must link /icon-180.png for apple-touch-icon');
  assert.ok(htmlContent.includes('href="/icon-192.png"'), 'index.html must link /icon-192.png');
  assert.ok(htmlContent.includes('href="/icon-512.png"'), 'index.html must link /icon-512.png');
  assert.ok(htmlContent.includes('href="/Axiom-Aegis.ico"'), 'index.html must link /Axiom-Aegis.ico');

  // Verify PNG dimensions of public/icon-180.png, public/icon-192.png, public/icon-512.png
  for (const [fileName, expectedDim] of [
    ['icon-180.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ] as const) {
    const p = path.join(process.cwd(), 'public', fileName);
    assert.ok(fs.existsSync(p), `public/${fileName} must exist`);
    const buf = fs.readFileSync(p);
    assert.strictEqual(buf[0], 0x89, `${fileName} must have PNG magic byte`);
    assert.strictEqual(buf.readUInt32BE(16), expectedDim, `${fileName} width must be ${expectedDim}`);
    assert.strictEqual(buf.readUInt32BE(20), expectedDim, `${fileName} height must be ${expectedDim}`);
  }

  const svgPath = path.join(process.cwd(), 'public', 'favicon.svg');
  assert.ok(fs.existsSync(svgPath), 'public/favicon.svg must exist');
  assert.ok(fs.readFileSync(svgPath, 'utf8').includes('<svg'), 'favicon.svg must be valid SVG');

  const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.strictEqual(manifest.background_color, '#000000');
  assert.strictEqual(manifest.theme_color, '#000000');
  assert.strictEqual(manifest.display, 'standalone');
  assert.strictEqual(manifest.version, '26.11.20');
  assert.ok(
    manifest.icons.some((ic: any) => ic.src === '/icon-192.png' && ic.type === 'image/png'),
    'manifest.json must include /icon-192.png as image/png'
  );
  assert.ok(
    manifest.icons.some((ic: any) => ic.src === '/icon-512.png' && ic.type === 'image/png'),
    'manifest.json must include /icon-512.png as image/png'
  );

  const swPath = path.join(process.cwd(), 'public', 'sw.js');
  assert.ok(fs.existsSync(swPath), 'public/sw.js must exist for offline PWA installability');

  // Verify changelog tracks active v26.11.20 release down to v26.11.2 baseline release
  assert.strictEqual(CHANGELOG_RELEASES.length, 4);
  assert.strictEqual(CHANGELOG_RELEASES[0].version, 'v26.11.20');
  assert.strictEqual(CHANGELOG_RELEASES[0].date, '2026-11-20');
  assert.strictEqual(CHANGELOG_RELEASES[0].isCurrent, true);
  assert.strictEqual(CHANGELOG_RELEASES[1].version, 'v26.11.04');
  assert.strictEqual(CHANGELOG_RELEASES[1].date, '2026-11-04');
  assert.strictEqual(CHANGELOG_RELEASES[1].isCurrent, false);
  assert.strictEqual(CHANGELOG_RELEASES[2].version, 'v26.11.3');
  assert.strictEqual(CHANGELOG_RELEASES[2].date, '2026-11-03');
  assert.strictEqual(CHANGELOG_RELEASES[2].isCurrent, false);
  assert.strictEqual(CHANGELOG_RELEASES[3].version, 'v26.11.2');
  assert.strictEqual(CHANGELOG_RELEASES[3].date, '2026-11-02');
});
