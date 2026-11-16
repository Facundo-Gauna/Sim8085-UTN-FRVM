import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assemble, Machine } from '@sim8085/core';
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
