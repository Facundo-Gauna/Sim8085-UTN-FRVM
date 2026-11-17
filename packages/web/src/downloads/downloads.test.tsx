import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Notice } from '../components/Notice';
import { Downloads } from './Downloads';
import { formatSize, loadManifest, parseManifest } from './manifest';

afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

const entry = (over: Record<string, unknown> = {}) => ({
  os: 'linux', kind: 'appimage', label: 'Linux · AppImage', file: 'Sim8085_0.1.0_amd64.AppImage',
  url: '/downloads/Sim8085_0.1.0_amd64.AppImage', size: 98 * 1024 * 1024, sha256: 'a'.repeat(64), version: '0.1.0', ...over,
});
const manifest = (files: unknown[]) => ({ version: '0.1.0', generated: '2026-11-16T00:00:00.000Z', files });
const okFetch = (body: unknown) => vi.fn((..._args: unknown[]) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response));

describe('parseManifest', () => {
  it('acepta un manifiesto válido', () => {
    const m = parseManifest(manifest([entry()]))!;
    expect(m.files).toHaveLength(1);
    expect(m.version).toBe('0.1.0');
  });

  it('rechaza lo que no tiene forma de manifiesto', () => {
    for (const bad of [null, undefined, 3, 'x', {}, { files: 'no' }, { files: {} }]) expect(parseManifest(bad), String(bad)).toBeNull();
  });

  it('descarta entradas inválidas y URLs peligrosas, conserva las válidas', () => {
    const m = parseManifest(
      manifest([
        entry(),
        entry({ url: 'javascript:alert(1)' }),
        entry({ url: 'http://insegura.org/x.deb' }),
        entry({ url: '//evil.org/x.deb' }),
        entry({ url: 'data:text/html,x' }),
        entry({ os: 'macos' }),
        entry({ kind: 'dmg' }),
        entry({ sha256: 'zz' }),
        entry({ size: -1 }),
        entry({ file: '../x.deb' }),
        entry({ url: 'https://ejemplo.org/rel/Sim8085.deb', kind: 'deb', file: 'Sim8085.deb' }),
        'basura',
      ]),
    )!;
    expect(m.files.map((f) => f.url)).toEqual(['/downloads/Sim8085_0.1.0_amd64.AppImage', 'https://ejemplo.org/rel/Sim8085.deb']);
  });
});

describe('loadManifest', () => {
  it('404, red caída y JSON roto devuelven null', async () => {
    expect(await loadManifest(vi.fn(() => Promise.resolve({ ok: false, status: 404 } as Response)))).toBeNull();
    expect(await loadManifest(vi.fn(() => Promise.reject(new Error('red'))))).toBeNull();
    expect(
      await loadManifest(vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.reject(new Error('roto')) } as Response))),
    ).toBeNull();
  });

  it('pide downloads/manifest.json y devuelve el manifiesto', async () => {
    const f = okFetch(manifest([entry()]));
    const m = await loadManifest(f);
    expect(String(f.mock.calls[0]![0])).toMatch(/downloads\/manifest\.json$/);
    expect(m!.files).toHaveLength(1);
  });
});

describe('formatSize', () => {
  it('KB y MB legibles', () => {
    expect(formatSize(98 * 1024 * 1024)).toBe('98 MB');
    expect(formatSize(5.5 * 1024 * 1024)).toBe('5,5 MB');
    expect(formatSize(300 * 1024)).toBe('300 KB');
    expect(formatSize(10)).toBe('1 KB');
  });
});

describe('<Downloads />', () => {
  it('solo Linux: botón con tamaño y hash, y aviso de que falta Windows', async () => {
    render(<Downloads fetchFn={okFetch(manifest([entry()]))} />);
    const linux = (await screen.findByRole('group', { name: 'Linux' })) as HTMLElement;
    const link = within(linux).getByRole('link', { name: /Descargar Linux · AppImage/ });
    expect(link.getAttribute('href')).toBe('/downloads/Sim8085_0.1.0_amd64.AppImage');
    expect(link.hasAttribute('download')).toBe(true);
    expect(linux.textContent).toContain('98 MB');
    expect(linux.textContent).toContain('a'.repeat(64));
    expect(within(screen.getByRole('group', { name: 'Windows' })).getByText('Todavía no hay instalador de Windows')).toBeTruthy();
  });

  it('sin manifiesto: avisa de ambos sistemas sin romper', async () => {
    render(<Downloads fetchFn={vi.fn(() => Promise.reject(new Error('x')))} />);
    await waitFor(() => expect(screen.getByText('Todavía no hay instalador de Linux')).toBeTruthy());
    expect(screen.getByText('Todavía no hay instalador de Windows')).toBeTruthy();
  });

  it('manifiesto con files vacío también', async () => {
    render(<Downloads fetchFn={okFetch(manifest([]))} />);
    await waitFor(() => expect(screen.getByText('Todavía no hay instalador de Linux')).toBeTruthy());
  });

  it('mientras carga lo dice en una región de estado', () => {
    render(<Downloads fetchFn={vi.fn(() => new Promise<Response>(() => {}))} />);
    expect(screen.getByRole('status').textContent).toMatch(/Buscando instaladores/);
  });

  it('en la app de escritorio dice que ya la estás usando y no pide nada', () => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    const f = okFetch(manifest([entry()]));
    render(<Downloads fetchFn={f} />);
    expect(screen.getByText('Ya estás usando la app de escritorio')).toBeTruthy();
    expect(f).not.toHaveBeenCalled();
  });
});

describe('<Notice />', () => {
  it('en la web ofrece descargar la app; en el escritorio no', () => {
    const { unmount } = render(<Notice />);
    const link = screen.getByRole('link', { name: 'Descargá la app de escritorio' });
    expect(link.getAttribute('href')).toBe('#/documentacion/instalacion');
    unmount();
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    render(<Notice />);
    expect(screen.queryByRole('link', { name: 'Descargá la app de escritorio' })).toBeNull();
  });
});
