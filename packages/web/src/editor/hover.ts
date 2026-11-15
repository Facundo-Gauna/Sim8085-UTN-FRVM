/**
 * Ayuda al pasar el mouse sobre mnemónicos, directivas y registros.
 *
 * `hoverInfo` es pura: con la palabra y la línea completa devuelve el título
 * (formas del mnemónico), la descripción, los bytes y estados T de la forma
 * que se usa en la línea, y las banderas. Las directivas van marcadas fuera de
 * la cátedra (borde punteado + etiqueta, MASTER.md §5.4).
 *
 * `asmHover` es la extensión de CodeMirror que la muestra; solo reacciona
 * sobre tokens de mnemónico, directiva o registro (no en comentarios).
 */
import { ISA, DIRECTIVES, type InstrDef } from '@sim8085/core';
import { hoverTooltip, type EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { DIRECTIVE_HELP } from './completion';
import { tokenizeLine } from './asmLanguage';

export interface HoverInfo {
  title: string;
  body: string;
  flags: string[];
  bytes: number;
  tStates: string;
  fueraDeCatedra: boolean;
}

const BY_MNEMONIC: ReadonlyMap<string, InstrDef[]> = (() => {
  const m = new Map<string, InstrDef[]>();
  for (const d of ISA) m.set(d.mnemonic, [...(m.get(d.mnemonic) ?? []), d]);
  return m;
})();

/** Mnemónicos cuyo operando B/D/H/SP es un par de registros. */
const PAIR_OPS = new Set(['LXI', 'DAD', 'INX', 'DCX', 'PUSH', 'POP', 'LDAX', 'STAX']);
const SINGLE = new Set(['A', 'B', 'C', 'D', 'E', 'H', 'L']);
const PLACEHOLDERS = new Set(['d8', 'd16', 'addr', 'port']);

/** Operando concreto → forma genérica: `A` → `r`, `B` (en LXI) → `rp`, `3` (RST) → `n`. */
function generic(mnemonic: string, operand: string): string {
  if (PAIR_OPS.has(mnemonic) && ['B', 'D', 'H', 'SP'].includes(operand)) return 'rp';
  if (SINGLE.has(operand)) return 'r';
  if (/^[0-7]$/.test(operand)) return 'n';
  return operand;
}

function formsOf(mnemonic: string, defs: InstrDef[]): string {
  const forms: string[] = [];
  for (const d of defs) {
    const f = [mnemonic, d.operands.map((o) => generic(mnemonic, o)).join(',')].filter(Boolean).join(' ');
    if (!forms.includes(f)) forms.push(f);
  }
  return forms.join(' / ');
}

/** Operandos escritos en la línea después del mnemónico (en mayúsculas, sin comentario). */
function operandsInLine(mnemonic: string, lineText: string): string[] {
  const code = lineText.split(';')[0] ?? '';
  const m = new RegExp(`(?:^|[\\s:])${mnemonic}\\b(.*)$`, 'i').exec(code);
  if (!m) return [];
  return m[1]!
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s !== '');
}

/** La forma usada en la línea: los registros deben coincidir, los valores aceptan cualquier cosa. */
function pickForm(mnemonic: string, defs: InstrDef[], lineText: string): InstrDef {
  const ops = operandsInLine(mnemonic, lineText);
  const match = defs.find(
    (d) => d.operands.length === ops.length && d.operands.every((o, i) => PLACEHOLDERS.has(o) || o === ops[i]),
  );
  return match ?? defs[0]!;
}

const REGISTER_HELP: Readonly<Record<string, string>> = {
  A: 'Acumulador',
  B: 'Registro B (byte alto del par BC)',
  C: 'Registro C (byte bajo del par BC)',
  D: 'Registro D (byte alto del par DE)',
  E: 'Registro E (byte bajo del par DE)',
  H: 'Registro H (byte alto del par HL)',
  L: 'Registro L (byte bajo del par HL)',
  M: 'Memoria apuntada por HL',
  SP: 'Puntero de pila',
  PSW: 'Acumulador y banderas',
};
const PAIR_HELP: Readonly<Record<string, string>> = {
  B: 'Par BC (registros B y C)',
  D: 'Par DE (registros D y E)',
  H: 'Par HL (registros H y L)',
};

export function hoverInfo(word: string, lineText: string): HoverInfo | null {
  const w = word.toUpperCase();
  if (w === '') return null;

  const defs = BY_MNEMONIC.get(w);
  if (defs) {
    const d = pickForm(w, defs, lineText);
    return {
      title: formsOf(w, defs),
      body: d.summary,
      flags: [...d.flags],
      bytes: d.size,
      tStates: Array.isArray(d.tStates) ? `${d.tStates[0]} / ${d.tStates[1]}` : String(d.tStates),
      fueraDeCatedra: false,
    };
  }

  if (DIRECTIVES.includes(w)) {
    return { title: w, body: DIRECTIVE_HELP[w] ?? '', flags: [], bytes: 0, tStates: '', fueraDeCatedra: true };
  }

  const reg = REGISTER_HELP[w];
  if (reg) {
    const op = /^\s*(?:[A-Za-z_]\w*\s*:)?\s*([A-Za-z]+)/.exec(lineText)?.[1]?.toUpperCase() ?? '';
    const body = (PAIR_OPS.has(op) && PAIR_HELP[w]) || reg;
    return { title: w, body, flags: [], bytes: 0, tStates: '', fueraDeCatedra: false };
  }
  return null;
}

/** DOM del tooltip (clases bajo `.cm-tooltip.sim-hover`; colores en Editor.css con tokens). */
export function renderHover(info: HoverInfo): HTMLElement {
  const dom = document.createElement('div');
  dom.className = info.fueraDeCatedra ? 'sim-hover sim-hover--fuera' : 'sim-hover';
  const add = (tag: string, cls: string, text: string) => {
    const el = document.createElement(tag);
    el.className = cls;
    el.textContent = text;
    dom.appendChild(el);
    return el;
  };
  if (info.fueraDeCatedra) add('div', 'sim-fuera-label', 'FUERA DE CÁTEDRA');
  add('div', 'sim-hover-title', info.title);
  if (info.body) add('div', 'sim-hover-body', info.body);
  if (info.bytes > 0) {
    const flags = info.flags.length > 0 ? info.flags.join(' ') : 'ninguna';
    add('div', 'sim-hover-meta', `${info.bytes} ${info.bytes === 1 ? 'byte' : 'bytes'} · ${info.tStates} estados T · Banderas: ${flags}`);
  }
  return dom;
}

const HOVER_KINDS = new Set(['mnemonic', 'directive', 'register']);

export const asmHover: Extension = hoverTooltip((view: EditorView, pos: number) => {
  const line = view.state.doc.lineAt(pos);
  const col = pos - line.from;
  const tok = tokenizeLine(line.text).find((t) => t.from <= col && col <= t.to && HOVER_KINDS.has(t.kind));
  if (!tok) return null;
  const info = hoverInfo(line.text.slice(tok.from, tok.to), line.text);
  if (!info) return null;
  return {
    pos: line.from + tok.from,
    end: line.from + tok.to,
    above: true,
    create: () => ({ dom: renderHover(info) }),
  };
});
