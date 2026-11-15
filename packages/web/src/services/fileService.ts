export interface FileService {
  openFiles(): Promise<{ name: string; text: string }[]>;
  saveFile(name: string, text: string): Promise<void>;
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

function normalizeName(name: string): string {
  const base = name.split(/[\\/]/).pop()?.trim() ?? '';
  const clean = base === '' ? 'programa' : base;
  return /\.[^.]+$/.test(clean) ? clean : `${clean}.asm`;
}

export const webFileService: FileService = {
  canPickFolder: false,

  openFiles() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = '.asm,.txt';
      input.style.display = 'none';
      document.body.appendChild(input);

      const finish = (result: { name: string; text: string }[]): void => {
        input.remove();
        resolve(result);
      };
      input.addEventListener('cancel', () => finish([]));
      input.addEventListener('change', () => {
        const files = Array.from(input.files ?? []).filter((f) => ACCEPTED.test(f.name));
        Promise.all(files.map(async (f) => ({ name: f.name, text: await readText(f) })))
          .then(finish, () => finish([]));
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
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
        resolve();
      }, 0);
    });
  },
};
