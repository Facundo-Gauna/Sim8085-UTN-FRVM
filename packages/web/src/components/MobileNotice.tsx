import { Laptop } from 'lucide-react';
import './Notice.css';

/** Por debajo de 900 px: el simulador no se muestra, solo este aviso. */
export function MobileNotice() {
  return (
    <main className="mobile-notice">
      <svg className="chip" role="img" aria-label="Sim8085" viewBox="0 0 40 28" width="60" height="42">
        <rect className="chip-body" x="1" y="3" width="38" height="22" rx="2" />
        <path className="chip-notch" d="M1 10 a4 4 0 0 1 0 8 z" />
        <text className="chip-text" x="21" y="17.5" textAnchor="middle">
          8085
        </text>
      </svg>
      <p>
        <Laptop size={20} strokeWidth={1.5} aria-hidden="true" />
        El simulador está pensado para computadora. Abrilo desde una PC para escribir y ejecutar programas.
      </p>
    </main>
  );
}
