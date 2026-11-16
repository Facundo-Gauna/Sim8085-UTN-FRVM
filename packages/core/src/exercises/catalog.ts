/** Catálogo de ejercicios: básicos, GTP05 (cátedra) y adicionales (spec §6.9). */
import type { Exercise, TestCase } from './types';

export const GROUP_TITLES: Record<Exercise['group'], string> = {
  basico: 'Básicos',
  catedra: 'De la cátedra (GTP05)',
  adicional: 'Adicionales',
};

type Pair = [number, number];
const tc = (memory: Pair[], expect: Pair[], label?: string): TestCase =>
  label === undefined ? { memory, expect } : { label, memory, expect };

const starter = (title: string, statement: string) =>
  `; ${title}\n${statement.split('\n').map((l) => `; ${l}`).join('\n')}\n\n        HLT\n`;

function make(e: Omit<Exercise, 'memory' | 'starter'>): Exercise {
  return { ...e, memory: e.tests[0]!.memory, starter: starter(e.title, e.statement) };
}

/** Un dato `a` → resultado `r` en `dst` (un solo byte de entrada). */
const unary = (src: number, dst: number, cases: Pair[]): TestCase[] =>
  cases.map(([a, r]) => tc([[src, a]], [[dst, r]]));
/** Dos datos en `a1`, `a2` → resultado en `dst`. */
const binary = (a1: number, a2: number, dst: number, cases: [number, number, number][]): TestCase[] =>
  cases.map(([x, y, r]) => tc([[a1, x], [a2, y]], [[dst, r]]));

const hexes = (bytes: number[]) => bytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const block = (addr: number, bytes: number[]): Pair[] => bytes.map((b, i) => [addr + i, b]);
const SEQ16 = Array.from({ length: 16 }, (_, i) => i + 1);

export const EXERCISES: readonly Exercise[] = [
  make({
    id: 'gtp05-1', group: 'catedra', title: 'GTP05 · 1', start: 0x2000,
    statement:
      'En el lugar de memoria 0040h existe un valor que debe ser complementado y posteriormente almacenarlo en el lugar de memoria 0041h.',
    hint: 'El acumulador se complementa con una sola instrucción del grupo lógico; el dato entra y sale de memoria por acceso directo.',
    tests: unary(0x40, 0x41, [[0x3a, 0xc5], [0x00, 0xff], [0xff, 0x00], [0x55, 0xaa]]),
  }),
  make({
    id: 'gtp05-2', group: 'catedra', title: 'GTP05 · 2', start: 0x1000,
    statement:
      'Realice la operación AND a los valores que están almacenados en las direcciones de memoria 2000h y 2001h. Posteriormente almacene el resultado en el lugar de memoria 2002h.',
    hint: 'Las operaciones lógicas usan el acumulador y otro registro: guardá el primer dato en un registro antes de traer el segundo. Los datos viven en 2000h, así que empezá el programa en otra dirección.',
    tests: binary(0x2000, 0x2001, 0x2002, [[0xf0, 0x3c, 0x30], [0xff, 0x00, 0x00], [0xaa, 0x55, 0x00], [0xff, 0xff, 0xff]]),
  }),
  make({
    id: 'gtp05-3', group: 'catedra', title: 'GTP05 · 3', start: 0x2000,
    statement:
      'Realice la operación OR a los valores que están almacenados en las direcciones de memoria 3000h y 3001h. Posteriormente almacene el resultado en el lugar de memoria 3002h.',
    hint: 'Mismo método que el ejercicio del AND, con la instrucción OR del grupo lógico.',
    tests: binary(0x3000, 0x3001, 0x3002, [[0xf0, 0x0f, 0xff], [0x00, 0x00, 0x00], [0xa0, 0x05, 0xa5], [0x80, 0x01, 0x81]]),
  }),
  make({
    id: 'gtp05-4', group: 'catedra', title: 'GTP05 · 4', start: 0x2000,
    statement:
      'Obtenga la parte más significativa del valor cuya posición de memoria es 300Ah y luego almacénelo en la misma posición de memoria.',
    hint: 'Se interpreta como el nibble alto conservado en su lugar y el bajo en cero (B7h → B0h); esta interpretación está pendiente de confirmar con la cátedra. Pensá en una máscara.',
    tests: unary(0x300a, 0x300a, [[0xb7, 0xb0], [0x0f, 0x00], [0xf0, 0xf0], [0x5a, 0x50]]),
  }),
  make({
    id: 'gtp05-5', group: 'catedra', title: 'GTP05 · 5', start: 0x2000,
    statement:
      'En el lugar de memoria 2040h existe un valor al que se le debe sumar el valor A1h y posteriormente almacenarlo en el lugar de memoria 2041h.',
    hint: 'Hay una suma con dato inmediato; recordá que un valor hexa que empieza con letra lleva un 0 adelante.',
    tests: unary(0x2040, 0x2041, [[0x00, 0xa1], [0x5f, 0x00], [0xff, 0xa0], [0x3a, 0xdb]]),
  }),

  make({
    id: 'basico-cargar', group: 'basico', title: 'Cargar un dato', start: 0x2000,
    statement: 'Cargá el valor 5Ah en el acumulador y guardalo en la posición de memoria 3000h.',
    hint: 'Primero el dato entra al acumulador (carga inmediata) y después se guarda en memoria por acceso directo.',
    tests: [tc([], [[0x3000, 0x5a]])],
  }),
  make({
    id: 'basico-copiar', group: 'basico', title: 'Copiar un byte', start: 0x2000,
    statement: 'Copiá el byte de la posición 3000h en la posición 3001h.',
    hint: 'El acumulador sirve de paso intermedio: lo que entra por acceso directo puede salir por acceso directo.',
    tests: unary(0x3000, 0x3001, [[0x00, 0x00], [0x7f, 0x7f], [0xff, 0xff], [0x3a, 0x3a]]),
  }),
  make({
    id: 'basico-incrementar', group: 'basico', title: 'Incrementar', start: 0x2000,
    statement: 'Sumale 1 al byte de la posición 3000h y guardá el resultado en 3001h. Si el dato es FFh, el resultado es 00h.',
    hint: 'Existe una instrucción que incrementa un registro en uno, sin dato inmediato.',
    tests: unary(0x3000, 0x3001, [[0x00, 0x01], [0xff, 0x00], [0x7f, 0x80]]),
  }),
  make({
    id: 'basico-sumar', group: 'basico', title: 'Sumar dos bytes', start: 0x2000,
    statement: 'Sumá los bytes de las posiciones 3000h y 3001h y guardá el resultado en 3002h. Si hay desborde, se descarta (módulo 256).',
    hint: 'La suma de registros usa el acumulador y otro registro; guardá el primer dato antes de traer el segundo.',
    tests: binary(0x3000, 0x3001, 0x3002, [[0x01, 0x02, 0x03], [0xff, 0x01, 0x00], [0x80, 0x80, 0x00]]),
  }),
  make({
    id: 'basico-intercambiar', group: 'basico', title: 'Intercambiar dos bytes', start: 0x2000,
    statement: 'Intercambiá el contenido de las posiciones 3000h y 3001h.',
    hint: 'Necesitás dos lugares donde guardar un dato mientras escribís el otro: el acumulador y un registro.',
    tests: [
      tc([[0x3000, 0x12], [0x3001, 0x34]], [[0x3000, 0x34], [0x3001, 0x12]]),
      tc([[0x3000, 0x00], [0x3001, 0xff]], [[0x3000, 0xff], [0x3001, 0x00]]),
    ],
  }),
  make({
    id: 'basico-doble', group: 'basico', title: 'Multiplicar por 2', start: 0x2000,
    statement: 'Multiplicá por 2 el byte de la posición 3000h y guardá el resultado en 3001h, descartando el desborde.',
    hint: 'Duplicar un número es sumarlo consigo mismo (o desplazarlo un bit a la izquierda).',
    tests: unary(0x3000, 0x3001, [[0x01, 0x02], [0x40, 0x80], [0x80, 0x00]]),
  }),

  make({
    id: 'adic-mayor', group: 'adicional', title: 'El mayor de dos', start: 0x2000,
    statement: 'Guardá en 3002h el mayor (sin signo) de los bytes de 3000h y 3001h.',
    hint: 'Una comparación deja la bandera CY en 1 si el acumulador es menor que el otro operando; usala con un salto condicional.',
    tests: binary(0x3000, 0x3001, 0x3002, [[0x05, 0x09, 0x09], [0x09, 0x05, 0x09], [0xff, 0x01, 0xff], [0x07, 0x07, 0x07]]),
  }),
  make({
    id: 'adic-suma-bloque', group: 'adicional', title: 'Suma de un bloque', start: 0x2000,
    statement: 'En 3000h hay una cantidad N y a partir de 3001h hay N bytes. Guardá en 3100h la suma de los N bytes (módulo 256). N puede ser 0.',
    hint: 'Recorré el bloque con HL como puntero y un contador. Probá qué pasa si el contador arranca en 0 antes del primer paso del bucle.',
    tests: [
      tc([[0x3000, 3], ...block(0x3001, [1, 2, 3])], [[0x3100, 6]], 'N = 3, datos 01 02 03'),
      tc([[0x3000, 1], [0x3001, 0xff]], [[0x3100, 0xff]], 'N = 1, datos FF'),
      tc([[0x3000, 4], ...block(0x3001, [0x80, 0x80, 1, 1])], [[0x3100, 2]], 'N = 4, datos 80 80 01 01'),
      tc([[0x3000, 0], [0x3001, 0x55]], [[0x3100, 0]], 'N = 0'),
    ],
  }),
  make({
    id: 'adic-bits', group: 'adicional', title: 'Contar bits en 1', start: 0x2000,
    statement: 'Guardá en 3001h la cantidad de bits en 1 del byte de 3000h.',
    hint: 'Una rotación del acumulador deja el bit que sale en la bandera CY; repetila 8 veces.',
    tests: unary(0x3000, 0x3001, [[0x00, 0], [0xff, 8], [0xa5, 4], [0x01, 1], [0x80, 1]]),
  }),
  make({
    id: 'adic-rellenar', group: 'adicional', title: 'Rellenar con ceros', start: 0x2000,
    statement: 'Las posiciones 3010h a 301Fh (16 bytes) contienen FFh. Ponelas todas en 00h.',
    hint: 'Un bucle con HL como puntero y un contador de 16; la instrucción que escribe en M no modifica banderas.',
    tests: [
      tc(block(0x3010, Array(16).fill(0xff)), block(0x3010, Array(16).fill(0)), 'bloque en FFh'),
      tc(block(0x3010, SEQ16), block(0x3010, Array(16).fill(0)), `bloque con ${hexes(SEQ16)}`),
    ],
  }),
  make({
    id: 'adic-paridad', group: 'adicional', title: 'Paridad par', start: 0x2000,
    statement: 'Guardá 01h en 3001h si el byte de 3000h tiene paridad par (cantidad par de bits en 1), y 00h si es impar.',
    hint: 'La bandera P se actualiza con operaciones lógicas; ORA A actualiza banderas sin cambiar el acumulador. Hay saltos que miran P.',
    tests: unary(0x3000, 0x3001, [[0x03, 1], [0x07, 0], [0x00, 1], [0xff, 1]]),
  }),
  make({
    id: 'adic-copiar-bloque', group: 'adicional', title: 'Copiar un bloque', start: 0x2000,
    statement: 'Copiá los 8 bytes que empiezan en 3000h a las posiciones que empiezan en 3100h.',
    hint: 'Dos punteros (HL y DE) y un contador; LDAX/STAX o MOV con M según el par que uses.',
    tests: [
      tc(block(0x3000, [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]), block(0x3100, [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]), 'bloque 11 22 33 44 55 66 77 88'),
      tc(block(0x3000, [0, 0xff, 0, 0xff, 0, 0xff, 0, 0xff]), block(0x3100, [0, 0xff, 0, 0xff, 0, 0xff, 0, 0xff]), 'bloque 00 FF 00 FF 00 FF 00 FF'),
    ],
  }),
];

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}
