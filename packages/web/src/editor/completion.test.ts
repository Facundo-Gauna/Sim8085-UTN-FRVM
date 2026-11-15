import { describe, expect, it } from 'vitest';
import { ISA } from '@sim8085/core';
import { completionsFor } from './completion';

const labels = (xs: { label: string }[]) => xs.map((x) => x.label);
const summaryOf = (m: string) => ISA.find((d) => d.mnemonic === m)!.summary;

describe('completionsFor', () => {
  it('en la posición de operación ofrece mnemónicos con su summary', () => {
    const r = completionsFor('MO', '');
    expect(r).toContainEqual({ label: 'MOV', detail: summaryOf('MOV'), fueraDeCatedra: false });
    expect(r).toContainEqual({ label: 'MVI', detail: summaryOf('MVI'), fueraDeCatedra: false });
  });

  it('no repite mnemónicos (uno por mnemónico, no por forma)', () => {
    const r = completionsFor('MOV', '');
    expect(labels(r).filter((l) => l === 'MOV')).toHaveLength(1);
  });

  it('tras `MOV A,` ofrece registros A B C D E H L M y ningún mnemónico', () => {
    const r = completionsFor('', 'MOV A,');
    expect(labels(r)).toEqual(['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M']);
    expect(r.every((x) => !x.fueraDeCatedra)).toBe(true);
  });

  it('las directivas van marcadas fuera de la cátedra', () => {
    const r = completionsFor('OR', '');
    expect(r.find((x) => x.label === 'ORG')).toMatchObject({ fueraDeCatedra: true, detail: 'Fija la dirección de inicio' });
    expect(r.find((x) => x.label === 'ORA')).toMatchObject({ fueraDeCatedra: false });
    const all = completionsFor('', '');
    for (const d of ['ORG', 'EQU', 'DB', 'DW', 'DS', 'END', 'MACRO', 'ENDM']) {
      expect(all.find((x) => x.label === d)?.fueraDeCatedra).toBe(true);
    }
  });

  it('con una etiqueta delante sigue en la posición de operación', () => {
    expect(labels(completionsFor('MO', 'INICIO: '))).toContain('MOV');
    expect(labels(completionsFor('MO', '        '))).toContain('MOV');
  });

  it('sin distinguir mayúsculas; respeta la caja que se escribe', () => {
    const r = completionsFor('mo', '');
    expect(labels(r)).toContain('mov');
    expect(labels(r)).toContain('mvi');
    expect(labels(completionsFor('', 'mov a,'))).toContain('B');
    expect(labels(completionsFor('b', 'mov a,'))).toEqual(['b']);
  });

  it('registros según el mnemónico y el operando', () => {
    expect(labels(completionsFor('', 'MOV '))).toEqual(['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M']);
    expect(labels(completionsFor('', 'ADD '))).toEqual(['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M']);
    expect(labels(completionsFor('', 'LXI '))).toEqual(['B', 'D', 'H', 'SP']);
    expect(labels(completionsFor('', 'INX '))).toEqual(['B', 'D', 'H', 'SP']);
    expect(labels(completionsFor('', 'PUSH '))).toEqual(['B', 'D', 'H', 'PSW']);
    expect(labels(completionsFor('', 'POP '))).toEqual(['B', 'D', 'H', 'PSW']);
    expect(labels(completionsFor('', 'LDAX '))).toEqual(['B', 'D']);
    expect(labels(completionsFor('', 'MVI '))).toEqual(['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M']);
    expect(completionsFor('', 'MVI A,')).toEqual([]);
    expect(completionsFor('', 'LXI H,')).toEqual([]);
    expect(completionsFor('', 'LDA ')).toEqual([]);
    expect(completionsFor('', 'JMP ')).toEqual([]);
    expect(labels(completionsFor('S', 'LXI '))).toEqual(['SP']);
    expect(labels(completionsFor('', 'INICIO: MOV A,'))).toContain('M');
  });

  it('nada dentro de un comentario', () => {
    expect(completionsFor('MO', '; texto ')).toEqual([]);
    expect(completionsFor('', 'MOV A,B ;')).toEqual([]);
  });
});
