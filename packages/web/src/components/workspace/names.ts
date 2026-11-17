/** Validación de nombres de archivo del diálogo (la defensa real está en Rust; esto es la ayuda en pantalla). */
export type NameResult = { ok: true; name: string } | { ok: false; error: string };

export function normalizeName(raw: string, opts: { allowDirs: boolean }): NameResult {
  const name = raw.trim();
  if (name === '') return { ok: false, error: 'Escribí un nombre' };
  const parts = name.split('/');
  const bad =
    /[\\:\0]/.test(name) ||
    name.startsWith('/') ||
    parts.some((p) => p === '' || p === '.' || p === '..') ||
    (!opts.allowDirs && parts.length > 1);
  if (bad) return { ok: false, error: 'Nombre no permitido' };
  return { ok: true, name: /\.asm$/i.test(name) ? name : `${name}.asm` };
}

export const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
export const baseOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);
