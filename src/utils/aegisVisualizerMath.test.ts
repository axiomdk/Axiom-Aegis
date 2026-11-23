import { test } from 'node:test';
import assert from 'node:assert';
import {
  rotateAndProject,
  generateAegisShieldLattice,
  generateAegisOrbitalRings,
  generateNeuralLatticeNodes,
  stepNeuralLattice,
  calculateWaveformPoint,
  computeBottleHalfWidthAtNormY,
  generateLightningBoltPoints,
  generateBottleLightningBolts,
  generateBottleSparks,
  stepBottleSparks,
} from './aegisVisualizerMath';

test('rotateAndProject: projects 3D coordinates into valid 2D screen positions with perspective', () => {
  const center = { x: 0, y: 0, z: 0 };
  const projectedCenter = rotateAndProject(center, 0, 0, 200, 150, 100);

  assert.strictEqual(projectedCenter.screenX, 200);
  assert.strictEqual(projectedCenter.screenY, 150);
  assert.strictEqual(projectedCenter.depth, 0);
  assert.ok(projectedCenter.alpha >= 0 && projectedCenter.alpha <= 1);
  assert.ok(!isNaN(projectedCenter.scale));

  // Forward point (positive Z) has higher alpha & scale than backward point (negative Z)
  const forward = rotateAndProject({ x: 0, y: 0, z: 0.8 }, 0, 0, 200, 150, 100);
  const backward = rotateAndProject({ x: 0, y: 0, z: -0.8 }, 0, 0, 200, 150, 100);

  assert.ok(forward.alpha > backward.alpha, 'Foreground points must have higher alpha than background');
  assert.ok(forward.scale > backward.scale, 'Foreground points must have larger perspective scale');
});

test('generateAegisShieldLattice: generates balanced core and shield shell nodes with connections', () => {
  const nodes = generateAegisShieldLattice(72);

  assert.strictEqual(nodes.length, 72);
  const coreNodes = nodes.filter((n) => n.layer === 'core');
  const shieldNodes = nodes.filter((n) => n.layer === 'shield');

  assert.strictEqual(coreNodes.length, 8, 'Must include 8 central quantum core polyhedral vertices');
  assert.ok(shieldNodes.length >= 20, 'Must include a substantial set of forward shield plates');

  // Verify connections are bounded and valid node IDs
  nodes.forEach((n) => {
    assert.ok(n.connections.length <= 3, 'Max 3 struts per node to preserve sleek wireframe');
    n.connections.forEach((connId) => {
      assert.ok(connId >= 0 && connId < nodes.length, 'Connection target must be valid node index');
      assert.notStrictEqual(connId, n.id, 'Node cannot connect to itself');
    });
  });
});

test('generateAegisOrbitalRings: generates 3 gyroscopic telemetry rings with valid geometry', () => {
  const rings = generateAegisOrbitalRings(36);

  assert.strictEqual(rings.length, 3, 'Must generate 3 gyroscopic rings (equatorial, polar, perimeter)');
  rings.forEach((ring) => {
    assert.strictEqual(ring.points.length, 36);
    assert.ok(ring.radius > 1.0, 'Orbital rings must orbit outside the unit sphere');
    assert.ok(ring.speed !== 0, 'Rings must have non-zero rotation speed');
  });
});

test('generateNeuralLatticeNodes & stepNeuralLattice: containment and repulsion', () => {
  const initialNodes = generateNeuralLatticeNodes(40);
  assert.strictEqual(initialNodes.length, 40);

  // Advance simulation with cursor at (0, 0)
  const stepped = stepNeuralLattice(
    initialNodes,
    0.016,
    { x: 0, y: 0, active: true },
    1.2
  );

  assert.strictEqual(stepped.length, 40);
  stepped.forEach((n) => {
    const dist = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
    assert.ok(dist <= 1.25, 'Nodes must remain contained within the elastic boundary radius');
    assert.ok(!isNaN(n.x) && !isNaN(n.y) && !isNaN(n.z));
  });
});

test('calculateWaveformPoint: computes bounded radial bar coordinates', () => {
  const total = 64;
  for (let i = 0; i < total; i++) {
    const wp = calculateWaveformPoint(i, total, 1.5, 1.0);
    assert.ok(wp.angle >= 0 && wp.angle <= Math.PI * 2);
    assert.ok(wp.outerR > wp.innerR, 'Outer radius of frequency bar must exceed inner radius');
    assert.ok(wp.alpha >= 0.4 && wp.alpha <= 1.0);
  }
});

test('Lightning in a Bottle: bottle profile, fractal midpoint bolts, attractor arcs, and spark containment', () => {
  // 1. Bottle profile: neck is narrower than main body
  const neckW = computeBottleHalfWidthAtNormY(-0.75);
  const bodyW = computeBottleHalfWidthAtNormY(0.25);
  assert.ok(neckW < bodyW, 'Bottle neck must be narrower than main containment body');
  assert.ok(bodyW > 0.7 && bodyW <= 0.85, 'Main bottle body half-width must be within expected vessel bounds');

  // 2. Fractal lightning bolt subdivision preserves start and end endpoints
  const pts = generateLightningBoltPoints({ x: 100, y: 100 }, { x: 220, y: 180 }, 4, 0.16, 42);
  assert.strictEqual(pts.length, 17, '4 subdivisions of 1 segment must yield 2^4 + 1 = 17 vertices');
  assert.strictEqual(pts[0].x, 100);
  assert.strictEqual(pts[0].y, 100);
  assert.strictEqual(pts[pts.length - 1].x, 220);
  assert.strictEqual(pts[pts.length - 1].y, 180);

  // 3. Bottle lightning bolts generator + pointer attractor bolt
  const bolts = generateBottleLightningBolts({
    coreX: 180,
    coreY: 120,
    bottleCenterX: 180,
    bottleCenterY: 120,
    bottleHalfWidthPx: 90,
    bottleHalfHeightPx: 95,
    timeSec: 2.5,
    boltCount: 6,
    surgeIntensity: 0.5,
    pointer: { x: 0.5, y: 0.2, active: true },
  });
  assert.ok(bolts.length >= 7, 'Must generate base bolts + surge bolts + pointer attractor bolt');
  const attractor = bolts.find((b) => b.isAttractor);
  assert.ok(attractor, 'Active pointer must spawn a braided supercharged attractor bolt');
  assert.ok(attractor.branches.length >= 1, 'Attractor bolt must include braided secondary strand');

  // 4. Ionized sparks stay strictly inside the contoured bottle walls
  const initialSparks = generateBottleSparks(30);
  assert.strictEqual(initialSparks.length, 30);
  const steppedSparks = stepBottleSparks(initialSparks, 0.05, 1.4, 0.8);
  assert.strictEqual(steppedSparks.length, 30);
  steppedSparks.forEach((s) => {
    const maxWall = computeBottleHalfWidthAtNormY(s.y) * 0.87;
    assert.ok(Math.abs(s.x) <= maxWall + 1e-6, 'Spark X coordinate must remain inside glass bottle wall');
  });
});

