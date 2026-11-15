import { describe, it, expect } from 'vitest';
import { assemble } from '../src/asm/assembler';
import { Machine } from '../src/machine/machine';
import { computeMetrics, diffMetrics } from '../src/machine/metrics';

const run = (src: string) => {
  const p = assemble(src, { start: 0x2000 });
  const m = new Machine(p);
  m.setMemory(0x40, 0x3a);
  m.run();
  return computeMetrics(p, m);
};

describe('computeMetrics', () => {
  it('GTP05 ej. 1', () => {
    expect(run(['LDA 0040H', 'CMA', 'STA 0041H', 'HLT'].join('\n'))).toEqual({
      sizeBytes: 8, range: [0x2000, 0x2007], executed: 4, tStates: 35,
      registersUsed: ['A'], memoryUsed: [0x40, 0x41],
    });
  });

  it('registros: M implica H y L; pares implican ambos', () => {
    const r = run(['LXI B,0040H', 'MOV A,M', 'HLT'].join('\n'));
    expect(r.registersUsed).toEqual(['A', 'B', 'C', 'H', 'L']);
  });

  it('diffMetrics = cur - prev', () => {
    const a = run(['LDA 0040H', 'STA 0041H', 'HLT'].join('\n'));
    const b = run(['LDA 0040H', 'CMA', 'STA 0041H', 'HLT'].join('\n'));
    expect(diffMetrics(a, b)).toEqual({ sizeBytes: 1, executed: 1, tStates: 4 });
    expect(diffMetrics(b, a)).toEqual({ sizeBytes: -1, executed: -1, tStates: -4 });
  });
});

describe('computeMetrics: DAD y interrupciones', () => {
  it('DAD B/D/SP implican H y L', () => {
    expect(run('DAD B\nHLT').registersUsed).toEqual(['B', 'C', 'H', 'L']);
    expect(run('DAD D\nHLT').registersUsed).toEqual(['D', 'E', 'H', 'L']);
    expect(run('DAD SP\nHLT').registersUsed).toEqual(['H', 'L']);
    expect(run('DAD H\nHLT').registersUsed).toEqual(['H', 'L']);
  });

  it('executed no cuenta la aceptación de interrupción; back() restaura ambos', () => {
    const p = assemble('LXI SP,3000H\nMVI A,08H\nSIM\nEI\nNOP\nNOP\nHLT', { start: 0x2000 });
    const m = new Machine(p);
    for (let i = 0; i < 5; i++) m.step();
    m.raise('RST6.5');
    m.step(); // aceptación
    expect(m.stepCount).toBe(6);
    expect(m.executedInstructions).toBe(5);
    expect(computeMetrics(p, m).executed).toBe(5);
    m.back();
    expect(m.stepCount).toBe(5);
    expect(m.executedInstructions).toBe(5);
    m.step(); m.step();
    m.back(); m.back();
    expect(m.executedInstructions).toBe(5);
    m.reset();
    expect(m.executedInstructions).toBe(0);
  });
});
