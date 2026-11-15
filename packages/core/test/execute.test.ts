import { describe, it, expect } from 'vitest';
import { initialState, packFlags, type CpuState, type Flags } from '../src/cpu/state';
import { execute, type Bus } from '../src/cpu/execute';
import { ISA, INVALID_OPCODES } from '../src/isa/table';

interface TestBus extends Bus {
  mem: Uint8Array;
  ins: number[];
  outs: Array<[number, number]>;
  ports: Uint8Array;
}

function makeBus(): TestBus {
  const mem = new Uint8Array(65536);
  const ports = new Uint8Array(256);
  const ins: number[] = [];
  const outs: Array<[number, number]> = [];
  return {
    mem, ports, ins, outs,
    read: (a) => mem[a & 0xffff]!,
    write: (a, v) => { mem[a & 0xffff] = v & 0xff; },
    in: (p) => { ins.push(p); return ports[p]!; },
    out: (p, v) => { outs.push([p, v]); },
  };
}

/** CPU en `pc` con `bytes` cargados a partir de `pc`. */
function setup(bytes: number[], pc = 0x2000): { s: CpuState; bus: TestBus } {
  const s = initialState(pc);
  const bus = makeBus();
  bytes.forEach((b, i) => { bus.mem[(pc + i) & 0xffff] = b; });
  return { s, bus };
}

const F = (f: Partial<Flags>): Flags => ({ S: 0, Z: 0, AC: 0, P: 0, CY: 0, ...f });

// ---------------------------------------------------------------------------
describe('transferencia de datos', () => {
  it('MOV r,r / MVI / LXI', () => {
    const { s, bus } = setup([0x06, 0x12, 0x48, 0x21, 0x34, 0x12]); // MVI B,12h; MOV C,B; LXI H,1234h
    let r = execute(s, bus);
    expect(s.B).toBe(0x12); expect(r.tStates).toBe(7); expect(s.PC).toBe(0x2002);
    r = execute(s, bus);
    expect(s.C).toBe(0x12); expect(r.tStates).toBe(4);
    r = execute(s, bus);
    expect(s.H).toBe(0x12); expect(s.L).toBe(0x34); expect(r.tStates).toBe(10); expect(s.PC).toBe(0x2006);
  });

  it('LDA / STA reportan memRead / memWrite', () => {
    const { s, bus } = setup([0x3a, 0x40, 0x00, 0x32, 0x41, 0x00]); // LDA 0040h; STA 0041h
    bus.mem[0x40] = 0x5a;
    let r = execute(s, bus);
    expect(s.A).toBe(0x5a); expect(r.memRead).toBe(0x0040); expect(r.memWrite).toBeUndefined();
    expect(r.tStates).toBe(13);
    r = execute(s, bus);
    expect(bus.mem[0x41]).toBe(0x5a); expect(r.memWrite).toBe(0x0041); expect(r.memRead).toBeUndefined();
  });

  it('LHLD / SHLD: byte bajo primero', () => {
    const { s, bus } = setup([0x2a, 0x00, 0x30, 0x22, 0x10, 0x30]); // LHLD 3000h; SHLD 3010h
    bus.mem[0x3000] = 0xcd; bus.mem[0x3001] = 0xab;
    let r = execute(s, bus);
    expect(s.L).toBe(0xcd); expect(s.H).toBe(0xab); expect(r.memRead).toBe(0x3000); expect(r.tStates).toBe(16);
    r = execute(s, bus);
    expect(bus.mem[0x3010]).toBe(0xcd); expect(bus.mem[0x3011]).toBe(0xab); expect(r.memWrite).toBe(0x3010);
  });

  it('LHLD en FFFFh envuelve a 0000h', () => {
    const { s, bus } = setup([0x2a, 0xff, 0xff]);
    bus.mem[0xffff] = 0x11; bus.mem[0x0000] = 0x22;
    execute(s, bus);
    expect(s.L).toBe(0x11); expect(s.H).toBe(0x22);
  });

  it('LDAX / STAX usan BC y DE', () => {
    const { s, bus } = setup([0x0a, 0x12]); // LDAX B; STAX D
    s.B = 0x30; s.C = 0x05; bus.mem[0x3005] = 0x77;
    s.D = 0x40; s.E = 0x06;
    let r = execute(s, bus);
    expect(s.A).toBe(0x77); expect(r.memRead).toBe(0x3005); expect(r.tStates).toBe(7);
    r = execute(s, bus);
    expect(bus.mem[0x4006]).toBe(0x77); expect(r.memWrite).toBe(0x4006);
  });

  it('XCHG', () => {
    const { s, bus } = setup([0xeb]);
    s.H = 0x12; s.L = 0x34; s.D = 0x56; s.E = 0x78;
    execute(s, bus);
    expect([s.H, s.L, s.D, s.E]).toEqual([0x56, 0x78, 0x12, 0x34]);
  });

  it('MOV M,A usa HL; MOV B,M lee de HL; MVI M', () => {
    const { s, bus } = setup([0x77, 0x46, 0x36, 0x99]); // MOV M,A; MOV B,M; MVI M,99h
    s.A = 0x3c; s.H = 0x25; s.L = 0x00;
    let r = execute(s, bus);
    expect(bus.mem[0x2500]).toBe(0x3c); expect(r.memWrite).toBe(0x2500); expect(r.tStates).toBe(7);
    r = execute(s, bus);
    expect(s.B).toBe(0x3c); expect(r.memRead).toBe(0x2500);
    r = execute(s, bus);
    expect(bus.mem[0x2500]).toBe(0x99); expect(r.memWrite).toBe(0x2500); expect(r.tStates).toBe(10);
  });

  it('MOV no toca banderas', () => {
    const { s, bus } = setup([0x78]);
    s.flags = F({ S: 1, CY: 1 }); s.B = 0;
    execute(s, bus);
    expect(s.flags).toEqual(F({ S: 1, CY: 1 }));
  });
});

// ---------------------------------------------------------------------------
describe('aritmético', () => {
  it('ADD B', () => {
    const { s, bus } = setup([0x80]);
    s.A = 0x3a; s.B = 0xc6;
    execute(s, bus);
    expect(s.A).toBe(0x00);
    expect(s.flags).toEqual(F({ Z: 1, AC: 1, P: 1, CY: 1 }));
  });

  it('ADC C con CY = 1', () => {
    const { s, bus } = setup([0x89]);
    s.A = 0x10; s.C = 0x20; s.flags.CY = 1;
    execute(s, bus);
    expect(s.A).toBe(0x31); expect(s.flags.CY).toBe(0);
  });

  it('ADI / ACI / ADD M', () => {
    const { s, bus } = setup([0xc6, 0xff, 0xce, 0x00, 0x86]);
    s.A = 0x01; s.H = 0x30; s.L = 0x00; bus.mem[0x3000] = 0x05;
    execute(s, bus);
    expect(s.A).toBe(0x00); expect(s.flags.CY).toBe(1);
    execute(s, bus); // ACI 0 con CY → 1
    expect(s.A).toBe(0x01); expect(s.flags.CY).toBe(0);
    const r = execute(s, bus);
    expect(s.A).toBe(0x06); expect(r.memRead).toBe(0x3000); expect(r.tStates).toBe(7);
  });

  it('SUB 05h − 07h → FEh, CY = 1', () => {
    const { s, bus } = setup([0x90]);
    s.A = 0x05; s.B = 0x07;
    execute(s, bus);
    expect(s.A).toBe(0xfe); expect(s.flags.CY).toBe(1); expect(s.flags.S).toBe(1); expect(s.flags.Z).toBe(0);
  });

  it('SBB / SUI / SBI', () => {
    const { s, bus } = setup([0x98, 0xd6, 0x01, 0xde, 0x00]);
    s.A = 0x10; s.B = 0x05; s.flags.CY = 1;
    execute(s, bus); // 10 − 05 − 1 = 0A
    expect(s.A).toBe(0x0a); expect(s.flags.CY).toBe(0);
    execute(s, bus); // 0A − 1 = 09
    expect(s.A).toBe(0x09);
    s.flags.CY = 1;
    execute(s, bus); // 09 − 0 − 1 = 08
    expect(s.A).toBe(0x08);
  });

  it('CMP deja A intacto y pone Z / CY', () => {
    const { s, bus } = setup([0xb8, 0xb9, 0xfe, 0x05]); // CMP B; CMP C; CPI 05h
    s.A = 0x05; s.B = 0x05; s.C = 0x07;
    execute(s, bus);
    expect(s.A).toBe(0x05); expect(s.flags.Z).toBe(1); expect(s.flags.CY).toBe(0);
    execute(s, bus);
    expect(s.A).toBe(0x05); expect(s.flags.Z).toBe(0); expect(s.flags.CY).toBe(1);
    execute(s, bus);
    expect(s.A).toBe(0x05); expect(s.flags.Z).toBe(1); expect(s.flags.CY).toBe(0);
  });

  it('INR / DCR no modifican CY; INR M', () => {
    const { s, bus } = setup([0x3c, 0x05, 0x34]); // INR A; DCR B; INR M
    s.A = 0xff; s.B = 0x00; s.flags.CY = 1; s.H = 0x30; s.L = 0x00; bus.mem[0x3000] = 0x0f;
    execute(s, bus);
    expect(s.A).toBe(0x00); expect(s.flags.Z).toBe(1); expect(s.flags.CY).toBe(1); expect(s.flags.AC).toBe(1);
    s.flags.CY = 0;
    execute(s, bus);
    expect(s.B).toBe(0xff); expect(s.flags.S).toBe(1); expect(s.flags.CY).toBe(0);
    const r = execute(s, bus);
    expect(bus.mem[0x3000]).toBe(0x10); expect(r.tStates).toBe(10);
    expect(r.memRead).toBe(0x3000); expect(r.memWrite).toBe(0x3000);
  });

  it('DAD H duplica HL y pone CY si desborda; solo CY', () => {
    const { s, bus } = setup([0x29, 0x29]);
    s.H = 0x40; s.L = 0x01; s.flags = F({ Z: 1 });
    let r = execute(s, bus);
    expect(s.H).toBe(0x80); expect(s.L).toBe(0x02); expect(s.flags).toEqual(F({ Z: 1 })); expect(r.tStates).toBe(10);
    r = execute(s, bus);
    expect(s.H).toBe(0x00); expect(s.L).toBe(0x04); expect(s.flags).toEqual(F({ Z: 1, CY: 1 }));
  });

  it('DAD B / DAD SP', () => {
    const { s, bus } = setup([0x09, 0x39]);
    s.H = 0x12; s.L = 0x34; s.B = 0x01; s.C = 0x01; s.SP = 0x1000;
    execute(s, bus);
    expect((s.H << 8) | s.L).toBe(0x1335);
    execute(s, bus);
    expect((s.H << 8) | s.L).toBe(0x2335); expect(s.flags.CY).toBe(0);
  });

  it('INX de FFFFh → 0000h sin banderas; DCX de 0000h → FFFFh', () => {
    const { s, bus } = setup([0x03, 0x1b, 0x33]); // INX B; DCX D; INX SP
    s.B = 0xff; s.C = 0xff; s.flags = F({});
    const r = execute(s, bus);
    expect(s.B).toBe(0); expect(s.C).toBe(0); expect(s.flags).toEqual(F({})); expect(r.tStates).toBe(6);
    execute(s, bus);
    expect(s.D).toBe(0xff); expect(s.E).toBe(0xff); expect(s.flags).toEqual(F({}));
    s.SP = 0xffff;
    execute(s, bus);
    expect(s.SP).toBe(0x0000);
  });

  it('DAA (ejemplo de la pág. 18: 93h + 08h = 9Bh → 01h, CY 1)', () => {
    const { s, bus } = setup([0x80, 0x27]);
    s.A = 0x93; s.B = 0x08;
    execute(s, bus);
    expect(s.A).toBe(0x9b);
    execute(s, bus);
    expect(s.A).toBe(0x01); expect(s.flags.CY).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('lógico', () => {
  it('ANA: AC = 1, CY = 0', () => {
    const { s, bus } = setup([0xa0]);
    s.A = 0xf0; s.B = 0x3c; s.flags.CY = 1;
    execute(s, bus);
    expect(s.A).toBe(0x30); expect(s.flags).toEqual(F({ AC: 1, P: 1 }));
  });

  it('XRA A → 0, Z 1, CY 0', () => {
    const { s, bus } = setup([0xaf]);
    s.A = 0x5a; s.flags = F({ CY: 1, AC: 1 });
    execute(s, bus);
    expect(s.A).toBe(0); expect(s.flags).toEqual(F({ Z: 1, P: 1 }));
  });

  it('ORA / ANI / ORI / XRI', () => {
    const { s, bus } = setup([0xb1, 0xe6, 0x0f, 0xf6, 0x80, 0xee, 0xff]);
    s.A = 0x01; s.C = 0x02; s.flags.CY = 1; s.flags.AC = 1;
    execute(s, bus);
    expect(s.A).toBe(0x03); expect(s.flags.CY).toBe(0); expect(s.flags.AC).toBe(0);
    execute(s, bus);
    expect(s.A).toBe(0x03); expect(s.flags.AC).toBe(1);
    execute(s, bus);
    expect(s.A).toBe(0x83); expect(s.flags.S).toBe(1); expect(s.flags.AC).toBe(0);
    execute(s, bus);
    expect(s.A).toBe(0x7c);
  });

  it('RLC / RRC', () => {
    const { s, bus } = setup([0x07, 0x0f, 0x0f]);
    s.A = 0x85; s.flags = F({ Z: 1 });
    execute(s, bus);
    expect(s.A).toBe(0x0b); expect(s.flags).toEqual(F({ Z: 1, CY: 1 }));
    execute(s, bus);
    expect(s.A).toBe(0x85); expect(s.flags.CY).toBe(1);
    execute(s, bus);
    expect(s.A).toBe(0xc2); expect(s.flags.CY).toBe(1);
  });

  it('RAL / RAR a través de CY', () => {
    const { s, bus } = setup([0x17, 0x1f, 0x1f]);
    s.A = 0x85; s.flags.CY = 0;
    execute(s, bus);
    expect(s.A).toBe(0x0a); expect(s.flags.CY).toBe(1);
    execute(s, bus);
    expect(s.A).toBe(0x85); expect(s.flags.CY).toBe(0);
    execute(s, bus);
    expect(s.A).toBe(0x42); expect(s.flags.CY).toBe(1);
  });

  it('CMA sin banderas', () => {
    const { s, bus } = setup([0x2f]);
    s.A = 0x51; s.flags = F({ P: 1 });
    execute(s, bus);
    expect(s.A).toBe(0xae); expect(s.flags).toEqual(F({ P: 1 }));
  });

  it('STC / CMC solo CY', () => {
    const { s, bus } = setup([0x37, 0x3f, 0x3f]);
    s.flags = F({ S: 1 });
    execute(s, bus);
    expect(s.flags).toEqual(F({ S: 1, CY: 1 }));
    execute(s, bus);
    expect(s.flags).toEqual(F({ S: 1 }));
    execute(s, bus);
    expect(s.flags).toEqual(F({ S: 1, CY: 1 }));
  });
});

// ---------------------------------------------------------------------------
describe('saltos, llamadas y retornos', () => {
  it('JMP', () => {
    const { s, bus } = setup([0xc3, 0x00, 0x30]);
    const r = execute(s, bus);
    expect(s.PC).toBe(0x3000); expect(r.tStates).toBe(10);
  });

  it('JNZ tomado = 10 T, no tomado = 7 T', () => {
    let { s, bus } = setup([0xc2, 0x00, 0x30]);
    s.flags.Z = 0;
    let r = execute(s, bus);
    expect(s.PC).toBe(0x3000); expect(r.tStates).toBe(10);
    ({ s, bus } = setup([0xc2, 0x00, 0x30]));
    s.flags.Z = 1;
    r = execute(s, bus);
    expect(s.PC).toBe(0x2003); expect(r.tStates).toBe(7);
  });

  it('condiciones de salto: JZ JNC JC JPO JPE JP JM', () => {
    const cases: Array<[number, Partial<Flags>, boolean]> = [
      [0xca, { Z: 1 }, true], [0xca, {}, false],
      [0xd2, {}, true], [0xd2, { CY: 1 }, false],
      [0xda, { CY: 1 }, true], [0xda, {}, false],
      [0xe2, {}, true], [0xe2, { P: 1 }, false],
      [0xea, { P: 1 }, true], [0xea, {}, false],
      [0xf2, {}, true], [0xf2, { S: 1 }, false],
      [0xfa, { S: 1 }, true], [0xfa, {}, false],
    ];
    for (const [op, fl, taken] of cases) {
      const { s, bus } = setup([op, 0x34, 0x12]);
      s.flags = F(fl);
      execute(s, bus);
      expect(s.PC, `op ${op.toString(16)}`).toBe(taken ? 0x1234 : 0x2003);
    }
  });

  it('CALL / RET con pila; memWrite = último byte escrito (SP nuevo), memRead = primer byte leído', () => {
    const { s, bus } = setup([0xcd, 0x00, 0x30]);
    bus.mem[0x3000] = 0xc9; // RET
    s.SP = 0x4000;
    let r = execute(s, bus);
    expect(s.PC).toBe(0x3000); expect(s.SP).toBe(0x3ffe); expect(r.tStates).toBe(18);
    expect(bus.mem[0x3fff]).toBe(0x20); expect(bus.mem[0x3ffe]).toBe(0x03);
    expect(r.memWrite).toBe(0x3ffe);
    r = execute(s, bus);
    expect(s.PC).toBe(0x2003); expect(s.SP).toBe(0x4000); expect(r.tStates).toBe(10);
    expect(r.memRead).toBe(0x3ffe);
  });

  it('CNZ no tomado = 9 T, tomado = 18 T', () => {
    let { s, bus } = setup([0xc4, 0x00, 0x30]);
    s.SP = 0x4000; s.flags.Z = 1;
    let r = execute(s, bus);
    expect(s.PC).toBe(0x2003); expect(s.SP).toBe(0x4000); expect(r.tStates).toBe(9); expect(r.memWrite).toBeUndefined();
    ({ s, bus } = setup([0xc4, 0x00, 0x30]));
    s.SP = 0x4000;
    r = execute(s, bus);
    expect(s.PC).toBe(0x3000); expect(s.SP).toBe(0x3ffe); expect(r.tStates).toBe(18);
  });

  it('RZ no tomado = 6 T, tomado = 12 T', () => {
    let { s, bus } = setup([0xc8]);
    s.SP = 0x3ffe; bus.mem[0x3ffe] = 0x50; bus.mem[0x3fff] = 0x21;
    let r = execute(s, bus);
    expect(s.PC).toBe(0x2001); expect(r.tStates).toBe(6); expect(s.SP).toBe(0x3ffe);
    ({ s, bus } = setup([0xc8]));
    s.SP = 0x3ffe; bus.mem[0x3ffe] = 0x50; bus.mem[0x3fff] = 0x21; s.flags.Z = 1;
    r = execute(s, bus);
    expect(s.PC).toBe(0x2150); expect(r.tStates).toBe(12); expect(s.SP).toBe(0x4000);
  });

  it('PCHL', () => {
    const { s, bus } = setup([0xe9]);
    s.H = 0x12; s.L = 0x34;
    const r = execute(s, bus);
    expect(s.PC).toBe(0x1234); expect(r.tStates).toBe(6);
  });

  it('RST 5 salta a 0028h y guarda el PC de retorno', () => {
    const { s, bus } = setup([0xef]);
    s.SP = 0x4000;
    const r = execute(s, bus);
    expect(s.PC).toBe(0x0028); expect(s.SP).toBe(0x3ffe); expect(r.tStates).toBe(12);
    expect(bus.mem[0x3fff]).toBe(0x20); expect(bus.mem[0x3ffe]).toBe(0x01);
  });

  it('RST 0..7 a 8·n', () => {
    for (let n = 0; n < 8; n++) {
      const { s, bus } = setup([0xc7 | (n << 3)]);
      s.SP = 0x4000;
      execute(s, bus);
      expect(s.PC).toBe(n * 8);
    }
  });

  it('PC envuelve después de FFFFh', () => {
    const { s, bus } = setup([0x00], 0xffff);
    execute(s, bus);
    expect(s.PC).toBe(0x0000);
    const t = setup([0x3e], 0xffff); // MVI A,d8 con el dato en 0000h
    t.bus.mem[0x0000] = 0x42;
    execute(t.s, t.bus);
    expect(t.s.A).toBe(0x42); expect(t.s.PC).toBe(0x0001);
  });
});

// ---------------------------------------------------------------------------
describe('pila', () => {
  it('PUSH PSW escribe packFlags; POP PSW restaura (bits 1/3/5 ignorados)', () => {
    const { s, bus } = setup([0xf5, 0xf1]);
    s.SP = 0x4000; s.A = 0x9c; s.flags = F({ S: 1, P: 1, CY: 1 });
    let r = execute(s, bus);
    expect(bus.mem[0x3fff]).toBe(0x9c);
    expect(bus.mem[0x3ffe]).toBe(packFlags(F({ S: 1, P: 1, CY: 1 })));
    expect(r.memWrite).toBe(0x3ffe); expect(r.tStates).toBe(12);
    bus.mem[0x3ffe] = 0xff; bus.mem[0x3fff] = 0x11; s.A = 0; s.flags = F({});
    r = execute(s, bus);
    expect(s.A).toBe(0x11); expect(s.flags).toEqual(F({ S: 1, Z: 1, AC: 1, P: 1, CY: 1 }));
    expect(s.SP).toBe(0x4000); expect(r.memRead).toBe(0x3ffe); expect(r.tStates).toBe(10);
  });

  it('PUSH B con SP = 0000h escribe en FFFFh / FFFEh', () => {
    const { s, bus } = setup([0xc5]);
    s.SP = 0x0000; s.B = 0xab; s.C = 0xcd;
    const r = execute(s, bus);
    expect(bus.mem[0xffff]).toBe(0xab); expect(bus.mem[0xfffe]).toBe(0xcd);
    expect(s.SP).toBe(0xfffe); expect(r.memWrite).toBe(0xfffe); expect(r.tStates).toBe(13);
  });

  it('POP con SP = FFFFh lee FFFFh y 0000h', () => {
    const { s, bus } = setup([0xd1]);
    s.SP = 0xffff; bus.mem[0xffff] = 0x34; bus.mem[0x0000] = 0x12;
    execute(s, bus);
    expect(s.D).toBe(0x12); expect(s.E).toBe(0x34); expect(s.SP).toBe(0x0001);
  });

  it('PUSH D / H y POP B / H', () => {
    const { s, bus } = setup([0xd5, 0xe5, 0xc1, 0xe1]);
    s.SP = 0x4000; s.D = 0x11; s.E = 0x22; s.H = 0x33; s.L = 0x44;
    execute(s, bus); execute(s, bus);
    s.H = 0; s.L = 0;
    execute(s, bus); // POP B ← HL guardado
    expect(s.B).toBe(0x33); expect(s.C).toBe(0x44);
    execute(s, bus); // POP H ← DE guardado
    expect(s.H).toBe(0x11); expect(s.L).toBe(0x22); expect(s.SP).toBe(0x4000);
  });

  it('XTHL', () => {
    const { s, bus } = setup([0xe3]);
    s.SP = 0x3ffe; bus.mem[0x3ffe] = 0xf0; bus.mem[0x3fff] = 0x0d; s.H = 0x0b; s.L = 0x3c;
    const r = execute(s, bus);
    expect(s.H).toBe(0x0d); expect(s.L).toBe(0xf0);
    expect(bus.mem[0x3ffe]).toBe(0x3c); expect(bus.mem[0x3fff]).toBe(0x0b);
    expect(s.SP).toBe(0x3ffe); expect(r.tStates).toBe(16);
    expect(r.memRead).toBe(0x3ffe); expect(r.memWrite).toBe(0x3ffe);
  });

  it('SPHL / LXI SP', () => {
    const { s, bus } = setup([0xf9, 0x31, 0x00, 0x50]);
    s.H = 0x50; s.L = 0x6c;
    const r = execute(s, bus);
    expect(s.SP).toBe(0x506c); expect(r.tStates).toBe(6);
    execute(s, bus);
    expect(s.SP).toBe(0x5000);
  });
});

// ---------------------------------------------------------------------------
describe('E/S y control', () => {
  it('IN 05H llama bus.in(5)', () => {
    const { s, bus } = setup([0xdb, 0x05]);
    bus.ports[5] = 0x7e;
    const r = execute(s, bus);
    expect(bus.ins).toEqual([5]); expect(s.A).toBe(0x7e); expect(r.tStates).toBe(10); expect(s.PC).toBe(0x2002);
  });

  it('OUT 01H llama bus.out(1, A)', () => {
    const { s, bus } = setup([0xd3, 0x01]);
    s.A = 0x3a;
    execute(s, bus);
    expect(bus.outs).toEqual([[1, 0x3a]]);
  });

  it('EI / DI', () => {
    const { s, bus } = setup([0xfb, 0xf3]);
    execute(s, bus);
    expect(s.ie).toBe(true);
    execute(s, bus);
    expect(s.ie).toBe(false);
  });

  it('NOP', () => {
    const { s, bus } = setup([0x00]);
    const before = structuredClone(s);
    const r = execute(s, bus);
    expect(s).toEqual({ ...before, PC: 0x2001 }); expect(r.tStates).toBe(4);
  });

  it('HLT → halted = true y PC pasa el HLT', () => {
    const { s, bus } = setup([0x76]);
    const r = execute(s, bus);
    expect(s.halted).toBe(true); expect(s.PC).toBe(0x2001); expect(r.tStates).toBe(5);
    expect(r.instr?.mnemonic).toBe('HLT');
  });

  it('opcode 08h → error en español, PC sin avanzar', () => {
    const { s, bus } = setup([0x00, 0x00, 0x00, 0x00, 0x00, 0x08]);
    s.PC = 0x2005;
    const r = execute(s, bus);
    expect(r.error).toBe('Opcode inválido 08h en 2005h');
    expect(s.PC).toBe(0x2005); expect(r.tStates).toBe(0); expect(r.instr).toBeUndefined();
    expect(r.pc).toBe(0x2005); expect(r.opcode).toBe(0x08);
  });

  it('los 10 opcodes inválidos dan error', () => {
    for (const op of INVALID_OPCODES) {
      const { s, bus } = setup([op]);
      const r = execute(s, bus);
      expect(r.error).toBe(`Opcode inválido ${op.toString(16).toUpperCase().padStart(2, '0')}h en 2000h`);
      expect(s.PC).toBe(0x2000);
    }
  });

  it('StepInfo trae pc, opcode e instr', () => {
    const { s, bus } = setup([0x3e, 0x01]);
    const r = execute(s, bus);
    expect(r.pc).toBe(0x2000); expect(r.opcode).toBe(0x3e); expect(r.instr?.mnemonic).toBe('MVI');
  });
});

// ---------------------------------------------------------------------------
describe('las 246 instrucciones', () => {
  const BRANCH = new Set(['JMP', 'JNZ', 'JZ', 'JNC', 'JC', 'JPO', 'JPE', 'JP', 'JM',
    'CALL', 'CNZ', 'CZ', 'CNC', 'CC', 'CPO', 'CPE', 'CP', 'CM',
    'RET', 'RNZ', 'RZ', 'RNC', 'RC', 'RPO', 'RPE', 'RP', 'RM', 'RST', 'PCHL']);

  it('la tabla tiene 246 entradas', () => {
    expect(ISA.length).toBe(246);
  });

  for (const flagsSet of [false, true]) {
    it(`cada opcode ejecuta con PC += tamaño y T-estados de la ISA (banderas ${flagsSet ? '1' : '0'})`, () => {
      for (const d of ISA) {
        const { s, bus } = setup([d.opcode, 0x00, 0x30]);
        s.SP = 0x4000; s.H = 0x50; s.L = 0x00;
        bus.mem[0x4000] = 0x00; bus.mem[0x4001] = 0x60; // retorno a 6000h
        if (flagsSet) s.flags = F({ S: 1, Z: 1, AC: 1, P: 1, CY: 1 });
        const r = execute(s, bus);
        const tag = `${d.mnemonic} ${d.operands.join(',')} (${d.opcode.toString(16)})`;
        expect(r.error, tag).toBeUndefined();
        expect(r.instr, tag).toBe(d);
        expect(r.opcode, tag).toBe(d.opcode);
        if (Array.isArray(d.tStates)) {
          // Condicional: decidir si se tomó según el PC resultante.
          const fallthrough = (0x2000 + d.size) & 0xffff;
          const taken = s.PC !== fallthrough;
          expect(r.tStates, tag).toBe(taken ? d.tStates[1] : d.tStates[0]);
        } else {
          expect(r.tStates, tag).toBe(d.tStates);
        }
        if (!BRANCH.has(d.mnemonic)) {
          expect(s.PC, tag).toBe(0x2000 + d.size);
        }
      }
    });
  }

  it('cada condicional se toma con una combinación de banderas y no con la otra', () => {
    for (const d of ISA.filter((x) => Array.isArray(x.tStates))) {
      const results = [false, true].map((on) => {
        const { s, bus } = setup([d.opcode, 0x00, 0x30]);
        s.SP = 0x4000; bus.mem[0x4000] = 0x00; bus.mem[0x4001] = 0x60;
        s.flags = on ? F({ S: 1, Z: 1, AC: 1, P: 1, CY: 1 }) : F({});
        execute(s, bus);
        return s.PC !== 0x2000 + d.size;
      });
      expect(results[0] !== results[1], d.mnemonic).toBe(true);
    }
  });
});
