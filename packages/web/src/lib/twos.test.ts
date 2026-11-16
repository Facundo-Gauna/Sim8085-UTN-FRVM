import { describe, expect, it } from 'vitest';
import { analyze, parseSigned } from './twos';

describe('analyze', () => {
  it('FBh en 8 bits', () => {
    expect(analyze(0xfb, 8)).toEqual({ bits: 8, unsigned: 251, signed: -5, ones: 0x04, twos: 0x05, binary: '1111 1011' });
  });
  it('extremos', () => {
    expect(analyze(0x80, 8).signed).toBe(-128);
    expect(analyze(0x7f, 8).signed).toBe(127);
    expect(analyze(0x8000, 16).signed).toBe(-32768);
    expect(analyze(0, 8)).toMatchObject({ twos: 0, ones: 0xff, signed: 0 });
  });
  it('toma el valor módulo 2^bits', () => {
    expect(analyze(0x1fb, 8).unsigned).toBe(251);
  });
});

describe('parseSigned', () => {
  it('decimal con signo y hexa/binario', () => {
    expect(parseSigned('-5', 8)).toEqual({ ok: true, value: 0xfb });
    expect(parseSigned('+5', 8)).toEqual({ ok: true, value: 5 });
    expect(parseSigned('0FBh', 8)).toEqual({ ok: true, value: 0xfb });
    expect(parseSigned('11111011b', 8)).toEqual({ ok: true, value: 0xfb });
    expect(parseSigned('-5', 16)).toEqual({ ok: true, value: 0xfffb });
  });
  it('fuera de rango y errores', () => {
    expect(parseSigned('-129', 8)).toEqual({ ok: false, error: 'Fuera de rango para 8 bits' });
    expect(parseSigned('256', 8)).toEqual({ ok: false, error: 'Fuera de rango para 8 bits' });
    expect(parseSigned('1FFh', 8)).toEqual({ ok: false, error: 'Fuera de rango para 8 bits' });
    expect(parseSigned('-128', 8)).toEqual({ ok: true, value: 0x80 });
    expect(parseSigned('', 8)).toEqual({ ok: false, error: 'Escribí un valor' });
    expect(parseSigned('xyz', 8)).toEqual({ ok: false, error: 'No es hexadecimal' });
  });
});
