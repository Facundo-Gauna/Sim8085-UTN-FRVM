import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Flags } from './Flags';
import { Registers } from './Registers';
import { defaultSession } from '../state/store';

const INITIAL = defaultSession.getState();
beforeEach(() => defaultSession.setState(INITIAL, true));
afterEach(cleanup);

const s = () => defaultSession.getState();
const stepOnce = () => act(() => s().step());
const cell = (label: RegExp) => screen.getByLabelText(label);

function assembleSample() {
  act(() => s().assembleActive());
}
function loadProgram(text: string) {
  act(() => {
    s().setText(s().activeId, text);
    s().assembleActive();
  });
}

describe('Registers', () => {
  it('tras un paso A cambió (3Ah, clase changed y marcador), B no', () => {
    assembleSample();
    stepOnce();
    render(<Registers />);
    const a = cell(/^A: 3Ah \(cambió desde 00h\)$/);
    expect(a.classList.contains('changed')).toBe(true);
    expect(a.textContent).toContain('3Ah');
    expect(a.querySelector('[aria-hidden="true"]')?.textContent).toBe('•');
    expect(a.getAttribute('title')).toContain('Antes: 00h');
    expect(a.getAttribute('title')).toContain('Hex 3Ah · Dec 58 · Bin 0011 1010 · Con signo 58');
    const b = cell(/^B: 00h$/);
    expect(b.classList.contains('changed')).toBe(false);
    expect(b.textContent).not.toContain('•');
  });

  it('respeta la base dec y bin', () => {
    assembleSample();
    stepOnce();
    const { rerender } = render(<Registers />);
    act(() => s().setBase('dec'));
    rerender(<Registers />);
    expect(cell(/^A: 58/).textContent).toContain('58');
    act(() => s().setBase('bin'));
    expect(cell(/^A: 0011 1010/).textContent).toContain('0011 1010');
  });

  it('PC tras el primer paso es 2003h y M muestra M[HL]', () => {
    assembleSample();
    stepOnce();
    render(<Registers />);
    expect(cell(/^PC: 2003h/).textContent).toContain('2003h');
    const m = cell(/^M: 00h$/);
    expect(m.getAttribute('title')).toBe('M = memoria apuntada por HL (dirección 0000h)');
  });

  it('PC no se marca si no cambió de valor y stepBack mueve el marcador', () => {
    loadProgram('MVI A,0FFH\nINR A\nHLT\n');
    stepOnce();
    render(<Registers />);
    expect(cell(/^A: FFh/).classList.contains('changed')).toBe(true);
    stepOnce();
    expect(cell(/^A: 00h \(cambió desde FFh\)/).classList.contains('changed')).toBe(true);
    act(() => s().stepBack());
    expect(cell(/^A: FFh \(cambió desde 00h\)/).classList.contains('changed')).toBe(true);
  });

  it('sin máquina o con código cambiado muestra — y no lanza', () => {
    const { container, unmount } = render(<Registers />);
    expect(container.textContent).toContain('—');
    unmount();
    assembleSample();
    act(() => s().setText(s().activeId, 'NOP\n'));
    expect(s().stale).toBe(true);
    const r = render(<Registers />);
    expect(r.container.textContent).toContain('—');
    expect(r.container.textContent).not.toContain('3Ah');
  });
});

describe('Flags', () => {
  it('AC lleva data-fuera-catedra y su etiqueta', () => {
    assembleSample();
    const { container } = render(<Flags />);
    const ac = container.querySelector('[data-fuera-catedra]')!;
    expect(ac.textContent).toContain('AC');
    expect(ac.textContent).toContain('FUERA DE CÁTEDRA');
    expect(ac.getAttribute('title')).toBe('AC (acarreo auxiliar) no figura en la plantilla de la cátedra');
  });

  it('marca las banderas que cambiaron según lastChanges', () => {
    loadProgram('MVI A,0FFH\nINR A\nHLT\n');
    stepOnce();
    const { container } = render(<Flags />);
    expect(container.querySelectorAll('.changed')).toHaveLength(0);
    stepOnce();
    const z = cell(/^Z: 1 \(cambió desde 0\)$/);
    expect(z.classList.contains('changed')).toBe(true);
    expect(z.textContent).toContain('•');
    expect(cell(/^AC: 1 \(cambió desde 0\)$/).classList.contains('changed')).toBe(true);
    expect(cell(/^P: 1 \(cambió desde 0\)$/).classList.contains('changed')).toBe(true);
    expect(cell(/^CY: 0$/).classList.contains('changed')).toBe(false);
    act(() => s().stepBack());
    expect(container.querySelectorAll('.changed')).toHaveLength(0);
  });

  it('sin máquina o con código cambiado muestra —', () => {
    const { container, unmount } = render(<Flags />);
    expect(container.textContent).toContain('—');
    unmount();
    assembleSample();
    act(() => s().setText(s().activeId, 'NOP\n'));
    expect(render(<Flags />).container.textContent).toContain('—');
  });
});
