/**
 * Aegis Visualizer Mathematics & 3D Projection Engine
 * Powers the Aegis Quantum Shield, Neural Lattice, and Cybernetic Waveform visualizer
 * in Axiom Aegis (AA) v3.5.
 */

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface ProjectedPoint3D {
  screenX: number;
  screenY: number;
  scale: number;
  alpha: number;
  depth: number;
}

export interface AegisShieldNode {
  id: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  layer: 'core' | 'inner' | 'shield' | 'outer';
  size: number;
  phase: number;
  connections: number[];
}

export interface AegisOrbitalRing {
  id: string;
  tiltX: number;
  tiltY: number;
  speed: number;
  radius: number;
  dashed: boolean;
  points: Vector3D[];
}

export interface NeuralNode {
  id: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  pulsePhase: number;
}

export type VisualizerMode = 'bottle' | 'shield' | 'neural' | 'wave';
export type SpeedCadence = 'nominal' | 'harmonic' | 'overdrive';

export interface Point2D {
  x: number;
  y: number;
}

export interface LightningBolt {
  id: string;
  mainPath: Point2D[];
  branches: Point2D[][];
  contactPoint: Point2D;
  intensity: number;
  isAttractor: boolean;
  colorVariant: 'primary' | 'cyan' | 'violet' | 'white';
}

export interface BottleSparkParticle {
  id: number;
  x: number; // normalized -1..1 within bottle width
  y: number; // normalized -1 (top neck) .. 1 (bottom base)
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
}

export const VISUALIZER_THEME = {
  cardBg: '#000000',
  cardBorder: '#1E222B',
  canvasBg: '#000000',
  canvasBorder: '#1E222B',
  defaultAccent: '#00E5FF',
} as const;

/**
 * Rotates a 3D point around X and Y axes with perspective depth calculation.
 */
export function rotateAndProject(
  point: Vector3D,
  rotX: number,
  rotY: number,
  centerX: number,
  centerY: number,
  scaleFactor: number,
  perspective: number = 400
): ProjectedPoint3D {
  // Rotate around Y axis
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = point.x * cosY + point.z * sinY;
  const z1 = -point.x * sinY + point.z * cosY;

  // Rotate around X axis
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const y2 = point.y * cosX - z1 * sinX;
  const z2 = point.y * sinX + z1 * cosX;

  // Canonical perspective projection: positive z is towards camera
  const distance = Math.max(20, perspective - z2 * scaleFactor * 0.7);
  const scale = perspective / distance;

  const screenX = centerX + x1 * scaleFactor * scale;
  const screenY = centerY + y2 * scaleFactor * scale;

  // Depth-based alpha fade (points in front are brighter, points in back fade out)
  const normalizedDepth = (z2 + 1.2) / 2.4; // 0 (far) to 1 (near)
  const alpha = Math.max(0.12, Math.min(1.0, normalizedDepth));

  return {
    screenX,
    screenY,
    scale,
    alpha,
    depth: z2,
  };
}

/**
 * Generates an Aegis Shield 3D Geodesic Lattice with inner quantum core,
 * hexagonal shield nodes, and predefined inter-node structural struts.
 */
export function generateAegisShieldLattice(density: number = 72): AegisShieldNode[] {
  const safeCount = Math.max(36, Math.min(180, Math.floor(density)));
  const nodes: AegisShieldNode[] = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  // 1. Quantum Core nodes (inner polyhedral core)
  const coreVertices: Vector3D[] = [
    { x: -0.3, y: -0.3, z: 0.3 },
    { x: 0.3, y: -0.3, z: 0.3 },
    { x: 0.3, y: 0.3, z: 0.3 },
    { x: -0.3, y: 0.3, z: 0.3 },
    { x: 0, y: 0, z: 0.45 },
    { x: 0, y: 0, z: -0.45 },
    { x: 0.45, y: 0, z: 0 },
    { x: -0.45, y: 0, z: 0 },
  ];

  coreVertices.forEach((v, idx) => {
    nodes.push({
      id: idx,
      baseX: v.x,
      baseY: v.y,
      baseZ: v.z,
      layer: 'core',
      size: 2.8,
      phase: idx * 0.45,
      connections: [],
    });
  });

  // 2. Shield Dome & Shell Nodes via Fibonacci Spiral Lattice on Hemisphere/Sphere
  const shellCount = safeCount - coreVertices.length;
  for (let i = 0; i < shellCount; i++) {
    const y = 1 - (i / (shellCount - 1)) * 2; // -1 to 1
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = (2 * Math.PI * i) / goldenRatio;

    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    // Distinguish shield plates (forward facing z > 0) vs back support framework
    const isForwardShield = z > 0.1;
    const layer = isForwardShield ? 'shield' : i % 2 === 0 ? 'inner' : 'outer';
    const radiusMultiplier = isForwardShield ? 1.05 : 0.88;

    nodes.push({
      id: coreVertices.length + i,
      baseX: x * radiusMultiplier,
      baseY: y * radiusMultiplier,
      baseZ: z * radiusMultiplier,
      layer,
      size: isForwardShield ? 2.4 : 1.6,
      phase: (i * 0.33) % (Math.PI * 2),
      connections: [],
    });
  }

  // Pre-calculate nearest neighbour structural connections for wireframe lattice
  for (let i = 0; i < nodes.length; i++) {
    const distances: { targetId: number; dist: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const dx = nodes[i].baseX - nodes[j].baseX;
      const dy = nodes[i].baseY - nodes[j].baseY;
      const dz = nodes[i].baseZ - nodes[j].baseZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Connect nearby nodes within structural distance
      if (dist < 0.58) {
        distances.push({ targetId: nodes[j].id, dist });
      }
    }
    // Sort and keep up to 3 closest connections to avoid clutter
    distances.sort((a, b) => a.dist - b.dist);
    nodes[i].connections = distances.slice(0, 3).map((d) => d.targetId);
  }

  return nodes;
}

/**
 * Generates Gyroscopic Orbital Telemetry Rings for the Aegis Shield
 */
export function generateAegisOrbitalRings(segments: number = 48): AegisOrbitalRing[] {
  const safeSegments = Math.max(24, Math.min(96, Math.floor(segments)));
  const baseCircle: Vector3D[] = [];

  for (let i = 0; i < safeSegments; i++) {
    const angle = (i / safeSegments) * Math.PI * 2;
    baseCircle.push({
      x: Math.cos(angle),
      y: 0,
      z: Math.sin(angle),
    });
  }

  return [
    {
      id: 'equatorial-telemetry-ring',
      tiltX: 0.25,
      tiltY: 0,
      speed: 0.65,
      radius: 1.25,
      dashed: true,
      points: baseCircle,
    },
    {
      id: 'polar-containment-ring',
      tiltX: 1.45,
      tiltY: 0.6,
      speed: -0.45,
      radius: 1.4,
      dashed: false,
      points: baseCircle,
    },
    {
      id: 'shield-perimeter-ring',
      tiltX: -0.85,
      tiltY: 0.35,
      speed: 0.85,
      radius: 1.15,
      dashed: true,
      points: baseCircle,
    },
  ];
}

/**
 * Generates initial particles for the 3D Neural Synapse Lattice mode.
 */
export function generateNeuralLatticeNodes(count: number = 80): NeuralNode[] {
  const safeCount = Math.max(30, Math.min(160, Math.floor(count)));
  const nodes: NeuralNode[] = [];

  for (let i = 0; i < safeCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 0.3 + Math.cbrt(Math.random()) * 0.8; // Uniform distribution in sphere

    nodes.push({
      id: i,
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
      vx: (Math.random() - 0.5) * 0.08,
      vy: (Math.random() - 0.5) * 0.08,
      vz: (Math.random() - 0.5) * 0.08,
      size: 1.8 + Math.random() * 1.5,
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  return nodes;
}

/**
 * Advances the 3D Neural Nodes inside an elastic containment sphere with cursor repulsion.
 */
export function stepNeuralLattice(
  nodes: NeuralNode[],
  dt: number,
  cursor: { x: number; y: number; active: boolean },
  boundaryRadius: number = 1.15
): NeuralNode[] {
  return nodes.map((node) => {
    let nx = node.x + node.vx * dt;
    let ny = node.y + node.vy * dt;
    let nz = node.z + node.vz * dt;
    let nvx = node.vx;
    let nvy = node.vy;
    let nvz = node.vz;

    // Boundary bounce
    const distFromCenter = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (distFromCenter > boundaryRadius) {
      const normalX = nx / distFromCenter;
      const normalY = ny / distFromCenter;
      const normalZ = nz / distFromCenter;
      const dot = nvx * normalX + nvy * normalY + nvz * normalZ;
      nvx -= 2 * dot * normalX;
      nvy -= 2 * dot * normalY;
      nvz -= 2 * dot * normalZ;
      nx = normalX * boundaryRadius;
      ny = normalY * boundaryRadius;
      nz = normalZ * boundaryRadius;
    }

    // Cursor influence (gentle repulsive force when active)
    if (cursor.active) {
      const dx = nx - cursor.x;
      const dy = ny - cursor.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < 0.35 && d2 > 0.001) {
        const force = 0.04 / (d2 + 0.04);
        nvx += dx * force;
        nvy += dy * force;
      }
    }

    // Dampen slight drift velocity
    nvx *= 0.995;
    nvy *= 0.995;
    nvz *= 0.995;

    return {
      ...node,
      x: nx,
      y: ny,
      z: nz,
      vx: nvx,
      vy: nvy,
      vz: nvz,
      pulsePhase: (node.pulsePhase + dt * 2) % (Math.PI * 2),
    };
  });
}

/**
 * Computes kinetic frequency waveform points for the cybernetic oscilloscope mode.
 */
export function calculateWaveformPoint(
  index: number,
  totalBars: number,
  time: number,
  cadenceMultiplier: number = 1
): { angle: number; innerR: number; outerR: number; alpha: number } {
  const angle = (index / totalBars) * Math.PI * 2;
  const harmonic1 = Math.sin(angle * 4 + time * 3 * cadenceMultiplier);
  const harmonic2 = Math.cos(angle * 7 - time * 2.1 * cadenceMultiplier);
  const harmonic3 = Math.sin(angle * 12 + time * 4.5 * cadenceMultiplier);

  const combined = (harmonic1 * 0.45 + harmonic2 * 0.35 + harmonic3 * 0.2 + 1) / 2; // 0 to 1
  const barHeight = 0.15 + combined * 0.45;

  return {
    angle,
    innerR: 0.65,
    outerR: 0.65 + barHeight,
    alpha: 0.4 + combined * 0.6,
  };
}

/**
 * Computes the normalized half-width (0..1) of the glass bottle containment vessel
 * at a given vertical coordinate normY in [-1, 1] (-1 = top of neck, +1 = bottom base).
 */
export function computeBottleHalfWidthAtNormY(normY: number): number {
  const y = Math.max(-1, Math.min(1, normY));

  // Top lip flare (-1.0 to -0.88)
  if (y < -0.88) {
    return 0.28;
  }
  // Narrow cylindrical neck (-0.88 to -0.58)
  if (y < -0.58) {
    return 0.24;
  }
  // Smooth S-curve shoulder transition (-0.58 to -0.22)
  if (y < -0.22) {
    const t = (y - -0.58) / (-0.22 - -0.58); // 0..1
    const smooth = t * t * (3 - 2 * t);
    return 0.24 + smooth * (0.76 - 0.24);
  }
  // Main containment chamber (-0.22 to +0.76) with subtle organic barrel curve
  if (y < 0.76) {
    const midT = (y - -0.22) / (0.76 - -0.22); // 0..1
    const swell = Math.sin(midT * Math.PI) * 0.06;
    return 0.76 + swell;
  }
  // Rounded bottom base (+0.76 to +1.0)
  const baseT = (y - 0.76) / (1.0 - 0.76); // 0..1
  return 0.76 - baseT * baseT * 0.18;
}

/**
 * Deterministic-capable pseudo-random helper for reproducible or animated plasma jitter
 */
function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Generates a fractal lightning bolt polyline between start and end using
 * recursive midpoint displacement perpendicular to each segment.
 */
export function generateLightningBoltPoints(
  start: Point2D,
  end: Point2D,
  subdivisions: number = 4,
  jitterScale: number = 0.16,
  seed: number = Math.random() * 1000
): Point2D[] {
  const safeSubdivisions = Math.max(1, Math.min(6, Math.floor(subdivisions)));
  let points: Point2D[] = [
    { x: start.x, y: start.y },
    { x: end.x, y: end.y },
  ];

  const totalDx = end.x - start.x;
  const totalDy = end.y - start.y;
  const totalLen = Math.sqrt(totalDx * totalDx + totalDy * totalDy);
  if (totalLen < 0.001) {
    return points;
  }

  let currentOffset = totalLen * jitterScale;
  let stepSeed = seed;

  for (let iter = 0; iter < safeSubdivisions; iter++) {
    const nextPoints: Point2D[] = [points[0]];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const midX = (p1.x + p2.x) * 0.5;
      const midY = (p1.y + p2.y) * 0.5;

      const segDx = p2.x - p1.x;
      const segDy = p2.y - p1.y;
      const segLen = Math.sqrt(segDx * segDx + segDy * segDy) || 1;

      // Unit normal perpendicular to segment
      const nx = -segDy / segLen;
      const ny = segDx / segLen;

      stepSeed += 17.37 + i * 3.1;
      const randSigned = (seededNoise(stepSeed) - 0.5) * 2;
      const displaced: Point2D = {
        x: midX + nx * randSigned * currentOffset,
        y: midY + ny * randSigned * currentOffset,
      };

      nextPoints.push(displaced, p2);
    }
    points = nextPoints;
    currentOffset *= 0.54;
  }

  return points;
}

/**
 * Generates the active ensemble of plasma lightning arcs inside the glass bottle,
 * including inner-wall ground strikes, forked secondary branches, and interactive
 * cursor/touch attractor bolts.
 */
export function generateBottleLightningBolts(params: {
  coreX: number;
  coreY: number;
  bottleCenterX: number;
  bottleCenterY: number;
  bottleHalfWidthPx: number;
  bottleHalfHeightPx: number;
  timeSec: number;
  boltCount?: number;
  surgeIntensity?: number;
  pointer?: { x: number; y: number; active: boolean };
}): LightningBolt[] {
  const {
    coreX,
    coreY,
    bottleCenterX,
    bottleCenterY,
    bottleHalfWidthPx,
    bottleHalfHeightPx,
    timeSec,
    boltCount = 7,
    surgeIntensity = 0,
    pointer,
  } = params;

  const totalBolts = Math.max(3, Math.min(18, Math.floor(boltCount + surgeIntensity * 5)));
  const bolts: LightningBolt[] = [];
  const colorVariants: LightningBolt['colorVariant'][] = ['primary', 'cyan', 'violet', 'white'];

  for (let i = 0; i < totalBolts; i++) {
    // Distribute angles around the core, drifting organically over time
    const baseAngle =
      (i / totalBolts) * Math.PI * 2 +
      Math.sin(timeSec * 0.9 + i * 1.7) * 0.45 +
      timeSec * (i % 2 === 0 ? 0.32 : -0.24);

    // Target vertical position on the bottle wall (-0.52 to +0.86)
    const rawSinY = Math.sin(baseAngle);
    const targetNormY = Math.max(-0.5, Math.min(0.86, rawSinY * 0.72 + 0.14));
    const wallHalfW = computeBottleHalfWidthAtNormY(targetNormY);
    const sideSign = Math.cos(baseAngle) >= 0 ? 1 : -1;

    // Some bolts strike the glass wall, while a few arc toward the top anode or base
    const reachWallRatio = 0.88 + 0.1 * Math.sin(timeSec * 3.1 + i * 2.3);
    const contactX =
      bottleCenterX + sideSign * wallHalfW * bottleHalfWidthPx * reachWallRatio;
    const contactY = bottleCenterY + targetNormY * bottleHalfHeightPx;

    const frameSeed = Math.floor(timeSec * 22) * 13.7 + i * 41.9;
    const mainPath = generateLightningBoltPoints(
      { x: coreX, y: coreY },
      { x: contactX, y: contactY },
      4,
      0.18 + surgeIntensity * 0.05,
      frameSeed
    );

    // Generate 1-2 forked secondary branches from intermediate vertices
    const branches: Point2D[][] = [];
    if (mainPath.length >= 6) {
      const forkIdx = Math.floor(mainPath.length * 0.45);
      const forkOrigin = mainPath[forkIdx];
      const forkEnd: Point2D = {
        x: forkOrigin.x + (contactX - coreX) * 0.38,
        y: forkOrigin.y + (contactY - coreY) * 0.35 + (i % 2 === 0 ? 18 : -18),
      };
      branches.push(
        generateLightningBoltPoints(forkOrigin, forkEnd, 3, 0.15, frameSeed + 99.1)
      );

      if (surgeIntensity > 0.2 || i % 2 === 0) {
        const forkIdx2 = Math.floor(mainPath.length * 0.7);
        const forkOrigin2 = mainPath[forkIdx2];
        const forkEnd2: Point2D = {
          x: forkOrigin2.x + (contactX - coreX) * 0.25,
          y: forkOrigin2.y + (i % 2 === 0 ? -22 : 22),
        };
        branches.push(
          generateLightningBoltPoints(forkOrigin2, forkEnd2, 2, 0.14, frameSeed + 199.3)
        );
      }
    }

    const pulse = 0.55 + 0.45 * Math.abs(Math.sin(timeSec * 6.5 + i * 1.9));
    bolts.push({
      id: `bolt-${i}`,
      mainPath,
      branches,
      contactPoint: { x: contactX, y: contactY },
      intensity: Math.min(1, pulse + surgeIntensity * 0.35),
      isAttractor: false,
      colorVariant: colorVariants[i % colorVariants.length],
    });
  }

  // If user is touching/hovering the bottle, add a braided supercharged attractor bolt to the glass contact point
  if (pointer && pointer.active) {
    const clampedNormY = Math.max(-0.75, Math.min(0.88, pointer.y));
    const maxWallW = computeBottleHalfWidthAtNormY(clampedNormY);
    const clampedNormX = Math.max(-maxWallW, Math.min(maxWallW, pointer.x));

    const targetX = bottleCenterX + clampedNormX * bottleHalfWidthPx;
    const targetY = bottleCenterY + clampedNormY * bottleHalfHeightPx;
    const attractorSeed = Math.floor(timeSec * 30) * 19.3;

    const primaryStrand = generateLightningBoltPoints(
      { x: coreX, y: coreY },
      { x: targetX, y: targetY },
      4,
      0.14,
      attractorSeed
    );
    const secondaryStrand = generateLightningBoltPoints(
      { x: coreX, y: coreY },
      { x: targetX, y: targetY },
      4,
      0.21,
      attractorSeed + 53.7
    );

    bolts.push({
      id: 'bolt-attractor',
      mainPath: primaryStrand,
      branches: [secondaryStrand],
      contactPoint: { x: targetX, y: targetY },
      intensity: 1.0,
      isAttractor: true,
      colorVariant: 'white',
    });
  }

  return bolts;
}

/**
 * Generates initial ionized plasma spark motes inside the glass bottle.
 */
export function generateBottleSparks(count: number = 36): BottleSparkParticle[] {
  const safeCount = Math.max(12, Math.min(90, Math.floor(count)));
  const sparks: BottleSparkParticle[] = [];

  for (let i = 0; i < safeCount; i++) {
    const y = -0.45 + Math.random() * 1.25; // -0.45 to +0.80
    const maxW = computeBottleHalfWidthAtNormY(y) * 0.82;
    const x = (Math.random() * 2 - 1) * maxW;

    sparks.push({
      id: i,
      x,
      y,
      vx: (Math.random() - 0.5) * 0.25,
      vy: -(0.12 + Math.random() * 0.28), // Buoyant upward plasma drift
      size: 1.1 + Math.random() * 2.1,
      alpha: 0.35 + Math.random() * 0.65,
      phase: Math.random() * Math.PI * 2,
    });
  }

  return sparks;
}

/**
 * Steps the ionized spark particles inside the bottle containment profile.
 */
export function stepBottleSparks(
  sparks: BottleSparkParticle[],
  dt: number,
  cadenceMultiplier: number = 1,
  surgeIntensity: number = 0
): BottleSparkParticle[] {
  const speedBoost = cadenceMultiplier * (1 + surgeIntensity * 1.8);

  return sparks.map((s) => {
    const nextPhase = (s.phase + dt * 3.5 * speedBoost) % (Math.PI * 2);
    let nx = s.x + (s.vx + Math.sin(nextPhase) * 0.14) * dt * speedBoost;
    let ny = s.y + s.vy * dt * speedBoost;
    let nvx = s.vx;

    // Recycle spark at bottom of bottle when it rises into the narrow neck
    if (ny < -0.68) {
      ny = 0.82;
      const bottomMaxW = computeBottleHalfWidthAtNormY(ny) * 0.75;
      nx = (seededNoise(s.id * 13.7 + nextPhase) * 2 - 1) * bottomMaxW;
    }

    // Keep strictly inside the contoured glass bottle walls
    const wallLimit = computeBottleHalfWidthAtNormY(ny) * 0.86;
    if (Math.abs(nx) > wallLimit) {
      nx = Math.sign(nx) * wallLimit;
      nvx = -nvx * 0.8;
    }

    return {
      ...s,
      x: nx,
      y: ny,
      vx: nvx,
      phase: nextPhase,
    };
  });
}

