import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Now } from './Now';
import { defaultSession } from '../state/store';

const INITIAL = defaultSession.getState();
beforeEach(() => defaultSession.setState(INITIAL, true));
afterEach(cleanup);

const s = () => defaultSession.getState();
const stepOnce = () => act(() => s().step());
function loadProgram(text: string) {
  act(() => {
    s().setText(s().activeId, text);
    s().assembleActive();
  });
}

describe('Now', () => {
  it('antes de ejecutar muestra la línea fuente, el resumen ISA y los estados T', () => {
    act(() => s().assembleActive());
    render(<Now />);
    expect(screen.getByText('LDA 0040H')).toBeTruthy();
    expect(screen.getByText(/Carga el acumulador con el dato de memoria/)).toBeTruthy();
    expect(screen.getByText(/3 bytes · 13 estados T/)).toBeTruthy();
    expect(screen.getByText('PC 2000h')).toBeTruthy();
    expect(screen.getByText('No modifica banderas')).toBeTruthy();
  });

  it('una instrucción condicional muestra los dos tiempos', () => {
    loadProgram('JNZ 2000H\nHLT\n');
    render(<Now />);
    expect(screen.getByText(/7 \/ 10 estados T/)).toBeTruthy();
  });

  it('lista las banderas que puede modificar, con AC marcada', () => {
    loadProgram('ADD B\nCMA\nHLT\n');
    const { container } = render(<Now />);
    expect(container.textContent).toContain('Puede modificar: S, Z, AC, P, CY');
    expect(container.querySelector('[data-fuera-catedra]')?.textContent).toBe('AC');
    stepOnce();
    expect(screen.getByText('No modifica banderas')).toBeTruthy();
  });

  it('con el código cambiado avisa y no muestra la instrucción', () => {
    loadProgram('MVI A,5\nHLT\n');
    act(() => s().setText(s().activeId, 'MVI A,5\nHLT\n'));
    render(<Now />);
    expect(screen.getByText('El código cambió: volvé a ensamblar')).toBeTruthy();
  });

  it('al llegar a HLT muestra el cartel de programa detenido', () => {
    act(() => s().assembleActive());
    for (let i = 0; i < 4; i++) stepOnce();
    render(<Now />);
    expect(screen.getByText('Programa detenido en HLT')).toBeTruthy();
    expect(screen.getByText('Probá Atrás para revisar cada paso')).toBeTruthy();
  });

  it('sin máquina invita a ensamblar', () => {
    render(<Now />);
    expect(screen.getByText('Ensamblá el código (F5) para empezar')).toBeTruthy();
  });

  it('un opcode inválido muestra el error', () => {
    loadProgram('DB 08H\n');
    const { container } = render(<Now />);
    expect(container.textContent).toMatch(/inválid/i);
  });
});
