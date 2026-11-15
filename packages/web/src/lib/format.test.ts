import { describe, expect, it } from 'vitest';
import { allBases8, fmt16, fmt8, parseAddress, parseByte, parsePort } from './format';

describe('fmt8', () => {
  it('formatea en las tres bases', () => {
    expect(fmt8(0x3a, 'hex')).toBe('3Ah');
    expect(fmt8(58, 'dec')).toBe('58');
    expect(fmt8(0x3a, 'bin')).toBe('0011 1010');
    expect(fmt8(0, 'bin')).toBe('0000 0000');
    expect(fmt8(0, 'hex')).toBe('00h');
  });
});

describe('fmt16', () => {
  it('formatea en las tres bases', () => {
    expect(fmt16(0x2000, 'hex')).toBe('2000h');
    expect(fmt16(0x2000, 'dec')).toBe('8192');
    expect(fmt16(0x2000, 'bin')).toBe('0010 0000 0000 0000');
    expect(fmt16(0xffff, 'dec')).toBe('65535');
    expect(fmt16(0xab, 'hex')).toBe('00ABh');
  });
});

describe('allBases8', () => {
  it('incluye el valor con signo en complemento a dos', () => {
    expect(allBases8(0xf6)).toEqual({ hex: 'F6h', dec: '246', bin: '1111 0110', signed: '-10' });
    expect(allBases8(0x7f).signed).toBe('127');
    expect(allBases8(0x80).signed).toBe('-128');
    expect(allBases8(0).signed).toBe('0');
  });
});

const ok = (value: number) => ({ ok: true, value });

describe('parseAddress', () => {
  it('acepta formatos y límites', () => {
    expect(parseAddress('2000')).toEqual(ok(0x2000));
    expect(parseAddress('2000h')).toEqual(ok(0x2000));
    expect(parseAddress('2000H')).toEqual(ok(0x2000));
    expect(parseAddress('0x2000')).toEqual(ok(0x2000));
    expect(parseAddress('0X2a00')).toEqual(ok(0x2a00));
    expect(parseAddress('  2A00h ')).toEqual(ok(0x2a00));
    expect(parseAddress('2a00')).toEqual(ok(0x2a00));
    expect(parseAddress('0')).toEqual(ok(0));
    expect(parseAddress('FFFF')).toEqual(ok(0xffff));
  });
  it('rechaza fuera de rango', () => {
    const r = parseAddress('10000');
    expect(r).toEqual({ ok: false, error: 'Dirección fuera de rango (0000h–FFFFh)' });
  });
  it('rechaza entradas inválidas', () => {
    const msg = 'Escribí un número hexadecimal';
    for (const t of ['xyz', '', '   ', '20hh', '-1', '0x', 'h', '2 0']) {
      expect(parseAddress(t)).toEqual({ ok: false, error: msg });
    }
  });
});

describe('parseByte', () => {
  it('acepta formatos y límites', () => {
    expect(parseByte('0')).toEqual(ok(0));
    expect(parseByte('FF')).toEqual(ok(0xff));
    expect(parseByte('ffh')).toEqual(ok(0xff));
    expect(parseByte('0xFF')).toEqual(ok(0xff));
    expect(parseByte(' 3A ')).toEqual(ok(0x3a));
  });
  it('rechaza fuera de rango', () => {
    expect(parseByte('100')).toEqual({ ok: false, error: 'Dato fuera de rango (00h–FFh)' });
    expect(parseByte('1FF')).toEqual({ ok: false, error: 'Dato fuera de rango (00h–FFh)' });
  });
  it('rechaza entradas inválidas', () => {
    for (const t of ['', '   ', '20hh', '-1', 'zz']) {
      expect(parseByte(t)).toEqual({ ok: false, error: 'Escribí un número hexadecimal' });
    }
  });
});

describe('parsePort', () => {
  it('acepta formatos y límites', () => {
    expect(parsePort('0')).toEqual(ok(0));
    expect(parsePort('FF')).toEqual(ok(0xff));
    expect(parsePort('0x10')).toEqual(ok(0x10));
    expect(parsePort('10h')).toEqual(ok(0x10));
  });
  it('rechaza fuera de rango e inválidos', () => {
    expect(parsePort('100')).toEqual({ ok: false, error: 'Puerto fuera de rango (00h–FFh)' });
    expect(parsePort('-1')).toEqual({ ok: false, error: 'Escribí un número hexadecimal' });
    expect(parsePort('  ')).toEqual({ ok: false, error: 'Escribí un número hexadecimal' });
    expect(parsePort('20hh')).toEqual({ ok: false, error: 'Escribí un número hexadecimal' });
  });
});
