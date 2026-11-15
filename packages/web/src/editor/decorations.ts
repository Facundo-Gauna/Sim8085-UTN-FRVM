/**
 * Marcas de depuración del editor: línea actual, puntos de corte, errores y
 * advertencias del ensamblado, y el contador de comentarios largos.
 *
 * `lineDecorations` es pura: arma la lista de marcas por línea. El editor la
 * alimenta con `setDecorations` (lo que viene de la sesión) y la recalcula
 * también en cada cambio del texto, porque el contador de comentario sale del
 * texto en vivo (no depende de ensamblar). Con `stale` (el texto cambió tras
 * ensamblar) se ocultan la línea actual, los puntos de corte y los mensajes.
 *
 * El estado vive en un StateField: reconfigurar no recrea la vista (se
 * conservan el historial de deshacer y el cursor).
 */
import type { AsmMessage } from '@sim8085/core';
import { RangeSetBuilder, StateEffect, StateField, type EditorState, type Extension, type Text } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import { externalSync } from './sync';

/** Largo máximo de un comentario (la misma regla que el ensamblador). */
export const MAX_COMMENT = 80;

export type DecorationSpec =
  | { kind: 'current'; line: number }
  | { kind: 'breakpoint'; line: number }
  | { kind: 'error'; line: number; message: string }
  | { kind: 'warning'; line: number; message: string }
  | { kind: 'commentCount'; line: number; text: string };

export interface LineDecorationArgs {
  asmMessages: AsmMessage[];
  currentLine: number | null;
  breakpointLines: Set<number>;
  stale: boolean;
  commentLen: (line: number) => number;
  /** Líneas del documento: acota todo lo demás (agregado a la interfaz del brief). */
  lineCount: number;
}

export function lineDecorations(args: LineDecorationArgs): DecorationSpec[] {
  const { lineCount } = args;
  const inDoc = (l: number) => Number.isInteger(l) && l >= 1 && l <= lineCount;
  const out: DecorationSpec[] = [];

  if (!args.stale) {
    if (args.currentLine !== null && inDoc(args.currentLine)) out.push({ kind: 'current', line: args.currentLine });
    for (const l of [...args.breakpointLines].sort((a, b) => a - b)) {
      if (inDoc(l)) out.push({ kind: 'breakpoint', line: l });
    }
    // Un mensaje por línea y severidad: si hay varios, se juntan en el tooltip.
    const grouped = new Map<string, { kind: 'error' | 'warning'; line: number; messages: string[] }>();
    for (const m of args.asmMessages) {
      if (!inDoc(m.line)) continue;
      const k = `${m.severity}:${m.line}`;
      const g = grouped.get(k) ?? { kind: m.severity, line: m.line, messages: [] };
      g.messages.push(m.message);
      grouped.set(k, g);
    }
    for (const g of grouped.values()) out.push({ kind: g.kind, line: g.line, message: g.messages.join('\n') });
  }

  for (let l = 1; l <= lineCount; l++) {
    const len = args.commentLen(l);
    if (len > MAX_COMMENT) out.push({ kind: 'commentCount', line: l, text: `${len}/${MAX_COMMENT}` });
  }
  return out;
}

/** Posición del `;` que abre el comentario (fuera de comillas, como el lexer del core), o -1. */
export function commentStart(text: string): number {
  let quote = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "'") quote = !quote;
    else if (text[i] === ';' && !quote) return i;
  }
  return -1;
}

/** Largo del comentario de la línea, sin el `;` y sin blancos en los extremos. */
export function commentLength(text: string): number {
  const i = commentStart(text);
  return i < 0 ? 0 : text.slice(i + 1).trim().length;
}

// ---------------------------------------------------------------------------
// CodeMirror
// ---------------------------------------------------------------------------

/** Lo que llega de la sesión. */
export interface SessionMarks {
  asmMessages: AsmMessage[];
  currentLine: number | null;
  breakpointLines: Set<number>;
  stale: boolean;
}

export const NO_MARKS: SessionMarks = { asmMessages: [], currentLine: null, breakpointLines: new Set(), stale: false };

/** El Editor lo despacha cuando cambia la sesión (versión, stale, puntos de corte, ensamblado). */
export const setDecorations = StateEffect.define<SessionMarks>();

interface MarksState {
  marks: SessionMarks;
  specs: DecorationSpec[];
  decorations: DecorationSet;
}

class CommentCountWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }
  eq(other: CommentCountWidget) {
    return other.text === this.text;
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-sim-count';
    const [len] = this.text.split('/');
    el.title = `El comentario tiene ${len} caracteres (máximo ${MAX_COMMENT})`;
    el.setAttribute('aria-label', el.title);
    const icon = document.createElement('span');
    icon.className = 'cm-sim-count-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⚠';
    el.append(icon, ` ${this.text}`);
    return el;
  }
  ignoreEvent() {
    return false;
  }
}

const currentLineDeco = Decoration.line({ class: 'cm-sim-current' });

/** Desde el primer carácter de código hasta antes del comentario (o la línea entera si no hay código). */
function codeRange(text: string): [number, number] {
  const c = commentStart(text);
  const code = c < 0 ? text : text.slice(0, c);
  const start = code.length - code.trimStart().length;
  const end = code.trimEnd().length;
  return end > start ? [start, end] : [0, text.length];
}

function build(doc: Text, specs: DecorationSpec[]): DecorationSet {
  const items: { from: number; to: number; deco: Decoration }[] = [];
  for (const s of specs) {
    const line = doc.line(s.line);
    switch (s.kind) {
      case 'current':
        items.push({ from: line.from, to: line.from, deco: currentLineDeco });
        break;
      case 'error':
      case 'warning': {
        const [a, b] = codeRange(line.text);
        if (b <= a) break; // línea vacía: no hay qué subrayar
        items.push({
          from: line.from + a,
          to: line.from + b,
          deco: Decoration.mark({
            class: s.kind === 'error' ? 'cm-sim-error' : 'cm-sim-warning',
            attributes: { title: s.message },
          }),
        });
        break;
      }
      case 'commentCount':
        items.push({ from: line.to, to: line.to, deco: Decoration.widget({ widget: new CommentCountWidget(s.text), side: 1 }) });
        break;
      case 'breakpoint':
        break; // va en el margen (breakpoints.ts)
    }
  }
  // RangeSetBuilder pide orden por posición y lado de inicio.
  items.sort((x, y) => x.from - y.from || x.deco.startSide - y.deco.startSide);
  const builder = new RangeSetBuilder<Decoration>();
  for (const it of items) builder.add(it.from, it.to, it.deco);
  return builder.finish();
}

function compute(state: { doc: Text }, marks: SessionMarks): MarksState {
  const { doc } = state;
  const specs = lineDecorations({
    ...marks,
    lineCount: doc.lines,
    commentLen: (l) => commentLength(doc.line(l).text),
  });
  return { marks, specs, decorations: build(doc, specs) };
}

export const marksField = StateField.define<MarksState>({
  create: (state) => compute(state, NO_MARKS),
  update(value, tr) {
    let marks = value.marks;
    for (const e of tr.effects) if (e.is(setDecorations)) marks = e.value;
    // Un cambio del usuario deja el ensamblado viejo: se oculta ya, sin esperar a la sesión.
    if (tr.docChanged && !tr.annotation(externalSync) && !marks.stale) marks = { ...marks, stale: true };
    if (marks === value.marks && !tr.docChanged) return value;
    return compute(tr.state, marks);
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.decorations),
});

/** Marcas que el editor muestra ahora (para pruebas y para el margen). */
export function decorationSpecs(state: EditorState): DecorationSpec[] {
  return state.field(marksField, false)?.specs ?? [];
}

export const debugDecorations: Extension = marksField;
