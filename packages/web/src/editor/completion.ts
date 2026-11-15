/**
 * Autocompletado del 8085.
 *
 * `completionsFor` es pura: decide qué ofrecer según lo que hay antes del
 * cursor. En la posición de operación (nada antes salvo `ETIQUETA:` y blancos)
 * ofrece mnemónicos (detalle = `summary` del ISA) y directivas (marcadas fuera
 * de la cátedra); en la de operando, los registros válidos para ese mnemónico.
 * Sin distinguir mayúsculas; las etiquetas siguen la caja que se escribe.
 *
 * `asmCompletion` es la extensión de CodeMirror que la usa.
 */
import { ISA, DIRECTIVES, NAMED_DIRECTIVES } from '@sim8085/core';
import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from '@codemirror/autocomplete';
import type { Extension } from '@codemirror/state';

export interface AsmCompletion {
  label: string;
  detail: string;
  fueraDeCatedra: boolean;
}

/** Una línea por directiva (no son de la cátedra: van marcadas). */
export const DIRECTIVE_HELP: Readonly<Record<string, string>> = {
  ORG: 'Fija la dirección de inicio',
  EQU: 'Define una constante con nombre',
  DB: 'Reserva bytes con valores',
  DW: 'Reserva palabras de 16 bits',
  DS: 'Reserva espacio sin valor',
  END: 'Fin del programa',
  MACRO: 'Define una macro',
  ENDM: 'Cierra una macro',
};

/** Primer `summary` de cada mnemónico, en el orden del ISA. */
const MNEMONIC_SUMMARY: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const d of ISA) if (!m.has(d.mnemonic)) m.set(d.mnemonic, d.summary);
  return m;
})();

const SINGLE = ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M'];
const PAIRS = ['B', 'D', 'H', 'SP'];
const PAIRS_PUSH = ['B', 'D', 'H', 'PSW'];
const PAIRS_BD = ['B', 'D'];

/** Registros válidos para el operando `index` (0 = primero) de cada mnemónico. */
function registersFor(mnemonic: string, index: number): string[] {
  switch (mnemonic) {
    case 'MOV':
      return index <= 1 ? SINGLE : [];
    case 'MVI':
      return index === 0 ? SINGLE : [];
    case 'ADD': case 'ADC': case 'SUB': case 'SBB': case 'ANA':
    case 'XRA': case 'ORA': case 'CMP': case 'INR': case 'DCR':
      return index === 0 ? SINGLE : [];
    case 'LXI': case 'DAD': case 'INX': case 'DCX':
      return index === 0 ? PAIRS : [];
    case 'PUSH': case 'POP':
      return index === 0 ? PAIRS_PUSH : [];
    case 'LDAX': case 'STAX':
      return index === 0 ? PAIRS_BD : [];
    default:
      return [];
  }
}

const OP_POSITION = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*\s*:)?\s*$/;
const OPERAND_POSITION = /^\s*(?:[A-Za-z_][A-Za-z0-9_]*\s*:)?\s*([A-Za-z_][A-Za-z0-9_]*)\s+(.*)$/;

/** Devuelve `s` en minúsculas si el alumno escribe en minúsculas. */
const caseLike = (prefix: string) => {
  const lower = /[a-z]/.test(prefix) && prefix === prefix.toLowerCase();
  return (s: string) => (lower ? s.toLowerCase() : s);
};

export function completionsFor(prefix: string, lineBeforeCursor: string): AsmCompletion[] {
  // Nada dentro de un comentario (un `;` entre comillas no cuenta, como en el lexer).
  let quote = false;
  for (const ch of lineBeforeCursor) {
    if (ch === "'") quote = !quote;
    else if (ch === ';' && !quote) return [];
  }
  if (quote) return [];

  const up = prefix.toUpperCase();
  const cased = caseLike(prefix);
  const matches = (label: string) => label.startsWith(up);

  if (OP_POSITION.test(lineBeforeCursor)) {
    // Primero los que empiezan con lo escrito; después los de la misma inicial
    // (con `MO` también aparece `MVI`: ayuda a quien no recuerda el nombre exacto).
    const exact: AsmCompletion[] = [];
    const near: AsmCompletion[] = [];
    const add = (label: string, detail: string, fueraDeCatedra: boolean) => {
      if (matches(label)) exact.push({ label: cased(label), detail, fueraDeCatedra });
      else if (label.startsWith(up.slice(0, 1))) near.push({ label: cased(label), detail, fueraDeCatedra });
    };
    for (const [m, summary] of MNEMONIC_SUMMARY) add(m, summary, false);
    for (const d of DIRECTIVES) add(d, DIRECTIVE_HELP[d] ?? '', true);
    return [...exact, ...near];
  }

  const m = OPERAND_POSITION.exec(lineBeforeCursor);
  if (!m) return [];
  const op = m[1]!.toUpperCase();
  const operands = m[2]!;

  // `DATO ` (un nombre que no es mnemónico ni directiva): EQU, DB, DW, DS, MACRO.
  if (!MNEMONIC_SUMMARY.has(op) && !DIRECTIVES.includes(op) && operands.trim() === '') {
    return [...NAMED_DIRECTIVES]
      .filter(matches)
      .map((d) => ({ label: cased(d), detail: DIRECTIVE_HELP[d] ?? '', fueraDeCatedra: true }));
  }

  // Los registros conservan mayúsculas salvo que se escriba en minúsculas.
  const index = (operands.match(/,/g) ?? []).length;
  return registersFor(op, index)
    .filter(matches)
    .map((r) => ({ label: cased(r), detail: '', fueraDeCatedra: false }));
}

type SimCompletion = Completion & { fueraDeCatedra?: boolean };

/** Fuente de CodeMirror: palabra antes del cursor + texto de la línea anterior a ella. */
function source(context: CompletionContext): CompletionResult | null {
  const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
  const from = word ? word.from : context.pos;
  const line = context.state.doc.lineAt(context.pos);
  const before = context.state.sliceDoc(line.from, from);
  // Sin palabra empezada solo se abre a pedido (Ctrl-Espacio) o tras una coma.
  if (!word && !context.explicit && !/,\s*$/.test(before)) return null;
  const items = completionsFor(word?.text ?? '', before);
  if (items.length === 0) return null;
  return {
    from,
    options: items.map(
      (c): SimCompletion => ({
        label: c.label,
        detail: c.detail || undefined,
        type: c.fueraDeCatedra ? 'keyword' : c.detail ? 'function' : 'variable',
        fueraDeCatedra: c.fueraDeCatedra,
      }),
    ),
    // El orden y el filtro son los de completionsFor (se vuelve a consultar en cada tecla).
    filter: false,
  };
}

/** Etiqueta `FUERA DE CÁTEDRA` en las opciones que no son de la cátedra. */
function fueraBadge(c: SimCompletion): Node | null {
  if (!c.fueraDeCatedra) return null;
  const el = document.createElement('span');
  el.className = 'sim-fuera-label';
  el.textContent = 'FUERA DE CÁTEDRA';
  return el;
}

export const asmCompletion: Extension = autocompletion({
  override: [source],
  icons: false,
  optionClass: (c) => ((c as SimCompletion).fueraDeCatedra ? 'sim-option-fuera' : ''),
  addToOptions: [{ render: (c) => fueraBadge(c as SimCompletion), position: 90 }],
});
