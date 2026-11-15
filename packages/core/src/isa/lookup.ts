import type { InstrDef } from './types';
import { ISA } from './table';

const BY_OPCODE: ReadonlyArray<InstrDef | undefined> = (() => {
  const arr: Array<InstrDef | undefined> = new Array(256).fill(undefined);
  for (const d of ISA) arr[d.opcode] = d;
  return arr;
})();

const keyOf = (mnemonic: string, operands: readonly string[]): string =>
  `${mnemonic} ${operands.join(',')}`;

const BY_FORM: ReadonlyMap<string, InstrDef> = new Map(ISA.map((d) => [keyOf(d.mnemonic, d.operands), d]));

/** Devuelve la definición de un opcode, o `undefined` si no está asignado. */
export function byOpcode(op: number): InstrDef | undefined {
  return BY_OPCODE[op];
}

/**
 * Busca una instrucción por mnemónico y operandos ya normalizados
 * (registros en mayúsculas; valores como 'd8' / 'd16' / 'addr' / 'port').
 */
export function findInstr(mnemonic: string, operands: string[]): InstrDef | undefined {
  return BY_FORM.get(keyOf(mnemonic, operands));
}
