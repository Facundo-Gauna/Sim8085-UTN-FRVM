/** Conversión de bases para el Toolbox (spec §6.10): hexa, decimal, binario y BCD empaquetado. */
export type Conv = { ok: true; value: number } | { ok: false; error: string };
export const MAX16 = 0xffff;

const EMPTY: Conv = { ok: false, error: 'Escribí un valor' };
const fail = (error: string): Conv => ({ ok: false, error });
const MAX_BITS = 'Máximo 16 bits (FFFFh)';

export function parseHexText(t: string): Conv {
  let s = t.trim();
  if (s === '') return EMPTY;
  s = s.replace(/^0x/i, '').replace(/h$/i, '');
  if (!/^[0-9a-f]+$/i.test(s)) return fail('No es hexadecimal');
  const v = parseInt(s, 16);
  return v > MAX16 ? fail(MAX_BITS) : { ok: true, value: v };
}

export function parseDecText(t: string): Conv {
  const s = t.trim();
  if (s === '') return EMPTY;
  if (!/^\d+$/.test(s)) return fail('No es decimal');
  const v = Number(s);
  return v > MAX16 ? fail('Máximo 65535') : { ok: true, value: v };
}

export function parseBinText(t: string): Conv {
  const s = t.replace(/[\s_]/g, '');
  if (s === '') return EMPTY;
  if (!/^[01]+$/.test(s)) return fail('No es binario');
  return s.length > 16 ? fail(MAX_BITS) : { ok: true, value: parseInt(s, 2) };
}

export function parseBcdText(t: string): Conv {
  const s = t.replace(/[\s_]/g, '');
  if (s === '') return EMPTY;
  if (!/^[01]+$/.test(s)) return fail('No es binario');
  const padded = s.padStart(Math.ceil(s.length / 4) * 4, '0');
  const groups = padded.match(/.{4}/g)!;
  for (const g of groups) if (parseInt(g, 2) > 9) return fail(`Grupo BCD inválido: ${g}`);
  if (groups.length > 4) return fail('BCD: máximo 4 dígitos');
  return { ok: true, value: Number(groups.map((g) => parseInt(g, 2)).join('')) };
}

const nibbles = (bits: string) => bits.match(/.{4}/g)!.join(' ');

export const toHex = (v: number) => `${v.toString(16).toUpperCase().padStart(v <= 0xff ? 2 : 4, '0')}h`;
export const toDec = (v: number) => String(v);
export const toBin = (v: number) => nibbles(v.toString(2).padStart(v <= 0xff ? 8 : 16, '0'));
export function toBcd(v: number): string {
  if (v > 9999) return '';
  return String(v).split('').map((d) => Number(d).toString(2).padStart(4, '0')).join(' ');
}
