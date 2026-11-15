# Plan 1 — Núcleo del simulador 8085 (ensamblador + CPU + traza)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un paquete TypeScript sin interfaz (`@sim8085/core`) que ensambla código 8085 (directivas y macros incluidas), lo ejecuta instrucción por instrucción con paso atrás, puertos e interrupciones, y produce la traza y las métricas que usarán la UI y los PDF.

**Architecture:** Funciones puras + una clase `Machine` con estado mutable y un historial de deltas para el paso atrás. La tabla de instrucciones (`isa/`) es la única fuente de opcodes, tamaños, estados T y banderas; el ensamblador y la CPU la consumen. Ninguna dependencia de React, DOM ni Tauri.

**Tech Stack:** TypeScript 5 (strict), Node ≥ 20, npm workspaces, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-simulador-8085-design.md` (§6.2–6.7, §8). Fuente técnica: `Set de Instrucciones - Microprocesador 8085.pdf` (escaneado: transcribir de las imágenes; tabla de opcodes en págs. 19–20, ciclos/estados/banderas en la ficha de cada instrucción).

**Serie de planes** (cada uno produce software que funciona por sí solo):
1. **Núcleo** ← este plan
2. Interfaz web del simulador (React, editor, paneles, `MASTER.md`) — usa Frontend Design
3. Exportación PDF (las dos plantillas)
4. Ejercicios + verificador, Toolbox
5. Documentación, Términos/Privacidad, aviso móvil, despliegue en Vercel
6. Escritorio con Tauri (carpetas, árbol de archivos) — revisión final con Impeccable

## Global Constraints

- Solo las 246 instrucciones oficiales del 8085 (opcodes de las págs. 19–20). Los 10 huecos de la tabla (`08 10 18 28 38 CB D9 DD ED FD`) son opcodes inválidos: la ejecución se detiene con error.
- Hexa con sufijo `H` (con `0` inicial si empieza con letra), binario sufijo `B`, decimal sin sufijo. No distingue mayúsculas/minúsculas.
- Directivas: `ORG`, `EQU`, `DB`, `DW`, `DS`, `END`; macros `MACRO`/`ENDM`. Todo lo que no está en el Set de Instrucciones lleva `inCatedra: false`.
- Sin `ORG`, el programa empieza en la dirección de inicio que recibe el ensamblador (por defecto `0x0000`); un `ORG` en el código manda.
- Comentario de línea (`; …`) = Observación; se conserva textual (sin el `;` ni espacios iniciales).
- Tope de observación: 80 caracteres → advertencia (no error).
- "Ejecutar todo" pausa cada **100 000** instrucciones sin HLT.
- Reinicio: registros, banderas, SP y PC a 0 (PC = dirección de inicio ensamblada); la memoria conserva datos cargados y programa.
- Traza para PDF: tope de **500** filas.
- Mensajes de error y advertencia **en español**, con número de línea.
- Banderas: S, Z, AC, P, CY (bits 7, 6, 4, 2, 0 del byte de banderas; bit 1 = 1, bits 3 y 5 = 0 al hacer `PUSH PSW`).

## Review Focus

1. **Hexa que empieza con letra sin `0`** (`MVI A, A1H`): un alumno lo escribe seguido; se espera error claro "¿Quisiste decir 0A1H?", no "etiqueta no definida". → Task 5.
2. **Paso atrás tras escribir memoria y puertos** (`STA`, `PUSH`, `OUT`, código automodificable): el estado debe volver exacto, incluida la memoria y la lista de OUT. → Task 8.
3. **Desbordes de 16 bits** (`SP` en `0000h` y `PUSH`, `INX` en `FFFFh`, PC que pasa `FFFFh`): envolver a `FFFFh`/`0000h`, sin excepción. → Task 7.
4. **Semántica de CY en restas y CMP** (CY = préstamo): `SUB` con A < operando pone CY = 1; `CMP` deja A igual. Error típico de simuladores. → Task 6.
5. **Punto de corte en una línea de macro o de directiva**: se mapea a la primera instrucción generada; en una línea sin bytes (`EQU`, comentario) se rechaza con mensaje. → Task 8.

---

## Estructura de archivos

```
package.json                      workspaces: ["packages/*"]
tsconfig.base.json
packages/core/
  package.json  tsconfig.json  vitest.config.ts
  src/index.ts                    reexporta la API pública
  src/isa/types.ts                tipos de la tabla
  src/isa/table.ts                las 246 entradas
  src/isa/lookup.ts               búsquedas por opcode / mnemónico
  src/asm/numbers.ts              parseo de literales
  src/asm/lexer.ts                línea → tokens (etiqueta, mnemónico, operandos, comentario)
  src/asm/macros.ts               expansión MACRO/ENDM
  src/asm/assembler.ts            dos pasadas → AssembleResult
  src/cpu/state.ts                CpuState, Flags, estado inicial
  src/cpu/alu.ts                  sumas/restas/lógicas con banderas
  src/cpu/execute.ts              ejecuta una instrucción
  src/machine/machine.ts          Machine: memoria, puertos, interrupciones, historial, run/step/back
  src/machine/trace.ts            filas de la plantilla Registros-Banderas-Memoria
  src/machine/metrics.ts          métricas y diferencia contra corrida anterior
  test/…                          un archivo por módulo
```

---

### Task 1: Repositorio y paquete `core`

**Files:**
- Create: `.gitignore`, `package.json`, `tsconfig.base.json`, `packages/core/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`, `packages/core/test/smoke.test.ts`

**Interfaces:**
- Produces: `npm test -w @sim8085/core` ejecuta Vitest; `import { … } from '@sim8085/core'`.

- [ ] **Step 1:** `git init`, `.gitignore` con `node_modules`, `dist`, `target`, `*.log`. Mover los PDF y `Idea.md` a `docs/referencia/` (no se borran).
- [ ] **Step 2:** Test `smoke.test.ts`: `expect(VERSION).toBe('0.1.0')` importando de `../src/index`.
- [ ] **Step 3:** Run `npm test -w @sim8085/core` → FAIL (no existe `VERSION`).
- [ ] **Step 4:** `export const VERSION = '0.1.0'` en `src/index.ts`; TS `strict: true`, `noUncheckedIndexedAccess: true`, `module: ESNext`, `target: ES2022`.
- [ ] **Step 5:** Run → PASS. Commit `chore: monorepo y paquete core`.

### Task 2: Tabla de instrucciones (ISA)

**Files:**
- Create: `src/isa/types.ts`, `src/isa/table.ts`, `src/isa/lookup.ts`, `test/isa.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type OperandKind = 'r' | 'rp' | 'rpPush' | 'd8' | 'd16' | 'addr' | 'port' | 'rstN';
  type FlagName = 'S' | 'Z' | 'AC' | 'P' | 'CY';
  interface InstrDef {
    opcode: number; mnemonic: string;          // 'MOV', 'MVI', 'JNZ'…
    operands: string[];                        // forma literal: ['A','M'], ['B','d8'], ['addr'], []
    size: 1 | 2 | 3;
    tStates: number | [notTaken: number, taken: number];
    machineCycles: number | [number, number];
    flags: FlagName[];                         // banderas que puede modificar
    summary: string;                           // una línea en español, p. ej. 'Copia el contenido de r2 en r1'
  }
  const ISA: readonly InstrDef[];
  function byOpcode(op: number): InstrDef | undefined;
  function findInstr(mnemonic: string, operands: string[]): InstrDef | undefined; // operands ya normalizados: registros en mayúsculas, valores como 'd8'/'d16'/'addr'/'port'
  const INVALID_OPCODES: readonly number[];   // [0x08,0x10,0x18,0x28,0x38,0xCB,0xD9,0xDD,0xED,0xFD]
  ```

- [ ] **Step 1: Tests** en `isa.test.ts`:
  - `ISA.length === 246`; opcodes únicos; `INVALID_OPCODES` ∪ opcodes de ISA = 0x00–0xFF.
  - Muestras de la pág. 19: `byOpcode(0x3A)` → `LDA ['addr']`, size 3, tStates 13; `0x2F` CMA size 1 tStates 4 flags `[]`; `0x76` HLT tStates 5; `0x30` SIM tStates 4; `0x7E` MOV A,M tStates 7; `0xC2` JNZ tStates `[7,10]`; `0xC4` CNZ `[9,18]`; `0xC0` RNZ `[6,12]`; `0xCD` CALL 18; `0x09` DAD B 10 flags `['CY']`; `0x27` DAA flags `['S','Z','AC','P','CY']`; `0xE6` ANI flags los 5.
  - `findInstr('MOV',['A','M'])?.opcode === 0x7E`; `findInstr('MVI',['M','d8'])?.opcode === 0x36`; `findInstr('PUSH',['PSW'])?.opcode === 0xF5`; `findInstr('RST',['7'])?.opcode === 0xFF`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Transcribir la tabla de las págs. 19–20 del manual; estados y banderas de la ficha de cada instrucción (págs. 1–17). Generar las familias regulares (MOV, ALU r, INR/DCR, MVI, RST) con bucles; el resto, a mano. `summary` en español con la terminología del manual.
- [ ] **Step 4:** Run → PASS. Commit `feat(core): tabla ISA del 8085 según el manual`.

### Task 3: Estado de CPU y ALU

**Files:**
- Create: `src/cpu/state.ts`, `src/cpu/alu.ts`, `test/alu.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface Flags { S: 0|1; Z: 0|1; AC: 0|1; P: 0|1; CY: 0|1 }
  interface CpuState { A:number;B:number;C:number;D:number;E:number;H:number;L:number;
    SP:number; PC:number; flags:Flags; halted:boolean;
    ie:boolean; masks:{m55:boolean;m65:boolean;m75:boolean}; pending:{r75:boolean;r65:boolean;r55:boolean;trap:boolean}; sid:0|1; sod:0|1 }
  function initialState(pc: number): CpuState;          // todo en 0, PC = pc, masks todas true (enmascaradas)
  function packFlags(f: Flags): number; function unpackFlags(b: number): Flags;
  interface AluOut { value:number; flags: Partial<Flags> }
  function add8(a:number,b:number,carryIn:0|1): AluOut;  // ADD/ADC/ADI/ACI
  function sub8(a:number,b:number,borrowIn:0|1): AluOut; // SUB/SBB/SUI/SBI/CMP (CY = préstamo)
  function and8(a:number,b:number): AluOut;              // AC = 1 (comportamiento 8085), CY = 0
  function or8(a:number,b:number): AluOut;  function xor8(a:number,b:number): AluOut; // AC = 0, CY = 0
  function inr8(v:number): AluOut; function dcr8(v:number): AluOut; // no tocan CY
  function daa(a:number,f:Flags): AluOut;
  function parity(v:number): 0|1;                         // 1 = paridad par
  ```

- [ ] **Step 1: Tests**:
  - `packFlags({S:1,Z:0,AC:1,P:1,CY:1})` = `0b1001_0111` (bit 1 siempre 1).
  - `add8(0x93,0x08,0)` → value `0x9B`, CY 0, AC 0 (manual pág. 18); `daa(0x9B,{…AC:0,CY:0})` → `0x01`, CY 1, AC 1.
  - Ejemplo 2 pág. 18: `add8(0x89,0x36,0)` → `0xBF`; `daa` → `0x25`, CY 1.
  - `sub8(0x05,0x07,0)` → `0xFE`, CY 1, S 1, Z 0. `sub8(0x07,0x07,0)` → 0, Z 1, CY 0, P 1.
  - `inr8(0xFF)` → 0, Z 1, sin clave `CY` en `flags`. `dcr8(0x00)` → `0xFF`, S 1.
  - `and8(0xB7,0xF0)` → `0xB0`, AC 1, CY 0 (GTP05 ej. 4).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. AC en suma = acarreo del bit 3; en resta, el 8085 lo calcula como suma del complemento a 2 (`a + (~b & 0xFF) + (1-borrowIn)`, AC = acarreo del bit 3 de esa suma).
- [ ] **Step 4:** PASS. Commit `feat(core): estado de CPU y ALU`.

### Task 4: Literales y lexer

**Files:**
- Create: `src/asm/numbers.ts`, `src/asm/lexer.ts`, `test/lexer.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type NumResult = { ok:true; value:number } | { ok:false; error:string };
  function parseNumber(text: string): NumResult | null;  // null = no parece número (puede ser símbolo)
  interface SourceLine { line:number; label?:string; op?:string; args:string[]; comment?:string; raw:string }
  function lexLine(raw: string, line: number): SourceLine;
  ```
  `args` = operandos separados por coma, sin espacios; `'…'` dentro de `DB` es una cadena.

- [ ] **Step 1: Tests**: `parseNumber('2AH')` → 42; `'0A1H'` → 161; `'00101010B'` → 42; `'42'` → 42; `'1FFFFH'` → error "fuera de rango"; `'BUCLE'` → `null`. `lexLine('INICIO: LDA 0040H ; A ← M[0040h]',1)` → `{label:'INICIO', op:'LDA', args:['0040H'], comment:'A ← M[0040h]'}`. `lexLine('  mvi a , 5',2)` → `op:'MVI', args:['A','5']`. `lexLine("MSG: DB 'HOLA', 0",3)` → `args:["'HOLA'",'0']`. Un `;` dentro de comillas no corta. Línea vacía → sólo `line` y `raw`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. Commit `feat(core): literales y lexer`.

### Task 5: Ensamblador (dos pasadas, directivas, macros)

**Files:**
- Create: `src/asm/macros.ts`, `src/asm/assembler.ts`, `test/assembler.test.ts`

**Interfaces:**
- Consumes: `findInstr`, `parseNumber`, `lexLine`.
- Produces:
  ```ts
  interface AsmMessage { line:number; severity:'error'|'warning'; message:string }
  interface ListingRow {                         // una por instrucción o directiva que genera bytes
    line:number;                                 // línea fuente (para macros: la línea de la llamada)
    address:number; bytes:number[];
    source:string;                               // mnemónico normalizado, p. ej. 'LDA 0040H'
    comment?:string; fromMacro?:string;          // nombre de la macro si viene de una expansión
    instr?:InstrDef; inCatedra:boolean;
  }
  interface AssembleResult {
    ok:boolean; messages:AsmMessage[];
    rows:ListingRow[];                           // orden de dirección
    memory:Map<number,number>;                   // dirección → byte
    symbols:Map<string,number>;
    lineToAddress:Map<number,number>;            // línea → primera dirección generada
    addressToLine:Map<number,number>;            // dirección de inicio de instrucción → línea
    start:number; end:number;                    // primer y último byte usado
    sizeBytes:number;
  }
  function assemble(source: string, opts?: { start?: number }): AssembleResult;
  ```

- [ ] **Step 1: Tests** (`assemble`):
  - GTP05 ej. 1 con `start: 0x2000`: `LDA 0040H / CMA / STA 0041H / HLT` → memoria `2000:3A 40 00 2F 32 41 00 76`, `sizeBytes 7`, `rows[0].comment` conservado.
  - `ORG 3000H` gana sobre `start: 0x2000`.
  - Referencia hacia adelante: `JMP FIN … FIN: HLT` resuelve la dirección.
  - `EQU`: `DATO EQU 0040H` + `LDA DATO` → `3A 40 00`; `rows` no incluye la línea EQU.
  - `DB 05H, 'AB', 12` → `05 41 42 0C`; `DW 1234H` → `34 12`; `DS 3` reserva 3 bytes sin escribirlos.
  - Macro: `SUMA2 MACRO X\n ADI X\n ADI X\n ENDM` + `SUMA2 01H` → dos filas `ADI 01H` con `fromMacro:'SUMA2'`, `line` = línea de la llamada, `inCatedra:false`; el comentario de la llamada va sólo en la primera fila.
  - Errores (en español, con línea): mnemónico desconocido; `MVI A` sin dato → "MVI necesita un registro y un dato de 8 bits"; `MVI A, 300` → fuera de rango 8 bits; etiqueta duplicada; **`MVI A, A1H` → "¿Quisiste decir 0A1H? Un número hexadecimal que empieza con letra lleva un 0 adelante."** (Review Focus 1); bytes superpuestos → error "el código se superpone en 2003h".
  - Advertencia: comentario de 81 caracteres → warning "La observación supera los 80 caracteres".
  - `END` ignora lo que sigue.
- [ ] **Step 2:** FAIL.
- [ ] **Step 3:** Pasada 0: expandir macros (parámetros por sustitución textual de nombre completo). Pasada 1: direcciones y símbolos. Pasada 2: codificar con `findInstr`; operandos numéricos o simbólicos se normalizan a `d8`/`d16`/`addr`/`port` según la forma de la instrucción. Expresiones: sólo símbolo o literal (sin aritmética; YAGNI).
- [ ] **Step 4:** PASS. Commit `feat(core): ensamblador con directivas y macros`.

### Task 6: Ejecución de instrucciones

**Files:**
- Create: `src/cpu/execute.ts`, `test/execute.test.ts`

**Interfaces:**
- Consumes: `CpuState`, ALU, `byOpcode`.
- Produces:
  ```ts
  interface Bus { read(a:number):number; write(a:number,v:number):void; in(port:number):number; out(port:number,v:number):void }
  interface StepInfo { pc:number; opcode:number; instr?:InstrDef; tStates:number;
    memRead?:number; memWrite?:number;          // dirección de dato tocada (para la traza)
    error?:string }                             // 'Opcode inválido 08h en 2005h'
  function execute(s: CpuState, bus: Bus): StepInfo;   // muta s
  ```

- [ ] **Step 1: Tests** (con un `Bus` de prueba sobre `Uint8Array(65536)`): una prueba por grupo del manual, con valores exactos:
  - Transferencia: `LDA`/`STA` (memRead/memWrite = 0040h/0041h), `LHLD`/`SHLD` (byte bajo primero), `XCHG`, `MOV M,A` usa HL.
  - Aritmético: `ADD`, `ADC` con CY, `SUB` 05h−07h → CY 1 (Review Focus 4), `CMP` deja A intacto y pone Z/CY, `DAD H` (HL×2, CY si desborda), `INX` de FFFFh → 0000h sin banderas.
  - Lógico: `ANA`, `XRA A` → 0, Z 1, CY 0; `RLC`/`RRC`/`RAL`/`RAR` con CY; `CMA` sin banderas; `STC`/`CMC`.
  - Saltos: `JNZ` tomado = 10 T, no tomado = 7 T; `CALL`/`RET` con pila; `CNZ` no tomado = 9 T; `PCHL`; `RST 5` salta a 0028h.
  - Pila: `PUSH PSW` escribe `packFlags`; `PUSH B` con SP = 0000h escribe en FFFFh/FFFEh (Review Focus 3); `XTHL`; `SPHL`.
  - E/S: `IN 05H` llama `bus.in(5)`; `OUT 01H` llama `bus.out(1,A)`.
  - `HLT` → `halted = true`; opcode `0x08` → `error` en español, PC sin avanzar.
- [ ] **Step 2:** FAIL. **Step 3:** `switch` por opcode con helpers por familia (registro por índice `B C D E H L M A` = 0–7). **Step 4:** PASS. Commit `feat(core): ejecución de las 246 instrucciones`.

### Task 7: Interrupciones, RIM/SIM y bordes de 16 bits

**Files:**
- Modify: `src/cpu/execute.ts`
- Test: `test/interrupts.test.ts`

**Interfaces:**
- Produces: `function acceptInterrupt(s: CpuState, bus: Bus): StepInfo | null;` — se llama antes de cada `execute`; prioridad TRAP (0024h) > 7.5 (003Ch) > 6.5 (0034h) > 5.5 (002Ch); al aceptar: push PC, `ie = false`, 12 T. TRAP no es enmascarable ni depende de `ie`.

- [ ] **Step 1: Tests**: `SIM` con A = `0000_1000b` (MSE=1, máscaras 0) desenmascara las tres; con A = `0001_0000b` (R7.5) borra `pending.r75`; `RIM` arma A con `SID I7.5 I6.5 I5.5 IE M7.5 M6.5 M5.5`; `EI` + pendiente r65 desenmascarado → salta a 0034h y `ie` queda false; con `DI` no salta; TRAP salta aunque `ie` sea false; `HLT` + interrupción aceptada sale del halt. PC que ejecuta en FFFFh envuelve a 0000h.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar (manual págs. 16–17). **Step 4:** PASS. Commit `feat(core): interrupciones y SIM/RIM`.

### Task 8: `Machine` — ejecutar, paso, paso atrás, puntos de corte

**Files:**
- Create: `src/machine/machine.ts`, `test/machine.test.ts`

**Interfaces:**
- Consumes: `assemble` result, `execute`, `acceptInterrupt`, `initialState`.
- Produces:
  ```ts
  type StopReason = 'halt' | 'breakpoint' | 'pause-limit' | 'error' | 'step';
  interface OutEvent { port:number; value:number; step:number }
  interface RunResult { reason:StopReason; steps:number; info?:StepInfo }
  class Machine {
    constructor(program: AssembleResult);
    readonly cpu: CpuState; readonly memory: Uint8Array;
    inputs: Map<number,number>;                 // valores que leerá IN, cargados por el alumno
    readonly outputs: OutEvent[];
    readonly stepCount:number; readonly tStates:number;
    setMemory(addr:number, value:number): void; // datos iniciales del alumno (no entra al historial)
    setBreakpoint(line:number): { ok:true } | { ok:false; error:string }; // línea sin bytes → error
    clearBreakpoint(line:number): void;
    step(): RunResult;
    run(limit?: number): RunResult;             // por defecto limit = 100_000 → 'pause-limit'
    back(): boolean;                            // false si no hay historial
    canBack: boolean;
    reset(): void;                              // registros/banderas/SP a 0, PC = program.start; memoria = datos del alumno + programa
    raise(irq: 'TRAP'|'RST7.5'|'RST6.5'|'RST5.5'): void;
    lastChanges(): Change[];                    // qué cambió en el último paso (para resaltar)
  }
  type Change = { kind:'reg'; name:string; before:number; after:number } | { kind:'flag'; name:FlagName; before:0|1; after:0|1 } | { kind:'mem'; addr:number; before:number; after:number };
  ```
  El historial guarda por paso: snapshot de `CpuState` (pequeño) + lista de `{addr, before}` de memoria escrita + largo de `outputs`. Límite: 10 000 pasos (los más viejos se descartan).

- [ ] **Step 1: Tests**:
  - GTP05 ej. 1 con `setMemory(0x40,0x3A)`: `run()` → `reason 'halt'`, `memory[0x41] === 0xC5`, `stepCount 4`, `tStates 35`.
  - `back()` ×1 desde HLT → PC 2007h; `back()` hasta inicio → `memory[0x41] === 0` y A = 0 (Review Focus 2). Lo mismo con `OUT` (outputs vuelve a su largo) y con `PUSH`.
  - `lastChanges()` tras `LDA` → `[{reg A 0→0x3A}, {reg PC 0x2000→0x2003}]`.
  - Bucle `L: JMP L` → `run()` → `'pause-limit'`, `stepCount 100000`; un segundo `run()` sigue (200 000).
  - Breakpoint en línea 3 → `run()` se detiene **antes** de ejecutarla, `reason 'breakpoint'`; `setBreakpoint` en línea `EQU` → error "Esa línea no genera instrucciones" (Review Focus 5); en la línea de llamada a macro → se detiene en la primera instrucción expandida.
  - `reset()` conserva `setMemory` y programa, PC = start.
  - Opcode inválido alcanzado por salto → `reason 'error'`, mensaje con dirección.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. Commit `feat(core): Machine con paso atrás y puntos de corte`.

### Task 9: Traza para PDF y métricas

**Files:**
- Create: `src/machine/trace.ts`, `src/machine/metrics.ts`, `test/trace.test.ts`, `test/metrics.test.ts`
- Modify: `src/index.ts` (exportar toda la API pública de las tasks 2–9)

**Interfaces:**
- Consumes: `Machine`, `StepInfo`.
- Produces:
  ```ts
  interface TraceRow { n:number;                  // Ins. N° (1…)
    memAddr?:number; memValue?:number;           // dirección leída o escrita por la instrucción y su valor después
    A:number;B:number;C:number;D:number;E:number;H:number;L:number; M:number; // M = memoria[HL] después
    Z:0|1; P:0|1; S:0|1; CY:0|1 }
  function buildTrace(program: AssembleResult, setup:(m:Machine)=>void, maxRows?: number /* 500 */): { rows:TraceRow[]; truncated:boolean };
  interface Metrics { sizeBytes:number; range:[number,number]; executed:number; tStates:number; registersUsed:string[]; memoryUsed:number[] }
  function computeMetrics(program: AssembleResult, m: Machine): Metrics;
  function diffMetrics(prev: Metrics, cur: Metrics): { sizeBytes:number; executed:number; tStates:number }; // cur - prev
  ```

- [ ] **Step 1: Tests**: GTP05 ej. 1 → 4 filas; fila 1 `memAddr 0x40, memValue 0x3A, A 0x3A`; fila 2 sin `memAddr`, A `0xC5`; fila 3 `memAddr 0x41, memValue 0xC5`; bucle infinito → 500 filas y `truncated true`. Métricas ej. 1: `sizeBytes 7`, `range [0x2000,0x2007]`, `executed 4`, `tStates 35`, `registersUsed ['A']`, `memoryUsed [0x40,0x41]`; `diffMetrics` entre dos versiones (con y sin una instrucción extra) da los negativos esperados.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS; `npm test -w @sim8085/core` completo verde; `npx tsc -p packages/core --noEmit` sin errores. Commit `feat(core): traza y métricas`.

---

## Self-review (hecho)

- Cobertura del spec para este plan: §6.2 (T4–T5), §6.3 (T5), §6.4 lógica (T8), §6.5 estado (T3, T8), §6.6 (T6–T8), §6.7 (T9), §6.8b datos (T9). La explicación "AHORA" usa `InstrDef.summary` (T2); la Observación automática se genera en el Plan 3 a partir de `ListingRow`.
- Fuera de este plan, a propósito: UI, PDF, ejercicios/verificador, documentación, Tauri (planes 2–6).
