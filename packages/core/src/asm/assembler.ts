import type { InstrDef } from '../isa/types';
import { ISA } from '../isa/table';
import { findInstr } from '../isa/lookup';
import { parseNumber } from './numbers';
import { lexLine } from './lexer';
import { expandMacros, type AsmMessage, type ExpandedLine } from './macros';

export type { AsmMessage } from './macros';

export interface ListingRow {
  /** Línea fuente (para macros: la línea de la llamada). */
  line: number;
  address: number;
  bytes: number[];
  /** Mnemónico normalizado, p. ej. 'LDA 0040H'. */
  source: string;
  comment?: string;
  /** Nombre de la macro si la fila viene de una expansión. */
  fromMacro?: string;
  instr?: InstrDef;
  inCatedra: boolean;
}

export interface AssembleResult {
  ok: boolean;
  messages: AsmMessage[];
  /** En orden de dirección. */
  rows: ListingRow[];
  memory: Map<number, number>;
  symbols: Map<string, number>;
  /** Línea → primera dirección generada. */
  lineToAddress: Map<number, number>;
  /** Dirección de inicio de instrucción → línea. */
  addressToLine: Map<number, number>;
  /** Primer y último byte emitido. */
  start: number;
  end: number;
  /** Cantidad de bytes emitidos (los huecos entre bloques ORG no cuentan). */
  sizeBytes: number;
}

const MAX_COMMENT = 80;
const VALUE_KINDS = new Set(['d8', 'd16', 'addr', 'port']);
const REGISTER_NAMES = new Set(['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'SP', 'PSW']);
const SINGLE_REGS = new Set(['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M']);
const BY_MNEMONIC: ReadonlyMap<string, InstrDef[]> = (() => {
  const m = new Map<string, InstrDef[]>();
  for (const d of ISA) {
    const list = m.get(d.mnemonic) ?? [];
    list.push(d);
    m.set(d.mnemonic, list);
  }
  return m;
})();

const hex = (n: number, digits: number): string => n.toString(16).toUpperCase().padStart(digits, '0');

/** Descripción en español de los operandos que acepta un mnemónico. */
function describeForms(mnemonic: string, defs: InstrDef[]): string {
  if (mnemonic === 'RST') return 'RST necesita un número de 0 a 7';
  const arity = defs[0]!.operands.length;
  if (arity === 0) return `${mnemonic} no lleva operandos`;
  const parts: string[] = [];
  for (let i = 0; i < arity; i++) {
    const opts = new Set(defs.map((d) => d.operands[i]!));
    if ([...opts].every((o) => SINGLE_REGS.has(o)) && opts.has('C')) parts.push('un registro');
    else if ([...opts].every((o) => REGISTER_NAMES.has(o))) parts.push('un par de registros');
    else if (opts.has('d8')) parts.push('un dato de 8 bits');
    else if (opts.has('d16')) parts.push('un dato de 16 bits');
    else if (opts.has('addr')) parts.push('una dirección de 16 bits');
    else parts.push('un número de puerto de 8 bits');
  }
  if (parts.length === 2 && parts[0] === 'un registro' && parts[1] === 'un registro') {
    return `${mnemonic} necesita dos registros`;
  }
  const list = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
  return `${mnemonic} necesita ${list}`;
}

/** Elige la forma de la instrucción según los operandos escritos. */
function matchForm(mnemonic: string, args: string[]): { def: InstrDef } | { error: string } {
  const defs = BY_MNEMONIC.get(mnemonic);
  if (!defs) return { error: `Mnemónico desconocido: ${mnemonic}` };
  if (mnemonic === 'RST') {
    // El tamaño es siempre 1; el número se resuelve en la pasada 2.
    return args.length === 1 ? { def: defs[0]! } : { error: describeForms(mnemonic, defs) };
  }
  for (const d of defs) {
    if (d.operands.length !== args.length) continue;
    const fits = d.operands.every((o, i) =>
      VALUE_KINDS.has(o) ? !REGISTER_NAMES.has(args[i]!) : o === args[i]);
    if (fits) return { def: d };
  }
  return { error: describeForms(mnemonic, defs) };
}

type Eval = { ok: true; value: number } | { ok: false; error: string };

/** Evalúa un operando: literal numérico, carácter entre comillas o símbolo. */
function evaluate(text: string, symbols: Map<string, number>): Eval {
  const num = parseNumber(text);
  if (num) return num;
  const ch = /^'(.)'$/.exec(text);
  if (ch) return { ok: true, value: ch[1]!.charCodeAt(0) & 0xff };
  const sym = symbols.get(text);
  if (sym !== undefined) return { ok: true, value: sym };
  if (/^[A-F][0-9A-F]*H$/.test(text)) {
    return {
      ok: false,
      error: `¿Quisiste decir 0${text}? Un número hexadecimal que empieza con letra lleva un 0 adelante.`,
    };
  }
  if (/^[A-Z_][A-Z0-9_]*$/.test(text)) return { ok: false, error: `El símbolo ${text} no está definido` };
  return { ok: false, error: `No se entiende el operando ${text}` };
}

function check8(v: Eval, text: string): Eval {
  if (v.ok && v.value > 0xff) {
    return { ok: false, error: `El valor ${text} está fuera de rango para 8 bits (máximo 0FFH = 255)` };
  }
  return v;
}

const isString = (a: string): boolean => /^'.*'$/.test(a) && a.length >= 2;

/** Tamaño de una directiva DB (cadenas cuentan un byte por carácter). */
const dbSize = (args: string[]): number =>
  args.reduce((n, a) => n + (isString(a) && a.length !== 3 ? a.length - 2 : 1), 0);

interface Planned {
  line: ExpandedLine;
  address: number;
  def?: InstrDef;
}

/** Ensambla un programa del 8085 en dos pasadas (más la expansión de macros). */
export function assemble(source: string, opts: { start?: number } = {}): AssembleResult {
  const origin = opts.start ?? 0;
  const raw = source.split(/\r?\n/).map((text, i) => lexLine(text, i + 1));
  const expanded = expandMacros(raw);
  const messages: AsmMessage[] = [...expanded.messages];
  const error = (line: number, message: string) => messages.push({ line, severity: 'error', message });
  const symbols = new Map<string, number>();
  const symbolLine = new Map<string, number>();

  for (const l of raw) {
    if (l.comment !== undefined && l.comment.length > MAX_COMMENT) {
      messages.push({ line: l.line, severity: 'warning', message: 'La observación supera los 80 caracteres' });
    }
    if (l.op === 'END') break;
  }

  // ---- Pasada 1: direcciones y símbolos ----
  const planned: Planned[] = [];
  const reserved: Array<{ line: number; address: number; size: number }> = [];
  let pc = origin;
  let overflowReported = false;

  const define = (name: string, value: number, line: number) => {
    if (symbols.has(name)) {
      error(line, `La etiqueta ${name} ya está definida (línea ${symbolLine.get(name)})`);
      return;
    }
    symbols.set(name, value);
    symbolLine.set(name, line);
  };
  /** Valor que debe conocerse ya en la pasada 1 (ORG, EQU, DS). */
  const evalNow = (l: ExpandedLine, what: string): number | undefined => {
    if (l.args.length !== 1) { error(l.line, `${what} necesita un valor`); return undefined; }
    const v = evaluate(l.args[0]!, symbols);
    if (!v.ok) {
      const undefinedSym = v.error.startsWith('El símbolo');
      error(l.line, undefinedSym ? `${v.error} antes de ${what}` : v.error);
      return undefined;
    }
    return v.value;
  };
  const advance = (l: ExpandedLine, size: number) => {
    pc += size;
    if (pc > 0x10000 && !overflowReported) {
      error(l.line, 'El programa supera la última dirección de memoria (0FFFFh)');
      overflowReported = true;
    }
  };

  for (const l of expanded.lines) {
    if (l.op === 'END') break;
    if (l.op === 'EQU') {
      if (!l.label) { error(l.line, 'EQU necesita un nombre: NOMBRE EQU valor'); continue; }
      const v = evalNow(l, 'EQU');
      if (v !== undefined) define(l.label, v, l.line);
      continue;
    }
    if (l.label) define(l.label, pc, l.line);
    if (!l.op) continue;
    switch (l.op) {
      case 'ORG': {
        const v = evalNow(l, 'ORG');
        if (v !== undefined) pc = v;
        break;
      }
      case 'DS': {
        const v = evalNow(l, 'DS');
        if (v !== undefined) { reserved.push({ line: l.line, address: pc, size: v }); advance(l, v); }
        break;
      }
      case 'DB':
      case 'DW': {
        if (l.args.length === 0) { error(l.line, `${l.op} necesita al menos un valor`); break; }
        planned.push({ line: l, address: pc });
        advance(l, l.op === 'DB' ? dbSize(l.args) : 2 * l.args.length);
        break;
      }
      default: {
        const m = matchForm(l.op, l.args);
        if ('error' in m) { error(l.line, m.error); break; }
        planned.push({ line: l, address: pc, def: m.def });
        advance(l, m.def.size);
      }
    }
  }

  // ---- Pasada 2: codificación ----
  const rows: ListingRow[] = [];
  for (const p of planned) {
    const l = p.line;
    const bytes: number[] = [];
    let failed = false;
    const fail = (msg: string) => { error(l.line, msg); failed = true; };
    let instr: InstrDef | undefined;

    if (l.op === 'DB') {
      for (const a of l.args) {
        if (isString(a) && a.length !== 3) {
          for (const ch of a.slice(1, -1)) bytes.push(ch.charCodeAt(0) & 0xff);
          continue;
        }
        const v = check8(evaluate(a, symbols), a);
        if (!v.ok) { fail(v.error); break; }
        bytes.push(v.value);
      }
    } else if (l.op === 'DW') {
      for (const a of l.args) {
        const v = evaluate(a, symbols);
        if (!v.ok) { fail(v.error); break; }
        bytes.push(v.value & 0xff, v.value >> 8);
      }
    } else if (l.op === 'RST') {
      const v = evaluate(l.args[0]!, symbols);
      if (!v.ok) fail(v.error);
      else if (v.value > 7) fail('RST necesita un número de 0 a 7');
      else {
        instr = findInstr('RST', [String(v.value)]);
        bytes.push(instr!.opcode);
      }
    } else {
      instr = p.def!;
      bytes.push(instr.opcode);
      instr.operands.forEach((kind, i) => {
        if (failed || !VALUE_KINDS.has(kind)) return;
        const text = l.args[i]!;
        let v = evaluate(text, symbols);
        if (kind === 'd8' || kind === 'port') {
          v = check8(v, text);
          if (v.ok) bytes.push(v.value);
        } else if (v.ok) bytes.push(v.value & 0xff, v.value >> 8);
        if (!v.ok) fail(v.error);
      });
    }
    if (failed) continue;

    const row: ListingRow = {
      line: l.line,
      address: p.address,
      bytes,
      source: l.args.length ? `${l.op} ${l.args.join(', ')}` : l.op!,
      inCatedra: instr !== undefined && l.fromMacro === undefined,
    };
    if (l.comment !== undefined) row.comment = l.comment;
    if (l.fromMacro !== undefined) row.fromMacro = l.fromMacro;
    if (instr) row.instr = instr;
    rows.push(row);
  }

  // ---- Volcado a memoria y control de superposición ----
  const memory = new Map<number, number>();
  const owner = new Map<number, number>();
  const lineToAddress = new Map<number, number>();
  const addressToLine = new Map<number, number>();
  const claim = (address: number, line: number): boolean => {
    if (owner.has(address)) {
      error(line, `El código se superpone en ${hex(address & 0xffff, 4)}h (ya usada por la línea ${owner.get(address)})`);
      return false;
    }
    owner.set(address, line);
    return true;
  };
  type Block = { line: number; address: number; row?: ListingRow; size: number };
  const blocks: Block[] = [
    ...rows.map((r) => ({ line: r.line, address: r.address, row: r, size: r.bytes.length })),
    ...reserved,
  ];
  // Orden de aparición en el fuente: el que llega después es el que se superpone.
  blocks.sort((a, b) => a.line - b.line);
  let start = Infinity;
  let end = -Infinity;
  for (const b of blocks) {
    for (let i = 0; i < b.size; i++) {
      const addr = b.address + i;
      if (addr > 0xffff || !claim(addr, b.line)) break;
      if (b.row) {
        memory.set(addr, b.row.bytes[i]!);
        start = Math.min(start, addr);
        end = Math.max(end, addr);
      }
    }
    if (b.row && b.row.bytes.length > 0) {
      if (!lineToAddress.has(b.line)) lineToAddress.set(b.line, b.address);
      addressToLine.set(b.address, b.line);
    }
  }
  rows.sort((a, b) => a.address - b.address);
  const empty = start === Infinity;

  return {
    ok: !messages.some((m) => m.severity === 'error'),
    messages: messages.sort((a, b) => a.line - b.line),
    rows,
    memory: new Map([...memory].sort((a, b) => a[0] - b[0])),
    symbols,
    lineToAddress,
    addressToLine,
    start: empty ? origin : start,
    end: empty ? origin : end,
    sizeBytes: memory.size,
  };
}
