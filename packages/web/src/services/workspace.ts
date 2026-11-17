/** Carpeta de trabajo de la app de escritorio: interfaz y la implementación sobre los comandos de Tauri. */

export interface TreeNode {
  name: string;
  /** Ruta relativa a la carpeta abierta, con `/`. */
  path: string;
  kind: 'dir' | 'file';
  children?: TreeNode[];
}

export interface WorkspaceService {
  /** Abre el cuadro de carpeta del sistema; `null` si se cancela. */
  pickFolder(): Promise<{ name: string } | null>;
  current(): Promise<{ name: string } | null>;
  tree(): Promise<TreeNode[]>;
  read(path: string): Promise<string>;
  write(path: string, text: string): Promise<void>;
  create(path: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  remove(path: string): Promise<void>;
}

export type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

/** Texto legible de cualquier error (string de Rust, Error, objeto con `message`); nunca lanza. */
export function errorText(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && typeof (e as { message?: unknown }).message === 'string') {
    return (e as { message: string }).message;
  }
  return 'Error desconocido';
}

/** Llama a un comando; cualquier fallo (incluso síncrono) se vuelve un Error con el texto en español de Rust. */
export async function call<T>(invoke: Invoke, cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return (await invoke(cmd, args)) as T;
  } catch (e) {
    throw new Error(errorText(e));
  }
}

export function createTauriWorkspace(invoke: Invoke): WorkspaceService {
  return {
    pickFolder: () => call<{ name: string } | null>(invoke, 'pick_folder', undefined),
    current: () => call<{ name: string } | null>(invoke, 'current_folder', undefined),
    tree: () => call<TreeNode[]>(invoke, 'list_tree', undefined),
    read: (path) => call<string>(invoke, 'read_file', { path }),
    write: (path, text) => call<void>(invoke, 'write_file', { path, text }),
    create: (path) => call<void>(invoke, 'create_file', { path }),
    rename: (from, to) => call<void>(invoke, 'rename_path', { from, to }),
    remove: (path) => call<void>(invoke, 'delete_file', { path }),
  };
}
