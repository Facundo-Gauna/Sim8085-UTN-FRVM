import { describe, expect, it } from 'vitest';
import { assemble } from '@sim8085/core';
import { createFakeWorkspace } from './fakeWorkspace';
import { createSession, isModified, SAMPLE } from './store';

const LOOP = 'LP: JMP LP\n';
const EQU_PROGRAM = 'N EQU 5\nMVI A,N\nHLT\n';

function fresh() {
  return createSession();
}

describe('SAMPLE', () => {
  it('ensambla bien en 2000h con 8 bytes', () => {
    expect(SAMPLE.name).toBe('ej1-complemento.asm');
    expect(SAMPLE.memory).toEqual([[0x40, 0x3a]]);
    const asm = assemble(SAMPLE.text, { start: 0x2000 });
    expect(asm.ok).toBe(true);
    expect(asm.sizeBytes).toBe(8);
    expect(SAMPLE.text).toContain('A ← M[0040h], traigo el dato');
  });
});

describe('estado inicial', () => {
  it('arranca con el archivo de ejemplo, 2000h y 0040h = 3Ah', () => {
    const s = fresh().getState();
    expect(s.files).toHaveLength(1);
    expect(s.files[0]!.name).toBe(SAMPLE.name);
    expect(s.files[0]!.text).toBe(SAMPLE.text);
    expect(s.activeId).toBe(s.files[0]!.id);
    expect(s.startAddress).toBe(0x2000);
    expect(s.userMemory.get(0x40)).toBe(0x3a);
    expect(s.asm).toBeNull();
    expect(s.machine).toBeNull();
    expect(s.base).toBe('hex');
    expect(s.pausePrompt).toBe(false);
  });

  it('cada createSession es independiente', () => {
    const a = fresh();
    const b = fresh();
    a.getState().newFile();
    expect(a.getState().files).toHaveLength(2);
    expect(b.getState().files).toHaveLength(1);
  });
});

describe('assembleActive', () => {
  it('con el ejemplo crea la máquina y las métricas', () => {
    const st = fresh();
    st.getState().assembleActive();
    const s = st.getState();
    expect(s.asm?.ok).toBe(true);
    expect(s.machine).not.toBeNull();
    expect(s.metrics?.sizeBytes).toBe(8);
    expect(s.stale).toBe(false);
    expect(s.status).toEqual({
      kind: 'info',
      text: 'Ensamblado correcto · 4 instrucciones · 8 bytes desde 2000h',
    });
  });

  it('runBatch(100000) llega a HLT con el complemento en 0041h', () => {
    const st = fresh();
    st.getState().assembleActive();
    expect(st.getState().runBatch(100000)).toBe('halt');
    const s = st.getState();
    expect(s.machine!.memory[0x41]).toBe(0xc5);
    expect(s.status).toEqual({ kind: 'info', text: 'Detenido (HLT)' });
    expect(s.metrics?.executed).toBe(4);
    expect(s.pausePrompt).toBe(false);
  });

  it('error de sintaxis: sin máquina y status con la primera línea con error', () => {
    const st = fresh();
    const id = st.getState().activeId;
    st.getState().setText(id, 'MVI A,1\nFOO B\nBAR\n');
    st.getState().assembleActive();
    const s = st.getState();
    expect(s.asm?.ok).toBe(false);
    expect(s.machine).toBeNull();
    expect(s.stale).toBe(false);
    const first = s.asm!.messages.find((m) => m.severity === 'error')!;
    expect(first.line).toBe(2);
    expect(s.status).toEqual({ kind: 'error', source: 'assemble', text: `Línea 2: ${first.message}` });
  });

  it('Review Focus 1: re-ensamblar re-aplica memoria del alumno, PC al inicio, salidas vacías, prevMetrics', () => {
    const st = fresh();
    const id = st.getState().activeId;
    st.getState().setText(id, 'LDA 0040H\nOUT 01H\nHLT\n');
    st.getState().assembleActive();
    st.getState().runBatch(100000);
    expect(st.getState().machine!.outputs).toHaveLength(1);
    const finalMetrics = st.getState().metrics;
    st.getState().step();
    st.getState().setMemoryByte(0x40, '55');
    st.getState().assembleActive();
    const s = st.getState();
    expect(s.machine!.memory[0x40]).toBe(0x55);
    expect(s.machine!.cpu.PC).toBe(0x2000);
    expect(s.machine!.outputs).toHaveLength(0);
    expect(s.prevMetrics).toEqual(finalMetrics);
    expect(s.prevMetrics?.executed).toBe(3);
    expect(s.metrics?.executed).toBe(0);
  });

  it('re-aplica inputs y puntos de corte', () => {
    const st = fresh();
    const id = st.getState().activeId;
    st.getState().setText(id, 'IN 05H\nSTA 0041H\nHLT\n');
    st.getState().setInput(0x05, '7F');
    st.getState().toggleBreakpoint(3);
    st.getState().assembleActive();
    expect(st.getState().runBatch(100000)).toBe('breakpoint');
    expect(st.getState().status).toEqual({ kind: 'info', text: 'Punto de corte en la línea 3' });
    expect(st.getState().machine!.memory[0x41]).toBe(0x7f);
  });

  it('quita los puntos de corte que el core rechaza y lo informa', () => {
    const st = fresh();
    const id = st.getState().activeId;
    st.getState().toggleBreakpoint(1); // sin máquina: se guarda en silencio
    st.getState().setText(id, EQU_PROGRAM);
    st.getState().assembleActive();
    const s = st.getState();
    expect(s.breakpointLines.has(1)).toBe(false);
    expect(s.status?.kind).toBe('info');
    expect(s.status?.text).toContain('línea 1');
  });

  it('startAddress se pasa al ensamblador', () => {
    const st = fresh();
    st.getState().setStartAddress('3000');
    st.getState().assembleActive();
    expect(st.getState().asm!.start).toBe(0x3000);
    expect(st.getState().machine!.cpu.PC).toBe(0x3000);
  });
});

describe('ejecución', () => {
  it('stepBack() tras step() vuelve el PC', () => {
    const st = fresh();
    st.getState().assembleActive();
    const v0 = st.getState().version;
    st.getState().step();
    expect(st.getState().machine!.cpu.PC).toBe(0x2003);
    expect(st.getState().version).toBeGreaterThan(v0);
    st.getState().stepBack();
    expect(st.getState().machine!.cpu.PC).toBe(0x2000);
  });

  it('reset() vuelve al inicio y sube version', () => {
    const st = fresh();
    st.getState().assembleActive();
    st.getState().runBatch(100000);
    const v = st.getState().version;
    st.getState().reset();
    expect(st.getState().machine!.cpu.PC).toBe(0x2000);
    expect(st.getState().version).toBe(v + 1);
    expect(st.getState().metrics?.executed).toBe(0);
  });

  it('bucle infinito: runBatch(100000) → pause-limit y pausePrompt', () => {
    const st = fresh();
    st.getState().setText(st.getState().activeId, LOOP);
    st.getState().assembleActive();
    expect(st.getState().runBatch(100000)).toBe('pause-limit');
    expect(st.getState().pausePrompt).toBe(true);
    st.getState().continueAfterPause();
    expect(st.getState().pausePrompt).toBe(false);
  });

  it('promptPause pone pausePrompt solo con una máquina lista', () => {
    const st = fresh();
    st.getState().promptPause();
    expect(st.getState().pausePrompt).toBe(false);
    st.getState().setText(st.getState().activeId, LOOP);
    st.getState().assembleActive();
    st.getState().promptPause();
    expect(st.getState().pausePrompt).toBe(true);
  });

  it('step y stepBack cierran el aviso de pausa', () => {
    const st = fresh();
    st.getState().setText(st.getState().activeId, LOOP);
    st.getState().assembleActive();
    st.getState().promptPause();
    st.getState().step();
    expect(st.getState().pausePrompt).toBe(false);
    st.getState().promptPause();
    st.getState().stepBack();
    expect(st.getState().pausePrompt).toBe(false);
  });

  it('tanda chica que agota la cuota → null y sin pausePrompt (sigue corriendo)', () => {
    const st = fresh();
    st.getState().setText(st.getState().activeId, LOOP);
    st.getState().assembleActive();
    expect(st.getState().runBatch(5000)).toBeNull();
    expect(st.getState().pausePrompt).toBe(false);
    expect(st.getState().metrics?.executed).toBe(5000);
  });

  it('stop() limpia pausePrompt y avisa', () => {
    const st = fresh();
    st.getState().setText(st.getState().activeId, LOOP);
    st.getState().assembleActive();
    st.getState().runBatch(100000);
    st.getState().stop();
    expect(st.getState().pausePrompt).toBe(false);
    expect(st.getState().status).toEqual({ kind: 'info', text: 'Ejecución detenida' });
  });

  it('runBatch sin ensamblar o con texto cambiado → null y error', () => {
    const st = fresh();
    expect(st.getState().runBatch(100000)).toBeNull();
    expect(st.getState().status).toEqual({ kind: 'error', text: 'Ensamblá primero (F5)' });
    st.getState().assembleActive();
    st.getState().setText(st.getState().activeId, 'HLT\n');
    expect(st.getState().runBatch(100000)).toBeNull();
    expect(st.getState().status?.kind).toBe('error');
  });

  it('opcode inválido → error con el texto del core', () => {
    const st = fresh();
    st.getState().setText(st.getState().activeId, 'DB 08H\n');
    st.getState().assembleActive();
    expect(st.getState().asm?.ok).toBe(true);
    expect(st.getState().runBatch(100000)).toBe('error');
    expect(st.getState().status?.kind).toBe('error');
    expect(st.getState().status?.text).toMatch(/Opcode inválido/);
  });

  it('raise() marca la interrupción pendiente y sube version', () => {
    const st = fresh();
    st.getState().assembleActive();
    const v = st.getState().version;
    st.getState().raise('TRAP');
    expect(st.getState().machine!.cpu.pending.trap).toBe(true);
    expect(st.getState().version).toBe(v + 1);
  });
});

describe('archivos', () => {
  it('setText después de ensamblar → stale', () => {
    const st = fresh();
    st.getState().assembleActive();
    st.getState().setText(st.getState().activeId, 'HLT\n');
    expect(st.getState().stale).toBe(true);
    expect(st.getState().files[0]!.text).toBe('HLT\n');
  });

  it('setText en un archivo no activo no marca stale', () => {
    const st = fresh();
    const first = st.getState().activeId;
    st.getState().newFile();
    st.getState().assembleActive();
    st.getState().setText(first, 'NOP\n');
    expect(st.getState().stale).toBe(false);
  });

  it('newFile numera sin-titulo-N.asm con el siguiente N libre y lo activa', () => {
    const st = fresh();
    st.getState().newFile();
    st.getState().newFile();
    const names = st.getState().files.map((f) => f.name);
    expect(names).toEqual([SAMPLE.name, 'sin-titulo-1.asm', 'sin-titulo-2.asm']);
    expect(st.getState().activeId).toBe(st.getState().files[2]!.id);
    st.getState().closeFile(st.getState().files[1]!.id);
    st.getState().newFile();
    expect(st.getState().files.map((f) => f.name)).toContain('sin-titulo-1.asm');
  });

  it('closeFile del último deja un sin-titulo.asm vacío', () => {
    const st = fresh();
    st.getState().closeFile(st.getState().activeId);
    const s = st.getState();
    expect(s.files).toHaveLength(1);
    expect(s.files[0]!.name).toBe('sin-titulo.asm');
    expect(s.files[0]!.text).toBe('');
    expect(s.activeId).toBe(s.files[0]!.id);
  });

  it('openFile agrega y activa; setActive limpia asm y máquina', () => {
    const st = fresh();
    st.getState().assembleActive();
    st.getState().openFile('otro.asm', 'HLT\n');
    const s = st.getState();
    expect(s.files).toHaveLength(2);
    expect(s.files[1]!.name).toBe('otro.asm');
    expect(s.activeId).toBe(s.files[1]!.id);
    expect(s.asm).toBeNull();
    expect(s.machine).toBeNull();
    expect(s.stale).toBe(false);
    st.getState().assembleActive();
    st.getState().setActive(s.files[0]!.id);
    expect(st.getState().machine).toBeNull();
    expect(st.getState().asm).toBeNull();
  });
});

describe('validación (Review Focus 5)', () => {
  it("setStartAddress('xyz') deja el valor anterior y pone error", () => {
    const st = fresh();
    st.getState().setStartAddress('xyz');
    expect(st.getState().startAddress).toBe(0x2000);
    expect(st.getState().status?.kind).toBe('error');
  });

  it("setMemoryByte(0x40,'1FF') deja el valor anterior y pone error", () => {
    const st = fresh();
    st.getState().setMemoryByte(0x40, '1FF');
    expect(st.getState().userMemory.get(0x40)).toBe(0x3a);
    expect(st.getState().status).toEqual({ kind: 'error', source: 'input', text: 'Dato fuera de rango (00h–FFh)' });
  });

  it('setMemoryByte válido con máquina escribe en la memoria y sube version', () => {
    const st = fresh();
    st.getState().assembleActive();
    const v = st.getState().version;
    st.getState().setMemoryByte(0x40, '0Fh');
    expect(st.getState().userMemory.get(0x40)).toBe(0x0f);
    expect(st.getState().machine!.memory[0x40]).toBe(0x0f);
    expect(st.getState().version).toBe(v + 1);
  });

  it('setInput inválido deja el valor anterior; válido lo guarda', () => {
    const st = fresh();
    st.getState().setInput(1, 'zz');
    expect(st.getState().inputs.has(1)).toBe(false);
    expect(st.getState().status?.kind).toBe('error');
    st.getState().setInput(1, '20');
    expect(st.getState().inputs.get(1)).toBe(0x20);
  });

  it('el status de error de ensamblado trae source "assemble"; el de entrada de datos "input"', () => {
    const st = fresh();
    st.getState().setText(st.getState().activeId, 'MVI A, A1H\n');
    st.getState().assembleActive();
    expect(st.getState().status?.source).toBe('assemble');
    st.getState().setInput(1, 'zz');
    expect(st.getState().status?.source).toBe('input');
  });

  it('removeInput quita el puerto de la sesión y de la máquina', () => {
    const st = fresh();
    st.getState().assembleActive();
    st.getState().setInput(5, '7F');
    expect(st.getState().machine!.inputs.get(5)).toBe(0x7f);
    st.getState().removeInput(5);
    expect(st.getState().inputs.has(5)).toBe(false);
    expect(st.getState().machine!.inputs.has(5)).toBe(false);
    st.getState().removeInput(9); // inexistente: no falla
    const v = st.getState().version;
    st.getState().setInput(6, '01');
    st.getState().removeInput(6);
    expect(st.getState().version).toBe(v + 2);
  });

  it('clearUserMemory borra los datos del alumno en la sesión y en la máquina', () => {
    const st = fresh();
    st.getState().assembleActive();
    st.getState().clearUserMemory();
    expect(st.getState().userMemory.size).toBe(0);
    expect(st.getState().machine!.memory[0x40]).toBe(0);
  });
});

describe('puntos de corte', () => {
  it('toggleBreakpoint en una línea EQU → error y sin cambios', () => {
    const st = fresh();
    st.getState().setText(st.getState().activeId, EQU_PROGRAM);
    st.getState().assembleActive();
    const before = st.getState().breakpointLines;
    st.getState().toggleBreakpoint(1);
    const s = st.getState();
    expect(s.status).toEqual({ kind: 'error', text: 'Esa línea no genera instrucciones' });
    expect(s.breakpointLines.size).toBe(0);
    expect(s.breakpointLines).toBe(before);
  });

  it('toggleBreakpoint con máquina pone y quita', () => {
    const st = fresh();
    st.getState().assembleActive();
    st.getState().toggleBreakpoint(2);
    expect(st.getState().breakpointLines.has(2)).toBe(true);
    st.getState().toggleBreakpoint(2);
    expect(st.getState().breakpointLines.has(2)).toBe(false);
    expect(st.getState().runBatch(100000)).toBe('halt');
  });

  it('toggleBreakpoint sin máquina alterna en silencio', () => {
    const st = fresh();
    st.getState().toggleBreakpoint(7);
    expect(st.getState().breakpointLines.has(7)).toBe(true);
    expect(st.getState().status).toBeNull();
    st.getState().toggleBreakpoint(7);
    expect(st.getState().breakpointLines.has(7)).toBe(false);
  });
});

describe('setBase', () => {
  it("setBase('bin') solo cambia la base", () => {
    const st = fresh();
    st.getState().assembleActive();
    const { base: _b, setBase: _s, ...before } = st.getState();
    st.getState().setBase('bin');
    const { base, setBase: _s2, ...after } = st.getState();
    expect(base).toBe('bin');
    expect(after).toEqual(before);
    expect(after.version).toBe(before.version);
  });
});

describe('fix ronda 1: puntos de corte en el borde de una tanda', () => {
  // El brief decía `L:`, pero L es un registro: el core lo rechaza como etiqueta.
  const BORDER = 'MVI B,0\nLP: DCR B\nJNZ LP\nNOP\nHLT\n';

  it('un punto de corte justo en el borde de la tanda se informa en la siguiente', () => {
    const st = fresh();
    st.getState().setText(st.getState().activeId, BORDER);
    st.getState().toggleBreakpoint(4);
    st.getState().assembleActive();
    expect(st.getState().runBatch(513)).toBeNull();
    const nop = st.getState().asm!.lineToAddress.get(4)!;
    expect(st.getState().machine!.cpu.PC).toBe(nop);
    expect(st.getState().runBatch(513)).toBe('breakpoint');
    expect(st.getState().machine!.cpu.PC).toBe(nop);
    expect(st.getState().status).toEqual({ kind: 'info', text: 'Punto de corte en la línea 4' });
    expect(st.getState().runBatch(513)).toBe('halt');
  });

  it('punto de corte en la instrucción de entrada: se detiene una vez con stepCount 0', () => {
    const st = fresh();
    st.getState().toggleBreakpoint(2); // LDA, la entrada del ejemplo
    st.getState().assembleActive();
    const v = st.getState().version;
    expect(st.getState().runBatch(100000)).toBe('breakpoint');
    expect(st.getState().machine!.stepCount).toBe(0);
    expect(st.getState().version).toBe(v + 1);
    expect(st.getState().status).toEqual({ kind: 'info', text: 'Punto de corte en la línea 2' });
    expect(st.getState().runBatch(100000)).toBe('halt');
  });

  it('step() fuera del punto de corte y back() sobre él: la próxima tanda se detiene otra vez', () => {
    const st = fresh();
    st.getState().toggleBreakpoint(2);
    st.getState().assembleActive();
    expect(st.getState().runBatch(100000)).toBe('breakpoint');
    st.getState().step();
    st.getState().stepBack();
    expect(st.getState().machine!.cpu.PC).toBe(0x2000);
    expect(st.getState().runBatch(100000)).toBe('breakpoint');
  });

  it('reset() vuelve a detener en el punto de corte de la entrada', () => {
    const st = fresh();
    st.getState().toggleBreakpoint(2);
    st.getState().assembleActive();
    st.getState().runBatch(100000);
    st.getState().runBatch(100000);
    st.getState().reset();
    expect(st.getState().runBatch(100000)).toBe('breakpoint');
  });
});

describe('fix ronda 1: estado y validación', () => {
  it('un setter válido limpia el error anterior (memoria, entrada, inicio)', () => {
    const st = fresh();
    st.getState().setMemoryByte(0x40, 'zz');
    expect(st.getState().status?.kind).toBe('error');
    st.getState().setMemoryByte(0x40, '12');
    expect(st.getState().status).toBeNull();

    st.getState().setInput(1, 'zz');
    expect(st.getState().status?.kind).toBe('error');
    st.getState().setInput(1, '12');
    expect(st.getState().status).toBeNull();

    st.getState().setStartAddress('xyz');
    expect(st.getState().status?.kind).toBe('error');
    st.getState().setStartAddress('3000');
    expect(st.getState().status).toBeNull();
  });

  it("setStartAddress('20000h') se rechaza", () => {
    const st = fresh();
    st.getState().setStartAddress('20000h');
    expect(st.getState().startAddress).toBe(0x2000);
    expect(st.getState().status).toEqual({ kind: 'error', text: 'Dirección fuera de rango (0000h–FFFFh)' });
  });

  it('setStartAddress después de ensamblar marca stale y avisa', () => {
    const st = fresh();
    st.getState().assembleActive();
    st.getState().setStartAddress('3000');
    expect(st.getState().startAddress).toBe(0x3000);
    expect(st.getState().stale).toBe(true);
    expect(st.getState().status).toEqual({
      kind: 'info',
      text: 'La dirección de inicio cambió: volvé a ensamblar',
    });
  });

  it('setActive limpia status, metrics y prevMetrics', () => {
    const st = fresh();
    const first = st.getState().activeId;
    st.getState().assembleActive();
    st.getState().assembleActive();
    expect(st.getState().prevMetrics).not.toBeNull();
    st.getState().newFile();
    st.getState().setActive(first);
    const s = st.getState();
    expect(s.status).toBeNull();
    expect(s.metrics).toBeNull();
    expect(s.prevMetrics).toBeNull();
  });

  it('con la sesión stale, step/back/reset/raise/runBatch avisan sin lanzar', () => {
    const st = fresh();
    st.getState().assembleActive();
    st.getState().setText(st.getState().activeId, 'HLT\n');
    const NOT_READY = { kind: 'error', text: 'Ensamblá primero (F5)' };
    for (const act of [
      () => st.getState().step(),
      () => st.getState().stepBack(),
      () => st.getState().reset(),
      () => st.getState().raise('TRAP'),
      () => expect(st.getState().runBatch(100000)).toBeNull(),
    ]) {
      st.setState({ status: null });
      expect(act).not.toThrow();
      expect(st.getState().status).toEqual(NOT_READY);
    }
  });
});

describe('Task 6 fix ronda 1: stale y puntos de corte', () => {
  const STALE = 'El código cambió: volvé a ensamblar';

  it('setText tras ensamblar avisa que el código cambió; re-ensamblar lo reemplaza', () => {
    const st = fresh();
    const id = st.getState().activeId;
    st.getState().assembleActive();
    st.getState().setText(id, `${SAMPLE.text}NOP\n`);
    expect(st.getState().status).toEqual({ kind: 'info', text: STALE });
    const before = st.getState().status;
    st.getState().setText(id, `${SAMPLE.text}NOP\nNOP\n`);
    expect(st.getState().status).toBe(before); // no se vuelve a crear
    st.getState().assembleActive();
    expect(st.getState().status?.text).toMatch(/^Ensamblado correcto/);
  });

  it('setText sin ensamblar no avisa', () => {
    const st = fresh();
    st.getState().setText(st.getState().activeId, 'NOP\n');
    expect(st.getState().status).toBeNull();
  });

  it('setText no pisa un error con el aviso de código cambiado', () => {
    const st = fresh();
    st.getState().assembleActive();
    st.getState().toggleBreakpoint(1); // línea de comentario: error
    const err = st.getState().status;
    expect(err?.kind).toBe('error');
    st.getState().setText(st.getState().activeId, `${SAMPLE.text}NOP\n`);
    expect(st.getState().stale).toBe(true);
    expect(st.getState().status).toBe(err);
  });

  it('setBreakpointLines reemplaza el conjunto por uno nuevo', () => {
    const st = fresh();
    const lines = new Set([3, 4]);
    st.getState().setBreakpointLines(lines);
    expect(st.getState().breakpointLines).toEqual(new Set([3, 4]));
    expect(st.getState().breakpointLines).not.toBe(lines);
  });
});

describe('autofillObservations', () => {
  const load = (text: string) => {
    const st = createSession();
    st.getState().setText(st.getState().activeId, text);
    st.getState().assembleActive();
    return st;
  };
  const text = (st: ReturnType<typeof createSession>) => st.getState().files[0]!.text;

  it('completa solo las líneas sin comentario y respeta las que ya lo tienen', () => {
    const st = load('MVI A, 5\n  CMA ; mío\n  HLT\n');
    expect(st.getState().autofillObservations()).toBe(2);
    const lines = text(st).split('\n');
    expect(lines[0]).toBe('MVI A, 5'.padEnd(24) + '; A ← 05h');
    expect(lines[1]).toBe('  CMA ; mío');
    expect(lines[2]).toBe('  HLT'.padEnd(24) + '; detiene el procesador');
    expect(st.getState().status).toEqual({ kind: 'info', text: 'Se completaron 2 observaciones' });
    expect(st.getState().stale).toBe(true);
  });

  it('con una sola línea usa el singular', () => {
    const st = load('HLT\n');
    expect(st.getState().autofillObservations()).toBe(1);
    expect(st.getState().status?.text).toBe('Se completó 1 observación');
  });

  it('una línea más larga que la columna 24 usa un solo espacio', () => {
    const st = load('LXI H, 1234H\nHLT\n');
    st.getState().autofillObservations();
    expect(text(st).split('\n')[0]).toBe('LXI H, 1234H'.padEnd(24) + '; HL ← 1234h');
    const long = load('LABEL_MUY_LARGA_AQUI: MVI A, 05H\nHLT\n');
    long.getState().autofillObservations();
    expect(text(long).split('\n')[0]).toBe('LABEL_MUY_LARGA_AQUI: MVI A, 05H ; A ← 05h');
  });

  it('la segunda vez no encuentra nada que completar', () => {
    const st = load('NOP\nHLT\n');
    st.getState().autofillObservations();
    st.getState().assembleActive();
    expect(st.getState().autofillObservations()).toBe(0);
  });

  it('sin ensamblar (o con el código cambiado) devuelve 0 y avisa', () => {
    const st = createSession();
    expect(st.getState().autofillObservations()).toBe(0);
    expect(st.getState().status).toEqual({ kind: 'error', text: 'Ensamblá primero (F5)' });
  });

  it('no toca las llamadas a macro', () => {
    const st = load('M1 MACRO\n  NOP\n  ENDM\n  M1\n  HLT\n');
    st.getState().autofillObservations();
    const lines = text(st).split('\n');
    expect(lines[3]).toBe('  M1');
    expect(lines[4]).toContain('; detiene el procesador');
  });
});

describe('traceForExport', () => {
  it('el ejemplo: 4 filas con el dato del alumno cargado', () => {
    const st = createSession();
    st.getState().assembleActive();
    const t = st.getState().traceForExport()!;
    expect(t.truncated).toBe(false);
    expect(t.rows).toHaveLength(4);
    expect(t.rows[0]).toMatchObject({ memAddr: 0x40, memValue: 0x3a, A: 0x3a });
    expect(t.rows[2]).toMatchObject({ memAddr: 0x41, memValue: 0xc5, A: 0xc5 });
  });

  it('bucle infinito: 500 filas y truncated', () => {
    const st = createSession();
    st.getState().setText(st.getState().activeId, LOOP);
    st.getState().assembleActive();
    const t = st.getState().traceForExport()!;
    expect(t.rows).toHaveLength(500);
    expect(t.truncated).toBe(true);
  });

  it('sin ensamblar o con el código cambiado devuelve null', () => {
    const st = createSession();
    expect(st.getState().traceForExport()).toBeNull();
    st.getState().assembleActive();
    st.getState().setText(st.getState().activeId, 'NOP');
    expect(st.getState().traceForExport()).toBeNull();
  });
});

describe('ejercicio activo', () => {
  const SOL = 'LDA 0040H\nCMA\nSTA 0041H\nHLT\n';

  it('startExercise abre un archivo nuevo con el starter, dirección y datos del ejercicio', () => {
    const st = createSession();
    const before = st.getState().files[0]!;
    expect(st.getState().startExercise('gtp05-1')).toBe(true);
    const s = st.getState();
    expect(s.files).toHaveLength(2);
    expect(s.files[0]).toEqual(before);
    expect(s.files[1]!.name).toBe('gtp05-1.asm');
    expect(s.activeId).toBe(s.files[1]!.id);
    expect(s.files[1]!.text).toContain('HLT');
    expect(s.startAddress).toBe(0x2000);
    expect([...s.userMemory]).toEqual([[0x40, 0x3a]]);
    expect(s.inputs.size).toBe(0);
    expect(s.exercise!.id).toBe('gtp05-1');
    expect(s.exerciseResult).toBeNull();
    expect(s.asm).toBeNull();
    expect(s.status).toEqual({ kind: 'info', text: 'Ejercicio cargado: GTP05 · 1' });
  });

  it('el ejercicio 2 cambia la dirección de inicio a 1000h y reemplaza los datos', () => {
    const st = createSession();
    st.getState().startExercise('gtp05-2');
    expect(st.getState().startAddress).toBe(0x1000);
    expect([...st.getState().userMemory].sort((a, b) => a[0] - b[0])).toEqual([[0x2000, 0xf0], [0x2001, 0x3c]]);
  });

  it('abrir el mismo ejercicio dos veces numera el archivo', () => {
    const st = createSession();
    st.getState().startExercise('gtp05-1');
    st.getState().startExercise('gtp05-1');
    expect(st.getState().files.map((f) => f.name).slice(1)).toEqual(['gtp05-1.asm', 'gtp05-1-2.asm']);
  });

  it('un id desconocido devuelve false y no cambia nada', () => {
    const st = createSession();
    const before = st.getState();
    expect(st.getState().startExercise('x')).toBe(false);
    expect(st.getState().files).toBe(before.files);
    expect(st.getState().exercise).toBeNull();
  });

  it('checkExerciseNow: correcto → resultado, resuelto y estado', () => {
    const st = createSession();
    st.getState().startExercise('gtp05-1');
    st.getState().setText(st.getState().activeId, SOL);
    const r = st.getState().checkExerciseNow()!;
    expect(r).toEqual({ ok: true, passed: 4, total: 4 });
    expect(st.getState().exerciseResult).toEqual(r);
    expect(st.getState().solved.has('gtp05-1')).toBe(true);
    expect(st.getState().status).toEqual({ kind: 'info', text: '¡Correcto! Pasó los 4 casos' });
    expect(st.getState().asm).toBeNull();
    expect(st.getState().machine).toBeNull();
  });

  it('checkExerciseNow: incorrecto → mensaje del caso y no se marca resuelto', () => {
    const st = createSession();
    st.getState().startExercise('gtp05-1');
    const r = st.getState().checkExerciseNow()!;
    expect(r.failure!.message).toBe('Falla cuando 0040h = 3Ah: 0041h debía ser C5h y quedó 00h');
    expect(st.getState().status).toEqual({ kind: 'error', text: r.failure!.message });
    expect(st.getState().solved.size).toBe(0);
  });

  it('checkExerciseNow: errores de ensamblado y bucle infinito no lanzan', () => {
    const st = createSession();
    st.getState().startExercise('gtp05-1');
    st.getState().setText(st.getState().activeId, 'MVI A, A1H');
    expect(st.getState().checkExerciseNow()!.failure!.kind).toBe('assemble');
    st.getState().setText(st.getState().activeId, LOOP);
    expect(st.getState().checkExerciseNow()!.failure!.kind).toBe('no-halt');
    st.getState().setText(st.getState().activeId, '');
    expect(st.getState().checkExerciseNow()!.ok).toBe(false);
  });

  it('sin ejercicio activo devuelve null', () => {
    expect(createSession().getState().checkExerciseNow()).toBeNull();
  });

  it('leaveExercise conserva el archivo y limpia el ejercicio', () => {
    const st = createSession();
    st.getState().startExercise('gtp05-1');
    st.getState().checkExerciseNow();
    st.getState().leaveExercise();
    expect(st.getState().exercise).toBeNull();
    expect(st.getState().exerciseResult).toBeNull();
    expect(st.getState().files).toHaveLength(2);
  });

  it('con un único caso el mensaje va en singular', () => {
    const st = createSession();
    st.getState().startExercise('basico-cargar');
    st.getState().setText(st.getState().activeId, 'MVI A, 5AH\nSTA 3000H\nHLT');
    st.getState().checkExerciseNow();
    expect(st.getState().status!.text).toBe('¡Correcto! Pasó el único caso');
  });
});

describe('carpeta de trabajo', () => {
  const open = async (initial: Record<string, string> = { 'a.asm': 'NOP\nHLT\n', 'sub/b.asm': 'MVI A, 1\n' }) => {
    const ws = createFakeWorkspace(initial);
    const st = createSession();
    await st.getState().openFolder(ws);
    return { ws, st };
  };
  const tabs = (st: ReturnType<typeof createSession>) => st.getState().files;

  it('openFolder carga el nombre y el árbol; cancelar no cambia nada', async () => {
    const { st } = await open();
    expect(st.getState().workspace!.name).toBe('asm');
    expect(st.getState().workspace!.tree.map((n) => n.path)).toEqual(['sub', 'a.asm']);
    const cancel = createFakeWorkspace({}, null);
    const before = st.getState();
    expect(await st.getState().openFolder(cancel)).toBe(false);
    expect(st.getState().workspace).toBe(before.workspace);
    expect(st.getState().fileOpError).toBe('');
  });

  it('abrir una carpeta nueva desvincula las pestañas con ruta de la carpeta anterior', async () => {
    const { st } = await open();
    await st.getState().openWorkspaceFile(createFakeWorkspace({ 'a.asm': 'NOP' }), 'a.asm');
    const other = createFakeWorkspace({ 'z.asm': 'HLT' }, 'otra');
    await st.getState().openFolder(other);
    expect(tabs(st).every((f) => f.path === undefined)).toBe(true);
    expect(st.getState().workspace!.name).toBe('otra');
  });

  it('openWorkspaceFile crea una pestaña con ruta, sin modificar, y no duplica', async () => {
    const { ws, st } = await open();
    expect(await st.getState().openWorkspaceFile(ws, 'sub/b.asm')).toBe(true);
    const tab = tabs(st).at(-1)!;
    expect(tab).toMatchObject({ name: 'b.asm', path: 'sub/b.asm', text: 'MVI A, 1\n', diskText: 'MVI A, 1\n' });
    expect(st.getState().activeId).toBe(tab.id);
    expect(isModified(tab)).toBe(false);
    const n = tabs(st).length;
    await st.getState().openWorkspaceFile(ws, 'sub/b.asm');
    expect(tabs(st)).toHaveLength(n);
  });

  it('abrir un archivo inexistente da error y no crea pestaña', async () => {
    const { ws, st } = await open();
    const n = tabs(st).length;
    expect(await st.getState().openWorkspaceFile(ws, 'no.asm')).toBe(false);
    expect(st.getState().fileOpError).toBe('El archivo no existe');
    expect(tabs(st)).toHaveLength(n);
  });

  it('editar marca modificado y guardar lo baja', async () => {
    const { ws, st } = await open();
    await st.getState().openWorkspaceFile(ws, 'a.asm');
    const id = st.getState().activeId;
    st.getState().setText(id, 'NOP\nNOP\nHLT\n');
    expect(isModified(tabs(st).find((f) => f.id === id)!)).toBe(true);
    expect(await st.getState().saveActive(ws)).toBe(true);
    expect(ws.files.get('a.asm')).toBe('NOP\nNOP\nHLT\n');
    expect(isModified(tabs(st).find((f) => f.id === id)!)).toBe(false);
  });

  it('un fallo al escribir deja el error, la pestaña modificada y el texto intacto', async () => {
    const { ws, st } = await open();
    await st.getState().openWorkspaceFile(ws, 'a.asm');
    const id = st.getState().activeId;
    st.getState().setText(id, 'NUEVO');
    ws.failNext('write', 'No hay espacio en el disco');
    expect(await st.getState().saveActive(ws)).toBe(false);
    expect(st.getState().fileOpError).toBe('No hay espacio en el disco');
    const tab = tabs(st).find((f) => f.id === id)!;
    expect(tab.text).toBe('NUEVO');
    expect(isModified(tab)).toBe(true);
    expect(ws.files.get('a.asm')).toBe('NOP\nHLT\n');
  });

  it('guardar una pestaña sin ruta con nombre crea el archivo y le asigna ruta y nombre', async () => {
    const { ws, st } = await open();
    st.getState().newFile();
    const id = st.getState().activeId;
    st.getState().setText(id, 'HLT');
    expect(await st.getState().saveActive(ws, 'nuevo.asm')).toBe(true);
    expect(ws.files.get('nuevo.asm')).toBe('HLT');
    expect(tabs(st).find((f) => f.id === id)).toMatchObject({ name: 'nuevo.asm', path: 'nuevo.asm', diskText: 'HLT' });
    expect(st.getState().workspace!.tree.some((n) => n.path === 'nuevo.asm')).toBe(true);
  });

  it('sin nombre, o con un nombre que ya existe, no guarda ni pisa', async () => {
    const { ws, st } = await open();
    st.getState().newFile();
    st.getState().setText(st.getState().activeId, 'HLT');
    expect(await st.getState().saveActive(ws)).toBe(false);
    expect(st.getState().fileOpError).toBe('Falta el nombre del archivo');
    expect(await st.getState().saveActive(ws, 'a.asm')).toBe(false);
    expect(st.getState().fileOpError).toBe('El archivo ya existe');
    expect(ws.files.get('a.asm')).toBe('NOP\nHLT\n');
    expect(tabs(st).at(-1)!.path).toBeUndefined();
  });

  it('si la escritura falla tras crear, se quita el archivo vacío y la pestaña queda sin ruta', async () => {
    const { ws, st } = await open();
    st.getState().newFile();
    st.getState().setText(st.getState().activeId, 'HLT');
    ws.failNext('write', 'Sin permiso para acceder al archivo');
    expect(await st.getState().saveActive(ws, 'x.asm')).toBe(false);
    expect(ws.files.has('x.asm')).toBe(false);
    expect(tabs(st).at(-1)!.path).toBeUndefined();
  });

  it('renameFile sigue a la pestaña abierta y refresca el árbol; un destino existente falla', async () => {
    const { ws, st } = await open();
    await st.getState().openWorkspaceFile(ws, 'a.asm');
    const id = st.getState().activeId;
    expect(await st.getState().renameFile(ws, 'a.asm', 'z.asm')).toBe(true);
    expect(tabs(st).find((f) => f.id === id)).toMatchObject({ path: 'z.asm', name: 'z.asm' });
    expect(st.getState().workspace!.tree.map((n) => n.path)).toEqual(['sub', 'z.asm']);
    expect(await st.getState().renameFile(ws, 'z.asm', 'sub/b.asm')).toBe(false);
    expect(st.getState().fileOpError).toBe('El archivo ya existe');
    expect(tabs(st).find((f) => f.id === id)!.path).toBe('z.asm');
  });

  it('deleteFile cierra la pestaña de ese archivo; si no estaba abierto no toca las pestañas', async () => {
    const { ws, st } = await open();
    await st.getState().openWorkspaceFile(ws, 'a.asm');
    const n = tabs(st).length;
    expect(await st.getState().deleteFile(ws, 'a.asm')).toBe(true);
    expect(tabs(st)).toHaveLength(n - 1);
    expect(tabs(st).some((f) => f.path === 'a.asm')).toBe(false);
    const before = tabs(st);
    expect(await st.getState().deleteFile(ws, 'sub/b.asm')).toBe(true);
    expect(tabs(st)).toEqual(before);
    expect(st.getState().workspace!.tree).toEqual([]);
  });

  it('createFile crea el archivo vacío, lo abre y actualiza el árbol; uno existente falla', async () => {
    const { ws, st } = await open();
    expect(await st.getState().createFile(ws, 'n/nuevo.asm')).toBe(true);
    expect(ws.files.get('n/nuevo.asm')).toBe('');
    expect(tabs(st).at(-1)).toMatchObject({ path: 'n/nuevo.asm', name: 'nuevo.asm', text: '' });
    expect(st.getState().workspace!.tree.map((n) => n.path)).toContain('n');
    expect(await st.getState().createFile(ws, 'a.asm')).toBe(false);
    expect(st.getState().fileOpError).toBe('El archivo ya existe');
  });

  it('cada operación limpia el error anterior y nunca lanza, aunque el servicio lance', async () => {
    const { ws, st } = await open();
    await st.getState().openWorkspaceFile(ws, 'no.asm');
    expect(st.getState().fileOpError).not.toBe('');
    await st.getState().refreshTree(ws);
    expect(st.getState().fileOpError).toBe('');
    const boom = { ...ws, tree: () => { throw new Error('síncrono'); } } as unknown as typeof ws;
    expect(await st.getState().refreshTree(boom)).toBe(false);
    expect(st.getState().fileOpError).toBe('síncrono');
  });
});

describe('isModified', () => {
  const tab = (extra: object) => ({ id: 'f', name: 'a.asm', text: 'x', ...extra });
  it('con ruta compara con el texto del disco; sin ruta usa la referencia dada', () => {
    expect(isModified(tab({ path: 'a.asm', diskText: 'x' }))).toBe(false);
    expect(isModified(tab({ path: 'a.asm', diskText: 'y' }))).toBe(true);
    expect(isModified(tab({}), 'x')).toBe(false);
    expect(isModified(tab({}), 'y')).toBe(true);
    expect(isModified(tab({ text: '  ' }), 'y')).toBe(false);
    expect(isModified(tab({}))).toBe(false);
  });
});
