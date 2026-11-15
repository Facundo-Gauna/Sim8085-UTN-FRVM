/**
 * Machine: une CPU, memoria y E/S con el programa ensamblado. Ofrece ejecutar
 * todo, paso a paso, paso atrás, puntos de corte (por línea fuente),
 * interrupciones y el resaltado de cambios (spec §6.4–6.7).
 */
import type { AssembleResult } from '../asm/assembler';
import { initialState, type CpuState, type Flags } from '../cpu/state';
import { execute, acceptInterrupt, type Bus, type StepInfo } from '../cpu/execute';

export type StopReason = 'halt' | 'breakpoint' | 'pause-limit' | 'error' | 'step';
export interface OutEvent {
  port: number;
  value: number;
  /** Número (desde 1) de la instrucción que hizo el OUT: `stepCount` después de ejecutarla. */
  step: number;
}
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

/** Copia profunda de CpuState (a mano: structuredClone es ~10x más lento por paso). */
function cloneCpu(s: CpuState): CpuState {
  return { ...s, flags: { ...s.flags }, masks: { ...s.masks }, pending: { ...s.pending } };
}

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
  /** Objetos anidados del CPU cuya identidad se conserva siempre. */
  private readonly objects: Pick<CpuState, 'flags' | 'masks' | 'pending'>;

  constructor(private readonly program: AssembleResult) {
    this.cpu = initialState(program.entry);
    this.objects = { flags: this.cpu.flags, masks: this.cpu.masks, pending: this.cpu.pending };
    this.bus = {
      read: (a) => this.memory[a & 0xffff]!,
      write: (a, v) => {
        a &= 0xffff;
        this.writes.push({ addr: a, before: this.memory[a]! });
        this.memory[a] = v & 0xff;
      },
      in: (port) => (this.inputs.get(port & 0xff) ?? 0) & 0xff,
      out: (port, value) => {
        // stepCount se incrementa al terminar el paso: este OUT es el paso stepCount + 1.
        this.outputs.push({ port: port & 0xff, value: value & 0xff, step: this._stepCount + 1 });
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
   * del alumno). No entra al historial: editar la memoria invalida el paso
   * atrás (deshacer pasos sobre memoria editada a mano daría estados que nunca
   * existieron), así que se borra el historial.
   */
  setMemory(addr: number, value: number): void {
    addr &= 0xffff;
    value &= 0xff;
    this.userData.set(addr, value);
    this.memory[addr] = value;
    this.history = [];
  }

  /**
   * Punto de corte por línea fuente. Solo vale en líneas que generan
   * instrucciones (no EQU/ORG/DS/DB/DW, etiquetas solas ni comentarios); en una
   * llamada a macro se detiene en la primera instrucción expandida.
   */
  setBreakpoint(line: number): { ok: true } | { ok: false; error: string } {
    const row = this.program.rows.find((r) => r.line === line && r.instr !== undefined);
    if (!row) return { ok: false, error: NO_BYTES };
    this.breakpoints.set(line, row.address);
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
   * Con `limit <= 0` no ejecuta nada y devuelve { reason: 'pause-limit', steps: 0 }.
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
    this.restoreCpu(h.cpu);
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
    this.restoreCpu(initialState(this.program.entry));
    this.memory.fill(0);
    for (const [a, v] of this.program.memory) this.memory[a & 0xffff] = v & 0xff;
    for (const [a, v] of this.userData) this.memory[a] = v;
    this.outputs.length = 0;
    this.history = [];
    this._stepCount = 0;
    this._tStates = 0;
  }

  /**
   * Marca una interrupción pendiente. Semántica de "viaje en el tiempo": un
   * raise() hecho después del último paso no es parte de ningún paso, así que
   * back() lo pierde (vuelve al pendiente que había antes de ese paso).
   */
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
    const snapshot = cloneCpu(this.cpu);
    this.writes = [];
    const outputsLength = this.outputs.length;
    let info = acceptInterrupt(this.cpu, this.bus);
    if (!info) {
      if (this.cpu.halted) return { kind: 'idle' };
      info = execute(this.cpu, this.bus);
      this.keepIdentity();
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
    this.restoreCpu(snapshot);
    this.outputs.length = outputsLength;
  }

  /**
   * Copia `snap` DENTRO del CPU vivo, sin reemplazar `cpu.flags`, `cpu.masks`
   * ni `cpu.pending`, para que las referencias de la UI sigan valiendo.
   */
  private restoreCpu(snap: CpuState): void {
    const { flags, masks, pending, ...rest } = snap;
    Object.assign(this.cpu, rest);
    this.keepIdentity();
    Object.assign(this.cpu.flags, flags);
    Object.assign(this.cpu.masks, masks);
    Object.assign(this.cpu.pending, pending);
  }

  /** `execute` puede reemplazar `cpu.flags` (POP PSW): volver a los objetos originales. */
  private keepIdentity(): void {
    const c = this.cpu, o = this.objects;
    if (c.flags !== o.flags) { Object.assign(o.flags, c.flags); c.flags = o.flags; }
    if (c.masks !== o.masks) { Object.assign(o.masks, c.masks); c.masks = o.masks; }
    if (c.pending !== o.pending) { Object.assign(o.pending, c.pending); c.pending = o.pending; }
  }
}
