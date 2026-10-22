import { useEffect, useRef } from 'react';

/**
 * Keeps a ref holding the latest value/callback, updated in an effect
 * (never during render). Used by imperative subscribers (clock listeners,
 * canvas/3D scenes) that must read fresh props without re-subscribing.
 */
export function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
