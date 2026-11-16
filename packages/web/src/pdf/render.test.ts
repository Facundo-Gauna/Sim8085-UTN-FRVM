import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { assemble, buildTrace } from '@sim8085/core';
import { SAMPLE } from '../state/sample';
import { renderAssemblerPdf, renderTracePdf, showsFixedH } from './render';

const header = { student: 'Ana Pérez', exercise: 'GTP05 ej. 1', sheetStart: 1, date: '15/11/2026' };
const rowsOf = (src: string) => assemble(src, { start: 0x2000 }).rows;
const load = (bytes: Uint8Array) => PDFDocument.load(bytes);

describe('renderAssemblerPdf', () => {
  it('el ejemplo da 1 hoja A4 válida', async () => {
    const r = await renderAssemblerPdf(rowsOf(SAMPLE.text), header);
    expect(r.pages).toBe(1);
    expect(r.truncatedObservations).toEqual([]);
    expect(new TextDecoder().decode(r.bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await load(r.bytes);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 1);
    expect(height).toBeCloseTo(841.89, 1);
    expect(doc.getTitle()).toBe('GTP05 ej. 1 — Ana Pérez');
  });

  it('100 bytes → 3 hojas', async () => {
    const src = Array.from({ length: 100 }, () => 'NOP').join('\n');
    const r = await renderAssemblerPdf(rowsOf(src), header);
    expect(r.pages).toBe(3);
    expect((await load(r.bytes)).getPageCount()).toBe(3);
  });

  it('texto raro y encabezado enorme no lanzan', async () => {
    const r = await renderAssemblerPdf(rowsOf('NOP ; ←😀\tñ º ° “hola”'), {
      ...header,
      student: 'A'.repeat(300),
      exercise: '😀'.repeat(200),
    });
    expect(r.pages).toBe(1);
  });

  it('informa las observaciones recortadas', async () => {
    const r = await renderAssemblerPdf(rowsOf(`NOP ; ${'x '.repeat(50)}`), header);
    expect(r.truncatedObservations).toEqual([{ line: 1, chars: 99 }]);
  });
});

describe('renderTracePdf', () => {
  const trace = (n: number) =>
    buildTrace(assemble(Array.from({ length: n }, () => 'NOP').join('\n') + '\nHLT', { start: 0x2000 }), () => {}).rows;

  it('45 filas → 2 hojas; 0 filas → 1 hoja con la grilla', async () => {
    expect((await renderTracePdf(trace(44), header)).pages).toBe(2); // 44 NOP + HLT = 45
    const empty = await renderTracePdf([], header);
    expect(empty.pages).toBe(1);
    expect((await load(empty.bytes)).getPageCount()).toBe(1);
  });
});

describe('plantilla de Registros: la h fija', () => {
  it('solo se imprime en filas sin posición de memoria', () => {
    expect(showsFixedH({ pos: '' })).toBe(true);
    expect(showsFixedH(undefined)).toBe(true);
    expect(showsFixedH({ pos: '0040h' })).toBe(false);
  });
});
