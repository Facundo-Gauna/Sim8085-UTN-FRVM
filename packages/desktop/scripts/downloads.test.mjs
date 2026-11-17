import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildManifest, classify } from './downloads.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'collect-downloads.mjs');
const sha = (s) => createHash('sha256').update(s).digest('hex');

test('classify reconoce los instaladores de Tauri y descarta el resto', () => {
  assert.deepEqual(classify('Sim8085_0.1.0_amd64.AppImage'), { os: 'linux', kind: 'appimage' });
  assert.deepEqual(classify('Sim8085_0.1.0_amd64.deb'), { os: 'linux', kind: 'deb' });
  assert.deepEqual(classify('Sim8085-0.1.0-1.x86_64.rpm'), { os: 'linux', kind: 'rpm' });
  assert.deepEqual(classify('Sim8085_0.1.0_x64-setup.exe'), { os: 'windows', kind: 'nsis' });
  assert.deepEqual(classify('Sim8085_0.1.0_x64_en-US.msi'), { os: 'windows', kind: 'msi' });
  assert.deepEqual(classify('Sim8085_0.1.0_x64-portable.zip'), { os: 'windows', kind: 'portable' });
  for (const no of ['Sim8085.AppImage.sig', 'x.tar.gz', 'x.exe', 'x.zip', 'README.md', 'x.deb.txt']) assert.equal(classify(no), null, no);
});

test('buildManifest ordena (Linux primero), arma las URL y es determinista', () => {
  const files = [
    { name: 'W_x64-setup.exe', size: 20, sha256: 'b'.repeat(64) },
    { name: 'L_amd64.deb', size: 10, sha256: 'a'.repeat(64) },
    { name: 'L_amd64.AppImage', size: 30, sha256: 'c'.repeat(64) },
  ];
  const now = new Date('2026-11-16T12:00:00Z');
  const m = buildManifest({ files, version: '0.1.0', baseUrl: '/downloads', now });
  assert.equal(m.version, '0.1.0');
  assert.equal(m.generated, '2026-11-16T12:00:00.000Z');
  assert.deepEqual(m.files.map((f) => f.file), ['L_amd64.AppImage', 'L_amd64.deb', 'W_x64-setup.exe']);
  assert.deepEqual(m.files.map((f) => f.label), ['Linux · AppImage', 'Linux · paquete .deb', 'Windows · instalador (.exe)']);
  assert.equal(m.files[0].url, '/downloads/L_amd64.AppImage');
  assert.equal(m.files[0].size, 30);
  assert.equal(m.files[0].version, '0.1.0');
  assert.deepEqual(buildManifest({ files, version: '0.1.0', baseUrl: '/downloads/', now }), m);
  assert.equal(buildManifest({ files: [], version: '1', baseUrl: 'https://x.org/d/', now }).files.length, 0);
  const abs = buildManifest({ files: [files[1]], version: '1', baseUrl: 'https://x.org/d/', now });
  assert.equal(abs.files[0].url, 'https://x.org/d/L_amd64.deb');
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'dl-'));
  const bundles = join(root, 'bundle');
  mkdirSync(join(bundles, 'deb'), { recursive: true });
  mkdirSync(join(bundles, 'appimage'), { recursive: true });
  writeFileSync(join(bundles, 'deb', 'Sim8085_0.1.0_amd64.deb'), 'contenido deb');
  writeFileSync(join(bundles, 'appimage', 'Sim8085_0.1.0_amd64.AppImage'), 'contenido appimage');
  writeFileSync(join(bundles, 'appimage', 'Sim8085_0.1.0_amd64.AppImage.sig'), 'firma');
  return { root, bundles, out: join(root, 'out') };
}

test('el CLI copia los instaladores, calcula el SHA-256 y no copia las firmas', () => {
  const { bundles, out } = fixture();
  execFileSync('node', [CLI, '--bundles', bundles, '--out', out, '--version', '0.1.0']);
  assert.deepEqual(readdirSync(out).sort(), ['Sim8085_0.1.0_amd64.AppImage', 'Sim8085_0.1.0_amd64.deb', 'manifest.json']);
  const m = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  const deb = m.files.find((f) => f.kind === 'deb');
  assert.equal(deb.sha256, sha('contenido deb'));
  assert.equal(deb.size, Buffer.byteLength('contenido deb'));
  assert.equal(deb.url, '/downloads/Sim8085_0.1.0_amd64.deb');
  assert.equal(m.files.length, 2);
});

test('--base-url cambia el prefijo de las URL', () => {
  const { bundles, out } = fixture();
  execFileSync('node', [CLI, '--bundles', bundles, '--out', out, '--version', '0.1.0', '--base-url', 'https://ejemplo.org/rel/']);
  const m = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  assert.ok(m.files.every((f) => f.url.startsWith('https://ejemplo.org/rel/')));
});

test('sin instaladores deja files vacío, avisa por stderr y sale con código 0', () => {
  const root = mkdtempSync(join(tmpdir(), 'dl-vacio-'));
  const out = join(root, 'out');
  const r = spawnSync('node', [CLI, '--bundles', join(root, 'no-existe'), '--out', out, '--version', '0.1.0'], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /No se encontraron instaladores/);
  assert.ok(existsSync(join(out, 'manifest.json')));
  assert.deepEqual(JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')).files, []);
});

test('una ejecución nueva reemplaza los instaladores viejos de la carpeta de salida', () => {
  const { bundles, out } = fixture();
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'Viejo_0.0.1_amd64.deb'), 'viejo');
  execFileSync('node', [CLI, '--bundles', bundles, '--out', out, '--version', '0.1.0']);
  assert.ok(!existsSync(join(out, 'Viejo_0.0.1_amd64.deb')));
});
