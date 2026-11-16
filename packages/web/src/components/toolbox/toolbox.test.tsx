import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ISA } from '@sim8085/core';
import { ToolboxPage } from './ToolboxPage';

afterEach(cleanup);
const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
const type = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const val = (label: string | RegExp) => (screen.getByLabelText(label) as HTMLInputElement).value;

describe('ToolboxPage', () => {
  it('tiene cuatro pestañas y la navegación por flechas mueve el foco', () => {
    render(<ToolboxPage />);
    expect(screen.getByRole('region', { name: 'Toolbox' })).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Conversor', 'Complemento a 2', 'Opcodes', 'ASCII']);
    tabs[0]!.focus();
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(tabs[1]!, { key: 'End' });
    expect(document.activeElement).toBe(tabs[3]);
    fireEvent.keyDown(tabs[3]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[0]);
  });
});

describe('Conversor', () => {
  it('escribir en un campo actualiza los demás', () => {
    render(<ToolboxPage />);
    type('Hexadecimal', '3A');
    expect(val('Decimal')).toBe('58');
    expect(val('Binario')).toBe('0011 1010');
    expect(val('BCD')).toBe('0101 1000');
    expect(val('Hexadecimal')).toBe('3A');
  });

  it('un valor inválido muestra el error y deja los otros campos como estaban', () => {
    render(<ToolboxPage />);
    type('Hexadecimal', '3A');
    type('Hexadecimal', 'xyz');
    const hex = screen.getByLabelText('Hexadecimal');
    expect(hex.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('No es hexadecimal');
    expect(val('Decimal')).toBe('58');
    type('Decimal', '70000');
    expect(screen.getByRole('alert').textContent).toBe('Máximo 65535');
    type('BCD', '1010');
    expect(screen.getByRole('alert').textContent).toBe('Grupo BCD inválido: 1010');
    expect(val('Binario')).toBe('0011 1010');
    type('Hexadecimal', 'FF');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(val('Decimal')).toBe('255');
    expect(hex.getAttribute('aria-invalid')).toBeNull();
  });

  it('un valor sin BCD (más de 9999) deja el campo BCD vacío', () => {
    render(<ToolboxPage />);
    type('Decimal', '10000');
    expect(val('BCD')).toBe('');
    expect(val('Hexadecimal')).toBe('2710h');
  });
});

describe('Complemento a 2', () => {
  const dd = (label: string) => within(screen.getByLabelText('Resultado')).getByText(label).nextElementSibling!.textContent;
  it('-5 en 8 bits y recalcula en 16', () => {
    render(<ToolboxPage />);
    tab('Complemento a 2');
    type('Valor', '-5');
    expect(dd('Con signo')).toBe('-5');
    expect(dd('Sin signo')).toBe('251');
    expect(dd('Complemento a 1')).toBe('04h');
    expect(dd('Complemento a 2')).toBe('05h');
    expect(dd('Binario')).toBe('1111 1011');
    fireEvent.change(screen.getByLabelText('Ancho'), { target: { value: '16' } });
    expect(dd('Sin signo')).toBe('65531');
    expect(dd('Con signo')).toBe('-5');
  });

  it('fuera de rango muestra el error', () => {
    render(<ToolboxPage />);
    tab('Complemento a 2');
    type('Valor', '-129');
    expect(screen.getByRole('alert').textContent).toBe('Fuera de rango para 8 bits');
    expect(screen.getByLabelText('Valor').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('Opcodes', () => {
  const bodyRows = () => within(screen.getByRole('table', { name: 'Tabla de opcodes' })).getAllByRole('row').slice(1);
  it('sin filtro lista todo y cuenta', () => {
    render(<ToolboxPage />);
    tab('Opcodes');
    expect(bodyRows()).toHaveLength(ISA.length);
    expect(screen.getByText(`${ISA.length} de ${ISA.length}`)).toBeTruthy();
  });
  it('buscar jnz deja una fila con C2 y JNZ addr y estados 7/10', () => {
    render(<ToolboxPage />);
    tab('Opcodes');
    type('Buscar instrucción', 'jnz');
    const rows = bodyRows();
    expect(rows).toHaveLength(1);
    const cells = within(rows[0]!).getAllByRole('cell').map((c) => c.textContent);
    expect(cells.slice(0, 5)).toEqual(['C2', 'JNZ addr', '3', '7/10', '—']);
  });
  it('buscar por opcode encuentra LDA y MOV A,B tiene 1 byte', () => {
    render(<ToolboxPage />);
    tab('Opcodes');
    type('Buscar instrucción', '3a');
    expect(bodyRows().some((r) => within(r).getAllByRole('cell')[1]!.textContent === 'LDA addr')).toBe(true);
    type('Buscar instrucción', 'mov a,b');
    const cells = within(bodyRows()[0]!).getAllByRole('cell').map((c) => c.textContent);
    expect(cells.slice(0, 3)).toEqual(['78', 'MOV A,B', '1']);
  });
  it('sin resultados lo dice', () => {
    render(<ToolboxPage />);
    tab('Opcodes');
    type('Buscar instrucción', 'zzzz');
    expect(screen.getByText(`0 de ${ISA.length}`)).toBeTruthy();
    expect(screen.getByText('Sin resultados')).toBeTruthy();
  });
});

describe('ASCII', () => {
  const rowOf = (hex: string) => screen.getByText(hex).closest('tr')!;
  it('caracteres, controles y etiqueta fuera de la cátedra', () => {
    render(<ToolboxPage />);
    tab('ASCII');
    expect(screen.getByText('FUERA DE CÁTEDRA')).toBeTruthy();
    expect(within(rowOf('41h')).getByText('A')).toBeTruthy();
    expect(within(rowOf('0Ah')).getByText('LF')).toBeTruthy();
    expect(within(rowOf('20h')).getByText('SP')).toBeTruthy();
    expect(within(rowOf('7Fh')).getByText('DEL')).toBeTruthy();
    expect(within(screen.getByRole('table', { name: 'Tabla ASCII' })).getAllByRole('row')).toHaveLength(129);
  });
});
