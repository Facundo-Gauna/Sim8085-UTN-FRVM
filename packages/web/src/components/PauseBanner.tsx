/**
 * Aviso dentro de la página cuando "Ejecutar" lleva 100 000 instrucciones sin
 * detenerse (posible bucle infinito). Nunca usa confirm(). El foco va a
 * "Continuar" al aparecer; quien lo monta decide adónde vuelve después.
 */
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { TriangleAlert } from 'lucide-react';

export function PauseBanner({ onContinue, onStop }: { onContinue(): void; onStop(): void }) {
  const contRef = useRef<HTMLButtonElement>(null);
  const stopRef = useRef<HTMLButtonElement>(null);
  useEffect(() => contRef.current?.focus(), []);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onStop();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      (document.activeElement === contRef.current ? stopRef : contRef).current?.focus();
    }
  };

  return (
    <div className="banner pause" role="alertdialog" aria-modal="false" aria-labelledby="pause-text" onKeyDown={onKey}>
      <p id="pause-text">
        <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
        El programa lleva 100 000 instrucciones sin llegar a HLT. ¿Continuar o detener?
      </p>
      <div className="banner-actions">
        <button ref={contRef} type="button" className="btn" onClick={onContinue}>
          Continuar
        </button>
        <button ref={stopRef} type="button" className="btn" onClick={onStop}>
          Detener
        </button>
      </div>
    </div>
  );
}
