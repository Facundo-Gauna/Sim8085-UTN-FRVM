export interface Flags { S: 0 | 1; Z: 0 | 1; AC: 0 | 1; P: 0 | 1; CY: 0 | 1 }

export interface CpuState {
  A: number; B: number; C: number; D: number; E: number; H: number; L: number;
  SP: number; PC: number; flags: Flags; halted: boolean;
  ie: boolean;
  /**
   * EI recién ejecutado: las interrupciones enmascarables se habilitan
   * "a partir de la próxima instrucción" (pág. 15), así que no se aceptan
   * hasta que se complete la instrucción siguiente al EI.
   */
  eiPending: boolean;
  /**
   * IE vigente antes del último TRAP aceptado; el RIM inmediatamente posterior
   * lo devuelve en el bit 3 (pág. 16). `null` si no aplica.
   */
  ieBeforeTrap: boolean | null;
  masks: { m55: boolean; m65: boolean; m75: boolean };
  pending: { r75: boolean; r65: boolean; r55: boolean; trap: boolean };
  sid: 0 | 1; sod: 0 | 1;
}

export function initialState(pc: number): CpuState {
  return {
    A: 0, B: 0, C: 0, D: 0, E: 0, H: 0, L: 0,
    SP: 0, PC: pc,
    flags: { S: 0, Z: 0, AC: 0, P: 0, CY: 0 },
    halted: false,
    ie: false,
    eiPending: false,
    ieBeforeTrap: null,
    masks: { m55: true, m65: true, m75: true },
    pending: { r75: false, r65: false, r55: false, trap: false },
    sid: 0, sod: 0,
  };
}

// Byte de flags: S Z 0 AC 0 P 1 CY (bit 1 siempre 1)
export function packFlags(f: Flags): number {
  return (f.S << 7) | (f.Z << 6) | (f.AC << 4) | (f.P << 2) | 0x02 | f.CY;
}

export function unpackFlags(b: number): Flags {
  return {
    S: ((b >> 7) & 1) as 0 | 1,
    Z: ((b >> 6) & 1) as 0 | 1,
    AC: ((b >> 4) & 1) as 0 | 1,
    P: ((b >> 2) & 1) as 0 | 1,
    CY: (b & 1) as 0 | 1,
  };
}
