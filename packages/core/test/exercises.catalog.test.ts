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
};
const check = (id: string, src: string, start?: number) => {
  const ex = getExercise(id)!;
  return checkExercise(assemble(src, { start: start ?? ex.start }), ex);
};

describe('catálogo', () => {
  it('ids únicos y grupos esperados', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
    expect(EXERCISES.filter((e) => e.group === 'catedra')).toHaveLength(5);
    expect(EXERCISES.filter((e) => e.group === 'basico').length).toBeGreaterThanOrEqual(5);
    expect(EXERCISES.filter((e) => e.group === 'adicional').length).toBeGreaterThanOrEqual(5);
    expect(getExercise('gtp05-1')).toBeDefined();
    expect(getExercise('x')).toBeUndefined();
    expect(GROUP_TITLES).toEqual({ basico: 'Básicos', catedra: 'De la cátedra (GTP05)', adicional: 'Adicionales' });
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
});
