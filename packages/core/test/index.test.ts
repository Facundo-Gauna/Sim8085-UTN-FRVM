import { describe, it, expect } from 'vitest';
import * as api from '../src/index';
import {
  assemble, Machine, buildTrace, computeMetrics,
} from '../src/index';

describe('API pública', () => {
  it('exporta todos los nombres', () => {
    const names = [
      'ISA', 'byOpcode', 'findInstr', 'INVALID_OPCODES',
      'assemble', 'parseNumber', 'lexLine',
      'initialState', 'packFlags', 'unpackFlags',
      'parity', 'add8', 'sub8', 'and8', 'or8', 'xor8', 'inr8', 'dcr8', 'daa',
      'execute', 'acceptInterrupt',
      'Machine', 'buildTrace', 'computeMetrics', 'diffMetrics',
    ];
    for (const n of names) expect((api as Record<string, unknown>)[n], n).toBeDefined();
  });

  it('extremo a extremo: GTP05 ej. 1', () => {
    const p = assemble('LDA 0040H\nCMA\nSTA 0041H\nHLT', { start: 0x2000 });
    expect(p.ok).toBe(true);
    const m = new Machine(p);
    m.setMemory(0x40, 0x3a);
    m.run();
    expect(m.memory[0x41]).toBe(0xc5);
    expect(computeMetrics(p, m).executed).toBe(4);
    const t = buildTrace(p, (mm) => mm.setMemory(0x40, 0x3a));
    expect(t.rows).toHaveLength(4);
    expect(t.rows[2]!.memValue).toBe(0xc5);
  });
});
