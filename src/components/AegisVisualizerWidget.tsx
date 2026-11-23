import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useVault } from '../context/VaultContext';
import {
  rotateAndProject,
  generateAegisShieldLattice,
  generateAegisOrbitalRings,
  generateNeuralLatticeNodes,
  stepNeuralLattice,
  calculateWaveformPoint,
  computeBottleHalfWidthAtNormY,
  generateBottleLightningBolts,
  generateBottleSparks,
  stepBottleSparks,
  AegisShieldNode,
  AegisOrbitalRing,
  NeuralNode,
  BottleSparkParticle,
  Point2D,
  VisualizerMode,
  SpeedCadence,
  VISUALIZER_THEME,
} from '../utils/aegisVisualizerMath';
import {
  getCappedDevicePixelRatio,
  shouldRunCanvasAnimation,
} from '../utils/mobilePwaEngine';
import {
  Shield,
  Radio,
  RotateCcw,
  Play,
  Pause,
  Zap,
  Maximize2,
  Minimize2,
  Sparkles,
  Flame,
} from 'lucide-react';

interface AegisVisualizerWidgetProps {
  title?: string;
  isColumnEditMode?: boolean;
  onTitleChange?: (newTitle: string) => void;
}

export const AegisVisualizerWidget: React.FC<AegisVisualizerWidgetProps> = React.memo(({
  title = 'Lightning in a Bottle',
  isColumnEditMode = false,
  onTitleChange,
}) => {
  const { accent } = useVault();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Visualizer interactive state — defaults to 'bottle' ("Lightning in a Bottle")
  const [mode, setMode] = useState<VisualizerMode>('bottle');
  const [cadence, setCadence] = useState<SpeedCadence>('nominal');
  const [density] = useState<number>(40);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isEcoIdle, setIsEcoIdle] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [fps] = useState<number>(40);
  const [voltageKv, setVoltageKv] = useState<number>(42.8);
  const [arcCount, setArcCount] = useState<number>(5);

  // References for requestAnimationFrame loop & lifecycle visibility
  const modeRef = useRef<VisualizerMode>('bottle');
  const cadenceRef = useRef<SpeedCadence>('nominal');
  const isPausedRef = useRef<boolean>(false);
  const isEcoIdleRef = useRef<boolean>(false);
  const lastInteractionMsRef = useRef<number>(performance.now());
  const wakeCanvasRef = useRef<(() => void) | null>(null);
  const isIntersectingRef = useRef<boolean>(true);
  const isDocumentVisibleRef = useRef<boolean>(
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  );
  const accentRef = useRef<string>(accent.hex);
  const surgeRef = useRef<number>(0);

  // 3D Rotation & Pointer Drag physics
  const rotationRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    isDragging: boolean;
    lastMouseX: number;
    lastMouseY: number;
  }>({
    x: 0.35,
    y: 0.65,
    vx: 0.003,
    vy: 0.008,
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0,
  });

  const pointerNormRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });

  // Keep refs in sync with React state
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    cadenceRef.current = cadence;
  }, [cadence]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    accentRef.current = accent.hex;
  }, [accent.hex]);

  // Trigger a high-voltage Capacitor Surge inside the bottle
  const handleTriggerLightningSurge = useCallback(() => {
    surgeRef.current = 1.0;
    setVoltageKv(88.4 + Math.round(Math.random() * 110) / 10);
    setArcCount(8);
    wakeCanvasRef.current?.();
  }, []);

  // Reset 3D Rotation & Bottle state
  const handleResetOrientation = useCallback(() => {
    rotationRef.current.x = 0.35;
    rotationRef.current.y = 0.65;
    rotationRef.current.vx = 0.003;
    rotationRef.current.vy = 0.008;
    surgeRef.current = 0.6;
    wakeCanvasRef.current?.();
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize models with low-stress particle counts
    const shieldNodes: AegisShieldNode[] = generateAegisShieldLattice(density);
    const orbitalRings: AegisOrbitalRing[] = generateAegisOrbitalRings(32);
    let neuralNodes: NeuralNode[] = generateNeuralLatticeNodes(Math.floor(density * 0.9));
    let bottleSparks: BottleSparkParticle[] = generateBottleSparks(18);

    let width = container.clientWidth || 360;
    let height = container.clientHeight || 240;
    const dpr = 1; // Cap DPR at 1x to reduce GPU fill-rate by 75% on Retina/4K displays

    const updateCanvasSize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        width = rect.width;
        height = rect.height;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }
    };

    updateCanvasSize();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            requestAnimationFrame(() => {
              updateCanvasSize();
            });
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', updateCanvasSize);
    }

    let animationFrameId: number = 0;
    let lastTime = performance.now();
    let lastRenderedFrameTime = 0;
    const TARGET_FPS = 40;
    const FRAME_INTERVAL_MS = 1000 / TARGET_FPS; // Stable 40 FPS (25ms frame interval)

    const strokePolyline = (pts: Point2D[]) => {
      if (pts.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    };

    const render = (now: number, forceRender: boolean = false) => {
      if (!forceRender && now - lastRenderedFrameTime < FRAME_INTERVAL_MS) {
        if (
          !isEcoIdleRef.current &&
          shouldRunCanvasAnimation({
            isIntersecting: isIntersectingRef.current,
            isDocumentVisible: isDocumentVisibleRef.current,
            isPaused: isPausedRef.current,
          })
        ) {
          animationFrameId = requestAnimationFrame(render);
        } else {
          animationFrameId = 0;
        }
        return;
      }

      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      lastRenderedFrameTime = now;

      const activeMode = modeRef.current;
      const activeCadence = cadenceRef.current;
      const paused = isPausedRef.current || isEcoIdleRef.current;
      const primaryColor = accentRef.current || VISUALIZER_THEME.defaultAccent;

      const cadenceMultiplier =
        activeCadence === 'overdrive' ? 2.2 : activeCadence === 'harmonic' ? 1.4 : 1.0;

      // Decay lightning capacitor surge smoothly
      if (!paused && surgeRef.current > 0) {
        surgeRef.current = Math.max(0, surgeRef.current - dt * 0.95);
      }

      // Physics step: Inertia & continuous auto-rotation if not dragging
      const rot = rotationRef.current;
      if (!rot.isDragging && !paused) {
        rot.x += rot.vx * cadenceMultiplier;
        rot.y += rot.vy * cadenceMultiplier;
        rot.x = ((rot.x % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        rot.y = ((rot.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Pure flat black canvas background (#000000)
      ctx.fillStyle = VISUALIZER_THEME.canvasBg;
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.38;

      // ==========================================
      // MODE 0: LIGHTNING IN A BOTTLE (DEFAULT)
      // ==========================================
      if (activeMode === 'bottle') {
        const timeSec = (paused ? lastTime / 1000 : now / 1000) * cadenceMultiplier;
        const surge = surgeRef.current;

        const bottleCenterX = centerX;
        const bottleCenterY = centerY + height * 0.055;
        const bottleHalfHeight = Math.min(height * 0.37, 165);
        const bottleHalfWidth = Math.min(width * 0.32, bottleHalfHeight * 0.78);

        // Core electrode position (slightly above bottle geometric center)
        const coreX = bottleCenterX + Math.sin(timeSec * 1.7) * 2.5;
        const coreY = bottleCenterY + bottleHalfHeight * 0.06;

        // 1. Ambient atmospheric backlight behind the glass bottle
        const ambientRadius = Math.max(bottleHalfWidth, bottleHalfHeight) * (1.35 + surge * 0.3);
        const bgGlow = ctx.createRadialGradient(
          coreX,
          coreY,
          4,
          bottleCenterX,
          bottleCenterY,
          ambientRadius
        );
        bgGlow.addColorStop(0, `${primaryColor}${surge > 0.2 ? '44' : '28'}`);
        bgGlow.addColorStop(0.45, '#38bdf818');
        bgGlow.addColorStop(0.75, '#8b5cf610');
        bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = bgGlow;
        ctx.fillRect(0, 0, width, height);

        // Build contoured bottle wall path points (-1 top neck to +1 bottom base)
        const steps = 44;
        const leftWall: Point2D[] = [];
        const rightWall: Point2D[] = [];
        for (let i = 0; i <= steps; i++) {
          const normY = -1 + (i / steps) * 2;
          const halfW = computeBottleHalfWidthAtNormY(normY);
          const py = bottleCenterY + normY * bottleHalfHeight;
          leftWall.push({ x: bottleCenterX - halfW * bottleHalfWidth, y: py });
          rightWall.push({ x: bottleCenterX + halfW * bottleHalfWidth, y: py });
        }

        // Helper to trace closed bottle silhouette path
        const traceBottlePath = () => {
          ctx.beginPath();
          ctx.moveTo(leftWall[0].x, leftWall[0].y);
          for (let i = 1; i < leftWall.length; i++) {
            ctx.lineTo(leftWall[i].x, leftWall[i].y);
          }
          // Curved bottom base
          const botLeft = leftWall[leftWall.length - 1];
          const botRight = rightWall[rightWall.length - 1];
          ctx.quadraticCurveTo(
            bottleCenterX,
            botLeft.y + bottleHalfHeight * 0.08,
            botRight.x,
            botRight.y
          );
          for (let i = rightWall.length - 2; i >= 0; i--) {
            ctx.lineTo(rightWall[i].x, rightWall[i].y);
          }
          ctx.closePath();
        };

        // 2. Draw Glass Bottle Dielectric Interior Fill & Internal Plasma Nebulae
        ctx.save();
        traceBottlePath();
        const glassFillGrad = ctx.createLinearGradient(
          bottleCenterX - bottleHalfWidth,
          bottleCenterY - bottleHalfHeight,
          bottleCenterX + bottleHalfWidth,
          bottleCenterY + bottleHalfHeight
        );
        glassFillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.09)');
        glassFillGrad.addColorStop(0.35, 'rgba(15, 23, 42, 0.55)');
        glassFillGrad.addColorStop(0.7, 'rgba(139, 92, 246, 0.08)');
        glassFillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.14)');
        ctx.fillStyle = glassFillGrad;
        ctx.fill();
        ctx.clip();

        // Swirling ionized gas clouds inside the bottle
        for (let c = 0; c < 2; c++) {
          const cloudY =
            bottleCenterY + Math.sin(timeSec * 0.8 + c * 2.4) * bottleHalfHeight * 0.35;
          const cloudX =
            bottleCenterX + Math.cos(timeSec * 0.6 + c * 1.9) * bottleHalfWidth * 0.25;
          const cloudGrad = ctx.createRadialGradient(
            cloudX,
            cloudY,
            2,
            cloudX,
            cloudY,
            bottleHalfWidth * 0.85
          );
          const cloudCol = c === 0 ? primaryColor : '#38bdf8';
          cloudGrad.addColorStop(0, `${cloudCol}${surge > 0.1 ? '30' : '1c'}`);
          cloudGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = cloudGrad;
          ctx.beginPath();
          ctx.arc(cloudX, cloudY, bottleHalfWidth * 0.85, 0, Math.PI * 2);
          ctx.fill();
        }

        // 3. Step & Render Floating Ionized Sparks trapped in the bottle
        if (!paused) {
          bottleSparks = stepBottleSparks(bottleSparks, dt, cadenceMultiplier, surge);
        }
        bottleSparks.forEach((sp) => {
          const sx = bottleCenterX + sp.x * bottleHalfWidth;
          const sy = bottleCenterY + sp.y * bottleHalfHeight;
          const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(sp.phase));
          ctx.beginPath();
          ctx.arc(sx, sy, sp.size * (1 + surge * 0.4), 0, Math.PI * 2);
          ctx.fillStyle = sp.id % 3 === 0 ? '#FFFFFF' : sp.id % 2 === 0 ? '#38bdf8' : primaryColor;
          ctx.globalAlpha = sp.alpha * twinkle;
          ctx.fill();
        });
        ctx.globalAlpha = 1.0;

        // 4. Draw Top Cork / Brass Insulator Cap & Descending Tungsten Anode Rod
        const neckTopY = bottleCenterY - bottleHalfHeight;
        const neckCapWidth = computeBottleHalfWidthAtNormY(-0.92) * bottleHalfWidth * 1.85;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(
          bottleCenterX - neckCapWidth * 0.5,
          neckTopY - 4,
          neckCapWidth,
          bottleHalfHeight * 0.18
        );

        // Metallic cathode coils on the neck
        ctx.strokeStyle = `${primaryColor}88`;
        ctx.lineWidth = 1.4;
        for (let ringIdx = 0; ringIdx < 3; ringIdx++) {
          const ry = neckTopY + bottleHalfHeight * (0.06 + ringIdx * 0.05);
          ctx.beginPath();
          ctx.moveTo(bottleCenterX - neckCapWidth * 0.46, ry);
          ctx.lineTo(bottleCenterX + neckCapWidth * 0.46, ry);
          ctx.stroke();
        }

        // Tungsten electrode rod descending from neck to coreX, coreY
        const rodGrad = ctx.createLinearGradient(bottleCenterX, neckTopY, coreX, coreY);
        rodGrad.addColorStop(0, '#64748b');
        rodGrad.addColorStop(0.7, '#cbd5e1');
        rodGrad.addColorStop(1, '#ffffff');
        ctx.strokeStyle = rodGrad;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(bottleCenterX, neckTopY + bottleHalfHeight * 0.14);
        ctx.lineTo(coreX, coreY);
        ctx.stroke();

        // 5. Generate & Render High-Voltage Fractal Lightning Bolts (Low-Stress Eco Count)
        const baseBoltCount =
          activeCadence === 'overdrive' ? 6 : activeCadence === 'harmonic' ? 5 : 4;
        const bolts = generateBottleLightningBolts({
          coreX,
          coreY,
          bottleCenterX,
          bottleCenterY,
          bottleHalfWidthPx: bottleHalfWidth,
          bottleHalfHeightPx: bottleHalfHeight,
          timeSec,
          boltCount: baseBoltCount,
          surgeIntensity: surge,
          pointer: pointerNormRef.current,
        });

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        bolts.forEach((bolt) => {
          const outerColor =
            bolt.colorVariant === 'cyan'
              ? '#38bdf8'
              : bolt.colorVariant === 'violet'
              ? '#a855f7'
              : primaryColor;

          // Pass 1: Outer plasma corona bloom
          ctx.strokeStyle = `${outerColor}${bolt.isAttractor ? '70' : '40'}`;
          ctx.lineWidth = bolt.isAttractor ? 6.5 : 4.2 * bolt.intensity;
          strokePolyline(bolt.mainPath);
          bolt.branches.forEach((br) => {
            ctx.lineWidth = bolt.isAttractor ? 4.0 : 2.2 * bolt.intensity;
            strokePolyline(br);
          });

          // Pass 2: White-hot filament core
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = bolt.isAttractor ? 1.8 : 1.05;
          strokePolyline(bolt.mainPath);

          // Inner glass wall contact plasma flare (zero radialGradient allocation per bolt)
          const cp = bolt.contactPoint;
          const flareRadius = bolt.isAttractor ? 11 : 6 + bolt.intensity * 3;
          ctx.fillStyle = outerColor;
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, flareRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = 0.85;
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, flareRadius * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });

        // 6. Central High-Voltage Plasma Singularity Sphere
        const coreOuterR = 22 + surge * 10 + Math.sin(timeSec * 8) * 2.5;
        const coreGrad = ctx.createRadialGradient(coreX, coreY, 1, coreX, coreY, coreOuterR);
        coreGrad.addColorStop(0, '#FFFFFF');
        coreGrad.addColorStop(0.28, '#e0f2fe');
        coreGrad.addColorStop(0.55, primaryColor);
        coreGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(coreX, coreY, coreOuterR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore(); // End bottle interior clip

        // 7. Draw Contoured Glass Bottle Outer Rim, Specular Reflections & Base Pedestal
        // Outer glass edge glow
        traceBottlePath();
        ctx.strokeStyle = `${primaryColor}55`;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Crisp borosilicate glass rim outline
        traceBottlePath();
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        // Top glass lip ellipse
        const lipHalfW = computeBottleHalfWidthAtNormY(-1) * bottleHalfWidth;
        ctx.beginPath();
        ctx.ellipse(
          bottleCenterX,
          bottleCenterY - bottleHalfHeight,
          lipHalfW,
          4.5,
          0,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = 'rgba(248, 250, 252, 0.75)';
        ctx.lineWidth = 1.4;
        ctx.stroke();

        // Bottom insulated pedestal ring
        const baseHalfW = computeBottleHalfWidthAtNormY(1) * bottleHalfWidth;
        ctx.beginPath();
        ctx.ellipse(
          bottleCenterX,
          bottleCenterY + bottleHalfHeight,
          baseHalfW,
          6,
          0,
          0,
          Math.PI
        );
        ctx.strokeStyle = `${primaryColor}66`;
        ctx.lineWidth = 1.6;
        ctx.stroke();

        // Left & Right Curved Fresnel Specular Glass Highlights
        ctx.beginPath();
        for (let i = 10; i <= 36; i++) {
          const pt = leftWall[i];
          const hx = pt.x + bottleHalfWidth * 0.11;
          if (i === 10) ctx.moveTo(hx, pt.y);
          else ctx.lineTo(hx, pt.y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 2.4;
        ctx.stroke();

        ctx.beginPath();
        for (let i = 14; i <= 34; i++) {
          const pt = rightWall[i];
          const hx = pt.x - bottleHalfWidth * 0.09;
          if (i === 14) ctx.moveTo(hx, pt.y);
          else ctx.lineTo(hx, pt.y);
        }
        ctx.strokeStyle = `${primaryColor}38`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // ==========================================
      // MODE 1: AEGIS SHIELD MATRIX
      // ==========================================
      else if (activeMode === 'shield') {
        const timeSec = (now / 1000) * cadenceMultiplier;

        const glowGrad = ctx.createRadialGradient(
          centerX,
          centerY,
          5,
          centerX,
          centerY,
          radius * 1.5
        );
        glowGrad.addColorStop(0, `${primaryColor}18`);
        glowGrad.addColorStop(0.5, `${primaryColor}06`);
        glowGrad.addColorStop(1, 'rgba(8, 9, 12, 0)');
        ctx.fillStyle = glowGrad;
        ctx.fillRect(0, 0, width, height);

        // 1. Draw Gyroscopic Orbital Telemetry Rings
        orbitalRings.forEach((ring) => {
          const ringRotX = rot.x + ring.tiltX;
          const ringRotY = rot.y + timeSec * ring.speed * 0.5;

          ctx.beginPath();
          if (ring.dashed) {
            ctx.setLineDash([4, 6]);
          } else {
            ctx.setLineDash([]);
          }

          let first = true;
          for (let i = 0; i < ring.points.length; i++) {
            const p = ring.points[i];
            const scaledP = {
              x: p.x * ring.radius,
              y: p.y * ring.radius,
              z: p.z * ring.radius,
            };
            const proj = rotateAndProject(scaledP, ringRotX, ringRotY, centerX, centerY, radius);
            if (first) {
              ctx.moveTo(proj.screenX, proj.screenY);
              first = false;
            } else {
              ctx.lineTo(proj.screenX, proj.screenY);
            }
          }
          ctx.closePath();
          ctx.strokeStyle = `${primaryColor}35`;
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);
        });

        // 2. Project Shield Nodes & Sort by Depth for Accurate Occlusion
        const projectedNodes = shieldNodes.map((node) => {
          const pulse = 1 + Math.sin(timeSec * 2 + node.phase) * 0.08;
          const pos = {
            x: node.baseX * pulse,
            y: node.baseY * pulse,
            z: node.baseZ * pulse,
          };
          const proj = rotateAndProject(pos, rot.x, rot.y, centerX, centerY, radius);
          return {
            node,
            proj,
          };
        });

        // 3. Draw Inter-Node Structural Struts (Lattice Wireframe)
        ctx.strokeStyle = `${primaryColor}22`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        projectedNodes.forEach(({ node, proj }) => {
          node.connections.forEach((targetId) => {
            const target = projectedNodes[targetId];
            if (target && target.proj.depth > -0.6) {
              ctx.moveTo(proj.screenX, proj.screenY);
              ctx.lineTo(target.proj.screenX, target.proj.screenY);
            }
          });
        });
        ctx.stroke();

        // 4. Draw Central Quantum Core
        const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 18);
        coreGradient.addColorStop(0, '#FFFFFF');
        coreGradient.addColorStop(0.35, primaryColor);
        coreGradient.addColorStop(0.85, `${primaryColor}40`);
        coreGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 18, 0, Math.PI * 2);
        ctx.fill();

        // 5. Draw Individual Shield Nodes (Z-Sorted)
        projectedNodes.sort((a, b) => a.proj.depth - b.proj.depth);
        projectedNodes.forEach(({ node, proj }) => {
          const isFront = proj.depth > 0;
          const nodeColor =
            node.layer === 'core'
              ? '#FFFFFF'
              : node.layer === 'shield'
              ? primaryColor
              : '#A855F7';

          if (isFront) {
            ctx.beginPath();
            ctx.arc(proj.screenX, proj.screenY, node.size * 2.2, 0, Math.PI * 2);
            ctx.fillStyle = `${nodeColor}${Math.floor(proj.alpha * 60)
              .toString(16)
              .padStart(2, '0')}`;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(
            proj.screenX,
            proj.screenY,
            Math.max(1, node.size * proj.scale * 0.9),
            0,
            Math.PI * 2
          );
          ctx.fillStyle = isFront ? nodeColor : `${nodeColor}66`;
          ctx.fill();
        });
      }

      // ==========================================
      // MODE 2: NEURAL SYNAPSE LATTICE
      // ==========================================
      else if (activeMode === 'neural') {
        if (!paused) {
          neuralNodes = stepNeuralLattice(
            neuralNodes,
            dt * cadenceMultiplier,
            pointerNormRef.current
          );
        }

        const projectedNeural = neuralNodes.map((n) => {
          const proj = rotateAndProject(
            { x: n.x, y: n.y, z: n.z },
            rot.x,
            rot.y,
            centerX,
            centerY,
            radius
          );
          return { n, proj };
        });

        ctx.lineWidth = 0.75;
        for (let i = 0; i < projectedNeural.length; i++) {
          for (let j = i + 1; j < projectedNeural.length; j++) {
            const p1 = projectedNeural[i].proj;
            const p2 = projectedNeural[j].proj;
            const dx = p1.screenX - p2.screenX;
            const dy = p1.screenY - p2.screenY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 52) {
              const linkAlpha = (1 - dist / 52) * 0.45 * Math.min(p1.alpha, p2.alpha);
              ctx.strokeStyle = `${primaryColor}${Math.floor(linkAlpha * 255)
                .toString(16)
                .padStart(2, '0')}`;
              ctx.beginPath();
              ctx.moveTo(p1.screenX, p1.screenY);
              ctx.lineTo(p2.screenX, p2.screenY);
              ctx.stroke();
            }
          }
        }

        projectedNeural.forEach(({ n, proj }) => {
          const pulse = 1 + Math.sin(n.pulsePhase) * 0.25;
          ctx.beginPath();
          ctx.arc(proj.screenX, proj.screenY, n.size * pulse, 0, Math.PI * 2);
          ctx.fillStyle = primaryColor;
          ctx.globalAlpha = proj.alpha;
          ctx.fill();
          ctx.globalAlpha = 1.0;
        });
      }

      // ==========================================
      // MODE 3: CHRONOS KINETIC FREQUENCY WAVE
      // ==========================================
      else if (activeMode === 'wave') {
        const timeSec = now / 1000;
        const totalBars = 64;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(timeSec * 0.15 * cadenceMultiplier);

        ctx.strokeStyle = `${primaryColor}30`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 8]);
        ctx.beginPath();
        ctx.arc(0, 0, radius * 1.12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        for (let a = 0; a < 4; a++) {
          const tickAngle = (a * Math.PI) / 2;
          const tx1 = Math.cos(tickAngle) * (radius * 1.05);
          const ty1 = Math.sin(tickAngle) * (radius * 1.05);
          const tx2 = Math.cos(tickAngle) * (radius * 1.18);
          const ty2 = Math.sin(tickAngle) * (radius * 1.18);
          ctx.strokeStyle = `${primaryColor}80`;
          ctx.beginPath();
          ctx.moveTo(tx1, ty1);
          ctx.lineTo(tx2, ty2);
          ctx.stroke();
        }
        ctx.restore();

        for (let i = 0; i < totalBars; i++) {
          const wp = calculateWaveformPoint(i, totalBars, timeSec, cadenceMultiplier);
          const cos = Math.cos(wp.angle);
          const sin = Math.sin(wp.angle);

          const innerX = centerX + cos * radius * wp.innerR;
          const innerY = centerY + sin * radius * wp.innerR;
          const outerX = centerX + cos * radius * wp.outerR;
          const outerY = centerY + sin * radius * wp.outerR;

          ctx.strokeStyle = `${primaryColor}${Math.floor(wp.alpha * 255)
            .toString(16)
            .padStart(2, '0')}`;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(innerX, innerY);
          ctx.lineTo(outerX, outerY);
          ctx.stroke();
        }

        const discGrad = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          radius * 0.55
        );
        discGrad.addColorStop(0, '#FFFFFF');
        discGrad.addColorStop(0.3, primaryColor);
        discGrad.addColorStop(0.7, `${primaryColor}20`);
        discGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = discGrad;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
      if (
        !isEcoIdleRef.current &&
        shouldRunCanvasAnimation({
          isIntersecting: isIntersectingRef.current,
          isDocumentVisible: isDocumentVisibleRef.current,
          isPaused: isPausedRef.current,
        })
      ) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        animationFrameId = 0;
      }
    };

    const scheduleRenderIfActive = () => {
      if (
        animationFrameId === 0 &&
        !isEcoIdleRef.current &&
        shouldRunCanvasAnimation({
          isIntersecting: isIntersectingRef.current,
          isDocumentVisible: isDocumentVisibleRef.current,
          isPaused: isPausedRef.current,
        })
      ) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      } else if (
        animationFrameId !== 0 &&
        (isEcoIdleRef.current ||
          !shouldRunCanvasAnimation({
            isIntersecting: isIntersectingRef.current,
            isDocumentVisible: isDocumentVisibleRef.current,
            isPaused: isPausedRef.current,
          }))
      ) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
    };

    wakeCanvasRef.current = () => {
      lastInteractionMsRef.current = performance.now();
      if (isEcoIdleRef.current) {
        isEcoIdleRef.current = false;
        setIsEcoIdle(false);
      }
      scheduleRenderIfActive();
    };

    // Draw one initial frame so canvas is never blank even if paused
    render(performance.now(), true);

    // Pause requestAnimationFrame when scrolled off-screen
    const intersectionObserver =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              if (entry) {
                isIntersectingRef.current = entry.isIntersecting;
                scheduleRenderIfActive();
              }
            },
            { threshold: 0.01 }
          )
        : null;

    if (intersectionObserver) {
      intersectionObserver.observe(container);
    }

    // Pause requestAnimationFrame when browser tab is backgrounded / minimized
    const handleVisibilityChange = () => {
      isDocumentVisibleRef.current =
        typeof document === 'undefined' ? true : document.visibilityState !== 'hidden';
      scheduleRenderIfActive();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (animationFrameId !== 0) {
        cancelAnimationFrame(animationFrameId);
      }
      if (resizeObserver) resizeObserver.disconnect();
      if (intersectionObserver) intersectionObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [density, isExpanded, isPaused]);

  // Pointer event handlers for interactive plasma attraction & 3D dragging
  const updatePointerCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    wakeCanvasRef.current?.();
    const rect = canvas.getBoundingClientRect();
    const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const normY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    pointerNormRef.current = { x: normX, y: normY, active: true };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rot = rotationRef.current;
    rot.isDragging = true;
    rot.lastMouseX = e.clientX;
    rot.lastMouseY = e.clientY;
    rot.vx = 0;
    rot.vy = 0;
    updatePointerCoords(e);
    if (modeRef.current === 'bottle') {
      surgeRef.current = Math.max(surgeRef.current, 0.85);
    }
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ignore capture errors in headless environments
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rot = rotationRef.current;
    updatePointerCoords(e);

    if (!rot.isDragging) return;

    const dx = e.clientX - rot.lastMouseX;
    const dy = e.clientY - rot.lastMouseY;
    rot.lastMouseX = e.clientX;
    rot.lastMouseY = e.clientY;

    rot.y += dx * 0.009;
    rot.x -= dy * 0.009;

    rot.vy = dx * 0.005;
    rot.vx = -dy * 0.005;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rot = rotationRef.current;
    rot.isDragging = false;
    pointerNormRef.current.active = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors
    }
  };

  const handlePointerLeave = () => {
    if (!rotationRef.current.isDragging) {
      pointerNormRef.current.active = false;
    }
  };

  return (
    <div
      data-testid="aegis-visualizer-card"
      data-viz-mode={mode}
      className={`px-5 py-6 sm:px-6 sm:py-7 min-h-[380px] sm:min-h-[400px] rounded-[12px] bg-[#000000] border border-[#1E222B] shadow-[0_14px_38px_-6px_rgba(0,0,0,0.92)] ring-1 ring-inset ring-white/[0.03] flex flex-col justify-between h-full transition-colors select-none overflow-hidden ${
        isExpanded ? 'fixed inset-4 z-50 max-w-4xl mx-auto my-auto h-[82vh]' : ''
      }`}
    >
      <div className="flex-1 flex flex-col">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between mb-3.5 pb-3 border-b border-[#20242E] gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Zap className="w-3.5 h-3.5 shrink-0" style={{ color: accent.hex }} />
            <h2
              contentEditable={isColumnEditMode}
              suppressContentEditableWarning
              onBlur={(e) => onTitleChange?.(e.currentTarget.textContent || title)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).blur();
                }
              }}
              data-testid="editable-title-aegis_visualizer"
              title={isColumnEditMode ? 'Click to edit panel title inline' : title}
              className={`text-[13px] sm:text-sm font-bold text-white tracking-tight truncate ${
                isColumnEditMode
                  ? 'px-2 py-0.5 rounded bg-purple-950/70 border border-dashed border-purple-400 text-purple-100 cursor-text'
                  : ''
              }`}
            >
              {title}
            </h2>
          </div>

          {/* Quick Controls: Capacitor Surge Strike, Reset, Pause/Play, Expand */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleTriggerLightningSurge}
              data-testid="aegis-viz-surge-btn"
              title="Discharge High-Voltage Lightning Surge"
              className="px-1.5 py-1 rounded-lg bg-[#181B24] hover:bg-[#222734] text-[11px] font-mono font-semibold text-white border border-[#232732] flex items-center gap-1 transition-colors cursor-pointer"
              style={{ color: accent.hex }}
            >
              <Flame className="w-3 h-3 shrink-0" />
              <span>Strike</span>
            </button>
            <button
              type="button"
              onClick={handleResetOrientation}
              data-testid="aegis-viz-reset-btn"
              title="Reset View & Pulse Core"
              className="p-1 rounded-lg bg-[#181B24] hover:bg-[#1F232E] text-zinc-400 hover:text-white border border-[#232732] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (isEcoIdle && !isPaused) {
                  wakeCanvasRef.current?.();
                } else {
                  setIsPaused((prev) => {
                    const next = !prev;
                    if (!next) {
                      setTimeout(() => wakeCanvasRef.current?.(), 0);
                    }
                    return next;
                  });
                }
              }}
              data-testid="aegis-viz-pause-btn"
              title={isPaused || isEcoIdle ? 'Resume Animation' : 'Pause Animation'}
              className="p-1 rounded-lg bg-[#181B24] hover:bg-[#1F232E] text-zinc-400 hover:text-white border border-[#232732] transition-colors cursor-pointer"
            >
              {isPaused || isEcoIdle ? (
                <Play className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Pause className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              data-testid="aegis-viz-expand-btn"
              title={isExpanded ? 'Exit Expanded View' : 'Expand Lightning Chamber'}
              className="p-1 rounded-lg bg-[#181B24] hover:bg-[#1F232E] text-zinc-400 hover:text-white border border-[#232732] transition-colors cursor-pointer"
            >
              {isExpanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Visualizer Mode Segmented Tabs (Bottle Default + Shield, Neural, Wave) */}
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#0E1015] border border-[#1E222B] mb-2.5">
          <button
            type="button"
            data-testid="viz-mode-bottle"
            onClick={() => {
              setMode('bottle');
              wakeCanvasRef.current?.();
            }}
            className={`py-1 px-1 rounded-lg text-[11px] font-mono transition-all flex items-center justify-center gap-1 ${
              mode === 'bottle'
                ? 'bg-[#181B24] text-white border border-[#232732] shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={mode === 'bottle' ? { color: accent.hex } : undefined}
          >
            <Zap className="w-3 h-3 shrink-0" />
            <span>Bottle</span>
          </button>
          <button
            type="button"
            data-testid="viz-mode-shield"
            onClick={() => {
              setMode('shield');
              wakeCanvasRef.current?.();
            }}
            className={`py-1 px-1 rounded-lg text-[11px] font-mono transition-all flex items-center justify-center gap-1 ${
              mode === 'shield'
                ? 'bg-[#181B24] text-white border border-[#232732] shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={mode === 'shield' ? { color: accent.hex } : undefined}
          >
            <Shield className="w-3 h-3 shrink-0" />
            <span>Shield</span>
          </button>
          <button
            type="button"
            data-testid="viz-mode-neural"
            onClick={() => {
              setMode('neural');
              wakeCanvasRef.current?.();
            }}
            className={`py-1 px-1 rounded-lg text-[11px] font-mono transition-all flex items-center justify-center gap-1 ${
              mode === 'neural'
                ? 'bg-[#181B24] text-white border border-[#232732] shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={mode === 'neural' ? { color: accent.hex } : undefined}
          >
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>Neural</span>
          </button>
          <button
            type="button"
            data-testid="viz-mode-wave"
            onClick={() => {
              setMode('wave');
              wakeCanvasRef.current?.();
            }}
            className={`py-1 px-1 rounded-lg text-[11px] font-mono transition-all flex items-center justify-center gap-1 ${
              mode === 'wave'
                ? 'bg-[#181B24] text-white border border-[#232732] shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
            style={mode === 'wave' ? { color: accent.hex } : undefined}
          >
            <Radio className="w-3.5 h-3.5 shrink-0" />
            <span>Wave</span>
          </button>
        </div>

        {/* Interactive Canvas Viewport */}
        <div
          ref={containerRef}
          className={`relative w-full ${
            isExpanded ? 'h-[62vh]' : 'h-64 sm:h-72 flex-1 min-h-[250px]'
          } rounded-xl overflow-hidden bg-[#000000] border border-[#1E222B] group cursor-crosshair active:cursor-grabbing`}
          title={
            mode === 'bottle'
              ? 'Touch or drag on the glass bottle to attract high-voltage plasma arcs'
              : 'Click and drag to rotate in 3D'
          }
        >
          <canvas
            ref={canvasRef}
            data-testid="aegis-viz-canvas"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            className="w-full h-full block touch-none"
          />

          {/* Clean Unboxed Telemetry Overlay */}
          <div className="absolute top-2.5 left-3 flex items-center gap-1.5 text-[11px] font-mono text-zinc-300 pointer-events-none">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: isPaused ? '#10b981' : accent.hex }}
            />
            <span className="font-semibold text-white tabular-nums" data-testid="aegis-viz-fps-badge">
              {isPaused ? 'PAUSED (0% CPU)' : `${fps} FPS`}
            </span>
            <span className="text-zinc-600">·</span>
            <span className="tabular-nums" style={{ color: accent.hex }}>
              {voltageKv.toFixed(1)} kV
            </span>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-400 tabular-nums">{arcCount} Arcs</span>
          </div>

          <div className="absolute bottom-2 right-3 text-[10px] font-mono text-zinc-400 pointer-events-none">
            {mode === 'bottle' ? 'Touch glass to draw arc' : 'Drag to orbit'}
          </div>
        </div>
      </div>

      {/* Footer Controls: Cadence Selector & Status */}
      <div className="pt-2.5 mt-2 border-t border-[#20242E] flex flex-wrap items-center justify-between gap-y-2 gap-x-2 text-xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1 shrink-0">
            <Zap className="w-3 h-3" style={{ color: accent.hex }} />
            <span>Voltage:</span>
          </span>
          <div className="flex items-center gap-0.5 bg-[#0E1015] p-0.5 rounded-lg border border-[#1E222B]">
            {(
              [
                { id: 'nominal', label: '1.0x' },
                { id: 'harmonic', label: '1.4x' },
                { id: 'overdrive', label: '2.2x' },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                type="button"
                data-testid={`cadence-${c.id}`}
                onClick={() => setCadence(c.id)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  cadence === c.id
                    ? 'bg-[#181B24] text-white border border-[#232732] font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
                style={cadence === c.id ? { color: accent.hex } : undefined}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-300 shrink-0">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: accent.hex }}
          />
          <span style={{ color: accent.hex }}>
            {mode === 'bottle' ? 'PLASMA CONTAINED' : 'AEGIS ONLINE'}
          </span>
        </div>
      </div>
    </div>
  );
});
