// Lógica pura de las descargas de la app de escritorio (sin tocar el disco): clasificar instaladores y armar el manifiesto.

const KINDS = {
  appimage: { os: 'linux', label: 'Linux · AppImage', order: 0 },
  deb: { os: 'linux', label: 'Linux · paquete .deb', order: 1 },
  rpm: { os: 'linux', label: 'Linux · paquete .rpm', order: 2 },
  nsis: { os: 'windows', label: 'Windows · instalador (.exe)', order: 3 },
  msi: { os: 'windows', label: 'Windows · instalador (.msi)', order: 4 },
};

/** Tipo de instalador por nombre de archivo, o null si no es un instalador (firmas, tar.gz, etc.). */
export function classify(fileName) {
  let kind = null;
  if (/\.AppImage$/i.test(fileName)) kind = 'appimage';
  else if (/\.deb$/i.test(fileName)) kind = 'deb';
  else if (/\.rpm$/i.test(fileName)) kind = 'rpm';
  else if (/-setup\.exe$/i.test(fileName)) kind = 'nsis';
  else if (/\.msi$/i.test(fileName)) kind = 'msi';
  return kind ? { os: KINDS[kind].os, kind } : null;
}

/** Manifiesto determinista: Linux primero, luego Windows; URL = baseUrl + nombre. */
export function buildManifest({ files, version, baseUrl, now }) {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const entries = files
    .map((f) => ({ f, c: classify(f.name) }))
    .filter((x) => x.c)
    .sort((a, b) => KINDS[a.c.kind].order - KINDS[b.c.kind].order || a.f.name.localeCompare(b.f.name))
    .map(({ f, c }) => ({
      os: c.os,
      kind: c.kind,
      label: KINDS[c.kind].label,
      file: f.name,
      url: base + encodeURIComponent(f.name),
      size: f.size,
      sha256: f.sha256,
      version,
    }));
  return { version, generated: now.toISOString(), files: entries };
}
