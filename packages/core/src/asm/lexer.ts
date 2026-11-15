import { ISA } from '../isa/table';

export interface SourceLine {
  line: number;
  label?: string;
  op?: string;
  args: string[];
  comment?: string;
  raw: string;
}

const DIRECTIVES = ['ORG', 'EQU', 'DB', 'DW', 'DS', 'END', 'MACRO', 'ENDM'];
/** Nombres que el lexer reconoce como mnemónico o directiva. */
const KNOWN = new Set<string>([...ISA.map((d) => d.mnemonic), ...DIRECTIVES]);
/** Directivas que admiten un nombre sin `:` delante (`DATO EQU 40H`). */
const NAMED_DIRECTIVES = new Set(['EQU', 'MACRO', 'DB', 'DW', 'DS']);

/** Parte `s` en el primer `;` fuera de comillas. */
function splitComment(s: string): [string, string | undefined] {
  let quote = false;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "'") quote = !quote;
    else if (s[i] === ';' && !quote) return [s.slice(0, i), s.slice(i + 1).trim()];
  }
  return [s, undefined];
}

/** Mayúsculas y sin espacios, salvo dentro de comillas simples. */
function normalize(s: string): string {
  let out = '';
  let quote = false;
  for (const ch of s) {
    if (ch === "'") { quote = !quote; out += ch; }
    else if (quote) out += ch;
    else if (!/\s/.test(ch)) out += ch.toUpperCase();
  }
  return out;
}

/** Separa por comas fuera de comillas. */
function splitArgs(s: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quote = false;
  for (const ch of s) {
    if (ch === "'") quote = !quote;
    if (ch === ',' && !quote) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts.map(normalize).filter((p) => p !== '');
}

/**
 * Descompone una línea. Reglas de etiqueta:
 *  1. `identificador:` al inicio de línea es etiqueta.
 *  2. Sin `:`, si el primer token NO es mnemónico/directiva conocido y el
 *     segundo es EQU, MACRO, DB, DW o DS, el primero es etiqueta/nombre.
 * Todo va en mayúsculas salvo el texto entre comillas simples.
 */
export function lexLine(raw: string, line: number): SourceLine {
  const [code, comment] = splitComment(raw);
  const result: SourceLine = { line, args: [], raw };
  let rest = code.trim();

  const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(rest);
  if (m) {
    result.label = (m[1] ?? '').toUpperCase();
    rest = rest.slice(m[0].length).trim();
  }

  // [\s\S] y no `.`: un `\r` suelto en la línea no debe hacer fallar el patrón.
  let om = /^(\S+)\s*([\s\S]*)$/.exec(rest);
  if (om && !result.label) {
    const first = (om[1] ?? '').toUpperCase();
    const om2 = /^(\S+)\s*([\s\S]*)$/.exec(om[2] ?? '');
    if (!KNOWN.has(first) && /^[A-Z_][A-Z0-9_]*$/.test(first) && om2 && NAMED_DIRECTIVES.has((om2[1] ?? '').toUpperCase())) {
      result.label = first;
      om = om2;
    }
  }
  if (om) {
    result.op = (om[1] ?? '').toUpperCase();
    result.args = splitArgs(om[2] ?? '');
  }
  if (comment !== undefined) result.comment = comment;
  return result;
}
