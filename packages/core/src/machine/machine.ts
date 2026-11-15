/**
 * Machine: une CPU, memoria y E/S con el programa ensamblado. Ofrece ejecutar
 * todo, paso a paso, paso atrás, puntos de corte (por línea fuente),
 * interrupciones y el resaltado de cambios (spec §6.4–6.7).
 */
import type { AssembleResult } from '../asm/assembler';
import { initialState, type CpuState, type Flags } from '../cpu/state';
import { execute, acceptInterrupt, type Bus, type StepInfo } from '../cpu/execute';

export type StopReason = 'halt' | 'breakpoint' | 'pause-limit' | 'error' | 'step';
export interface OutEvent { port: number; value: number; step: number }
export interface RunResult { reason: StopReason; steps: number; info?: StepInfo }
export type FlagName = keyof Flags;
export type Change =
  | { kind: 'reg'; name: string; before: number; after: number }
  | { kind: 'flag'; name: FlagName; before: 0 | 1; after: 0 | 1 }
  | { kind: 'mem'; addr: number; before: number; after: number };

type Irq = 'TRAP' | 'RST7.5' | 'RST6.5' | 'RST5.5';

interface HistoryEntry {
  /** Copia profunda del CPU antes del paso. */
  cpu: CpuState;
  /** Escrituras del paso, en orden, con el valor previo. */
  writes: Array<{ addr: number; before: number }>;
  outputsLength: number;
  tStates: number;
  stepCount: number;
}

const HISTORY_LIMIT = 10_000;
const DEFAULT_LIMIT = 100_000;
const REGS = ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'SP', 'PC'] as const;
const FLAGS: readonly FlagName[] = ['S', 'Z', 'AC', 'P', 'CY'];
const IRQ_KEY = { TRAP: 'trap', 'RST7.5': 'r75', 'RST6.5': 'r65', 'RST5.5': 'r55' } as const;
const NO_BYTES = 'Esa línea no genera instrucciones';

export class Machine {
  readonly cpu: CpuState;
  readonly memory = new Uint8Array(0x10000);
  /** Valores que leerá IN (puerto → byte), cargados por el alumno. Sobreviven a reset(). */
  inputs = new Map<number, number>();
  readonly outputs: OutEvent[] = [];

  private _stepCount = 0;
  private _tStates = 0;
  /** Datos iniciales del alumno (dirección → byte), aplicados DESPUÉS de la imagen del programa. */
  private readonly userData = new Map<number, number>();
  /** Línea fuente → dirección de la primera instrucción. */
  private readonly breakpoints = new Map<number, number>();
  private history: HistoryEntry[] = [];
  /** Escrituras del paso en curso (las captura el bus). */
  private writes: Array<{ addr: number; before: number }> = [];
  private readonly bus: Bus;

  constructor(private readonly program: AssembleResult) {
    this.cpu = initialState(program.start);
    this.bus = {
      read: (a) => this.memory[a & 0xffff]!,
      write: (a, v) => {
        a &= 0xffff;
        this.writes.push({ addr: a, before: this.memory[a]! });
        this.memory[a] = v & 0xff;
      },
      in: (port) => (this.inputs.get(port & 0xff) ?? 0) & 0xff,
      out: (port, value) => {
        this.outputs.push({ port: port & 0xff, value: value & 0xff, step: this._stepCount });
      },
    };
    this.reset();
  }

  get stepCount(): number { return this._stepCount; }
  get tStates(): number { return this._tStates; }
  get canBack(): boolean { return this.history.length > 0; }

  /**
   * Carga un dato inicial del alumno: queda en memoria y se vuelve a aplicar en
   * cada reset(), después del programa (si pisa bytes de código, gana el dato
   * del alumno). No entra al historial.
   */
  setMemory(addr: number, value: number): void {
    addr &= 0xffff;
    value &= 0xff;
    this.userData.set(addr, value);
    this.memory[addr] = value;
  }

  setBreakpoint(line: number): { ok: true } | { ok: false; error: string } {
    const addr = this.program.lineToAddress.get(line);
    if (addr === undefined) return { ok: false, error: NO_BYTES };
    this.breakpoints.set(line, addr);
    return { ok: true };
  }

  clearBreakpoint(line: number): void {
    this.breakpoints.delete(line);
  }

  /** Un paso: aceptación de interrupción o una instrucción. */
  step(): RunResult {
    const r = this.stepOnce();
    if (r.kind === 'idle') return { reason: 'halt', steps: 0 };
    if (r.kind === 'error') return { reason: 'error', steps: 0, info: r.info };
    return { reason: this.cpu.halted ? 'halt' : 'step', steps: 1, info: r.info };
  }

  /**
   * Ejecuta hasta HLT, error, punto de corte o `limit` pasos ('pause-limit').
   * El punto de corte se evalúa ANTES de ejecutar cada instrucción, salvo la
   * primera (así, continuar desde un punto de corte lo pasa).
   */
  run(limit: number = DEFAULT_LIMIT): RunResult {
    let steps = 0;
    let info: StepInfo | undefined;
    const bpAddrs = new Set(this.breakpoints.values());
    while (steps < limit) {
      if (steps > 0 && !this.cpu.halted && bpAddrs.has(this.cpu.PC)) {
        return this.result('breakpoint', steps, info);
      }
      const r = this.stepOnce();
      if (r.kind === 'idle') return this.result('halt', steps, info);
      if (r.kind === 'error') return { reason: 'error', steps, info: r.info };
      steps++;
      info = r.info;
      if (this.cpu.halted) return this.result('halt', steps, info);
    }
    return this.result('pause-limit', steps, info);
  }

  /** Deshace el último paso. false si no hay historial. */
  back(): boolean {
    const h = this.history.pop();
    if (!h) return false;
    for (let i = h.writes.length - 1; i >= 0; i--) {
      const w = h.writes[i]!;
      this.memory[w.addr] = w.before;
    }
    Object.assign(this.cpu, structuredClone(h.cpu));
    this.outputs.length = h.outputsLength;
    this._tStates = h.tStates;
    this._stepCount = h.stepCount;
    return true;
  }

  /**
   * Registros, banderas, SP, IE, máscaras y pendientes a initialState(start);
   * memoria = imagen del programa + datos del alumno; se borran outputs e
   * historial. Se conservan `inputs` y los puntos de corte.
   */
  reset(): void {
    Object.assign(this.cpu, initialState(this.program.start));
    this.memory.fill(0);
    for (const [a, v] of this.program.memory) this.memory[a & 0xffff] = v & 0xff;
    for (const [a, v] of this.userData) this.memory[a] = v;
    this.outputs.length = 0;
    this.history = [];
    this._stepCount = 0;
    this._tStates = 0;
  }

  raise(irq: Irq): void {
    this.cpu.pending[IRQ_KEY[irq]] = true;
  }

  /**
   * Qué cambió en el último paso (el de la cima del historial, cuyo "después"
   * es el estado actual). PC se informa siempre; el resto solo si cambió.
   */
  lastChanges(): Change[] {
    const h = this.history[this.history.length - 1];
    if (!h) return [];
    const out: Change[] = [];
    for (const name of REGS) {
      const before = h.cpu[name], after = this.cpu[name];
      if (name === 'PC' || before !== after) out.push({ kind: 'reg', name, before, after });
    }
    for (const name of FLAGS) {
      const before = h.cpu.flags[name], after = this.cpu.flags[name];
      if (before !== after) out.push({ kind: 'flag', name, before, after });
    }
    const seen = new Set<number>();
    for (const w of h.writes) {
      if (seen.has(w.addr)) continue;
      seen.add(w.addr);
      const after = this.memory[w.addr]!;
      if (after !== w.before) out.push({ kind: 'mem', addr: w.addr, before: w.before, after });
    }
    return out;
  }

  private result(reason: StopReason, steps: number, info?: StepInfo): RunResult {
    return info ? { reason, steps, info } : { reason, steps };
  }

  /**
   * Intenta aceptar una interrupción (siempre, aun en HLT) y si no, ejecuta.
   * 'idle': detenido en HLT sin interrupción aceptada. 'error': opcode
   * inválido, sin cambios de estado ni historial.
   */
  private stepOnce():
    | { kind: 'ok'; info: StepInfo }
    | { kind: 'idle' }
    | { kind: 'error'; info: StepInfo } {
    const snapshot = structuredClone(this.cpu);
    this.writes = [];
    const outputsLength = this.outputs.length;
    let info = acceptInterrupt(this.cpu, this.bus);
    if (!info) {
      if (this.cpu.halted) return { kind: 'idle' };
      info = execute(this.cpu, this.bus);
      if (info.error) {
        // execute no modifica el estado ante un opcode inválido; por las dudas
        // se descarta todo lo que hubiera hecho.
        this.discard(snapshot, outputsLength);
        return { kind: 'error', info };
      }
    }
    this.history.push({
      cpu: snapshot,
      writes: this.writes,
      outputsLength,
      tStates: this._tStates,
      stepCount: this._stepCount,
    });
    if (this.history.length > HISTORY_LIMIT) this.history.shift();
    this._tStates += info.tStates;
    this._stepCount++;
    return { kind: 'ok', info };
  }

  private discard(snapshot: CpuState, outputsLength: number): void {
    for (let i = this.writes.length - 1; i >= 0; i--) {
      const w = this.writes[i]!;
      this.memory[w.addr] = w.before;
    }
    Object.assign(this.cpu, snapshot);
    this.outputs.length = outputsLength;
  }
}
