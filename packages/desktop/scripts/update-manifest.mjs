#!/usr/bin/env node
// Apunta los botones de descarga de la web a un release publicado (lo corre CI después de cada tag).
// Uso: node update-manifest.mjs --bundles <dir> --version x.y.z --base-url <url del release> [--manifest <archivo>]
// Ante un release incompleto o inconsistente sale con código 1 sin tocar el manifiesto.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildManifest, classify } from './downloads.mjs';

const KINDS = ['appimage', 'deb', 'rpm', 'nsis', 'portable', 'msi'];
const here = dirname(fileURLToPath(import.meta.url));

function fail(message) {
  console.error(message);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    bundles: { type: 'string' },
    version: { type: 'string' },
    'base-url': { type: 'string' },
    manifest: { type: 'string', default: resolve(here, '../../web/public/downloads/manifest.json') },
  },
});
const { bundles, version, manifest: target } = values;
const baseUrl = values['base-url'];
if (!bundles || !version || !baseUrl) fail('Faltan --bundles, --version o --base-url');
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`La versión debe ser x.y.z y es "${version}"`);

const files = readdirSync(bundles)
  .filter((name) => classify(name))
  .map((name) => {
    const path = join(bundles, name);
    const sha256 = createHash('sha256').update(readFileSync(path)).digest('hex');
    return { name, size: statSync(path).size, sha256 };
  });

const missing = KINDS.filter((kind) => !files.some((f) => classify(f.name).kind === kind));
if (missing.length) fail(`Faltan instaladores: ${missing.join(', ')}`);

const others = files.filter((f) => !f.name.includes(`_${version}_`) && !f.name.includes(`-${version}-`));
if (others.length) fail(`Estos archivos no son de la versión ${version}: ${others.map((f) => f.name).join(', ')}`);

const published = JSON.parse(readFileSync(target, 'utf8')).version;
if (published.localeCompare(version, undefined, { numeric: true }) > 0) {
  fail(`La versión publicada (${published}) es más nueva que ${version}`);
}

const manifest = buildManifest({ files, version, baseUrl, now: new Date() });
writeFileSync(target, JSON.stringify(manifest, null, 2) + '\n');
console.log(`manifest.json: ${published} -> ${version}`);
