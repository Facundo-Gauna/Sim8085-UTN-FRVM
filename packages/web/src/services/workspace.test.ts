import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTauriWorkspace, errorText, type TreeNode } from './workspace';
import { createDesktopFileService, isDesktop } from './desktop';

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

const ok = (value: unknown = undefined) => vi.fn(() => Promise.resolve(value));

describe('createTauriWorkspace', () => {
  it.each([
    ['pickFolder', [], 'pick_folder', undefined],
    ['current', [], 'current_folder', undefined],
    ['tree', [], 'list_tree', undefined],
    ['read', ['a.asm'], 'read_file', { path: 'a.asm' }],
    ['write', ['a.asm', 'NOP'], 'write_file', { path: 'a.asm', text: 'NOP' }],
    ['create', ['a.asm'], 'create_file', { path: 'a.asm' }],
    ['rename', ['a.asm', 'b.asm'], 'rename_path', { from: 'a.asm', to: 'b.asm' }],
    ['remove', ['a.asm'], 'delete_file', { path: 'a.asm' }],
  ] as const)('%s llama a %s con los argumentos exactos', async (method, args, cmd, payload) => {
    const invoke = ok(null);
    const ws = createTauriWorkspace(invoke) as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    await ws[method]!(...args);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(cmd, payload);
  });

  it('devuelve lo que responde Rust (carpeta, árbol y texto)', async () => {
    const tree: TreeNode[] = [{ name: 'a.asm', path: 'a.asm', kind: 'file' }];
    const invoke = vi.fn((cmd: string) =>
      Promise.resolve(cmd === 'list_tree' ? tree : cmd === 'read_file' ? 'NOP' : cmd === 'pick_folder' ? { name: 'asm' } : null),
    );
    const ws = createTauriWorkspace(invoke);
    expect(await ws.pickFolder()).toEqual({ name: 'asm' });
    expect(await ws.tree()).toEqual(tree);
    expect(await ws.read('a.asm')).toBe('NOP');
    expect(await ws.current()).toBeNull();
  });

  it('pickFolder cancelado devuelve null', async () => {
    expect(await createTauriWorkspace(ok(null)).pickFolder()).toBeNull();
  });

  it('un error de Rust (string) llega como Error con ese texto', async () => {
    const ws = createTauriWorkspace(vi.fn(() => Promise.reject('Ruta no permitida')));
    await expect(ws.read('../x.asm')).rejects.toThrow('Ruta no permitida');
  });

  it('un invoke que lanza de forma síncrona también se convierte en rechazo', async () => {
    const ws = createTauriWorkspace(() => {
      throw new Error('boom');
    });
    await expect(ws.tree()).rejects.toThrow('boom');
  });
});

describe('errorText', () => {
  it('normaliza string, Error, objeto con message y desconocidos', () => {
    expect(errorText('x')).toBe('x');
    expect(errorText(new Error('y'))).toBe('y');
    expect(errorText({ message: 'z' })).toBe('z');
    expect(errorText(42)).toBe('Error desconocido');
    expect(errorText(null)).toBe('Error desconocido');
    expect(errorText({})).toBe('Error desconocido');
  });
});

describe('isDesktop y el servicio de escritorio', () => {
  it('isDesktop depende de __TAURI_INTERNALS__', () => {
    expect(isDesktop()).toBe(false);
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    expect(isDesktop()).toBe(true);
  });

  it('expone la carpeta de trabajo y guarda binarios con save_binary', async () => {
    const invoke = ok('ej1-assembler.pdf');
    const fs = createDesktopFileService(invoke);
    expect(fs.canPickFolder).toBe(true);
    expect(fs.workspace).toBeDefined();
    const name = await fs.saveBinary('ej1-assembler.pdf', new Uint8Array([1, 2]), 'application/pdf');
    expect(invoke).toHaveBeenCalledWith('save_binary', { name: 'ej1-assembler.pdf', bytes: [1, 2] });
    expect(name).toBe('ej1-assembler.pdf');
  });

  it('un error al guardar el binario se propaga con el texto de Rust', async () => {
    const fs = createDesktopFileService(vi.fn(() => Promise.reject('No hay espacio en el disco')));
    await expect(fs.saveBinary('a.pdf', new Uint8Array(), 'application/pdf')).rejects.toThrow('No hay espacio en el disco');
  });
});
