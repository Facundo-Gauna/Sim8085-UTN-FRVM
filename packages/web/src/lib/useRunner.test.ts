import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSession, type Session } from '../state/store';
import { PAUSE_EVERY, SPEEDS, useRunner } from './useRunner';

const INITIAL = defaultSession.getState();
const s = () => defaultSession.getState();
const load = (text: string) => {
  act(() => s().setText(s().activeId, text));
  act(() => s().assembleActive());
};

beforeEach(() => {
  defaultSession.setState(INITIAL, true);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useRunner', () => {
  it('mapa de velocidades documentado', () => {
    expect(SPEEDS[1]).toEqual({ delayMs: 600, batch: 1 });
    expect(SPEEDS[4]).toEqual({ delayMs: 80, batch: 1 });
    expect(SPEEDS[5].batch).toBe(5000);
    expect(PAUSE_EVERY).toBe(100_000);
  });

  it('el ejemplo corre hasta HLT a velocidad 1 (una instrucción cada 600 ms)', () => {
    act(() => s().assembleActive());
    const { result } = renderHook(() => useRunner(1));
    act(() => result.current.start());
    expect(result.current.running).toBe(true);
    expect(s().machine!.stepCount).toBe(1);
    act(() => void vi.advanceTimersByTime(599));
    expect(s().machine!.stepCount).toBe(1);
    act(() => void vi.advanceTimersByTime(1));
    expect(s().machine!.stepCount).toBe(2);
    act(() => void vi.advanceTimersByTime(600 * 5));
    expect(s().machine!.cpu.halted).toBe(true);
    expect(result.current.running).toBe(false);
    expect(s().status?.text).toBe('Detenido (HLT)');
  });

  it('se detiene en un punto de corte', () => {
    act(() => s().assembleActive());
    act(() => s().toggleBreakpoint(4)); // STA 0041H
    const { result } = renderHook(() => useRunner(4));
    act(() => result.current.start());
    act(() => void vi.advanceTimersByTime(80 * 10));
    expect(result.current.running).toBe(false);
    expect(s().machine!.cpu.halted).toBe(false);
    expect(s().status?.text).toBe('Punto de corte en la línea 4');
  });

  it('bucle infinito a velocidad máxima: tandas por cuadro hasta pause-limit y pausePrompt', () => {
    load('LP: JMP LP\n');
    const spy = vi.spyOn(s(), 'runBatch');
    defaultSession.setState({ runBatch: spy as unknown as Session['runBatch'] });
    const { result } = renderHook(() => useRunner(5));
    act(() => result.current.start());
    // Cada llamada ejecuta a lo sumo una tanda: nunca más de 5000 instrucciones por vez.
    for (let i = 0; i < 40 && result.current.running; i++) act(() => void vi.advanceTimersByTime(16));
    expect(result.current.running).toBe(false);
    expect(s().pausePrompt).toBe(true);
    expect(spy.mock.calls.every(([n]) => n === 5000)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(PAUSE_EVERY / 5000);
    expect(s().machine!.stepCount).toBe(PAUSE_EVERY);
  });

  it('stop() lo detiene entre tandas', () => {
    load('LP: JMP LP\n');
    const { result } = renderHook(() => useRunner(5));
    act(() => result.current.start());
    act(() => void vi.advanceTimersByTime(16));
    const n = s().machine!.stepCount;
    expect(n).toBeGreaterThan(0);
    act(() => result.current.stop());
    expect(result.current.running).toBe(false);
    act(() => void vi.advanceTimersByTime(1000));
    expect(s().machine!.stepCount).toBe(n);
    expect(s().status?.text).toBe('Ejecución detenida');
    expect(s().pausePrompt).toBe(false);
  });

  it('al editar el código (stale) se detiene', () => {
    load('LP: JMP LP\n');
    const { result } = renderHook(() => useRunner(3));
    act(() => result.current.start());
    act(() => s().setText(s().activeId, 'LP: JMP LP\nNOP\n'));
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.running).toBe(false);
  });

  it('sin ensamblar no arranca y avisa', () => {
    const { result } = renderHook(() => useRunner(3));
    act(() => result.current.start());
    expect(result.current.running).toBe(false);
    expect(s().status?.text).toBe('Ensamblá primero (F5)');
  });

  it('al desmontar se cancelan los temporizadores', () => {
    load('LP: JMP LP\n');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useRunner(2));
    act(() => result.current.start());
    const n = s().machine!.stepCount;
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => void vi.advanceTimersByTime(5000));
    expect(s().machine!.stepCount).toBe(n);
    expect(err).not.toHaveBeenCalled();
  });
});
