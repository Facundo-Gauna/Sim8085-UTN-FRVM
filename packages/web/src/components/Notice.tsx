import { useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import { isDesktop } from '../services/desktop';
import './Notice.css';

const KEY = 'sim8085.notice-dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Aviso de la versión web: el trabajo no se guarda solo. Se puede cerrar y no vuelve a aparecer. */
export function Notice() {
  const [hidden, setHidden] = useState<boolean>(wasDismissed);
  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* almacenamiento no disponible: se oculta solo en esta sesión */
    }
  };
  return (
    <p className="notice">
      <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
      <span className="notice-text">
        Versión web: los archivos abiertos no se guardan. Descargalos antes de cerrar.
        {!isDesktop() && (
          <>
            {' '}
            <a href="#/documentacion/instalacion">Descargá la app de escritorio</a>
          </>
        )}
      </span>
      <button type="button" className="notice-close" onClick={close} aria-label="Cerrar aviso" title="Cerrar aviso">
        <X size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </p>
  );
}
