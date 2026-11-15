import { describe, it, expect } from 'vitest';
import { assemble } from '../src/asm/assembler';
import { buildTrace } from '../src/machine/trace';

const EX1 = ['LDA 0040H', 'CMA', 'STA 0041H', 'HLT'].join('\n');
const setup = (m: { setMemory(a: number, v: number): void }) => m.setMemory(0x40, 0x3a);

describe('buildTrace', () => {
  it('GTP05 ej. 1: 4 filas', () => {
    const { rows, truncated } = buildTrace(assemble(EX1, { start: 0x2000 }), setup);
    expect(truncated).toBe(false);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ n: 1, memAddr: 0x40, memValue: 0x3a, A: 0x3a });
    expect(rows[1]!.memAddr).toBeUndefined();
    expect(rows[1]).toMatchObject({ n: 2, A: 0xc5 });
    expect(rows[2]).toMatchObject({ n: 3, memAddr: 0x41, memValue: 0xc5 });
    expect(rows[3]!.memAddr).toBeUndefined();
    expect(rows[3]).toMatchObject({ n: 4, M: 0, Z: 0, CY: 0 });
  });

  it('bucle infinito: 500 filas y truncated', () => {
    const { rows, truncated } = buildTrace(assemble('L: JMP L', { start: 0x2000 }), () => {});
    expect(rows).toHaveLength(500);
    expect(truncated).toBe(true);
  });

  it('M es memoria[HL] después de la instrucción', () => {
    const p = assemble(['LXI H,0050H', 'MVI M,07H', 'HLT'].join('\n'), { start: 0x2000 });
    const { rows } = buildTrace(p, () => {});
    expect(rows[1]).toMatchObject({ memAddr: 0x50, memValue: 7, M: 7, H: 0, L: 0x50 });
  });
});
