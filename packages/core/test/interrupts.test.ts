import { describe, it, expect } from 'vitest';
import { initialState, type CpuState } from '../src/cpu/state';
import { execute, acceptInterrupt, type Bus } from '../src/cpu/execute';

function makeBus(): Bus & { mem: Uint8Array } {
  const mem = new Uint8Array(65536);
  return {
    mem,
    read: (a) => mem[a & 0xffff]!,
    write: (a, v) => { mem[a & 0xffff] = v & 0xff; },
    in: () => 0,
    out: () => {},
  };
}

function setup(bytes: number[], pc = 0x2000): { s: CpuState; bus: ReturnType<typeof makeBus> } {
  const s = initialState(pc);
  s.SP = 0x3000;
  const bus = makeBus();
  bytes.forEach((b, i) => { bus.mem[(pc + i) & 0xffff] = b; });
  return { s, bus };
}

const EI = 0xfb, DI = 0xf3, NOP = 0x00, HLT = 0x76, RIM = 0x20, SIM = 0x30;
const MVI_A = 0x3e;

/** Simula el bucle de la Machine: intenta aceptar interrupción y si no, ejecuta. */
function step(s: CpuState, bus: Bus) {
  return acceptInterrupt(s, bus) ?? execute(s, bus);
}

describe('SIM', () => {
  it('A = 0000_1000b (MSE=1, máscaras 0) desenmascara las tres', () => {
    const { s, bus } = setup([MVI_A, 0b0000_1000, SIM]);
    execute(s, bus);
    const r = execute(s, bus);
    expect(s.masks).toEqual({ m55: false, m65: false, m75: false });
    expect(r.tStates).toBe(4);
    expect(s.PC).toBe(0x2003);
  });

  it('enmascara bit a bit con MSE=1 (b0 M5.5, b1 M6.5, b2 M7.5)', () => {
    const { s, bus } = setup([MVI_A, 0b0000_1101, SIM]);
    execute(s, bus); execute(s, bus);
    expect(s.masks).toEqual({ m55: true, m65: false, m75: true });
  });

  it('con MSE=0 las máscaras no cambian', () => {
    const { s, bus } = setup([MVI_A, 0b0000_1000, SIM, MVI_A, 0b0000_0111, SIM]);
    for (let i = 0; i < 4; i++) execute(s, bus);
    expect(s.masks).toEqual({ m55: false, m65: false, m75: false });
  });

  it('A = 0001_0000b (R7.5) borra pending.r75', () => {
    const { s, bus } = setup([MVI_A, 0b0001_0000, SIM]);
    s.pending.r75 = true;
    execute(s, bus); execute(s, bus);
    expect(s.pending.r75).toBe(false);
    expect(s.masks).toEqual({ m55: true, m65: true, m75: true }); // MSE=0
  });

  it('SOD solo se carga si SOE=1', () => {
    const { s, bus } = setup([MVI_A, 0b1000_0000, SIM, MVI_A, 0b1100_0000, SIM, MVI_A, 0b0100_0000, SIM]);
    execute(s, bus); execute(s, bus);
    expect(s.sod).toBe(0);
    execute(s, bus); execute(s, bus);
    expect(s.sod).toBe(1);
    execute(s, bus); execute(s, bus);
    expect(s.sod).toBe(0);
  });
});

describe('RIM', () => {
  it('arma A con SID I7.5 I6.5 I5.5 IE M7.5 M6.5 M5.5', () => {
    const { s, bus } = setup([RIM, RIM]);
    s.sid = 1;
    s.pending.r75 = true; s.pending.r65 = false; s.pending.r55 = true;
    s.ie = true;
    s.masks = { m55: true, m65: false, m75: true };
    let r = execute(s, bus);
    expect(s.A).toBe(0b1101_1101);
    expect(r.tStates).toBe(4);
    s.sid = 0; s.pending = { r75: false, r65: true, r55: false, trap: false };
    s.ie = false; s.masks = { m55: false, m65: true, m75: false };
    r = execute(s, bus);
    expect(s.A).toBe(0b0010_0010);
  });

  it('inmediatamente después de TRAP, el bit IE refleja el IE previo al TRAP (pág. 16)', () => {
    const { s, bus } = setup([RIM, RIM], 0x0024);
    s.PC = 0x2000; s.ie = true; s.pending.trap = true;
    acceptInterrupt(s, bus);
    expect(s.ie).toBe(false);
    execute(s, bus); // RIM en 0024h
    expect(s.A & 0x08).toBe(0x08);
    execute(s, bus); // un segundo RIM ya ve el IE real
    expect(s.A & 0x08).toBe(0);
  });
});

describe('acceptInterrupt', () => {
  it('EI + r65 pendiente desenmascarado → salta a 0034h y ie queda false', () => {
    const { s, bus } = setup([EI, NOP, NOP]);
    s.masks.m65 = false;
    s.pending.r65 = true;
    step(s, bus); // EI
    step(s, bus); // NOP (EI tiene efecto recién después de la próxima instrucción)
    const r = acceptInterrupt(s, bus);
    expect(r).not.toBeNull();
    expect(r!.tStates).toBe(12);
    expect(r!.pc).toBe(0x2002);
    expect(r!.opcode).toBe(-1);
    expect(r!.note).toContain('RST 6.5');
    expect(s.PC).toBe(0x0034);
    expect(s.ie).toBe(false);
    expect(s.pending.r65).toBe(false);
    expect(s.SP).toBe(0x2ffe);
    expect(bus.mem[0x2ffe]).toBe(0x02);
    expect(bus.mem[0x2fff]).toBe(0x20);
  });

  it('demora de EI: `EI; NOP` no se interrumpe antes de completar el NOP', () => {
    const { s, bus } = setup([EI, NOP, NOP]);
    s.masks.m55 = false;
    s.pending.r55 = true;
    expect(acceptInterrupt(s, bus)).toBeNull(); // ie = false
    execute(s, bus); // EI
    expect(s.ie).toBe(true);
    expect(acceptInterrupt(s, bus)).toBeNull(); // todavía no: falta la próxima instrucción
    execute(s, bus); // NOP
    expect(s.PC).toBe(0x2002);
    const r = acceptInterrupt(s, bus);
    expect(r).not.toBeNull();
    expect(s.PC).toBe(0x002c);
  });

  it('con DI no salta', () => {
    const { s, bus } = setup([EI, NOP, DI, NOP]);
    s.masks.m65 = false;
    step(s, bus); step(s, bus); step(s, bus); // EI, NOP, DI
    s.pending.r65 = true;
    expect(acceptInterrupt(s, bus)).toBeNull();
    expect(s.ie).toBe(false);
  });

  it('DI justo después de EI anula el EI pendiente', () => {
    const { s, bus } = setup([EI, DI, NOP]);
    s.masks.m55 = false; s.pending.r55 = true;
    execute(s, bus); execute(s, bus);
    expect(acceptInterrupt(s, bus)).toBeNull();
  });

  it('una interrupción enmascarada no se acepta', () => {
    const { s, bus } = setup([NOP]);
    s.ie = true; s.pending.r55 = true; // m55 = true por defecto
    expect(acceptInterrupt(s, bus)).toBeNull();
    expect(s.pending.r55).toBe(true);
  });

  it('TRAP salta aunque ie sea false', () => {
    const { s, bus } = setup([NOP]);
    s.pending.trap = true;
    const r = acceptInterrupt(s, bus);
    expect(r).not.toBeNull();
    expect(r!.tStates).toBe(12);
    expect(s.PC).toBe(0x0024);
    expect(s.pending.trap).toBe(false);
    expect(s.ie).toBe(false);
  });

  it('prioridad: TRAP > 7.5 > 6.5 > 5.5', () => {
    const { s, bus } = setup([NOP]);
    s.masks = { m55: false, m65: false, m75: false };
    s.pending = { r75: true, r65: true, r55: true, trap: true };
    const order: number[] = [];
    for (let i = 0; i < 4; i++) {
      s.ie = true;
      acceptInterrupt(s, bus);
      order.push(s.PC);
    }
    expect(order).toEqual([0x0024, 0x003c, 0x0034, 0x002c]);
    s.ie = true;
    expect(acceptInterrupt(s, bus)).toBeNull();
  });

  it('6.5 y 5.5 pendientes: se atiende 6.5 y 5.5 queda pendiente', () => {
    const { s, bus } = setup([NOP]);
    s.ie = true; s.masks = { m55: false, m65: false, m75: true };
    s.pending.r65 = true; s.pending.r55 = true;
    acceptInterrupt(s, bus);
    expect(s.PC).toBe(0x0034);
    expect(s.pending.r55).toBe(true);
  });

  it('RST 7.5 enmascarada queda pendiente (latch) y se dispara al desenmascarar + EI', () => {
    // MVI A,08h ; SIM (desenmascara todo) ; EI ; NOP ; NOP
    const { s, bus } = setup([MVI_A, 0b0000_1000, SIM, EI, NOP, NOP]);
    s.ie = true;
    s.pending.r75 = true; // flanco recibido con 7.5 enmascarada
    expect(step(s, bus).opcode).toBe(MVI_A);
    expect(s.pending.r75).toBe(true);
    s.ie = false;
    step(s, bus); // SIM
    expect(s.pending.r75).toBe(true);
    step(s, bus); // EI
    step(s, bus); // NOP
    const r = step(s, bus);
    expect(r.opcode).toBe(-1);
    expect(r.note).toContain('7.5');
    expect(s.PC).toBe(0x003c);
    expect(s.pending.r75).toBe(false);
  });

  it('HLT + interrupción aceptada sale del halt; retorno = dirección siguiente al HLT', () => {
    const { s, bus } = setup([EI, NOP, HLT, NOP]);
    s.masks.m55 = false;
    step(s, bus); step(s, bus); step(s, bus); // EI, NOP, HLT
    expect(s.halted).toBe(true);
    expect(s.PC).toBe(0x2003);
    s.pending.r55 = true;
    const r = acceptInterrupt(s, bus);
    expect(r).not.toBeNull();
    expect(s.halted).toBe(false);
    expect(s.PC).toBe(0x002c);
    expect(bus.mem[0x2ffe]).toBe(0x03);
    expect(bus.mem[0x2fff]).toBe(0x20);
  });

  it('sin pendientes devuelve null y no toca el estado', () => {
    const { s, bus } = setup([NOP]);
    s.ie = true; s.masks = { m55: false, m65: false, m75: false };
    const before = structuredClone(s);
    expect(acceptInterrupt(s, bus)).toBeNull();
    expect(s).toEqual(before);
  });
});

describe('bordes de 16 bits', () => {
  it('PC que ejecuta en FFFFh envuelve a 0000h', () => {
    const { s, bus } = setup([NOP], 0xffff);
    execute(s, bus);
    expect(s.PC).toBe(0x0000);
  });

  it('instrucción de 3 bytes en FFFEh lee el operando de 0000h y envuelve', () => {
    const { s, bus } = setup([0x21, 0x34], 0xfffe); // LXI H,??34h
    bus.mem[0x0000] = 0x12;
    execute(s, bus);
    expect(s.H).toBe(0x12); expect(s.L).toBe(0x34);
    expect(s.PC).toBe(0x0001);
  });

  it('push de interrupción con SP = 0001h envuelve a FFFFh', () => {
    const { s, bus } = setup([NOP], 0x1234);
    s.SP = 0x0001; s.pending.trap = true;
    const r = acceptInterrupt(s, bus);
    expect(s.SP).toBe(0xffff);
    expect(bus.mem[0x0000]).toBe(0x12);
    expect(bus.mem[0xffff]).toBe(0x34);
    expect(r!.memWrite).toBe(0xffff);
  });
});
