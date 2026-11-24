import { act, cleanup, render } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { addressLabels } from './addresses';
import { Editor } from './Editor';
import { defaultSession } from '../state/store';

const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = emptyRects;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);

describe('addressLabels', () => {
  const of = (src: string, start = 0x2000) => [...addressLabels(src, start)];

  it('avanza según el tamaño de cada instrucción (3, 2, 1 bytes)', () => {
    expect(of('LXI H, 3000H\nMVI C, 08H\nMOV A, M\nINX H')).toEqual([
      [1, '2000'], [2, '2003'], [3, '2005'], [4, '2006'],
    ]);
  });

  it('deja en blanco comentarios, vacías, solo etiqueta, EQU, ORG y DS', () => {
    const src = '; hola\n\nN EQU 5\nORG 100H\nLAZO:\nDCR C\nDS 4\nJNZ LAZO\nDB 1, 2\nHLT';
    expect(of(src)).toEqual([[6, '0100'], [8, '0105'], [9, '0108'], [10, '010A']]);
  });

  it('una línea mal escrita queda en blanco y no rompe el resto', () => {
    expect(of('NOP\nXYZ\nNOP')).toEqual([[1, '2000'], [3, '2001']]);
  });

  it('una llamada a macro muestra la dirección de su primera instrucción', () => {
    const src = 'DOS MACRO\nNOP\nNOP\nENDM\nNOP\nDOS\nHLT';
    expect(of(src)).toEqual([[5, '2000'], [6, '2001'], [7, '2003']]);
  });
});

describe('columna de direcciones en el editor', () => {
  const INITIAL = defaultSession.getState();
  beforeEach(() => defaultSession.setState(INITIAL, true));
  afterEach(cleanup);

  const shown = (c: HTMLElement) =>
    [...c.querySelectorAll('.cm-sim-addr-gutter .cm-sim-addr')].map((e) => e.textContent);
  const mount = (text: string) => {
    const id = defaultSession.getState().activeId;
    defaultSession.getState().setText(id, text);
    const { container } = render(<Editor fileId={id} fontSize={16} />);
    const view = EditorView.findFromDOM(container.querySelector<HTMLElement>('.cm-editor')!)!;
    return { container, view };
  };

  it('se actualiza al escribir, sin ensamblar', () => {
    const { container, view } = mount('LDA 0040H\nHLT');
    expect(shown(container)).toEqual(['2000', '2003']);
    act(() => view.dispatch({ changes: { from: 0, insert: 'NOP\n' } }));
    expect(shown(container)).toEqual(['2000', '2001', '2004']);
  });

  it('sigue a la dirección de inicio de la sesión', () => {
    const { container } = mount('LDA 0040H\nHLT');
    act(() => defaultSession.getState().setStartAddress('1000'));
    expect(shown(container)).toEqual(['1000', '1003']);
  });
});
