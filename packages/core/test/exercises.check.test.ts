import { describe, it, expect } from 'vitest';
import { assemble } from '../src/asm/assembler';
import { checkExercise, caseLabel } from '../src/exercises/check';
import type { Exercise } from '../src/exercises/types';

const NOT: Exercise = {
  id: 'not', group: 'basico', title: 'Complemento', statement: '', hint: '', start: 0x2000, starter: '',
  memory: [[0x40, 0x3a]],
  tests: [
    { memory: [[0x40, 0x3a]], expect: [[0x41, 0xc5]] },
    { memory: [[0x40, 0x00]], expect: [[0x41, 0xff]] },
  ],
};
const run = (src: string, ex: Exercise = NOT, start = ex.start) => checkExercise(assemble(src, { start }), ex);

describe('checkExercise', () => {
  it('solución correcta pasa todos los casos', () => {
    expect(run('LDA 0040H\nCMA\nSTA 0041H\nHLT')).toEqual({ ok: true, passed: 2, total: 2 });
  });

  it('solución incorrecta: mensaje con el caso concreto', () => {
    const r = run('LDA 0040H\nSTA 0041H\nHLT');
    expect(r.ok).toBe(false);
    expect(r.passed).toBe(0);
    expect(r.failure).toEqual({
      kind: 'mismatch', caseIndex: 0,
      message: 'Falla cuando 0040h = 3Ah: 0041h debía ser C5h y quedó 3Ah',
    });
  });

  it('pasa el primer caso y falla en el segundo', () => {
    const r = run('LDA 0040H\nCPI 00H\nJZ FIN\nCMA\nFIN: STA 0041H\nHLT');
    expect(r.passed).toBe(1);
    expect(r.failure).toMatchObject({ kind: 'mismatch', caseIndex: 1 });
  });

  it('bucle infinito: no-halt con el caso', () => {
    const r = run('LP: JMP LP');
    expect(r.failure!.kind).toBe('no-halt');
    expect(r.failure!.message).toContain('(¿bucle infinito?)');
    expect(r.failure!.message).toContain('0040h = 3Ah');
  });

  it('opcode inválido: error de ejecución', () => {
    expect(run('DB 08H').failure!.kind).toBe('runtime');
  });

  it('con errores de ensamblado no ejecuta', () => {
    const r = run('MVI A, A1H');
    expect(r.failure).toEqual({
      kind: 'assemble', caseIndex: -1,
      message: 'El programa tiene errores de ensamblado: corregilos primero',
    });
    expect(r.passed).toBe(0);
  });

  it('el programa que ocupa un dato del ejercicio da overlap', () => {
    const r = run('ORG 0040H\nLDA 0040H\nCMA\nSTA 0041H\nHLT');
    expect(r.failure!.kind).toBe('overlap');
    expect(r.failure!.message).toContain('0040h');
  });

  it('caseLabel sin datos y con varios', () => {
    expect(caseLabel({ memory: [], expect: [] })).toBe('sin datos');
    expect(caseLabel({ memory: [[0x40, 0xff], [0x41, 0]], expect: [] })).toBe('0040h = FFh, 0041h = 00h');
    expect(caseLabel({ label: 'N = 3', memory: [[0, 1]], expect: [] })).toBe('N = 3');
  });

  it('un ejercicio sin casos no lanza', () => {
    expect(run('HLT', { ...NOT, tests: [] })).toEqual({ ok: true, passed: 0, total: 0 });
  });
});
