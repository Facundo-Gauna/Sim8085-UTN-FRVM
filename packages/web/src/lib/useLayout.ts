import { useCallback, useState } from 'react';

/**
 * Cuánto lugar ocupa el editor en el Simulador, guardado en localStorage:
 *   'normal' → editor ~60 % y estado de la máquina a la derecha;
 *   'amplio' → editor ~75 %, la columna derecha se angosta;
 *   'foco'   → solo el editor (y "Ahora"); registros, banderas y memoria se ocultan.
 */
export type Layout = 'normal' | 'amplio' | 'foco';
export const LAYOUTS: readonly Layout[] = ['normal', 'amplio', 'foco'];
const KEY = 'sim8085.layout';

function readStored(): Layout {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'normal' || v === 'amplio' || v === 'foco') return v;
  } catch {
    /* almacenamiento no disponible */
  }
  return 'normal';
}

export function useLayout(): [Layout, (l: Layout) => void] {
  const [layout, setState] = useState(readStored);
  const set = useCallback((l: Layout) => {
    setState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* sin persistencia */
    }
  }, []);
  return [layout, set];
}
