import { describe, expect, it } from 'vitest';
import { assemble, type TraceRow } from '@sim8085/core';
import { fitText, layoutAssembler, layoutTrace, pdfSafe, safeFileName, ROWS_PER_PAGE } from './layout';

const measure = (t: string) => t.length * 5;
const W = 200; // 40 caracteres por renglón
const rowsOf = (src: string) => assemble(src, { start: 0x2000 }).rows;
const nops = (n: number) => Array.from({ length: n }, () => 'NOP').join('\n');

describe('pdfSafe', () => {
  it('reemplaza flechas, tabulaciones y caracteres no codificables', () => {
    expect(pdfSafe('A ← é\t😀')).toBe('A <- é ?');
    expect(pdfSafe('HL ↔ DE → ñ º ° “x”')).toBe('HL <-> DE -> ñ º ° “x”');
  });
});

describe('safeFileName', () => {
  it('quita caracteres inválidos y usa "programa" si está vacío', () => {
    expect(safeFileName('GTP05/ej 1', 'assembler')).toBe('GTP05ej 1-assembler.pdf');
    expect(safeFileName('', 'registros')).toBe('programa-registros.pdf');
    expect(safeFileName('  ', 'registros')).toBe('programa-registros.pdf');
  });
});

describe('fitText', () => {
  it('recorta con ... para entrar en el ancho', () => {
    expect(fitText('abc', 100, measure)).toBe('abc');
    const r = fitText('x'.repeat(100), 50, measure);
    expect(r.endsWith('...')).toBe(true);
    expect(measure(r)).toBeLessThanOrEqual(50);
  });
});

describe('layoutAssembler', () => {
  it('un byte por fila: mnemónico y observación solo en la primera', () => {
    const { pages } = layoutAssembler(rowsOf('LDA 0040H ; trae el dato'), measure, W);
    expect(pages[0]!.lines).toEqual([
      { address: '2000h', mnemonic: 'LDA 0040H', opcode: '3A', obs: ['trae el dato'], tall: false },
      { address: '2001h', mnemonic: '', opcode: '40', obs: [], tall: false },
      { address: '2002h', mnemonic: '', opcode: '00', obs: [], tall: false },
    ]);
  });

  it('observación de 41–80 caracteres con 3 bytes: el segundo renglón va en la fila siguiente', () => {
    const obs = 'a'.repeat(39) + ' ' + 'b'.repeat(40);
    const { pages, truncated } = layoutAssembler(rowsOf(`LDA 0040H ; ${obs}`), measure, W);
    const l = pages[0]!.lines;
    expect(l[0]!.obs).toEqual(['a'.repeat(39)]);
    expect(l[1]!.obs).toEqual(['b'.repeat(40)]);
    expect(l.every((x) => !x.tall)).toBe(true);
    expect(truncated).toEqual([]);
  });

  it('con 1 byte la fila es del doble de alto', () => {
    const obs = 'a'.repeat(39) + ' ' + 'b'.repeat(40);
    const { pages } = layoutAssembler(rowsOf(`NOP ; ${obs}`), measure, W);
    expect(pages[0]!.lines[0]).toMatchObject({ tall: true, obs: ['a'.repeat(39), 'b'.repeat(40)] });
  });

  it('80 caracteres no se marcan; 81 se recortan a 80 con ... y se marcan', () => {
    expect(layoutAssembler(rowsOf(`NOP ; ${'x'.repeat(80)}`), measure, W).truncated).toEqual([]);
    const r = layoutAssembler(rowsOf(`\nNOP ; ${'x'.repeat(81)}`), measure, W);
    expect(r.truncated).toEqual([{ line: 2, chars: 81 }]);
    const joined = r.pages[0]!.lines[0]!.obs.join('');
    expect(joined).toBe('x'.repeat(77) + '...');
  });

  it('una palabra más larga que el renglón se corta por ancho y no desborda', () => {
    const { pages } = layoutAssembler(rowsOf(`NOP ; ${'w'.repeat(70)}`), measure, W);
    for (const o of pages[0]!.lines[0]!.obs) expect(measure(o)).toBeLessThanOrEqual(W);
  });

  it('44 filas = 1 hoja; 45 = 2 hojas numeradas 1 y 2', () => {
    expect(ROWS_PER_PAGE).toBe(44);
    expect(layoutAssembler(rowsOf(nops(44)), measure, W).pages.map((p) => p.sheet)).toEqual([1]);
    const two = layoutAssembler(rowsOf(nops(45)), measure, W).pages;
    expect(two.map((p) => p.sheet)).toEqual([1, 2]);
    expect(two[1]!.lines).toHaveLength(1);
  });

  it('una fila de doble alto que no entra pasa entera a la hoja siguiente', () => {
    const tall = 'NOP ; ' + 'a'.repeat(39) + ' ' + 'b'.repeat(40);
    const { pages } = layoutAssembler(rowsOf(`${nops(43)}\n${tall}\nNOP`), measure, W);
    expect(pages[0]!.lines).toHaveLength(43);
    expect(pages[1]!.lines[0]!.tall).toBe(true);
    expect(pages[1]!.lines).toHaveLength(2);
  });
});

describe('layoutTrace', () => {
  const base: TraceRow = { n: 1, A: 0x3a, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0, M: 0, Z: 0, P: 0, S: 0, CY: 0 };

  it('formatea posición, valor, registros y banderas', () => {
    const pages = layoutTrace([{ ...base, memAddr: 0x40, memValue: 0x3a }, { ...base, n: 2, CY: 1 }]);
    expect(pages[0]!.lines[0]).toEqual({
      n: '1', pos: '0040h', val: '3Ah',
      regs: ['3A', '00', '00', '00', '00', '00', '00', '00'], flags: ['0', '0', '0', '0'],
    });
    expect(pages[0]!.lines[1]).toMatchObject({ n: '2', pos: '', val: '', flags: ['0', '0', '0', '1'] });
  });

  it('45 filas → 2 hojas; 0 filas → 1 hoja vacía', () => {
    const rows = Array.from({ length: 45 }, (_, i) => ({ ...base, n: i + 1 }));
    expect(layoutTrace(rows).map((p) => p.lines.length)).toEqual([44, 1]);
    expect(layoutTrace([])).toEqual([{ sheet: 1, lines: [] }]);
  });
});
