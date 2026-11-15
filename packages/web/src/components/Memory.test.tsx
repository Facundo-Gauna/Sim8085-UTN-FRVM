import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Memory } from './Memory';
import { defaultSession } from '../state/store';

const INITIAL = defaultSession.getState();
beforeEach(() => defaultSession.setState(INITIAL, true));
afterEach(cleanup);

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
    expect(screen.getByText('Memoria')).toBeTruthy();
    expect(screen.getByLabelText('Ir a').id).not.toBe('');
  });

  it('Ir a 2000h muestra 3Ah 40h 00h y respeta la base', () => {
    assembleSample();
    render(<Memory />);
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
    goto('2000h');
    expect(gridcell(/^2000h: 3Ah/).getAttribute('aria-current')).toBe('true');
    expect(gridcell(/^2001h: 40h/).getAttribute('aria-current')).toBeNull();
  });

  it('editar 0040h con 55 actualiza la celda y userMemory', () => {
    assembleSample();
    render(<Memory />);
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
    fireEvent.doubleClick(gridcell(/^0040h/));
    const input = screen.getByLabelText(/Valor de 0040h/);
    fireEvent.change(input, { target: { value: '01' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(s().machine!.canBack).toBe(false);
    expect(screen.getByText(/historial de pasos/)).toBeTruthy();
  });

  it('celda cambiada tras el paso STA del ejemplo: 0041h = C5h', () => {
    assembleSample();
    // lastChanges() describe solo el último paso: se detiene en STA, antes de HLT.
    for (let i = 0; i < 3; i++) act(() => s().step());
    render(<Memory />);
    const c = gridcell(/^0041h: C5h \(cambió desde 00h\)$/);
    expect(c.classList.contains('changed')).toBe(true);
    expect(c.textContent).toContain('•');
  });

  it('teclado: ArrowRight mueve el foco, Enter abre editor, Escape cancela', () => {
    assembleSample();
    render(<Memory />);
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
    const stops = screen.getAllByRole('gridcell').filter((c) => c.tabIndex === 0);
    expect(stops).toHaveLength(1);
  });

  it('Ir a xyz muestra error y conserva la vista y el texto', () => {
    assembleSample();
    render(<Memory />);
    goto('2000h');
    const input = goto('xyz');
    expect(screen.getByRole('alert').textContent).toContain('hexadecimal');
    expect(input.value).toBe('xyz');
    expect(screen.getByRole('rowheader', { name: '2000h' })).toBeTruthy();
  });

  it('botones de fila anterior y siguiente', () => {
    assembleSample();
    render(<Memory />);
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
    fireEvent.click(screen.getByRole('button', { name: 'Borrar datos cargados' }));
    expect(s().userMemory.size).toBe(0);
    expect(gridcell(/^0040h: 00h/)).toBeTruthy();
  });

  it('sin máquina muestra el estado vacío sin lanzar', () => {
    render(<Memory />);
    expect(screen.getByText('Ensamblá para ver la memoria')).toBeTruthy();
    expect(screen.queryAllByRole('gridcell')).toHaveLength(0);
  });
});
