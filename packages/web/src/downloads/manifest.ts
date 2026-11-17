/** Manifiesto de descargas de la app de escritorio (lo genera packages/desktop/scripts/collect-downloads.mjs). */

export type DownloadOs = 'linux' | 'windows';
const KINDS = ['appimage', 'deb', 'rpm', 'nsis', 'portable', 'msi'] as const;
export type DownloadKind = (typeof KINDS)[number];

export interface DownloadEntry {
  os: DownloadOs;
  kind: DownloadKind;
  label: string;
  file: string;
  url: string;
  size: number;
  sha256: string;
  version: string;
}

export interface DownloadsManifest {
  version: string;
  generated: string;
  files: DownloadEntry[];
}

const str = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function parseEntry(raw: unknown): DownloadEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (e.os !== 'linux' && e.os !== 'windows') return null;
  if (!KINDS.includes(e.kind as DownloadKind)) return null;
  if (!str(e.label) || !str(e.file) || !str(e.url) || !str(e.version)) return null;
  if (/[\\/]/.test(e.file) || e.file.includes('..')) return null;
  // Solo URL relativas al sitio (/…) o https: nada de javascript:, data: ni // (protocolo relativo).
  if (!/^\/(?!\/)/.test(e.url) && !/^https:\/\//i.test(e.url)) return null;
  if (typeof e.size !== 'number' || !Number.isFinite(e.size) || e.size < 0) return null;
  if (typeof e.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(e.sha256)) return null;
  return { os: e.os, kind: e.kind as DownloadKind, label: e.label, file: e.file, url: e.url, size: e.size, sha256: e.sha256, version: e.version };
}

/** Manifiesto validado; las entradas inválidas se descartan. `null` si no tiene forma de manifiesto. */
export function parseManifest(json: unknown): DownloadsManifest | null {
  if (typeof json !== 'object' || json === null) return null;
  const m = json as Record<string, unknown>;
  if (!Array.isArray(m.files)) return null;
  const files = m.files.map(parseEntry).filter((e): e is DownloadEntry => e !== null);
  return { version: typeof m.version === 'string' ? m.version : '', generated: typeof m.generated === 'string' ? m.generated : '', files };
}

/** Lee downloads/manifest.json; ante 404, red caída o JSON roto devuelve null (nunca lanza). */
export async function loadManifest(fetchFn: typeof fetch = fetch): Promise<DownloadsManifest | null> {
  try {
    const res = await fetchFn(`${import.meta.env.BASE_URL}downloads/manifest.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    return parseManifest(await res.json());
  } catch {
    return null;
  }
}

export function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb >= 10) return `${Math.round(mb)} MB`;
  if (mb >= 1) return `${(Math.round(mb * 10) / 10).toString().replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
