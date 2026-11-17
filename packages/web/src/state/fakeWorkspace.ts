/** Carpeta de trabajo falsa en memoria, para las pruebas (ruta relativa → texto). */
import type { TreeNode, WorkspaceService } from '../services/workspace';

export interface FakeWorkspace extends WorkspaceService {
  files: Map<string, string>;
  calls: string[];
  /** La próxima llamada a `method` rechaza con `message`. */
  failNext(method: keyof WorkspaceService, message: string): void;
  /** Cuánto tardan las operaciones (para probar cambios durante una espera). */
  folder: { name: string } | null;
}

export function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const p of [...paths].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))) {
    const parts = p.split('/');
    let level = root;
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join('/');
      if (i === parts.length - 1) level.push({ name, path, kind: 'file' });
      else {
        let dir = level.find((n) => n.kind === 'dir' && n.name === name);
        if (!dir) {
          dir = { name, path, kind: 'dir', children: [] };
          level.push(dir);
        }
        level = dir.children!;
      }
    });
  }
  const order = (n: TreeNode[]) => {
    n.sort((a, b) => (a.kind === b.kind ? a.name.toLowerCase().localeCompare(b.name.toLowerCase()) : a.kind === 'dir' ? -1 : 1));
    n.forEach((x) => x.children && order(x.children));
  };
  order(root);
  return root;
}

export function createFakeWorkspace(initial: Record<string, string> = {}, folderName: string | null = 'asm'): FakeWorkspace {
  const files = new Map(Object.entries(initial));
  const calls: string[] = [];
  const failures = new Map<string, string>();
  const step = async <T>(method: keyof WorkspaceService, label: string, f: () => T): Promise<T> => {
    calls.push(label);
    const fail = failures.get(method);
    if (fail !== undefined) {
      failures.delete(method);
      throw new Error(fail);
    }
    return f();
  };
  const ws: FakeWorkspace = {
    files,
    calls,
    folder: folderName === null ? null : { name: folderName },
    failNext: (m, message) => void failures.set(m, message),
    pickFolder: () => step('pickFolder', 'pickFolder', () => ws.folder),
    current: () => step('current', 'current', () => ws.folder),
    tree: () => step('tree', 'tree', () => buildTree([...files.keys()])),
    read: (p) =>
      step('read', `read ${p}`, () => {
        if (!files.has(p)) throw new Error('El archivo no existe');
        return files.get(p)!;
      }),
    write: (p, t) =>
      step('write', `write ${p}`, () => {
        if (!files.has(p)) throw new Error('El archivo no existe');
        files.set(p, t);
      }),
    create: (p) =>
      step('create', `create ${p}`, () => {
        if (files.has(p)) throw new Error('El archivo ya existe');
        files.set(p, '');
      }),
    rename: (a, b) =>
      step('rename', `rename ${a} ${b}`, () => {
        if (!files.has(a)) throw new Error('El archivo no existe');
        if (files.has(b)) throw new Error('El archivo ya existe');
        files.set(b, files.get(a)!);
        files.delete(a);
      }),
    remove: (p) =>
      step('remove', `remove ${p}`, () => {
        if (!files.delete(p)) throw new Error('El archivo no existe');
      }),
  };
  return ws;
}
