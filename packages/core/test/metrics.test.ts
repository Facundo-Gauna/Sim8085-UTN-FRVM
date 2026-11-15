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
