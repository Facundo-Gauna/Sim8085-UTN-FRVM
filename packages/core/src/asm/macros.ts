import { lexLine, type SourceLine } from './lexer';

export interface AsmMessage {
  line: number;
  severity: 'error' | 'warning';
  message: string;
}

/** Línea lista para las pasadas: si viene de una macro, `line` es la de la llamada. */
export interface ExpandedLine extends SourceLine {
  fromMacro?: string;
}

interface MacroDef {
  name: string;
  params: string[];
  body: string[];
  line: number;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Sustituye cada parámetro por su argumento, sólo como palabra completa. */
function substitute(text: string, params: string[], args: string[]): string {
  let out = text;
  params.forEach((p, i) => {
    const re = new RegExp(`(?<![A-Za-z0-9_])${escapeRe(p)}(?![A-Za-z0-9_])`, 'gi');
    out = out.replace(re, () => args[i] ?? '');
  });
  return out;
}

/**
 * Pasada 0: separa las definiciones MACRO/ENDM y reemplaza cada llamada por su
 * cuerpo (sustitución textual de parámetros). Se detiene en `END`.
 * Las macros deben definirse antes de usarse; no se anidan ni son recursivas.
 */
export function expandMacros(lines: SourceLine[]): { lines: ExpandedLine[]; messages: AsmMessage[] } {
  const macros = new Map<string, MacroDef>();
  const out: ExpandedLine[] = [];
  const messages: AsmMessage[] = [];
  const error = (line: number, message: string) => messages.push({ line, severity: 'error', message });

  /** Expande una llamada; `stack` son las macros en curso (para detectar recursión). */
  function expandCall(call: SourceLine, def: MacroDef, stack: string[], callLine: number): void {
    if (stack.includes(def.name)) {
      error(callLine, `Error de recursión de macro: ${def.name} se llama a sí misma`);
      return;
    }
    if (call.args.length !== def.params.length) {
      error(callLine, `La macro ${def.name} necesita ${def.params.length} parámetro(s) y recibió ${call.args.length}`);
      return;
    }
    let first = true;
    const emit = (l: ExpandedLine) => {
      if (first) {
        if (call.label && !stack.length) l.label = call.label;
        if (call.comment !== undefined && !stack.length) l.comment = call.comment;
        first = false;
      }
      out.push(l);
    };
    for (const raw of def.body) {
      const l: ExpandedLine = lexLine(substitute(raw, def.params, call.args), callLine);
      delete l.comment;
      if (l.op && macros.has(l.op)) {
        if (l.label) emit({ line: callLine, label: l.label, args: [], raw: l.raw, fromMacro: def.name });
        expandCall(l, macros.get(l.op)!, [...stack, def.name], callLine);
        continue;
      }
      if (!l.op && !l.label) continue;
      l.fromMacro = def.name;
      emit(l);
    }
    if (first && (call.label || call.comment !== undefined) && !stack.length) {
      emit({ line: callLine, args: [], raw: call.raw });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.op === 'MACRO') {
      if (!l.label) {
        error(l.line, 'MACRO necesita un nombre: NOMBRE MACRO parámetros');
      }
      const def: MacroDef = { name: l.label ?? '', params: l.args, body: [], line: l.line };
      let closed = false;
      for (i++; i < lines.length; i++) {
        const b = lines[i]!;
        if (b.op === 'ENDM') { closed = true; break; }
        if (b.op === 'MACRO') error(b.line, 'Las macros no se pueden anidar');
        else def.body.push(b.raw);
      }
      if (!closed) error(def.line, `Falta ENDM para cerrar la macro ${def.name}`);
      if (def.name) {
        if (macros.has(def.name)) error(def.line, `La macro ${def.name} ya está definida`);
        else macros.set(def.name, def);
      }
      continue;
    }
    if (l.op === 'ENDM') { error(l.line, 'ENDM sin MACRO que lo abra'); continue; }
    const def = l.op ? macros.get(l.op) : undefined;
    if (def) { expandCall(l, def, [], l.line); continue; }
    out.push(l);
    if (l.op === 'END') break;
  }
  return { lines: out, messages };
}
