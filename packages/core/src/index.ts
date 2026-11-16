export const VERSION = '0.1.0';

export * from './isa/types';
export { ISA, INVALID_OPCODES } from './isa/table';
export { byOpcode, findInstr } from './isa/lookup';

export { assemble } from './asm/assembler';
export type { AssembleResult, ListingRow, AsmMessage } from './asm/assembler';
export { parseNumber } from './asm/numbers';
export type { NumResult } from './asm/numbers';
export { lexLine, DIRECTIVES, NAMED_DIRECTIVES } from './asm/lexer';
export type { SourceLine } from './asm/lexer';

export { initialState, packFlags, unpackFlags } from './cpu/state';
export type { CpuState, Flags } from './cpu/state';
export { parity, add8, sub8, and8, or8, xor8, inr8, dcr8, daa } from './cpu/alu';
export type { AluOut } from './cpu/alu';
export { execute, acceptInterrupt } from './cpu/execute';
export type { Bus, StepInfo } from './cpu/execute';

export { Machine } from './machine/machine';
export type { StopReason, OutEvent, RunResult, Change, Irq } from './machine/machine';
export { buildTrace } from './machine/trace';
export type { TraceRow, TraceResult } from './machine/trace';
export { computeMetrics, diffMetrics } from './machine/metrics';
export type { Metrics } from './machine/metrics';
export { describeInstruction } from './asm/observation';

export { checkExercise, caseLabel } from './exercises/check';
export type { Exercise, TestCase, CheckResult, CheckFailure } from './exercises/types';
