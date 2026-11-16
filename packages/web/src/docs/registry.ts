/** Registro de las páginas de documentación, en orden de aparición. */
import type { JSX } from 'react';
import { QueEs } from './pages/QueEs';
import { Banderas } from './pages/Banderas';
import { Direccionamiento } from './pages/Direccionamiento';
import { Programa } from './pages/Programa';
import { Registros } from './pages/Registros';

export type DocScope = 'catedra' | 'fuera' | 'legal';

export interface DocEntry {
  id: string;
  title: string;
  scope: DocScope;
  Component: () => JSX.Element;
}

export const SCOPE_LABEL: Record<DocScope, string> = {
  catedra: 'Dentro de la cátedra',
  fuera: 'Fuera de la cátedra (complementario)',
  legal: 'Legal',
};

export const DOCS: readonly DocEntry[] = [
  { id: 'que-es', title: 'Qué es assembler y el 8085', scope: 'catedra', Component: QueEs },
  { id: 'registros', title: 'Registros y memoria', scope: 'catedra', Component: Registros },
  { id: 'banderas', title: 'Banderas', scope: 'catedra', Component: Banderas },
  { id: 'programa', title: 'Cómo se escribe un programa', scope: 'catedra', Component: Programa },
  { id: 'direccionamiento', title: 'Modos de direccionamiento', scope: 'catedra', Component: Direccionamiento },
];

/** Página por id; un id desconocido o ausente devuelve la primera. */
export function getDoc(id: string | undefined): DocEntry {
  return DOCS.find((d) => d.id === id) ?? DOCS[0]!;
}
