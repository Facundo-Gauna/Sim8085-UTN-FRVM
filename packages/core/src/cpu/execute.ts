/**
 * Ejecución de una instrucción del 8085.
 *
 * Semántica según "Set de Instrucciones - Microprocesador 8085" (docs/referencia),
 * págs. 4–17. Las banderas se calculan con la ALU (`./alu`); acá solo se decide
 * qué operación aplicar y dónde guardar el resultado.
 *
 * Convenciones:
 * - Toda aritmética de direcciones y pares es de 16 bits con vuelta (FFFFh + 1 = 0000h).
 * - `StepInfo.memRead` / `memWrite` es la dirección del DATO tocado, no la del
 *   fetch de la instrucción:
 *   - operando `M`: HL; LDAX/STAX: BC o DE; LDA/STA: la dirección indicada;
 *   - LHLD/SHLD: la primera dirección (la del byte bajo, L);
 *   - pila: PUSH/CALL/RST informan en `memWrite` la dirección del ÚLTIMO byte
 *     escrito (el nuevo SP, donde queda el byte bajo); POP/RET informan en
 *     `memRead` la dirección del PRIMER byte leído (el SP previo, byte bajo).
 *     XTHL informa SP en ambos.
 */
import type { CpuState, Flags } from './state';
import { packFlags, unpackFlags } from './state';
import { add8, sub8, and8, or8, xor8, inr8, dcr8, daa, type AluOut } from './alu';
import { byOpcode } from '../isa/lookup';
import type { InstrDef } from '../isa/types';

export interface Bus {
  read(a: number): number;
  write(a: number, v: number): void;
  in(port: number): number;
  out(port: number, v: number): void;
}

export interface StepInfo {
  pc: number;
  opcode: number;
  instr?: InstrDef;
  tStates: number;
  /** Dirección de dato leída (para la traza). */
  memRead?: number;
  /** Dirección de dato escrita (para la traza). */
  memWrite?: number;
  /** Mensaje de error, p. ej. 'Opcode inválido 08h en 2005h'. */
  error?: string;
  /** Nota para la traza, p. ej. 'Interrupción RST 6.5 aceptada → 0034h'. */
  note?: string;
}

const w16 = (v: number): number => v & 0xffff;
const hex = (v: number, n: number): string => v.toString(16).toUpperCase().padStart(n, '0');

/** Registro de 8 bits por índice DDD/SSS (pág. 2); el 6 (M) se resuelve aparte. */
type Reg8 = 'B' | 'C' | 'D' | 'E' | 'H' | 'L' | 'A';
const REG8: ReadonlyArray<Reg8 | null> = ['B', 'C', 'D', 'E', 'H', 'L', null, 'A'];

class Ctx {
  memRead?: number;
  memWrite?: number;
  constructor(readonly s: CpuState, readonly bus: Bus) {}

  rd(a: number): number { a = w16(a); this.memRead ??= a; return this.bus.read(a) & 0xff; }
  wr(a: number, v: number): void { a = w16(a); this.memWrite = a; this.bus.write(a, v & 0xff); }

  get HL(): number { return (this.s.H << 8) | this.s.L; }

  getR(i: number): number {
    const r = REG8[i];
    return r ? this.s[r] : this.rd(this.HL);
  }
  setR(i: number, v: number): void {
    const r = REG8[i];
    if (r) this.s[r] = v & 0xff; else this.wr(this.HL, v);
  }

  /** Par por índice RP (pág. 2): 0 BC, 1 DE, 2 HL, 3 SP. */
  getRP(i: number): number {
    const s = this.s;
    switch (i) {
      case 0: return (s.B << 8) | s.C;
      case 1: return (s.D << 8) | s.E;
      case 2: return (s.H << 8) | s.L;
      default: return s.SP;
    }
  }
  setRP(i: number, v: number): void {
    const s = this.s;
    v = w16(v);
    switch (i) {
      case 0: s.B = v >> 8; s.C = v & 0xff; break;
      case 1: s.D = v >> 8; s.E = v & 0xff; break;
      case 2: s.H = v >> 8; s.L = v & 0xff; break;
      default: s.SP = v;
    }
  }

  push16(v: number): void {
    const s = this.s;
    s.SP = w16(s.SP - 1); this.wr(s.SP, v >> 8);
    s.SP = w16(s.SP - 1); this.wr(s.SP, v);
  }
  pop16(): number {
    const s = this.s;
    const lo = this.rd(s.SP); s.SP = w16(s.SP + 1);
    const hi = this.rd(s.SP); s.SP = w16(s.SP + 1);
    return (hi << 8) | lo;
  }

  applyAlu(r: AluOut, store: boolean): void {
    Object.assign(this.s.flags, r.flags);
    if (store) this.s.A = r.value;
  }
}

/** Condición CCC (pág. 2): NZ Z NC C PO PE P M. */
function cond(f: Flags, ccc: number): boolean {
  switch (ccc) {
    case 0: return f.Z === 0;
    case 1: return f.Z === 1;
    case 2: return f.CY === 0;
    case 3: return f.CY === 1;
    case 4: return f.P === 0;
    case 5: return f.P === 1;
    case 6: return f.S === 0;
    default: return f.S === 1;
  }
}

/** Operación ALU por índice (ADD ADC SUB SBB ANA XRA ORA CMP) sobre A y `v`. */
function aluOp(c: Ctx, op: number, v: number): void {
  const s = c.s;
  switch (op) {
    case 0: c.applyAlu(add8(s.A, v, 0), true); break;
    case 1: c.applyAlu(add8(s.A, v, s.flags.CY), true); break;
    case 2: c.applyAlu(sub8(s.A, v, 0), true); break;
    case 3: c.applyAlu(sub8(s.A, v, s.flags.CY), true); break;
    case 4: c.applyAlu(and8(s.A, v), true); break;
    case 5: c.applyAlu(xor8(s.A, v), true); break;
    case 6: c.applyAlu(or8(s.A, v), true); break;
    default: c.applyAlu(sub8(s.A, v, 0), false); // CMP / CPI: banderas sin guardar
  }
}

/**
 * RIM (pág. 16): A = SID I7.5 I6.5 I5.5 IE M7.5 M6.5 M5.5.
 * Inmediatamente después de un TRAP, IE es el valor previo al TRAP.
 */
function rim(s: CpuState, ieBeforeTrap: boolean | null): void {
  const b = (v: boolean | number, n: number): number => (v ? 1 : 0) << n;
  s.A =
    b(s.sid, 7) | b(s.pending.r75, 6) | b(s.pending.r65, 5) | b(s.pending.r55, 4) |
    b(ieBeforeTrap ?? s.ie, 3) | b(s.masks.m75, 2) | b(s.masks.m65, 1) | b(s.masks.m55, 0);
}

/**
 * SIM (pág. 17): A = SOD SOE x R7.5 MSE M7.5 M6.5 M5.5.
 * MSE=1 carga las máscaras (1 = enmascarada); R7.5=1 borra el latch de RST 7.5;
 * SOE=1 carga SOD.
 */
function sim(s: CpuState): void {
  const a = s.A;
  if (a & 0x08) {
    s.masks.m55 = (a & 0x01) !== 0;
    s.masks.m65 = (a & 0x02) !== 0;
    s.masks.m75 = (a & 0x04) !== 0;
  }
  if (a & 0x10) s.pending.r75 = false;
  if (a & 0x40) s.sod = ((a >> 7) & 1) as 0 | 1;
}

const VECTORS = [
  { key: 'trap', name: 'TRAP', vector: 0x0024 },
  { key: 'r75', name: 'RST 7.5', vector: 0x003c },
  { key: 'r65', name: 'RST 6.5', vector: 0x0034 },
  { key: 'r55', name: 'RST 5.5', vector: 0x002c },
] as const;
const MASK = { r75: 'm75', r65: 'm65', r55: 'm55' } as const;

/**
 * Acepta, si corresponde, una interrupción pendiente. La Machine la llama antes
 * de cada `execute`; si devuelve `StepInfo`, ese paso fue la aceptación (no se
 * ejecuta instrucción).
 *
 * Prioridad TRAP (0024h) > RST 7.5 (003Ch) > RST 6.5 (0034h) > RST 5.5 (002Ch).
 * TRAP no es enmascarable ni depende de IE; las demás requieren IE, que no haya
 * un EI recién ejecutado (`eiPending`) y que su máscara esté en 0.
 * Al aceptar: push PC, IE = false, se borra el pendiente, PC = vector, 12 T,
 * y se sale de HLT (el retorno es la dirección siguiente al HLT).
 */
export function acceptInterrupt(s: CpuState, bus: Bus): StepInfo | null {
  const enabled = s.ie && !s.eiPending;
  const hit = VECTORS.find(({ key }) =>
    s.pending[key] && (key === 'trap' || (enabled && !s.masks[MASK[key]])));
  if (!hit) return null;

  const pc = w16(s.PC);
  const c = new Ctx(s, bus);
  c.push16(pc);
  s.ieBeforeTrap = hit.key === 'trap' ? s.ie : null;
  s.ie = false;
  s.eiPending = false;
  s.pending[hit.key] = false;
  s.halted = false;
  s.PC = hit.vector;
  return {
    pc, opcode: -1, tStates: 12, memWrite: c.memWrite!,
    note: `Interrupción ${hit.name} aceptada → ${hex(hit.vector, 4)}h`,
  };
}

/**
 * Ejecuta la instrucción en `s.PC`, muta `s` y devuelve la información del paso.
 * Un opcode inválido no modifica el estado (el PC no avanza) y devuelve `error`.
 */
export function execute(s: CpuState, bus: Bus): StepInfo {
  const pc = w16(s.PC);
  const opcode = bus.read(pc) & 0xff;
  const instr = byOpcode(opcode);
  if (!instr) {
    return { pc, opcode, tStates: 0, error: `Opcode inválido ${hex(opcode, 2)}h en ${hex(pc, 4)}h` };
  }

  const b2 = instr.size >= 2 ? bus.read(w16(pc + 1)) & 0xff : 0;
  const b3 = instr.size === 3 ? bus.read(w16(pc + 2)) & 0xff : 0;
  const imm16 = (b3 << 8) | b2;
  s.PC = w16(pc + instr.size);

  const c = new Ctx(s, bus);
  // El EI anterior ya tuvo su "próxima instrucción": desde ahora rige ie.
  s.eiPending = false;
  // El valor de IE previo al TRAP solo lo ve el RIM inmediatamente posterior.
  const ieBeforeTrap = s.ieBeforeTrap;
  s.ieBeforeTrap = null;
  let taken = false; // para T-estados de condicionales
  const ddd = (opcode >> 3) & 7;
  const sss = opcode & 7;
  const rp = (opcode >> 4) & 3;

  switch (opcode >> 6) {
    case 1: // 01DDDSSS: MOV (0x76 = HLT)
      if (opcode === 0x76) s.halted = true;
      else c.setR(ddd, c.getR(sss));
      break;

    case 2: // 10OOOSSS: ALU con registro o M
      aluOp(c, ddd, c.getR(sss));
      break;

    case 0:
      switch (sss) {
        case 0: // NOP, RIM, SIM
          if (opcode === 0x20) rim(s, ieBeforeTrap);
          else if (opcode === 0x30) sim(s);
          break;
        case 1: // LXI rp / DAD rp
          if (opcode & 0x08) {
            const sum = c.HL + c.getRP(rp);
            s.flags.CY = sum > 0xffff ? 1 : 0;
            c.setRP(2, sum);
          } else {
            c.setRP(rp, imm16);
          }
          break;
        case 2: // STAX/LDAX, SHLD/LHLD, STA/LDA
          switch (ddd) {
            case 0: c.wr(c.getRP(0), s.A); break;            // STAX B
            case 1: s.A = c.rd(c.getRP(0)); break;           // LDAX B
            case 2: c.wr(c.getRP(1), s.A); break;            // STAX D
            case 3: s.A = c.rd(c.getRP(1)); break;           // LDAX D
            case 4: c.wr(imm16, s.L); c.wr(imm16 + 1, s.H); c.memWrite = imm16; break; // SHLD (informa la dir. de L)
            case 5: s.L = c.rd(imm16); s.H = c.rd(imm16 + 1); break;        // LHLD
            case 6: c.wr(imm16, s.A); break;                 // STA
            default: s.A = c.rd(imm16);                      // LDA
          }
          break;
        case 3: // INX / DCX (sin banderas)
          c.setRP(rp, c.getRP(rp) + (opcode & 0x08 ? -1 : 1));
          break;
        case 4: { // INR (CY intacto)
          const r = inr8(c.getR(ddd));
          c.setR(ddd, r.value); Object.assign(s.flags, r.flags);
          break;
        }
        case 5: { // DCR (CY intacto)
          const r = dcr8(c.getR(ddd));
          c.setR(ddd, r.value); Object.assign(s.flags, r.flags);
          break;
        }
        case 6: // MVI
          c.setR(ddd, b2);
          break;
        default: // 7: rotaciones, DAA, CMA, STC, CMC
          switch (ddd) {
            case 0: { const b7 = s.A >> 7; s.A = ((s.A << 1) | b7) & 0xff; s.flags.CY = b7 as 0 | 1; break; } // RLC
            case 1: { const b0 = s.A & 1; s.A = (s.A >> 1) | (b0 << 7); s.flags.CY = b0 as 0 | 1; break; }     // RRC
            case 2: { const b7 = s.A >> 7; s.A = ((s.A << 1) | s.flags.CY) & 0xff; s.flags.CY = b7 as 0 | 1; break; } // RAL
            case 3: { const b0 = s.A & 1; s.A = (s.A >> 1) | (s.flags.CY << 7); s.flags.CY = b0 as 0 | 1; break; }  // RAR
            case 4: c.applyAlu(daa(s.A, s.flags), true); break;  // DAA
            case 5: s.A = ~s.A & 0xff; break;                    // CMA
            case 6: s.flags.CY = 1; break;                       // STC
            default: s.flags.CY = s.flags.CY ? 0 : 1;            // CMC
          }
      }
      break;

    default: // 3: 11xxxxxx
      switch (sss) {
        case 0: // Rcc
          taken = cond(s.flags, ddd);
          if (taken) s.PC = c.pop16();
          break;
        case 1: // POP rp / RET / PCHL / SPHL
          switch (ddd) {
            case 1: s.PC = c.pop16(); break;                 // RET
            case 3: break;                                   // 0xD9: inválido (no llega)
            case 5: s.PC = c.HL; break;                      // PCHL
            case 7: s.SP = c.HL; break;                      // SPHL
            default:
              if (rp === 3) { // POP PSW
                const v = c.pop16();
                s.A = v >> 8;
                s.flags = unpackFlags(v & 0xff);
              } else {
                c.setRP(rp, c.pop16());
              }
          }
          break;
        case 2: // Jcc
          taken = cond(s.flags, ddd);
          if (taken) s.PC = imm16;
          break;
        case 3:
          switch (ddd) {
            case 0: s.PC = imm16; break;                     // JMP
            case 2: bus.out(b2, s.A); break;                 // OUT
            case 3: s.A = bus.in(b2) & 0xff; break;          // IN
            case 4: {                                        // XTHL
              const sp = s.SP;
              const lo = c.rd(sp), hi = c.rd(sp + 1);
              c.wr(sp + 1, s.H); c.wr(sp, s.L);
              s.H = hi; s.L = lo;
              break;
            }
            case 5: { // XCHG
              const h = s.H, l = s.L;
              s.H = s.D; s.L = s.E; s.D = h; s.E = l;
              break;
            }
            case 6: s.ie = false; s.eiPending = false; break; // DI
            case 7: s.ie = true; s.eiPending = true; break;    // EI (efectivo tras la próxima instrucción)
            // 1 (0xCB): inválido
          }
          break;
        case 4: // Ccc
          taken = cond(s.flags, ddd);
          if (taken) { c.push16(s.PC); s.PC = imm16; }
          break;
        case 5: // PUSH rp / CALL
          if (opcode === 0xcd) { c.push16(s.PC); s.PC = imm16; }
          else if (rp === 3) c.push16((s.A << 8) | packFlags(s.flags)); // PUSH PSW
          else c.push16(c.getRP(rp));
          break;
        case 6: // ALU inmediato
          aluOp(c, ddd, b2);
          break;
        default: // 7: RST n
          c.push16(s.PC);
          s.PC = ddd * 8;
      }
  }

  const tStates = Array.isArray(instr.tStates) ? instr.tStates[taken ? 1 : 0] : instr.tStates;
  const info: StepInfo = { pc, opcode, instr, tStates };
  if (c.memRead !== undefined) info.memRead = c.memRead;
  if (c.memWrite !== undefined) info.memWrite = c.memWrite;
  return info;
}
