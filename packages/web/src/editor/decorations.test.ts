import { describe, expect, it } from 'vitest';
import type { AsmMessage } from '@sim8085/core';
import { commentLength, lineDecorations, type DecorationSpec } from './decorations';

const base = {
  asmMessages: [] as AsmMessage[],
  currentLine: null as number | null,
  breakpointLines: new Set<number>(),
  stale: false,
  commentLen: () => 0,
  lineCount: 10,
};

const kinds = (xs: DecorationSpec[]) => xs.map((x) => x.kind);

describe('lineDecorations', () => {
  it('línea actual y puntos de corte', () => {
    const r = lineDecorations({ ...base, currentLine: 2, breakpointLines: new Set([3, 5]) });
    expect(r).toContainEqual({ kind: 'current', line: 2 });
    expect(r).toContainEqual({ kind: 'breakpoint', line: 3 });
    expect(r).toContainEqual({ kind: 'breakpoint', line: 5 });
  });

  it('con stale no emite línea actual, puntos de corte ni mensajes del ensamblado', () => {
    const r = lineDecorations({
      ...base,
      stale: true,
      currentLine: 2,
      breakpointLines: new Set([3]),
      asmMessages: [{ line: 4, severity: 'error', message: 'x' }],
    });
    expect(kinds(r)).not.toContain('current');
    expect(kinds(r)).not.toContain('breakpoint');
    expect(kinds(r)).not.toContain('error');
  });

  it('un error en la línea N da una marca de error solo en esa línea', () => {
    const r = lineDecorations({
      ...base,
      asmMessages: [{ line: 4, severity: 'error', message: 'Número inválido: ¿Quisiste decir 0A1H?' }],
    });
    expect(r.filter((x) => x.kind === 'error')).toEqual([
      { kind: 'error', line: 4, message: 'Número inválido: ¿Quisiste decir 0A1H?' },
    ]);
  });

  it('advertencias del ensamblador con su propia marca; mensajes de una línea se juntan', () => {
    const r = lineDecorations({
      ...base,
      asmMessages: [
        { line: 2, severity: 'error', message: 'uno' },
        { line: 2, severity: 'error', message: 'dos' },
        { line: 3, severity: 'warning', message: 'aviso' },
      ],
    });
    expect(r).toContainEqual({ kind: 'error', line: 2, message: 'uno\ndos' });
    expect(r).toContainEqual({ kind: 'warning', line: 3, message: 'aviso' });
  });

  it('ignora líneas fuera del documento', () => {
    const r = lineDecorations({ ...base, lineCount: 3, currentLine: 9, breakpointLines: new Set([7]) });
    expect(r).toEqual([]);
  });

  it('contador de comentario: 80 no avisa, 81 avisa con 81/80 (también con stale)', () => {
    const lens: Record<number, number> = { 1: 80, 2: 81, 3: 60 };
    const commentLen = (l: number) => lens[l] ?? 0;
    for (const stale of [false, true]) {
      const r = lineDecorations({ ...base, stale, commentLen });
      expect(r.filter((x) => x.kind === 'commentCount')).toEqual([{ kind: 'commentCount', line: 2, text: '81/80' }]);
    }
  });
});

describe('commentLength', () => {
  it('largo del comentario sin `;` y sin blancos de los extremos', () => {
    expect(commentLength('        LDA 0040H   ; hola  ')).toBe(4);
    expect(commentLength('NOP')).toBe(0);
    expect(commentLength(";")).toBe(0);
    expect(commentLength("DB ';'  ; ab")).toBe(2);
    expect(commentLength('; ' + 'x'.repeat(81))).toBe(81);
  });
});

describe('marksField', () => {
  it('un cambio del usuario oculta en la misma transacción la línea actual, puntos y errores', async () => {
    const { EditorState } = await import('@codemirror/state');
    const { marksField, setDecorations, decorationSpecs } = await import('./decorations');
    const { externalSync } = await import('./sync');
    let state = EditorState.create({ doc: 'NOP\nHLT\n', extensions: marksField });
    state = state.update({
      effects: setDecorations.of({
        asmMessages: [{ line: 2, severity: 'error', message: 'x' }],
        currentLine: 1,
        breakpointLines: new Set([2]),
        stale: false,
      }),
    }).state;
    expect(decorationSpecs(state).map((d) => d.kind).sort()).toEqual(['breakpoint', 'current', 'error']);
    const synced = state.update({ changes: { from: 0, insert: ' ' }, annotations: externalSync.of(true) }).state;
    expect(decorationSpecs(synced)).toHaveLength(3);
    const edited = state.update({ changes: { from: 0, insert: ' ' } }).state;
    expect(decorationSpecs(edited)).toEqual([]);
  });
});
