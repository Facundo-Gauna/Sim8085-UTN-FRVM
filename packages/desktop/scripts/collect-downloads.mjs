#!/usr/bin/env node
// Reúne los instaladores que genera `tauri build` en una carpeta pública y escribe manifest.json.
// Uso: node collect-downloads.mjs [--bundles <dir>] [--out <dir>] [--base-url <url>] [--version x.y.z]
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, classify } from './downloads.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const desktop = resolve(here, '..');
const repo = resolve(desktop, '..', '..');

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const bundles = resolve(args.bundles ?? join(desktop, 'src-tauri', 'target', 'release', 'bundle'));
const out = resolve(args.out ?? join(repo, 'packages', 'web', 'public', 'downloads'));
const baseUrl = args['base-url'] ?? '/downloads/';
const version =
  args.version ?? JSON.parse(readFileSync(join(desktop, 'src-tauri', 'tauri.conf.json'), 'utf8')).version;

/** Archivos instaladores (recursivo) bajo `dir`. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : classify(name) ? [p] : [];
  });
}

const found = walk(bundles);
if (found.length === 0) console.error(`No se encontraron instaladores en ${bundles}`);

mkdirSync(out, { recursive: true });
// Una ejecución nueva reemplaza a las anteriores: se quitan los instaladores viejos (no otros archivos).
for (const name of readdirSync(out)) if (classify(name)) rmSync(join(out, name));

const files = found.map((p) => {
  const name = basename(p);
  copyFileSync(p, join(out, name));
  const sha256 = createHash('sha256').update(readFileSync(p)).digest('hex');
  return { name, size: statSync(p).size, sha256 };
});

const manifest = buildManifest({ files, version, baseUrl, now: new Date() });
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json: ${manifest.files.length} instalador(es) en ${out}`);
