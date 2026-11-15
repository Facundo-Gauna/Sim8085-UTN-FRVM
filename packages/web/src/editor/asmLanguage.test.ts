import { describe, expect, it } from 'vitest';
import { tokenizeLine, type AsmToken } from './asmLanguage';

/** [texto del token, tipo] para leer las pruebas de un vistazo. */
const toks = (line: string) => tokenizeLine(line).map((t) => [line.slice(t.from, t.to), t.kind]);
/** Tipos sin `text` (comas, símbolos sin color). */
const kinds = (line: string) => tokenizeLine(line).filter((t) => t.kind !== 'text').map((t) => t.kind);

describe('tokenizeLine (brief)', () => {
  it('etiqueta, mnemónico, número y comentario', () => {
    expect(toks('INICIO: LDA 0040H ; A ← M[0040h]')).toEqual([
      ['INICIO:', 'label'],
      ['LDA', 'mnemonic'],
      ['0040H', 'number'],
      ['; A ← M[0040h]', 'comment'],
    ]);
  });

  it('minúsculas: mnemónico, registro, número', () => {
    expect(toks('  mvi a, 5')).toEqual([
      ['mvi', 'mnemonic'],
      ['a', 'register'],
      [',', 'text'],
      ['5', 'number'],
    ]);
  });

  it('nombre antes de EQU sin dos puntos', () => {
    expect(toks('DATO EQU 0040H')).toEqual([
      ['DATO', 'label'],
      ['EQU', 'directive'],
      ['0040H', 'number'],
    ]);
  });

  it('cadena entre comillas simples', () => {
    expect(toks("MSG: DB 'HOLA', 0")).toEqual([
      ['MSG:', 'label'],
      ['DB', 'directive'],
      ["'HOLA'", 'string'],
      [',', 'text'],
      ['0', 'number'],
    ]);
  });

  it('un ; dentro de comillas no inicia comentario', () => {
    expect(toks("DB 'a;b' ; fin")).toEqual([
      ['DB', 'directive'],
      ["'a;b'", 'string'],
      ['; fin', 'comment'],
    ]);
  });
});

describe('tokenizeLine (casos extra)', () => {
  it('números hex, binarios y decimales; hex que empieza con letra también', () => {
    for (const n of ['2AH', '0A1H', '00101010B', '42', 'A1H', '0ffh']) {
      expect(toks(`MVI B, ${n}`).at(-1)).toEqual([n, 'number']);
    }
  });

  it('registros solo como palabra completa y en posición de operando', () => {
    expect(toks('MOV A, M')).toEqual([
      ['MOV', 'mnemonic'],
      ['A', 'register'],
      [',', 'text'],
      ['M', 'register'],
    ]);
    expect(toks('PUSH PSW')).toEqual([['PUSH', 'mnemonic'], ['PSW', 'register']]);
    expect(toks('LXI SP, 3000H')[1]).toEqual(['SP', 'register']);
    // AB no es un registro, y B en posición de mnemónico tampoco.
    expect(toks('LDA AB')[1]).toEqual(['AB', 'text']);
    expect(toks('B')).toEqual([['B', 'text']]);
  });

  it('operando de JMP/CALL/Jcc/Ccc es etiqueta; un número sigue siendo número', () => {
    expect(toks('JMP INICIO')).toEqual([['JMP', 'mnemonic'], ['INICIO', 'label']]);
    expect(toks('jnz bucle')).toEqual([['jnz', 'mnemonic'], ['bucle', 'label']]);
    expect(toks('CALL SUB1')[1]).toEqual(['SUB1', 'label']);
    expect(toks('CNZ RUT')[1]).toEqual(['RUT', 'label']);
    expect(toks('JMP 2000H')[1]).toEqual(['2000H', 'number']);
    // Tras un salto, A1H es un símbolo para el ensamblador (no empieza con dígito).
    expect(toks('JMP A1H')[1]).toEqual(['A1H', 'label']);
  });

  it('todas las directivas, sin distinguir mayúsculas', () => {
    for (const d of ['ORG', 'EQU', 'DB', 'DW', 'DS', 'END', 'MACRO', 'ENDM', 'org', 'endm']) {
      expect(toks(d)[0]).toEqual([d, 'directive']);
    }
    expect(kinds('ORG 2000H')).toEqual(['directive', 'number']);
    expect(kinds('SUMA MACRO')).toEqual(['label', 'directive']);
    expect(kinds('TABLA DW 1234H')).toEqual(['label', 'directive', 'number']);
    expect(kinds('BUF DS 10')).toEqual(['label', 'directive', 'number']);
  });

  it('un mnemónico conocido no se toma como nombre aunque le siga DB', () => {
    // Regla del lexer: el primer token es nombre solo si NO es mnemónico/directiva.
    expect(kinds('NOP DB 1')[0]).toBe('mnemonic');
  });

  it('etiqueta con dos puntos solo al inicio de la línea (tras espacios)', () => {
    expect(toks('   FIN: HLT')).toEqual([['FIN:', 'label'], ['HLT', 'mnemonic']]);
    expect(toks('FIN : HLT')).toEqual([['FIN :', 'label'], ['HLT', 'mnemonic']]);
  });

  it('comentario de línea completa y línea vacía', () => {
    expect(toks('; sólo comentario')).toEqual([['; sólo comentario', 'comment']]);
    expect(tokenizeLine('')).toEqual([]);
    expect(tokenizeLine('    ')).toEqual([]);
  });

  it('cadena sin cerrar llega hasta el final de la línea y no abre comentario', () => {
    expect(toks("DB 'abc ; x")).toEqual([['DB', 'directive'], ["'abc ; x", 'string']]);
  });

  it('el espacio en blanco se omite: los spans no se solapan, van en orden y no cubren blancos', () => {
    const lines = [
      'INICIO: LDA 0040H ; A ← M[0040h]',
      "  MSG:   DB  'HOLA' ,  0   ; x",
      '\tMOV\tA,\tB',
      'DATO EQU 0040H',
    ];
    for (const line of lines) {
      const ts: AsmToken[] = tokenizeLine(line);
      let prev = 0;
      for (const t of ts) {
        expect(t.from).toBeGreaterThanOrEqual(prev);
        expect(t.to).toBeGreaterThan(t.from);
        prev = t.to;
        const s = line.slice(t.from, t.to);
        if (t.kind !== 'comment' && t.kind !== 'string' && t.kind !== 'label') {
          expect(/\s/.test(s)).toBe(false);
        }
        expect(s).toBe(s.trim());
      }
    }
  });

  it('símbolos desconocidos y puntuación son text', () => {
    expect(toks('MVI A, VAL+1')).toEqual([
      ['MVI', 'mnemonic'],
      ['A', 'register'],
      [',', 'text'],
      ['VAL', 'text'],
      ['+', 'text'],
      ['1', 'number'],
    ]);
  });
});
