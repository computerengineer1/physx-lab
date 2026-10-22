import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html, Line, OrbitControls } from '@react-three/drei';
import type { SimClock } from '../../../simulation/SimClock';
import { useClockEffect } from '../../../simulation/useSimClock';
import { useSettings } from '../../../state/settings';

export interface SpringMassState {
  /** Displacement from equilibrium [m]; positive = downward. */
  x: number;
  /** Velocity [m/s]. */
  v: number;
  /** Acceleration [m/s²]. */
  a: number;
  /** Spring force [N]. */
  F: number;
}

interface SpringMassSceneProps {
  clock: SimClock;
  /** Reads the current model state at time t — provided by the lab so the
   * scene never duplicates physics. */
  getState: (t: number) => SpringMassState;
  showVectors: boolean;
  showForce: boolean;
  showRuler: boolean;
  controlsRef?: React.RefObject<{ reset: () => void } | null>;
}

const SUPPORT_Y = 1.7;
const EQ_Y = -0.25; // equilibrium height of the mass centre (scene units = metres)
const MASS_HALF = 0.24;
const COILS = 11;
const SPRING_RADIUS = 0.2;

function makeHelixGeometry(): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  const segPerCoil = 14;
  for (let i = 0; i <= COILS * segPerCoil; i++) {
    const s = i / (COILS * segPerCoil); // 0..1 downward
    const ang = s * COILS * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(ang) * SPRING_RADIUS, -s, Math.sin(ang) * SPRING_RADIUS));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, COILS * segPerCoil, 0.018, 8, false);
}

/**
 * 3D spring–mass apparatus (§15.1). Geometry follows the model exactly:
 * the mass centre sits at EQ_Y − x(t) and the helix is scaled to the
 * current spring length (coil pitch stretches like a real helical spring).
 */
export function SpringMassScene({
  clock,
  getState,
  showVectors,
  showForce,
  showRuler,
  controlsRef,
}: SpringMassSceneProps) {
  const { settings } = useSettings();
  const helix = useMemo(() => makeHelixGeometry(), []);
  useEffect(() => () => helix.dispose(), [helix]);

  const massRef = useRef<THREE.Group>(null);
  const springRef = useRef<THREE.Mesh>(null);
  const vArrow = useRef<THREE.ArrowHelper>(null);
  const aArrow = useRef<THREE.ArrowHelper>(null);
  const fArrow = useRef<THREE.ArrowHelper>(null);
  const getStateRef = useRef(getState);
  useEffect(() => {
    getStateRef.current = getState;
  });

  const down = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);

  useClockEffect(clock, (t) => {
    const s = getStateRef.current(t);
    const massY = EQ_Y - s.x; // +x (down in the model) is −y in the scene
    if (massRef.current) massRef.current.position.y = massY;
    if (springRef.current) {
      const len = Math.max(0.15, SUPPORT_Y - (massY + MASS_HALF));
      springRef.current.scale.y = len;
    }
    const setArrow = (
      ref: React.RefObject<THREE.ArrowHelper | null>,
      value: number,
      scale: number,
      positiveIsDown: boolean,
    ) => {
      const arrow = ref.current;
      if (!arrow) return;
      const mag = Math.min(1.3, Math.abs(value) * scale);
      arrow.visible = mag > 0.015;
      if (!arrow.visible) return;
      const dirDown = positiveIsDown ? value > 0 : value < 0;
      arrow.setDirection(dirDown ? down : up);
      arrow.setLength(mag, Math.min(0.18, mag * 0.35), 0.09);
      arrow.position.y = massY;
    };
    setArrow(vArrow, s.v, 0.35, true);
    setArrow(aArrow, s.a, 0.09, true);
    setArrow(fArrow, s.F, 0.05, true);
  });

  // Redraw once when display flags flip.
  useEffect(() => {
    clock.bump();
  }, [showVectors, showForce, clock]);

  const rulerTicks = useMemo(() => {
    const ticks: { y: number; label: string }[] = [];
    for (let d = -0.75; d <= 0.751; d += 0.25) {
      ticks.push({ y: EQ_Y - d, label: d === 0 ? 'x = 0' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(2)} m` });
    }
    return ticks;
  }, []);

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[3, 5, 4]}
        intensity={1.15}
        castShadow={!settings.lowEffects}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[-3, 1, 2]} intensity={0.35} color="#5b8cff" />

      {/* fixed support */}
      <mesh position={[0, SUPPORT_Y + 0.09, 0]} castShadow={!settings.lowEffects}>
        <boxGeometry args={[1.5, 0.18, 0.9]} />
        <meshStandardMaterial color="#2a3550" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* hatching marks on the support */}
      {[-0.6, -0.3, 0, 0.3, 0.6].map((xx) => (
        <mesh key={xx} position={[xx, SUPPORT_Y + 0.19, 0]} rotation={[0, 0, Math.PI / 5]}>
          <boxGeometry args={[0.02, 0.22, 0.02]} />
          <meshBasicMaterial color="#64748b" />
        </mesh>
      ))}

      {/* spring: unit helix hanging from the support, scaled to length */}
      <mesh
        ref={springRef}
        geometry={helix}
        position={[0, SUPPORT_Y, 0]}
        castShadow={!settings.lowEffects}
      >
        <meshStandardMaterial color="#7dd3fc" metalness={0.75} roughness={0.3} />
      </mesh>

      {/* the mass */}
      <group ref={massRef} position={[0, EQ_Y, 0]}>
        <mesh castShadow={!settings.lowEffects} receiveShadow={!settings.lowEffects}>
          <boxGeometry args={[MASS_HALF * 2, MASS_HALF * 2, MASS_HALF * 2]} />
          <meshStandardMaterial color="#4f7dff" metalness={0.35} roughness={0.35} />
        </mesh>
        <Html center distanceFactor={7} style={{ pointerEvents: 'none' }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13, textShadow: '0 1px 3px #000' }}>m</div>
        </Html>
      </group>

      {/* equilibrium marker */}
      <Line
        points={[
          [-1.05, EQ_Y, 0],
          [1.05, EQ_Y, 0],
        ]}
        color="#fbbf24"
        lineWidth={1.4}
        dashed
        dashSize={0.09}
        gapSize={0.06}
      />
      <Html position={[1.15, EQ_Y, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#fbbf24', fontSize: 11, fontFamily: 'Consolas, monospace', whiteSpace: 'nowrap' }}>
          equilibrium
        </div>
      </Html>

      {/* displacement indicator: line from equilibrium to mass centre */}
      <DisplacementLine clock={clock} massRef={massRef} />

      {/* vector arrows */}
      {showVectors && (
        <>
          <arrowHelper ref={vArrow} args={[down, new THREE.Vector3(0.42, EQ_Y, 0), 0.5, 0x22d3ee, 0.16, 0.09]} />
          <arrowHelper ref={aArrow} args={[down, new THREE.Vector3(-0.42, EQ_Y, 0), 0.5, 0xfbbf24, 0.16, 0.09]} />
          <Html position={[0.42, EQ_Y + 0.62, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{ color: '#22d3ee', fontSize: 10.5, fontFamily: 'Consolas, monospace' }}>v</div>
          </Html>
          <Html position={[-0.42, EQ_Y + 0.62, 0]} style={{ pointerEvents: 'none' }}>
            <div style={{ color: '#fbbf24', fontSize: 10.5, fontFamily: 'Consolas, monospace' }}>a</div>
          </Html>
        </>
      )}
      {showForce && (
        <>
          <arrowHelper ref={fArrow} args={[down, new THREE.Vector3(0, EQ_Y, 0.42), 0.5, 0xf87171, 0.16, 0.09]} />
          <Html position={[0, EQ_Y + 0.62, 0.42]} style={{ pointerEvents: 'none' }}>
            <div style={{ color: '#f87171', fontSize: 10.5, fontFamily: 'Consolas, monospace' }}>F = −kx</div>
          </Html>
        </>
      )}

      {/* ruler */}
      {showRuler && (
        <group position={[0.85, 0, 0]}>
          <Line
            points={[
              [0, EQ_Y - 0.85, 0],
              [0, EQ_Y + 0.85, 0],
            ]}
            color="#5c6b8a"
            lineWidth={1}
          />
          {rulerTicks.map((tk) => (
            <group key={tk.label}>
              <Line
                points={[
                  [-0.05, tk.y, 0],
                  [0.05, tk.y, 0],
                ]}
                color="#5c6b8a"
                lineWidth={1}
              />
              <Html position={[0.1, tk.y, 0]} style={{ pointerEvents: 'none' }}>
                <div style={{ color: '#93a0b8', fontSize: 9.5, fontFamily: 'Consolas, monospace', whiteSpace: 'nowrap' }}>
                  {tk.label}
                </div>
              </Html>
            </group>
          ))}
        </group>
      )}

      {/* soft floor for shadow */}
      {!settings.lowEffects && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]} receiveShadow>
          <planeGeometry args={[12, 12]} />
          <shadowMaterial transparent opacity={0.28} />
        </mesh>
      )}

      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={1.6}
        maxDistance={9}
        maxPolarAngle={Math.PI * 0.85}
        target={[0, 0.55, 0]}
      />
    </>
  );
}

/** Vertical line from the equilibrium height to the current mass centre,
 * updated from the simulation clock (no independent animation loop). */
function DisplacementLine({
  clock,
  massRef,
}: {
  clock: SimClock;
  massRef: React.RefObject<THREE.Group | null>;
}) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  useClockEffect(clock, () => {
    const g = geomRef.current;
    const mass = massRef.current;
    if (g && mass) {
      const pos = g.attributes.position as THREE.BufferAttribute;
      pos.setY(0, EQ_Y);
      pos.setY(1, mass.position.y);
      pos.needsUpdate = true;
      g.computeBoundingSphere();
    }
  });
  return (
    <line>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array([0.62, EQ_Y, 0, 0.62, EQ_Y, 0]), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#f472b6" />
    </line>
  );
}
