/** Explicaciones en lenguaje simple de registros y banderas, para los carteles del panel. */
export interface Help {
  title: string;
  body: string;
}

export const REGISTER_PANEL_HELP: Readonly<Record<string, Help>> = {
  A: { title: 'A · Acumulador', body: 'Registro principal de 8 bits. Casi todas las operaciones aritméticas y lógicas lo usan y dejan ahí el resultado.' },
  B: { title: 'B · Registro B', body: 'Registro de uso general de 8 bits. Con C forma el par BC (B es el byte alto).' },
  C: { title: 'C · Registro C', body: 'Registro de uso general de 8 bits. Con B forma el par BC (C es el byte bajo). Suele usarse como contador.' },
  D: { title: 'D · Registro D', body: 'Registro de uso general de 8 bits. Con E forma el par DE (D es el byte alto).' },
  E: { title: 'E · Registro E', body: 'Registro de uso general de 8 bits. Con D forma el par DE (E es el byte bajo).' },
  H: { title: 'H · Registro H', body: 'Byte alto del par HL, que suele apuntar a una dirección de memoria (ver M).' },
  L: { title: 'L · Registro L', body: 'Byte bajo del par HL, que suele apuntar a una dirección de memoria (ver M).' },
  PC: { title: 'PC · Contador de programa', body: 'Dirección de 16 bits de la próxima instrucción que se va a ejecutar. Avanza solo después de cada instrucción.' },
  SP: { title: 'SP · Puntero de pila', body: 'Dirección de 16 bits del tope de la pila. PUSH, POP, CALL y RET lo modifican.' },
  M: { title: 'M · Memoria apuntada por HL', body: 'No es un registro: es el byte de memoria cuya dirección está en el par HL. Las instrucciones que usan M leen o escriben ese byte.' },
};

export const FLAG_HELP: Readonly<Record<string, Help>> = {
  S: { title: 'S · Signo', body: 'Vale 1 si el bit 7 del resultado es 1, es decir, si el número sería negativo en complemento a 2.' },
  Z: { title: 'Z · Cero', body: 'Vale 1 si el resultado de la última operación fue 0.' },
  AC: { title: 'AC · Acarreo auxiliar', body: 'Vale 1 si hubo acarreo del bit 3 al bit 4. Lo usa DAA para ajustar sumas en BCD.' },
  P: { title: 'P · Paridad', body: 'Vale 1 si el resultado tiene una cantidad par de unos.' },
  CY: { title: 'CY · Acarreo', body: 'Vale 1 si la suma se «pasó» de 8 bits (acarreo) o si en una resta hizo falta «pedir prestado».' },
};
