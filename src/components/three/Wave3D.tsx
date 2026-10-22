import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Html, OrbitControls } from '@react-three/drei';
import type { SimClock } from '../../simulation/SimClock';
import { useClockEffect } from '../../simulation/useSimClock';
import { useSettings } from '../../state/settings';
import { useLatest } from '../../hooks/useLatest';

const VIEW_W = 6.4; // scene units spanned by [xMin, xMax]
const STRING_Y = 0.15;
const LINE_POINTS = 220;

export interface Wave3DProps {
  clock: SimClock;
  /** The model: transverse displacement y(x, t) [m]. Provided by the lab —
   * the scene contains no duplicated physics. */
  yAt: (x: number, t: number) => number;
  xMin: number;
  xMax: number;
  /** Amplitude [m] used only for the vertical display scale. */
  amplitude: number;
  color?: string;
  /** x positions of medium-particle markers (they move transversally only). */
  particleXs?: number[];
  controlsRef?: React.RefObject<{ reset: () => void } | null>;
  label?: string;
}

function buildSceneObjects(color: string, particleXs: number[] | undefined): SceneObjects {
  const positions = new Float32Array(LINE_POINTS * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({ color: new THREE.Color(color) });
  const line = new THREE.Line(geometry, material);
  line.frustumCulled = false;

  let particles: THREE.InstancedMesh | null = null;
  if (particleXs && particleXs.length > 0) {
    const g = new THREE.SphereGeometry(0.045, 12, 12);
    const m = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.4 });
    particles = new THREE.InstancedMesh(g, m, particleXs.length);
    particles.frustumCulled = false;
  }
  return { line, geometry, particles };
}

function disposeSceneObjects(o: SceneObjects): void {
  o.geometry.dispose();
  (o.line.material as THREE.Material).dispose();
  o.particles?.geometry.dispose();
  (o.particles?.material as THREE.Material | undefined)?.dispose();
  o.particles?.dispose();
}

interface SceneObjects {
  line: THREE.Line;
  geometry: THREE.BufferGeometry;
  particles: THREE.InstancedMesh | null;
}

/**
 * 3D vibrating string. The polyline is sampled directly from yAt(x, t) at
 * the current clock time, so the rendered profile always equals the
 * mathematical model (up to a uniform, declared display scale).
 * Particle markers illustrate that medium points move transversally while
 * the profile travels.
 *
 * All mutable three.js objects are created/disposed inside an effect and
 * reached through refs, per React lifecycle rules.
 */
export function Wave3D({
  clock,
  yAt,
  xMin,
  xMax,
  amplitude,
  color = '#22d3ee',
  particleXs,
  controlsRef,
  label,
}: Wave3DProps) {
  const { settings } = useSettings();
  void settings;

  const yAtRef = useLatest(yAt);
  const ampRef = useLatest(amplitude);
  const rangeRef = useLatest({ xMin, xMax });
  const particlesXsRef = useLatest(particleXs);

  // Stable identity for the particle-position array used by the builder.
  const particleKey = particleXs ? particleXs.join(',') : '';
  const particleXsMemo = useMemo(
    () => (particleKey ? particleKey.split(',').map(Number) : undefined),
    [particleKey],
  );

  // Objects are created during render (render-adjustment pattern) and
  // disposed by an effect cleanup whenever they are replaced or on unmount.
  const [objs, setObjs] = useState<SceneObjects>(() => buildSceneObjects(color, particleXsMemo));
  const [built, setBuilt] = useState({ color, particleXsMemo });
  if (built.color !== color || built.particleXsMemo !== particleXsMemo) {
    setBuilt({ color, particleXsMemo });
    setObjs(buildSceneObjects(color, particleXsMemo));
  }
  useEffect(() => {
    return () => disposeSceneObjects(objs);
  }, [objs]);
  const objsRef = useLatest(objs);
  const dummyRef = useRef(new THREE.Object3D());

  useClockEffect(clock, (t) => {
    const o = objsRef.current;
    const { xMin: a, xMax: b } = rangeRef.current;
    const span = Math.max(1e-9, b - a);
    const sx = VIEW_W / span;
    const A = ampRef.current;
    const sy = A > 1e-9 ? Math.min(1.4 / A, 4000) : 1;
    const pos = o.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < LINE_POINTS; i++) {
      const x = a + (span * i) / (LINE_POINTS - 1);
      const y = yAtRef.current(x, t);
      pos.setXYZ(i, (x - (a + b) / 2) * sx, STRING_Y + (Number.isFinite(y) ? y * sy : 0), 0);
    }
    pos.needsUpdate = true;
    o.geometry.computeBoundingSphere();

    const xs = particlesXsRef.current;
    if (o.particles && xs) {
      const dummy = dummyRef.current;
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i];
        const y = yAtRef.current(x, t);
        dummy.position.set(
          (x - (a + b) / 2) * sx,
          STRING_Y + (Number.isFinite(y) ? y * sy : 0),
          0,
        );
        dummy.updateMatrix();
        o.particles.setMatrixAt(i, dummy.matrix);
      }
      o.particles.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[2, 5, 4]} intensity={1.05} />
      <pointLight position={[-4, 1, 3]} intensity={0.3} color="#5b8cff" />

      <primitive object={objs.line} />
      {objs.particles && <primitive object={objs.particles} />}

      {/* rest axis of the string */}
      <mesh position={[0, STRING_Y, 0]}>
        <boxGeometry args={[VIEW_W + 0.4, 0.008, 0.008]} />
        <meshBasicMaterial color="#3b4a6b" />
      </mesh>
      <Html position={[-VIEW_W / 2 - 0.35, STRING_Y, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#93a0b8', fontSize: 10.5, fontFamily: 'Consolas, monospace' }}>
          x = {xMin} m
        </div>
      </Html>
      <Html position={[VIEW_W / 2 + 0.1, STRING_Y, 0]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#93a0b8', fontSize: 10.5, fontFamily: 'Consolas, monospace' }}>
          x = {xMax} m
        </div>
      </Html>
      {label && (
        <Html position={[0, STRING_Y + 1.7, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{ color: '#93a0b8', fontSize: 11, fontFamily: 'Consolas, monospace' }}>{label}</div>
        </Html>
      )}

      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={2.5}
        maxDistance={14}
        target={[0, STRING_Y, 0]}
      />
    </>
  );
}
