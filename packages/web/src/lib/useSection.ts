/** Router mínimo por hash: `#/ejercicios`, `#/documentacion/banderas`… Desconocido → Simulador. */
import { useCallback, useEffect, useState } from 'react';

export type Section = 'simulador' | 'ejercicios' | 'documentacion' | 'toolbox';
const SECTIONS: readonly Section[] = ['simulador', 'ejercicios', 'documentacion', 'toolbox'];

export interface Route {
  section: Section;
  rest: string[];
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const first = parts[0] as Section | undefined;
  if (first && SECTIONS.includes(first)) return { section: first, rest: parts.slice(1) };
  return { section: 'simulador', rest: [] };
}

export function useSection(): Route & { go(section: Section, ...rest: string[]): void } {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const go = useCallback((section: Section, ...rest: string[]) => {
    location.hash = `#/${[section, ...rest].join('/')}`;
    setRoute(parseHash(location.hash));
  }, []);
  return { ...route, go };
}
