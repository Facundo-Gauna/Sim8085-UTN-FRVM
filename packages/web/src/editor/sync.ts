/** Marca las transacciones que vienen del store (no se vuelven a publicar ni marcan stale). */
import { Annotation } from '@codemirror/state';

export const externalSync = Annotation.define<boolean>();
