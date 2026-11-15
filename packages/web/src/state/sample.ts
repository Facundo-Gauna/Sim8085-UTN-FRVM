/** Programa de ejemplo con el que arranca la sesión: GTP05, ejercicio 1. */
const text = `; GTP05 ejercicio 1: complemento del dato de 0040h en 0041h
        LDA 0040H       ; A ← M[0040h], traigo el dato
        CMA             ; A = NOT A, complemento
        STA 0041H       ; M[0041h] ← A, guardo el resultado
        HLT             ; fin del programa
`;

export const SAMPLE: {
  name: 'ej1-complemento.asm';
  text: string;
  /** Datos iniciales del alumno (dirección, byte). */
  memory: [[0x40, 0x3a]];
} = {
  name: 'ej1-complemento.asm',
  text,
  memory: [[0x40, 0x3a]],
};
