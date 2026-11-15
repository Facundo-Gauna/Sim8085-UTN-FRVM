import { describe, it, expect } from 'vitest';
import { ISA, INVALID_OPCODES } from '../src/isa/table';
import { byOpcode, findInstr } from '../src/isa/lookup';

describe('ISA: estructura de la tabla', () => {
  it('tiene 246 instrucciones', () => {
    expect(ISA.length).toBe(246);
  });

  it('opcodes únicos', () => {
    const set = new Set(ISA.map((d) => d.opcode));
    expect(set.size).toBe(ISA.length);
  });

  it('INVALID_OPCODES ∪ opcodes de ISA cubre 0x00–0xFF sin solaparse', () => {
    expect([...INVALID_OPCODES]).toEqual([0x08, 0x10, 0x18, 0x28, 0x38, 0xcb, 0xd9, 0xdd, 0xed, 0xfd]);
    const all = new Set<number>([...ISA.map((d) => d.opcode), ...INVALID_OPCODES]);
    expect(all.size).toBe(256);
    for (let op = 0; op <= 0xff; op++) expect(all.has(op)).toBe(true);
    for (const op of INVALID_OPCODES) expect(byOpcode(op)).toBeUndefined();
  });

  it('cada definición es coherente (tamaño según operandos, summary no vacío)', () => {
    for (const d of ISA) {
      const extra = d.operands.some((o) => o === 'd16' || o === 'addr') ? 2
        : d.operands.some((o) => o === 'd8' || o === 'port') ? 1 : 0;
      expect(d.size, d.mnemonic).toBe(1 + extra);
      expect(d.summary.length).toBeGreaterThan(0);
      expect(Array.isArray(d.tStates)).toBe(Array.isArray(d.machineCycles));
    }
  });
});

describe('ISA: muestras de la pág. 19', () => {
  it('0x3A LDA', () => {
    const d = byOpcode(0x3a)!;
    expect(d.mnemonic).toBe('LDA');
    expect(d.operands).toEqual(['addr']);
    expect(d.size).toBe(3);
    expect(d.tStates).toBe(13);
  });
  it('0x2F CMA', () => {
    const d = byOpcode(0x2f)!;
    expect(d.mnemonic).toBe('CMA');
    expect(d.size).toBe(1);
    expect(d.tStates).toBe(4);
    expect(d.flags).toEqual([]);
  });
  it('0x76 HLT', () => {
    expect(byOpcode(0x76)).toMatchObject({ mnemonic: 'HLT', tStates: 5 });
  });
  it('0x30 SIM', () => {
    expect(byOpcode(0x30)).toMatchObject({ mnemonic: 'SIM', tStates: 4 });
  });
  it('0x7E MOV A,M', () => {
    expect(byOpcode(0x7e)).toMatchObject({ mnemonic: 'MOV', operands: ['A', 'M'], tStates: 7 });
  });
  it('0xC2 JNZ', () => {
    expect(byOpcode(0xc2)).toMatchObject({ mnemonic: 'JNZ', tStates: [7, 10], machineCycles: [2, 3] });
  });
  it('0xC4 CNZ', () => {
    expect(byOpcode(0xc4)).toMatchObject({ mnemonic: 'CNZ', tStates: [9, 18], machineCycles: [2, 5] });
  });
  it('0xC0 RNZ', () => {
    expect(byOpcode(0xc0)).toMatchObject({ mnemonic: 'RNZ', tStates: [6, 12], machineCycles: [1, 3] });
  });
  it('0xCD CALL', () => {
    expect(byOpcode(0xcd)).toMatchObject({ mnemonic: 'CALL', tStates: 18 });
  });
  it('0x09 DAD B', () => {
    expect(byOpcode(0x09)).toMatchObject({ mnemonic: 'DAD', operands: ['B'], tStates: 10, flags: ['CY'] });
  });
  it('0x27 DAA', () => {
    expect(byOpcode(0x27)!.flags).toEqual(['S', 'Z', 'AC', 'P', 'CY']);
  });
  it('0xE6 ANI', () => {
    expect(byOpcode(0xe6)).toMatchObject({ mnemonic: 'ANI', operands: ['d8'], flags: ['S', 'Z', 'AC', 'P', 'CY'] });
  });
});

describe('ISA: findInstr', () => {
  it('encuentra por mnemónico y operandos normalizados', () => {
    expect(findInstr('MOV', ['A', 'M'])?.opcode).toBe(0x7e);
    expect(findInstr('MVI', ['M', 'd8'])?.opcode).toBe(0x36);
    expect(findInstr('PUSH', ['PSW'])?.opcode).toBe(0xf5);
    expect(findInstr('RST', ['7'])?.opcode).toBe(0xff);
  });
  it('devuelve undefined si no existe', () => {
    expect(findInstr('MOV', ['M', 'M'])).toBeUndefined();
    expect(findInstr('FOO', [])).toBeUndefined();
    expect(findInstr('PUSH', ['SP'])).toBeUndefined();
  });
});

describe('ISA: verificación cruzada con la tabla alfabética (pág. 20)', () => {
  // Pares transcritos tal cual de la pág. 20 (notación del manual: D8, D16, adr).
  const PAGE_20: ReadonlyArray<readonly [string, number]> = [
    ['ACI D8', 0xce], ['ADC M', 0x8e], ['ADD L', 0x85], ['ANA H', 0xa4],
    ['CALL adr', 0xcd], ['CC adr', 0xdc], ['CMP E', 0xbb], ['CNC adr', 0xd4],
    ['CPE adr', 0xec], ['CPO adr', 0xe4], ['CMC', 0x3f], ['DAA', 0x27],
    ['DAD SP', 0x39], ['DCR M', 0x35], ['DCX H', 0x2b], ['IN D8', 0xdb],
    ['INR L', 0x2c], ['INX SP', 0x33], ['JPO adr', 0xe2], ['LDAX D', 0x1a],
    ['LHLD adr', 0x2a], ['LXI SP, D16', 0x31], ['MOV B, M', 0x46], ['MOV E, H', 0x5c],
    ['MOV H, L', 0x65], ['MOV L, A', 0x6f], ['MOV M, E', 0x73], ['MVI A, D8', 0x3e],
    ['MVI M, D8', 0x36], ['OUT D8', 0xd3], ['POP PSW', 0xf1], ['PUSH D', 0xd5],
    ['RPO', 0xe0], ['RST 3', 0xdf], ['SBB M', 0x9e], ['SBI D8', 0xde],
    ['SHLD adr', 0x22], ['SPHL', 0xf9], ['STAX D', 0x12], ['XRA L', 0xad],
    ['XRI D8', 0xee], ['XTHL', 0xe3],
  ];

  /** Convierte la notación del manual a la forma normalizada de findInstr. */
  function parse(text: string): [string, string[]] {
    const [mnemonic, ...rest] = text.split(' ');
    const ops = rest.join('').split(',').filter((s) => s.length > 0).map((o) => {
      if (o === 'adr') return 'addr';
      if (o === 'D16') return 'd16';
      if (o === 'D8') return mnemonic === 'IN' || mnemonic === 'OUT' ? 'port' : 'd8';
      return o;
    });
    return [mnemonic!, ops];
  }

  it.each(PAGE_20)('%s = %i', (text, opcode) => {
    const [mnemonic, ops] = parse(text);
    expect(findInstr(mnemonic, ops)?.opcode).toBe(opcode);
    expect(byOpcode(opcode)?.mnemonic).toBe(mnemonic);
    expect(byOpcode(opcode)?.operands).toEqual(ops);
  });

  it('la muestra tiene al menos 20 pares', () => {
    expect(PAGE_20.length).toBeGreaterThanOrEqual(20);
  });
});
