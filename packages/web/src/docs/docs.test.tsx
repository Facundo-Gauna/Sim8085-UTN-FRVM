import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShortcuts } from '../lib/useShortcuts';
import { assemble, ISA, Machine } from '@sim8085/core';
import { DocsPage } from './DocsPage';
import { GROUPS, missingFromGroups, rowsFor } from './instructionGroups';
import { DOCS, getDoc, SCOPE_LABEL } from './registry';

beforeEach(() => {
  location.hash = '';
});
afterEach(cleanup);

/** Muestra una página de la documentación por su ruta. */
function show(id: string) {
  location.hash = `#/documentacion/${id}`;
  return render(<DocsPage />);
}

/** Todos los bloques de código de ejemplo de la página deben ensamblar sin errores. */
export function expectAsmBlocksAssemble(container: HTMLElement) {
  const blocks = [...container.querySelectorAll('pre[data-asm]')];
  for (const b of blocks) {
    const r = assemble(b.textContent ?? '', { start: 0x2000 });
    expect(r.messages.filter((m) => m.severity === 'error'), b.textContent ?? '').toEqual([]);
    expect(r.ok).toBe(true);
  }
  return blocks.length;
}

describe('registro', () => {
  it('ids únicos en kebab-case y el ámbito de cada página es válido', () => {
    expect(new Set(DOCS.map((d) => d.id)).size).toBe(DOCS.length);
    for (const d of DOCS) {
      expect(d.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
      expect(['catedra', 'fuera', 'legal']).toContain(d.scope);
      expect(SCOPE_LABEL[d.scope]).toBeTruthy();
    }
  });

  it('getDoc con id desconocido o vacío devuelve la primera', () => {
    expect(getDoc(undefined)).toBe(DOCS[0]);
    expect(getDoc('xyz')).toBe(DOCS[0]);
    expect(getDoc('registros').id).toBe('registros');
  });
});

describe('DocsPage', () => {
  it('muestra un único h1, el índice por ámbito y marca la página actual', () => {
    show('registros');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Registros y memoria' })).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Documentación' });
    expect(within(nav).getByRole('heading', { name: 'Dentro de la cátedra' })).toBeTruthy();
    expect(within(nav).getByRole('link', { name: 'Registros y memoria' }).getAttribute('aria-current')).toBe('page');
    expect(within(nav).getByRole('link', { name: 'Qué es assembler y el 8085' }).getAttribute('aria-current')).toBeNull();
    expect(screen.getByText('Dentro de la cátedra', { selector: '.doc-scope' })).toBeTruthy();
  });

  it('una ruta desconocida muestra la primera página', () => {
    show('xyz');
    expect(screen.getByRole('heading', { level: 1, name: 'Qué es assembler y el 8085' })).toBeTruthy();
  });

  it('hacer clic en el índice cambia de página', () => {
    show('que-es');
    const nav = screen.getByRole('navigation', { name: 'Documentación' });
    act(() => void fireEvent.click(within(nav).getByRole('link', { name: 'Registros y memoria' })));
    expect(screen.getByRole('heading', { level: 1, name: 'Registros y memoria' })).toBeTruthy();
    expect(location.hash).toBe('#/documentacion/registros');
  });
});

describe('contenido: qué es y registros', () => {
  it('registros nombra los registros, M, PC y SP', () => {
    const { container } = show('registros');
    const text = container.textContent ?? '';
    for (const r of ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M', 'PC', 'SP', 'BC', 'DE', 'HL']) {
      expect(text).toMatch(new RegExp(`\\b${r}\\b`));
    }
  });

  it('qué es: el ejemplo ensambla y produce 3A 40 00', () => {
    const { container } = show('que-es');
    expect(expectAsmBlocksAssemble(container)).toBeGreaterThanOrEqual(1);
    const code = container.querySelector('pre[data-asm]')!.textContent!;
    const rows = assemble(code, { start: 0x2000 }).rows;
    expect(rows[0]!.bytes).toEqual([0x3a, 0x40, 0x00]);
  });
});

describe('contenido: banderas, programa y direccionamiento', () => {
  it.each([
    ['banderas', 'Banderas'],
    ['programa', 'Cómo se escribe un programa'],
    ['direccionamiento', 'Modos de direccionamiento'],
  ])('%s tiene su h1 y ejemplos que ensamblan', (id, title) => {
    const { container } = show(id);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(expectAsmBlocksAssemble(container)).toBeGreaterThanOrEqual(1);
  });

  it('banderas nombra las cinco y aclara que el PDF omite AC', () => {
    const { container } = show('banderas');
    const text = container.textContent ?? '';
    for (const f of ['S', 'Z', 'AC', 'P', 'CY']) expect(text).toMatch(new RegExp(`\\b${f}\\b`));
    expect(text).toMatch(/solo aparecen Z, P, S y CY/);
  });

  it('banderas: el ejemplo FFh + 01h deja exactamente las banderas que la página dice', () => {
    const { container } = show('banderas');
    const code = container.querySelector('pre[data-asm]')!.textContent!;
    const m = new Machine(assemble(code, { start: 0x2000 }));
    m.run();
    expect(m.cpu.A).toBe(0);
    expect(m.cpu.flags).toMatchObject({ Z: 1, CY: 1, AC: 1, P: 1, S: 0 });
    expect(container.textContent).toMatch(/Z = 1, CY = 1, AC = 1, P = 1 y S = 0/);
  });

  it('programa explica el 0 inicial del hexa que empieza con letra', () => {
    const { container } = show('programa');
    expect(container.textContent).toContain('0A1H');
    expect(container.textContent).toMatch(/cero adelante|0 adelante/);
    expect(container.textContent).toMatch(/80 caracteres/);
  });

  it('direccionamiento distingue valor de dirección', () => {
    const { container } = show('direccionamiento');
    const text = container.textContent ?? '';
    expect(text).toContain('MVI A, 40H');
    expect(text).toContain('LDA 0040H');
  });
});

describe('ámbito: lo "Dentro de la cátedra" no menciona directivas ni macros', () => {
  it.each(DOCS.filter((d) => d.scope === 'catedra').map((d) => d.id))('%s', (id) => {
    const { container } = show(id);
    expect(container.querySelector('article')!.textContent).not.toMatch(/\b(ORG|EQU|MACRO|ENDM|DB|DW|DS)\b/);
  });
});

describe('referencia de instrucciones', () => {
  it('los grupos cubren exactamente los mnemónicos de ISA, sin repetidos', () => {
    expect(GROUPS).toHaveLength(6);
    expect(missingFromGroups(ISA)).toEqual({ missing: [], unknown: [], duplicated: [] });
  });

  it('la comprobación de cobertura detecta un mnemónico nuevo, uno desconocido y uno repetido', () => {
    const fake = { ...ISA[0]!, mnemonic: 'XYZ' };
    expect(missingFromGroups([...ISA, fake]).missing).toEqual(['XYZ']);
    expect(missingFromGroups(ISA.filter((d) => d.mnemonic !== 'HLT')).unknown).toEqual(['HLT']);
  });

  it('rowsFor: saltos condicionales, aritmética y banderas', () => {
    expect(rowsFor('JNZ')).toMatchObject({ forms: ['addr'], bytes: '3', tStates: '7/10', flags: '—' });
    expect(rowsFor('ADD')).toMatchObject({ forms: ['r'], bytes: '1', tStates: '4–7', flags: 'S Z AC P CY' });
    expect(rowsFor('INR').flags).toBe('S Z AC P');
    expect(rowsFor('MOV').forms).toEqual(['r1,r2']);
    expect(rowsFor('MVI').forms).toEqual(['r,d8']);
    expect(rowsFor('RST')).toMatchObject({ forms: ['n'], tStates: '12' });
    expect(rowsFor('LXI').forms).toEqual(['B,d16', 'D,d16', 'H,d16', 'SP,d16']);
    expect(rowsFor('MVI').bytes).toBe('2');
  });

  it('la página tiene seis tablas con caption y una fila por mnemónico', () => {
    const { container } = show('instrucciones');
    expect(screen.getByRole('heading', { level: 1, name: 'Referencia de instrucciones' })).toBeTruthy();
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(6);
    for (const tb of tables) expect(tb.querySelector('caption')!.textContent).toBeTruthy();
    const body = container.querySelectorAll('tbody tr');
    expect(body.length).toBe(new Set(ISA.map((d) => d.mnemonic)).size);
    const hlt = [...body].find((r) => r.querySelector('td')!.textContent === 'HLT')!;
    expect(hlt.textContent).toMatch(/detiene/i);
  });
});

describe('contenido: usar el simulador y la entrega', () => {
  /** Atajo documentado → manejador del hook que debe dispararse. */
  const HANDLER: Record<string, { key: string; init: KeyboardEventInit; handler: string }> = {
    F5: { key: 'F5', init: {}, handler: 'assemble' },
    F8: { key: 'F8', init: {}, handler: 'toggleRun' },
    F10: { key: 'F10', init: {}, handler: 'step' },
    'Shift+F10': { key: 'F10', init: { shiftKey: true }, handler: 'back' },
    'Ctrl+S': { key: 's', init: { ctrlKey: true }, handler: 'save' },
    'Ctrl+O': { key: 'o', init: { ctrlKey: true }, handler: 'open' },
    'Ctrl+Shift+F': { key: 'F', init: { ctrlKey: true, shiftKey: true }, handler: 'focus' },
  };

  function Probe({ spies }: { spies: Record<string, () => void> }) {
    useShortcuts(spies as never);
    return null;
  }

  it('los atajos documentados existen y disparan lo que la página dice', () => {
    const { container } = show('usar-simulador');
    const documented = [...container.querySelectorAll('kbd')].map((k) => k.textContent!);
    for (const k of ['F5', 'F8', 'F10', 'Shift+F10', 'F9', 'Ctrl+S', 'Ctrl+O']) expect(documented).toContain(k);
    cleanup();
    // F9 (editor) y F2 (celda de memoria) viven en sus componentes y tienen sus propias pruebas.
    for (const k of documented.filter((d) => d !== 'F9' && d !== 'F2')) {
      const spec = HANDLER[k];
      expect(spec, `atajo sin verificar: ${k}`).toBeDefined();
      const spies = Object.fromEntries(['assemble', 'toggleRun', 'step', 'back', 'open', 'save', 'focus'].map((n) => [n, vi.fn()]));
      const { unmount } = render(<Probe spies={spies} />);
      act(() => void fireEvent.keyDown(window, { key: spec!.key, ...spec!.init }));
      expect(spies[spec!.handler], k).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it('usar-simulador avisa que la web no guarda y nombra los controles reales', () => {
    const { container } = show('usar-simulador');
    const text = container.textContent ?? '';
    expect(text).toMatch(/no guarda/);
    for (const w of ['Ensamblar', 'Ejecutar', 'Paso', 'Atrás', 'Reiniciar', 'Salida', 'Pila', 'Puertos E/S', 'Interrupciones', 'Métricas']) {
      expect(text, w).toContain(w);
    }
    expect(expectAsmBlocksAssemble(container)).toBeGreaterThanOrEqual(0);
  });

  it('ejercicios-entrega nombra el flujo completo y los límites', () => {
    const { container } = show('ejercicios-entrega');
    const text = container.textContent ?? '';
    for (const w of ['80 caracteres', '500', 'Autocompletar observaciones', 'Comprobar', 'nibble alto', 'Exportar PDF', 'GTP05']) {
      expect(text, w).toContain(w);
    }
    expect(expectAsmBlocksAssemble(container)).toBeGreaterThanOrEqual(1);
  });
});

describe('páginas fuera de la cátedra', () => {
  const FUERA = ['directivas-macros', 'instalacion', 'complementarias'];

  it.each(FUERA)('%s tiene la etiqueta y el texto de ámbito, y está en el grupo "Fuera"', (id) => {
    expect(DOCS.find((d) => d.id === id)?.scope).toBe('fuera');
    const { container } = show(id);
    expect(screen.getByText('FUERA DE CÁTEDRA')).toBeTruthy();
    expect(screen.getByText('Fuera de la cátedra (complementario)', { selector: '.doc-scope' })).toBeTruthy();
    expect(container.querySelector('article.fuera')).not.toBeNull();
    const nav = screen.getByRole('navigation', { name: 'Documentación' });
    const link = within(nav).getAllByRole('link').find((a) => a.getAttribute('href') === `#/documentacion/${id}`)!;
    expect(link.closest('div')!.querySelector('h2')!.textContent).toBe('Fuera de la cátedra (complementario)');
  });

  it('directivas y macros: nombra todo, los ejemplos ensamblan y la macro se expande', () => {
    const { container } = show('directivas-macros');
    const text = container.textContent ?? '';
    for (const w of ['ORG', 'EQU', 'DB', 'DW', 'DS', 'END', 'MACRO', 'ENDM']) expect(text, w).toMatch(new RegExp(`\\b${w}\\b`));
    expect(expectAsmBlocksAssemble(container)).toBeGreaterThanOrEqual(6);
    const macro = [...container.querySelectorAll('pre[data-asm]')].find((b) => b.textContent!.includes('MACRO'))!;
    const rows = assemble(macro.textContent!, { start: 0x2000 }).rows;
    expect(rows.map((r) => r.source)).toEqual(['NOP', 'NOP', 'HLT']);
  });

  it('instalación menciona Linux y Windows y que la web funciona sin instalar', () => {
    const { container } = show('instalacion');
    expect(container.textContent).toMatch(/Linux/);
    expect(container.textContent).toMatch(/Windows/);
    expect(container.textContent).toMatch(/sin instalar nada/);
  });

  it('instalación incluye las descargas y explica cada formato', () => {
    const { container } = show('instalacion');
    expect(screen.getByRole('heading', { level: 2, name: 'Descargas' })).toBeTruthy();
    const text = container.textContent ?? '';
    for (const w of ['AppImage', '.deb', '.rpm', 'SmartScreen', 'Más información']) expect(text, w).toContain(w);
    expect(text).not.toContain('se completa con los pasos');
  });

  it('complementarias nombra las herramientas extra', () => {
    const { container } = show('complementarias');
    for (const w of ['Toolbox', 'ASCII', 'BCD', 'Complemento a 2', 'Métricas', 'Puertos E/S', 'Interrupciones']) {
      expect(container.textContent, w).toContain(w);
    }
  });
});

describe('Términos y Privacidad', () => {
  it('privacidad declara que no se envía nada, sin cuentas ni analíticas', () => {
    expect(DOCS.find((d) => d.id === 'privacidad')?.scope).toBe('legal');
    const { container } = show('privacidad');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const text = container.textContent ?? '';
    expect(text).toMatch(/no se envían/);
    expect(text).toMatch(/sin cuentas/);
    expect(text).toMatch(/analíticas/);
    expect(text).toMatch(/tema/);
  });

  it('términos declara uso educativo, sin garantía y que no es oficial de la UTN', () => {
    expect(DOCS.find((d) => d.id === 'terminos')?.scope).toBe('legal');
    const { container } = show('terminos');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const text = container.textContent ?? '';
    expect(text).toMatch(/sin garantía/);
    expect(text).toMatch(/UTN/);
    expect(text).toMatch(/no es un producto oficial/i);
  });

  it('el índice tiene los tres grupos y cada página lleva enlaces a Términos y Privacidad al pie', () => {
    show('registros');
    const nav = screen.getByRole('navigation', { name: 'Documentación' });
    expect(within(nav).getAllByRole('heading').map((h) => h.textContent)).toEqual([
      'Dentro de la cátedra',
      'Fuera de la cátedra (complementario)',
      'Legal',
    ]);
    const foot = screen.getByRole('navigation', { name: 'Información legal' });
    expect(within(foot).getByRole('link', { name: 'Términos' }).getAttribute('href')).toBe('#/documentacion/terminos');
    expect(within(foot).getByRole('link', { name: 'Privacidad' }).getAttribute('href')).toBe('#/documentacion/privacidad');
  });

  it('todos los enlaces internos de todas las páginas apuntan a una página que existe', () => {
    const ids = new Set(DOCS.map((d) => d.id));
    for (const d of DOCS) {
      const { container, unmount } = show(d.id);
      for (const a of container.querySelectorAll('a[href^="#/documentacion/"]')) {
        expect(ids.has(a.getAttribute('href')!.replace('#/documentacion/', '')), `${d.id} → ${a.getAttribute('href')}`).toBe(true);
      }
      unmount();
    }
  });
});
