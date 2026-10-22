import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html, Line, OrbitControls } from '@react-three/drei';
import type { SimClock } from '../../../simulation/SimClock';
import { useClockEffect } from '../../../simulation/useSimClock';
import { useSettings } from '../../../state/settings';

/** Scene scale: metres → scene units (shared by circle and oscillator so the
 * projection correspondence is geometrically exact). */
const S = 2.2;
const CENTER_Y = 0.85;
const OSC_Y = -1.05;

export interface CircularState {
  /** Current phase θ = ωt + φ [rad]. */
  theta: number;
  /** Projection x = A cos θ [m]. */
  x: number;
  /** Reference-circle amplitude A [m]. */
  amplitude: number;
}

interface CircularSceneProps {
  clock: SimClock;
  getState: (t: number) => CircularState;
  controlsRef?: React.RefObject<{ reset: () => void } | null>;
}

function makeHelix(): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  const coils = 8;
  const seg = coils * 12;
  for (let i = 0; i <= seg; i++) {
    const s = i / seg;
    const ang = s * coils * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(ang) * 0.14, -s, Math.sin(ang) * 0.14));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, 0.015, 8, false);
}

/**
 * §15.4 — uniform circular motion and its projection.
 * The particle on the circle, the dashed projection line, and the horizontal
 * spring oscillator all read from the SAME θ(t) = ωt + φ, so the linkage
 * x(t) = A cos θ is geometrically exact (single scale factor S).
 */
export function CircularMotionScene({ clock, getState, controlsRef }: CircularSceneProps) {
  const { settings } = useSettings();
  const helix = useMemo(() => makeHelix(), []);
  useEffect(() => () => helix.dispose(), [helix]);

  const particleRef = useRef<THREE.Mesh>(null);
  const radiusRef = useRef<THREE.Group>(null);
  const dropRef = useRef<THREE.Group>(null);
  const massRef = useRef<THREE.Mesh>(null);
  const springRef = useRef<THREE.Mesh>(null);
  const circleRef = useRef<THREE.Group>(null);
  const getStateRef = useRef(getState);
  useEffect(() => {
    getStateRef.current = getState;
  });

  const circlePoints = useMemo(
    () =>
      Array.from({ length: 97 }, (_, i) => {
        const a = (i / 96) * Math.PI * 2;
        return [Math.cos(a), Math.sin(a), 0] as [number, number, number];
      }),
    [],
  );

  useClockEffect(clock, (t) => {
    const s = getStateRef.current(t);
    const R = Math.max(0.05, s.amplitude * S);
    const px = R * Math.cos(s.theta);
    const py = R * Math.sin(s.theta);
    if (circleRef.current) circleRef.current.scale.setScalar(R);
    if (particleRef.current) particleRef.current.position.set(px, CENTER_Y + py, 0);
    if (radiusRef.current) {
      radiusRef.current.rotation.z = s.theta;
      radiusRef.current.scale.x = R;
    }
    if (dropRef.current) {
      dropRef.current.position.x = px;
      dropRef.current.scale.y = Math.max(1e-4, CENTER_Y + py - OSC_Y);
      dropRef.current.position.y = OSC_Y;
    }
    if (massRef.current) massRef.current.position.x = px;
    if (springRef.current) {
      const wallX = -1.55;
      springRef.current.position.x = wallX;
      springRef.current.scale.y = Math.max(0.1, px - 0.16 - wallX);
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[2, 4, 5]} intensity={1.1} castShadow={!settings.lowEffects} />
      <pointLight position={[-3, 2, 2]} intensity={0.3} color="#a78bfa" />

      {/* reference circle (unit circle scaled to R) */}
      <group ref={circleRef} position={[0, CENTER_Y, 0]}>
        <Line points={circlePoints} color="#5b8cff" lineWidth={2} />
      </group>

      {/* horizontal diameter (the projection axis) */}
      <Line
        points={[
          [-1.35, CENTER_Y, 0],
          [1.35, CENTER_Y, 0],
        ]}
        color="#5c6b8a"
        lineWidth={1}
        dashed
        dashSize={0.05}
        gapSize={0.04}
      />
      <Html position={[1.42, CENTER_Y, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#93a0b8', fontSize: 10.5, fontFamily: 'Consolas, monospace' }}>x-axis</div>
      </Html>

      {/* radius line: unit segment along +x, rotated by θ and scaled by R */}
      <group ref={radiusRef} position={[0, CENTER_Y, 0]}>
        <Line points={[[0, 0, 0], [1, 0, 0]]} color="#a78bfa" lineWidth={2} />
      </group>

      {/* rotating particle */}
      <mesh ref={particleRef} position={[1, CENTER_Y, 0]} castShadow={!settings.lowEffects}>
        <sphereGeometry args={[0.07, 24, 24]} />
        <meshStandardMaterial color="#fbbf24" emissive="#b45309" emissiveIntensity={0.4} roughness={0.35} />
      </mesh>

      {/* projection drop line: unit vertical segment scaled to the drop length */}
      <group ref={dropRef} position={[1, OSC_Y, 0]}>
        <Line points={[[0, 0, 0], [0, 1, 0]]} color="#22d3ee" lineWidth={1.4} dashed dashSize={0.06} gapSize={0.05} />
      </group>

      {/* horizontal oscillator */}
      <mesh position={[-1.62, OSC_Y, 0]}>
        <boxGeometry args={[0.14, 0.7, 0.5]} />
        <meshStandardMaterial color="#2a3550" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh ref={springRef} geometry={helix} position={[-1.55, OSC_Y, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <meshStandardMaterial color="#7dd3fc" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh ref={massRef} position={[1, OSC_Y, 0]} castShadow={!settings.lowEffects}>
        <boxGeometry args={[0.32, 0.32, 0.32]} />
        <meshStandardMaterial color="#4f7dff" metalness={0.35} roughness={0.35} />
      </mesh>
      {/* oscillator equilibrium + axis */}
      <Line
        points={[
          [-1.5, OSC_Y - 0.28, 0],
          [1.5, OSC_Y - 0.28, 0],
        ]}
        color="#5c6b8a"
        lineWidth={1}
      />
      <Line
        points={[
          [0, OSC_Y - 0.34, 0],
          [0, OSC_Y - 0.22, 0],
        ]}
        color="#fbbf24"
        lineWidth={1.6}
      />
      <Html position={[0, OSC_Y - 0.52, 0]} center style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#fbbf24', fontSize: 10, fontFamily: 'Consolas, monospace' }}>x = 0</div>
      </Html>
      <Html position={[-1.35, CENTER_Y + 1.25, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#93a0b8', fontSize: 11, fontFamily: 'Consolas, monospace' }}>
          reference circle, radius = A
        </div>
      </Html>
      <Html position={[0.9, OSC_Y + 0.35, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#93a0b8', fontSize: 11, fontFamily: 'Consolas, monospace' }}>
          oscillator: x(t) = A cos θ
        </div>
      </Html>

      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2}
        maxDistance={10}
        target={[0, 0, 0]}
      />
    </>
  );
}
