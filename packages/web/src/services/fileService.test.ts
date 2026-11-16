import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { REVOKE_DELAY_MS, webFileService } from './fileService';

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
    expect(document.querySelector('a[download]')).toBeNull();
  });
  it('revoca la URL solo tras REVOKE_DELAY_MS', async () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const p = webFileService.saveFile('p.asm', 'x');
    await vi.advanceTimersByTimeAsync(0);
    expect(document.querySelector('a[download]')).toBeNull();
    await vi.advanceTimersByTimeAsync(1000);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(REVOKE_DELAY_MS);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x');
    await p;
  });
  it.each([
    ['a.', 'a.asm'],
    ['.asm', 'programa.asm'],
    ['a.b.c', 'a.b.c'],
    ['', 'programa.asm'],
    ['   ', 'programa.asm'],
    ['x/y\\z.txt', 'z.txt'],
    ['a<b>:"|?*c\u0001.asm', 'abc.asm'],
  ])('normaliza %j -> %j', async (input, expected) => {
    expect(await save(input)).toBe(expected);
  });
  it('limita a 100 caracteres conservando la extension', async () => {
    const out = await save('a'.repeat(300) + '.txt');
    expect(out.length).toBe(100);
    expect(out.endsWith('.txt')).toBe(true);
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
  it('descarta solo el archivo cuyo FileReader falla', async () => {
    const orig = FileReader.prototype.readAsText;
    vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader, blob: Blob) {
      if ((blob as File).name === 'bad.txt') {
        queueMicrotask(() => this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>));
        return;
      }
      orig.call(this, blob);
    });
    pick([new File(['1'], 'ok.txt'), new File(['2'], 'bad.txt'), new File(['3'], 'ok2.asm')]);
    const r = await webFileService.openFiles();
    expect(r.map((f) => f.name)).toEqual(['ok.txt', 'ok2.asm']);
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

describe('saveBinary', () => {
  it('descarga los bytes con el nombre normalizado y revoca la URL', async () => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn(() => 'blob:pdf');
    URL.revokeObjectURL = vi.fn();
    let download = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      download = this.download;
    });
    const p = webFileService.saveBinary('ej 1/x.pdf', new Uint8Array([37, 80, 68, 70]), 'application/pdf');
    await vi.runAllTimersAsync();
    await p;
    expect(download).toBe('x.pdf');
    expect((URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0]![0].type).toBe('application/pdf');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
