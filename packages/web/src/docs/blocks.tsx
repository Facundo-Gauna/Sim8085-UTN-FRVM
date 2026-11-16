/** Bloques reutilizables de las páginas de documentación. */
import type { ReactNode } from 'react';
import { useSection } from '../lib/useSection';

/** Enlace interno a otra página de la documentación. */
export function DocLink({ to, children }: { to: string; children: ReactNode }) {
  const { go } = useSection();
  return (
    <a
      href={`#/documentacion/${to}`}
      onClick={(e) => {
        e.preventDefault();
        go('documentacion', to);
      }}
    >
      {children}
    </a>
  );
}

/** Código de ejemplo en assembler; los tests comprueban que ensambla. */
export function Asm({ children }: { children: string }) {
  return (
    <pre className="doc-code" data-asm tabIndex={0} aria-label="Ejemplo de código">
      <code>{children}</code>
    </pre>
  );
}
