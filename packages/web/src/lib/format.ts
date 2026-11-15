export type Base = 'hex' | 'dec' | 'bin';
export type Parsed = { ok: true; value: number } | { ok: false; error: string };

const hex = (v: number, digits: number) => v.toString(16).toUpperCase().padStart(digits, '0');

const bin = (v: number, bits: number) =>
  v
    .toString(2)
    .padStart(bits, '0')
    .replace(/(.{4})(?=.)/g, '$1 ');

function fmt(v: number, base: Base, digits: number): string {
  if (base === 'hex') return `${hex(v, digits)}h`;
  if (base === 'dec') return String(v);
  return bin(v, digits * 4);
}

export function fmt8(v: number, base: Base): string {
  return fmt(v & 0xff, base, 2);
}

export function fmt16(v: number, base: Base): string {
  return fmt(v & 0xffff, base, 4);
}

export function allBases8(v: number): { hex: string; dec: string; bin: string; signed: string } {
  const b = v & 0xff;
  return {
    hex: fmt8(b, 'hex'),
    dec: fmt8(b, 'dec'),
    bin: fmt8(b, 'bin'),
    signed: String(b >= 0x80 ? b - 0x100 : b),
  };
}

const NOT_HEX = 'Escribí un número hexadecimal';

function parseHex(text: string, max: number, rangeError: string): Parsed {
  let t = text.trim();
  if (/^0x/i.test(t)) t = t.slice(2);
  else if (/h$/i.test(t)) t = t.slice(0, -1);
  if (!/^[0-9a-fA-F]+$/.test(t)) return { ok: false, error: NOT_HEX };
  const value = parseInt(t, 16);
  if (value > max) return { ok: false, error: rangeError };
  return { ok: true, value };
}

export function parseAddress(text: string): Parsed {
  return parseHex(text, 0xffff, 'Dirección fuera de rango (0000h–FFFFh)');
}

export function parseByte(text: string): Parsed {
  return parseHex(text, 0xff, 'Dato fuera de rango (00h–FFh)');
}

export function parsePort(text: string): Parsed {
  return parseHex(text, 0xff, 'Puerto fuera de rango (00h–FFh)');
}
