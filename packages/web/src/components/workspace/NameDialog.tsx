/** Diálogo de nombre (nuevo archivo, renombrar, guardar como): dentro de la página, foco atrapado, Escape cierra. */
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import './workspace.css';

export interface NameDialogProps {
  title: string;
  initial: string;
  /** Valida y guarda; devuelve el mensaje de error ('' si salió bien y se puede cerrar). */
  onSubmit(name: string): Promise<string> | string;
  onClose(): void;
}

export function NameDialog({ title, initial, onSubmit, onClose }: NameDialogProps) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const uid = useId();

  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.focus();
    // Selecciona el nombre sin la extensión para escribir encima.
    el.setSelectionRange(0, initial.endsWith('.asm') ? initial.length - 4 : initial.length);
  }, [initial]);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    try {
      const msg = await onSubmit(value);
      if (msg === '') onClose();
      else setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      const f = [...(root.current?.querySelectorAll<HTMLElement>('input, button') ?? [])].filter((x) => !(x as HTMLButtonElement).disabled);
      if (f.length === 0) return;
      const first = f[0]!;
      const last = f[f.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="ws-scrim">
      <div ref={root} className="ws-dialog" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} onKeyDown={onKey}>
        <h2 id={`${uid}-t`}>{title}</h2>
        <form onSubmit={(e) => void submit(e)}>
          <label className="ws-field">
            Nombre
            <input
              ref={input}
              className="mono"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError('');
              }}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${uid}-e` : undefined}
            />
          </label>
          {error && (
            <p id={`${uid}-e`} role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="ws-actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn primary" disabled={busy}>
              Aceptar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
