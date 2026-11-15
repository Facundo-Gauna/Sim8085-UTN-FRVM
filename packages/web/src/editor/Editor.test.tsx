import { act, render } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { undo } from '@codemirror/commands';
import { buildExtensions, Editor, externalSync, insertTabSpaces } from './Editor';
import { defaultSession, SAMPLE } from '../state/store';

/** Vista de CodeMirror montada dentro del contenedor (API pública de CM). */
const viewIn = (container: HTMLElement): EditorView => {
  const el = container.querySelector('.cm-editor');
  if (!(el instanceof HTMLElement)) throw new Error('sin .cm-editor');
  const view = EditorView.findFromDOM(el);
  if (!view) throw new Error('sin EditorView');
  return view;
};

const activeFile = () => {
  const s = defaultSession.getState();
  return s.files.find((f) => f.id === s.activeId)!;
};

// jsdom no mide texto: CodeMirror pide rectángulos de Range al medir la vista.
const emptyRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
const zeroRect = () => new DOMRect(0, 0, 0, 0);
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = emptyRects;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = zeroRect;

afterEach(() => vi.restoreAllMocks());

describe('Editor', () => {
  it('muestra el texto del archivo y colorea el mnemónico', () => {
    const file = activeFile();
    const { container } = render(<Editor fileId={file.id} fontSize={16} />);
    const content = container.querySelector('.cm-content');
    expect(content?.textContent).toContain('LDA 0040H');
    expect(viewIn(container).state.doc.toString()).toBe(SAMPLE.text);
    expect(container.querySelector('.cm-asm-mnemonic')?.textContent).toBe('LDA');
    expect(container.querySelector('.cm-asm-comment')).not.toBeNull();
  });

  it('un cambio en el editor llama a setText del store', () => {
    const file = activeFile();
    const spy = vi.spyOn(defaultSession.getState(), 'setText');
    // setText se lee del store en cada cambio: espiar sobre el estado actual alcanza.
    const { container } = render(<Editor fileId={file.id} fontSize={16} />);
    const view = viewIn(container);
    act(() => view.dispatch({ changes: { from: 0, insert: 'NOP\n' } }));
    expect(spy).toHaveBeenCalledWith(file.id, `NOP\n${SAMPLE.text}`);
    expect(activeFile().text).toBe(`NOP\n${SAMPLE.text}`);
  });

  it('un cambio de texto desde afuera actualiza el documento sin volver a llamar setText', () => {
    const file = activeFile();
    const { container } = render(<Editor fileId={file.id} fontSize={16} />);
    const view = viewIn(container);
    const spy = vi.spyOn(defaultSession.getState(), 'setText');
    act(() => defaultSession.setState({
      files: defaultSession.getState().files.map((f) => (f.id === file.id ? { ...f, text: 'HLT\n' } : f)),
    }));
    expect(view.state.doc.toString()).toBe('HLT\n');
    expect(spy).not.toHaveBeenCalled();
  });

  it('al cambiar de fileId recrea la vista con el texto del otro archivo', () => {
    const first = activeFile();
    act(() => defaultSession.getState().openFile('otro.asm', 'MVI A, 5\n'));
    const second = activeFile();
    const { container, rerender } = render(<Editor fileId={first.id} fontSize={16} />);
    const v1 = viewIn(container);
    rerender(<Editor fileId={second.id} fontSize={16} />);
    const v2 = viewIn(container);
    expect(v2).not.toBe(v1);
    expect(v2.state.doc.toString()).toBe('MVI A, 5\n');
  });

  it('el tamaño de fuente se acota a 14–20 px', () => {
    const file = activeFile();
    const { container, rerender } = render(<Editor fileId={file.id} fontSize={30} />);
    const host = container.firstElementChild as HTMLElement;
    expect(host.style.getPropertyValue('--editor-font-size')).toBe('20px');
    rerender(<Editor fileId={file.id} fontSize={10} />);
    expect(host.style.getPropertyValue('--editor-font-size')).toBe('14px');
  });
});

describe('buildExtensions', () => {
  const mount = (doc: string) => {
    const onChange = vi.fn();
    const view = new EditorView({ state: EditorState.create({ doc, extensions: buildExtensions({ onChange }) }) });
    return { view, onChange };
  };

  it('tab de 8 columnas: inserta espacios hasta la próxima parada', () => {
    const { view, onChange } = mount('MOV A, B');
    expect(view.state.facet(EditorState.tabSize)).toBe(8);
    view.dispatch({ selection: { anchor: 3 } });
    expect(insertTabSpaces(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('MOV      A, B'); // 3 + 5 = columna 8
    expect(view.state.selection.main.head).toBe(8);
    view.dispatch({ selection: { anchor: 0 } });
    insertTabSpaces(view);
    expect(view.state.doc.toString().startsWith(' '.repeat(8) + 'MOV')).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith(view.state.doc.toString());
    view.destroy();
  });

  it('deshacer revierte el cambio (historial incluido)', () => {
    const { view } = mount('HLT');
    view.dispatch({ changes: { from: 0, insert: 'NOP\n' } });
    expect(undo(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('HLT');
    view.destroy();
  });

  it('las transacciones externalSync no llaman onChange', () => {
    const { view, onChange } = mount('HLT');
    view.dispatch({ changes: { from: 0, to: 3, insert: 'NOP' }, annotations: externalSync.of(true) });
    expect(onChange).not.toHaveBeenCalled();
    view.dispatch({ changes: { from: 0, insert: ';' } });
    expect(onChange).toHaveBeenCalledWith(';NOP');
    view.destroy();
  });
});
