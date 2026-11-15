/**
 * Tabla del set de instrucciones del 8085.
 *
 * Fuente: "Set de Instrucciones - Microprocesador 8085" (docs/referencia).
 * - Opcodes: tablas de las págs. 19 (orden por código) y 20 (orden alfabético).
 * - Ciclos, estados y banderas: ficha de cada instrucción (págs. 4–17).
 *
 * Las familias regulares (MOV, ALU con registro, INR/DCR, MVI, RST) se generan
 * con bucles a partir de la codificación DDD/SSS/NNN de la pág. 2; el resto se
 * transcribe a mano.
 */
import type { FlagName, InstrDef } from './types';

/** Opcodes sin instrucción asignada (guiones en la tabla de la pág. 19). */
export const INVALID_OPCODES: readonly number[] = Object.freeze([
  0x08, 0x10, 0x18, 0x28, 0x38, 0xcb, 0xd9, 0xdd, 0xed, 0xfd,
]);

/** Codificación DDD/SSS de la pág. 2: índice = código binario. */
const REGS = ['B', 'C', 'D', 'E', 'H', 'L', 'M', 'A'] as const;

const ALL: FlagName[] = ['S', 'Z', 'AC', 'P', 'CY'];
const NO_CY: FlagName[] = ['S', 'Z', 'AC', 'P'];
const CY: FlagName[] = ['CY'];
const NONE: FlagName[] = [];

function sizeOf(operands: string[]): 1 | 2 | 3 {
  if (operands.some((o) => o === 'd16' || o === 'addr')) return 3;
  if (operands.some((o) => o === 'd8' || o === 'port')) return 2;
  return 1;
}

function def(
  opcode: number,
  mnemonic: string,
  operands: string[],
  tStates: InstrDef['tStates'],
  machineCycles: InstrDef['machineCycles'],
  flags: FlagName[],
  summary: string,
): InstrDef {
  return { opcode, mnemonic, operands, size: sizeOf(operands), tStates, machineCycles, flags: [...flags], summary };
}

const defs: InstrDef[] = [];

// ---------------------------------------------------------------------------
// Familias regulares (generadas)
// ---------------------------------------------------------------------------

// MOV r1,r2 (4 estados, 1 ciclo) / MOV r,M y MOV M,r (7 estados, 2 ciclos). Pág. 4.
// 0x76 (MOV M,M) es HLT.
for (let d = 0; d < 8; d++) {
  for (let s = 0; s < 8; s++) {
    const opcode = 0x40 | (d << 3) | s;
    if (opcode === 0x76) continue;
    const dst = REGS[d]!;
    const src = REGS[s]!;
    if (src === 'M') {
      defs.push(def(opcode, 'MOV', [dst, 'M'], 7, 2, NONE,
        `Mueve al registro ${dst} el contenido del lugar de memoria direccionado por HL`));
    } else if (dst === 'M') {
      defs.push(def(opcode, 'MOV', ['M', src], 7, 2, NONE,
        `Graba el contenido del registro ${src} en el lugar de memoria direccionado por HL`));
    } else {
      defs.push(def(opcode, 'MOV', [dst, src], 4, 1, NONE,
        `Copia el contenido del registro ${src} en el registro ${dst}`));
    }
  }
}

// Grupo aritmético/lógico con registro o memoria. Págs. 6–10.
// r: 4 estados, 1 ciclo; M: 7 estados, 2 ciclos. Afectan todas las banderas.
const ALU_OPS: ReadonlyArray<readonly [string, string]> = [
  ['ADD', 'Suma al acumulador'],
  ['ADC', 'Suma al acumulador, con el transporte,'],
  ['SUB', 'Resta al acumulador'],
  ['SBB', 'Resta al acumulador, con pedido,'],
  ['ANA', 'Realiza la AND lógica del acumulador con'],
  ['XRA', 'Realiza la OR exclusiva del acumulador con'],
  ['ORA', 'Realiza la OR lógica del acumulador con'],
  ['CMP', 'Compara con el acumulador, sin modificarlo,'],
];
for (let op = 0; op < 8; op++) {
  const [mnemonic, text] = ALU_OPS[op]!;
  for (let s = 0; s < 8; s++) {
    const opcode = 0x80 | (op << 3) | s;
    const src = REGS[s]!;
    if (src === 'M') {
      defs.push(def(opcode, mnemonic, ['M'], 7, 2, ALL,
        `${text} el contenido del lugar de memoria direccionado por HL`));
    } else {
      defs.push(def(opcode, mnemonic, [src], 4, 1, ALL, `${text} el contenido del registro ${src}`));
    }
  }
}

// INR / DCR. Págs. 7–8. r: 4 estados, 1 ciclo; M: 10 estados, 3 ciclos. CY no se modifica.
for (let d = 0; d < 8; d++) {
  const r = REGS[d]!;
  const isM = r === 'M';
  const target = isM ? 'el contenido del lugar de memoria direccionado por HL' : `el registro ${r}`;
  defs.push(def(0x04 | (d << 3), 'INR', [r], isM ? 10 : 4, isM ? 3 : 1, NO_CY,
    `Incrementa en una unidad ${target}`));
  defs.push(def(0x05 | (d << 3), 'DCR', [r], isM ? 10 : 4, isM ? 3 : 1, NO_CY,
    `Disminuye en una unidad ${target}`));
}

// MVI. Pág. 4. r: 7 estados, 2 ciclos; M: 10 estados, 3 ciclos.
for (let d = 0; d < 8; d++) {
  const r = REGS[d]!;
  if (r === 'M') {
    defs.push(def(0x36, 'MVI', ['M', 'd8'], 10, 3, NONE,
      'Graba el dato inmediato (byte 2) en el lugar de memoria direccionado por HL'));
  } else {
    defs.push(def(0x06 | (d << 3), 'MVI', [r, 'd8'], 7, 2, NONE,
      `Graba el dato inmediato (byte 2) en el registro ${r}`));
  }
}

// RST n. Pág. 13. 12 estados, 3 ciclos.
for (let n = 0; n < 8; n++) {
  defs.push(def(0xc7 | (n << 3), 'RST', [String(n)], 12, 3, NONE,
    `Guarda el PC en la pila y salta a la dirección ${n * 8} (8 x ${n})`));
}

// ---------------------------------------------------------------------------
// Resto de instrucciones (a mano)
// ---------------------------------------------------------------------------

defs.push(
  // --- Grupo de transferencia de datos (págs. 4–5) ---
  def(0x01, 'LXI', ['B', 'd16'], 10, 3, NONE, 'Carga el dato de 16 bits en el registro par BC'),
  def(0x11, 'LXI', ['D', 'd16'], 10, 3, NONE, 'Carga el dato de 16 bits en el registro par DE'),
  def(0x21, 'LXI', ['H', 'd16'], 10, 3, NONE, 'Carga el dato de 16 bits en el registro par HL'),
  def(0x31, 'LXI', ['SP', 'd16'], 10, 3, NONE, 'Carga el dato de 16 bits en el puntero de pila SP'),
  def(0x3a, 'LDA', ['addr'], 13, 4, NONE, 'Carga el acumulador con el dato de memoria de la dirección indicada'),
  def(0x32, 'STA', ['addr'], 13, 4, NONE, 'Almacena el acumulador en el lugar de memoria de la dirección indicada'),
  def(0x2a, 'LHLD', ['addr'], 16, 5, NONE, 'Carga L desde la dirección indicada y H desde la siguiente'),
  def(0x22, 'SHLD', ['addr'], 16, 5, NONE, 'Almacena L en la dirección indicada y H en la siguiente'),
  def(0x0a, 'LDAX', ['B'], 7, 2, NONE, 'Carga el acumulador con el dato de memoria direccionado por BC'),
  def(0x1a, 'LDAX', ['D'], 7, 2, NONE, 'Carga el acumulador con el dato de memoria direccionado por DE'),
  def(0x02, 'STAX', ['B'], 7, 2, NONE, 'Almacena el acumulador en el lugar de memoria direccionado por BC'),
  def(0x12, 'STAX', ['D'], 7, 2, NONE, 'Almacena el acumulador en el lugar de memoria direccionado por DE'),
  def(0xeb, 'XCHG', [], 4, 1, NONE, 'Intercambia los contenidos de HL y DE'),

  // --- Grupo aritmético (págs. 6–8) ---
  def(0xc6, 'ADI', ['d8'], 7, 2, ALL, 'Suma al acumulador el dato inmediato (byte 2)'),
  def(0xce, 'ACI', ['d8'], 7, 2, ALL, 'Suma al acumulador el dato inmediato (byte 2) más el transporte'),
  def(0xd6, 'SUI', ['d8'], 7, 2, ALL, 'Resta al acumulador el dato inmediato (byte 2)'),
  def(0xde, 'SBI', ['d8'], 7, 2, ALL, 'Resta al acumulador el dato inmediato (byte 2) y el pedido (CY)'),
  def(0x03, 'INX', ['B'], 6, 1, NONE, 'Incrementa en una unidad el registro par BC'),
  def(0x13, 'INX', ['D'], 6, 1, NONE, 'Incrementa en una unidad el registro par DE'),
  def(0x23, 'INX', ['H'], 6, 1, NONE, 'Incrementa en una unidad el registro par HL'),
  def(0x33, 'INX', ['SP'], 6, 1, NONE, 'Incrementa en una unidad el puntero de pila SP'),
  def(0x0b, 'DCX', ['B'], 6, 1, NONE, 'Disminuye en una unidad el registro par BC'),
  def(0x1b, 'DCX', ['D'], 6, 1, NONE, 'Disminuye en una unidad el registro par DE'),
  def(0x2b, 'DCX', ['H'], 6, 1, NONE, 'Disminuye en una unidad el registro par HL'),
  def(0x3b, 'DCX', ['SP'], 6, 1, NONE, 'Disminuye en una unidad el puntero de pila SP'),
  def(0x09, 'DAD', ['B'], 10, 3, CY, 'Suma el registro par BC al par HL'),
  def(0x19, 'DAD', ['D'], 10, 3, CY, 'Suma el registro par DE al par HL'),
  def(0x29, 'DAD', ['H'], 10, 3, CY, 'Suma el registro par HL al par HL'),
  def(0x39, 'DAD', ['SP'], 10, 3, CY, 'Suma el puntero de pila SP al par HL'),
  def(0x27, 'DAA', [], 4, 1, ALL, 'Ajusta el acumulador a formato decimal (BCD)'),

  // --- Grupo lógico (págs. 9–11) ---
  def(0xe6, 'ANI', ['d8'], 7, 2, ALL, 'Realiza la AND lógica del acumulador con el dato inmediato (byte 2)'),
  def(0xee, 'XRI', ['d8'], 7, 2, ALL, 'Realiza la OR exclusiva del acumulador con el dato inmediato (byte 2)'),
  def(0xf6, 'ORI', ['d8'], 7, 2, ALL, 'Realiza la OR lógica del acumulador con el dato inmediato (byte 2)'),
  def(0xfe, 'CPI', ['d8'], 7, 2, ALL, 'Compara el dato inmediato (byte 2) con el acumulador, sin modificarlo'),
  def(0x07, 'RLC', [], 4, 1, CY, 'Rota el acumulador a la izquierda; b7 pasa a CY y a b0'),
  def(0x0f, 'RRC', [], 4, 1, CY, 'Rota el acumulador a la derecha; b0 pasa a CY y a b7'),
  def(0x17, 'RAL', [], 4, 1, CY, 'Rota el acumulador a la izquierda a través del carry'),
  def(0x1f, 'RAR', [], 4, 1, CY, 'Rota el acumulador a la derecha a través del carry'),
  def(0x2f, 'CMA', [], 4, 1, NONE, 'Complementa el contenido del acumulador'),
  def(0x3f, 'CMC', [], 4, 1, CY, 'Complementa la bandera de transporte (CY)'),
  def(0x37, 'STC', [], 4, 1, CY, 'Pone a 1 la bandera de transporte (CY)'),

  // --- Grupo de saltos (págs. 12–13) ---
  def(0xc3, 'JMP', ['addr'], 10, 3, NONE, 'Salta incondicionalmente a la dirección indicada'),
  def(0xc2, 'JNZ', ['addr'], [7, 10], [2, 3], NONE, 'Salta a la dirección indicada si no es cero (Z = 0)'),
  def(0xca, 'JZ', ['addr'], [7, 10], [2, 3], NONE, 'Salta a la dirección indicada si es cero (Z = 1)'),
  def(0xd2, 'JNC', ['addr'], [7, 10], [2, 3], NONE, 'Salta a la dirección indicada si no hay carry (CY = 0)'),
  def(0xda, 'JC', ['addr'], [7, 10], [2, 3], NONE, 'Salta a la dirección indicada si hay carry (CY = 1)'),
  def(0xe2, 'JPO', ['addr'], [7, 10], [2, 3], NONE, 'Salta a la dirección indicada si la paridad es impar (P = 0)'),
  def(0xea, 'JPE', ['addr'], [7, 10], [2, 3], NONE, 'Salta a la dirección indicada si la paridad es par (P = 1)'),
  def(0xf2, 'JP', ['addr'], [7, 10], [2, 3], NONE, 'Salta a la dirección indicada si el signo es más (S = 0)'),
  def(0xfa, 'JM', ['addr'], [7, 10], [2, 3], NONE, 'Salta a la dirección indicada si el signo es menos (S = 1)'),
  def(0xcd, 'CALL', ['addr'], 18, 5, NONE, 'Guarda el PC en la pila y salta a la subrutina indicada'),
  def(0xc4, 'CNZ', ['addr'], [9, 18], [2, 5], NONE, 'Llama a la subrutina indicada si no es cero (Z = 0)'),
  def(0xcc, 'CZ', ['addr'], [9, 18], [2, 5], NONE, 'Llama a la subrutina indicada si es cero (Z = 1)'),
  def(0xd4, 'CNC', ['addr'], [9, 18], [2, 5], NONE, 'Llama a la subrutina indicada si no hay carry (CY = 0)'),
  def(0xdc, 'CC', ['addr'], [9, 18], [2, 5], NONE, 'Llama a la subrutina indicada si hay carry (CY = 1)'),
  def(0xe4, 'CPO', ['addr'], [9, 18], [2, 5], NONE, 'Llama a la subrutina indicada si la paridad es impar (P = 0)'),
  def(0xec, 'CPE', ['addr'], [9, 18], [2, 5], NONE, 'Llama a la subrutina indicada si la paridad es par (P = 1)'),
  def(0xf4, 'CP', ['addr'], [9, 18], [2, 5], NONE, 'Llama a la subrutina indicada si el signo es más (S = 0)'),
  def(0xfc, 'CM', ['addr'], [9, 18], [2, 5], NONE, 'Llama a la subrutina indicada si el signo es menos (S = 1)'),
  def(0xc9, 'RET', [], 10, 3, NONE, 'Retorna de la subrutina recuperando el PC desde la pila'),
  def(0xc0, 'RNZ', [], [6, 12], [1, 3], NONE, 'Retorna de la subrutina si no es cero (Z = 0)'),
  def(0xc8, 'RZ', [], [6, 12], [1, 3], NONE, 'Retorna de la subrutina si es cero (Z = 1)'),
  def(0xd0, 'RNC', [], [6, 12], [1, 3], NONE, 'Retorna de la subrutina si no hay carry (CY = 0)'),
  def(0xd8, 'RC', [], [6, 12], [1, 3], NONE, 'Retorna de la subrutina si hay carry (CY = 1)'),
  def(0xe0, 'RPO', [], [6, 12], [1, 3], NONE, 'Retorna de la subrutina si la paridad es impar (P = 0)'),
  def(0xe8, 'RPE', [], [6, 12], [1, 3], NONE, 'Retorna de la subrutina si la paridad es par (P = 1)'),
  def(0xf0, 'RP', [], [6, 12], [1, 3], NONE, 'Retorna de la subrutina si el signo es más (S = 0)'),
  def(0xf8, 'RM', [], [6, 12], [1, 3], NONE, 'Retorna de la subrutina si el signo es menos (S = 1)'),
  def(0xe9, 'PCHL', [], 6, 1, NONE, 'Carga el PC con el contenido del registro par HL (salto indirecto)'),

  // --- Grupo de control de pila, máquina e I/O (págs. 14–17) ---
  def(0xc5, 'PUSH', ['B'], 13, 3, NONE, 'Almacena el registro par BC en la pila'),
  def(0xd5, 'PUSH', ['D'], 13, 3, NONE, 'Almacena el registro par DE en la pila'),
  def(0xe5, 'PUSH', ['H'], 13, 3, NONE, 'Almacena el registro par HL en la pila'),
  def(0xf5, 'PUSH', ['PSW'], 12, 3, NONE, 'Guarda el acumulador y las banderas (PSW) en la pila'),
  def(0xc1, 'POP', ['B'], 10, 3, NONE, 'Recupera el registro par BC desde la pila'),
  def(0xd1, 'POP', ['D'], 10, 3, NONE, 'Recupera el registro par DE desde la pila'),
  def(0xe1, 'POP', ['H'], 10, 3, NONE, 'Recupera el registro par HL desde la pila'),
  def(0xf1, 'POP', ['PSW'], 10, 3, ALL, 'Recupera el acumulador y las banderas (PSW) desde la pila'),
  def(0xe3, 'XTHL', [], 16, 5, NONE, 'Intercambia el tope de la pila con el par HL'),
  def(0xf9, 'SPHL', [], 6, 1, NONE, 'Mueve el contenido de HL al puntero de pila (SP)'),
  def(0xdb, 'IN', ['port'], 10, 3, NONE, 'Carga en el acumulador el dato del puerto de entrada indicado'),
  def(0xd3, 'OUT', ['port'], 10, 3, NONE, 'Coloca el contenido del acumulador en el puerto de salida indicado'),
  def(0xfb, 'EI', [], 4, 1, NONE, 'Habilita el sistema de interrupción a partir de la próxima instrucción'),
  def(0xf3, 'DI', [], 4, 1, NONE, 'Deshabilita el sistema de interrupción'),
  def(0x76, 'HLT', [], 5, 1, NONE, 'Detiene el procesador'),
  def(0x00, 'NOP', [], 4, 1, NONE, 'No realiza ninguna operación'),
  def(0x20, 'RIM', [], 4, 1, NONE, 'Carga en el acumulador la máscara de interrupción y la entrada serie (SID)'),
  def(0x30, 'SIM', [], 4, 1, NONE, 'Programa la máscara de interrupción y la salida serie (SOD) según el acumulador'),
);

defs.sort((a, b) => a.opcode - b.opcode);
for (const d of defs) {
  Object.freeze(d.operands);
  Object.freeze(d.flags);
  if (Array.isArray(d.tStates)) Object.freeze(d.tStates);
  if (Array.isArray(d.machineCycles)) Object.freeze(d.machineCycles);
  Object.freeze(d);
}

/** Set completo de instrucciones del 8085, ordenado por opcode (246 entradas). */
export const ISA: readonly InstrDef[] = Object.freeze(defs);
