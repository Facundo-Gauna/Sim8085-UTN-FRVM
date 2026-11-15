import { useCallback, useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'sim8085.theme';

function readStored(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    /* almacenamiento no disponible */
  }
  return 'system';
}

function systemPrefersDark(): boolean {
  try {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

export function useTheme(): { choice: ThemeChoice; resolved: 'light' | 'dark'; setChoice(c: ThemeChoice): void } {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStored);
  const [sysDark, setSysDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => apply(choice), [choice]);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const on = (e: MediaQueryListEvent) => setSysDark(e.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  const setChoice = useCallback((c: ThemeChoice) => {
    setChoiceState(c);
    try {
      localStorage.setItem(KEY, c);
    } catch {
      /* se conserva solo en memoria */
    }
  }, []);

  const resolved = choice === 'system' ? (sysDark ? 'dark' : 'light') : choice;
  return { choice, resolved, setChoice };
}
