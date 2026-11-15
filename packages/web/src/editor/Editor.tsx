/**
 * Editor de código (CodeMirror 6) sincronizado con la sesión.
 *
 * Tab inserta espacios (hasta la próxima parada de 8 columnas). Para salir
 * del editor con el teclado: Escape y luego Tab (o Ctrl-M).
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { Annotation, EditorSelection, EditorState, Transaction, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  type Command,
} from '@codemirror/view';
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentLess,
  indentMore,
} from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { defaultSession, useSession } from '../state/store';
import { asmLanguage } from './asmLanguage';
import { editorTheme } from './editorTheme';
import './Editor.css';

export const TAB_WIDTH = 8;
const FONT_MIN = 14;
const FONT_MAX = 20;

/** Marca las transacciones que vienen del store (no se vuelven a publicar). */
export const externalSync = Annotation.define<boolean>();

/** Tab: espacios hasta la próxima parada de 8 columnas; con selección, indenta. */
export const insertTabSpaces: Command = (view) => {
  const { state } = view;
  if (state.selection.ranges.some((r) => !r.empty)) return indentMore(view);
  view.dispatch(
    state.changeByRange((range) => {
      const line = state.doc.lineAt(range.head);
      const col = range.head - line.from;
      const spaces = ' '.repeat(TAB_WIDTH - (col % TAB_WIDTH));
      return {
        changes: { from: range.head, insert: spaces },
        range: EditorSelection.cursor(range.head + spaces.length),
      };
    }),
    { scrollIntoView: true, userEvent: 'input' },
  );
  return true;
};

export interface EditorExtensionOptions {
  /** Texto completo tras cada cambio hecho en el editor (no los de `externalSync`). */
  onChange: (text: string) => void;
}

/** Todas las extensiones del editor en un solo lugar (Task 6 suma las suyas acá). */
export function buildExtensions(opts: EditorExtensionOptions): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    drawSelection(),
    EditorState.tabSize.of(TAB_WIDTH),
    indentUnit.of(' '.repeat(TAB_WIDTH)),
    keymap.of([
      { key: 'Tab', run: insertTabSpaces, shift: indentLess },
      ...defaultKeymap,
      ...historyKeymap,
    ]),
    asmLanguage,
    editorTheme,
    EditorView.contentAttributes.of({ 'aria-label': 'Editor de código ensamblador' }),
    EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      if (u.transactions.every((tr) => tr.annotation(externalSync))) return;
      opts.onChange(u.state.doc.toString());
    }),
  ];
}

const textOf = (fileId: string) => defaultSession.getState().files.find((f) => f.id === fileId)?.text ?? '';

export function Editor({ fileId, fontSize }: { fileId: string; fontSize: number }): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const text = useSession((s) => s.files.find((f) => f.id === fileId)?.text ?? '');

  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: textOf(fileId),
        // setText se lee en cada cambio (no se captura una versión vieja del store).
        extensions: buildExtensions({ onChange: (t) => defaultSession.getState().setText(fileId, t) }),
      }),
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [fileId]);

  useEffect(() => {
    const view = viewRef.current;
    // Texto actual del store, no el del render: una ráfaga de tecleo no se pisa con uno viejo.
    const current = textOf(fileId);
    if (!view || view.state.doc.toString() === current) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: current },
      annotations: [externalSync.of(true), Transaction.addToHistory.of(false)],
    });
  }, [text, fileId]);

  const size = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(fontSize)));
  useEffect(() => {
    viewRef.current?.requestMeasure();
  }, [size]);

  return <div ref={host} className="editor" style={{ '--editor-font-size': `${size}px` } as CSSProperties} />;
}
