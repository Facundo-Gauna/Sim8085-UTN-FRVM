export type NumResult = { ok: true; value: number } | { ok: false; error: string };

const MAX = 0xffff;

/**
 * Interpreta un literal numérico del ensamblador (sin distinguir mayúsculas):
 * hex `…H` (debe empezar con dígito: `0A1H`), binario `…B`, decimal sin sufijo.
 * Devuelve `null` si no parece número (puede ser un símbolo, p. ej. `A1H`).
 * Rango aceptado: 0..0xFFFF; el chequeo de 8 bits es cosa del ensamblador.
 */
export function parseNumber(text: string): NumResult | null {
  const t = text.trim().toUpperCase();
  let value: number;
  if (/^[0-9][0-9A-F]*H$/.test(t)) value = parseInt(t.slice(0, -1), 16);
  else if (/^[01]+B$/.test(t)) value = parseInt(t.slice(0, -1), 2);
  else if (/^[0-9]+$/.test(t)) value = parseInt(t, 10);
  else return null;
  if (value > MAX) {
    return { ok: false, error: `El número ${text.trim()} está fuera de rango (máximo 0FFFFH = 65535)` };
  }
  return { ok: true, value };
}
