import { useCallback, useState } from 'react';

/** Tamaño de letra del editor (14–20 px, por defecto 16), guardado en localStorage. */
export const FONT_MIN = 14;
export const FONT_MAX = 20;
export const FONT_DEFAULT = 16;
const KEY = 'sim8085.fontSize';

const clamp = (n: number) => Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(n)));

function readStored(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    if (Number.isFinite(v) && v >= FONT_MIN && v <= FONT_MAX) return clamp(v);
  } catch {
    /* almacenamiento no disponible */
  }
  return FONT_DEFAULT;
}

export function useFontSize(): [number, (n: number) => void] {
  const [size, setSizeState] = useState(readStored);
  const setSize = useCallback((n: number) => {
    const v = clamp(n);
    setSizeState(v);
    try {
      localStorage.setItem(KEY, String(v));
    } catch {
      /* sin persistencia: queda en memoria */
    }
  }, []);
  return [size, setSize];
}
