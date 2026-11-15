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
 * Las etiquetas definidas en el cuerpo son locales a cada expansión (LOOP → LOOP@n).
 */
export function expandMacros(lines: SourceLine[]): { lines: ExpandedLine[]; messages: AsmMessage[] } {
  const macros = new Map<string, MacroDef>();
  const out: ExpandedLine[] = [];
  const messages: AsmMessage[] = [];
  const error = (line: number, message: string) => messages.push({ line, severity: 'error', message });
  let expansionCount = 0;

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
    // La etiqueta de la llamada va en una línea propia, antes de la expansión.
    if (call.label) out.push({ line: callLine, label: call.label, args: [], raw: call.raw });

    const body = def.body.map((raw) => {
      const l: ExpandedLine = lexLine(substitute(raw, def.params, call.args), callLine);
      delete l.comment;
      return l;
    });
    // Etiquetas locales: las definidas en el cuerpo se renombran por expansión (LOOP → LOOP@n).
    const n = ++expansionCount;
    const local = new Map<string, string>();
    for (const l of body) if (l.label) local.set(l.label, `${l.label}@${n}`);
    for (const l of body) {
      if (l.label) l.label = local.get(l.label);
      l.args = l.args.map((a) => local.get(a) ?? a);
    }

    // El comentario de la llamada va sólo en la primera instrucción expandida.
    let comment = call.comment;
    for (const l of body) {
      if (l.op && macros.has(l.op)) {
        if (l.label) out.push({ line: callLine, label: l.label, args: [], raw: l.raw, fromMacro: def.name });
        delete l.label;
        if (comment !== undefined) { l.comment = comment; comment = undefined; }
        expandCall(l, macros.get(l.op)!, [...stack, def.name], callLine);
        continue;
      }
      if (!l.op && !l.label) continue;
      l.fromMacro = def.name;
      if (l.op && comment !== undefined) { l.comment = comment; comment = undefined; }
      out.push(l);
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
