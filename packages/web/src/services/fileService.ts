export interface FileService {
  openFiles(): Promise<{ name: string; text: string }[]>;
  saveFile(name: string, text: string): Promise<void>;
  /** Guarda bytes (p. ej. un PDF). En la web es una descarga; el escritorio lo guarda en la carpeta. */
  saveBinary(name: string, bytes: Uint8Array, mime: string): Promise<void>;
  readonly canPickFolder: boolean;
}

const ACCEPTED = /\.(asm|txt)$/i;

function readText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export const REVOKE_DELAY_MS = 10_000;
const MAX_NAME_LENGTH = 100;
const DEFAULT_BASE = 'programa';
const DEFAULT_EXT = '.asm';

function normalizeName(name: string): string {
  const last = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const clean = last.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').trim();
  const dot = clean.lastIndexOf('.');
  let base = dot === -1 ? clean : clean.slice(0, dot);
  let ext = dot === -1 ? DEFAULT_EXT : clean.slice(dot);
  if (ext === '.') ext = DEFAULT_EXT;
  if (base === '') base = DEFAULT_BASE;
  base = base.slice(0, Math.max(1, MAX_NAME_LENGTH - ext.length));
  return base + ext;
}

let currentInput: HTMLInputElement | null = null;

export const webFileService: FileService = {
  canPickFolder: false,

  /**
   * Opens a file picker. Never rejects; resolves with [] on cancel. Where the
   * browser fires no `cancel` event the promise may never settle, so the UI
   * must never block on it.
   */
  openFiles() {
    return new Promise((resolve) => {
      currentInput?.remove();
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.asm,.txt';
      input.style.display = 'none';
      document.body.appendChild(input);
      currentInput = input;

      const finish = (result: { name: string; text: string }[]): void => {
        input.remove();
        if (currentInput === input) currentInput = null;
        resolve(result);
      };
      input.addEventListener('cancel', () => finish([]));
      input.addEventListener('change', () => {
        const files = Array.from(input.files ?? []).filter((f) => ACCEPTED.test(f.name));
        Promise.all(
          files.map((f) =>
            readText(f).then(
              (text) => ({ name: f.name, text }),
              () => null,
            ),
          ),
        ).then((r) => finish(r.filter((x): x is { name: string; text: string } => x !== null)));
      });
      input.click();
    });
  },

  saveFile(name, text) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = normalizeName(name);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
      resolve();
    });
  },

  saveBinary(name, bytes, mime) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mime }));
      const a = document.createElement('a');
      a.href = url;
      a.download = normalizeName(name);
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
      resolve();
    });
  },
};
