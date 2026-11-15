/** Métricas del programa (spec §6.8b). */
import type { AssembleResult } from '../asm/assembler';
import type { Machine } from './machine';

export interface Metrics {
  sizeBytes: number;
  range: [number, number];
  executed: number;
  tStates: number;
  registersUsed: string[];
  memoryUsed: number[];
}

/** Mnemónicos cuyo operando B/D/H nombra un par (BC/DE/HL) y no un registro simple. */
const PAIR_OPS = new Set(['LXI', 'INX', 'DCX', 'DAD', 'PUSH', 'POP', 'LDAX', 'STAX']);
/** Usan el acumulador sin nombrarlo. */
const IMPLICIT_A = new Set([
  'LDA', 'STA', 'LDAX', 'STAX', 'CMA', 'DAA', 'RAL', 'RAR', 'RLC', 'RRC', 'IN', 'OUT', 'SIM', 'RIM',
  'ADD', 'ADC', 'SUB', 'SBB', 'ANA', 'ORA', 'XRA', 'CMP',
  'ADI', 'ACI', 'SUI', 'SBI', 'ANI', 'ORI', 'XRI', 'CPI',
]);
/** Usan HL (y DE en XCHG) sin nombrarlos. */
const IMPLICIT: Record<string, string[]> = {
  DAD: ['H', 'L'], LHLD: ['H', 'L'], SHLD: ['H', 'L'], PCHL: ['H', 'L'], SPHL: ['H', 'L'], XTHL: ['H', 'L'],
  XCHG: ['D', 'E', 'H', 'L'],
};
const PAIR: Record<string, string[]> = { B: ['B', 'C'], D: ['D', 'E'], H: ['H', 'L'] };

/**
 * `registersUsed` se deduce de las instrucciones del programa (operandos y usos
 * implícitos), no de la ejecución: es estable y no depende de los datos.
 * `memoryUsed` son las direcciones de dato tocadas en la ejecución (sin fetches).
 */
export function computeMetrics(program: AssembleResult, m: Machine): Metrics {
  const regs = new Set<string>();
  for (const row of program.rows) {
    const d = row.instr;
    if (!d) continue;
    if (IMPLICIT_A.has(d.mnemonic)) regs.add('A');
    for (const r of IMPLICIT[d.mnemonic] ?? []) regs.add(r);
    for (const op of d.operands) {
      if (op === 'PSW') regs.add('A');
      else if (op === 'M') { regs.add('H'); regs.add('L'); }
      else if (PAIR_OPS.has(d.mnemonic) && PAIR[op]) PAIR[op]!.forEach((r) => regs.add(r));
      else if (/^[ABCDEHL]$/.test(op)) regs.add(op);
    }
  }
  return {
    sizeBytes: program.sizeBytes,
    range: [program.start, program.end],
    executed: m.executedInstructions,
    tStates: m.tStates,
    registersUsed: [...regs].sort(),
    memoryUsed: [...m.touchedMemory].sort((a, b) => a - b),
  };
}

export function diffMetrics(prev: Metrics, cur: Metrics): { sizeBytes: number; executed: number; tStates: number } {
  return {
    sizeBytes: cur.sizeBytes - prev.sizeBytes,
    executed: cur.executed - prev.executed,
    tStates: cur.tStates - prev.tStates,
  };
}
