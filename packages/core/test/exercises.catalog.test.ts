import { describe, it, expect } from 'vitest';
import { assemble } from '../src/asm/assembler';
import { checkExercise } from '../src/exercises/check';
import { EXERCISES, getExercise, GROUP_TITLES } from '../src/exercises/catalog';

/** Solución de referencia por ejercicio. */
const SOLUTIONS: Record<string, string> = {
  'gtp05-1': 'LDA 0040H\nCMA\nSTA 0041H\nHLT',
  'gtp05-2': 'LDA 2000H\nMOV B, A\nLDA 2001H\nANA B\nSTA 2002H\nHLT',
  'gtp05-3': 'LDA 3000H\nMOV B, A\nLDA 3001H\nORA B\nSTA 3002H\nHLT',
  'gtp05-4': 'LDA 300AH\nANI 0F0H\nSTA 300AH\nHLT',
  'gtp05-5': 'LDA 2040H\nADI 0A1H\nSTA 2041H\nHLT',
  'gtp05-6': 'LDA 2000H\nMOV B, A\nLDA 2001H\nADD B\nMOV B, A\nLDA 2002H\nCMP B\nJNZ FIN\nSTA 2003H\nFIN: HLT',
  'gtp05-7': 'LHLD 2000H\nMOV A, M\nINX H\nADD M\nINX H\nMOV M, A\nHLT',
  'gtp05-8': 'LHLD 2000H\nMOV A, M\nADD A\nADD A\nINX H\nMOV M, A\nHLT',
  'gtp05-9': 'LHLD 2000H\nMOV A, M\nORA A\nMVI B, 01H\nJPE FIN\nINR M\nMVI B, 02H\nFIN: INX H\nMOV M, B\nHLT',
  'basico-cargar': 'MVI A, 5AH\nSTA 3000H\nHLT',
  'basico-copiar': 'LDA 3000H\nSTA 3001H\nHLT',
  'basico-incrementar': 'LDA 3000H\nINR A\nSTA 3001H\nHLT',
  'basico-sumar': 'LDA 3000H\nMOV B, A\nLDA 3001H\nADD B\nSTA 3002H\nHLT',
  'basico-intercambiar': 'LDA 3000H\nMOV B, A\nLDA 3001H\nSTA 3000H\nMOV A, B\nSTA 3001H\nHLT',
  'basico-doble': 'LDA 3000H\nADD A\nSTA 3001H\nHLT',
  'adic-mayor': 'LDA 3000H\nMOV B, A\nLDA 3001H\nCMP B\nJNC FIN\nMOV A, B\nFIN: STA 3002H\nHLT',
  'adic-suma-bloque': [
    'LXI H, 3001H', 'LDA 3000H', 'MOV C, A', 'MVI A, 00H',
    'LP: MOV B, A', 'MOV A, C', 'ORA A', 'JZ FIN', 'MOV A, B', 'ADD M', 'INX H', 'DCR C', 'JMP LP',
    'FIN: MOV A, B', 'STA 3100H', 'HLT',
  ].join('\n'),
  'adic-bits': [
    'LDA 3000H', 'MVI B, 00H', 'MVI C, 08H',
    'LP: RRC', 'JNC SK', 'INR B', 'SK: DCR C', 'JNZ LP', 'MOV A, B', 'STA 3001H', 'HLT',
  ].join('\n'),
  'adic-rellenar': 'LXI H, 3010H\nMVI C, 10H\nLP: MVI M, 00H\nINX H\nDCR C\nJNZ LP\nHLT',
  'adic-paridad': 'LDA 3000H\nORA A\nMVI A, 00H\nJPO FIN\nMVI A, 01H\nFIN: STA 3001H\nHLT',
  'adic-copiar-bloque': [
    'LXI H, 3000H', 'LXI D, 3100H', 'MVI C, 08H',
    'LP: MOV A, M', 'STAX D', 'INX H', 'INX D', 'DCR C', 'JNZ LP', 'HLT',
  ].join('\n'),
  'basico-restar': 'LDA 3001H\nMOV B, A\nLDA 3000H\nSUB B\nSTA 3002H\nHLT',
  'basico-encender': 'LDA 3000H\nORI 81H\nSTA 3001H\nHLT',
  'basico-nibbles': 'LDA 3000H\nRLC\nRLC\nRLC\nRLC\nSTA 3001H\nHLT',
  'basico-complemento2': 'LDA 3000H\nCMA\nINR A\nSTA 3001H\nHLT',
  'basico-mitad': 'LDA 3000H\nORA A\nRAR\nSTA 3001H\nHLT',
  'inter-suma16': 'LHLD 3000H\nXCHG\nLHLD 3002H\nDAD D\nSHLD 3004H\nHLT',
  'inter-signo': 'LDA 3000H\nORA A\nMVI B, 00H\nJZ FIN\nMVI B, 01H\nJP FIN\nMVI B, 0FFH\nFIN: MOV A, B\nSTA 3001H\nHLT',
  'inter-multiplicar': 'LDA 3001H\nMOV C, A\nLDA 3000H\nMOV B, A\nXRA A\nLP: INR C\nDCR C\nJZ FIN\nADD B\nDCR C\nJMP LP\nFIN: STA 3002H\nHLT',
  'inter-menor': 'LXI H, 3001H\nLDA 3000H\nMOV C, A\nMOV A, M\nLP: DCR C\nJZ FIN\nINX H\nCMP M\nJC LP\nMOV A, M\nJMP LP\nFIN: STA 3100H\nHLT',
  'inter-contar-ceros': 'LXI H, 3000H\nMVI C, 08H\nMVI B, 00H\nLP: MOV A, M\nORA A\nJNZ SK\nINR B\nSK: INX H\nDCR C\nJNZ LP\nMOV A, B\nSTA 3100H\nHLT',
  'inter-mayusculas': 'LXI H, 3000H\nMVI C, 08H\nLP: MOV A, M\nCPI 61H\nJC SK\nCPI 7BH\nJNC SK\nSUI 20H\nMOV M, A\nSK: INX H\nDCR C\nJNZ LP\nHLT',
  'inter-bcd': 'LDA 3000H\nMVI B, 00H\nLP: CPI 0AH\nJC FIN\nSUI 0AH\nINR B\nJMP LP\nFIN: MOV C, A\nMOV A, B\nRLC\nRLC\nRLC\nRLC\nORA C\nSTA 3001H\nHLT',
  'adic-invertir': 'LXI H, 3000H\nLXI D, 3107H\nMVI C, 08H\nLP: MOV A, M\nSTAX D\nINX H\nDCX D\nDCR C\nJNZ LP\nHLT',
  'adic-ordenar': 'MVI B, 04H\nPASADA: LXI H, 3000H\nMVI C, 04H\nCOMP: MOV A, M\nINX H\nCMP M\nJC SIG\nJZ SIG\nMOV D, M\nMOV M, A\nDCX H\nMOV M, D\nINX H\nSIG: DCR C\nJNZ COMP\nDCR B\nJNZ PASADA\nHLT',
  'adic-fibonacci': 'LDA 3000H\nMOV C, A\nLXI H, 3001H\nMVI D, 00H\nMVI E, 01H\nLP: MOV M, E\nINX H\nMOV A, D\nADD E\nMOV D, E\nMOV E, A\nDCR C\nJNZ LP\nHLT',
};
const check = (id: string, src: string, start?: number) => {
  const ex = getExercise(id)!;
  return checkExercise(assemble(src, { start: start ?? ex.start }), ex);
};

describe('catálogo', () => {
  it('ids únicos y grupos esperados', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(EXERCISES.filter((e) => e.group === 'catedra')).toHaveLength(9);
    expect(EXERCISES.filter((e) => e.group === 'basico').length).toBeGreaterThanOrEqual(5);
    expect(EXERCISES.filter((e) => e.group === 'adicional').length).toBeGreaterThanOrEqual(5);
    expect(getExercise('gtp05-1')).toBeDefined();
    expect(getExercise('x')).toBeUndefined();
    expect(GROUP_TITLES).toEqual({
      basico: 'Básicos',
      catedra: 'De la cátedra (GTP05)',
      intermedio: 'Intermedios (saltos y lazos)',
      adicional: 'Adicionales',
    });
    expect(EXERCISES.filter((e) => e.group === 'intermedio').length).toBeGreaterThanOrEqual(5);
  });

  it.each(EXERCISES.map((e) => [e.id, e] as const))('%s: invariantes', (_id, ex) => {
    expect(ex.memory).toEqual(ex.tests[0]!.memory);
    expect(ex.tests.length).toBeGreaterThanOrEqual(ex.id === 'basico-cargar' ? 1 : 2);
    expect(ex.hint.length).toBeGreaterThanOrEqual(20);
    expect(ex.starter).toContain('HLT');
    expect(ex.start).toBeGreaterThanOrEqual(0);
    expect(ex.start).toBeLessThanOrEqual(0xffff);
    expect(SOLUTIONS[ex.id], 'falta solución de referencia').toBeDefined();
  });

  it.each(EXERCISES.map((e) => e.id))('%s: la solución de referencia pasa todos los casos', (id) => {
    const r = check(id, SOLUTIONS[id]!);
    expect(r.failure?.message).toBeUndefined();
    expect(r.ok).toBe(true);
    expect(r.passed).toBe(getExercise(id)!.tests.length);
  });

  it('el starter solo (HLT) no resuelve ningún ejercicio', () => {
    for (const ex of EXERCISES) {
      expect(checkExercise(assemble(ex.starter, { start: ex.start }), ex).ok, ex.id).toBe(false);
    }
  });

  it('soluciones erróneas conocidas dan el mensaje del caso', () => {
    const or = check('gtp05-2', SOLUTIONS['gtp05-2']!.replace('ANA B', 'ORA B'));
    expect(or.failure!.message.startsWith('Falla cuando 2000h = ')).toBe(true);
    expect(check('gtp05-5', SOLUTIONS['gtp05-5']!.replace('0A1H', '0A0H')).ok).toBe(false);
    const noZero = [
      'LXI H, 3001H', 'LDA 3000H', 'MOV C, A', 'MVI A, 00H',
      'LP: ADD M', 'INX H', 'DCR C', 'JNZ LP', 'STA 3100H', 'HLT',
    ].join('\n');
    expect(check('adic-suma-bloque', noZero).failure!.message).toContain('N = 0');
  });

  it('gtp05-2 ensamblado en 2000h pisa sus datos: overlap', () => {
    expect(check('gtp05-2', SOLUTIONS['gtp05-2']!, 0x2000).failure!.kind).toBe('overlap');
  });

  it('GTP05 ej. 4: nibble alto conservado (B7h → B0h) y la pista lo aclara', () => {
    const ex = getExercise('gtp05-4')!;
    expect(ex.tests.map((t) => [t.memory[0]![1], t.expect[0]![1]])).toEqual([[0xb7, 0xb0], [0x0f, 0], [0xf0, 0xf0], [0x5a, 0x50]]);
    expect(ex.hint).toMatch(/nibble alto/i);
  });

  it('GTP05 ej. 6: guardar siempre el tercer valor no pasa', () => {
    const always = 'LDA 2002H\nSTA 2003H\nHLT';
    expect(check('gtp05-6', always).ok).toBe(false);
  });

  it('GTP05 ej. 7 a 9: fijar la dirección 4000h en vez de leer el puntero no pasa', () => {
    for (const id of ['gtp05-7', 'gtp05-8', 'gtp05-9']) {
      const fixed = SOLUTIONS[id]!.replace('LHLD 2000H', 'LXI H, 4000H');
      expect(check(id, fixed).ok, id).toBe(false);
    }
  });

  it('GTP05 ej. 9: los datos dan igual con paridad de bits y con número par', () => {
    for (const t of getExercise('gtp05-9')!.tests) {
      const value = t.memory[2]![1];
      const ones = value.toString(2).split('1').length - 1;
      expect(ones % 2, String(value)).toBe(value % 2);
    }
  });
});
