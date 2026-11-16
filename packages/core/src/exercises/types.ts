/** Ejercicios con verificación automática (spec §6.9). */
export interface TestCase {
  /** Texto del caso; si falta se arma con los datos de entrada. */
  label?: string;
  /** Datos de entrada (dirección, byte): se cargan en una máquina nueva. */
  memory: [addr: number, value: number][];
  /** Resultado esperado (dirección, byte), revisado en orden. */
  expect: [addr: number, value: number][];
}

export interface Exercise {
  id: string;
  group: 'basico' | 'catedra' | 'adicional';
  title: string;
  statement: string;
  hint: string;
  /** Dirección de inicio del programa. */
  start: number;
  /** Datos precargados para el alumno: son los del primer caso de prueba. */
  memory: [number, number][];
  tests: TestCase[];
  /** Texto inicial del archivo del ejercicio. */
  starter: string;
}

export interface CheckFailure {
  kind: 'assemble' | 'overlap' | 'no-halt' | 'runtime' | 'mismatch';
  /** Índice del caso que falló (-1 si no depende de un caso). */
  caseIndex: number;
  message: string;
}

export interface CheckResult {
  ok: boolean;
  /** Casos que pasaron antes del primer fallo. */
  passed: number;
  total: number;
  failure?: CheckFailure;
}
