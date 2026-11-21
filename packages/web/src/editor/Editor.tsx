/**
 * Editor de código (CodeMirror 6) sincronizado con la sesión.
 *
 * Tab inserta espacios (hasta la próxima parada de 8 columnas). Para salir
 * del editor con el teclado: Escape y luego Tab (o Ctrl-M). F9 alterna el
 * punto de corte de la línea del cursor; Ctrl-Espacio abre el autocompletado.
 *
 * Las marcas de depuración (línea actual, puntos de corte, errores) llegan por
 * el efecto `setDecorations`: no se recrea la vista (se conservan deshacer y cursor).
 */
import { useEffect, useRef, type CSSProperties } from 'react';
import { EditorSelection, EditorState, Transaction, type Extension } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
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
import type { AssembleResult, Machine } from '@sim8085/core';
import { defaultSession, useSession } from '../state/store';
import { asmLanguage } from './asmLanguage';
import { debugGutters, remapBreakpointLines } from './breakpoints';
import { externalSync } from './sync';
import { asmCompletion } from './completion';
import { debugDecorations, setDecorations, type SessionMarks } from './decorations';
import { asmHover } from './hover';
import { editorTheme } from './editorTheme';
import './Editor.css';

export const TAB_WIDTH = 8;
const FONT_MIN = 14;
const FONT_MAX = 20;

export { externalSync };

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
  /** Clic en el margen de puntos de corte o F9: línea (1-based) a alternar. */
  onToggleBreakpoint?: (line: number) => void;
  /**
   * Puntos de corte que siguen a su instrucción: en cada cambio del usuario se
   * corren con el cambio y, si cambiaron, se publican con `set`.
   */
  breakpoints?: { get: () => Set<number>; set: (lines: Set<number>) => void };
}

/** Todas las extensiones del editor en un solo lugar (Task 6 suma las suyas acá). */
export function buildExtensions(opts: EditorExtensionOptions): Extension[] {
  return [
    debugGutters(opts.onToggleBreakpoint),
    debugDecorations,
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
    asmCompletion,
    asmHover,
    editorTheme,
    EditorView.contentAttributes.of({ 'aria-label': 'Editor de código ensamblador' }),
    EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      const own = u.transactions.filter((tr) => tr.docChanged && !tr.annotation(externalSync));
      if (own.length === 0) return;
      if (opts.breakpoints) {
        const before = opts.breakpoints.get();
        let lines = before;
        for (const tr of own) lines = remapBreakpointLines(lines, tr.changes, tr.startState.doc, tr.newDoc);
        const same = lines.size === before.size && [...lines].every((l) => before.has(l));
        if (!same) opts.breakpoints.set(lines);
      }
      opts.onChange(u.state.doc.toString());
    }),
  ];
}

/**
 * Línea actual: la de la instrucción que empieza en el PC (también tras HLT,
 * si el PC quedó sobre una instrucción); sobre datos o fuera del programa, ninguna.
 */
export function currentLineOf(asm: AssembleResult | null, machine: Machine | null, stale: boolean): number | null {
  if (!asm || !machine || stale) return null;
  // Solo filas con instrucción: tras HLT el PC puede caer sobre un DB/DW.
  const pc = machine.cpu.PC;
  return asm.rows.find((r) => r.address === pc && r.instr)?.line ?? null;
}

/** Línea de la instrucción recién ejecutada (último paso); null antes del primer paso. */
export function executedLineOf(asm: AssembleResult | null, machine: Machine | null, stale: boolean): number | null {
  if (!asm || !machine || stale) return null;
  const last = machine.lastStep();
  if (!last || !last.instr) return null;
  return asm.rows.find((r) => r.address === last.pc && r.instr)?.line ?? null;
}

const textOf = (fileId: string) => defaultSession.getState().files.find((f) => f.id === fileId)?.text ?? '';

export function Editor({ fileId, fontSize }: { fileId: string; fontSize: number }): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const text = useSession((s) => s.files.find((f) => f.id === fileId)?.text ?? '');
  // El ensamblado y la máquina son del archivo activo: otro archivo no muestra marcas.
  const isActive = useSession((s) => s.activeId === fileId);
  const asm = useSession((s) => s.asm);
  const machine = useSession((s) => s.machine);
  const stale = useSession((s) => s.stale);
  const breakpointLines = useSession((s) => s.breakpointLines);
  const version = useSession((s) => s.version);

  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: textOf(fileId),
        // setText se lee en cada cambio (no se captura una versión vieja del store).
        extensions: buildExtensions({
          onChange: (t) => defaultSession.getState().setText(fileId, t),
          breakpoints: {
            // Solo el archivo activo tiene puntos de corte.
            get: () => (defaultSession.getState().activeId === fileId ? defaultSession.getState().breakpointLines : new Set()),
            set: (lines) => {
              if (defaultSession.getState().activeId === fileId) defaultSession.getState().setBreakpointLines(lines);
            },
          },
          onToggleBreakpoint: (line) => {
            if (defaultSession.getState().activeId === fileId) defaultSession.getState().toggleBreakpoint(line);
          },
        }),
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

  // Marcas de la sesión: la máquina es mutable, `version` avisa que cambió el PC.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const marks: SessionMarks = isActive
      ? {
          asmMessages: asm?.messages ?? [],
          currentLine: currentLineOf(asm, machine, stale),
          executedLine: executedLineOf(asm, machine, stale),
          breakpointLines,
          stale,
        }
      : { asmMessages: [], currentLine: null, breakpointLines: new Set(), stale: false };
    view.dispatch({ effects: setDecorations.of(marks) });
  }, [fileId, isActive, version, stale, breakpointLines, asm, machine]);

  const size = Math.min(FONT_MAX, Math.max(FONT_MIN, Math.round(fontSize)));
  useEffect(() => {
    viewRef.current?.requestMeasure();
  }, [size]);

  return <div ref={host} className="editor" style={{ '--editor-font-size': `${size}px` } as CSSProperties} />;
}
