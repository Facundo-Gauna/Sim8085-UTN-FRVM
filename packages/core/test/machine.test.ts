import { describe, it, expect } from 'vitest';
import { assemble } from '../src/asm/assembler';
import { Machine } from '../src/machine/machine';

function load(src: string, start?: number): Machine {
  const r = assemble(src, start === undefined ? {} : { start });
  expect(r.messages.filter((m) => m.severity === 'error')).toEqual([]);
  return new Machine(r);
}

const GTP05_1 = [
  'LDA 0040H ; A ← M[0040h]',
  'CMA',
  'STA 0041H',
  'HLT',
].join('\n');

describe('Machine: ejecución básica (GTP05 ej. 1)', () => {
  it('run() hasta HLT', () => {
    const m = load(GTP05_1, 0x2000);
    m.setMemory(0x40, 0x3a);
    const r = m.run();
    expect(r.reason).toBe('halt');
    expect(r.steps).toBe(4);
    expect(m.memory[0x41]).toBe(0xc5);
    expect(m.stepCount).toBe(4);
    expect(m.tStates).toBe(35);
  });

  it('step() devuelve "step" y luego "halt" al ejecutar HLT; detenido no avanza', () => {
    const m = load(GTP05_1, 0x2000);
    expect(m.step().reason).toBe('step');
    expect(m.cpu.PC).toBe(0x2003);
    m.step(); m.step();
    expect(m.step().reason).toBe('halt');
    const pc = m.cpu.PC;
    const r = m.step();
    expect(r).toMatchObject({ reason: 'halt', steps: 0 });
    expect(m.cpu.PC).toBe(pc);
    expect(m.stepCount).toBe(4);
    expect(m.run()).toMatchObject({ reason: 'halt', steps: 0 });
  });
});

describe('Machine: paso atrás', () => {
  it('back() desde HLT y hasta el inicio', () => {
    const m = load(GTP05_1, 0x2000);
    m.setMemory(0x40, 0x3a);
    m.run();
    expect(m.canBack).toBe(true);
    expect(m.back()).toBe(true);
    expect(m.cpu.PC).toBe(0x2007);
    expect(m.cpu.halted).toBe(false);
    expect(m.stepCount).toBe(3);
    expect(m.tStates).toBe(30);
    while (m.back()) { /* hasta el inicio */ }
    expect(m.canBack).toBe(false);
    expect(m.back()).toBe(false);
    expect(m.memory[0x41]).toBe(0);
    expect(m.memory[0x40]).toBe(0x3a); // dato del alumno: no es parte del historial
    expect(m.cpu.A).toBe(0);
    expect(m.cpu.PC).toBe(0x2000);
    expect(m.stepCount).toBe(0);
    expect(m.tStates).toBe(0);
  });

  it('back() con OUT: outputs vuelve a su largo', () => {
    const m = load('MVI A, 3AH\nOUT 01H\nHLT');
    m.run();
    expect(m.outputs).toEqual([{ port: 1, value: 0x3a, step: 2 }]);
    m.back(); // HLT
    expect(m.outputs).toHaveLength(1);
    m.back(); // OUT
    expect(m.outputs).toHaveLength(0);
  });

  it('back() con PUSH restaura memoria y SP', () => {
    const m = load('LXI SP, 3000H\nMVI B, 12H\nMVI C, 34H\nPUSH B\nHLT');
    m.run();
    expect(m.memory[0x2fff]).toBe(0x12);
    expect(m.memory[0x2ffe]).toBe(0x34);
    expect(m.cpu.SP).toBe(0x2ffe);
    m.back(); m.back();
    expect(m.memory[0x2fff]).toBe(0);
    expect(m.memory[0x2ffe]).toBe(0);
    expect(m.cpu.SP).toBe(0x3000);
    while (m.back());
    expect(m.cpu.SP).toBe(0);
    expect(m.cpu.B).toBe(0);
  });

  it('back() con CALL y POP PSW restaura banderas sin compartir referencias', () => {
    const m = load([
      'LXI SP, 3000H',
      'LXI B, 00FFH', // C = FFh → banderas S Z AC P CY por POP PSW
      'PUSH B',
      'POP PSW',
      'CALL SUB',
      'HLT',
      'SUB: RET',
    ].join('\n'));
    m.step(); m.step(); m.step();
    const flagsBefore = { ...m.cpu.flags };
    m.step(); // POP PSW reemplaza cpu.flags
    expect(m.cpu.flags).toEqual({ S: 1, Z: 1, AC: 1, P: 1, CY: 1 });
    m.step(); // CALL escribe en la pila
    expect(m.memory[0x2fff]).toBe(0x00);
    expect(m.memory[0x2ffe]).toBe(0x0b); // retorno = 000Bh (CALL en 0008h)
    m.back();
    expect(m.memory[0x2ffe]).toBe(0xff); // vuelve al valor que dejó PUSH B (C)
    m.back();
    expect(m.cpu.flags).toEqual(flagsBefore);
  });

  it('back() restaura interrupciones pendientes', () => {
    const m = load('LXI SP, 3000H\nMVI A, 08H\nSIM\nEI\nNOP\nNOP\nHLT');
    for (let i = 0; i < 5; i++) m.step(); // hasta pasar el NOP posterior al EI
    m.raise('RST6.5');
    expect(m.cpu.pending.r65).toBe(true);
    const r = m.step();
    expect(r.info?.note).toContain('RST 6.5');
    expect(m.cpu.PC).toBe(0x0034);
    expect(m.cpu.pending.r65).toBe(false);
    expect(m.memory[0x2ffe]).toBe(0x08);
    m.back();
    expect(m.cpu.pending.r65).toBe(true);
    expect(m.cpu.ie).toBe(true);
    expect(m.cpu.PC).toBe(0x0008);
    expect(m.memory[0x2ffe]).toBe(0);
  });

  it('historial limitado a 10 000 pasos', () => {
    const m = load('LAZO: JMP LAZO');
    m.run(10_005);
    let n = 0;
    while (m.back()) n++;
    expect(n).toBe(10_000);
    expect(m.stepCount).toBe(5);
  });
});

describe('Machine: lastChanges', () => {
  it('tras LDA', () => {
    const m = load(GTP05_1, 0x2000);
    m.setMemory(0x40, 0x3a);
    m.step();
    expect(m.lastChanges()).toEqual([
      { kind: 'reg', name: 'A', before: 0, after: 0x3a },
      { kind: 'reg', name: 'PC', before: 0x2000, after: 0x2003 },
    ]);
  });

  it('banderas y memoria; PC siempre aparece', () => {
    const m = load('MVI A, 0FFH\nINR A\nSTA 0050H\nNOP');
    m.step(); m.step();
    expect(m.lastChanges()).toEqual([
      { kind: 'reg', name: 'A', before: 0xff, after: 0 },
      { kind: 'reg', name: 'PC', before: 2, after: 3 },
      { kind: 'flag', name: 'Z', before: 0, after: 1 },
      { kind: 'flag', name: 'AC', before: 0, after: 1 },
      { kind: 'flag', name: 'P', before: 0, after: 1 },
    ]);
    m.step(); // STA 0050H con A = 0: memoria no cambia de valor
    expect(m.lastChanges()).toEqual([{ kind: 'reg', name: 'PC', before: 3, after: 6 }]);
    m.back(); m.back(); m.back();
    expect(m.lastChanges()).toEqual([]);
  });

  it('escritura en memoria', () => {
    const m = load('MVI A, 7\nSTA 0050H');
    m.step(); m.step();
    expect(m.lastChanges()).toEqual([
      { kind: 'reg', name: 'PC', before: 2, after: 5 },
      { kind: 'mem', addr: 0x50, before: 0, after: 7 },
    ]);
    m.back();
    expect(m.lastChanges()).toEqual([
      { kind: 'reg', name: 'A', before: 0, after: 7 },
      { kind: 'reg', name: 'PC', before: 0, after: 2 },
    ]);
  });
});

describe('Machine: límite de pausa', () => {
  it('bucle infinito → pause-limit y un segundo run() sigue', () => {
    const m = load('LAZO: JMP LAZO');
    const r1 = m.run();
    expect(r1).toMatchObject({ reason: 'pause-limit', steps: 100_000 });
    expect(m.stepCount).toBe(100_000);
    const r2 = m.run();
    expect(r2.reason).toBe('pause-limit');
    expect(m.stepCount).toBe(200_000);
  });

  it('límite explícito', () => {
    const m = load('LAZO: JMP LAZO');
    expect(m.run(7)).toMatchObject({ reason: 'pause-limit', steps: 7 });
    expect(m.stepCount).toBe(7);
  });
});

describe('Machine: puntos de corte', () => {
  it('se detiene antes de ejecutar la línea y continuar la pasa', () => {
    const m = load(GTP05_1, 0x2000);
    m.setMemory(0x40, 0x3a);
    expect(m.setBreakpoint(3)).toEqual({ ok: true });
    const r = m.run();
    expect(r).toMatchObject({ reason: 'breakpoint', steps: 2 });
    expect(m.cpu.PC).toBe(0x2004);
    expect(m.memory[0x41]).toBe(0);
    const r2 = m.run();
    expect(r2).toMatchObject({ reason: 'halt', steps: 2 });
    expect(m.memory[0x41]).toBe(0xc5);
  });

  it('clearBreakpoint', () => {
    const m = load(GTP05_1, 0x2000);
    m.setBreakpoint(3);
    m.clearBreakpoint(3);
    expect(m.run().reason).toBe('halt');
  });

  it('el punto de corte se reevalúa en un bucle', () => {
    const m = load('MVI B, 3\nLAZO: DCR B\nJNZ LAZO\nHLT');
    m.setBreakpoint(2);
    expect(m.run()).toMatchObject({ reason: 'breakpoint', steps: 1 });
    expect(m.run()).toMatchObject({ reason: 'breakpoint', steps: 2 });
    expect(m.cpu.B).toBe(2);
  });

  it('líneas sin instrucciones → error', () => {
    const m = load([
      'X EQU 5',       // 1
      'ORG 2000H',     // 2
      'DATOS DS 2',    // 3
      'SOLO:',         // 4
      '; comentario',  // 5
      'MVI A, X',      // 6
    ].join('\n'));
    for (const line of [1, 2, 3, 4, 5, 99]) {
      expect(m.setBreakpoint(line)).toEqual({ ok: false, error: 'Esa línea no genera instrucciones' });
    }
    expect(m.setBreakpoint(6)).toEqual({ ok: true });
  });

  it('en la línea de llamada a macro → primera instrucción expandida', () => {
    const m = load([
      'SUMA2 MACRO X', // 1
      ' ADI X',        // 2
      ' ADI X',        // 3
      ' ENDM',         // 4
      'MVI A, 0',      // 5
      'SUMA2 01H',     // 6
      'HLT',           // 7
    ].join('\n'));
    expect(m.setBreakpoint(6)).toEqual({ ok: true });
    expect(m.run()).toMatchObject({ reason: 'breakpoint', steps: 1 });
    expect(m.cpu.PC).toBe(2);
    expect(m.run()).toMatchObject({ reason: 'halt' });
    expect(m.cpu.A).toBe(2);
  });

  it('la línea actual se obtiene con addressToLine', () => {
    const r = assemble(GTP05_1, { start: 0x2000 });
    const m = new Machine(r);
    m.step(); m.step();
    expect(r.addressToLine.get(m.cpu.PC)).toBe(3);
  });
});

describe('Machine: reset y memoria del alumno', () => {
  it('reset() conserva setMemory y programa, PC = start', () => {
    const m = load(GTP05_1, 0x2000);
    m.setMemory(0x40, 0x3a);
    m.run();
    m.reset();
    expect(m.cpu.PC).toBe(0x2000);
    expect(m.cpu.A).toBe(0);
    expect(m.cpu.SP).toBe(0);
    expect(m.cpu.flags).toEqual({ S: 0, Z: 0, AC: 0, P: 0, CY: 0 });
    expect(m.cpu.halted).toBe(false);
    expect(m.cpu.masks).toEqual({ m55: true, m65: true, m75: true });
    expect(m.memory[0x40]).toBe(0x3a);
    expect(m.memory[0x41]).toBe(0);
    expect(m.memory[0x2000]).toBe(0x3a); // LDA
    expect(m.stepCount).toBe(0);
    expect(m.tStates).toBe(0);
    expect(m.canBack).toBe(false);
    expect(m.lastChanges()).toEqual([]);
    expect(m.run().reason).toBe('halt');
    expect(m.memory[0x41]).toBe(0xc5);
  });

  it('reset() limpia outputs y pendientes, conserva inputs y puntos de corte', () => {
    const m = load('IN 05H\nOUT 01H\nHLT');
    m.inputs.set(5, 0x77);
    m.setBreakpoint(3);
    expect(m.run().reason).toBe('breakpoint');
    expect(m.outputs).toEqual([{ port: 1, value: 0x77, step: 2 }]);
    m.raise('TRAP');
    m.reset();
    expect(m.outputs).toEqual([]);
    expect(m.cpu.pending.trap).toBe(false);
    expect(m.inputs.get(5)).toBe(0x77);
    expect(m.run().reason).toBe('breakpoint');
    expect(m.cpu.A).toBe(0x77);
  });

  it('setMemory sobre bytes de código gana al reiniciar', () => {
    const m = load(GTP05_1, 0x2000);
    m.setMemory(0x2003, 0x00); // CMA → NOP
    expect(m.memory[0x2003]).toBe(0);
    m.reset();
    expect(m.memory[0x2003]).toBe(0);
    m.setMemory(0x40, 0x3a);
    m.run();
    expect(m.memory[0x41]).toBe(0x3a);
  });

  it('setMemory borra el historial de paso atrás', () => {
    const m = load('MVI A, 7\nSTA 0050H');
    m.step(); m.step();
    expect(m.memory[0x50]).toBe(7);
    m.setMemory(0x50, 9);
    expect(m.canBack).toBe(false);
    expect(m.back()).toBe(false);
    expect(m.memory[0x50]).toBe(9);
    expect(m.lastChanges()).toEqual([]);
  });
});

describe('Machine: E/S', () => {
  it('IN lee inputs (0 si no se cargó); OUT agrega a outputs', () => {
    const m = load('IN 05H\nMOV B, A\nIN 06H\nOUT 02H\nMOV A, B\nOUT 03H\nHLT');
    m.inputs.set(5, 0x77);
    m.run();
    expect(m.cpu.B).toBe(0x77);
    expect(m.outputs).toEqual([
      { port: 2, value: 0, step: 4 },
      { port: 3, value: 0x77, step: 6 },
    ]);
  });
});

describe('Machine: interrupciones', () => {
  const PROG = [
    'LXI SP, 3000H', // 0000
    'MVI A, 08H',    // 0003  MSE=1, máscaras abiertas
    'SIM',           // 0005
    'EI',            // 0006
    'HLT',           // 0007
    'MVI C, 1',      // 0008  retorno tras el HLT
    'HLT',           // 000A
    'ORG 0034H',
    'MVI B, 55H',    // 0034
    'EI',
    'RET',
  ].join('\n');

  it('EI; HLT; raise(RST6.5) → corre el manejador y retorna después del HLT', () => {
    const m = load(PROG);
    expect(m.run().reason).toBe('halt');
    expect(m.cpu.PC).toBe(0x0008);
    expect(m.step()).toMatchObject({ reason: 'halt', steps: 0 });
    m.raise('RST6.5');
    const r = m.step();
    expect(r.reason).toBe('step');
    expect(r.info?.note).toContain('RST 6.5');
    expect(m.cpu.PC).toBe(0x0034);
    expect(m.cpu.halted).toBe(false);
    expect(m.memory[0x2ffe]).toBe(0x08);
    expect(m.memory[0x2fff]).toBe(0x00);
    expect(m.run().reason).toBe('halt');
    expect(m.cpu.B).toBe(0x55);
    expect(m.cpu.C).toBe(1);
    expect(m.cpu.PC).toBe(0x000b);
  });

  it('run() desde HLT acepta la interrupción; cuenta como paso y T-estados', () => {
    const m = load(PROG);
    m.run();
    const n = m.stepCount, t = m.tStates;
    m.raise('RST6.5');
    const r = m.run();
    expect(r.reason).toBe('halt');
    expect(r.steps).toBe(1 + 3 + 2); // aceptación + MVI, EI, RET + MVI C, HLT
    expect(m.stepCount).toBe(n + 6);
    expect(m.tStates).toBe(t + 12 + 7 + 4 + 10 + 7 + 5);
  });

  it('interrupción enmascarada mientras HLT → sigue en halt', () => {
    const m = load('EI\nHLT');
    m.run();
    m.raise('RST5.5');
    expect(m.run()).toMatchObject({ reason: 'halt', steps: 0 });
    expect(m.cpu.pending.r55).toBe(true);
  });

  it('raise marca el pendiente correcto', () => {
    const m = load('NOP');
    m.raise('TRAP'); m.raise('RST7.5'); m.raise('RST6.5'); m.raise('RST5.5');
    expect(m.cpu.pending).toEqual({ trap: true, r75: true, r65: true, r55: true });
  });

  it('TRAP se acepta antes de cada instrucción', () => {
    const m = load('LXI SP, 3000H\nNOP\nHLT');
    m.step();
    m.raise('TRAP');
    const r = m.step();
    expect(r.info?.note).toContain('TRAP');
    expect(m.cpu.PC).toBe(0x0024);
    expect(m.lastChanges()).toEqual([
      { kind: 'reg', name: 'SP', before: 0x3000, after: 0x2ffe },
      { kind: 'reg', name: 'PC', before: 3, after: 0x24 },
      { kind: 'mem', addr: 0x2ffe, before: 0, after: 3 },
    ]);
  });
});

describe('Machine: errores', () => {
  it('opcode inválido alcanzado por salto', () => {
    const m = load('JMP 2010H', 0x2000);
    m.setMemory(0x2010, 0x08);
    const r = m.run();
    expect(r.reason).toBe('error');
    expect(r.steps).toBe(1);
    expect(r.info?.error).toBe('Opcode inválido 08h en 2010h');
    expect(m.cpu.PC).toBe(0x2010);
    expect(m.stepCount).toBe(1);
    const r2 = m.step();
    expect(r2.reason).toBe('error');
    expect(m.cpu.PC).toBe(0x2010);
    expect(m.stepCount).toBe(1);
    expect(m.back()).toBe(true);
    expect(m.cpu.PC).toBe(0x2000);
  });
});

describe('Machine: punto de entrada', () => {
  it('datos DB en una dirección más baja que el código', () => {
    const m = load('ORG 2000H\nLDA 2050H\nHLT\nORG 0040H\nDB 3AH');
    expect(m.cpu.PC).toBe(0x2000);
    expect(m.run().reason).toBe('halt');
    expect(m.cpu.A).toBe(0);
    m.reset();
    expect(m.cpu.PC).toBe(0x2000);
  });

  it('manejador en 0034h antes del programa principal en 2000h', () => {
    const m = load([
      'ORG 0034H',
      'MVI B, 55H',
      'EI',
      'RET',
      'ORG 2000H',
      'LXI SP, 3000H',
      'MVI C, 1',
      'HLT',
    ].join('\n'));
    expect(m.cpu.PC).toBe(0x0034); // el código empieza en el manejador (primera instrucción del fuente)
  });

  it('principal en 3000h y subrutina en 2000h', () => {
    const m = load([
      'ORG 3000H',
      'LXI SP, 4000H',
      'CALL SUB',
      'HLT',
      'ORG 2000H',
      'SUB: MVI A, 5',
      'RET',
    ].join('\n'));
    expect(m.cpu.PC).toBe(0x3000);
    expect(m.run().reason).toBe('halt');
    expect(m.cpu.A).toBe(5);
    expect(m.cpu.PC).toBe(0x3007);
    m.reset();
    expect(m.cpu.PC).toBe(0x3000);
  });
});

describe('Machine: identidad de objetos y snapshots', () => {
  it('flags, masks y pending conservan su identidad tras step/back/reset y POP PSW', () => {
    const m = load('LXI SP, 3000H\nLXI B, 00FFH\nPUSH B\nPOP PSW\nSTC\nMVI A, 08H\nSIM\nHLT');
    const { flags, masks, pending } = m.cpu;
    m.run();
    expect(m.cpu.flags).toBe(flags);
    expect(flags).toEqual({ S: 1, Z: 1, AC: 1, P: 1, CY: 1 });
    expect(masks).toEqual({ m55: false, m65: false, m75: false });
    while (m.back());
    expect(m.cpu.flags).toBe(flags);
    expect(m.cpu.masks).toBe(masks);
    expect(m.cpu.pending).toBe(pending);
    expect(flags).toEqual({ S: 0, Z: 0, AC: 0, P: 0, CY: 0 });
    expect(masks).toEqual({ m55: true, m65: true, m75: true });
    m.raise('TRAP');
    m.reset();
    expect(m.cpu.flags).toBe(flags);
    expect(m.cpu.pending).toBe(pending);
    expect(pending.trap).toBe(false);
  });

  it('el snapshot no comparte objetos con el CPU vivo', () => {
    const m = load('STC\nNOP');
    m.step();
    expect(m.cpu.flags.CY).toBe(1);
    expect(m.lastChanges()).toContainEqual({ kind: 'flag', name: 'CY', before: 0, after: 1 });
    m.cpu.flags.CY = 0; // mutar el vivo no debe tocar el snapshot
    m.cpu.pending.r55 = true;
    m.back();
    expect(m.cpu.flags.CY).toBe(0);
    expect(m.cpu.pending.r55).toBe(false);
  });
});

describe('Machine: casos límite', () => {
  it('punto de corte en una línea DB → error', () => {
    const m = load('NOP\nDB 3AH\nHLT');
    expect(m.setBreakpoint(2)).toEqual({ ok: false, error: 'Esa línea no genera instrucciones' });
    expect(m.setBreakpoint(3)).toEqual({ ok: true });
  });

  it('run(limit <= 0) → pause-limit sin ejecutar', () => {
    const m = load('NOP\nHLT');
    expect(m.run(0)).toEqual({ reason: 'pause-limit', steps: 0 });
    expect(m.run(-5)).toEqual({ reason: 'pause-limit', steps: 0 });
    expect(m.stepCount).toBe(0);
    expect(m.cpu.PC).toBe(0);
  });
});

describe('Machine: datos del alumno (I4)', () => {
  const PROG = 'ORG 2000H\nLDA 0040H\nHLT';

  it('userData expone una copia de los datos cargados', () => {
    const m = load(PROG);
    m.setMemory(0x40, 0x3a);
    m.setMemory(0x41, 0x1ff);
    expect([...m.userData]).toEqual([[0x40, 0x3a], [0x41, 0xff]]);
    (m.userData as Map<number, number>).clear();
    expect(m.userData.size).toBe(2);
  });

  it('setMemory(addr, null) quita un dato: vuelve la imagen del programa o 0; borra historial', () => {
    const m = load(PROG);
    m.setMemory(0x40, 0x3a);
    m.setMemory(0x2000, 0x00);
    m.step();
    expect(m.canBack).toBe(true);
    m.setMemory(0x2000, null);
    expect(m.memory[0x2000]).toBe(0x3a);
    expect(m.canBack).toBe(false);
    m.setMemory(0x40, null);
    expect(m.memory[0x40]).toBe(0);
    expect(m.userData.size).toBe(0);
    m.reset();
    expect(m.memory[0x40]).toBe(0);
  });

  it('clearUserData() borra todo, restaura memoria y borra historial', () => {
    const m = load(PROG);
    m.setMemory(0x40, 0x3a);
    m.setMemory(0x2003, 0x00);
    m.step();
    m.clearUserData();
    expect(m.userData.size).toBe(0);
    expect(m.memory[0x40]).toBe(0);
    expect(m.memory[0x2003]).toBe(0x76);
    expect(m.canBack).toBe(false);
    m.reset();
    expect(m.memory[0x40]).toBe(0);
  });
});

describe('Machine: programa con errores (M1)', () => {
  it('lanza un error en español si program.ok es false', () => {
    const r = assemble('MVI A');
    expect(r.ok).toBe(false);
    expect(() => new Machine(r)).toThrow(
      'El programa tiene errores de ensamblado: no se puede ejecutar. Corregí los errores primero.',
    );
  });
});

describe('lastStep', () => {
  it('es null antes del primer paso y apunta a la instrucción recién ejecutada', () => {
    const m = new Machine(assemble('LDA 0040H\nCMA\nHLT', { start: 0x2000 }));
    m.setMemory(0x40, 0x3a);
    expect(m.lastStep()).toBeNull();
    m.step();
    const s = m.lastStep()!;
    expect(s.pc).toBe(0x2000);
    expect(s.instr?.mnemonic).toBe('LDA');
    expect(s.memRead).toBe(0x40);
    expect(m.cpu.A).toBe(0x3a);
    m.step();
    expect(m.lastStep()!.pc).toBe(0x2003);
    m.back();
    expect(m.lastStep()!.pc).toBe(0x2000);
    m.reset();
    expect(m.lastStep()).toBeNull();
  });
});
