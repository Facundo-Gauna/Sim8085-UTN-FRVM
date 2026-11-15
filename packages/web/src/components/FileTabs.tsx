/**
 * Pestañas de los archivos abiertos (tablist con tabindex itinerante y
 * activación manual: las flechas mueven el foco, Enter/Espacio o clic
 * activan; cambiar de archivo descarta el ensamblado, por eso no se activa
 * con solo pasar). Supr cierra la pestaña enfocada.
 *
 * "Modificado" = el texto difiere del que tenía al abrirse o crearse (se
 * recuerda acá, sin tocar el store) y no está vacío. Cerrar un archivo
 * modificado pide confirmación dentro de la página, nunca con confirm().
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Download, FolderOpen, Plus, X } from 'lucide-react';
import { defaultSession, useSession, type FileTab } from '../state/store';
import type { FileService } from '../services/fileService';

/** Abre archivos del disco; no se espera la promesa (puede no resolverse si se cancela). */
export function openFromDisk(service: FileService): void {
  void service.openFiles().then((files) => {
    for (const f of files) defaultSession.getState().openFile(f.name, f.text);
  });
}

export function downloadActive(service: FileService): void {
  const s = defaultSession.getState();
  const file = s.files.find((f) => f.id === s.activeId);
  if (file) void service.saveFile(file.name, file.text);
}

export function FileTabs({ fileService }: { fileService: FileService }) {
  const files = useSession((s) => s.files);
  const activeId = useSession((s) => s.activeId);
  const setActive = useSession((s) => s.setActive);
  const newFile = useSession((s) => s.newFile);
  const closeFile = useSession((s) => s.closeFile);

  const baseline = useRef(new Map<string, string>());
  const [focusId, setFocusId] = useState(activeId);
  const [confirm, setConfirm] = useState<FileTab | null>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusNext = useRef<string | null>(null);
  const safeRef = useRef<HTMLButtonElement>(null);
  const dangerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const ids = new Set(files.map((f) => f.id));
    for (const f of files) if (!baseline.current.has(f.id)) baseline.current.set(f.id, f.text);
    for (const id of [...baseline.current.keys()]) if (!ids.has(id)) baseline.current.delete(id);
  }, [files]);

  // La pestaña enfocable sigue a la activa cuando esta cambia (nuevo, abrir, cerrar).
  useEffect(() => setFocusId(activeId), [activeId]);

  useLayoutEffect(() => {
    if (focusNext.current === null) return;
    tabRefs.current.get(focusNext.current)?.focus();
    focusNext.current = null;
  });

  useEffect(() => {
    if (confirm) safeRef.current?.focus();
  }, [confirm]);

  const modified = (f: FileTab) => f.text.trim() !== '' && f.text !== (baseline.current.get(f.id) ?? f.text);

  const doClose = (id: string) => {
    closeFile(id);
    focusNext.current = defaultSession.getState().activeId;
  };

  const requestClose = (f: FileTab) => {
    if (modified(f)) setConfirm(f);
    else doClose(f.id);
  };

  const cancelConfirm = () => {
    const id = confirm?.id ?? null;
    setConfirm(null);
    if (id) focusNext.current = id;
  };

  const tabIdx = files.findIndex((f) => f.id === focusId);
  const roving = tabIdx < 0 ? activeId : focusId;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let j: number | null = null;
    if (e.key === 'ArrowRight') j = (i + 1) % files.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + files.length) % files.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = files.length - 1;
    else if (e.key === 'Delete') {
      e.preventDefault();
      requestClose(files[i]!);
      return;
    }
    if (j === null) return;
    e.preventDefault();
    const id = files[j]!.id;
    setFocusId(id);
    focusNext.current = id;
  };

  const onDialogKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancelConfirm();
    } else if (e.key === 'Tab') {
      // Foco atrapado entre los dos botones.
      e.preventDefault();
      (document.activeElement === safeRef.current ? dangerRef : safeRef).current?.focus();
    }
  };

  return (
    <>
      <div className="tabs" role="tablist" aria-label="Archivos abiertos">
        {files.map((f, i) => {
          const selected = f.id === activeId;
          const dirty = modified(f);
          return (
            <div key={f.id} className="tab-wrap" role="presentation" data-selected={selected || undefined}>
              <button
                ref={(el) => {
                  if (el) tabRefs.current.set(f.id, el);
                  else tabRefs.current.delete(f.id);
                }}
                type="button"
                role="tab"
                className="tab"
                aria-selected={selected}
                tabIndex={f.id === roving ? 0 : -1}
                aria-keyshortcuts="Delete"
                title={dirty ? `${f.name} (modificado). Supr cierra la pestaña` : `${f.name}. Supr cierra la pestaña`}
                onClick={() => {
                  setFocusId(f.id);
                  setActive(f.id);
                }}
                onKeyDown={(e) => onTabKey(e, i)}
              >
                {f.name}
                {dirty && (
                  <span className="tab-dirty" aria-label="modificado">
                    •
                  </span>
                )}
              </button>
              <button
                type="button"
                className="tab-x"
                tabIndex={-1}
                aria-label={`Cerrar ${f.name}`}
                title={`Cerrar ${f.name}`}
                onClick={() => requestClose(f)}
              >
                <X size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="tb-group files" role="group" aria-label="Archivo">
        <button type="button" className="btn icon" aria-label="Archivo nuevo" title="Archivo nuevo" onClick={newFile}>
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn icon"
          aria-label="Abrir"
          title="Abrir (Ctrl+O)"
          aria-keyshortcuts="Control+O Meta+O"
          onClick={() => openFromDisk(fileService)}
        >
          <FolderOpen size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn icon"
          aria-label="Descargar"
          title="Descargar el archivo activo (Ctrl+S)"
          aria-keyshortcuts="Control+S Meta+S"
          onClick={() => downloadActive(fileService)}
        >
          <Download size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      {confirm && (
        <div
          className="banner"
          role="alertdialog"
          aria-modal="false"
          aria-labelledby="close-confirm-text"
          onKeyDown={onDialogKey}
        >
          <p id="close-confirm-text">¿Cerrar «{confirm.name}»? Los cambios no se guardan.</p>
          <div className="banner-actions">
            <button ref={safeRef} type="button" className="btn" onClick={cancelConfirm}>
              Cancelar
            </button>
            <button
              ref={dangerRef}
              type="button"
              className="btn danger"
              onClick={() => {
                const id = confirm.id;
                setConfirm(null);
                doClose(id);
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
