import { describe, it, expect } from 'vitest';
import { assemble } from '../src/asm/assembler';
import { ISA } from '../src/isa/table';
import { describeInstruction } from '../src/asm/observation';

const first = (src: string) => describeInstruction(assemble(src, { start: 0x2000 }).rows[0]!);

describe('describeInstruction', () => {
  it.each([
    ['LDA 2000H', 'A ← M[2000h]'],
    ['STA 0041H', 'M[0041h] ← A'],
    ['MVI B, 05H', 'B ← 05h'],
    ['MVI M, 05H', 'M[HL] ← 05h'],
    ['MOV M, B', 'M[HL] ← B'],
    ['MOV A, M', 'A ← M[HL]'],
    ['LXI H, 1234H', 'HL ← 1234h'],
    ['LXI SP, 1234H', 'SP ← 1234h'],
    ['LDAX B', 'A ← M[BC]'],
    ['XCHG', 'HL ↔ DE'],
    ['ADD B', 'A ← A + B'],
    ['SBB M', 'A ← A - M[HL] - CY'],
    ['XRA A', 'A ← A XOR A'],
    ['ADI 0FH', 'A ← A + 0Fh'],
    ['CMP B', 'A - B (solo cambia banderas)'],
    ['CPI 05H', 'A - 05h (solo cambia banderas)'],
    ['INR B', 'B ← B + 1'],
    ['INX D', 'DE ← DE + 1'],
    ['DAD B', 'HL ← HL + BC'],
    ['RAL', 'rota A a la izquierda por CY'],
    ['JNZ 2005H', 'si Z = 0, salta a 2005h'],
    ['JMP 2005H', 'salta a 2005h'],
    ['CNC 2005H', 'si CY = 0, llama a 2005h'],
    ['RPE', 'si P = 1, vuelve de la subrutina'],
    ['RST 3', 'llama a 0018h'],
    ['PUSH PSW', 'pila ← PSW'],
    ['POP H', 'HL ← pila'],
    ['IN 05H', 'A ← puerto 05h'],
    ['OUT 05H', 'puerto 05h ← A'],
    ['HLT', 'detiene el procesador'],
  ])('%s → %s', (src, expected) => {
    expect(first(src)).toBe(expected);
  });

  it('usa el nombre de la etiqueta como destino', () => {
    expect(first('LOOP: JNZ LOOP')).toBe('si Z = 0, salta a LOOP');
  });

  it('datos DB no tienen observación', () => {
    expect(first('DB 1,2')).toBeUndefined();
  });

  it('cubre todas las instrucciones válidas con texto de hasta 80 caracteres', () => {
    for (const d of ISA) {
      const ops = d.operands.map((o) => ({ d8: '12H', d16: '1234H', addr: '2000H', port: '05H' } as Record<string, string>)[o] ?? o);
      const src = `${d.mnemonic} ${ops.join(',')}`.trim();
      const text = first(src);
      expect(text, src).toBeTruthy();
      expect(text!.length, src).toBeLessThanOrEqual(80);
      expect(text, src).not.toMatch(/undefined|NaN/);
    }
  });
});
