/**
 * Store de la sesión: archivos abiertos, ensamblado y la Machine del core.
 *
 * La Machine es un objeto mutable: el store guarda su referencia y, cada vez
 * que la muta, sube `version` (helper `touch()`) para que la UI se re-dibuje.
 *
 * `userMemory` e `inputs` son de toda la sesión (no por archivo): se vuelven a
 * aplicar en cada ensamblado, sea cual sea la pestaña activa. `breakpointLines`
 * son líneas del texto activo, así que se vacían al cambiar de pestaña.
 */
import { createStore, useStore, type StoreApi } from 'zustand';
import {
  assemble,
  computeMetrics,
  Machine,
  type AssembleResult,
  type Irq,
  type Metrics,
  type StopReason,
} from '@sim8085/core';
import { fmt16, parseAddress, parseByte, type Base } from '../lib/format';
import { SAMPLE } from './sample';

export { SAMPLE } from './sample';

export interface FileTab {
  id: string;
  name: string;
  text: string;
}

export interface Status {
  kind: 'info' | 'error';
  text: string;
  /** Origen del mensaje: la UI solo reacciona a los errores de 'run' y 'assemble'. */
  source?: 'run' | 'assemble' | 'input';
}

export interface Session {
  files: FileTab[];
  activeId: string;
  /** Dirección de inicio que se pasa a assemble(); la sesión inicial usa 2000h. */
  startAddress: number;
  base: Base;
  /** Sube en cada cambio de la máquina (es mutable: la UI depende de esto). */
  version: number;
  asm: AssembleResult | null;
  machine: Machine | null;
  /** El texto activo cambió después de ensamblar: la UI ignora la vista de la máquina. */
  stale: boolean;
  breakpointLines: Set<number>;
  userMemory: Map<number, number>;
  inputs: Map<number, number>;
  /** Métricas finales del ensamblado anterior (para comparar). */
  prevMetrics: Metrics | null;
  /** Métricas en vivo del ensamblado actual. */
  metrics: Metrics | null;
  status: Status | null;
  /** true si una tanda larga (>= PAUSE_BATCH) llegó al límite sin detenerse. */
  pausePrompt: boolean;

  newFile(): void;
  closeFile(id: string): void;
  openFile(name: string, text: string): void;
  setText(id: string, text: string): void;
  setActive(id: string): void;
  setStartAddress(text: string): void;
  setBase(b: Base): void;
  assembleActive(): void;
  step(): void;
  stepBack(): void;
  reset(): void;
  runBatch(maxInstructions: number): StopReason | null;
  stop(): void;
  continueAfterPause(): void;
  toggleBreakpoint(line: number): void;
  /** Reemplaza las líneas de los puntos de corte (el editor las corre al editar); se validan al ensamblar. */
  setBreakpointLines(lines: Set<number>): void;
  setMemoryByte(addr: number, valueText: string): void;
  clearUserMemory(): void;
  setInput(port: number, valueText: string): void;
  removeInput(port: number): void;
  raise(irq: Irq): void;
}

/** Tandas de este tamaño o más que llegan al límite preguntan si seguir. */
const PAUSE_BATCH = 100_000;
const NOT_READY: Status = { kind: 'error', text: 'Ensamblá primero (F5)' };
const HALTED: Status = { kind: 'info', text: 'Detenido (HLT)' };
const STALE: Status = { kind: 'info', text: 'El código cambió: volvé a ensamblar' };

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export function createSession(): StoreApi<Session> {
  let nextId = 0;
  /**
   * PC donde ya se informó un punto de corte. Machine.run() no evalúa el punto
   * de corte antes de su primer paso, así que runBatch lo revisa al empezar;
   * esto evita detenerse dos veces seguidas en el mismo lugar. Se borra en
   * toda acción que mueve el PC o cambia el estado fuera de run().
   */
  let lastBreakPc: number | null = null;
  const makeFile = (name: string, text: string): FileTab => ({ id: `f${++nextId}`, name, text });
  const first = makeFile(SAMPLE.name, SAMPLE.text);

  return createStore<Session>()((set, get) => {
    /** Parcial que sube `version`: cierra toda mutación de la máquina. */
    const touch = () => ({ version: get().version + 1 });

    /** Máquina utilizable (ensamblada y con el texto al día), o null. */
    const ready = (): { machine: Machine; asm: AssembleResult } | null => {
      const { machine, asm, stale } = get();
      return machine && asm && !stale ? { machine, asm } : null;
    };

    /** Estado sin ensamblado, al cambiar el texto que se muestra. */
    const cleared = () => {
      lastBreakPc = null;
      return {
        asm: null,
        machine: null,
        stale: false,
        metrics: null,
        pausePrompt: false,
        breakpointLines: new Set<number>(),
      };
    };

    /** Un setter válido borra un error anterior (deja los avisos informativos). */
    const clearError = () => (get().status?.kind === 'error' ? { status: null } : {});

    /** Línea del punto de corte que está en el PC actual, si corresponde detenerse ahí. */
    const breakpointAtPc = (machine: Machine, asm: AssembleResult): number | null => {
      if (machine.cpu.halted || lastBreakPc === machine.cpu.PC) return null;
      for (const line of get().breakpointLines) {
        if (asm.lineToAddress.get(line) === machine.cpu.PC) return line;
      }
      return null;
    };

    const nextUntitled = (files: FileTab[]): string => {
      const names = new Set(files.map((f) => f.name));
      let n = 1;
      while (names.has(`sin-titulo-${n}.asm`)) n++;
      return `sin-titulo-${n}.asm`;
    };

    return {
      files: [first],
      activeId: first.id,
      startAddress: 0x2000,
      base: 'hex',
      version: 0,
      asm: null,
      machine: null,
      stale: false,
      breakpointLines: new Set(),
      userMemory: new Map(SAMPLE.memory),
      inputs: new Map(),
      prevMetrics: null,
      metrics: null,
      status: null,
      pausePrompt: false,

      newFile() {
        const file = makeFile(nextUntitled(get().files), '');
        set({ files: [...get().files, file], activeId: file.id, ...cleared(), ...touch() });
      },

      closeFile(id) {
        const { files, activeId } = get();
        const idx = files.findIndex((f) => f.id === id);
        if (idx < 0) return;
        let rest = files.filter((f) => f.id !== id);
        if (rest.length === 0) rest = [makeFile('sin-titulo.asm', '')];
        if (id !== activeId) {
          set({ files: rest });
          return;
        }
        const next = rest[Math.min(idx, rest.length - 1)]!;
        set({ files: rest, activeId: next.id, ...cleared(), ...touch() });
      },

      openFile(name, text) {
        const file = makeFile(name, text);
        set({ files: [...get().files, file], activeId: file.id, ...cleared(), ...touch() });
      },

      setText(id, text) {
        const files = get().files.map((f) => (f.id === id ? { ...f, text } : f));
        // La máquina se conserva, pero con stale = true la UI no la muestra.
        if (id !== get().activeId) {
          set({ files });
          return;
        }
        // Con un ensamblado a la vista, avisa una vez (sin crear un status nuevo en cada tecla).
        const { asm, stale, status } = get();
        // Un error vigente no se pisa con el aviso.
        const canWarn = status === null || status.kind === 'info';
        const warn = canWarn && asm !== null && (!stale || status?.text !== STALE.text);
        set({ files, stale: true, pausePrompt: false, ...(warn ? { status: STALE } : {}) });
      },

      setActive(id) {
        if (id === get().activeId || !get().files.some((f) => f.id === id)) return;
        // Otro programa: no se comparan métricas entre archivos distintos.
        set({ activeId: id, ...cleared(), prevMetrics: null, status: null, ...touch() });
      },

      setStartAddress(text) {
        const p = parseAddress(text);
        if (!p.ok) {
          set({ status: { kind: 'error', text: p.error } });
          return;
        }
        if (get().machine && p.value !== get().startAddress) {
          // La máquina y el listado muestran el origen viejo hasta re-ensamblar.
          set({
            startAddress: p.value,
            stale: true,
            pausePrompt: false,
            status: { kind: 'info', text: 'La dirección de inicio cambió: volvé a ensamblar' },
          });
          return;
        }
        set({ startAddress: p.value, ...clearError() });
      },

      setBase(b) {
        set({ base: b });
      },

      assembleActive() {
        lastBreakPc = null;
        const s = get();
        const file = s.files.find((f) => f.id === s.activeId)!;
        const asm = assemble(file.text, { start: s.startAddress });
        // El ensamblado anterior pasa a ser la referencia de comparación.
        const prevMetrics = s.metrics ?? s.prevMetrics;
        if (!asm.ok) {
          const err = asm.messages.find((m) => m.severity === 'error');
          set({
            asm,
            machine: null,
            stale: false,
            pausePrompt: false,
            metrics: null,
            prevMetrics,
            status: {
              kind: 'error',
              source: 'assemble',
              text: err ? `Línea ${err.line}: ${err.message}` : 'El programa tiene errores',
            },
            ...touch(),
          });
          return;
        }
        const machine = new Machine(asm);
        for (const [addr, value] of s.userMemory) machine.setMemory(addr, value);
        for (const [port, value] of s.inputs) machine.inputs.set(port, value);
        const breakpointLines = new Set<number>();
        const dropped: number[] = [];
        for (const line of [...s.breakpointLines].sort((a, b) => a - b)) {
          if (machine.setBreakpoint(line).ok) breakpointLines.add(line);
          else dropped.push(line);
        }
        const count = asm.rows.filter((r) => r.instr).length;
        let text =
          `Ensamblado correcto · ${count} ${plural(count, 'instrucción', 'instrucciones')} · ` +
          `${asm.sizeBytes} bytes desde ${fmt16(asm.start, 'hex')}`;
        if (dropped.length > 0) {
          text +=
            ` · se quitó el punto de corte de ${plural(dropped.length, 'la línea', 'las líneas')} ` +
            `${dropped.join(', ')} (no genera instrucciones)`;
        }
        set({
          asm,
          machine,
          stale: false,
          pausePrompt: false,
          breakpointLines,
          prevMetrics,
          metrics: computeMetrics(asm, machine),
          status: { kind: 'info', text },
          ...touch(),
        });
      },

      step() {
        const r = ready();
        if (!r) {
          set({ status: NOT_READY });
          return;
        }
        lastBreakPc = null;
        const res = r.machine.step();
        let status: Status | null = null;
        if (res.reason === 'halt') status = HALTED;
        else if (res.reason === 'error') status = { kind: 'error', source: 'run', text: res.info?.error ?? 'Error de ejecución' };
        set({ metrics: computeMetrics(r.asm, r.machine), status, ...touch() });
      },

      stepBack() {
        const r = ready();
        if (!r) {
          set({ status: NOT_READY });
          return;
        }
        lastBreakPc = null;
        if (!r.machine.back()) {
          set({ status: { kind: 'info', text: 'No hay pasos para deshacer' } });
          return;
        }
        set({ metrics: computeMetrics(r.asm, r.machine), status: null, ...touch() });
      },

      reset() {
        const r = ready();
        if (!r) {
          set({ status: NOT_READY });
          return;
        }
        lastBreakPc = null;
        r.machine.reset();
        set({ metrics: computeMetrics(r.asm, r.machine), pausePrompt: false, status: null, ...touch() });
      },

      /**
       * Una tanda de ejecución. machine.run() devuelve 'pause-limit' siempre que
       * agota el límite, así que la regla es:
       * - tanda chica (< PAUSE_BATCH, la usa el bucle animado de la UI): agotar
       *   la cuota significa "sigue corriendo" → devuelve null sin pausePrompt;
       * - tanda grande (>= PAUSE_BATCH, "ejecutar todo"): agotarla es un posible
       *   bucle infinito → pausePrompt = true y devuelve 'pause-limit'.
       * Devuelve null también si no hay máquina lista (y pone el error).
       */
      runBatch(maxInstructions) {
        const r = ready();
        if (!r) {
          set({ status: NOT_READY });
          return null;
        }
        const atBreak = breakpointAtPc(r.machine, r.asm);
        if (atBreak !== null) {
          lastBreakPc = r.machine.cpu.PC;
          set({ status: { kind: 'info', text: `Punto de corte en la línea ${atBreak}` }, ...touch() });
          return 'breakpoint';
        }
        const res = r.machine.run(maxInstructions);
        const metrics = computeMetrics(r.asm, r.machine);
        switch (res.reason) {
          case 'pause-limit':
            if (maxInstructions < PAUSE_BATCH) {
              set({ metrics, ...touch() });
              return null;
            }
            set({ metrics, pausePrompt: true, ...touch() });
            return 'pause-limit';
          case 'halt':
            set({ metrics, status: HALTED, ...touch() });
            return 'halt';
          case 'breakpoint': {
            lastBreakPc = r.machine.cpu.PC;
            const line = r.asm.addressToLine.get(r.machine.cpu.PC);
            set({
              metrics,
              status: { kind: 'info', text: `Punto de corte en la línea ${line ?? '?'}` },
              ...touch(),
            });
            return 'breakpoint';
          }
          case 'error':
            set({
              metrics,
              status: { kind: 'error', source: 'run', text: res.info?.error ?? 'Error de ejecución' },
              ...touch(),
            });
            return 'error';
          default:
            set({ metrics, ...touch() });
            return res.reason;
        }
      },

      stop() {
        set({ pausePrompt: false, status: { kind: 'info', text: 'Ejecución detenida' } });
      },

      continueAfterPause() {
        set({ pausePrompt: false });
      },

      toggleBreakpoint(line) {
        const r = ready();
        const lines = new Set(get().breakpointLines);
        if (lines.has(line)) {
          lines.delete(line);
          r?.machine.clearBreakpoint(line);
        } else if (r) {
          const res = r.machine.setBreakpoint(line);
          if (!res.ok) {
            set({ status: { kind: 'error', text: res.error } });
            return;
          }
          lines.add(line);
        } else {
          // Sin máquina: se guarda y se valida al ensamblar.
          lines.add(line);
        }
        set({ breakpointLines: lines, ...(r ? touch() : {}) });
      },

      setBreakpointLines(lines) {
        set({ breakpointLines: new Set(lines) });
      },

      setMemoryByte(addr, valueText) {
        const p = parseByte(valueText);
        if (!p.ok) {
          set({ status: { kind: 'error', source: 'input', text: p.error } });
          return;
        }
        const a = addr & 0xffff;
        const userMemory = new Map(get().userMemory).set(a, p.value);
        const r = ready();
        if (!r) {
          set({ userMemory, ...clearError() });
          return;
        }
        lastBreakPc = null;
        const hadHistory = r.machine.canBack;
        r.machine.setMemory(a, p.value);
        set({
          userMemory,
          ...clearError(),
          // Solo avisa cuando agrega información: se perdió el paso atrás.
          ...(hadHistory
            ? { status: { kind: 'info' as const, text: 'Memoria editada: se borró el historial de pasos' } }
            : {}),
          ...touch(),
        });
      },

      clearUserMemory() {
        const r = ready();
        if (r) lastBreakPc = null;
        r?.machine.clearUserData();
        set({ userMemory: new Map(), ...(r ? touch() : {}) });
      },

      setInput(port, valueText) {
        // El puerto llega como número (la UI lo parsea con parsePort); acá solo se acota.
        if (!Number.isInteger(port) || port < 0 || port > 0xff) {
          set({ status: { kind: 'error', source: 'input', text: 'Puerto fuera de rango (00h–FFh)' } });
          return;
        }
        const p = parseByte(valueText);
        if (!p.ok) {
          set({ status: { kind: 'error', source: 'input', text: p.error } });
          return;
        }
        const inputs = new Map(get().inputs).set(port, p.value);
        const r = ready();
        if (!r) {
          set({ inputs, ...clearError() });
          return;
        }
        r.machine.inputs.set(port, p.value);
        set({ inputs, ...clearError(), ...touch() });
      },

      removeInput(port) {
        if (!get().inputs.has(port)) return;
        const inputs = new Map(get().inputs);
        inputs.delete(port);
        const r = ready();
        if (!r) {
          set({ inputs });
          return;
        }
        r.machine.inputs.delete(port);
        set({ inputs, ...touch() });
      },

      raise(irq) {
        const r = ready();
        if (!r) {
          set({ status: NOT_READY });
          return;
        }
        lastBreakPc = null;
        r.machine.raise(irq);
        set({ ...touch() });
      },
    };
  });
}

/** Sesión por defecto de la aplicación. */
export const defaultSession = createSession();

/** Hook de React sobre la sesión por defecto. */
export function useSession(): Session;
export function useSession<T>(selector: (s: Session) => T): T;
export function useSession<T>(selector?: (s: Session) => T) {
  return useStore(defaultSession, selector ?? ((s: Session) => s as unknown as T));
}
