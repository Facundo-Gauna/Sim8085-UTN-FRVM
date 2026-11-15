/** Categorías de operando que acepta el set de instrucciones del 8085. */
export type OperandKind = 'r' | 'rp' | 'rpPush' | 'd8' | 'd16' | 'addr' | 'port' | 'rstN';

/** Banderas de condición del 8085. */
export type FlagName = 'S' | 'Z' | 'AC' | 'P' | 'CY';

export interface InstrDef {
  /** Código de operación (0x00–0xFF). */
  opcode: number;
  /** Mnemónico: 'MOV', 'MVI', 'JNZ'… */
  mnemonic: string;
  /** Forma literal de los operandos: ['A','M'], ['B','d8'], ['addr'], []. */
  operands: string[];
  /** Tamaño en bytes. */
  size: 1 | 2 | 3;
  /** Estados (T). En saltos/llamadas/retornos condicionales: [no tomado, tomado]. */
  tStates: number | [notTaken: number, taken: number];
  /** Ciclos de máquina. En condicionales: [no tomado, tomado]. */
  machineCycles: number | [number, number];
  /** Banderas que la instrucción puede modificar (orden S, Z, AC, P, CY). */
  flags: FlagName[];
  /** Una línea en español con la terminología del manual. */
  summary: string;
}
