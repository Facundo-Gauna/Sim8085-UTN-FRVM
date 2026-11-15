/**
 * "Ejecutar": corre el programa en tandas para que la interfaz nunca se congele
 * (Review Focus 2). Cada tanda es una llamada a `session.runBatch(n)` y entre una
 * y otra el hilo vuelve al navegador (temporizador o cuadro de animación).
 *
 * Velocidades (1–5):
 *   1 lenta       → 1 instrucción cada 600 ms
 *   2 media       → 1 instrucción cada 350 ms
 *   3 rápida      → 1 instrucción cada 180 ms
 *   4 muy rápida  → 1 instrucción cada 80 ms
 *   5 máxima      → tandas de 5 000 instrucciones por cuadro (requestAnimationFrame;
 *                   sin rAF, setTimeout(…, 0))
 *
 * Se detiene en 'halt', 'breakpoint', 'error' o al llegar a PAUSE_EVERY
 * instrucciones seguidas sin detenerse (posible bucle infinito): en ese caso
 * pide `promptPause()` y la UI pregunta "¿Continuar o detener?". También se
 * detiene si el código cambia (stale) o si se ensambla otra máquina.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Machine } from '@sim8085/core';
import { defaultSession, PAUSE_BATCH } from '../state/store';

export type Speed = 1 | 2 | 3 | 4 | 5;

export const SPEEDS: Record<Speed, { delayMs: number; batch: number }> = {
  1: { delayMs: 600, batch: 1 },
  2: { delayMs: 350, batch: 1 },
  3: { delayMs: 180, batch: 1 },
  4: { delayMs: 80, batch: 1 },
  5: { delayMs: 0, batch: 5000 },
};

export const SPEED_TEXT: Record<Speed, string> = {
  1: 'lenta',
  2: 'media',
  3: 'rápida',
  4: 'muy rápida',
  5: 'máxima',
};

/** Instrucciones seguidas antes de preguntar si seguir (igual que el núcleo). */
export const PAUSE_EVERY = PAUSE_BATCH;

type Cancel = () => void;

function schedule(fn: () => void, speed: Speed): Cancel {
  if (speed === 5 && typeof requestAnimationFrame === 'function') {
    const id = requestAnimationFrame(fn);
    return () => cancelAnimationFrame(id);
  }
  const id = setTimeout(fn, SPEEDS[speed].delayMs);
  return () => clearTimeout(id);
}

export function useRunner(speed: Speed = 3): { running: boolean; start(): void; stop(): void } {
  const [running, setRunning] = useState(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const cancelRef = useRef<Cancel | null>(null);
  const runningRef = useRef(false);
  const machineRef = useRef<Machine | null>(null);
  const executedRef = useRef(0);
  const mountedRef = useRef(true);

  const finish = useCallback(() => {
    cancelRef.current?.();
    cancelRef.current = null;
    runningRef.current = false;
    machineRef.current = null;
    if (mountedRef.current) setRunning(false);
  }, []);

  const tick = useCallback(() => {
    cancelRef.current = null;
    if (!runningRef.current) return;
    const s = defaultSession.getState();
    if (!s.machine || s.stale || s.machine !== machineRef.current) {
      finish();
      return;
    }
    const { batch } = SPEEDS[speedRef.current];
    const reason = s.runBatch(batch);
    if (reason !== null) {
      finish();
      return;
    }
    // null: la tanda agotó su cuota y el programa sigue corriendo.
    executedRef.current += batch;
    if (executedRef.current >= PAUSE_EVERY) {
      defaultSession.getState().promptPause();
      finish();
      return;
    }
    cancelRef.current = schedule(tick, speedRef.current);
  }, [finish]);

  const start = useCallback(() => {
    if (runningRef.current) return;
    const s = defaultSession.getState();
    if (!s.machine || s.stale) {
      s.runBatch(1); // no ejecuta nada: deja el aviso "Ensamblá primero (F5)"
      return;
    }
    runningRef.current = true;
    machineRef.current = s.machine;
    executedRef.current = 0;
    setRunning(true);
    tick(); // la primera instrucción sale enseguida
  }, [tick]);

  const stop = useCallback(() => {
    if (!runningRef.current) return;
    finish();
    defaultSession.getState().stop();
  }, [finish]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      runningRef.current = false;
      cancelRef.current?.();
      cancelRef.current = null;
    };
  }, []);

  return { running, start, stop };
}
