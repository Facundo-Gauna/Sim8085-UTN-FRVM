import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Drawer } from './Drawer';
import { defaultSession } from '../../state/store';

const INITIAL = defaultSession.getState();
beforeEach(() => defaultSession.setState(INITIAL, true));
afterEach(cleanup);

const s = () => defaultSession.getState();
const OUT_PROG = 'MVI A,3AH\nOUT 01H\nHLT\n';
const load = (text: string) => {
  act(() => s().setText(s().activeId, text));
  act(() => s().assembleActive());
};
const run = () => act(() => void s().runBatch(1000));
const tab = (name: RegExp | string) => screen.getByRole('tab', { name });
const pick = (name: RegExp | string) => fireEvent.click(tab(name));

describe('Drawer: estructura', () => {
  it('tablist con 5 pestañas, Salida seleccionada y panel enlazado', () => {
    render(<Drawer />);
    expect(screen.getByRole('tablist')).toBeTruthy();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    const t = tab(/^Salida/);
    expect(t.getAttribute('aria-selected')).toBe('true');
    const panel = screen.getByRole('tabpanel');
    expect(t.getAttribute('aria-controls')).toBe(panel.id);
  });

  it('el botón plegar alterna aria-expanded', () => {
    render(<Drawer />);
    const b = screen.getByRole('button', { name: 'Plegar cajón' });
    expect(b.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(b);
    const b2 = screen.getByRole('button', { name: 'Desplegar cajón' });
    expect(b2.getAttribute('aria-expanded')).toBe('false');
  });

  it('las flechas mueven entre pestañas', () => {
    render(<Drawer />);
    const t = tab(/^Salida/);
    t.focus();
    fireEvent.keyDown(t, { key: 'ArrowRight' });
    expect(tab(/^Pila/).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab(/^Pila/));
    fireEvent.keyDown(tab(/^Pila/), { key: 'ArrowLeft' });
    fireEvent.keyDown(tab(/^Salida/), { key: 'ArrowLeft' });
    expect(tab(/^Métricas/).getAttribute('aria-selected')).toBe('true');
  });
});

describe('Drawer: novedades', () => {
  it('un OUT con otra pestaña activa marca el punto y se limpia al elegir Salida', () => {
    load(OUT_PROG);
    render(<Drawer />);
    pick(/^Métricas/);
    fireEvent.click(screen.getByRole('button', { name: 'Plegar cajón' }));
    expect(tab(/^Salida/).textContent).not.toMatch(/novedades/);
    run();
    expect(tab(/^Salida/).textContent).toMatch(/novedades/);
    // se abrió solo
    expect(screen.getByRole('button', { name: 'Plegar cajón' }).getAttribute('aria-expanded')).toBe('true');
    pick(/^Salida/);
    expect(tab(/^Salida/).textContent).not.toMatch(/novedades/);
  });

  it('un error del ensamblador marca Salida', () => {
    render(<Drawer />);
    pick(/^Pila/);
    load('MVI A, A1H\n');
    expect(tab(/^Salida/).textContent).toMatch(/novedades/);
  });
});

describe('Salida', () => {
  it('muestra OUT 01h ← 3Ah y sigue la base', () => {
    load(OUT_PROG);
    render(<Drawer />);
    run();
    expect(screen.getByText('OUT 01h ← 3Ah')).toBeTruthy();
    act(() => s().setBase('dec'));
    expect(screen.getByText('OUT 01h ← 58')).toBeTruthy();
  });

  it('vacío: Sin salida todavía', () => {
    render(<Drawer />);
    expect(screen.getByText('Sin salida todavía')).toBeTruthy();
  });

  it('lista los mensajes del ensamblador con línea y severidad', () => {
    load('NOP\nNOP\nNOP\nMVI A, A1H\n');
    render(<Drawer />);
    const list = screen.getByRole('list', { name: 'Mensajes del ensamblador' });
    const items = within(list).getAllByRole('listitem');
    expect(items[0]!.textContent).toMatch(/^Línea 4: error: .*¿Quisiste decir 0A1H\?/);
  });

  it('advertencia por comentario de 81 caracteres', () => {
    load(`NOP ;${'x'.repeat(81)}\nHLT\n`);
    render(<Drawer />);
    const list = screen.getByRole('list', { name: 'Mensajes del ensamblador' });
    expect(within(list).getAllByRole('listitem')[0]!.textContent).toMatch(/^Línea 1: advertencia: /);
  });

  it('muestra el resumen de ensamblado del simulador', () => {
    load(OUT_PROG);
    render(<Drawer />);
    expect(screen.getByText(/Ensamblado correcto/)).toBeTruthy();
  });
});

describe('Pila', () => {
  it('tras LXI SP / PUSH B marca SP y muestra los valores', () => {
    load('LXI SP,0F00H\nLXI B,1234H\nPUSH B\nHLT\n');
    render(<Drawer />);
    run();
    pick(/^Pila/);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(8);
    const cur = rows.filter((r) => r.getAttribute('aria-current') === 'true');
    expect(cur).toHaveLength(1);
    expect(cur[0]!.textContent).toMatch(/0EFEh/);
    expect(cur[0]!.textContent).toMatch(/34h/);
    const next = cur[0]!.nextElementSibling!;
    expect(next.textContent).toMatch(/0EFFh/);
    expect(next.textContent).toMatch(/12h/);
    expect(screen.getByText(/crece hacia abajo/i)).toBeTruthy();
  });

  it('SP = 0 muestra la pila vacía', () => {
    load(OUT_PROG);
    render(<Drawer />);
    pick(/^Pila/);
    expect(screen.getByText('La pila está vacía')).toBeTruthy();
  });
});

describe('Puertos E/S', () => {
  const add = (port: string, value: string) => {
    fireEvent.change(screen.getByLabelText('Puerto en hexadecimal'), { target: { value: port } });
    fireEvent.change(screen.getByLabelText('Valor en hexadecimal'), { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
  };

  it('agregar 05 = 7F llega a la máquina y IN lo lee', () => {
    load('IN 05H\nHLT\n');
    render(<Drawer />);
    pick(/^Puertos/);
    add('05', '7F');
    expect(s().machine!.inputs.get(5)).toBe(0x7f);
    expect(s().inputs.get(5)).toBe(0x7f);
    run();
    expect(s().machine!.cpu.A).toBe(0x7f);
    expect(screen.getByRole('table')).toBeTruthy();
  });

  it('puerto 100 muestra error y conserva la tabla', () => {
    load('HLT\n');
    render(<Drawer />);
    pick(/^Puertos/);
    add('05', '7F');
    add('100', '01');
    expect(screen.getByRole('alert').textContent).toMatch(/Puerto fuera de rango/);
    expect(s().inputs.size).toBe(1);
    expect(screen.getAllByRole('button', { name: /^Quitar puerto/ })).toHaveLength(1);
  });

  it('valor inválido muestra error', () => {
    render(<Drawer />);
    pick(/^Puertos/);
    add('05', 'zz');
    expect(screen.getByRole('alert').textContent).toMatch(/hexadecimal/);
    expect(s().inputs.size).toBe(0);
  });

  it('quitar fila', () => {
    render(<Drawer />);
    pick(/^Puertos/);
    add('05', '7F');
    fireEvent.click(screen.getByRole('button', { name: 'Quitar puerto 05h' }));
    expect(s().inputs.size).toBe(0);
  });
});

describe('Interrupciones', () => {
  it('RST 6.5 deja el pendiente en la máquina y lo indica', () => {
    load('NOP\nHLT\n');
    render(<Drawer />);
    pick(/^Interrupciones/);
    const pend = screen.getByRole('list', { name: 'Interrupciones pendientes' });
    const row = () => within(pend).getAllByRole('listitem').find((li) => /RST 6\.5/.test(li.textContent!))!;
    expect(row().textContent).toMatch(/—/);
    fireEvent.click(screen.getByRole('button', { name: 'Generar RST 6.5' }));
    expect(s().machine!.cpu.pending.r65).toBe(true);
    expect(row().textContent).toMatch(/pendiente/);
  });

  it('muestra máscaras e IE con texto', () => {
    load('NOP\nHLT\n');
    render(<Drawer />);
    pick(/^Interrupciones/);
    expect(screen.getAllByText('enmascarada')).toHaveLength(3);
    expect(screen.getByText(/deshabilitadas \(DI\)/)).toBeTruthy();
    expect(screen.getByText(/RST 7\.5 se retiene hasta atenderse/)).toBeTruthy();
  });

  it('botones deshabilitados sin máquina', () => {
    render(<Drawer />);
    pick(/^Interrupciones/);
    for (const n of ['TRAP', 'RST 7.5', 'RST 6.5', 'RST 5.5']) {
      expect((screen.getByRole('button', { name: `Generar ${n}` }) as HTMLButtonElement).disabled).toBe(true);
    }
  });
});

describe('Métricas', () => {
  it('sin máquina invita a ensamblar', () => {
    render(<Drawer />);
    pick(/^Métricas/);
    expect(screen.getByText('Ensamblá para ver las métricas')).toBeTruthy();
  });

  it('muestra tamaño y rango sin comparación la primera vez', () => {
    load('NOP\nHLT\n');
    render(<Drawer />);
    pick(/^Métricas/);
    expect(screen.getByText('2 bytes')).toBeTruthy();
    expect(screen.getByText('2000h–2001h')).toBeTruthy();
    expect(screen.queryByText(/vs\. el ensamblado anterior/)).toBeNull();
  });

  it('ambas versiones corridas hasta HLT: diferencias con signo y palabras', () => {
    load('NOP\nHLT\n');
    run();
    load('HLT\n');
    run();
    render(<Drawer />);
    pick(/^Métricas/);
    expect(screen.getByText(/−1 byte\b/)).toBeTruthy();
    expect(screen.getByText(/−4 estados T/)).toBeTruthy();
    expect(screen.getByText(/−1 instrucción\b/)).toBeTruthy();
    expect(screen.getAllByText(/vs\. versión anterior/).length).toBeGreaterThan(0);
  });

  it('crece: +2 instrucciones y +8 estados T', () => {
    load('HLT\n');
    run();
    load('NOP\nNOP\nHLT\n');
    run();
    render(<Drawer />);
    pick(/^Métricas/);
    expect(screen.getByText(/\+2 instrucciones/)).toBeTruthy();
    expect(screen.getByText(/\+8 estados T/)).toBeTruthy();
    expect(screen.getByText(/\+2 bytes/)).toBeTruthy();
  });

  it('versión anterior nunca corrida: solo bytes y "sin ejecución previa"', () => {
    load('NOP\nHLT\n');
    load('HLT\n');
    run();
    render(<Drawer />);
    pick(/^Métricas/);
    expect(screen.getByText(/−1 byte\b/)).toBeTruthy();
    expect(screen.getAllByText('sin ejecución previa').length).toBeGreaterThan(0);
    expect(screen.queryByText(/estados T vs/)).toBeNull();
    expect(screen.queryByText(/instrucciones? vs/)).toBeNull();
  });

  it('corrida actual a medias: oculta las diferencias de ejecución pero no la de bytes', () => {
    load('HLT\n');
    run();
    load('NOP\nNOP\nHLT\n');
    act(() => s().step());
    render(<Drawer />);
    pick(/^Métricas/);
    expect(screen.getByText(/\+2 bytes/)).toBeTruthy();
    expect(screen.getAllByText(/ejecutando… la comparación aparece al terminar/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/estados T vs/)).toBeNull();
  });
});

describe('Drawer: auto-apertura acotada', () => {
  const collapse = () => fireEvent.click(screen.getByRole('button', { name: 'Plegar cajón' }));
  const expanded = () =>
    screen.getByRole('button', { name: /cajón$/ }).getAttribute('aria-expanded') === 'true';

  it('byte de memoria inválido no abre ni marca', () => {
    load('HLT\n');
    render(<Drawer />);
    pick(/^Pila/);
    collapse();
    act(() => s().setMemoryByte(0x40, 'zz'));
    expect(s().status?.kind).toBe('error');
    expect(expanded()).toBe(false);
    expect(tab(/^Salida/).textContent).not.toMatch(/novedades/);
  });

  it('"Ensamblá primero" no abre ni marca', () => {
    render(<Drawer />);
    pick(/^Pila/);
    collapse();
    act(() => s().step());
    expect(s().status?.text).toMatch(/Ensamblá primero/);
    expect(expanded()).toBe(false);
    expect(tab(/^Salida/).textContent).not.toMatch(/novedades/);
  });

  it('error del ensamblador abre y marca; el mismo error al reensamblar no reaparece', () => {
    render(<Drawer />);
    pick(/^Pila/);
    collapse();
    load('MVI A, A1H\n');
    expect(expanded()).toBe(true);
    expect(tab(/^Salida/).textContent).toMatch(/novedades/);
    pick(/^Salida/);
    pick(/^Pila/);
    collapse();
    act(() => s().assembleActive());
    expect(expanded()).toBe(false);
    expect(tab(/^Salida/).textContent).not.toMatch(/novedades/);
  });

  it('HLT marca Salida', () => {
    load('HLT\n');
    render(<Drawer />);
    pick(/^Pila/);
    run();
    expect(tab(/^Salida/).textContent).toMatch(/novedades/);
  });

  it('elegir una pestaña con el cajón plegado lo despliega (clic y teclado)', () => {
    render(<Drawer />);
    collapse();
    pick(/^Pila/);
    expect(expanded()).toBe(true);
    expect(screen.getByRole('tabpanel').hasAttribute('hidden')).toBe(false);
    collapse();
    fireEvent.keyDown(tab(/^Pila/), { key: 'ArrowRight' });
    expect(expanded()).toBe(true);
    expect(tab(/^Puertos/).getAttribute('aria-selected')).toBe('true');
  });

  it('Home y End en el tablist', () => {
    render(<Drawer />);
    fireEvent.keyDown(tab(/^Salida/), { key: 'End' });
    expect(tab(/^Métricas/).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tab(/^Métricas/), { key: 'Home' });
    expect(tab(/^Salida/).getAttribute('aria-selected')).toBe('true');
  });

  it('el tablist tiene un nombre distinto al de la sección', () => {
    render(<Drawer />);
    expect(screen.getByRole('tablist', { name: 'Paneles del cajón' })).toBeTruthy();
  });
});

describe('Salida: sin duplicados', () => {
  it('el error de ensamblado no se repite bajo Simulador', () => {
    load('MVI A, A1H\n');
    render(<Drawer />);
    expect(screen.getAllByText(/Línea 1: error/)).toHaveLength(1);
  });
});

describe('Pila: vuelta de 16 bits', () => {
  it.each([
    ['0001H', ['FFFFh', '0000h', '0001h']],
    ['0FFFFH', ['FFFDh', 'FFFFh', '0000h', '0004h']],
  ])('SP=%s muestra direcciones envueltas', (sp, addrs) => {
    load(`LXI SP,${sp}\nHLT\n`);
    run();
    render(<Drawer />);
    pick(/^Pila/);
    const text = screen.getByRole('table').textContent!;
    expect(text).not.toMatch(/undefined|NaN/);
    for (const a of addrs) expect(text).toContain(a);
    expect(screen.getAllByRole('row')).toHaveLength(9);
  });
});

describe('Interrupciones: cada botón', () => {
  it.each([
    ['TRAP', 'TRAP'],
    ['RST 7.5', 'RST7.5'],
    ['RST 6.5', 'RST6.5'],
    ['RST 5.5', 'RST5.5'],
  ])('%s llama raise(%s)', (label, irq) => {
    load('NOP\nHLT\n');
    const calls: string[] = [];
    const orig = s().raise;
    defaultSession.setState({ raise: (i) => { calls.push(i); orig(i); } });
    render(<Drawer />);
    pick(/^Interrupciones/);
    fireEvent.click(screen.getByRole('button', { name: `Generar ${label}` }));
    expect(calls).toEqual([irq]);
  });
});

describe('Puertos: foco y ayuda', () => {
  it('tras Quitar el foco pasa al siguiente Quitar o al campo Puerto', () => {
    render(<Drawer />);
    pick(/^Puertos/);
    for (const p of ['01', '02']) {
      fireEvent.change(screen.getByLabelText('Puerto en hexadecimal'), { target: { value: p } });
      fireEvent.change(screen.getByLabelText('Valor en hexadecimal'), { target: { value: '10' } });
      fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Quitar puerto 01h' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quitar puerto 02h' }));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar puerto 02h' }));
    expect(document.activeElement).toBe(screen.getByLabelText('Puerto en hexadecimal'));
  });

  it('los campos indican hexadecimal', () => {
    render(<Drawer />);
    pick(/^Puertos/);
    expect(screen.getByLabelText('Puerto en hexadecimal').getAttribute('placeholder')).toBe('05h');
  });
});

describe('Drawer: initialCollapsed', () => {
  it('arranca plegado y se abre solo al detenerse en HLT', () => {
    render(<Drawer initialCollapsed />);
    expect(screen.getByRole('button', { name: 'Desplegar cajón' }).getAttribute('aria-expanded')).toBe('false');
    act(() => s().assembleActive());
    run();
    expect(screen.getByRole('button', { name: 'Plegar cajón' })).toBeTruthy();
  });
});
