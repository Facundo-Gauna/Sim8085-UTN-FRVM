/** Renderizado de las hojas de entrega a PDF con pdf-lib: réplica de las plantillas de la cátedra. */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ListingRow, TraceRow } from '@sim8085/core';
import {
  ROWS_PER_PAGE, fitText, layoutAssembler, layoutTrace, pdfSafe,
  type AsmLayout, type Header,
} from './layout';

export interface RenderResult {
  bytes: Uint8Array;
  pages: number;
  truncatedObservations: { line: number; chars: number }[];
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 32;
const W = PAGE_W - MARGIN * 2;
const ROW_H = 15.5;
const FS = 9;
const PAD = 3;
const HEADER_H = 36;
const BLACK = rgb(0, 0, 0);

const ASM_COLS = [0.118, 0.316, 0.168, 0.398];
const TRACE_COLS = [0.17, 0.13, 0.07, ...Array<number>(8).fill(0.05), ...Array<number>(4).fill(0.0575)];

/** La `h` fija de la plantilla va en las filas sin posición; las demás ya llevan su propia `h`. */
export const showsFixedH = (l?: { pos: string }) => !l?.pos;

interface Ctx { page: PDFPage; font: PDFFont }

const cumulative = (fr: number[]) => {
  const xs = [MARGIN];
  for (const f of fr) xs.push(xs[xs.length - 1]! + f * W);
  return xs;
};

function line(c: Ctx, x1: number, y1: number, x2: number, y2: number, thickness = 0.5) {
  c.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: BLACK });
}

function text(c: Ctx, t: string, x: number, yTop: number, maxWidth: number, align: 'left' | 'center' | 'right' = 'left', rowH = ROW_H) {
  const s = fitText(pdfSafe(t), maxWidth - PAD * 2, (u) => c.font.widthOfTextAtSize(u, FS));
  const w = c.font.widthOfTextAtSize(s, FS);
  const dx = align === 'left' ? PAD : align === 'center' ? (maxWidth - w) / 2 : maxWidth - PAD - w;
  c.page.drawText(s, { x: x + dx, y: yTop - rowH / 2 - FS * 0.35, size: FS, font: c.font, color: BLACK });
}

/** Encabezado de la plantilla: 3 celdas con borde. Devuelve la y inferior. */
function drawHeader(c: Ctx, fr: number[], right: [string, string], h: Header): number {
  const top = PAGE_H - MARGIN;
  const xs = cumulative(fr);
  c.page.drawRectangle({ x: MARGIN, y: top - HEADER_H, width: W, height: HEADER_H, borderWidth: 0.7, borderColor: BLACK });
  line(c, xs[1]!, top, xs[1]!, top - HEADER_H, 0.7);
  line(c, xs[2]!, top, xs[2]!, top - HEADER_H, 0.7);
  text(c, 'ARQUITECTURA DE COMPUTADORAS', xs[0]!, top, xs[1]! - xs[0]!, 'left', HEADER_H);
  text(c, `Alumno: ${h.student}`, xs[1]!, top - 2, xs[2]! - xs[1]!, 'left', HEADER_H / 2 + 2);
  const wRight = xs[3]! - xs[2]!;
  text(c, right[0], xs[2]!, top, wRight, 'left', HEADER_H / 2);
  text(c, right[1], xs[2]!, top - HEADER_H / 2, wRight, 'left', HEADER_H / 2);
  return top - HEADER_H;
}

function newDoc(h: Header) {
  return PDFDocument.create().then(async (doc) => {
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.setTitle(pdfSafe(`${h.exercise} — ${h.student}`.trim()));
    doc.setCreator('Simulador 8085');
    return { doc, font };
  });
}

/** Maqueta del Assembler con la métrica real de Helvetica: la usan el PDF y la vista previa. */
export async function layoutAssemblerHelvetica(rows: ListingRow[]): Promise<AsmLayout> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  return assemblerLayoutWith(rows, font);
}

function assemblerLayoutWith(rows: ListingRow[], font: PDFFont): AsmLayout {
  const xs = cumulative(ASM_COLS);
  return layoutAssembler(rows, (t) => font.widthOfTextAtSize(pdfSafe(t), FS), xs[4]! - xs[3]! - PAD * 2);
}

export async function renderAssemblerPdf(rows: ListingRow[], h: Header): Promise<RenderResult> {
  const { doc, font } = await newDoc(h);
  const xs = cumulative(ASM_COLS);
  const { pages, truncated } = assemblerLayoutWith(rows, font);
  for (const p of pages) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const c = { page, font };
    const num = h.sheetStart + p.sheet - 1;
    const ex = fitText(pdfSafe(h.exercise), 140, (u) => font.widthOfTextAtSize(u, FS));
    let y = drawHeader(c, [0.377, 0.253, 0.37], [`Ejercicio: ${ex}`, `Hoja Nº: ${num}`], h);
    page.drawRectangle({ x: MARGIN, y: y - 8, width: W, height: 8, color: BLACK });
    y -= 8;
    ['Dirección', 'Mnemónico', 'OP.CODE', 'Observación'].forEach((t, i) =>
      text(c, t, xs[i]!, y, xs[i + 1]! - xs[i]!, i === 2 ? 'center' : 'left'));
    y -= ROW_H;
    line(c, MARGIN, y, MARGIN + W, y);
    const bodyTop = y;
    let units = 0;
    for (const l of p.lines) {
      const hh = l.tall ? 2 : 1;
      const rowTop = bodyTop - units * ROW_H;
      text(c, l.address, xs[0]!, rowTop, xs[1]! - xs[0]!, 'left', hh * ROW_H);
      text(c, l.mnemonic, xs[1]!, rowTop, xs[2]! - xs[1]!, 'left', hh * ROW_H);
      text(c, l.opcode, xs[2]!, rowTop, xs[3]! - xs[2]!, 'center', hh * ROW_H);
      l.obs.forEach((o, i) => text(c, o, xs[3]!, rowTop - i * ROW_H, xs[4]! - xs[3]!));
      units += hh;
      line(c, MARGIN, bodyTop - units * ROW_H, MARGIN + W, bodyTop - units * ROW_H);
    }
    for (; units < ROWS_PER_PAGE; ) {
      units++;
      line(c, MARGIN, bodyTop - units * ROW_H, MARGIN + W, bodyTop - units * ROW_H);
    }
    const bottom = bodyTop - ROWS_PER_PAGE * ROW_H;
    for (const x of xs) line(c, x, bodyTop + ROW_H, x, bottom);
  }
  return { bytes: await doc.save(), pages: pages.length, truncatedObservations: truncated };
}

export async function renderTracePdf(rows: TraceRow[], h: Header): Promise<RenderResult> {
  const { doc, font } = await newDoc(h);
  const pages = layoutTrace(rows);
  const xs = cumulative(TRACE_COLS);
  for (const p of pages) {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    const c = { page, font };
    const num = h.sheetStart + p.sheet - 1;
    let y = drawHeader(c, [0.38, 0.29, 0.33], [`Hoja N°: ${num}`, `Fecha: ${h.date}`], h);
    y -= 6;
    const top = y;
    const gridTop = top - ROW_H * 2;
    // Títulos (dos renglones): grupos arriba, letras abajo.
    const title = (t: string, from: number, to: number, row: 0 | 1) =>
      text(c, t, xs[from]!, top - row * ROW_H, xs[to]! - xs[from]!, 'center');
    page.drawRectangle({ x: MARGIN, y: gridTop, width: W, height: ROW_H * 2, borderWidth: 1.2, borderColor: BLACK });
    const two = (t: string, from: number) => {
      const lines = t.split('\n');
      lines.forEach((u, i) => text(c, u, xs[from]!, top - i * (ROW_H * 0.9), xs[from + 1]! - xs[from]!, 'center', ROW_H));
    };
    two('Posición de\nMemoria', 0);
    two('Valor en\nMemoria', 1);
    two('Ins.\nN°', 2);
    title('Registros', 3, 11, 0);
    title('Banderas', 11, 15, 0);
    ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'Z', 'P', 'S', 'CY'].forEach((t, i) => title(t, 3 + i, 4 + i, 1));
    line(c, xs[3]!, top - ROW_H, xs[15]!, top - ROW_H);
    for (let i = 1; i < 15; i++) if (i !== 3 && i !== 11) line(c, xs[i]!, top - ROW_H, xs[i]!, gridTop);
    for (const i of [3, 11]) line(c, xs[i]!, top, xs[i]!, gridTop, 1.2);
    p.lines.forEach((l, i) => {
      const rowTop = gridTop - i * ROW_H;
      text(c, l.pos, xs[0]!, rowTop, xs[1]! - xs[0]!, 'right');
      text(c, l.val, xs[1]!, rowTop, xs[2]! - xs[1]!, 'center');
      text(c, l.n, xs[2]!, rowTop, xs[3]! - xs[2]!, 'center');
      l.regs.forEach((v, k) => text(c, v, xs[3 + k]!, rowTop, xs[4 + k]! - xs[3 + k]!, 'center'));
      l.flags.forEach((v, k) => text(c, v, xs[11 + k]!, rowTop, xs[12 + k]! - xs[11 + k]!, 'center'));
    });
    for (let i = 0; i < ROWS_PER_PAGE; i++) {
      const rowTop = gridTop - i * ROW_H;
      line(c, MARGIN, rowTop - ROW_H, MARGIN + W, rowTop - ROW_H);
      // La `h` fija de la plantilla solo va en las filas sin posición (las demás ya llevan su `h`).
      if (showsFixedH(p.lines[i])) text(c, 'h', xs[0]!, rowTop, xs[1]! - xs[0]!, 'right');
    }
    const bottom = gridTop - ROWS_PER_PAGE * ROW_H;
    for (let i = 0; i < xs.length; i++) {
      const thick = i === 0 || i === 3 || i === 11 || i === 15;
      line(c, xs[i]!, gridTop, xs[i]!, bottom, thick ? 1.2 : 0.5);
    }
    page.drawRectangle({ x: MARGIN, y: bottom, width: W, height: ROW_H * ROWS_PER_PAGE, borderWidth: 1.2, borderColor: BLACK });
  }
  return { bytes: await doc.save(), pages: pages.length, truncatedObservations: [] };
}
