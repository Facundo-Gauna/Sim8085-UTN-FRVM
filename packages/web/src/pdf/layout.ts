/**
 * Maquetación pura de las hojas de entrega (spec §6.8): convierte filas del
 * ensamblado o de la traza en páginas. No depende del PDF: la vista previa y el
 * renderizador usan este mismo resultado.
 */
import type { ListingRow, TraceRow } from '@sim8085/core';

export const ROWS_PER_PAGE = 44;
export const OBS_MAX = 80;
export type Measure = (text: string) => number;

export interface Header { student: string; exercise: string; sheetStart: number; date: string }
export interface AsmLine { address: string; mnemonic: string; opcode: string; obs: string[]; tall: boolean }
export interface AsmPage { sheet: number; lines: AsmLine[] }
export interface AsmLayout { pages: AsmPage[]; truncated: { line: number; chars: number }[] }
export interface TraceLine { n: string; pos: string; val: string; regs: string[]; flags: string[] }
export interface TracePage { sheet: number; lines: TraceLine[] }

// Caracteres fuera de Latin-1 que sí existen en WinAnsi (la codificación de Helvetica).
const WIN_ANSI_EXTRA = new Set([0x20ac, 0x2026, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x2122]);
const REPLACEMENTS: Record<string, string> = { '←': '<-', '↔': '<->', '→': '->', '\t': ' ', '\n': ' ', '\r': ' ' };

/** Deja solo texto que Helvetica puede codificar; nunca lanza. */
export function pdfSafe(text: string): string {
  let out = '';
  for (const ch of text) {
    const rep = REPLACEMENTS[ch];
    const cp = ch.codePointAt(0)!;
    if (rep !== undefined) out += rep;
    else if ((cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || WIN_ANSI_EXTRA.has(cp)) out += ch;
    else out += '?';
  }
  return out;
}

export function safeFileName(exercise: string, suffix: 'assembler' | 'registros'): string {
  // eslint-disable-next-line no-control-regex
  const clean = exercise.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '').trim();
  return `${clean === '' ? 'programa' : clean}-${suffix}.pdf`;
}

/** Recorta con `...` hasta que el texto entre en `width`. */
export function fitText(text: string, width: number, measure: Measure): string {
  if (measure(text) <= width) return text;
  let t = text;
  while (t.length > 0 && measure(t + '...') > width) t = t.slice(0, -1);
  return t + '...';
}

/** Ajuste por palabras; una palabra más ancha que el renglón se corta por ancho. */
function wrap(text: string, width: number, measure: Measure): string[] {
  const lines: string[] = [];
  let cur = '';
  const push = (s: string) => lines.push(s);
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur === '' ? word : `${cur} ${word}`;
    if (measure(next) <= width) {
      cur = next;
      continue;
    }
    if (cur !== '') push(cur);
    cur = '';
    let rest = word;
    while (measure(rest) > width) {
      let k = rest.length - 1;
      while (k > 1 && measure(rest.slice(0, k)) > width) k--;
      push(rest.slice(0, k));
      rest = rest.slice(k);
    }
    cur = rest;
  }
  if (cur !== '') push(cur);
  return lines;
}

const hex = (n: number, d: number) => n.toString(16).toUpperCase().padStart(d, '0');

export function layoutAssembler(rows: ListingRow[], measure: Measure, obsWidth: number): AsmLayout {
  const lines: AsmLine[] = [];
  const truncated: { line: number; chars: number }[] = [];
  for (const row of rows) {
    let comment = (row.comment ?? '').trim();
    let cut = false;
    if (comment.length > OBS_MAX) {
      truncated.push({ line: row.line, chars: comment.length });
      comment = comment.slice(0, OBS_MAX - 3) + '...';
      cut = true;
    }
    let obs = wrap(comment, obsWidth, measure);
    if (obs.length > 2) {
      obs = [obs[0]!, fitText(obs.slice(1).join(' '), obsWidth, measure)];
      if (!cut) truncated.push({ line: row.line, chars: comment.length });
    }
    row.bytes.forEach((byte, i) => {
      lines.push({
        address: `${hex((row.address + i) & 0xffff, 4)}h`,
        mnemonic: i === 0 ? row.source : '',
        opcode: hex(byte, 2),
        obs: [],
        tall: false,
      });
    });
    const first = lines.length - row.bytes.length;
    if (obs.length > 0 && first < lines.length) {
      lines[first]!.obs = [obs[0]!];
      if (obs.length === 2) {
        if (row.bytes.length > 1) lines[first + 1]!.obs = [obs[1]!];
        else {
          lines[first]!.obs = obs;
          lines[first]!.tall = true;
        }
      }
    }
  }
  const pages: AsmPage[] = [{ sheet: 1, lines: [] }];
  let used = 0;
  for (const line of lines) {
    const h = line.tall ? 2 : 1;
    if (used + h > ROWS_PER_PAGE) {
      pages.push({ sheet: pages.length + 1, lines: [] });
      used = 0;
    }
    pages[pages.length - 1]!.lines.push(line);
    used += h;
  }
  return { pages, truncated };
}

export function layoutTrace(rows: TraceRow[]): TracePage[] {
  const pages: TracePage[] = [{ sheet: 1, lines: [] }];
  for (const r of rows) {
    if (pages[pages.length - 1]!.lines.length === ROWS_PER_PAGE) pages.push({ sheet: pages.length + 1, lines: [] });
    const hasMem = r.memAddr !== undefined;
    pages[pages.length - 1]!.lines.push({
      n: String(r.n),
      pos: hasMem ? `${hex(r.memAddr!, 4)}h` : '',
      val: hasMem ? `${hex(r.memValue!, 2)}h` : '',
      regs: [r.A, r.B, r.C, r.D, r.E, r.H, r.L, r.M].map((v) => hex(v, 2)),
      flags: [r.Z, r.P, r.S, r.CY].map(String),
    });
  }
  return pages;
}
