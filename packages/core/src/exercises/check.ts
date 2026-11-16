import type { AssembleResult } from '../asm/assembler';
import { Machine } from '../machine/machine';
import type { CheckFailure, CheckResult, Exercise, TestCase } from './types';

const DEFAULT_LIMIT = 100_000;
const h2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0') + 'h';
const h4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0') + 'h';

/** "0040h = FFh, 0041h = 00h", o "sin datos". */
export function caseLabel(c: TestCase): string {
  if (c.label !== undefined) return c.label;
  if (c.memory.length === 0) return 'sin datos';
  return c.memory.map(([a, v]) => `${h4(a)} = ${h2(v)}`).join(', ');
}

/** Ejecuta el programa con cada caso de prueba; nunca lanza. */
export function checkExercise(program: AssembleResult, ex: Exercise, opts: { limit?: number } = {}): CheckResult {
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const total = ex.tests.length;
  const fail = (passed: number, failure: CheckFailure): CheckResult => ({ ok: false, passed, total, failure });

  if (!program.ok) {
    return fail(0, {
      kind: 'assemble', caseIndex: -1,
      message: 'El programa tiene errores de ensamblado: corregilos primero',
    });
  }
  const used = [...ex.memory, ...ex.tests.flatMap((t) => t.memory)].map(([a]) => a);
  const clash = used.find((a) => program.memory.has(a));
  if (clash !== undefined) {
    return fail(0, {
      kind: 'overlap', caseIndex: -1,
      message: `El programa ocupa ${h4(clash)}, que el ejercicio usa como dato: cambiá la dirección de inicio`,
    });
  }

  let passed = 0;
  for (const [i, c] of ex.tests.entries()) {
    const label = caseLabel(c);
    const m = new Machine(program);
    for (const [a, v] of c.memory) m.setMemory(a, v);
    const r = m.run(limit);
    if (r.reason === 'pause-limit') {
      return fail(passed, {
        kind: 'no-halt', caseIndex: i,
        message: `No llegó a HLT en ${limit} instrucciones (¿bucle infinito?) cuando ${label}`,
      });
    }
    if (r.reason === 'error') {
      return fail(passed, {
        kind: 'runtime', caseIndex: i,
        message: `Error de ejecución cuando ${label}: ${r.info?.error ?? 'error desconocido'}`,
      });
    }
    for (const [a, want] of c.expect) {
      const got = m.memory[a]!;
      if (got !== want) {
        return fail(passed, {
          kind: 'mismatch', caseIndex: i,
          message: `Falla cuando ${label}: ${h4(a)} debía ser ${h2(want)} y quedó ${h2(got)}`,
        });
      }
    }
    passed++;
  }
  return { ok: true, passed, total };
}
