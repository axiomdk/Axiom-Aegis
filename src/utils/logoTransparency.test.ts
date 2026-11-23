import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEmblemForegroundPixel,
  removeBlueBackgroundFromRgba,
} from './logoTransparency';

test('computeEmblemForegroundPixel makes dark navy/blue background and outer blue glow transparent', () => {
  // Solid dark blue corner background (~RGB 15, 22, 35)
  const bgPx = computeEmblemForegroundPixel(15, 22, 35);
  assert.strictEqual(bgPx.a, 0);

  // Dark blue interior pocket (~RGB 18, 28, 46)
  const pocketPx = computeEmblemForegroundPixel(18, 28, 46);
  assert.strictEqual(pocketPx.a, 0);

  // Soft outer blue glow around the shield (~RGB 20, 48, 88)
  const glowPx = computeEmblemForegroundPixel(20, 48, 88);
  assert.strictEqual(glowPx.a, 0);
});

test('computeEmblemForegroundPixel preserves white AXIOM AEGIS wordmark and silver/cyan icon', () => {
  // Crisp white "AXIOM AEGIS" text pixel
  const wordPx = computeEmblemForegroundPixel(248, 250, 252);
  assert.strictEqual(wordPx.a, 255);
  assert.ok(wordPx.r >= 245 && wordPx.g >= 245 && wordPx.b >= 245);

  // Metallic silver shield frame pixel
  const silverPx = computeEmblemForegroundPixel(175, 188, 202);
  assert.strictEqual(silverPx.a, 255);

  // Vibrant electric cyan/blue inner chevron pixel
  const cyanPx = computeEmblemForegroundPixel(18, 195, 250);
  assert.strictEqual(cyanPx.a, 255);

  // Mid-azure chevron facet pixel
  const azurePx = computeEmblemForegroundPixel(28, 120, 225);
  assert.strictEqual(azurePx.a, 255);
});

test('removeBlueBackgroundFromRgba processes RGBA buffer in-place and decontaminates edges', () => {
  // 2x2 buffer: 2 background pixels, 1 white word pixel, 1 cyan icon pixel
  const buf = new Uint8ClampedArray([
    15, 22, 35, 255, // top-left background
    16, 23, 36, 255, // top-right background
    250, 252, 255, 255, // bottom-left white text
    12, 210, 255, 255, // bottom-right cyan icon
  ]);

  removeBlueBackgroundFromRgba(buf, 2, 2);

  // First two pixels must be fully transparent (alpha = 0)
  assert.strictEqual(buf[3], 0);
  assert.strictEqual(buf[7], 0);

  // Third and fourth pixels must be fully opaque (alpha = 255)
  assert.strictEqual(buf[11], 255);
  assert.strictEqual(buf[15], 255);
});
