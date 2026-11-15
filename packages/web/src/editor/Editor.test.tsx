import { act, cleanup, render } from '@testing-library/react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { indentLess, undo } from '@codemirror/commands';
import { buildExtensions, Editor, externalSync, insertTabSpaces } from './Editor';
import { decorationSpecs } from './decorations';
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

/** Estado inicial de la sesión por defecto: cada prueba arranca desde acá. */
const INITIAL = defaultSession.getState();
beforeEach(() => defaultSession.setState(INITIAL, true));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const key = (view: EditorView, k: string, keyCode: number, extra: KeyboardEventInit = {}) =>
  view.contentDOM.dispatchEvent(new KeyboardEvent('keydown', { key: k, keyCode, bubbles: true, cancelable: true, ...extra }));

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

  it('una ráfaga de cambios no se pisa con un texto viejo del store', () => {
    const file = activeFile();
    const { container } = render(<Editor fileId={file.id} fontSize={16} />);
    const view = viewIn(container);
    act(() => {
      view.dispatch({ changes: { from: 0, insert: 'A' } });
      view.dispatch({ changes: { from: 1, insert: 'B' } });
      view.dispatch({ changes: { from: 2, insert: 'C' } });
    });
    expect(view.state.doc.toString()).toBe(`ABC${SAMPLE.text}`);
    expect(activeFile().text).toBe(`ABC${SAMPLE.text}`);
  });

  it('deshacer no pasa de un archivo a otro', () => {
    const a = activeFile();
    act(() => defaultSession.getState().openFile('b.asm', 'HLT\n'));
    const b = activeFile();
    const { container, rerender } = render(<Editor fileId={a.id} fontSize={16} />);
    act(() => viewIn(container).dispatch({ changes: { from: 0, insert: 'NOP\n' } }));
    rerender(<Editor fileId={b.id} fontSize={16} />);
    const vb = viewIn(container);
    expect(undo(vb)).toBe(false);
    expect(vb.state.doc.toString()).toBe('HLT\n');
    expect(defaultSession.getState().files.find((f) => f.id === b.id)!.text).toBe('HLT\n');
  });

  it('un cambio externo del store no se puede deshacer', () => {
    const file = activeFile();
    const { container } = render(<Editor fileId={file.id} fontSize={16} />);
    const view = viewIn(container);
    act(() => defaultSession.setState({
      files: defaultSession.getState().files.map((f) => (f.id === file.id ? { ...f, text: 'HLT\n' } : f)),
    }));
    expect(undo(view)).toBe(false);
    expect(view.state.doc.toString()).toBe('HLT\n');
  });

  it('Escape y luego Tab no inserta espacios (Tab queda para mover el foco)', () => {
    const file = activeFile();
    const { container } = render(<Editor fileId={file.id} fontSize={16} />);
    const view = viewIn(container);
    act(() => view.dispatch({ selection: { anchor: 0 } }));
    // Sin Escape, Tab lo toma el editor.
    key(view, 'Tab', 9);
    expect(view.state.doc.toString()).toBe(' '.repeat(8) + SAMPLE.text);
    // Escape activa el modo "Tab mueve el foco" de CodeMirror: el Tab no se consume.
    key(view, 'Escape', 27);
    const tab = new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, bubbles: true, cancelable: true });
    view.contentDOM.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false); // el navegador mueve el foco (jsdom no lo hace)
    expect(view.state.doc.toString()).toBe(' '.repeat(8) + SAMPLE.text);
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

  it('Tab con selección indenta 8 espacios y Shift-Tab desindenta', () => {
    const { view } = mount('MOV A, B\nHLT');
    view.dispatch({ selection: { anchor: 0, head: 12 } });
    expect(insertTabSpaces(view)).toBe(true);
    expect(view.state.doc.toString()).toBe(`${' '.repeat(8)}MOV A, B\n${' '.repeat(8)}HLT`);
    expect(indentLess(view)).toBe(true);
    expect(view.state.doc.toString()).toBe('MOV A, B\nHLT');
    view.destroy();
  });

  it('Shift-Tab está ligado a desindentar', () => {
    const { view } = mount('        HLT');
    view.dispatch({ selection: { anchor: 9 } });
    view.contentDOM.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', keyCode: 9, shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(view.state.doc.toString()).toBe('HLT');
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

describe('Editor: depuración', () => {
  const mountSample = () => {
    const file = activeFile();
    const r = render(<Editor fileId={file.id} fontSize={16} />);
    return { ...r, view: viewIn(r.container), file };
  };
  const specs = (view: EditorView) => decorationSpecs(view.state);
  const s = () => defaultSession.getState();

  it('la línea actual sigue al PC y se oculta con stale', () => {
    const { container, view, file } = mountSample();
    expect(specs(view).some((d) => d.kind === 'current')).toBe(false);
    act(() => s().assembleActive());
    expect(specs(view)).toContainEqual({ kind: 'current', line: 2 }); // línea 2 = LDA (la 1 es comentario)
    expect(container.querySelector('.cm-sim-current')?.textContent).toContain('LDA');
    expect(container.querySelector('.cm-sim-pc-marker')?.textContent).toBe('▶');
    act(() => s().step());
    expect(specs(view)).toContainEqual({ kind: 'current', line: 3 });
    expect(container.querySelector('.cm-sim-current')?.textContent).toContain('CMA');
    act(() => s().setText(file.id, `${SAMPLE.text}NOP\n`));
    expect(s().stale).toBe(true);
    expect(specs(view).some((d) => d.kind === 'current')).toBe(false);
    expect(container.querySelector('.cm-sim-current')).toBeNull();
  });

  it('el punto de corte aparece al alternarlo y se oculta con stale', () => {
    const { container, view, file } = mountSample();
    act(() => s().assembleActive());
    act(() => s().toggleBreakpoint(3));
    expect(specs(view)).toContainEqual({ kind: 'breakpoint', line: 3 });
    const dot = container.querySelector('.cm-sim-bp');
    expect(dot?.getAttribute('aria-label')).toBe('Punto de corte');
    act(() => s().setText(file.id, `${SAMPLE.text}NOP\n`));
    expect(specs(view).some((d) => d.kind === 'breakpoint')).toBe(false);
    expect(container.querySelector('.cm-sim-bp')).toBeNull();
  });

  it('una línea sin instrucción no recibe punto de corte (el núcleo lo rechaza)', () => {
    const { view } = mountSample();
    act(() => s().assembleActive());
    act(() => s().toggleBreakpoint(1)); // comentario
    expect(specs(view).some((d) => d.kind === 'breakpoint')).toBe(false);
  });

  it('el clic en el margen llama a toggleBreakpoint', () => {
    const toggle = vi.fn();
    const view = new EditorView({
      state: EditorState.create({ doc: 'NOP\nHLT\n', extensions: buildExtensions({ onChange: vi.fn(), onToggleBreakpoint: toggle }) }),
    });
    document.body.appendChild(view.dom);
    view.dispatch({ selection: { anchor: 4 } });
    // F9 alterna el punto de corte de la línea del cursor.
    key(view, 'F9', 120);
    expect(toggle).toHaveBeenCalledWith(2);
    // jsdom no mide alturas: el clic cae en el primer bloque (línea 1).
    const cell = view.dom.querySelector('.cm-sim-bp-gutter .cm-gutterElement:not(.cm-sim-spacer)');
    expect(cell).not.toBeNull();
    cell!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY: 1 }));
    expect(toggle).toHaveBeenLastCalledWith(1);
    view.destroy();
  });

  it('errores del ensamblado subrayados con el mensaje en el title', () => {
    const file = activeFile();
    act(() => s().setText(file.id, 'MVI A, A1H\nHLT\n'));
    const { container, view } = mountSample();
    act(() => s().assembleActive());
    const err = specs(view).find((d) => d.kind === 'error');
    expect(err).toMatchObject({ line: 1 });
    const mark = container.querySelector('.cm-sim-error');
    expect(mark?.getAttribute('title')).toMatch(/0A1H/);
    act(() => s().setText(file.id, 'MVI A, 0A1H\nHLT\n'));
    expect(container.querySelector('.cm-sim-error')).toBeNull();
  });

  it('contador NN/80 con ícono en comentarios largos, sin ensamblar', () => {
    const file = activeFile();
    act(() => s().setText(file.id, `NOP ; ${'x'.repeat(81)}\nNOP ; ${'y'.repeat(80)}\n`));
    const { container } = mountSample();
    const counters = container.querySelectorAll('.cm-sim-count');
    expect(counters).toHaveLength(1);
    expect(counters[0]!.textContent).toContain('81/80');
    expect(counters[0]!.textContent).toContain('⚠');
  });
});

describe('Editor: fix ronda 1', () => {
  const s = () => defaultSession.getState();
  const mount = () => {
    const file = activeFile();
    const r = render(<Editor fileId={file.id} fontSize={16} />);
    return { ...r, view: viewIn(r.container), file };
  };

  it('el punto de corte sigue a su instrucción al insertar una línea arriba', () => {
    const { view, container } = mount();
    act(() => s().assembleActive());
    act(() => s().toggleBreakpoint(3)); // CMA
    act(() => view.dispatch({ changes: { from: view.state.doc.line(2).from, insert: '        NOP\n' } }));
    expect(s().breakpointLines).toEqual(new Set([4]));
    act(() => s().assembleActive());
    expect(s().breakpointLines).toEqual(new Set([4]));
    expect(decorationSpecs(view.state)).toContainEqual({ kind: 'breakpoint', line: 4 });
    expect(container.querySelectorAll('.cm-sim-bp')).toHaveLength(1);
  });

  it('un cambio externo (sync del store) no remapea', () => {
    const { file } = mount();
    act(() => s().setBreakpointLines(new Set([3])));
    act(() => defaultSession.setState({
      files: s().files.map((f) => (f.id === file.id ? { ...f, text: `NOP\n${f.text}` } : f)),
    }));
    expect(s().breakpointLines).toEqual(new Set([3]));
  });

  it('un cambio sin efecto en los puntos de corte no publica un conjunto nuevo', () => {
    const { view } = mount();
    act(() => s().setBreakpointLines(new Set([3])));
    const spy = vi.spyOn(s(), 'setBreakpointLines');
    act(() => view.dispatch({ changes: { from: view.state.doc.line(5).to, insert: ' ' } }));
    expect(spy).not.toHaveBeenCalled();
  });

  it('tras HLT el PC sobre un DB no muestra línea actual', () => {
    const file = activeFile();
    act(() => s().setText(file.id, 'HLT\nDB 5\n'));
    const { view } = mount();
    act(() => s().assembleActive());
    expect(decorationSpecs(view.state)).toContainEqual({ kind: 'current', line: 1 });
    act(() => s().step());
    expect(s().machine!.cpu.halted).toBe(true);
    expect(decorationSpecs(view.state).some((d) => d.kind === 'current')).toBe(false);
  });
});
