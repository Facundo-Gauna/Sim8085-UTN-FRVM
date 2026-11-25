import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'update-manifest.mjs');
const BASE = 'https://ejemplo.org/releases/download/v0.4.0/';
const names = (v) => [
  `Sim8085_${v}_amd64.AppImage`,
  `Sim8085_${v}_amd64.deb`,
  `Sim8085-${v}-1.x86_64.rpm`,
  `Sim8085_${v}_x64-setup.exe`,
  `Sim8085_${v}_x64-portable.zip`,
  `Sim8085_${v}_x64_en-US.msi`,
];

/** Carpeta con instaladores falsos y un manifiesto ya publicado. */
function run({ files = names('0.4.0'), version = '0.4.0', published = '0.3.0' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'um-'));
  for (const f of files) writeFileSync(join(root, f), f);
  const manifest = join(root, 'publicado.json');
  const before = JSON.stringify({ version: published, files: [] });
  writeFileSync(manifest, before);
  const r = spawnSync('node', [CLI, '--bundles', root, '--manifest', manifest, '--version', version, '--base-url', BASE], { encoding: 'utf8' });
  return { r, before, after: readFileSync(manifest, 'utf8') };
}

test('con el release completo reescribe el manifiesto', () => {
  const { r, after } = run();
  assert.equal(r.status, 0, r.stderr);
  const m = JSON.parse(after);
  assert.equal(m.version, '0.4.0');
  assert.equal(m.files.length, 6);
  assert.ok(m.files.every((f) => f.url.startsWith(BASE)));
});

test('volver a publicar la misma versión está permitido', () => {
  assert.equal(run({ published: '0.4.0' }).r.status, 0);
});

for (const [caso, opciones, mensaje] of [
  ['falta un instalador', { files: names('0.4.0').slice(1) }, /Faltan instaladores: appimage/],
  ['la versión de los archivos no es la del tag', { files: names('0.3.0') }, /no son de la versión 0\.4\.0/],
  ['la versión publicada es más nueva', { published: '0.10.0' }, /más nueva/],
  ['la versión no es x.y.z', { version: '0.4.0-rc1' }, /x\.y\.z/],
]) {
  test(`${caso}: falla y no toca el manifiesto`, () => {
    const { r, before, after } = run(opciones);
    assert.equal(r.status, 1);
    assert.match(r.stderr, mensaje);
    assert.equal(after, before);
  });
}
