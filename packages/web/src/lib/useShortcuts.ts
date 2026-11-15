/**
 * Atajos globales (keydown en window):
 *   F5 Ensamblar · F8 Ejecutar/Detener · F10 Paso · Shift+F10 Atrás
 *   Ctrl/Cmd+O Abrir · Ctrl/Cmd+S Descargar
 * F9 (punto de corte) lo maneja el editor: acá no se toca.
 * Las teclas F funcionan en cualquier lugar (también dentro del editor y de los
 * campos). Ctrl+O/S no se disparan dentro de campos de texto (<input>, <textarea>,
 * <select>); sí dentro del editor de código, donde "guardar la página" no sirve.
 */
import { useEffect, useRef } from 'react';

export interface ShortcutHandlers {
  assemble(): void;
  toggleRun(): void;
  step(): void;
  back(): void;
  open(): void;
  save(): void;
}

function inTextField(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
}

export function useShortcuts(handlers: ShortcutHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented && e.key !== 'F5' && e.key !== 'F8' && e.key !== 'F10') return;
      const h = ref.current;
      const mod = e.ctrlKey || e.metaKey;
      let run: (() => void) | null = null;
      if (e.key === 'F5' && !mod && !e.altKey) run = h.assemble;
      else if (e.key === 'F8' && !mod && !e.altKey) run = h.toggleRun;
      else if (e.key === 'F10' && !mod && !e.altKey) run = e.shiftKey ? h.back : h.step;
      else if (mod && !e.altKey && !e.shiftKey && !inTextField(e.target)) {
        const k = e.key.toLowerCase();
        if (k === 'o') run = h.open;
        else if (k === 's') run = h.save;
      }
      if (!run) return;
      e.preventDefault();
      if (e.repeat && (e.key === 'F5' || e.key === 'F8')) return;
      run();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
