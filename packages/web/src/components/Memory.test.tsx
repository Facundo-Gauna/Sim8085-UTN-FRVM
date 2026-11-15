import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Memory } from './Memory';
import { defaultSession } from '../state/store';

const INITIAL = defaultSession.getState();
beforeEach(() => defaultSession.setState(INITIAL, true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const s = () => defaultSession.getState();
const assembleSample = () => act(() => s().assembleActive());
const gridcell = (label: RegExp) => screen.getByRole('gridcell', { name: label });
const goto = (text: string) => {
  const input = screen.getByLabelText('Ir a') as HTMLInputElement;
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return input;
};
const rowCells = (header: string) => {
  const tr = screen.getByRole('rowheader', { name: header }).closest('tr')!;
  return within(tr).getAllByRole('gridcell').map((c) => c.textContent!.replace('•', ''));
};

describe('Memory', () => {
  it('cabecera 03 MEMORIA y campo Ir a con id', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    expect(screen.getByText('Memoria')).toBeTruthy();
    expect(screen.getByLabelText('Ir a').id).not.toBe('');
  });

  it('Ir a 2000h muestra 3Ah 40h 00h y respeta la base', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    goto('2000h');
    expect(rowCells('2000h').slice(0, 3)).toEqual(['3Ah', '40h', '00h']);
    act(() => s().setBase('dec'));
    expect(rowCells('8192').slice(0, 3)).toEqual(['58', '64', '0']);
    act(() => s().setBase('bin'));
    expect(rowCells('0010 0000 0000 0000')[0]).toBe('0011 1010');
  });

  it('la celda del PC tiene aria-current', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    goto('2000h');
    expect(gridcell(/^2000h: 3Ah/).getAttribute('aria-current')).toBe('true');
    expect(gridcell(/^2001h: 40h/).getAttribute('aria-current')).toBeNull();
  });

  it('editar 0040h con 55 actualiza la celda y userMemory', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^0040h: 3Ah/));
    const input = screen.getByLabelText(/Valor de 0040h/) as HTMLInputElement;
    expect(input.value).toBe('3A');
    fireEvent.change(input, { target: { value: '55' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(gridcell(/^0040h: 55h/).textContent).toContain('55h');
    expect(s().userMemory.get(0x40)).toBe(0x55);
    expect(s().machine!.memory[0x40]).toBe(0x55);
    expect(screen.queryByLabelText(/Valor de 0040h/)).toBeNull();
  });

  it('valor inválido 1FF deja el valor, muestra alerta y mantiene el editor', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^0040h: 3Ah/));
    const input = screen.getByLabelText(/Valor de 0040h/);
    fireEvent.change(input, { target: { value: '1FF' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('alert').textContent).toContain('fuera de rango');
    expect(screen.getByLabelText(/Valor de 0040h/)).toBeTruthy();
    expect(s().userMemory.get(0x40)).toBe(0x3a);
    fireEvent.keyDown(screen.getByLabelText(/Valor de 0040h/), { key: 'Escape' });
    expect(gridcell(/^0040h: 3Ah/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('tras un paso y una edición, machine.canBack es false', () => {
    assembleSample();
    act(() => s().step());
    expect(s().machine!.canBack).toBe(true);
    render(<Memory />);
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^0040h/));
    const input = screen.getByLabelText(/Valor de 0040h/);
    fireEvent.change(input, { target: { value: '01' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(s().machine!.canBack).toBe(false);
    expect(s().status?.text).toMatch(/historial/);
    // La fuente única del aviso es el store: el panel no repite la nota.
    expect(screen.queryByText(/historial/)).toBeNull();
    act(() => s().assembleActive());
    expect(screen.queryByText(/historial/)).toBeNull();
  });

  it('celda cambiada tras el paso STA del ejemplo: 0041h = C5h', () => {
    assembleSample();
    // lastChanges() describe solo el último paso: se detiene en STA, antes de HLT.
    for (let i = 0; i < 3; i++) act(() => s().step());
    render(<Memory />);
    goto('0000h');
    const c = gridcell(/^0041h: C5h \(cambió desde 00h\)$/);
    expect(c.classList.contains('changed')).toBe(true);
    expect(c.textContent).toContain('•');
  });

  it('teclado: ArrowRight mueve el foco, Enter abre editor, Escape cancela', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    const c0 = gridcell(/^0040h/);
    act(() => c0.focus());
    fireEvent.keyDown(c0, { key: 'ArrowRight' });
    const c1 = gridcell(/^0041h/);
    expect(document.activeElement).toBe(c1);
    fireEvent.keyDown(c1, { key: 'Enter' });
    const input = screen.getByLabelText(/Valor de 0041h/);
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByLabelText(/Valor de 0041h/)).toBeNull();
    expect(document.activeElement).toBe(gridcell(/^0041h/));
  });

  it('un solo tab stop entre las celdas', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    const stops = screen.getAllByRole('gridcell').filter((c) => c.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });

  it('Ir a xyz muestra error y conserva la vista y el texto', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    goto('2000h');
    const input = goto('xyz');
    expect(screen.getByRole('alert').textContent).toContain('hexadecimal');
    expect(input.value).toBe('xyz');
    expect(screen.getByRole('rowheader', { name: '2000h' })).toBeTruthy();
  });

  it('botones de fila anterior y siguiente', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    goto('2000h');
    fireEvent.click(screen.getByRole('button', { name: 'Fila siguiente' }));
    expect(screen.queryByRole('rowheader', { name: '2000h' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: '2008h' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fila anterior' }));
    expect(screen.getByRole('rowheader', { name: '2000h' })).toBeTruthy();
  });

  it('Borrar datos cargados vacía userMemory', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar datos cargados' }));
    expect(s().userMemory.size).toBe(0);
    expect(gridcell(/^0040h: 00h/)).toBeTruthy();
  });

  it('sin máquina muestra el estado vacío sin lanzar', () => {
    render(<Memory />);
    goto('0000h');
    expect(screen.getByText('Ensamblá para ver la memoria')).toBeTruthy();
    expect(screen.queryAllByRole('gridcell')).toHaveLength(0);
  });

  it('el editor abierto se cierra al dar un paso', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^0040h/));
    expect(screen.getByLabelText(/Valor de 0040h/)).toBeTruthy();
    act(() => s().step());
    expect(screen.queryByLabelText(/Valor de 0040h/)).toBeNull();
  });

  it('el editor se cierra al re-ensamblar y no reaparece con el borrador viejo', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^0040h/));
    fireEvent.change(screen.getByLabelText(/Valor de 0040h/), { target: { value: '77' } });
    act(() => s().assembleActive());
    expect(screen.queryByLabelText(/Valor de 0040h/)).toBeNull();
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^0040h/));
    expect((screen.getByLabelText(/Valor de 0040h/) as HTMLInputElement).value).toBe('3A');
  });

  it('el editor se cierra cuando el código queda desactualizado', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^0040h/));
    act(() => s().setText(s().activeId, 'NOP'));
    expect(screen.queryByLabelText(/Valor de 0040h/)).toBeNull();
    expect(screen.getByText('Ensamblá para ver la memoria')).toBeTruthy();
  });

  it('Ir a con dirección no alineada enfoca esa celda', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    goto('2003h');
    const c = gridcell(/^2003h/);
    expect(document.activeElement).toBe(c);
    expect(c.tabIndex).toBe(0);
  });

  it('doble clic dentro del editor no reinicia el borrador', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^0040h/));
    const input = screen.getByLabelText(/Valor de 0040h/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });
    fireEvent.doubleClick(input);
    expect((screen.getByLabelText(/Valor de 0040h/) as HTMLInputElement).value).toBe('12');
  });

  it('en dec y bin el editor muestra el sufijo h', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^0040h/));
    expect(document.querySelector('.cell-hint')).toBeNull();
    cleanup();
    act(() => s().setBase('dec'));
    render(<Memory />);
    goto('0000h');
    fireEvent.doubleClick(gridcell(/^64: 58/));
    expect(document.querySelector('.cell-hint')?.textContent).toBe('h');
    expect(screen.getByLabelText(/en hexadecimal/)).toBeTruthy();
  });

  it('las celdas cargadas por el alumno lo dicen en el aria-label', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    expect(gridcell(/^0040h: 3Ah \(cargado por vos\)$/).getAttribute('title')).toBe('Dato cargado por vos');
    expect(gridcell(/^0041h: 00h$/)).toBeTruthy();
  });

  it('modo de 16 columnas con un contenedor ancho', () => {
    let cb: ResizeObserverCallback = () => {};
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(c: ResizeObserverCallback) {
          cb = c;
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    assembleSample();
    render(<Memory />);
    goto('0000h');
    expect(screen.getByRole('rowheader', { name: '0008h' })).toBeTruthy();
    act(() => cb([{ contentRect: { width: 600 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(screen.queryByRole('rowheader', { name: '0008h' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: '0010h' })).toBeTruthy();
    expect(within(screen.getByRole('rowheader', { name: '0040h' }).closest('tr')!).getAllByRole('gridcell')).toHaveLength(16);
  });

  it('fin de memoria: ArrowRight en FFFFh se queda y Fila siguiente se deshabilita', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    goto('FFFFh');
    const c = gridcell(/^FFFFh/);
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(gridcell(/^FFFFh/));
    expect((screen.getByRole('button', { name: 'Fila siguiente' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('rowheader', { name: 'FFF8h' })).toBeTruthy();
  });

  it('F2 abre el editor', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    const c = gridcell(/^0040h/);
    act(() => c.focus());
    fireEvent.keyDown(c, { key: 'F2' });
    expect(screen.getByLabelText(/Valor de 0040h/)).toBeTruthy();
  });

  it('ArrowDown en la última fila desplaza la ventana', () => {
    assembleSample();
    render(<Memory />);
    goto('0000h');
    goto('0078h');
    const c = gridcell(/^0078h/);
    expect(document.activeElement).toBe(c);
    fireEvent.keyDown(c, { key: 'ArrowDown' });
    expect(screen.queryByRole('rowheader', { name: '0000h' })).toBeNull();
    expect(document.activeElement).toBe(gridcell(/^0080h/));
  });

  it('al ensamblar la ventana arranca en el inicio del programa, no en 0000h', () => {
    assembleSample();
    render(<Memory />);
    expect(screen.getAllByRole('rowheader')[0]!.textContent).toBe('2000h');
    expect(screen.queryByRole('rowheader', { name: '0000h' })).toBeNull();
  });

  it('si el alumno movió la ventana, un paso no la mueve; re-ensamblar vuelve al inicio', () => {
    assembleSample();
    render(<Memory />);
    goto('0040h');
    act(() => s().step());
    expect(screen.getAllByRole('rowheader')[0]!.textContent).toBe('0040h');
    act(() => s().assembleActive());
    expect(screen.getAllByRole('rowheader')[0]!.textContent).toBe('2000h');
  });

  it('sin mover la ventana, un paso que saca al PC de la vista la lleva a la fila del PC', () => {
    // JMP lejos: el PC sale de la ventana de 2000h.
    act(() => s().setText(s().activeId, 'JMP 3000H\nORG 3000H\nNOP\nHLT\n'));
    assembleSample();
    render(<Memory />);
    expect(screen.getAllByRole('rowheader')[0]!.textContent).toBe('2000h');
    act(() => s().step());
    expect(s().machine!.cpu.PC).toBe(0x3000);
    expect(screen.getAllByRole('rowheader')[0]!.textContent).toBe('3000h');
  });

  it('los botones de fila también cuentan como mover la ventana', () => {
    act(() => s().setText(s().activeId, 'JMP 3000H\nORG 3000H\nNOP\nHLT\n'));
    assembleSample();
    render(<Memory />);
    fireEvent.click(screen.getByRole('button', { name: 'Fila siguiente' }));
    act(() => s().step());
    expect(screen.getAllByRole('rowheader')[0]!.textContent).toBe('2008h');
  });
});
