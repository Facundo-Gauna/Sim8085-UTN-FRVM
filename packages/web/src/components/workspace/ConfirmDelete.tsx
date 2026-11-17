/** Confirmación de borrado dentro de la página (nunca confirm()). El foco empieza en Cancelar. */
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import './workspace.css';

export function ConfirmDelete({ name, onConfirm, onClose }: { name: string; onConfirm(): void; onClose(): void }) {
  const cancel = useRef<HTMLButtonElement>(null);
  const del = useRef<HTMLButtonElement>(null);
  const uid = useId();
  useEffect(() => cancel.current?.focus(), []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      (document.activeElement === cancel.current ? del : cancel).current?.focus();
    }
  };

  return (
    <div className="ws-scrim">
      <div className="ws-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${uid}-t`} onKeyDown={onKey}>
        <p id={`${uid}-t`}>¿Borrar «{name}»? No se puede deshacer.</p>
        <div className="ws-actions">
          <button ref={cancel} type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button ref={del} type="button" className="btn danger" onClick={onConfirm}>
            Borrar
          </button>
        </div>
      </div>
    </div>
  );
}
