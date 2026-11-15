import type { Flags } from './state';

export interface AluOut { value: number; flags: Partial<Flags> }

export function parity(v: number): 0 | 1 {
  let x = v & 0xff, n = 0;
  while (x) { n ^= x & 1; x >>= 1; }
  return (n === 0 ? 1 : 0);
}

function szp(v: number): Pick<Flags, 'S' | 'Z' | 'P'> {
  return { S: ((v >> 7) & 1) as 0 | 1, Z: v === 0 ? 1 : 0, P: parity(v) };
}

export function add8(a: number, b: number, carryIn: 0 | 1): AluOut {
  const sum = a + b + carryIn;
  const value = sum & 0xff;
  return {
    value,
    flags: {
      ...szp(value),
      AC: (((a & 0xf) + (b & 0xf) + carryIn) > 0xf ? 1 : 0),
      CY: sum > 0xff ? 1 : 0,
    },
  };
}

export function sub8(a: number, b: number, borrowIn: 0 | 1): AluOut {
  // El 8085 resta sumando el complemento a 2; CY = préstamo = NOT acarreo.
  const cin = 1 - borrowIn;
  const nb = ~b & 0xff;
  const sum = a + nb + cin;
  const value = sum & 0xff;
  return {
    value,
    flags: {
      ...szp(value),
      AC: (((a & 0xf) + (nb & 0xf) + cin) > 0xf ? 1 : 0),
      CY: sum > 0xff ? 0 : 1,
    },
  };
}

export function and8(a: number, b: number): AluOut {
  const value = a & b & 0xff;
  return { value, flags: { ...szp(value), AC: 1, CY: 0 } };
}

export function or8(a: number, b: number): AluOut {
  const value = (a | b) & 0xff;
  return { value, flags: { ...szp(value), AC: 0, CY: 0 } };
}

export function xor8(a: number, b: number): AluOut {
  const value = (a ^ b) & 0xff;
  return { value, flags: { ...szp(value), AC: 0, CY: 0 } };
}

export function inr8(v: number): AluOut {
  const value = (v + 1) & 0xff;
  return { value, flags: { ...szp(value), AC: ((v & 0xf) + 1) > 0xf ? 1 : 0 } };
}

export function dcr8(v: number): AluOut {
  const value = (v - 1) & 0xff;
  // AC como resta por complemento a 2: (v&0xF) + 0xF
  return { value, flags: { ...szp(value), AC: ((v & 0xf) + 0xf) > 0xf ? 1 : 0 } };
}

export function daa(a: number, f: Flags): AluOut {
  let corr = 0;
  let cy: 0 | 1 = f.CY;
  if ((a & 0xf) > 9 || f.AC) corr |= 0x06;
  if (a > 0x99 || f.CY) { corr |= 0x60; cy = 1; }
  const value = (a + corr) & 0xff;
  return {
    value,
    flags: {
      ...szp(value),
      AC: ((a & 0xf) + (corr & 0xf)) > 0xf ? 1 : 0,
      CY: cy,
    },
  };
}
