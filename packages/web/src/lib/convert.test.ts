import { describe, expect, it } from 'vitest';
import { parseBcdText, parseBinText, parseDecText, parseHexText, toBcd, toBin, toDec, toHex } from './convert';

const ok = (value: number) => ({ ok: true, value });
const err = (error: string) => ({ ok: false, error });

describe('parse*', () => {
  it('hexa: con y sin sufijo, 0x', () => {
    expect(parseHexText('3A')).toEqual(ok(58));
    expect(parseHexText('3Ah')).toEqual(ok(58));
    expect(parseHexText(' 0x3a ')).toEqual(ok(58));
    expect(parseHexText('FFFFh')).toEqual(ok(0xffff));
  });
  it('hexa: errores', () => {
    expect(parseHexText('1FFFF')).toEqual(err('Máximo 16 bits (FFFFh)'));
    expect(parseHexText('xyz')).toEqual(err('No es hexadecimal'));
    expect(parseHexText('h')).toEqual(err('No es hexadecimal'));
    expect(parseHexText('')).toEqual(err('Escribí un valor'));
    expect(parseHexText('   ')).toEqual(err('Escribí un valor'));
  });
  it('decimal', () => {
    expect(parseDecText('58')).toEqual(ok(58));
    expect(parseDecText('65535')).toEqual(ok(65535));
    expect(parseDecText('65536')).toEqual(err('Máximo 65535'));
    expect(parseDecText('-1')).toEqual(err('No es decimal'));
    expect(parseDecText('1.5')).toEqual(err('No es decimal'));
    expect(parseDecText('')).toEqual(err('Escribí un valor'));
  });
  it('binario con espacios y guiones bajos', () => {
    expect(parseBinText('0011 1010')).toEqual(ok(58));
    expect(parseBinText('0011_1010')).toEqual(ok(58));
    expect(parseBinText('102')).toEqual(err('No es binario'));
    expect(parseBinText('1'.repeat(17))).toEqual(err('Máximo 16 bits (FFFFh)'));
    expect(parseBinText('')).toEqual(err('Escribí un valor'));
  });
  it('BCD empaquetado', () => {
    expect(parseBcdText('0101 1000')).toEqual(ok(58));
    expect(parseBcdText('0101')).toEqual(ok(5));
    expect(parseBcdText('1001 1001 1001 1001')).toEqual(ok(9999));
    expect(parseBcdText('1010')).toEqual(err('Grupo BCD inválido: 1010'));
    expect(parseBcdText('0001 1111')).toEqual(err('Grupo BCD inválido: 1111'));
    expect(parseBcdText('0001 0000 0000 0000 0000')).toEqual(err('BCD: máximo 4 dígitos'));
    expect(parseBcdText('12')).toEqual(err('No es binario'));
    expect(parseBcdText('')).toEqual(err('Escribí un valor'));
  });
});

describe('to*', () => {
  it('formatos', () => {
    expect(toHex(0x3a)).toBe('3Ah');
    expect(toHex(0x1234)).toBe('1234h');
    expect(toHex(0)).toBe('00h');
    expect(toDec(58)).toBe('58');
    expect(toBin(0x3a)).toBe('0011 1010');
    expect(toBin(0x1234)).toBe('0001 0010 0011 0100');
    expect(toBcd(58)).toBe('0101 1000');
    expect(toBcd(5)).toBe('0101');
    expect(toBcd(9999)).toBe('1001 1001 1001 1001');
    expect(toBcd(10000)).toBe('');
  });
});
