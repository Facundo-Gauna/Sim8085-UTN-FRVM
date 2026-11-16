import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assemble } from '@sim8085/core';
import { DocsPage } from './DocsPage';
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
