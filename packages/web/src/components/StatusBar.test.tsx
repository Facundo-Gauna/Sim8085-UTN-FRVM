import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Change } from '@sim8085/core';
import { Announcer, sentence } from './Announcer';
import { StatusBar } from './StatusBar';
import { defaultSession } from '../state/store';

const INITIAL = defaultSession.getState();
beforeEach(() => defaultSession.setState(INITIAL, true));
afterEach(cleanup);

const s = () => defaultSession.getState();
const stepOnce = () => act(() => s().step());

describe('StatusBar', () => {
  it('BIN cambia la base y queda aria-pressed', () => {
    render(<StatusBar />);
    const group = screen.getByRole('group', { name: 'Base numérica' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('button', { name: 'HEX' }).getAttribute('aria-pressed')).toBe('true');
    act(() => screen.getByRole('button', { name: 'BIN' }).click());
    expect(s().base).toBe('bin');
    expect(screen.getByRole('button', { name: 'BIN' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'HEX' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('cuenta líneas y bytes', () => {
    act(() => s().assembleActive());
    render(<StatusBar />);
    expect(screen.getByText('5 líneas · 8 bytes')).toBeTruthy();
  });

  it('el estado pasa de Listo a En pausa a Detenido (HLT) y cuenta estados T', () => {
    act(() => s().assembleActive());
    render(<StatusBar />);
    expect(screen.getByText('Listo · PC 2000h')).toBeTruthy();
    expect(screen.getByText('0 estados T')).toBeTruthy();
    stepOnce();
    expect(screen.getByText('En pausa · PC 2003h')).toBeTruthy();
    expect(screen.getByText('13 estados T')).toBeTruthy();
    for (let i = 0; i < 3; i++) stepOnce();
    expect(screen.getAllByText('Detenido (HLT)').length).toBeGreaterThan(0);
  });

  it('código cambiado muestra Código desactualizado', () => {
    act(() => s().assembleActive());
    act(() => s().setText(s().activeId, 'NOP\n'));
    render(<StatusBar />);
    expect(screen.getByText('Código desactualizado')).toBeTruthy();
  });

  it('el mensaje usa role status (info) o alert (error) y title con el texto', () => {
    act(() => s().assembleActive());
    const { unmount } = render(<StatusBar />);
    const info = screen.getByRole('status');
    expect(info.textContent).toMatch(/^Ensamblado correcto/);
    expect(info.getAttribute('title')).toBe(s().status!.text);
    unmount();
    act(() => s().toggleBreakpoint(1));
    render(<StatusBar />);
    expect(screen.getByRole('alert').textContent).toBe(s().status!.text);
  });
});

describe('Announcer', () => {
  const region = (c: HTMLElement) => c.querySelector('[aria-live="polite"]')!;

  it('anuncia los cambios del primer paso en la base actual', () => {
    act(() => s().assembleActive());
    const { container } = render(<Announcer />);
    expect(region(container).getAttribute('aria-atomic')).toBe('false');
    expect(region(container).textContent).toBe('');
    stepOnce();
    expect(region(container).textContent).toBe('A cambió de 00h a 3Ah. PC cambió de 2000h a 2003h.');
  });

  it('respeta la base dec', () => {
    act(() => s().assembleActive());
    act(() => s().setBase('dec'));
    const { container } = render(<Announcer />);
    stepOnce();
    expect(region(container).textContent).toContain('A cambió de 0 a 58');
  });

  it('no anuncia nada si no hubo cambios', () => {
    act(() => s().assembleActive());
    const { container } = render(<Announcer />);
    act(() => s().stepBack());
    expect(region(container).textContent).toBe('');
  });

  it('se vacía con el código desactualizado', () => {
    act(() => s().assembleActive());
    const { container } = render(<Announcer />);
    stepOnce();
    expect(region(container).textContent).not.toBe('');
    act(() => s().setText(s().activeId, 'NOP\n'));
    expect(region(container).textContent).toBe('');
  });

  it('limita a 6 cambios, con el PC al final del resumen', () => {
    const changes: Change[] = [
      { kind: 'reg', name: 'PC', before: 0x2000, after: 0x2001 },
      ...(['A', 'B', 'C', 'D', 'E', 'H'] as const).map((name) => ({ kind: 'reg' as const, name, before: 0, after: 1 })),
      { kind: 'flag', name: 'Z', before: 0, after: 1 },
    ];
    const t = sentence(changes, 'hex');
    expect(t).toBe(
      'A cambió de 00h a 01h. B cambió de 00h a 01h. C cambió de 00h a 01h. D cambió de 00h a 01h. ' +
        'E cambió de 00h a 01h. H cambió de 00h a 01h. Y 2 cambios más.',
    );
  });
});
