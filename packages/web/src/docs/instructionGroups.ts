/** Grupos de la referencia de instrucciones y filas generadas desde ISA (el manual es la única fuente). */
import { ISA, type InstrDef } from '@sim8085/core';

export interface InstrGroup {
  id: string;
  title: string;
  mnemonics: readonly string[];
}

const words = (s: string) => s.split(' ');

export const GROUPS: readonly InstrGroup[] = [
  { id: 'transferencia', title: 'Transferencia de datos', mnemonics: words('MOV MVI LXI LDA STA LHLD SHLD LDAX STAX XCHG') },
  { id: 'aritmeticas', title: 'Aritméticas', mnemonics: words('ADD ADC ADI ACI SUB SBB SUI SBI INR DCR INX DCX DAD DAA') },
  { id: 'logicas', title: 'Lógicas', mnemonics: words('ANA ANI ORA ORI XRA XRI CMP CPI CMA CMC STC RLC RRC RAL RAR') },
  { id: 'saltos', title: 'Saltos y control', mnemonics: words('JMP JNZ JZ JNC JC JPO JPE JP JM PCHL NOP HLT') },
  {
    id: 'pila',
    title: 'Pila y subrutinas',
    mnemonics: words('PUSH POP XTHL SPHL CALL CNZ CZ CNC CC CPO CPE CP CM RET RNZ RZ RNC RC RPO RPE RP RM RST'),
  },
  { id: 'es', title: 'Entrada, salida e interrupciones', mnemonics: words('IN OUT EI DI RIM SIM') },
];

/** Mnemónicos de `isa` que ningún grupo lista (missing), los que un grupo lista y `isa` no tiene (unknown) y los repetidos. */
export function missingFromGroups(isa: readonly Pick<InstrDef, 'mnemonic'>[]) {
  const inIsa = new Set(isa.map((d) => d.mnemonic));
  const listed = GROUPS.flatMap((g) => g.mnemonics);
  const seen = new Set<string>();
  const duplicated: string[] = [];
  for (const m of listed) {
    if (seen.has(m) && !duplicated.includes(m)) duplicated.push(m);
    seen.add(m);
  }
  return {
    missing: [...inIsa].filter((m) => !seen.has(m)),
    unknown: [...seen].filter((m) => !inIsa.has(m)),
    duplicated,
  };
}

export interface InstrRow {
  mnemonic: string;
  forms: string[];
  summary: string;
  bytes: string;
  tStates: string;
  flags: string;
}

const REG = new Set(['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M']);
const FLAG_ORDER = ['S', 'Z', 'AC', 'P', 'CY'];
const range = (nums: number[]) => {
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
};

/** Con muchas formas (MOV, ADD…) se muestra la forma genérica: r, r1,r2, n. */
function compact(operands: string[]): string {
  const regs = operands.filter((o) => REG.has(o)).length;
  let k = 0;
  return operands
    .map((o) => {
      if (REG.has(o)) return regs > 1 ? `r${++k}` : 'r';
      if (/^\d$/.test(o)) return 'n';
      return o;
    })
    .join(',');
}

export function rowsFor(mnemonic: string): InstrRow {
  const defs = ISA.filter((d) => d.mnemonic === mnemonic);
  const raw = [...new Set(defs.map((d) => d.operands.join(',')))].filter((f) => f !== '');
  const big = defs.length >= 8;
  const forms = big ? [...new Set(defs.map((d) => compact(d.operands)))].filter((f) => f !== '') : raw;

  const first = defs[0]!.summary;
  let summary = first;
  if (big) {
    const matches = first.match(/registro [A-Z]\b/g) ?? [];
    let n = 0;
    summary = first.replace(/registro [A-Z]\b/g, () => (matches.length > 1 ? `registro r${++n}` : 'registro r'));
  }

  const t = defs.map((d) => d.tStates);
  const tStates = t.every((x) => Array.isArray(x))
    ? [...new Set(t.map((x) => (x as [number, number]).join('/')))].join(', ')
    : range(t as number[]);
  const flags = FLAG_ORDER.filter((f) => defs.some((d) => (d.flags as string[]).includes(f)));

  return {
    mnemonic,
    forms,
    summary,
    bytes: range(defs.map((d) => d.size)),
    tStates,
    flags: flags.length ? flags.join(' ') : '—',
  };
}
