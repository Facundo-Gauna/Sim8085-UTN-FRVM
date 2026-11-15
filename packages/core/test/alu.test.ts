import { describe, it, expect } from 'vitest';
import { initialState, packFlags, unpackFlags } from '../src/cpu/state';
import { add8, sub8, and8, or8, xor8, inr8, dcr8, daa, parity } from '../src/cpu/alu';

const F0 = { S: 0, Z: 0, AC: 0, P: 0, CY: 0 } as const;

describe('estado', () => {
  it('initialState', () => {
    const s = initialState(0x2000);
    expect(s.PC).toBe(0x2000);
    expect(s.A).toBe(0);
    expect(s.masks).toEqual({ m55: true, m65: true, m75: true });
    expect(s.halted).toBe(false);
  });
  it('packFlags/unpackFlags', () => {
    const f = { S: 1, Z: 0, AC: 1, P: 1, CY: 1 } as const;
    expect(packFlags(f)).toBe(0b1001_0111);
    expect(unpackFlags(0b1001_0111)).toEqual(f);
    expect(packFlags(F0)).toBe(0b0000_0010);
  });
});

describe('ALU', () => {
  it('parity', () => {
    expect(parity(0)).toBe(1);
    expect(parity(1)).toBe(0);
    expect(parity(0x03)).toBe(1);
  });
  it('add8 + daa ejemplo 1 pag 18', () => {
    const r = add8(0x93, 0x08, 0);
    expect(r.value).toBe(0x9b);
    expect(r.flags.CY).toBe(0);
    expect(r.flags.AC).toBe(0);
    const d = daa(0x9b, { ...F0 });
    expect(d.value).toBe(0x01);
    expect(d.flags.CY).toBe(1);
    expect(d.flags.AC).toBe(1);
  });
  it('add8 + daa ejemplo 2 pag 18', () => {
    const r = add8(0x89, 0x36, 0);
    expect(r.value).toBe(0xbf);
    const d = daa(0xbf, { ...F0 });
    expect(d.value).toBe(0x25);
    expect(d.flags.CY).toBe(1);
  });
  it('add8 con carry y desborde', () => {
    const r = add8(0xff, 0x00, 1);
    expect(r.value).toBe(0);
    expect(r.flags).toMatchObject({ Z: 1, CY: 1, AC: 1, S: 0, P: 1 });
  });
  it('sub8', () => {
    const r = sub8(0x05, 0x07, 0);
    expect(r.value).toBe(0xfe);
    expect(r.flags).toMatchObject({ CY: 1, S: 1, Z: 0 });
    const z = sub8(0x07, 0x07, 0);
    expect(z.value).toBe(0);
    expect(z.flags).toMatchObject({ Z: 1, CY: 0, P: 1 });
  });
  it('sub8 con borrow de entrada', () => {
    const r = sub8(0x05, 0x05, 1);
    expect(r.value).toBe(0xff);
    expect(r.flags.CY).toBe(1);
  });
  it('inr/dcr', () => {
    const i = inr8(0xff);
    expect(i.value).toBe(0);
    expect(i.flags.Z).toBe(1);
    expect('CY' in i.flags).toBe(false);
    const d = dcr8(0x00);
    expect(d.value).toBe(0xff);
    expect(d.flags.S).toBe(1);
    expect('CY' in d.flags).toBe(false);
  });
  it('and/or/xor', () => {
    const a = and8(0xb7, 0xf0);
    expect(a.value).toBe(0xb0);
    expect(a.flags).toMatchObject({ AC: 1, CY: 0 });
    expect(or8(0x0f, 0xf0).flags).toMatchObject({ AC: 0, CY: 0 });
    const x = xor8(0xaa, 0xaa);
    expect(x.value).toBe(0);
    expect(x.flags).toMatchObject({ AC: 0, CY: 0, Z: 1, P: 1 });
  });
});
