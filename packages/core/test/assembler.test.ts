import { describe, it, expect } from 'vitest';
import { assemble, type AssembleResult } from '../src/asm/assembler';

/** Bytes de memoria desde `from`, `n` posiciones (undefined si no se escribió). */
function bytesAt(r: AssembleResult, from: number, n: number): Array<number | undefined> {
  return Array.from({ length: n }, (_, i) => r.memory.get(from + i));
}

const errors = (r: AssembleResult) => r.messages.filter((m) => m.severity === 'error');

describe('assemble: programa básico', () => {
  const src = [
    'LDA 0040H ; A ← M[0040h]',
    'CMA',
    'STA 0041H',
    'HLT',
  ].join('\n');

  it('GTP05 ej. 1 en 2000h', () => {
    const r = assemble(src, { start: 0x2000 });
    expect(r.ok).toBe(true);
    expect(r.messages).toEqual([]);
    expect(bytesAt(r, 0x2000, 8)).toEqual([0x3a, 0x40, 0x00, 0x2f, 0x32, 0x41, 0x00, 0x76]);
    expect(r.sizeBytes).toBe(8);
    expect(r.start).toBe(0x2000);
    expect(r.end).toBe(0x2007);
    expect(r.rows).toHaveLength(4);
    expect(r.rows[0]).toMatchObject({
      line: 1, address: 0x2000, bytes: [0x3a, 0x40, 0x00], source: 'LDA 0040H',
      comment: 'A ← M[0040h]', inCatedra: true,
    });
    expect(r.rows[0]!.instr?.mnemonic).toBe('LDA');
    expect(r.rows[1]!.comment).toBeUndefined();
    expect(r.lineToAddress.get(3)).toBe(0x2004);
    expect(r.addressToLine.get(0x2007)).toBe(4);
  });

  it('sin ORG ni start empieza en 0000h', () => {
    const r = assemble('NOP');
    expect(r.start).toBe(0);
    expect(r.memory.get(0)).toBe(0x00);
  });

  it('ORG gana sobre start', () => {
    const r = assemble('ORG 3000H\nHLT', { start: 0x2000 });
    expect(r.memory.get(0x3000)).toBe(0x76);
    expect(r.memory.has(0x2000)).toBe(false);
    expect(r.start).toBe(0x3000);
  });

  it('sizeBytes cuenta sólo los bytes emitidos (huecos entre ORG no suman)', () => {
    const r = assemble('ORG 2000H\nNOP\nORG 3000H\nHLT');
    expect(r.sizeBytes).toBe(2);
    expect(r.start).toBe(0x2000);
    expect(r.end).toBe(0x3000);
  });

  it('referencia hacia adelante', () => {
    const r = assemble('ORG 2000H\nJMP FIN\nNOP\nFIN: HLT');
    expect(r.ok).toBe(true);
    expect(bytesAt(r, 0x2000, 5)).toEqual([0xc3, 0x04, 0x20, 0x00, 0x76]);
    expect(r.symbols.get('FIN')).toBe(0x2004);
  });

  it('operandos de registros, pares, PSW, puertos y RST', () => {
    const r = assemble([
      'MOV A, M', 'MVI B, 05H', 'LXI SP, 2100H', 'PUSH PSW', 'POP B',
      'IN 01H', 'OUT 02H', 'RST 7', 'LDAX D', 'DAD SP',
    ].join('\n'));
    expect(r.ok).toBe(true);
    expect([...r.memory.values()]).toEqual([
      0x7e, 0x06, 0x05, 0x31, 0x00, 0x21, 0xf5, 0xc1, 0xdb, 0x01, 0xd3, 0x02, 0xff, 0x1a, 0x39,
    ]);
    expect(r.rows[1]!.source).toBe('MVI B, 05H');
  });
});

describe('assemble: directivas', () => {
  it('EQU', () => {
    const r = assemble('DATO EQU 0040H\nLDA DATO');
    expect(r.ok).toBe(true);
    expect(bytesAt(r, 0, 3)).toEqual([0x3a, 0x40, 0x00]);
    expect(r.symbols.get('DATO')).toBe(0x40);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.line).toBe(2);
  });

  it('DB, DW y DS', () => {
    const r = assemble("ORG 1000H\nDB 05H, 'AB', 12\nDW 1234H\nDS 3\nHLT");
    expect(r.ok).toBe(true);
    expect(bytesAt(r, 0x1000, 6)).toEqual([0x05, 0x41, 0x42, 0x0c, 0x34, 0x12]);
    expect(bytesAt(r, 0x1006, 3)).toEqual([undefined, undefined, undefined]);
    expect(r.memory.get(0x1009)).toBe(0x76);
    expect(r.rows.map((x) => x.address)).toEqual([0x1000, 0x1004, 0x1009]);
    expect(r.rows[0]!.inCatedra).toBe(false);
  });

  it('DB con nombre sin dos puntos', () => {
    const r = assemble('ORG 0050H\nTABLA DB 1, 2\nLXI H, TABLA');
    expect(r.ok).toBe(true);
    expect(r.symbols.get('TABLA')).toBe(0x50);
    expect(bytesAt(r, 0x52, 3)).toEqual([0x21, 0x50, 0x00]);
  });

  it('END ignora lo que sigue', () => {
    const r = assemble('HLT\nEND\nFOO BAR\nNOP');
    expect(r.ok).toBe(true);
    expect(r.memory.size).toBe(1);
  });
});

describe('assemble: macros', () => {
  const src = [
    'SUMA2 MACRO X',
    ' ADI X',
    ' ADI X',
    ' ENDM',
    'SUMA2 01H ; suma dos veces',
    'HLT',
  ].join('\n');

  it('expande con sustitución de parámetros', () => {
    const r = assemble(src);
    expect(r.ok).toBe(true);
    expect(bytesAt(r, 0, 5)).toEqual([0xc6, 0x01, 0xc6, 0x01, 0x76]);
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({
      line: 5, source: 'ADI 01H', fromMacro: 'SUMA2', inCatedra: false, comment: 'suma dos veces',
    });
    expect(r.rows[1]).toMatchObject({ line: 5, source: 'ADI 01H', fromMacro: 'SUMA2', inCatedra: false });
    expect(r.rows[1]!.comment).toBeUndefined();
    expect(r.rows[2]).toMatchObject({ line: 6, inCatedra: true });
    expect(r.rows[2]!.fromMacro).toBeUndefined();
    expect(r.lineToAddress.get(5)).toBe(0);
  });

  it('sustitución sólo de palabra completa', () => {
    const r = assemble('M1 MACRO X\nMVI A, X\nMVI B, XX\nENDM\nXX EQU 7\nM1 3');
    expect(r.ok).toBe(true);
    expect(bytesAt(r, 0, 4)).toEqual([0x3e, 0x03, 0x06, 0x07]);
  });

  it('macro anidada y recursión son errores', () => {
    const a = assemble('M1 MACRO\nM2 MACRO\nENDM\nENDM');
    expect(errors(a)[0]!.message).toContain('Las macros no se pueden anidar');
    const b = assemble('M1 MACRO\nM1\nENDM\nM1');
    expect(errors(b)[0]!.message).toContain('recursión de macro');
    expect(errors(b)[0]!.line).toBe(4);
  });

  it('la etiqueta de la llamada no pisa la etiqueta del cuerpo', () => {
    const r = assemble('R MACRO\nLOOP: DCR B\nJNZ LOOP\nENDM\nINI: R');
    expect(r.ok).toBe(true);
    expect(r.symbols.get('INI')).toBe(0);
    expect(r.symbols.get('LOOP@1')).toBe(0);
    expect(bytesAt(r, 0, 4)).toEqual([0x05, 0xc2, 0x00, 0x00]);
  });

  it('etiquetas locales: la misma macro con bucle se llama dos veces', () => {
    const r = assemble([
      'RETARDO MACRO',
      'LOOP: DCR B',
      'JNZ LOOP',
      'JMP FIN',
      'ENDM',
      'ORG 2000H',
      'RETARDO',
      'RETARDO',
      'FIN: HLT',
    ].join('\n'));
    expect(r.ok).toBe(true);
    expect(r.symbols.get('LOOP@1')).toBe(0x2000);
    expect(r.symbols.get('LOOP@2')).toBe(0x2007);
    // JNZ de cada expansión apunta a su propio bucle; FIN (global) no se renombra.
    expect(bytesAt(r, 0x2000, 15)).toEqual([
      0x05, 0xc2, 0x00, 0x20, 0xc3, 0x0e, 0x20,
      0x05, 0xc2, 0x07, 0x20, 0xc3, 0x0e, 0x20,
      0x76,
    ]);
    expect(r.rows[2]!.source).toBe('JMP FIN');
  });

  it('cantidad de parámetros incorrecta', () => {
    const r = assemble('M1 MACRO X\nADI X\nENDM\nM1');
    expect(r.ok).toBe(false);
    expect(errors(r)[0]!.line).toBe(4);
  });
});

describe('assemble: errores y advertencias', () => {
  it('mnemónico desconocido', () => {
    const r = assemble('NOP\nFOO B');
    expect(r.ok).toBe(false);
    expect(errors(r)[0]).toMatchObject({ line: 2, severity: 'error' });
    expect(errors(r)[0]!.message).toContain('FOO');
  });

  it('MVI A sin dato', () => {
    const r = assemble('MVI A');
    expect(errors(r)[0]).toMatchObject({ line: 1, message: 'MVI necesita un registro y un dato de 8 bits' });
  });

  it('MVI A, 300 fuera de rango de 8 bits', () => {
    const r = assemble('NOP\nMVI A, 300');
    const e = errors(r)[0]!;
    expect(e.line).toBe(2);
    expect(e.message).toContain('fuera de rango');
    expect(e.message).toContain('8 bits');
  });

  it('etiqueta duplicada', () => {
    const r = assemble('X: NOP\nX: HLT');
    expect(errors(r)[0]!.line).toBe(2);
    expect(errors(r)[0]!.message).toContain('X');
  });

  it('hexadecimal sin 0 adelante', () => {
    const r = assemble('MVI A, A1H');
    expect(errors(r)[0]).toMatchObject({
      line: 1,
      message: '¿Quisiste decir 0A1H? Un número hexadecimal que empieza con letra lleva un 0 adelante.',
    });
    const r2 = assemble('MVI A, FFH');
    expect(errors(r2)[0]!.message).toContain('0FFH');
  });

  it('símbolo definido con forma de hexa no da la pista', () => {
    const r = assemble('A1H EQU 5\nMVI A, A1H');
    expect(r.ok).toBe(true);
    expect(r.memory.get(1)).toBe(5);
  });

  it('símbolo no definido', () => {
    const r = assemble('JMP NADA');
    expect(errors(r)[0]!.message).toContain('NADA');
    expect(errors(r)[0]!.message).toContain('no está definido');
  });

  it('bytes superpuestos', () => {
    const r = assemble('ORG 2000H\nLXI H, 0\nNOP\nORG 2003H\nNOP');
    expect(r.ok).toBe(false);
    expect(errors(r)[0]).toMatchObject({ line: 5 });
    expect(errors(r)[0]!.message).toContain('se superpone en 2003h');
  });

  it('comentario de más de 80 caracteres', () => {
    const r = assemble(`NOP ; ${'x'.repeat(81)}\nHLT ; ${'y'.repeat(80)}`);
    expect(r.ok).toBe(true);
    expect(r.messages).toEqual([
      { line: 1, severity: 'warning', message: 'La observación supera los 80 caracteres' },
    ]);
  });
});

describe('assemble: punto de entrada (entry)', () => {
  it('ignora datos DB en direcciones más bajas', () => {
    const r = assemble('ORG 2000H\nLDA 2050H\nHLT\nORG 0040H\nDB 3AH');
    expect(r.entry).toBe(0x2000);
    expect(r.start).toBe(0x0040);
  });

  it('primera instrucción del fuente, aunque haya código en direcciones más bajas después', () => {
    const r = assemble('ORG 3000H\nLXI SP, 4000H\nCALL SUB\nHLT\nORG 2000H\nSUB: MVI A, 5\nRET');
    expect(r.entry).toBe(0x3000);
    expect(r.start).toBe(0x2000);
  });

  it('manejador en 0034h escrito primero', () => {
    const r = assemble('ORG 0034H\nEI\nRET\nORG 2000H\nHLT');
    expect(r.entry).toBe(0x0034);
  });

  it('sin instrucciones → el origen', () => {
    expect(assemble('DB 1, 2', { start: 0x100 }).entry).toBe(0x100);
    expect(assemble('', { start: 0x2000 }).entry).toBe(0x2000);
  });

  it('DS y DW no cuentan como entrada', () => {
    const r = assemble('ORG 10H\nX DS 2\nDW 1234H\nNOP');
    expect(r.entry).toBe(0x14);
  });
});

describe('assemble: fin de línea (I1)', () => {
  const lines = ['ORG 2000H', 'MVI A, 1 ; uno', 'LOOP: DCR A', 'JNZ LOOP', 'HLT'];
  const strip = (r: AssembleResult) => r.rows.map(({ instr: _i, ...rest }) => rest);

  it('CRLF, CR suelto, LF y mezcla dan las mismas filas', () => {
    const lf = assemble(lines.join('\n'));
    expect(lf.ok).toBe(true);
    expect(lf.rows).toHaveLength(4);
    const crlf = assemble(lines.join('\r\n'));
    const cr = assemble(lines.join('\r'));
    const mixed = assemble(`${lines[0]}\r\n${lines[1]}\r${lines[2]}\n${lines[3]}\r\n${lines[4]}`);
    for (const r of [crlf, cr, mixed]) {
      expect(r.ok).toBe(true);
      expect(strip(r)).toEqual(strip(lf));
    }
  });

  it("'MVI A, 1\\rHLT' no pierde código", () => {
    const r = assemble('MVI A, 1\rHLT');
    expect(r.ok).toBe(true);
    expect(r.rows.map((x) => x.source)).toEqual(['MVI A, 1', 'HLT']);
  });
});

describe('assemble: etiquetas visibles (I2/I3)', () => {
  const delay = [
    'RETARDO MACRO',
    'LP: DCR B',
    'JNZ LP',
    'ENDM',
    'ORG 2000H',
    'RETARDO',
    'RETARDO',
    'FIN: HLT',
  ].join('\n');

  it('source muestra la etiqueta original (sin @n)', () => {
    const r = assemble(delay);
    expect(r.ok).toBe(true);
    expect(r.rows.map((x) => x.source)).toEqual(['DCR B', 'JNZ LP', 'DCR B', 'JNZ LP', 'HLT']);
    expect(r.rows[0]!.label).toBe('LP');
    expect(r.rows[2]!.label).toBe('LP');
  });

  it('labels: nombres visibles; las locales ambiguas se omiten', () => {
    const r = assemble(delay);
    expect(r.symbols.get('LP@1')).toBe(0x2000);
    expect(r.symbols.get('LP@2')).toBe(0x2004);
    expect([...r.labels]).toEqual([['FIN', 0x2008]]);
    const once = assemble('RETARDO MACRO\nLP: DCR B\nJNZ LP\nENDM\nDATO EQU 40H\nRETARDO\nHLT');
    expect(once.labels.get('LP')).toBe(0);
    expect(once.labels.get('DATO')).toBe(0x40);
    expect([...once.labels.keys()].some((k) => k.includes('@'))).toBe(false);
  });

  it('etiqueta sola en una línea pasa a la instrucción siguiente', () => {
    const r = assemble('L1:\n DCR B\n JNZ L1');
    expect(r.ok).toBe(true);
    expect(r.rows[0]).toMatchObject({ line: 2, label: 'L1', source: 'DCR B' });
    expect(r.rows[0]!.labels).toBeUndefined();
    expect(r.rows[1]!.label).toBeUndefined();
  });

  it('etiqueta en la misma línea', () => {
    const r = assemble('L1: DCR B');
    expect(r.rows[0]).toMatchObject({ label: 'L1' });
  });

  it('el comentario de la etiqueta sola pasa si la instrucción no tiene', () => {
    const a = assemble('LOOP: ; inicio bucle\n DCR B\n JNZ LOOP');
    expect(a.rows[0]).toMatchObject({ label: 'LOOP', comment: 'inicio bucle' });
    const b = assemble('LOOP: ; inicio bucle\n DCR B ; propio\n JNZ LOOP');
    expect(b.rows[0]).toMatchObject({ label: 'LOOP', comment: 'propio' });
  });

  it('etiquetas apiladas en una dirección', () => {
    const r = assemble('A1:\nA2: ; c\nA3: NOP');
    expect(r.rows[0]).toMatchObject({ label: 'A1', labels: ['A1', 'A2', 'A3'], comment: 'c' });
  });

  it('una etiqueta antes de ORG o DS no pasa a otra dirección', () => {
    const r = assemble('X:\nORG 10H\nNOP\nY: DS 2\nHLT');
    expect(r.rows[0]!.label).toBeUndefined();
    expect(r.rows[1]!.label).toBeUndefined();
  });

  it('llamada a macro con etiqueta y comentario', () => {
    const r = assemble('SUMA MACRO\nADI 1\nENDM\nINI: SUMA ; suma uno\nHLT');
    expect(r.ok).toBe(true);
    expect(r.rows[0]).toMatchObject({ line: 4, label: 'INI', comment: 'suma uno', fromMacro: 'SUMA' });
  });
});

describe('assemble: nombres reservados (M2)', () => {
  it('L: NOP es error', () => {
    const r = assemble('L: NOP');
    expect(r.ok).toBe(false);
    expect(errors(r)[0]).toMatchObject({ line: 1, message: '«L» es un registro y no puede usarse como etiqueta' });
  });

  it('EQU, macro y etiqueta local con nombre de registro', () => {
    expect(errors(assemble('SP EQU 5'))[0]!.message).toContain('«SP» es un registro');
    expect(errors(assemble('PSW MACRO\nNOP\nENDM'))[0]!.message).toContain('«PSW» es un registro');
    const local = assemble('R MACRO\nB: NOP\nENDM\nR');
    expect(errors(local)[0]).toMatchObject({ line: 4, message: '«B» es un registro y no puede usarse como etiqueta' });
  });
});
