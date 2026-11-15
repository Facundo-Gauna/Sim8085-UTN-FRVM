/**
 * Márgenes de depuración (como el mockup): punto de corte | número | ▶.
 *
 * - Margen de puntos de corte: un clic (o F9 en la línea del cursor) llama a
 *   `onToggle(línea)`. El círculo lo dibuja `decorationSpecs`, que sale de
 *   `breakpointLines` de la sesión: si el núcleo rechaza la línea, la sesión
 *   no la agrega y no aparece el círculo.
 * - Margen del PC: `▶` en la línea actual.
 */
import { RangeSet, type Extension } from '@codemirror/state';
import { gutter, GutterMarker, keymap, lineNumbers, type EditorView } from '@codemirror/view';
import { decorationSpecs } from './decorations';

class BreakpointMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-sim-bp';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'Punto de corte');
    el.title = 'Punto de corte';
    return el;
  }
}

class PcMarker extends GutterMarker {
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-sim-pc-marker';
    el.title = 'Línea actual (PC)';
    el.textContent = '▶';
    return el;
  }
}

/** Reserva el ancho del margen sin parecer un marcador (el espaciador queda oculto). */
class SpacerMarker extends GutterMarker {
  constructor(readonly text: string) {
    super();
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-sim-spacer';
    el.textContent = this.text;
    return el;
  }
}

const bpMarker = new BreakpointMarker();
const pcMarker = new PcMarker();
const bpSpacer = new SpacerMarker('');
const pcSpacer = new SpacerMarker('▶');

/** Marcadores de margen de un tipo, ordenados por línea. */
function markersOf(view: EditorView, kind: 'breakpoint' | 'current', marker: GutterMarker): RangeSet<GutterMarker> {
  const { doc } = view.state;
  const lines = decorationSpecs(view.state)
    .filter((s) => s.kind === kind)
    .map((s) => s.line)
    .sort((a, b) => a - b);
  return RangeSet.of(lines.map((l) => marker.range(doc.line(l).from)));
}

export function debugGutters(onToggle: ((line: number) => void) | undefined): Extension {
  const toggleAt = (view: EditorView, pos: number) => {
    if (!onToggle) return false;
    onToggle(view.state.doc.lineAt(pos).number);
    return true;
  };
  return [
    gutter({
      class: 'cm-sim-bp-gutter',
      markers: (view) => markersOf(view, 'breakpoint', bpMarker),
      initialSpacer: () => bpSpacer,
      renderEmptyElements: true,
      domEventHandlers: {
        mousedown: (view, block) => toggleAt(view, block.from),
      },
    }),
    lineNumbers(),
    gutter({
      class: 'cm-sim-pc-gutter',
      markers: (view) => markersOf(view, 'current', pcMarker),
      initialSpacer: () => pcSpacer,
    }),
    keymap.of([{ key: 'F9', run: (view) => toggleAt(view, view.state.selection.main.head) }]),
  ];
}
