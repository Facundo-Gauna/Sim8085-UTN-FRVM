# Plan 4 — Ejercicios con verificación y Toolbox

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un catálogo de ejercicios (básicos, los 5 de la cátedra GTP05 y adicionales) que se resuelven en el simulador y se verifican con el botón "Comprobar" contra varios casos de prueba, y una pantalla Toolbox (conversor de bases, complemento a 2, tabla de opcodes con buscador, tabla ASCII). Incluye la navegación entre secciones.

**Architecture:** El verificador y el catálogo viven en `@sim8085/core` (puros, probados con soluciones de referencia). En la web, un router por hash (`#/simulador`, `#/ejercicios`, `#/toolbox`, y en el plan 5 `#/documentacion`) elige la sección; el Simulador queda siempre montado (oculto) para no perder el editor ni la máquina. El store de sesión suma el ejercicio activo, su resultado y los resueltos de la sesión. Toolbox usa funciones puras de `lib/` más componentes con pestañas.

**Tech Stack:** TypeScript, React 18, Zustand, Vitest + Testing Library (como los planes 1–3). Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-15-simulador-8085-design.md` (§6.9, §6.10, §8 "verificador de ejercicios", §9.2 pantallas Ejercicios y Toolbox). Enunciados oficiales: `docs/referencia/GTP05 - Ensamblador.pdf`. Núcleo: `packages/core` (`assemble`, `Machine`, `ISA`). UI existente: `packages/web` (store `Session`, `Rail`, `App`). Visual: `design-system/MASTER.md`.

## Global Constraints

- Solo español; terminología del manual; "fuera de la cátedra" = borde punteado + etiqueta `FUERA DE CÁTEDRA` en versalitas (la tabla ASCII lo es).
- Colores y espaciado solo con tokens de `MASTER.md`; claro y oscuro; mínimo 11 px; foco visible; ningún significado solo por color (los resultados llevan ícono y texto); todo con teclado.
- Los ejercicios y la verificación **no persisten**: "resueltos" vive solo en la sesión de la página; no hay `localStorage` para esto.
- **GTP05 ej. 4** ("parte más significativa") = nibble alto conservado en su lugar y bajo en 0 (`B7h → B0h`, p. ej. `ANI F0H`) — decisión de Claude **a confirmar con la cátedra** (spec §11); queda dicho en la pista del ejercicio.
- La verificación ejecuta el programa **ensamblado desde el texto del archivo activo** (no depende de que el alumno haya ensamblado) con `limit` de 100 000 instrucciones por caso; nunca usa `confirm()`; nunca lanza.
- Cada ejercicio: enunciado, datos iniciales precargados en memoria (los del primer caso de prueba), pista (oculta hasta pedirla) y casos de prueba; si falla, el mensaje nombra el caso concreto: `Falla cuando 0040h = FFh: 0041h debía ser 00h y quedó 01h`.
- Toolbox: conversor hexa/decimal/binario/BCD con actualización simultánea; complemento a 2 con lectura con y sin signo; tabla de opcodes con buscador (mnemónico, opcode, bytes, estados T, banderas) **tomada de `ISA`**, nunca copiada a mano; tabla ASCII marcada "fuera de la cátedra".
- Hash inválido o desconocido → `#/simulador`. Los atajos del simulador (F5, F8, F10…) solo actúan cuando la sección visible es el Simulador.

## Review Focus

1. **Programa que pisa los datos del ejercicio** (el alumno elige una dirección de inicio que cubre `2000h` en el ej. 2): el verificador lo detecta y lo dice ("el programa ocupa 2000h, que el ejercicio usa como dato") en vez de dar un falso fallo. → Task 1.
2. **Bucle infinito o sin `HLT`** en la solución del alumno: "Comprobar" termina, no congela la página y dice en qué caso. → Task 1 y 5.
3. **Código con errores de ensamblado o vacío** al pulsar Comprobar: mensaje claro sin lanzar. → Task 1 y 5.
4. **Cambiar de ejercicio o salir con trabajo hecho**: abrir otro ejercicio crea un archivo nuevo (no pisa el que el alumno editaba) y carga sus datos; "Salir del ejercicio" no borra el archivo. → Task 4.
5. **Entradas del conversor inválidas o fuera de rango** (`xyz`, `1FFFFh`, BCD con grupo `1010`, decimal negativo en el conversor, vacío): se muestra el error junto al campo, los demás campos conservan su último valor válido y no se lanza. → Task 6.

---

## Estructura de archivos

```
packages/core/src/exercises/types.ts          Exercise, TestCase, CheckResult           (T1)
packages/core/src/exercises/check.ts          checkExercise                            (T1)
packages/core/src/exercises/catalog.ts        EXERCISES, getExercise                   (T2)
packages/core/test/exercises.check.test.ts, exercises.catalog.test.ts
packages/web/src/lib/useSection.ts            router por hash                          (T3)
packages/web/src/components/Rail.tsx, App.tsx navegación                               (T3)
packages/web/src/state/store.ts               ejercicio activo/resultado/resueltos     (T4)
packages/web/src/components/exercises/ExercisesPage.tsx, ExerciseBar.tsx, exercises.css, exercises.test.tsx   (T5)
packages/web/src/lib/convert.ts, twos.ts      funciones puras del conversor            (T6)
packages/web/src/components/toolbox/ToolboxPage.tsx, Converter.tsx, TwosPanel.tsx, OpcodeTable.tsx, AsciiTable.tsx, toolbox.css, toolbox.test.tsx   (T7)
```

---

### Task 1: Verificador de ejercicios (núcleo)

**Files:**
- Create: `packages/core/src/exercises/types.ts`, `packages/core/src/exercises/check.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/exercises.check.test.ts`

**Interfaces:**
- Consumes: `assemble`/`AssembleResult` (`ok`, `memory: Map<number, number>`), `Machine` (`setMemory`, `run(limit)`, `memory`).
- Produces:
```ts
export interface TestCase { label?: string; memory: [addr: number, value: number][]; expect: [addr: number, value: number][] }
export interface Exercise {
  id: string; group: 'basico' | 'catedra' | 'adicional'; title: string;
  statement: string; hint: string; start: number;
  memory: [number, number][];            // datos precargados = tests[0].memory
  tests: TestCase[]; starter: string;    // texto inicial del archivo
}
export interface CheckFailure { kind: 'assemble' | 'overlap' | 'no-halt' | 'runtime' | 'mismatch'; caseIndex: number; message: string }
export interface CheckResult { ok: boolean; passed: number; total: number; failure?: CheckFailure }
export function checkExercise(program: AssembleResult, ex: Exercise, opts?: { limit?: number }): CheckResult;
export function caseLabel(c: TestCase): string;   // '0040h = FFh, 0041h = 00h' o 'sin datos'
```
Reglas: `program.ok === false` → `kind 'assemble'`, `caseIndex -1`, mensaje `El programa tiene errores de ensamblado: corregilos primero`; si alguna dirección de `ex.memory` o de cualquier `tests[].memory` está en `program.memory` → `kind 'overlap'` con `El programa ocupa 2000h, que el ejercicio usa como dato: cambiá la dirección de inicio`; por caso: `new Machine(program)`, aplicar **solo** `case.memory`, `run(limit)` (default 100 000); razón `pause-limit` → `no-halt` `No llegó a HLT en 100000 instrucciones (¿bucle infinito?) cuando <label>`; `error` → `runtime` `Error de ejecución cuando <label>: <info.error>`; `breakpoint`/`step` no ocurren; luego comparar `expect` en orden: primer desacuerdo → `mismatch` `Falla cuando <label>: 0041h debía ser 00h y quedó 01h` (hexa mayúscula, 4 dígitos para direcciones y 2 para bytes, sufijo `h`). `passed` cuenta los casos que pasaron **antes** del primer fallo; se corta en el primero que falla.

- [ ] **Step 1: Write the failing tests** con un ejercicio chico inline (`NOT`: `0040h`→`0041h`, casos 3A→C5 y 00→FF): solución correcta (`LDA 0040H / CMA / STA 0041H / HLT`) → `{ok:true, passed:2, total:2}`; solución incorrecta (sin `CMA`) → `mismatch` con mensaje exacto `Falla cuando 0040h = 3Ah: 0041h debía ser C5h y quedó 3Ah` y `passed: 0`; fallo en el 2.º caso (programa que solo complementa si A≠0) → `passed: 1`, `caseIndex: 1`; `LP: JMP LP` → `no-halt` con `(¿bucle infinito?)`; `DB 08H` como primera instrucción (opcode inválido) → `runtime`; texto con error (`MVI A, A1H`) → `assemble`, `caseIndex -1`; programa con `ORG 0040H` y datos en `0040h` → `overlap` con `0040h`; `caseLabel({memory:[],expect:[]})` → `sin datos`; el `checkExercise` nunca lanza con `memory` vacía.
- [ ] **Step 2: Run** `npm test -w @sim8085/core -- exercises.check` — Expected: FAIL (módulo inexistente).
- [ ] **Step 3: Implement** `types.ts` y `check.ts`; exportar desde `index.ts`.
- [ ] **Step 4: Run** `npm test -w @sim8085/core` — Expected: verde.
- [ ] **Step 5: Commit** `feat(core): verificador de ejercicios`.

---

### Task 2: Catálogo de ejercicios (núcleo)

**Files:**
- Create: `packages/core/src/exercises/catalog.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/exercises.catalog.test.ts`

**Interfaces:**
- Consumes: `Exercise`, `TestCase` (T1).
- Produces: `export const EXERCISES: readonly Exercise[]`; `export function getExercise(id: string): Exercise | undefined`; `export const GROUP_TITLES: Record<Exercise['group'], string>` (`'Básicos'`, `'De la cátedra (GTP05)'`, `'Adicionales'`).

Contenido (17 ejercicios; ids y casos exactos; `start` entre paréntesis; todos los valores en hexa; `casos` = entradas → salida; el enunciado de los de la cátedra se escribe **con las palabras de `GTP05 - Ensamblador.pdf`**):

| id | start | Enunciado resumido | Casos |
|---|---|---|---|
| `gtp05-1` | 2000 | 0040h complementado → 0041h | 3A→C5, 00→FF, FF→00, 55→AA |
| `gtp05-2` | 1000 | AND de 2000h y 2001h → 2002h | (F0,3C)→30, (FF,00)→00, (AA,55)→00, (FF,FF)→FF |
| `gtp05-3` | 2000 | OR de 3000h y 3001h → 3002h | (F0,0F)→FF, (00,00)→00, (A0,05)→A5, (80,01)→81 |
| `gtp05-4` | 2000 | nibble alto de 300Ah, en la misma posición | B7→B0, 0F→00, F0→F0, 5A→50 |
| `gtp05-5` | 2000 | 2040h + A1h → 2041h | 00→A1, 5F→00, FF→A0, 3A→DB |
| `basico-cargar` | 2000 | cargar 5Ah en A y guardarlo en 3000h | sin datos → 3000h=5A |
| `basico-copiar` | 2000 | copiar 3000h a 3001h | 00, 7F, FF, 3A |
| `basico-incrementar` | 2000 | 3000h + 1 → 3001h | 00→01, FF→00, 7F→80 |
| `basico-sumar` | 2000 | 3000h + 3001h → 3002h (módulo 256) | (01,02)→03, (FF,01)→00, (80,80)→00 |
| `basico-intercambiar` | 2000 | intercambiar 3000h y 3001h | (12,34)→(34,12), (00,FF)→(FF,00) |
| `basico-doble` | 2000 | 3000h × 2 → 3001h (descartando el desborde) | 01→02, 40→80, 80→00 |
| `adic-mayor` | 2000 | el mayor (sin signo) de 3000h y 3001h → 3002h | (05,09)→09, (09,05)→09, (FF,01)→FF, (07,07)→07 |
| `adic-suma-bloque` | 2000 | N en 3000h; sumar los N bytes desde 3001h → 3100h (módulo 256) | N=0→00; N=3 [01,02,03]→06; N=1 [FF]→FF; N=4 [80,80,01,01]→02 |
| `adic-bits` | 2000 | cantidad de bits en 1 de 3000h → 3001h | 00→0, FF→8, A5→4, 01→1, 80→1 |
| `adic-rellenar` | 2000 | con 3010h–301Fh en FF, ponerlos en 00 | los 16 bytes en FF → 16 bytes en 00 (esperar los 16) |
| `adic-paridad` | 2000 | 01h en 3001h si 3000h tiene paridad par (bandera P), si no 00h | 03→01, 07→00, 00→01, FF→01 |
| `adic-copiar-bloque` | 2000 | copiar 8 bytes desde 3000h a 3100h | patrón 11 22 33 44 55 66 77 88 y un segundo patrón con 00 y FF |

Cada `hint` ≥ 20 caracteres y **no contiene la solución completa** (sugiere instrucciones o método). `starter` = comentario con el título y el enunciado en `;` + una línea en blanco + `        HLT`. Los casos con bloque llevan `label` (`N = 3, datos 01 02 03`).

- [ ] **Step 1: Write the failing tests:** (a) invariantes: ids únicos; `getExercise('gtp05-1')` existe y `getExercise('x')` es `undefined`; hay exactamente 5 `catedra`, ≥ 5 `basico` y ≥ 5 `adicional`; para cada ejercicio `memory` es igual a `tests[0].memory`, `tests.length ≥ 2` (salvo `basico-cargar`, que tiene 1), `hint.length ≥ 20`, `starter` incluye `HLT`, y `start` es una dirección de 16 bits. (b) **soluciones de referencia** (un mapa `id → texto asm` dentro del test; una por ejercicio): cada una ensambla en `ex.start`, y `checkExercise` da `ok: true`; incluir en `gtp05-4` la solución `ANI F0H`. (c) **soluciones erróneas conocidas**: `gtp05-2` con `ORA` en vez de `ANA` falla con un mensaje que empieza por `Falla cuando 2000h = `; `gtp05-5` con `ADI A0H` falla; `adic-suma-bloque` que no maneja N = 0 falla con `N = 0`; `gtp05-2` ensamblado en `start 0x2000` da `overlap`.
- [ ] **Step 2: Run** `npm test -w @sim8085/core -- exercises.catalog` — Expected: FAIL.
- [ ] **Step 3: Implement** `catalog.ts` con los 17 ejercicios y los helpers; exportar desde `index.ts`.
- [ ] **Step 4: Run** `npm test -w @sim8085/core` — Expected: verde.
- [ ] **Step 5: Commit** `feat(core): catálogo de ejercicios (básicos, GTP05 y adicionales)`.

---

### Task 3: Navegación entre secciones

**Files:**
- Create: `packages/web/src/lib/useSection.ts`
- Modify: `packages/web/src/components/Rail.tsx`, `packages/web/src/App.tsx`, `packages/web/src/lib/useShortcuts.ts` (solo si hace falta recibir `enabled`)
- Test: `packages/web/src/lib/useSection.test.tsx`, `packages/web/src/App.test.tsx`

**Interfaces:**
- Produces: `export type Section = 'simulador' | 'ejercicios' | 'documentacion' | 'toolbox'`; `export function parseHash(hash: string): { section: Section; rest: string[] }` (`'#/ejercicios'` → `{section:'ejercicios', rest:[]}`; `'#/documentacion/registros'` → `rest:['registros']`; vacío o desconocido → `simulador`); `export function useSection(): { section: Section; rest: string[]; go(section: Section, ...rest: string[]): void }` (escucha `hashchange`, `go` asigna `location.hash`).
- `Rail` recibe `{ section: Section; onGo(s: Section): void; enabled: Section[] }`: los botones de secciones habilitadas son reales (`aria-current="page"` en la actual); los no habilitados siguen `aria-disabled` con "Próximamente". En este plan `enabled = ['simulador','ejercicios','toolbox']`.
- `App` renderiza `Simulator` **siempre**, con el atributo `hidden` cuando la sección no es el Simulador, y la página de la sección activa al lado. Los atajos globales se ignoran si la sección visible no es el Simulador. En celular (<900 px) sigue mostrándose solo el aviso (el plan 5 suma la documentación).

- [ ] **Step 1: Write the failing tests:** `parseHash` con los 5 casos anteriores y con `'#/ejercicios/'` y `'#/x'`; `useSection` cambia al emitir `hashchange` y `go('toolbox')` deja `location.hash === '#/toolbox'`; App: botón "Ejercicios" del Rail → aparece la región "Ejercicios" y el Simulador queda en el DOM con `hidden` (el editor conserva su texto al volver); F5 estando en Toolbox **no** ensambla; el botón "Documentación" sigue `aria-disabled`.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- useSection App` — Expected: FAIL.
- [ ] **Step 3: Implement** el hook, el Rail y el montaje en `App` (con páginas provisorias `<section aria-label="Ejercicios">` / `"Toolbox"` que T5 y T7 reemplazan).
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): navegación por secciones`.

---

### Task 4: Ejercicio activo en la sesión

**Files:**
- Modify: `packages/web/src/state/store.ts`
- Test: `packages/web/src/state/store.test.ts`

**Interfaces:**
- Consumes: `EXERCISES`, `getExercise`, `checkExercise`, `assemble`, `CheckResult` (núcleo).
- Produces en `Session`: `exercise: Exercise | null`; `exerciseResult: CheckResult | null`; `solved: Set<string>`; `startExercise(id: string): boolean` (false si no existe); `leaveExercise(): void`; `checkExerciseNow(): CheckResult | null`.

Reglas: `startExercise` crea un archivo **nuevo** con nombre `<id>.asm` (si ya existe uno igual abierto, `<id>-2.asm`, etc.) y texto `ex.starter`, lo activa, pone `startAddress = ex.start`, **reemplaza** `userMemory` por `ex.memory` y `inputs` por vacío (limpia el ensamblado como cualquier cambio de archivo), pone `exercise = ex`, `exerciseResult = null`, estado `info` `Ejercicio cargado: <título>`. `leaveExercise` pone `exercise = null` y `exerciseResult = null` y no toca archivos. `checkExerciseNow` (sin ejercicio → `null`): ensambla el **texto del archivo activo** con `{ start: startAddress }`, llama `checkExercise`, guarda el resultado, y si `ok` agrega el id a `solved` (nuevo `Set`) y estado `info` `¡Correcto! Pasó los N casos`; si falla, estado `error` con `failure.message`. No modifica `asm`/`machine`.

- [ ] **Step 1: Write the failing tests:** `startExercise('gtp05-1')` → archivo nuevo activo con el starter, `startAddress 0x2000`, `userMemory` = `Map{0x40→0x3a}`, `exercise.id`; no pisa el archivo anterior (sigue en `files`); abrir el mismo dos veces → nombres `gtp05-1.asm` y `gtp05-1-2.asm`; `startExercise('x')` → `false` y estado intacto; `checkExerciseNow` con la solución correcta pone `ok`, agrega a `solved` y el estado dice `¡Correcto! Pasó los 4 casos`; con solución errónea → `failure.kind 'mismatch'` y estado de error; con texto con errores → `kind 'assemble'` sin lanzar; con `LP: JMP LP` → `no-halt`; sin ejercicio → `null`; `leaveExercise` conserva el archivo y limpia `exercise`; `checkExerciseNow` no cambia `asm` ni `machine`.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- store` — Expected: FAIL.
- [ ] **Step 3: Implement** el estado y las tres acciones.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): ejercicio activo, comprobación y resueltos en la sesión`.

---

### Task 5: Pantalla Ejercicios y barra del ejercicio

**Files:**
- Create: `packages/web/src/components/exercises/ExercisesPage.tsx`, `ExerciseBar.tsx`, `exercises.css`
- Modify: `packages/web/src/App.tsx` (montar la página y la barra)
- Test: `packages/web/src/components/exercises/exercises.test.tsx`

**Interfaces:**
- Consumes: `EXERCISES`, `GROUP_TITLES` (T2); `Session.startExercise`, `exercise`, `exerciseResult`, `solved`, `checkExerciseNow`, `leaveExercise` (T4); `useSection().go` (T3).
- Produces: `<ExercisesPage />` (región `aria-label="Ejercicios"`); `<ExerciseBar />` (región `aria-label="Ejercicio activo"`, solo se monta si `exercise !== null`, entre la barra de herramientas y el área de trabajo del Simulador).

Comportamiento: **Ejercicios** — lista agrupada con tres encabezados (`GROUP_TITLES`), cada ejercicio un botón con título y, si está en `solved`, el texto "Resuelto" con ícono (no solo color); al elegir uno se muestra a la derecha el detalle: título, enunciado, tabla "Datos iniciales" (dirección/valor en hexa), `<details>` "Pista" (cerrado), y el botón **Resolver en el simulador** (llama `startExercise` y `go('simulador')`). **ExerciseBar** — una línea compacta: `Ejercicio: <título>`, botón **Comprobar** (llama `checkExerciseNow`), botón **Pista** (alterna el texto de la pista debajo), botón **Salir del ejercicio**, y un `role="status"` con el resultado (`¡Correcto! Pasó los N casos` con ícono de check, o el `failure.message` con ícono de alerta); el enunciado completo se ve en un `<details>` "Enunciado". Sin textos de presentación.

- [ ] **Step 1: Write the failing tests:** la página muestra los tres grupos con 5 de la cátedra; elegir "gtp05-1" muestra su enunciado y la tabla con `0040h` / `3Ah`; la pista está oculta hasta abrir el `<details>`; "Resolver en el simulador" deja `location.hash === '#/simulador'`, `exercise.id === 'gtp05-1'` y la barra visible con "Comprobar"; **Comprobar** con el starter (solo `HLT`) muestra `Falla cuando 0040h = 3Ah` en el `role=status`; tras escribir la solución correcta con `setText` y volver a comprobar muestra `¡Correcto! Pasó los 4 casos`, y al volver a la página el ejercicio aparece con "Resuelto"; con `LP: JMP LP` muestra `No llegó a HLT` y la página sigue respondiendo; "Salir del ejercicio" quita la barra sin borrar el archivo.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- exercises` — Expected: FAIL.
- [ ] **Step 3: Implement** los dos componentes y su CSS con tokens; montarlos en `App`.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` y `npm run build -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): pantalla de ejercicios con Comprobar`.

---

### Task 6: Funciones puras del Toolbox

**Files:**
- Create: `packages/web/src/lib/convert.ts`, `packages/web/src/lib/twos.ts`
- Test: `packages/web/src/lib/convert.test.ts`, `packages/web/src/lib/twos.test.ts`

**Interfaces:**
- Produces:
```ts
export type Conv = { ok: true; value: number } | { ok: false; error: string };
export const MAX16 = 0xffff;
export function parseHexText(t: string): Conv;   // '3A', '3Ah', '0x3A'; vacío → error 'Escribí un valor'
export function parseDecText(t: string): Conv;   // solo dígitos 0–65535
export function parseBinText(t: string): Conv;   // 0/1, admite espacios y '_' ; hasta 16 bits
export function parseBcdText(t: string): Conv;   // grupos de 4 bits (espacios admitidos); cada grupo 0000–1001; hasta 4 dígitos
export function toHex(v: number): string;        // '3Ah' (2 dígitos si ≤ FFh, si no 4)
export function toDec(v: number): string;
export function toBin(v: number): string;        // nibbles separados: '0011 1010'
export function toBcd(v: number): string;        // '0011 1010' para 3A→58; vacío si v > 9999

export interface TwosView { bits: 8 | 16; unsigned: number; signed: number; ones: number; twos: number; binary: string }
export function analyze(value: number, bits: 8 | 16): TwosView;           // value se toma módulo 2^bits
export function parseSigned(t: string, bits: 8 | 16): Conv;               // admite '-5', '+5', '5', '0FBh', '11111011b'; decimal negativo → complemento a 2; fuera de [-2^(bits-1), 2^bits-1] → error
```
Mensajes de error exactos: `Escribí un valor`; `No es hexadecimal`; `No es decimal`; `No es binario`; `Máximo 16 bits (FFFFh)`; `Máximo 65535`; `Grupo BCD inválido: 1010` (con el grupo); `BCD: máximo 4 dígitos`; `Fuera de rango para N bits`.

- [ ] **Step 1: Write the failing tests:** `parseHexText('3A')`/`('3Ah')`/`('0x3A')` → 58; `('1FFFF')` → `Máximo 16 bits (FFFFh)`; `('xyz')` → `No es hexadecimal`; `('')` → `Escribí un valor`; `parseDecText('65536')` → `Máximo 65535`; `('-1')` → `No es decimal`; `parseBinText('0011 1010')` → 58; `('102')` → `No es binario`; `parseBcdText('0101 1000')` → 58 (decimal 58 ⇒ **el valor es 58**, o sea `3Ah`); `parseBcdText('1010')` → `Grupo BCD inválido: 1010`; `toBcd(58)` → `0101 1000`; `toBcd(10000)` → `''`; `toHex(0x3a)` → `3Ah`, `toHex(0x1234)` → `1234h`; `toBin(0x3a)` → `0011 1010`; `analyze(0xfb, 8)` → `{unsigned:251, signed:-5, ones:0x04, twos:0x05, binary:'1111 1011'}`; `analyze(0x80, 8).signed` → `-128`; `analyze(0x8000,16).signed` → `-32768`; `analyze(0, 8).twos` → `0`; `parseSigned('-5', 8)` → 0xFB; `('-129', 8)` → `Fuera de rango para 8 bits`; `('0FBh', 8)` → 0xFB; `('256', 8)` → `Fuera de rango para 8 bits`.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- convert twos` — Expected: FAIL.
- [ ] **Step 3: Implement** ambos módulos.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): conversión de bases y complemento a 2`.

---

### Task 7: Pantalla Toolbox

**Files:**
- Create: `packages/web/src/components/toolbox/ToolboxPage.tsx`, `Converter.tsx`, `TwosPanel.tsx`, `OpcodeTable.tsx`, `AsciiTable.tsx`, `toolbox.css`
- Modify: `packages/web/src/App.tsx` (reemplazar la página provisoria)
- Test: `packages/web/src/components/toolbox/toolbox.test.tsx`

**Interfaces:**
- Consumes: funciones de T6; `ISA` (núcleo).
- Produces: `<ToolboxPage />` (región `aria-label="Toolbox"`) con una `tablist` accesible (flechas, Home/End) de cuatro pestañas: **Conversor**, **Complemento a 2**, **Opcodes**, **ASCII**.

Comportamiento: **Conversor** — 4 campos (Hexadecimal, Decimal, Binario, BCD): al editar uno válido los otros tres se actualizan; uno inválido muestra su error (`role="alert"`, `aria-invalid`) y **no** cambia los otros. **Complemento a 2** — selector 8/16 bits, un campo (`parseSigned`) y una lista con: Sin signo, Con signo, Complemento a 1, Complemento a 2, Binario. **Opcodes** — buscador (`type=search`, etiqueta "Buscar instrucción") que filtra por mnemónico, opcode hexa, o texto del resumen (sin distinguir mayúsculas), con contador "N de 246" en una región `aria-live="polite"`; tabla con columnas Opcode, Mnemónico (con operandos), Bytes, Estados T (`7/12` en condicionales), Banderas (S Z AC P CY que modifica, o `—`), Resumen. **ASCII** — 0–127 con Dec, Hex, Carácter (los de control con su nombre `NUL … DEL`, el espacio como `SP`), y la etiqueta `FUERA DE CÁTEDRA` con borde punteado sobre la tabla.

- [ ] **Step 1: Write the failing tests:** Conversor — escribir `3A` en Hexadecimal pone `58`, `0011 1010`, `0101 1000`; escribir `xyz` muestra `No es hexadecimal`, `aria-invalid` y deja Decimal en `58`; BCD `1010` muestra `Grupo BCD inválido: 1010`; Complemento a 2 — `-5` en 8 bits muestra Con signo `-5`, Sin signo `251`, Complemento a 2 `05h`; cambiar a 16 bits recalcula; Opcodes — sin filtro "246 de 246"; buscar `jnz` deja 1 fila con `C2` y `JNZ addr`; buscar `3a` encuentra `LDA` (opcode `3A`); buscar `zzzz` → "0 de 246" y mensaje "Sin resultados"; la fila de `JNZ` muestra Estados T `7/10`; la de `MOV A,B` muestra Bytes `1`; ASCII — `41h` es `A`, `0Ah` es `LF`, `20h` es `SP`, `7Fh` es `DEL`, y está la etiqueta `FUERA DE CÁTEDRA`; tablist: ArrowRight cambia de pestaña y mueve el foco.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- toolbox` — Expected: FAIL.
- [ ] **Step 3: Implement** los componentes con tokens de `MASTER.md`; las tablas largas dentro de un contenedor con `overflow: auto` y `tabIndex=0` y etiqueta.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` y `npm run build -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): Toolbox con conversor, complemento a 2, opcodes y ASCII`.

---

### Task 8: Revisión y cierre

- [ ] **Step 1:** Con el navegador disponible, revisar Ejercicios y Toolbox en claro y oscuro a 1280 y 1024 px (foco visible, tablas con scroll, nada desborda); si la extensión de Chrome no está conectada, anotarlo en el ledger.
- [ ] **Step 2:** Registrar en `design-system/MASTER.md` cualquier token o patrón nuevo, justificado.
- [ ] **Step 3:** `npm test -w @sim8085/core`, `npm test -w @sim8085/web`, `npx tsc -p packages/web --noEmit` y `npm run build -w @sim8085/web` en verde. Commit `style(web): ajustes de ejercicios y Toolbox`.

---

## Self-review (hecho)

- **Spec §6.9:** catálogo con básicos, 5 de la cátedra y adicionales (T2); enunciado, datos precargados, pista, "Comprobar" con varios casos y mensaje del caso que falla (T1, T2, T4, T5); ej. 4 como nibble alto con aviso de confirmación (Global Constraints, T2). **§6.10:** conversor hexa/decimal/binario/BCD simultáneo, complemento a 2 con y sin signo, tabla de opcodes con buscador desde `ISA`, ASCII "fuera de la cátedra" (T6–T7). **§8:** verificador en el núcleo (T1). **§9.2:** pantallas Ejercicios y Toolbox (T5, T7).
- **No cubierto aquí a propósito:** documentación, Términos y Privacidad, aviso/doc en celular (plan 5); escritorio (plan 6).
- **Consistencia de tipos:** `Exercise`, `TestCase`, `CheckResult`, `CheckFailure` (T1) se usan igual en T2, T4 y T5; `Conv` y las funciones `parse*`/`to*`/`analyze` (T6) son las que consume T7; `Section`/`useSection` (T3) los usan T5 y el plan 5.
- **Proporción:** el plan da firmas, valores y pruebas; los cuerpos los escribe quien implementa.
