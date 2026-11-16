/** Observaciones automáticas en lenguaje simple (spec §6.8): una frase por instrucción. */
import type { ListingRow } from './assembler';

const hex = (n: number, digits: number) => n.toString(16).toUpperCase().padStart(digits, '0') + 'h';
const PAIR: Record<string, string> = { B: 'BC', D: 'DE', H: 'HL', SP: 'SP', PSW: 'PSW' };
const COND: Record<string, string> = {
  NZ: 'Z = 0', Z: 'Z = 1', NC: 'CY = 0', C: 'CY = 1', PO: 'P = 0', PE: 'P = 1', P: 'S = 0', M: 'S = 1',
};
const ALU_REG: Record<string, string> = {
  ADD: 'A ← A + {s}', ADC: 'A ← A + {s} + CY', SUB: 'A ← A - {s}', SBB: 'A ← A - {s} - CY',
  ANA: 'A ← A AND {s}', ORA: 'A ← A OR {s}', XRA: 'A ← A XOR {s}', CMP: 'A - {s} (solo cambia banderas)',
};
const ALU_IMM: Record<string, string> = {
  ADI: 'ADD', ACI: 'ADC', SUI: 'SUB', SBI: 'SBB', ANI: 'ANA', ORI: 'ORA', XRI: 'XRA', CPI: 'CMP',
};
const SIMPLE: Record<string, string> = {
  XCHG: 'HL ↔ DE', XTHL: 'HL ↔ tope de la pila', SPHL: 'SP ← HL', PCHL: 'PC ← HL',
  RLC: 'rota A a la izquierda', RRC: 'rota A a la derecha',
  RAL: 'rota A a la izquierda por CY', RAR: 'rota A a la derecha por CY',
  CMA: 'A ← NOT A', CMC: 'CY ← NOT CY', STC: 'CY ← 1', DAA: 'ajuste decimal de A',
  RET: 'vuelve de la subrutina', EI: 'habilita interrupciones', DI: 'deshabilita interrupciones',
  RIM: 'A ← máscara de interrupciones', SIM: 'máscara de interrupciones ← A',
  NOP: 'sin operación', HLT: 'detiene el procesador',
};

export function describeInstruction(row: ListingRow): string | undefined {
  const def = row.instr;
  if (!def) return undefined;
  const mn = def.mnemonic;
  const ops = def.operands;
  const reg = (o: string) => (o === 'M' ? 'M[HL]' : o);
  const b = row.bytes;
  const imm8 = hex(b[1] ?? 0, 2);
  const imm16 = hex(((b[2] ?? 0) << 8) | (b[1] ?? 0), 4);
  // Operando fuente de una dirección: si es una etiqueta, se muestra su nombre.
  const srcOperand = row.source.slice(row.source.indexOf(' ') + 1).trim();
  const addr = /^[A-Za-z_@.$?]/.test(srcOperand) ? srcOperand : imm16;

  if (SIMPLE[mn]) return SIMPLE[mn];
  if (mn === 'MOV') return `${reg(ops[0]!)} ← ${reg(ops[1]!)}`;
  if (mn === 'MVI') return `${reg(ops[0]!)} ← ${imm8}`;
  if (mn === 'LXI') return `${PAIR[ops[0]!]} ← ${imm16}`;
  if (mn === 'LDA') return `A ← M[${addr}]`;
  if (mn === 'STA') return `M[${addr}] ← A`;
  if (mn === 'LHLD') return `HL ← M[${addr}]`;
  if (mn === 'SHLD') return `M[${addr}] ← HL`;
  if (mn === 'LDAX') return `A ← M[${PAIR[ops[0]!]}]`;
  if (mn === 'STAX') return `M[${PAIR[ops[0]!]}] ← A`;
  if (ALU_REG[mn]) return ALU_REG[mn]!.replace('{s}', reg(ops[0]!));
  if (ALU_IMM[mn]) return ALU_REG[ALU_IMM[mn]!]!.replace('{s}', imm8);
  if (mn === 'INR') return `${reg(ops[0]!)} ← ${reg(ops[0]!)} + 1`;
  if (mn === 'DCR') return `${reg(ops[0]!)} ← ${reg(ops[0]!)} - 1`;
  if (mn === 'INX') return `${PAIR[ops[0]!]} ← ${PAIR[ops[0]!]} + 1`;
  if (mn === 'DCX') return `${PAIR[ops[0]!]} ← ${PAIR[ops[0]!]} - 1`;
  if (mn === 'DAD') return `HL ← HL + ${PAIR[ops[0]!]}`;
  if (mn === 'PUSH') return `pila ← ${PAIR[ops[0]!]}`;
  if (mn === 'POP') return `${PAIR[ops[0]!]} ← pila`;
  if (mn === 'IN') return `A ← puerto ${imm8}`;
  if (mn === 'OUT') return `puerto ${imm8} ← A`;
  if (mn === 'RST') return `llama a ${hex(Number(ops[0]) * 8, 4)}`;
  if (mn === 'JMP') return `salta a ${addr}`;
  if (mn === 'CALL') return `llama a ${addr}`;
  const cond = (suffix: string) => COND[suffix];
  if (mn.startsWith('J') && cond(mn.slice(1))) return `si ${cond(mn.slice(1))}, salta a ${addr}`;
  if (mn.startsWith('C') && mn !== 'CALL' && cond(mn.slice(1))) return `si ${cond(mn.slice(1))}, llama a ${addr}`;
  if (mn.startsWith('R') && cond(mn.slice(1))) return `si ${cond(mn.slice(1))}, vuelve de la subrutina`;
  return mn;
}
