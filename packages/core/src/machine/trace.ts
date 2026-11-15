/** Traza para el PDF: una fila por instrucción ejecutada (spec §6.7). */
import type { AssembleResult } from '../asm/assembler';
import { Machine } from './machine';

export interface TraceRow {
  /** Ins. N° (desde 1). */
  n: number;
  /** Dirección de dato leída o escrita por la instrucción, y su valor después. */
  memAddr?: number;
  memValue?: number;
  A: number; B: number; C: number; D: number; E: number; H: number; L: number;
  /** memoria[HL] después de la instrucción. */
  M: number;
  Z: 0 | 1; P: 0 | 1; S: 0 | 1; CY: 0 | 1;
}

export function buildTrace(
  program: AssembleResult,
  setup: (m: Machine) => void,
  maxRows = 500,
): { rows: TraceRow[]; truncated: boolean } {
  const m = new Machine(program);
  setup(m);
  const rows: TraceRow[] = [];
  let stopped = false;
  while (rows.length < maxRows) {
    const r = m.step();
    if (r.reason === 'error' || (r.steps === 0 && r.reason === 'halt')) { stopped = true; break; }
    const info = r.info;
    // Aceptar una interrupción no es una instrucción: no genera fila.
    if (info && info.instr) {
      const c = m.cpu;
      const addr = info.memWrite ?? info.memRead;
      const row: TraceRow = {
        n: rows.length + 1,
        A: c.A, B: c.B, C: c.C, D: c.D, E: c.E, H: c.H, L: c.L,
        M: m.memory[((c.H << 8) | c.L) & 0xffff]!,
        Z: c.flags.Z, P: c.flags.P, S: c.flags.S, CY: c.flags.CY,
      };
      if (addr !== undefined) { row.memAddr = addr; row.memValue = m.memory[addr]!; }
      rows.push(row);
    }
    if (m.cpu.halted) { stopped = true; break; }
  }
  return { rows, truncated: !stopped };
}

