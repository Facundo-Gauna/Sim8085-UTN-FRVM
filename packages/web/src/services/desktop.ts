/** Detección de la app de escritorio y su `FileService` (carpeta de trabajo + PDF a la carpeta). */
import { webFileService, type FileService } from './fileService';
import { call, createTauriWorkspace, type Invoke } from './workspace';

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function createDesktopFileService(invoke: Invoke): FileService {
  return {
    ...webFileService,
    canPickFolder: true,
    workspace: createTauriWorkspace(invoke),
    // Devuelve el nombre final (puede llevar " (2)"); '' si el usuario canceló el cuadro "Guardar como".
    saveBinary: (name, bytes) => call<string>(invoke, 'save_binary', { name, bytes: Array.from(bytes) }),
  };
}
