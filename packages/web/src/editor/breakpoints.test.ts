import { describe, expect, it } from 'vitest';
import { EditorState, type TransactionSpec } from '@codemirror/state';
import { remapBreakpointLines } from './breakpoints';

const DOC = 'L1\nL2\nL3 LDA\nL4\n';

/** Aplica el cambio sobre DOC y remapea los puntos de corte. */
function remap(lines: number[], spec: (s: EditorState) => TransactionSpec): Set<number> {
  const state = EditorState.create({ doc: DOC });
  const tr = state.update(spec(state));
  return remapBreakpointLines(new Set(lines), tr.changes, tr.startState.doc, tr.newDoc);
}

describe('remapBreakpointLines', () => {
  it('insertar una línea arriba corre el punto de corte +1', () => {
    expect(remap([3], (s) => ({ changes: { from: s.doc.line(1).to, insert: '\nNOP' } }))).toEqual(new Set([4]));
    expect(remap([3], (s) => ({ changes: { from: s.doc.line(3).from, insert: 'NOP\n' } }))).toEqual(new Set([4]));
  });

  it('borrar una línea arriba lo corre −1', () => {
    expect(remap([3], (s) => ({ changes: { from: s.doc.line(1).from, to: s.doc.line(2).from } }))).toEqual(new Set([2]));
  });

  it('borrar la línea del punto de corte lo quita', () => {
    expect(remap([3, 4], (s) => ({ changes: { from: s.doc.line(3).from, to: s.doc.line(4).from } }))).toEqual(new Set([3]));
    expect(remap([3], (s) => ({ changes: { from: s.doc.line(2).to, to: s.doc.line(3).to } }))).toEqual(new Set());
  });

  it('escribir dentro de la línea no la mueve', () => {
    expect(remap([3], (s) => ({ changes: { from: s.doc.line(3).from, insert: 'X' } }))).toEqual(new Set([3]));
    expect(remap([3], (s) => ({ changes: { from: s.doc.line(3).to, insert: ' ; ok' } }))).toEqual(new Set([3]));
  });

  it('unir con la anterior (retroceso al inicio) lleva el punto con su texto', () => {
    expect(remap([3], (s) => ({ changes: { from: s.doc.line(3).from - 1, to: s.doc.line(3).from } }))).toEqual(new Set([2]));
  });
});
