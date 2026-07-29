import { useCallback } from 'react';
import type { MouseEvent } from 'react';

/** Tracks pointer position within an element and exposes it as --mx/--my CSS vars for `.cursor-glow`. */
export function useCursorGlow<T extends HTMLElement>() {
  return useCallback((e: MouseEvent<T>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--mx', `${x}%`);
    e.currentTarget.style.setProperty('--my', `${y}%`);
  }, []);
}
