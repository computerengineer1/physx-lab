import { Component, useMemo } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { useSettings } from '../../state/settings';

let webglSupport: boolean | null = null;

export function detectWebGL(): boolean {
  if (webglSupport !== null) return webglSupport;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    webglSupport = gl !== null && gl !== undefined;
  } catch {
    webglSupport = false;
  }
  return webglSupport;
}

interface BoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}
interface BoundaryState {
  failed: boolean;
  message: string;
}

/** Catches renderer crashes (context loss, driver issues) → honest fallback. */
class SceneErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false, message: '' };

  static getDerivedStateFromError(err: unknown): BoundaryState {
    return { failed: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[physx] 3D scene error:', error, info.componentStack);
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="scene-fallback" role="alert">
          <b>The 3D renderer stopped unexpectedly.</b>
          <span>{this.state.message}</span>
          <button
            type="button"
            className="btn sm"
            onClick={() => this.setState({ failed: false, message: '' })}
          >
            Try again
          </button>
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}

export interface Scene3DProps {
  children: ReactNode;
  /** Rendered when WebGL is unavailable or the renderer crashes. Should
   * convey the same scientific content in 2D/numeric form (accessibility). */
  fallback: ReactNode;
  camera?: { position: [number, number, number]; fov?: number; near?: number; far?: number };
  className?: string;
  ariaLabel?: string;
}

/**
 * WebGL canvas wrapper with capability detection, DPR cap, theme-aware
 * transparency and an error boundary. Scenes are transparent so the CSS
 * laboratory-grid background shows through.
 */
export function Scene3D({
  children,
  fallback,
  camera = { position: [0, 0, 6], fov: 45 },
  className = '',
  ariaLabel = 'Interactive 3D physics scene',
}: Scene3DProps) {
  const { settings } = useSettings();
  const supported = useMemo(() => detectWebGL(), []);

  if (!supported) {
    return (
      <div className={`scene-wrap ${className}`}>
        <div className="scene-fallback">
          <b>3D graphics are not available in this browser.</b>
          <span>The equivalent 2D view is shown below — it uses the same physics model.</span>
          {fallback}
        </div>
      </div>
    );
  }

  return (
    <SceneErrorBoundary fallback={fallback}>
      <div className={`scene-wrap scene-3d ${className}`}>
        <Canvas
          dpr={settings.lowEffects ? 1 : [1, 2]}
          gl={{
            antialias: !settings.lowEffects,
            alpha: true,
            powerPreference: settings.lowEffects ? 'low-power' : 'high-performance',
          }}
          shadows={!settings.lowEffects}
          camera={{
            position: camera.position,
            fov: camera.fov ?? 45,
            near: camera.near ?? 0.1,
            far: camera.far ?? 100,
          }}
          role="img"
          aria-label={ariaLabel}
        >
          {children}
        </Canvas>
      </div>
    </SceneErrorBoundary>
  );
}
