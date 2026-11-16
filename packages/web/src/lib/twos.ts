/** Complemento a 2 y lectura con y sin signo (Toolbox). */
import { parseBinText, parseHexText, type Conv } from './convert';

export interface TwosView {
  bits: 8 | 16;
  unsigned: number;
  signed: number;
  ones: number;
  twos: number;
  binary: string;
}

export function analyze(value: number, bits: 8 | 16): TwosView {
  const size = 2 ** bits;
  const mask = size - 1;
  const unsigned = value & mask;
  const signed = unsigned >= size / 2 ? unsigned - size : unsigned;
  const ones = ~unsigned & mask;
  const twos = (ones + 1) & mask;
  const binary = unsigned.toString(2).padStart(bits, '0').match(/.{4}/g)!.join(' ');
  return { bits, unsigned, signed, ones, twos, binary };
}

/** Admite -5, +5, 5, 0FBh, 0xFB y 11111011b; decimal negativo se pasa a complemento a 2. */
export function parseSigned(t: string, bits: 8 | 16): Conv {
  const s = t.trim();
  const range: Conv = { ok: false, error: `Fuera de rango para ${bits} bits` };
  if (s === '') return { ok: false, error: 'Escribí un valor' };
  const mask = 2 ** bits - 1;
  if (/^[+-]?\d+$/.test(s)) {
    const n = Number(s);
    if (n < -(2 ** (bits - 1)) || n > mask) return range;
    return { ok: true, value: n & mask };
  }
  const bin = /^([01\s_]+)b$/i.exec(s);
  const r = bin ? parseBinText(bin[1]!) : parseHexText(s);
  if (!r.ok) return r.error.startsWith('Máximo') ? range : r;
  return r.value > mask ? range : r;
}
