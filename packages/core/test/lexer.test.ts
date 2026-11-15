import { describe, it, expect } from 'vitest';
import { parseNumber } from '../src/asm/numbers';
import { lexLine } from '../src/asm/lexer';

describe('parseNumber', () => {
  it('hex, binario y decimal', () => {
    expect(parseNumber('2AH')).toEqual({ ok: true, value: 42 });
    expect(parseNumber('0A1H')).toEqual({ ok: true, value: 161 });
    expect(parseNumber('0a1h')).toEqual({ ok: true, value: 161 });
    expect(parseNumber('00101010B')).toEqual({ ok: true, value: 42 });
    expect(parseNumber('42')).toEqual({ ok: true, value: 42 });
    expect(parseNumber('0FFFFH')).toEqual({ ok: true, value: 0xffff });
  });
  it('fuera de rango', () => {
    const r = parseNumber('1FFFFH');
    expect(r).not.toBeNull();
    expect(r!.ok).toBe(false);
    expect((r as { error: string }).error).toContain('fuera de rango');
    expect(parseNumber('65536')!.ok).toBe(false);
  });
  it('null si parece símbolo', () => {
    expect(parseNumber('BUCLE')).toBeNull();
    expect(parseNumber('A1H')).toBeNull();
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('12G')).toBeNull();
  });
});

describe('lexLine', () => {
  it('etiqueta, op, operando y comentario', () => {
    expect(lexLine('INICIO: LDA 0040H ; A ← M[0040h]', 1)).toEqual({
      line: 1, label: 'INICIO', op: 'LDA', args: ['0040H'], comment: 'A ← M[0040h]',
      raw: 'INICIO: LDA 0040H ; A ← M[0040h]',
    });
  });
  it('mayúsculas y espacios', () => {
    const l = lexLine('  mvi a , 5', 2);
    expect(l.op).toBe('MVI');
    expect(l.args).toEqual(['A', '5']);
    expect(l.label).toBeUndefined();
  });
  it('cadenas con comillas conservan texto y ;', () => {
    expect(lexLine("MSG: DB 'HOLA', 0", 3).args).toEqual(["'HOLA'", '0']);
    const l = lexLine("DB 'a;b, c' ; nota", 4);
    expect(l.args).toEqual(["'a;b, c'"]);
    expect(l.comment).toBe('nota');
  });
  it('línea vacía y sólo comentario', () => {
    expect(lexLine('   ', 5)).toEqual({ line: 5, args: [], raw: '   ' });
    expect(lexLine('; hola', 6)).toEqual({ line: 6, args: [], comment: 'hola', raw: '; hola' });
  });
  it('etiqueta sola', () => {
    const l = lexLine('fin:', 7);
    expect(l.label).toBe('FIN');
    expect(l.op).toBeUndefined();
  });
  it('etiqueta y op en minúsculas se pasan a mayúsculas', () => {
    const l = lexLine('bucle: dcr b', 8);
    expect(l).toMatchObject({ label: 'BUCLE', op: 'DCR', args: ['B'] });
  });
  it('nombre sin dos puntos antes de EQU/MACRO/DB/DW/DS es etiqueta', () => {
    expect(lexLine('DATO EQU 0040H', 9)).toMatchObject({ label: 'DATO', op: 'EQU', args: ['0040H'] });
    expect(lexLine('M1 MACRO X, Y', 10)).toMatchObject({ label: 'M1', op: 'MACRO', args: ['X', 'Y'] });
    expect(lexLine('buf ds 4', 11)).toMatchObject({ label: 'BUF', op: 'DS', args: ['4'] });
    expect(lexLine('tabla DB 1,2', 12)).toMatchObject({ label: 'TABLA', op: 'DB', args: ['1', '2'] });
  });
  it('mnemónico conocido primero no es etiqueta', () => {
    expect(lexLine('DB 1', 13)).toMatchObject({ op: 'DB', args: ['1'] });
    expect(lexLine('ORG 100H', 14)).toMatchObject({ op: 'ORG', args: ['100H'] });
    expect(lexLine('NOP', 15)).toMatchObject({ op: 'NOP', args: [] });
  });
  it('símbolos en operandos van en mayúsculas', () => {
    expect(lexLine('jmp bucle', 16).args).toEqual(['BUCLE']);
  });
});
