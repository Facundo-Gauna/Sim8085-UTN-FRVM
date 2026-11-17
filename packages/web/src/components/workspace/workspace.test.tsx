import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { createFakeWorkspace, type FakeWorkspace } from '../../state/fakeWorkspace';
import { defaultSession } from '../../state/store';
import type { FileService } from '../../services/fileService';

// jsdom no mide texto: CodeMirror pide rectángulos de Range.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);

const INITIAL = defaultSession.getState();
const s = () => defaultSession.getState();

function desktop(ws: FakeWorkspace): FileService {
  return {
    canPickFolder: true,
    workspace: ws,
    openFiles: vi.fn(() => Promise.resolve([])),
    saveFile: vi.fn(() => Promise.resolve()),
    saveBinary: vi.fn(() => Promise.resolve('x.pdf')),
  };
}

beforeEach(() => {
  defaultSession.setState(INITIAL, true);
  location.hash = '';
  window.matchMedia = vi.fn((query: string) => ({
    matches: false, media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

const key = (k: string, init: KeyboardEventInit = {}) => act(() => void fireEvent.keyDown(window, { key: k, ...init }));
const flush = () => act(async () => void (await Promise.resolve()));

async function openFolder(initial?: Record<string, string>) {
  const ws = createFakeWorkspace(initial ?? { 'a.asm': 'NOP\nHLT\n', 'sub/b.asm': 'MVI A, 1\n' });
  render(<App fileService={desktop(ws)} />);
  await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Abrir carpeta' })));
  await screen.findByRole('tree');
  return ws;
}
const item = (name: string) => screen.getByRole('treeitem', { name: new RegExp(`^${name}`) });

describe('sin carpeta de trabajo (web)', () => {
  it('no hay botón, ni panel, ni diálogos con los atajos de escritorio', () => {
    render(<App fileService={{ ...desktop(createFakeWorkspace()), workspace: undefined, canPickFolder: false }} />);
    expect(screen.queryByRole('button', { name: 'Abrir carpeta' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Archivos' })).toBeNull();
    key('s', { ctrlKey: true, shiftKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('árbol de archivos', () => {
  it('muestra carpetas y archivos con roles de árbol', async () => {
    await openFolder();
    const region = screen.getByRole('region', { name: 'Archivos' });
    expect(within(region).getByText('asm')).toBeTruthy();
    expect(item('sub').getAttribute('aria-expanded')).toBe('true');
    expect(within(item('sub')).getByRole('group')).toBeTruthy();
    expect(item('a.asm')).toBeTruthy();
    expect(screen.getByRole('treeitem', { name: /^b\.asm/ })).toBeTruthy();
  });

  it('Enter sobre un archivo lo abre en una pestaña con su ruta', async () => {
    await openFolder();
    await act(async () => void fireEvent.keyDown(item('a.asm'), { key: 'Enter' }));
    await flush();
    expect(s().files.at(-1)).toMatchObject({ name: 'a.asm', path: 'a.asm' });
    expect(screen.getByRole('tab', { name: /a\.asm/ })).toBeTruthy();
  });

  it('una carpeta se pliega con ArrowLeft y se despliega con ArrowRight', async () => {
    await openFolder();
    fireEvent.keyDown(item('sub'), { key: 'ArrowLeft' });
    expect(item('sub').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('treeitem', { name: /^b\.asm/ })).toBeNull();
    fireEvent.keyDown(item('sub'), { key: 'ArrowRight' });
    expect(item('sub').getAttribute('aria-expanded')).toBe('true');
  });

  it('carpeta vacía: lo dice', async () => {
    const ws = createFakeWorkspace({});
    render(<App fileService={desktop(ws)} />);
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Abrir carpeta' })));
    expect(await screen.findByText('No hay archivos .asm en esta carpeta')).toBeTruthy();
  });

  it('cancelar el cuadro de carpeta no muestra panel ni error', async () => {
    const ws = createFakeWorkspace({}, null);
    render(<App fileService={desktop(ws)} />);
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Abrir carpeta' })));
    expect(screen.queryByRole('region', { name: 'Archivos' })).toBeNull();
    expect(s().fileOpError).toBe('');
    expect(s().workspace).toBeNull();
  });
});

describe('renombrar, borrar y crear', () => {
  it('F2 renombra y la pestaña abierta sigue al nuevo nombre', async () => {
    const ws = await openFolder();
    await act(async () => void fireEvent.keyDown(item('a.asm'), { key: 'Enter' }));
    await flush();
    fireEvent.keyDown(item('a.asm'), { key: 'F2' });
    const dlg = screen.getByRole('dialog', { name: 'Renombrar archivo' });
    const input = within(dlg).getByLabelText('Nombre') as HTMLInputElement;
    expect(input.value).toBe('a.asm');
    fireEvent.change(input, { target: { value: 'nuevo' } });
    await act(async () => void fireEvent.click(within(dlg).getByRole('button', { name: 'Aceptar' })));
    expect(ws.files.has('nuevo.asm')).toBe(true);
    expect(ws.files.has('a.asm')).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(s().files.some((f) => f.path === 'nuevo.asm')).toBe(true);
  });

  it('renombrar a un nombre existente muestra el error junto al campo y no cierra', async () => {
    const ws = await openFolder({ 'a.asm': 'A', 'b.asm': 'B' });
    fireEvent.keyDown(item('a.asm'), { key: 'F2' });
    const dlg = screen.getByRole('dialog', { name: 'Renombrar archivo' });
    fireEvent.change(within(dlg).getByLabelText('Nombre'), { target: { value: 'b.asm' } });
    await act(async () => void fireEvent.click(within(dlg).getByRole('button', { name: 'Aceptar' })));
    expect(within(dlg).getByRole('alert').textContent).toBe('El archivo ya existe');
    expect(within(dlg).getByLabelText('Nombre').getAttribute('aria-invalid')).toBe('true');
    expect(ws.files.get('a.asm')).toBe('A');
  });

  it('nombres inválidos se rechazan en el diálogo sin llamar al disco', async () => {
    const ws = await openFolder();
    const before = ws.calls.length;
    fireEvent.keyDown(item('a.asm'), { key: 'F2' });
    const dlg = screen.getByRole('dialog');
    for (const bad of ['', '../x', 'a\\b', '/x']) {
      fireEvent.change(within(dlg).getByLabelText('Nombre'), { target: { value: bad } });
      await act(async () => void fireEvent.click(within(dlg).getByRole('button', { name: 'Aceptar' })));
      expect(within(dlg).getByRole('alert').textContent, JSON.stringify(bad)).toMatch(/Escribí un nombre|Nombre no permitido/);
    }
    expect(ws.calls.length).toBe(before);
  });

  it('Supr pide confirmación con el nombre; Escape cancela y Borrar elimina y cierra la pestaña', async () => {
    const ws = await openFolder();
    await act(async () => void fireEvent.keyDown(item('a.asm'), { key: 'Enter' }));
    await flush();
    fireEvent.keyDown(item('a.asm'), { key: 'Delete' });
    const dlg = screen.getByRole('alertdialog');
    expect(dlg.textContent).toContain('¿Borrar «a.asm»? No se puede deshacer.');
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(ws.files.has('a.asm')).toBe(true);
    fireEvent.keyDown(item('a.asm'), { key: 'Delete' });
    await act(async () => void fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Borrar' })));
    expect(ws.files.has('a.asm')).toBe(false);
    expect(s().files.some((f) => f.path === 'a.asm')).toBe(false);
  });

  it('Nuevo archivo pide el nombre, agrega .asm y abre el archivo', async () => {
    const ws = await openFolder();
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo archivo' }));
    const dlg = screen.getByRole('dialog', { name: 'Nuevo archivo' });
    fireEvent.change(within(dlg).getByLabelText('Nombre'), { target: { value: 'prueba' } });
    await act(async () => void fireEvent.click(within(dlg).getByRole('button', { name: 'Aceptar' })));
    expect(ws.files.has('prueba.asm')).toBe(true);
    expect(s().files.at(-1)).toMatchObject({ name: 'prueba.asm', path: 'prueba.asm' });
  });
});

describe('guardar', () => {
  it('Ctrl+S en una pestaña con ruta la guarda', async () => {
    const ws = await openFolder();
    await act(async () => void fireEvent.keyDown(item('a.asm'), { key: 'Enter' }));
    await flush();
    act(() => s().setText(s().activeId, 'NOP\nNOP\n'));
    key('s', { ctrlKey: true });
    await flush();
    expect(ws.files.get('a.asm')).toBe('NOP\nNOP\n');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Ctrl+S en una pestaña nueva abre "Guardar como" y guarda con ese nombre', async () => {
    const ws = await openFolder();
    act(() => s().newFile());
    act(() => s().setText(s().activeId, 'HLT'));
    key('s', { ctrlKey: true });
    const dlg = await screen.findByRole('dialog', { name: 'Guardar como' });
    fireEvent.change(within(dlg).getByLabelText('Nombre'), { target: { value: 'guardado' } });
    await act(async () => void fireEvent.click(within(dlg).getByRole('button', { name: 'Aceptar' })));
    expect(ws.files.get('guardado.asm')).toBe('HLT');
    expect(s().files.at(-1)).toMatchObject({ path: 'guardado.asm' });
  });

  it('Ctrl+Shift+S abre "Guardar como" aunque la pestaña ya tenga ruta', async () => {
    await openFolder();
    await act(async () => void fireEvent.keyDown(item('a.asm'), { key: 'Enter' }));
    await flush();
    key('s', { ctrlKey: true, shiftKey: true });
    const dlg = await screen.findByRole('dialog', { name: 'Guardar como' });
    expect((within(dlg).getByLabelText('Nombre') as HTMLInputElement).value).toBe('a.asm');
  });

  it('un error de escritura se muestra en el panel y la pestaña sigue modificada', async () => {
    const ws = await openFolder();
    await act(async () => void fireEvent.keyDown(item('a.asm'), { key: 'Enter' }));
    await flush();
    act(() => s().setText(s().activeId, 'CAMBIO'));
    ws.failNext('write', 'No hay espacio en el disco');
    key('s', { ctrlKey: true });
    await flush();
    expect(within(screen.getByRole('region', { name: 'Archivos' })).getByRole('alert').textContent).toBe('No hay espacio en el disco');
    expect(screen.getByRole('tab', { name: /a\.asm/ }).textContent).toMatch(/modificado/);
    expect(s().files.at(-1)!.text).toBe('CAMBIO');
  });

  it('Ctrl+O abre el cuadro de carpeta en escritorio', async () => {
    const ws = createFakeWorkspace({ 'a.asm': 'NOP' });
    render(<App fileService={desktop(ws)} />);
    key('o', { ctrlKey: true });
    await flush();
    expect(ws.calls).toContain('pickFolder');
  });
});
