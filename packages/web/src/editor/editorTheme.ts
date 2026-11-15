/**
 * Tema del editor (MASTER.md §2.4 y §3). Solo variables CSS de tokens.css, así
 * que sirve para claro y oscuro sin reconfigurar CodeMirror.
 *
 * El tamaño de letra llega por `--editor-font-size` (lo pone Editor.tsx desde
 * su prop); el interlineado 26/16 se mantiene proporcional.
 */
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const selection = 'color-mix(in srgb, var(--accent) 22%, transparent)';

export const editorTheme: Extension = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--surface)',
    color: 'var(--ink)',
    fontSize: 'var(--editor-font-size, 16px)',
  },
  // Anillo de foco visible (accesibilidad): 2px de acento, por dentro del panel.
  '&.cm-focused': { outline: '2px solid var(--accent)', outlineOffset: '-2px' },
  '.cm-scroller': {
    fontFamily: 'var(--mono)',
    lineHeight: '1.625', // 26px a 16px
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-content': { caretColor: 'var(--accent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: selection },
  '.cm-gutters': {
    backgroundColor: 'var(--surface)',
    color: 'var(--ink-muted)',
    border: 'none',
    borderRight: '1px solid var(--line)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    fontFamily: 'var(--mono)',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
    padding: '0 8px 0 12px',
  },
  '.cm-activeLine': { backgroundColor: 'var(--surface-2)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--surface-2)', color: 'var(--ink)' },

  // Tokens del 8085 (clases de asmLanguage).
  '.cm-asm-mnemonic': { color: 'var(--ink)', fontWeight: '600' },
  '.cm-asm-register': { color: 'var(--syn-reg)' },
  '.cm-asm-number': { color: 'var(--syn-num)' },
  '.cm-asm-label': { color: 'var(--syn-label)' },
  '.cm-asm-directive': { color: 'var(--ink-muted)', fontStyle: 'italic' },
  '.cm-asm-comment': { color: 'var(--syn-comment)' },
  '.cm-asm-string': { color: 'var(--syn-num)' },
});
