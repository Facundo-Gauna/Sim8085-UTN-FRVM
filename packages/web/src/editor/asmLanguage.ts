/**
 * Resaltado de sintaxis del ensamblador 8085.
 *
 * `tokenizeLine` es pura y devuelve desplazamientos de carácter (el `lexLine`
 * del core no los da). Usa las mismas listas que el core: los mnemónicos
 * salen de `ISA` y las directivas de `DIRECTIVES`/`NAMED_DIRECTIVES`, y
 * aplica la misma regla de etiqueta que el lexer.
 *
 * `asmLanguage` es un ViewPlugin que marca cada token con la clase
 * `cm-asm-<tipo>`; los colores los pone `editorTheme`.
 */
import { ISA, DIRECTIVES, NAMED_DIRECTIVES } from '@sim8085/core';
import { RangeSetBuilder, type Extension } from '@codemirror/state';
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';

export type AsmTokenKind =
  | 'mnemonic'
  | 'register'
  | 'number'
  | 'label'
  | 'directive'
  | 'comment'
  | 'string'
  | 'text';

export interface AsmToken {
  from: number;
  to: number;
  kind: AsmTokenKind;
}

const MNEMONICS = new Set(ISA.map((d) => d.mnemonic));
const DIRECTIVE_SET = new Set(DIRECTIVES);
/** Saltos y llamadas con dirección (JMP, Jcc, CALL, Ccc): su operando es una etiqueta. */
const JUMPS = new Set(
  ISA.filter((d) => d.operands.includes('addr') && /^[JC]/.test(d.mnemonic)).map((d) => d.mnemonic),
);
const REGISTERS = new Set(['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'SP', 'PSW']);

type Lexeme = { from: number; to: number; type: 'word' | 'num' | 'string' | 'punct' | 'comment' };

/** Corta la línea en palabras, números, cadenas, puntuación y comentario; omite los blancos. */
function lex(text: string): Lexeme[] {
  const out: Lexeme[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === ';') {
      out.push({ from: i, to: text.length, type: 'comment' });
      break;
    } else if (ch === "'") {
      // Una cadena sin cerrar llega hasta el final de la línea (y su `;` no es comentario).
      const end = text.indexOf("'", i + 1);
      const to = end < 0 ? text.length : end + 1;
      out.push({ from: i, to, type: 'string' });
      i = to;
    } else if (/[A-Za-z0-9_]/.test(ch)) {
      let j = i + 1;
      while (j < text.length && /[A-Za-z0-9_]/.test(text[j]!)) j++;
      out.push({ from: i, to: j, type: /[0-9]/.test(ch) ? 'num' : 'word' });
      i = j;
    } else {
      out.push({ from: i, to: i + 1, type: 'punct' });
      i++;
    }
  }
  return out;
}

/**
 * Tokens de una línea, en orden y sin solaparse. El espacio en blanco se
 * omite (no produce token); la puntuación y los símbolos sin color son `text`.
 * Sin distinguir mayúsculas. Reglas de etiqueta (las del lexer del core):
 *  1. `nombre:` al inicio de la línea (el span incluye los dos puntos).
 *  2. Sin `:`, un primer nombre que no es mnemónico/directiva seguido de
 *     EQU, MACRO, DB, DW o DS.
 *  3. El operando con nombre de JMP/Jcc/CALL/Ccc.
 */
export function tokenizeLine(text: string): AsmToken[] {
  const lx = lex(text);
  const word = (k: number) => (lx[k]?.type === 'word' ? text.slice(lx[k]!.from, lx[k]!.to).toUpperCase() : null);
  const out: AsmToken[] = [];
  let k = 0;

  const first = word(0);
  if (first !== null && lx[1]?.type === 'punct' && text[lx[1].from] === ':') {
    out.push({ from: lx[0]!.from, to: lx[1].to, kind: 'label' });
    k = 2;
  } else if (first !== null && !MNEMONICS.has(first) && !DIRECTIVE_SET.has(first) && NAMED_DIRECTIVES.has(word(1) ?? '')) {
    out.push({ from: lx[0]!.from, to: lx[0]!.to, kind: 'label' });
    k = 1;
  }

  let op: string | null = null;
  const opWord = word(k);
  if (opWord !== null) {
    op = opWord;
    const kind: AsmTokenKind = MNEMONICS.has(op) ? 'mnemonic' : DIRECTIVE_SET.has(op) ? 'directive' : 'text';
    out.push({ from: lx[k]!.from, to: lx[k]!.to, kind });
    k++;
  }
  const isMnemonic = op !== null && MNEMONICS.has(op);
  const isJump = op !== null && JUMPS.has(op);

  for (; k < lx.length; k++) {
    const l = lx[k]!;
    let kind: AsmTokenKind;
    switch (l.type) {
      case 'comment': kind = 'comment'; break;
      case 'string': kind = 'string'; break;
      case 'punct': kind = 'text'; break;
      case 'num': kind = 'number'; break;
      case 'word': {
        const w = text.slice(l.from, l.to).toUpperCase();
        // Un número siempre empieza con dígito: `A1H` es un símbolo (el ensamblador
        // sugiere 0A1H). Tras un salto, el nombre es la etiqueta de destino.
        if (isJump) kind = 'label';
        else if (isMnemonic && REGISTERS.has(w)) kind = 'register';
        else kind = 'text';
        break;
      }
    }
    out.push({ from: l.from, to: l.to, kind });
  }
  return out;
}

const marks = Object.fromEntries(
  (['mnemonic', 'register', 'number', 'label', 'directive', 'comment', 'string'] as const).map((k) => [
    k,
    Decoration.mark({ class: `cm-asm-${k}` }),
  ]),
) as Record<Exclude<AsmTokenKind, 'text'>, Decoration>;

function decorate(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const { doc } = view.state;
  let done = -1; // última línea ya marcada (dos rangos visibles pueden compartir una)
  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = doc.lineAt(pos);
      pos = line.to + 1;
      if (line.number <= done) continue;
      done = line.number;
      for (const t of tokenizeLine(line.text)) {
        if (t.kind !== 'text') builder.add(line.from + t.from, line.from + t.to, marks[t.kind]);
      }
    }
  }
  return builder.finish();
}

/** Resaltado del 8085: marca los tokens de las líneas visibles. */
export const asmLanguage: Extension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = decorate(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = decorate(u.view);
    }
  },
  { decorations: (p) => p.decorations },
);
