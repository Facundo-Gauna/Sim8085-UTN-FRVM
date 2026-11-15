import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webFileService } from './fileService';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('saveFile', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
  });

  async function save(name: string): Promise<string> {
    let download = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    const p = webFileService.saveFile(name, 'NOP');
    await vi.runAllTimersAsync();
    await p;
    return download;
  }

  it('descarga con el nombre y revoca la URL', async () => {
    expect(await save('prog.asm')).toBe('prog.asm');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    expect(document.querySelector('a[download]')).toBeNull();
  });
  it('añade .asm si falta extensión', async () => {
    expect(await save('prog')).toBe('prog.asm');
  });
  it('quita separadores de ruta', async () => {
    expect(await save('a/b\\c.txt')).toBe('c.txt');
  });
  it('crea un Blob de texto', async () => {
    await save('p.asm');
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0] as Blob;
    expect(blob.type).toBe('text/plain;charset=utf-8');
  });
});

describe('openFiles', () => {
  function pick(files: File[] | 'cancel') {
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
      queueMicrotask(() => {
        if (files === 'cancel') {
          this.dispatchEvent(new Event('cancel'));
        } else {
          Object.defineProperty(this, 'files', { value: files, configurable: true });
          this.dispatchEvent(new Event('change'));
        }
      });
    });
  }

  it('lee los archivos y descarta extensiones no válidas', async () => {
    pick([
      new File(['MVI A,1'], 'a.ASM'),
      new File(['hola'], 'b.txt'),
      new File(['x'], 'c.png'),
    ]);
    const r = await webFileService.openFiles();
    expect(r).toEqual([
      { name: 'a.ASM', text: 'MVI A,1' },
      { name: 'b.txt', text: 'hola' },
    ]);
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
  it('resuelve [] al cancelar', async () => {
    pick('cancel');
    expect(await webFileService.openFiles()).toEqual([]);
    expect(document.querySelector('input[type=file]')).toBeNull();
  });
  it('canPickFolder es false', () => {
    expect(webFileService.canPickFolder).toBe(false);
  });
});
