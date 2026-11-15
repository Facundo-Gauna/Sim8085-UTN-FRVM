import { describe, expect, it } from 'vitest';
import { hoverInfo, operandsInLine, renderHover } from './hover';

describe('hoverInfo', () => {
  it('LDA: 3 bytes, 13 estados, sin banderas, de la cátedra', () => {
    expect(hoverInfo('LDA', 'LDA 0040H')).toEqual({
      title: 'LDA addr',
      body: 'Carga el acumulador con el dato de memoria de la dirección indicada',
      flags: [],
      bytes: 3,
      tStates: '13',
      fueraDeCatedra: false,
    });
  });

  it('JNZ: estados de no tomado / tomado', () => {
    expect(hoverInfo('JNZ', 'JNZ LAZO')).toMatchObject({ tStates: '7 / 10', bytes: 3 });
  });

  it('MOV agrupa sus formas y usa la de la línea', () => {
    const rr = hoverInfo('MOV', 'MOV A,B')!;
    expect(rr.title).toBe('MOV r,r / MOV r,M / MOV M,r');
    expect(rr.tStates).toBe('4');
    expect(hoverInfo('MOV', 'MOV A, M')!.tStates).toBe('7');
    expect(hoverInfo('mov', 'mov a,b')).not.toBeNull();
  });

  it('banderas por nombre', () => {
    expect(hoverInfo('ADD', 'ADD B')!.flags).toEqual(['S', 'Z', 'AC', 'P', 'CY']);
  });

  it('directivas: fuera de la cátedra, sin bytes', () => {
    expect(hoverInfo('DB', 'DATO: DB 5')).toMatchObject({
      title: 'DB',
      body: 'Reserva bytes con valores',
      bytes: 0,
      fueraDeCatedra: true,
    });
    expect(hoverInfo('org', 'org 2000h')?.fueraDeCatedra).toBe(true);
  });

  it('registros: descripción corta', () => {
    expect(hoverInfo('A', 'MOV A,B')).toMatchObject({ title: 'A', body: 'Acumulador', fueraDeCatedra: false, bytes: 0 });
    expect(hoverInfo('M', 'MOV A,M')!.body).toBe('Memoria apuntada por HL');
    expect(hoverInfo('SP', 'LXI SP,3000H')!.body).toBe('Puntero de pila');
    expect(hoverInfo('PSW', 'PUSH PSW')!.body).toBe('Acumulador y banderas');
    expect(hoverInfo('H', 'LXI H,2000H')!.body).toMatch(/par HL/i);
  });

  it('palabra desconocida → null', () => {
    expect(hoverInfo('foo', 'foo: NOP')).toBeNull();
    expect(hoverInfo('', '')).toBeNull();
  });

  it('el tooltip marca lo de fuera de la cátedra con etiqueta y borde punteado', () => {
    const db = renderHover(hoverInfo('DB', 'DB 5')!);
    expect(db.className).toBe('sim-hover sim-hover--fuera');
    expect(db.querySelector('.sim-fuera-label')?.textContent).toBe('FUERA DE CÁTEDRA');
    const lda = renderHover(hoverInfo('LDA', 'LDA 0040H')!);
    expect(lda.className).toBe('sim-hover');
    expect(lda.querySelector('.sim-fuera-label')).toBeNull();
    expect(lda.querySelector('.sim-hover-meta')?.textContent).toBe('3 bytes · 13 estados T · Banderas: ninguna');
  });

  it('un `;` entre comillas no corta los operandos', () => {
    expect(operandsInLine('MVI', "MVI A, ';' ; comentario")).toEqual(['A', "';'"]);
    expect(operandsInLine('CPI', "  CPI ';'")).toEqual(["';'"]);
    expect(hoverInfo('MVI', "MVI A, ';' ; comentario")).toMatchObject({ bytes: 2, tStates: '7' });
  });
});
