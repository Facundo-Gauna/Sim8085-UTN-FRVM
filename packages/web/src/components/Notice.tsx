import { TriangleAlert } from 'lucide-react';
import { isDesktop } from '../services/desktop';
import './Notice.css';

/** Aviso permanente de la versión web: el trabajo no se guarda solo. */
export function Notice() {
  return (
    <p className="notice">
      <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
      Versión web: los archivos abiertos no se guardan. Descargalos antes de cerrar.
      {!isDesktop() && (
        <>
          {' '}
          <a href="#/documentacion/instalacion">Descargá la app de escritorio</a>
        </>
      )}
    </p>
  );
}
