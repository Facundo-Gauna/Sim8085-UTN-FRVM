/**
 * Columna de direcciones: en qué posición de memoria empieza cada línea.
 *
 * Sale del texto en vivo (no de la sesión): así se ve mientras se escribe, sin
 * ensamblar, que es cuando hace falta para armar los saltos. La dirección de
 * inicio llega por el efecto `setStartAddressEffect`.
 */
import { assemble } from '@sim8085/core';
import { RangeSet, StateEffect, StateField, type Extension, type Text } from '@codemirror/state';
import { gutter, GutterMarker } from '@codemirror/view';

/** Línea → dirección en hexa de 4 dígitos; solo las líneas que generan bytes. */
export function addressLabels(source: string, start: number): Map<number, string> {
  const { lineToAddress } = assemble(source, { start });
  return new Map(
    [...lineToAddress]
      .sort((a, b) => a[0] - b[0])
      .map(([line, address]) => [line, address.toString(16).toUpperCase().padStart(4, '0')]),
  );
}

export const setStartAddressEffect = StateEffect.define<number>();

class AddressMarker extends GutterMarker {
  constructor(
    readonly text: string,
    readonly className = 'cm-sim-addr',
  ) {
    super();
  }
  eq(other: AddressMarker) {
    return other.text === this.text && other.className === this.className;
  }
  toDOM() {
    const el = document.createElement('span');
    el.className = this.className;
    el.textContent = this.text;
    el.title = 'Dirección de memoria donde empieza esta línea';
    return el;
  }
}

const spacer = new AddressMarker('0000', 'cm-sim-spacer');

interface AddressState {
  start: number;
  markers: RangeSet<GutterMarker>;
}

function compute(doc: Text, start: number): AddressState {
  const markers = [...addressLabels(doc.toString(), start)]
    .filter(([line]) => line <= doc.lines)
    .map(([line, text]) => new AddressMarker(text).range(doc.line(line).from));
  return { start, markers: RangeSet.of(markers) };
}

export function addressGutter(initialStart: number): Extension {
  const field = StateField.define<AddressState>({
    create: (state) => compute(state.doc, initialStart),
    update(value, tr) {
      let { start } = value;
      for (const e of tr.effects) if (e.is(setStartAddressEffect)) start = e.value;
      return tr.docChanged || start !== value.start ? compute(tr.state.doc, start) : value;
    },
  });
  return [
    field,
    gutter({
      class: 'cm-sim-addr-gutter',
      markers: (view) => view.state.field(field).markers,
      initialSpacer: () => spacer,
    }),
  ];
}
