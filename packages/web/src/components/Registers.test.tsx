import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
/** Pasa el mouse por el elemento y devuelve el texto del cartel de ayuda. */
const tip = (el: HTMLElement) => {
  fireEvent.mouseEnter(el);
  return screen.getByRole('tooltip').textContent ?? '';
};

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
    const t = tip(a);
    expect(t).toContain('Acumulador');
    expect(t).toContain('Antes: 00h');
    expect(t).toContain('Hex 3Ah · Dec 58 · Bin 0011 1010 · Con signo 58');
    const b = cell(/^B: 00h$/);
    expect(b.classList.contains('changed')).toBe(false);
    expect(b.textContent).not.toContain('•');
  });

  it('respeta la base dec y bin', () => {
    assembleSample();
    stepOnce();
    render(<Registers />);
    act(() => s().setBase('dec'));
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
    const t = tip(m);
    expect(t).toContain('Memoria apuntada por HL');
    expect(t).toContain('HL apunta a la dirección 0000h');
  });

  it('PC se marca en un paso normal y no si el salto cae en sí mismo', () => {
    assembleSample();
    stepOnce();
    const { unmount } = render(<Registers />);
    expect(cell(/^PC: 2003h \(cambió desde 2000h\)$/).classList.contains('changed')).toBe(true);
    unmount();
    loadProgram('LP: JMP LP\n');
    stepOnce();
    render(<Registers />);
    expect(cell(/^PC: 2000h$/).classList.contains('changed')).toBe(false);
  });

  it('stepBack mueve el marcador de A', () => {
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

describe('Registers: M', () => {
  const run = (text: string, steps: number) => {
    act(() => s().clearUserMemory());
    loadProgram(text);
    for (let i = 0; i < steps; i++) stepOnce();
  };

  it('MOV M,A escribe en M[HL]: 55h cambió desde 00h', () => {
    run('LXI H,0040H\nMVI A,55H\nMOV M,A\nHLT\n', 3);
    render(<Registers />);
    const m = cell(/^M: 55h \(cambió desde 00h\)$/);
    expect(m.classList.contains('changed')).toBe(true);
    expect(m.textContent).toContain('•');
    expect(tip(m)).toContain('Antes: 00h');
  });

  it('INR M cambia el byte apuntado', () => {
    run('LXI H,0040H\nINR M\nHLT\n', 2);
    render(<Registers />);
    expect(cell(/^M: 01h \(cambió desde 00h\)$/).classList.contains('changed')).toBe(true);
  });

  it('si HL cambia y el byte apuntado difiere, M cambió; stepBack lo revierte', () => {
    run('LXI H,0040H\nHLT\n', 0);
    act(() => s().setMemoryByte(0x40, '3A'));
    stepOnce();
    render(<Registers />);
    const m = cell(/^M: 3Ah \(cambió desde 00h\)$/);
    expect(m.classList.contains('changed')).toBe(true);
    act(() => s().stepBack());
    expect(cell(/^M: 00h$/).classList.contains('changed')).toBe(false);
  });

  it('si HL cambia pero el byte es igual, M no cambió', () => {
    run('LXI H,0050H\nHLT\n', 1);
    render(<Registers />);
    expect(cell(/^M: 00h$/).classList.contains('changed')).toBe(false);
  });
});

describe('Flags', () => {
  it('AC lleva data-fuera-catedra y su etiqueta', () => {
    assembleSample();
    const { container } = render(<Flags />);
    const ac = container.querySelector('[data-fuera-catedra]')!;
    expect(ac.textContent).toContain('AC');
    expect(ac.textContent).toContain('FUERA DE CÁTEDRA');
    const t = tip(ac as HTMLElement);
    expect(t).toContain('Acarreo auxiliar');
    expect(t).toContain('no figura en la plantilla de la cátedra');
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

describe('Carteles de ayuda', () => {
  it('cada registro, PC, SP, M y cada bandera explican qué son', () => {
    assembleSample();
    const { container } = render(
      <>
        <Registers />
        <Flags />
      </>,
    );
    const expected: Array<[RegExp, string]> = [
      [/^PC: /, 'Contador de programa'],
      [/^SP: /, 'Puntero de pila'],
      [/^M: /, 'Memoria apuntada por HL'],
      [/^H: /, 'par HL'],
      [/^S: /, 'Signo'],
      [/^Z: /, 'Cero'],
      [/^P: /, 'Paridad'],
      [/^CY: /, 'Acarreo'],
    ];
    for (const [label, text] of expected) {
      expect(tip(cell(label))).toContain(text);
      fireEvent.mouseLeave(cell(label));
      expect(screen.queryByRole('tooltip')).toBeNull();
    }
    expect(container.querySelectorAll('[tabindex="0"]').length).toBeGreaterThanOrEqual(15);
  });
});
