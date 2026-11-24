/** Catálogo de ejercicios: básicos, GTP05 (cátedra) y adicionales (spec §6.9). */
import type { Exercise, TestCase } from './types';

export const GROUP_TITLES: Record<Exercise['group'], string> = {
  basico: 'Básicos',
  catedra: 'De la cátedra (GTP05)',
  intermedio: 'Intermedios (saltos y lazos)',
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

/** GTP05 6: 2003h arranca con una marca (EEh) cuando la suma no coincide, y debe quedar igual. */
const sumCheck = (a: number, b: number, c: number): TestCase => {
  const equal = a + b === c;
  const memory: Pair[] = [[0x2000, a], [0x2001, b], [0x2002, c]];
  if (!equal) memory.push([0x2003, 0xee]);
  return tc(memory, [[0x2003, equal ? c : 0xee]]);
};

/** GTP05 7–9: en 2000h–2001h va la dirección `p` (byte bajo primero) y a partir de `p`, los datos. */
const pointed = (p: number, data: number[], expect: Pair[]): TestCase =>
  tc([[0x2000, p & 0xff], [0x2001, p >> 8], ...data.map((b, i): Pair => [p + i, b])], expect);

/** GTP05 9: par → 1 en p+1; impar → p vale uno más y 2 en p+1. */
const parity = (p: number, value: number): TestCase => {
  const even = value % 2 === 0; // los datos elegidos coinciden con la paridad de bits
  return pointed(p, [value], [[p, even ? value : value + 1], [p + 1, even ? 1 : 2]]);
};

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
    id: 'gtp05-6', group: 'catedra', title: 'GTP05 · 6', start: 0x1000,
    statement:
      'En las posiciones de memoria 2000h, 2001h y 2002h se encuentran 3 valores, deben sumarse los primeros y compararse con el tercer valor. Si la suma es equivalente al tercer valor almacenar el mismo en la posición 2003h; de lo contrario no almacenar valores.',
    hint: 'Se suman los dos primeros (2000h y 2001h). Comparar con CMP deja Z = 1 si son iguales: saltá por encima del guardado cuando no lo sean. Los datos viven en 2000h, así que empezá el programa en otra dirección.',
    tests: [
      sumCheck(0x10, 0x20, 0x30),
      sumCheck(0x10, 0x20, 0x31),
      sumCheck(0x05, 0x0a, 0x0f),
      sumCheck(0x01, 0x02, 0x00),
    ],
  }),
  make({
    id: 'gtp05-7', group: 'catedra', title: 'GTP05 · 7', start: 0x1000,
    statement:
      'En las posiciones 2000h y 2001h se encuentra la dirección de memoria donde existe un valor que debe ser sumado al valor de la siguiente dirección de memoria y almacenado en la próxima dirección. Ej: 2000h y 2001h contienen 00 y 40 respectivamente, significa que en la dirección de memoria 4000h se encuentra el primer valor, en la 4001h el siguiente valor y debe almacenarse en 4002h.',
    hint: 'La dirección está con el byte bajo primero: hay una instrucción que carga HL directamente desde dos posiciones seguidas. Después recorré con HL como puntero. Si la suma desborda, se descarta el acarreo.',
    tests: [
      pointed(0x4000, [0x12, 0x34], [[0x4002, 0x46]]),
      pointed(0x3050, [0x01, 0x02], [[0x3052, 0x03]]),
      pointed(0x25fe, [0xf0, 0x20], [[0x2600, 0x10]]),
    ],
  }),
  make({
    id: 'gtp05-8', group: 'catedra', title: 'GTP05 · 8', start: 0x1000,
    statement:
      'Obtener el valor alojado en la posición de memoria almacenada en la posición 2000h (es decir, el número a multiplicar no se encuentra en 2000h sino que 2000h apunta a la dirección que lo contiene), multiplicar por 4 y almacenar el valor en la siguiente posición.',
    hint: 'La dirección ocupa 2000h–2001h (byte bajo primero) y la «siguiente posición» es la que sigue al número, no a 2000h; esta interpretación está pendiente de confirmar con la cátedra. Multiplicar por 4 es duplicar dos veces.',
    tests: [
      pointed(0x4000, [0x05], [[0x4001, 0x14]]),
      pointed(0x3050, [0x3f], [[0x3051, 0xfc]]),
      pointed(0x25ff, [0x00], [[0x2600, 0x00]]),
    ],
  }),
  make({
    id: 'gtp05-9', group: 'catedra', title: 'GTP05 · 9', start: 0x1000,
    statement:
      'Obtener el valor alojado en la posición de memoria almacenada en la posición 2000h; si su paridad es par almacenar un valor 1 en la siguiente posición; de lo contrario sumar 1, reemplazarlo en memoria y almacenar el valor 2 en la siguiente posición.',
    hint: 'La dirección ocupa 2000h–2001h (byte bajo primero). «Paridad par» es la bandera P (cantidad par de bits en 1), interpretación pendiente de confirmar con la cátedra. MOV no actualiza banderas: usá ORA A antes del salto.',
    tests: [
      parity(0x4000, 0x06),
      parity(0x3050, 0x07),
      parity(0x25ff, 0x01),
      parity(0x4000, 0x00),
      parity(0x3050, 0x7f),
      parity(0x25ff, 0xc0),
    ],
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
    id: 'basico-restar', group: 'basico', title: 'Restar dos bytes', start: 0x2000,
    statement: 'Restá al byte de 3000h el byte de 3001h y guardá el resultado en 3002h. Si el resultado es negativo, queda en complemento a 2 (módulo 256).',
    hint: 'La resta siempre es "acumulador menos registro": el minuendo tiene que quedar en A al final.',
    tests: binary(0x3000, 0x3001, 0x3002, [[0x05, 0x03, 0x02], [0x03, 0x05, 0xfe], [0x00, 0x01, 0xff], [0x80, 0x80, 0x00]]),
  }),
  make({
    id: 'basico-encender', group: 'basico', title: 'Encender bits', start: 0x2000,
    statement: 'Encendé (poné en 1) los bits 7 y 0 del byte de 3000h, sin tocar los demás, y guardá el resultado en 3001h.',
    hint: 'Una máscara con OR enciende los bits que valen 1 en la máscara y deja igual el resto. ¿Cuánto vale 1000 0001b en hexa?',
    tests: unary(0x3000, 0x3001, [[0x00, 0x81], [0x3c, 0xbd], [0xff, 0xff], [0x80, 0x81]]),
  }),
  make({
    id: 'basico-nibbles', group: 'basico', title: 'Intercambiar nibbles', start: 0x2000,
    statement: 'Intercambiá los nibbles (mitades de 4 bits) del byte de 3000h y guardá el resultado en 3001h. Por ejemplo, 3Ah → A3h.',
    hint: 'Rotar el acumulador 4 veces hacia el mismo lado mueve cada nibble al lugar del otro.',
    tests: unary(0x3000, 0x3001, [[0x3a, 0xa3], [0xf0, 0x0f], [0x00, 0x00], [0x12, 0x21]]),
  }),
  make({
    id: 'basico-complemento2', group: 'basico', title: 'Complemento a 2', start: 0x2000,
    statement: 'Guardá en 3001h el complemento a 2 (el opuesto) del byte de 3000h.',
    hint: 'Complemento a 2 = complemento a 1 más uno: dos instrucciones de un byte cada una.',
    tests: unary(0x3000, 0x3001, [[0x01, 0xff], [0x00, 0x00], [0x80, 0x80], [0x05, 0xfb]]),
  }),
  make({
    id: 'basico-mitad', group: 'basico', title: 'Dividir por 2', start: 0x2000,
    statement: 'Dividí por 2 (sin signo, descartando el resto) el byte de 3000h y guardá el resultado en 3001h.',
    hint: 'Desplazar a la derecha divide por 2. RAR mete el CY en el bit 7: asegurate de que CY valga 0 antes (ORA A lo limpia).',
    tests: unary(0x3000, 0x3001, [[0x08, 0x04], [0x81, 0x40], [0xff, 0x7f], [0x01, 0x00]]),
  }),

  make({
    id: 'inter-suma16', group: 'intermedio', title: 'Suma de 16 bits', start: 0x2000,
    statement: 'En 3000h–3001h hay un número de 16 bits (byte bajo primero) y en 3002h–3003h otro. Guardá la suma en 3004h–3005h (byte bajo primero), descartando el desborde.',
    hint: 'LHLD carga 16 bits de memoria en HL; XCHG pasa HL a DE; DAD suma un par a HL; SHLD guarda HL.',
    tests: [
      tc([[0x3000, 0x34], [0x3001, 0x12], [0x3002, 0x11], [0x3003, 0x11]], [[0x3004, 0x45], [0x3005, 0x23]], '1234h + 1111h'),
      tc([[0x3000, 0xff], [0x3001, 0x00], [0x3002, 0x01], [0x3003, 0x00]], [[0x3004, 0x00], [0x3005, 0x01]], '00FFh + 0001h (acarreo al byte alto)'),
      tc([[0x3000, 0xff], [0x3001, 0xff], [0x3002, 0x01], [0x3003, 0x00]], [[0x3004, 0x00], [0x3005, 0x00]], 'FFFFh + 0001h'),
    ],
  }),
  make({
    id: 'inter-signo', group: 'intermedio', title: 'Signo de un número', start: 0x2000,
    statement: 'Mirá el byte de 3000h como número con signo y guardá en 3001h: 01h si es positivo, 00h si es cero y FFh si es negativo.',
    hint: 'ORA A actualiza Z y S sin cambiar A. MVI no modifica banderas, así que podés cargar un resultado y después saltar.',
    tests: unary(0x3000, 0x3001, [[0x05, 0x01], [0x00, 0x00], [0x80, 0xff], [0x7f, 0x01], [0xff, 0xff]]),
  }),
  make({
    id: 'inter-multiplicar', group: 'intermedio', title: 'Multiplicar por sumas', start: 0x2000,
    statement: 'Multiplicá el byte de 3000h por el de 3001h sumando repetidas veces y guardá el resultado (módulo 256) en 3002h. Cualquiera de los dos puede ser 0.',
    hint: 'Un registro cuenta cuántas veces falta sumar. Preguntá si el contador es 0 ANTES de sumar, si no 0 × algo da mal.',
    tests: binary(0x3000, 0x3001, 0x3002, [[0x03, 0x04, 0x0c], [0x07, 0x00, 0x00], [0x00, 0x09, 0x00], [0x10, 0x10, 0x00], [0x0f, 0x0f, 0xe1]]),
  }),
  make({
    id: 'inter-menor', group: 'intermedio', title: 'El menor de un bloque', start: 0x2000,
    statement: 'En 3000h hay una cantidad N (al menos 1) y a partir de 3001h hay N bytes. Guardá en 3100h el menor de ellos (sin signo).',
    hint: 'Arrancá con el primero como "menor hasta ahora" y compará con CMP M: CY = 1 si A es menor que el dato.',
    tests: [
      tc([[0x3000, 4], ...block(0x3001, [9, 3, 7, 5])], [[0x3100, 3]], 'N = 4, datos 09 03 07 05'),
      tc([[0x3000, 1], [0x3001, 0x42]], [[0x3100, 0x42]], 'N = 1, dato 42'),
      tc([[0x3000, 3], ...block(0x3001, [0xff, 0x80, 0x00])], [[0x3100, 0]], 'N = 3, datos FF 80 00'),
    ],
  }),
  make({
    id: 'inter-contar-ceros', group: 'intermedio', title: 'Contar ceros', start: 0x2000,
    statement: 'Contá cuántos de los 8 bytes que empiezan en 3000h valen 00h y guardá la cuenta en 3100h.',
    hint: 'MOV A,M no toca las banderas: hace falta una instrucción que las actualice (ORA A) antes del salto condicional.',
    tests: [
      tc(block(0x3000, [0, 1, 0, 2, 0, 3, 0, 4]), [[0x3100, 4]], 'datos 00 01 00 02 00 03 00 04'),
      tc(block(0x3000, Array(8).fill(0)), [[0x3100, 8]], 'todos en 00'),
      tc(block(0x3000, Array(8).fill(0xff)), [[0x3100, 0]], 'ninguno en 00'),
    ],
  }),
  make({
    id: 'inter-mayusculas', group: 'intermedio', title: 'Pasar a mayúsculas', start: 0x2000,
    statement: 'A partir de 3000h hay 8 caracteres ASCII. Pasá a mayúscula las letras minúsculas (a–z), en el mismo lugar; los demás caracteres no cambian.',
    hint: 'En ASCII, una minúscula vale 20h más que su mayúscula. Usá dos CPI para saber si el carácter está entre 61h y 7Ah.',
    tests: [
      tc(block(0x3000, [...'hola 85!'].map((c) => c.charCodeAt(0))), block(0x3000, [...'HOLA 85!'].map((c) => c.charCodeAt(0))), '"hola 85!"'),
      tc(block(0x3000, [...'aZ`{z@Az'].map((c) => c.charCodeAt(0))), block(0x3000, [...'AZ`{Z@AZ'].map((c) => c.charCodeAt(0))), 'bordes "aZ`{z@Az"'),
    ],
  }),
  make({
    id: 'inter-bcd', group: 'intermedio', title: 'Binario a BCD', start: 0x2000,
    statement: 'El byte de 3000h vale entre 0 y 99 (decimal). Guardá en 3001h su valor en BCD empaquetado: decenas en el nibble alto y unidades en el bajo. Por ejemplo, 2Ah (42) → 42h.',
    hint: 'Restá 10 mientras se pueda contando las restas: la cuenta son las decenas y lo que queda, las unidades. Después juntalas con 4 rotaciones y un OR.',
    tests: unary(0x3000, 0x3001, [[0x2a, 0x42], [0x00, 0x00], [0x63, 0x99], [0x09, 0x09], [0x0a, 0x10]]),
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
  make({
    id: 'adic-invertir', group: 'adicional', title: 'Invertir un bloque', start: 0x2000,
    statement: 'Copiá los 8 bytes que empiezan en 3000h a partir de 3100h, pero en orden inverso (el de 3000h va a 3107h).',
    hint: 'Un puntero sube (INX) y el otro baja (DCX). El primero de destino es 3107h.',
    tests: [
      tc(block(0x3000, [1, 2, 3, 4, 5, 6, 7, 8]), block(0x3100, [8, 7, 6, 5, 4, 3, 2, 1]), 'datos 01 … 08'),
      tc(block(0x3000, [0xaa, 0, 0, 0, 0, 0, 0, 0xbb]), block(0x3100, [0xbb, 0, 0, 0, 0, 0, 0, 0xaa]), 'datos AA 00 … 00 BB'),
    ],
  }),
  make({
    id: 'adic-ordenar', group: 'adicional', title: 'Ordenar un bloque', start: 0x2000,
    statement: 'Ordená de menor a mayor (sin signo), en el mismo lugar, los 5 bytes que empiezan en 3000h.',
    hint: 'Método de la burbuja: 4 pasadas comparando vecinos e intercambiándolos si están al revés. Un registro auxiliar guarda uno de los dos durante el intercambio.',
    tests: [
      tc(block(0x3000, [5, 1, 4, 2, 3]), block(0x3000, [1, 2, 3, 4, 5]), 'datos 05 01 04 02 03'),
      tc(block(0x3000, [0xff, 0x80, 0x7f, 0x00, 0x80]), block(0x3000, [0x00, 0x7f, 0x80, 0x80, 0xff]), 'datos FF 80 7F 00 80'),
      tc(block(0x3000, [9, 8, 7, 6, 5]), block(0x3000, [5, 6, 7, 8, 9]), 'al revés'),
    ],
  }),
  make({
    id: 'adic-fibonacci', group: 'adicional', title: 'Serie de Fibonacci', start: 0x2000,
    statement: 'En 3000h hay una cantidad N (entre 2 y 13). Escribí a partir de 3001h los primeros N términos de la serie de Fibonacci: 01, 01, 02, 03, 05, 08…',
    hint: 'Guardá los dos últimos términos en dos registros; el siguiente es su suma. Después de escribir, "corré" los registros un lugar.',
    tests: [
      tc([[0x3000, 10]], block(0x3001, [1, 1, 2, 3, 5, 8, 13, 21, 34, 55]), 'N = 10'),
      tc([[0x3000, 2]], block(0x3001, [1, 1]), 'N = 2'),
      tc([[0x3000, 13]], block(0x3001, [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233]), 'N = 13'),
    ],
  }),
];

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((e) => e.id === id);
}
