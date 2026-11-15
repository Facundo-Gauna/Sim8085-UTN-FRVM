# Plan 2 — Interfaz web del simulador (pantalla "Simulador")

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una app web (Vite + React + TypeScript) con la pantalla del simulador: editor con pestañas, barra de herramientas, paneles de registros, banderas y memoria, panel "Ahora", cajón inferior (Salida, Pila, Puertos E/S, Interrupciones, Métricas), tema claro/oscuro y cambio de base, todo sobre `@sim8085/core` y fiel a `design-system/MASTER.md`.

**Architecture:** `packages/web` consume `@sim8085/core` (la `Machine` es mutable; un store de Zustand guarda el estado de la sesión y un contador `version` que se incrementa en cada cambio para re-renderizar los paneles). El acceso a archivos va detrás de una interfaz `FileService` (en la web: cargar y descargar; el plan 6 agrega la de Tauri). Estilos con CSS plano y tokens de `MASTER.md` (sin Tailwind).

**Tech Stack:** React 18, TypeScript 5 (strict), Vite, Zustand, CodeMirror 6, lucide-react, `@fontsource/ibm-plex-sans` y `@fontsource/ibm-plex-mono` (fuentes incluidas, sin Google Fonts), Vitest + Testing Library + jsdom.

**Spec:** `docs/superpowers/specs/2026-11-15-simulador-8085-design.md` (§6.1, 6.3–6.7, 6.12 web, §9). Visual: `design-system/MASTER.md` (fuente de verdad) y la maqueta `design-system/mockup/sim8085-mockup.html` (referencia de composición y de CSS). Núcleo: `packages/core` (API pública en `src/index.ts`). Decisiones previas y pendientes: `docs/superpowers/plans/2026-11-15-plan-1-decisiones.md`.

**Fuera de este plan** (planes 3–6): exportación a PDF y "Autocompletar observaciones", ejercicios y Toolbox, documentación/términos/privacidad, escritorio con Tauri. Aquí solo se incluye el contador de 80 caracteres del comentario; no se agrega ningún botón de exportación.

## Global Constraints

- Solo español; terminología del manual de la cátedra (registros, banderas, "Paso", "Ejecutar", "Reiniciar").
- Colores y espaciado **solo con tokens** de `MASTER.md` §2 (`--bg --surface --surface-2 --ink --ink-muted --line --line-strong --accent --on-accent --changed-bg --current --danger --success --warning`, sintaxis `--syn-*`); sin hex directo en componentes. Claro y oscuro de primera clase (`prefers-color-scheme` + selector manual con `data-theme`).
- Tipografía: IBM Plex Sans (interfaz) e IBM Plex Mono (código y valores, `font-variant-numeric: tabular-nums`); editor **16/26 px**, ajustable 14–20; mínimo 11 px, solo en cabeceras en versalitas.
- Cambio resaltado: fondo `--changed-bg` + punto `•` junto al nombre; **no se desvanece solo**; el valor anterior se ve al pasar el mouse. Línea actual: barra de 3 px `--current` + `▶`. Error: subrayado ondulado `--danger`. Punto de corte: círculo `--danger` en el margen. Ningún significado depende solo del color.
- "Fuera de la cátedra": borde punteado + etiqueta `FUERA DE CÁTEDRA` en versalitas (AC, directivas, macros).
- Sin sombras decorativas, gradientes ni emojis; íconos Lucide con `aria-label`; foco visible `--accent` 2 px; `prefers-reduced-motion` respetado.
- **Sin textos de presentación sobre la app** (feedback del usuario): la pantalla empieza en la barra de herramientas. El código es el protagonista: el editor ocupa ~60 % del ancho.
- Web: varias pestañas en memoria, **sin persistencia del trabajo**; aviso `beforeunload` si hay archivos abiertos con contenido; aviso visible "los archivos no se guardan". Se permite `localStorage` solo para la preferencia de tema y el tamaño de fuente.
- Ancho mínimo de diseño 1280 px; entre 1024 y 1280 px el panel derecho se angosta y la memoria muestra 8 columnas; por debajo de 900 px se muestra solo el aviso "El simulador está pensado para computadora".
- Estado inicial realista: un archivo de ejemplo (GTP05 ejercicio 1) cargado, no una pantalla vacía.
- Valores en hexa con sufijo `h` por defecto (`3Ah`); binario agrupado en nibbles; base alternable HEX/DEC/BIN global.
- Accesibilidad: todo usable con teclado (atajos: `F5` ensamblar, `F8` ejecutar, `F10` paso, `Shift+F10` atrás, `F9` punto de corte en la línea actual del cursor); cambios anunciados en una región `aria-live="polite"` ("A cambió de 00h a 3Ah").
- Contratos del núcleo que la UI debe respetar: `new Machine(program)` lanza si `program.ok === false` (siempre comprobar `ok`); `setBreakpoint(line)` devuelve `{ok:false,error}` en líneas sin instrucciones (mostrar el error en la barra de estado); `run(limit)` devuelve `pause-limit` cada 100 000 instrucciones (preguntar "¿Continuar o detener?" dentro de la página, nunca `confirm()`); los símbolos locales de macros ya se muestran sin el sufijo `@n` en `ListingRow.source`/`labels`.

## Review Focus

1. **Reensamblar con la máquina en marcha o con datos del alumno cargados:** al ensamblar de nuevo se crea una `Machine` nueva y se re-aplican los datos de memoria y las entradas de puertos del alumno; no se pierden ni se mezclan con los de la corrida anterior. → Task 3.
2. **Bucle infinito en "Ejecutar":** la interfaz no se congela: la ejecución se hace en tandas (por cuadro) y el botón Detener responde; al llegar a `pause-limit` aparece el aviso en la página. → Task 11.
3. **Editar el código después de ensamblar:** el resaltado de la línea actual y los puntos de corte no quedan apuntando a líneas viejas; al cambiar el texto se invalida la máquina y se avisa "El código cambió: volvé a ensamblar". → Task 3 y 6.
4. **Memoria editada a mano con la máquina ya ejecutada:** `setMemory` borra el historial de "Atrás" (comportamiento del núcleo); el botón Atrás se deshabilita y no queda un estado inconsistente. → Task 8.
5. **Valores fuera de rango o mal escritos en los campos** (dirección de inicio `2000`, `20000h`, `xyz`; dato de memoria `1FFh`; puerto `100h`): se rechazan con mensaje junto al campo sin lanzar excepciones, y el valor anterior se conserva. → Task 3 y 8.

---

## Estructura de archivos

```
package.json                         (raíz: agregar workspaces ya existente "packages/*")
packages/web/
  package.json  tsconfig.json  vite.config.ts  index.html
  src/main.tsx  src/App.tsx
  src/styles/{tokens.css,base.css}   tokens de MASTER.md; reset, foco, tipografía
  src/theme/useTheme.ts              'system'|'light'|'dark', data-theme, localStorage
  src/lib/format.ts                  formato de valores por base y parseo de entradas
  src/services/fileService.ts        interfaz FileService + implementación web
  src/state/store.ts                 store de sesión (Zustand)
  src/state/sample.ts                programa de ejemplo (GTP05 ej. 1)
  src/editor/{asmLanguage.ts,editorTheme.ts,Editor.tsx,breakpoints.ts,decorations.ts,completion.ts,hover.ts}
  src/components/Rail.tsx  Toolbar.tsx  FileTabs.tsx  Notice.tsx  MobileNotice.tsx
  src/components/Registers.tsx  Flags.tsx  Memory.tsx  Now.tsx  StatusBar.tsx  Announcer.tsx
  src/components/drawer/{Drawer.tsx,Salida.tsx,Pila.tsx,Puertos.tsx,Interrupciones.tsx,Metricas.tsx}
  src/components/*.css               un archivo de estilos por componente, solo con tokens
  src/**/*.test.ts(x)                pruebas junto a cada módulo
```

---

### Task 1: Paquete `web`, tokens, fuentes y tema

**Files:**
- Create: `packages/web/{package.json,tsconfig.json,vite.config.ts,index.html}`, `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css`, `src/styles/base.css`, `src/theme/useTheme.ts`, `src/theme/useTheme.test.tsx`

**Interfaces:**
- Produces: `useTheme(): { choice: 'system'|'light'|'dark'; resolved: 'light'|'dark'; setChoice(c): void }` (escribe `data-theme` en `<html>` solo cuando `choice !== 'system'`; guarda la preferencia en `localStorage` dentro de try/catch); `npm run dev|build|test -w @sim8085/web`.

- [ ] **Step 1:** Escribir `useTheme.test.tsx`: sin preferencia → `choice 'system'` y `<html>` sin `data-theme`; `setChoice('dark')` → `data-theme="dark"` y se guarda; con `localStorage` que lanza → no rompe y funciona en memoria.
- [ ] **Step 2:** Run `npm test -w @sim8085/web` → FAIL (paquete inexistente).
- [ ] **Step 3:** Crear el paquete (dependencia `"@sim8085/core": "*"`, `@fontsource/ibm-plex-*`, React 18, Zustand, lucide-react, CodeMirror 6: `@codemirror/state view language commands autocomplete lint` y `@lezer/highlight`; dev: Vite, `@vitejs/plugin-react`, Vitest, `jsdom`, `@testing-library/react`, `@testing-library/user-event`). `tokens.css` copia los valores de `MASTER.md` §2 en `:root`, `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {…} }` y `:root[data-theme="dark"]` (con `color-scheme: dark`); `body` con `background: var(--bg)`. `base.css`: reset, foco `outline: 2px solid var(--accent)`, tipografía (interfaz 14/20 Plex Sans; clase `.mono` con `tabular-nums`; clase `.caps` versalitas 11/16 `letter-spacing:.08em`), `@media (prefers-reduced-motion: reduce)` sin transiciones. `App.tsx` por ahora renderiza `<h1>` provisional (se reemplaza en Task 11).
- [ ] **Step 4:** Run → PASS; `npm run build -w @sim8085/web` compila. Commit `feat(web): paquete web con tokens, fuentes y tema`.

### Task 2: Formato de valores y parseo de entradas

**Files:**
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type Base = 'hex' | 'dec' | 'bin';
  function fmt8(v: number, base: Base): string;   // hex '3Ah' | dec '58' | bin '0011 1010'
  function fmt16(v: number, base: Base): string;  // hex '2000h' | dec '8192' | bin '0010 0000 0000 0000'
  function allBases8(v: number): { hex: string; dec: string; bin: string; signed: string }; // 0xF6 → signed '-10'
  type Parsed = { ok: true; value: number } | { ok: false; error: string };
  function parseAddress(text: string): Parsed;     // 0..0xFFFF; acepta '2000', '2000h', '0x2000', '2000H'
  function parseByte(text: string): Parsed;        // 0..0xFF; mismo formato; también decimal con prefijo 'd' no (solo hexa por defecto)
  function parsePort(text: string): Parsed;        // 0..0xFF
  ```
  Entradas sin sufijo se interpretan como **hexa** (campos de dirección, dato y puerto); mensajes de error en español ("Dirección fuera de rango (0000h–FFFFh)").

- [ ] **Step 1: Tests** con los valores de arriba más: `fmt8(0,'bin')='0000 0000'`, `fmt16(0xFFFF,'dec')='65535'`, `parseByte('1FF')` → error, `parseAddress('xyz')` → error, `parseAddress('  2A00h ')` → `0x2A00`, `parsePort('100')` → error.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. Commit `feat(web): formato de valores y parseo de entradas`.

### Task 3: Store de sesión (archivos, ensamblado, máquina)

**Files:**
- Create: `src/state/store.ts`, `src/state/sample.ts`, `src/state/store.test.ts`

**Interfaces:**
- Consumes: `assemble`, `Machine`, `computeMetrics`, `diffMetrics`, tipos de `@sim8085/core`; `parseAddress/parseByte/parsePort`.
- Produces (`useSession` = hook Zustand; también `createSession()` para pruebas):
  ```ts
  interface FileTab { id: string; name: string; text: string }
  interface Session {
    files: FileTab[]; activeId: string;
    startAddress: number;                       // por defecto 0
    base: Base; version: number;                // version++ en cada cambio de la máquina
    asm: AssembleResult | null; machine: Machine | null; stale: boolean; // stale = texto cambió después de ensamblar
    breakpointLines: Set<number>; userMemory: Map<number, number>; inputs: Map<number, number>;
    prevMetrics: Metrics | null; metrics: Metrics | null;
    status: { kind: 'info' | 'error'; text: string } | null;
    pausePrompt: boolean;                       // true si run() devolvió 'pause-limit'
    // acciones
    newFile(): void; closeFile(id: string): void; openFile(name: string, text: string): void;
    setText(id: string, text: string): void;    // marca stale = true y limpia la máquina de la vista
    setActive(id: string): void; setStartAddress(text: string): void; setBase(b: Base): void;
    assembleActive(): void;                     // crea Machine nueva; re-aplica userMemory, inputs y breakpointLines; rota metrics → prevMetrics
    step(): void; stepBack(): void; reset(): void;
    runBatch(maxInstructions: number): StopReason | null;   // una tanda; devuelve motivo o null si sigue
    stop(): void; continueAfterPause(): void;
    toggleBreakpoint(line: number): void;       // usa machine.setBreakpoint; muestra el error de línea sin instrucciones
    setMemoryByte(addr: number, valueText: string): void; clearUserMemory(): void;
    setInput(port: number, valueText: string): void;
    raise(irq: Irq): void;
  }
  ```
  `sample.ts` exporta `SAMPLE: { name: 'ej1-complemento.asm'; text: string; memory: [[0x40, 0x3A]] }` (GTP05 ej. 1 con comentarios en español) y la sesión inicial arranca con ese archivo, dirección de inicio `2000h` y `userMemory` con `0040h = 3Ah`.

- [ ] **Step 1: Tests** (con `@sim8085/core` real): estado inicial = 1 archivo de ejemplo; `assembleActive()` con el ejemplo → `asm.ok`, `machine` creada, `metrics.sizeBytes === 8`; `runBatch(100000)` → `'halt'` y `memory[0x41] === 0xC5`; `stepBack()` tras `step()` vuelve el PC; **Review Focus 1:** `step()`, `setMemoryByte(0x40,'55')`, `assembleActive()` → la máquina nueva tiene `0040h = 55h`, PC en el inicio, la lista de salidas vacía y `prevMetrics` quedó guardado; `setText` después de ensamblar → `stale === true`; texto con error de sintaxis → `asm.ok === false`, `machine === null` y `status` con el primer mensaje y su línea; **Review Focus 5:** `setStartAddress('xyz')` y `setMemoryByte(0x40,'1FF')` dejan el valor anterior y ponen `status.kind === 'error'`; `toggleBreakpoint` en una línea de `EQU` → `status` de error y sin cambios; bucle infinito `L: JMP L` (usar `LP: JMP LP`) → `runBatch(100000)` devuelve `'pause-limit'` y `pausePrompt === true`; `setBase('bin')` solo cambia la base.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. `startAddress` se pasa a `assemble(text, { start })`. Toda mutación de la máquina termina con `version++`. **Step 4:** PASS. Commit `feat(web): store de sesión`.

### Task 4: Archivos (servicio web, pestañas y aviso de salida)

**Files:**
- Create: `src/services/fileService.ts`, `src/services/fileService.test.ts`, `src/lib/unloadGuard.ts`, `src/lib/unloadGuard.test.ts`

**Interfaces:**
- Produces:
  ```ts
  interface FileService {
    openFiles(): Promise<{ name: string; text: string }[]>;   // input type=file múltiple, solo .asm/.txt
    saveFile(name: string, text: string): Promise<void>;      // descarga Blob con nombre
    readonly canPickFolder: boolean;                           // false en la web
  }
  const webFileService: FileService;
  function installUnloadGuard(hasContent: () => boolean): () => void; // registra beforeunload; devuelve desinstalar
  ```

- [ ] **Step 1: Tests** (jsdom): `saveFile` crea un enlace con `download` igual al nombre y revoca la URL; `openFiles` resuelve con el texto leído de un `File` simulado y descarta extensiones no `.asm`/`.txt` (devolviendo un error legible en el segundo valor si se usa) — mantener simple: lista filtrada; `installUnloadGuard(() => true)` → el evento `beforeunload` llama `preventDefault` y establece `returnValue`; con `() => false` no; el desinstalador funciona.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. Commit `feat(web): servicio de archivos web y aviso de salida`.

### Task 5: Editor (CodeMirror): lenguaje, tema y sincronía con el store

**Files:**
- Create: `src/editor/asmLanguage.ts`, `src/editor/editorTheme.ts`, `src/editor/Editor.tsx`, `src/editor/Editor.css`, `src/editor/asmLanguage.test.ts`

**Interfaces:**
- Produces:
  ```ts
  const asmLanguage: Extension;            // tokens: mnemonic, register, number, label, directive, comment, string
  function tokenizeLine(text: string): { from: number; to: number; kind: 'mnemonic'|'register'|'number'|'label'|'directive'|'comment'|'string'|'text' }[];
  const editorTheme: Extension;            // usa SOLO variables CSS de MASTER.md §2.4
  function Editor(props: { fileId: string; fontSize: number }): JSX.Element; // lee/escribe session.setText; recrea el estado al cambiar de pestaña
  ```
  `tokenizeLine` es una función pura (la prueba no necesita CodeMirror). Colores: mnemónico `--ink` peso 600; registro `--syn-reg`; número `--syn-num`; etiqueta `--syn-label`; directiva y macro `--ink-muted` itálica con el borde punteado de "fuera de la cátedra" aplicado en Task 6; comentario `--syn-comment`.

- [ ] **Step 1: Tests de `tokenizeLine`:** `'INICIO: LDA 0040H ; A ← M[0040h]'` → label, mnemonic, number, comment; `'  mvi a, 5'` (minúsculas) → mnemonic, register, number; `'DATO EQU 0040H'` → label (sin dos puntos antes de EQU), directive, number; `"MSG: DB 'HOLA', 0"` → string; un `;` dentro de comillas no inicia comentario.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar con un `StreamLanguage` o `ViewPlugin` de decoraciones basado en `tokenizeLine`; `Editor.tsx` monta `EditorView` con números de línea, historial (`@codemirror/commands`), tamaño de fuente por prop y `font-family: var(--mono)`; en cada cambio llama `setText`. **Step 4:** PASS + `npm run build`. Commit `feat(web): editor CodeMirror con sintaxis del 8085`.

### Task 6: Editor: puntos de corte, línea actual, errores, contador de comentario, autocompletado y ayuda al pasar el mouse

**Files:**
- Create: `src/editor/breakpoints.ts`, `src/editor/decorations.ts`, `src/editor/completion.ts`, `src/editor/hover.ts`, y pruebas `completion.test.ts`, `hover.test.ts`, `decorations.test.ts`
- Modify: `src/editor/Editor.tsx`

**Interfaces:**
- Consumes: `session.asm` (`messages`, `addressToLine`, `lineToAddress`), `machine.cpu.PC`, `breakpointLines`, `ISA`, `findInstr`, `InstrDef.summary/size/tStates/flags`.
- Produces:
  ```ts
  function completionsFor(prefix: string, lineBeforeCursor: string): { label: string; detail: string; fueraDeCatedra: boolean }[]; // mnemónicos (detail = summary), registros según el operando, directivas (fueraDeCatedra=true)
  function hoverInfo(word: string, lineText: string): { title: string; body: string; flags: string[]; bytes: number; tStates: string; fueraDeCatedra: boolean } | null;
  function lineDecorations(args: { asmMessages: AsmMessage[]; currentLine: number | null; breakpointLines: Set<number>; stale: boolean; commentLen: (line: number) => number }): DecorationSpec[];
  ```
  Reglas: línea actual con barra `--current` y `▶`; errores con subrayado ondulado `--danger` y el mensaje en el tooltip; advertencia de >80 caracteres en el comentario con el contador `NN/80` en el margen derecho de la línea (color `--warning` + ícono, no solo color); clic en el margen alterna punto de corte (llama `toggleBreakpoint`; solo marca el círculo si el núcleo aceptó); con `stale === true` se ocultan la línea actual y los puntos de corte y la barra de estado dice "El código cambió: volvé a ensamblar" (**Review Focus 3**).

- [ ] **Step 1: Tests:** `completionsFor('MO','')` incluye `MOV` y `MVI` con su `summary`; `completionsFor('', 'MOV A,')` ofrece registros `A B C D E H L M` y no mnemónicos; `completionsFor('OR','')` incluye `ORG` con `fueraDeCatedra: true` y `ORA` con `false`; `hoverInfo('LDA','LDA 0040H')` → bytes 3, `tStates '13'`, flags `[]`, `fueraDeCatedra false`; `hoverInfo('JNZ', …)` → `tStates '7 / 10'`; `hoverInfo('DB', …)` → `fueraDeCatedra true`; `hoverInfo('foo', …)` → `null`; `lineDecorations` con `stale: true` no emite línea actual ni puntos de corte; comentario de 81 caracteres emite la advertencia con texto `81/80`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar y conectar al `Editor`. **Step 4:** PASS + build. Commit `feat(web): editor con depuración, ayuda y errores en vivo`.

### Task 7: Paneles Registros y Banderas

**Files:**
- Create: `src/components/Registers.tsx`, `Flags.tsx`, `Registers.css`, `Registers.test.tsx`

**Interfaces:**
- Consumes: `session.machine`, `session.base`, `session.version`, `machine.lastChanges()`, `fmt8/fmt16/allBases8`.
- Produces: `<Registers/>` (cabecera `01 REGISTROS`; A grande y ancho doble; B C D E H L; PC y SP en 16 bits; M = valor en `M[HL]`) y `<Flags/>` (cabecera `02 BANDERAS`: S Z AC P CY; **AC con borde punteado y la etiqueta `FUERA DE CÁTEDRA`** como en la maqueta). Cada celda cambiada lleva la clase `changed` (fondo `--changed-bg`) y un `•`; `title` con "Antes: 00h" y las otras bases (`allBases8`); `aria-label="A: 3Ah (cambió desde 00h)"`.

- [ ] **Step 1: Tests (Testing Library):** con la máquina del ejemplo tras un `step()`: A muestra `3Ah`, tiene clase `changed` y `•`; B no; con base `dec` A muestra `58`; con `bin` `0011 1010`; la celda AC tiene el atributo `data-fuera-catedra`; sin máquina (código con errores) los paneles muestran `—` y no lanzan.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. Commit `feat(web): paneles de registros y banderas`.

### Task 8: Panel de Memoria (editable)

**Files:**
- Create: `src/components/Memory.tsx`, `Memory.css`, `Memory.test.tsx`

**Interfaces:**
- Consumes: `machine.memory`, `lastChanges()`, `session.setMemoryByte`, `parseAddress`.
- Produces: `<Memory/>` (cabecera `03 MEMORIA` + campo "Ir a"): tabla de 8 columnas (16 en pantallas anchas) con la dirección de fila y los bytes; celdas cambiadas con `changed`; la celda en `PC` subrayada `--current`; **doble clic o Enter en una celda abre edición** (input con el valor en hexa; Enter confirma con `setMemoryByte`, Escape cancela); un campo "Ir a" que usa `parseAddress`; las direcciones del programa con `--ink` y las de valor 0 sin tocar con `--ink-muted`; botón "Borrar datos cargados" (`clearUserMemory`).

- [ ] **Step 1: Tests:** "Ir a" `2000h` muestra la fila `2000h` con `3A 40 00 …` tras ensamblar el ejemplo; editar `0040h` con `55` → `setMemoryByte` llamado y la celda muestra `55h`; entrada inválida (`1FF`) deja el valor y muestra el mensaje junto al campo (**Review Focus 5**); tras editar con la máquina ya ejecutada el botón Atrás queda deshabilitado (**Review Focus 4**, probar con el store); la celda del PC tiene `aria-current="true"`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. Commit `feat(web): panel de memoria editable`.

### Task 9: Panel "Ahora", barra de estado y selector de base

**Files:**
- Create: `src/components/Now.tsx`, `StatusBar.tsx`, `Announcer.tsx`, `Now.css`, `StatusBar.css`, `Now.test.tsx`, `StatusBar.test.tsx`

**Interfaces:**
- Consumes: `byOpcode(memory[PC])` y `InstrDef.summary/size/tStates/flags`, `session.status/base/stale/metrics`.
- Produces: `<Now/>` (cabecera `→ AHORA`: nombre de la instrucción con su operando, `summary`, "No modifica banderas" o "Puede modificar: Z, S, …", bytes y estados T; al llegar a `HLT` o al terminar: "Programa detenido en HLT" con el resultado clave si el ejemplo lo permite — mantener genérico: "Probá Atrás para revisar cada paso"; si `stale` → "El código cambió: volvé a ensamblar"); `<StatusBar/>` (selector `HEX | DEC | BIN` como grupo de botones con `aria-pressed`, "N líneas · M bytes", estado `Listo · PC 2000h`/`En pausa`/`Detenido (HLT)`, estados T, mensajes de `session.status` con ícono según `kind`); `<Announcer/>` región `aria-live="polite"` visualmente oculta que anuncia "A cambió de 00h a 3Ah" a partir de `lastChanges()` en cada paso.

- [ ] **Step 1: Tests:** antes de ejecutar, `Now` muestra `LDA 0040H` con "Carga en el acumulador" y `13 estados T` (usa `summary` de la ISA); tras 4 pasos muestra "Programa detenido en HLT"; con `stale` muestra el aviso; la barra de estado cambia la base al pulsar `BIN` y el botón queda `aria-pressed="true"`; el anunciador contiene "A cambió de 00h a 3Ah" tras el primer paso.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. Commit `feat(web): panel Ahora, barra de estado y anunciador`.

### Task 10: Cajón inferior (Salida, Pila, Puertos E/S, Interrupciones, Métricas)

**Files:**
- Create: `src/components/drawer/{Drawer.tsx,Salida.tsx,Pila.tsx,Puertos.tsx,Interrupciones.tsx,Metricas.tsx}`, `drawer.css`, `drawer.test.tsx`

**Interfaces:**
- Consumes: `machine.outputs`, `machine.cpu.SP`, `machine.memory`, `session.inputs/setInput/raise`, `machine.cpu.{ie,masks,pending}`, `session.metrics/prevMetrics`, `diffMetrics`.
- Produces: `<Drawer/>` con pestañas accesibles (`role="tablist"`), plegable (alto 0 + botón), **se abre solo y marca la pestaña con un punto cuando hay algo nuevo** (un `OUT`, un error, o el fin del programa). **Salida:** mensajes del simulador (ensamblado correcto, HLT, errores) y `OUT 01h ← 3Ah` (formato según la base). **Pila:** 8 entradas alrededor de `SP` con la posición actual marcada; vacía si `SP = 0`. **Puertos:** tabla editable de entradas (puerto → valor para `IN`) con alta/baja de filas y validación `parsePort/parseByte`. **Interrupciones:** botones TRAP, RST 7.5, RST 6.5, RST 5.5 y los indicadores de máscaras (M7.5 M6.5 M5.5), IE y pendientes; botones deshabilitados sin máquina. **Métricas:** tamaño y rango, instrucciones ejecutadas, estados T, registros y memoria usados, y la diferencia contra la corrida anterior (`−4 bytes`, `−12 estados T`, con signo y sin depender solo del color).

- [ ] **Step 1: Tests:** tras ejecutar un programa con `OUT 01H` la pestaña Salida contiene `OUT 01h ← 3Ah` y la pestaña tiene el punto; `Pila` tras `PUSH B` muestra el valor en la posición `SP`; `Puertos`: agregar `05h = 7Fh` llama `setInput` y un puerto `100` muestra error; `Interrupciones`: pulsar `RST 6.5` llama `raise('RST6.5')`; `Métricas`: tras ensamblar dos versiones (con y sin una instrucción) muestra `−1 byte` y la diferencia de estados T.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS. Commit `feat(web): cajón inferior con salida, pila, puertos, interrupciones y métricas`.

### Task 11: Estructura general, barra de herramientas, ejecución en tandas y atajos

**Files:**
- Create: `src/components/{Rail.tsx,Toolbar.tsx,FileTabs.tsx,Notice.tsx,MobileNotice.tsx}`, `src/components/*.css`, `src/lib/useRunner.ts`, `src/lib/useRunner.test.ts`, `src/App.test.tsx`
- Modify: `src/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: todo lo anterior; `webFileService`, `installUnloadGuard`.
- Produces: `useRunner(): { running: boolean; start(): void; stop(): void }` — ejecuta con `requestAnimationFrame`/`setTimeout` en tandas según la velocidad (1: 1 instrucción cada 600 ms; 2: 350 ms; 3: 180 ms; 4: 80 ms; 5: máxima, tandas de 5 000 instrucciones por cuadro); se detiene en `halt`, `breakpoint`, `error` o `pause-limit` (**Review Focus 2**: no bloquea la interfaz). `<App/>`: composición de la maqueta (`Rail` lateral con logotipo de chip DIP-40 y navegación Simulador/Ejercicios/Documentación/Toolbox — las otras tres deshabilitadas con `aria-disabled` y tooltip "Próximamente" —, barra de herramientas con pestañas, campo "Inicio", Ensamblar, Ejecutar/Detener, Paso, Atrás, Reiniciar, control de velocidad y selector de tema, `Notice` "Versión web: los archivos abiertos no se guardan. Descargalos antes de cerrar.", editor ~60 %, paneles a la derecha, cajón inferior, barra de estado). Pestañas de archivo: nueva, abrir (varios), descargar, cerrar (con confirmación **dentro de la página**). `<MobileNotice/>` por debajo de 900 px. Aviso `pause-limit` como banner en la página con "Continuar" y "Detener". Atajos de teclado de Global Constraints.

- [ ] **Step 1: Tests:** `useRunner` con temporizadores falsos: a velocidad máxima el bucle infinito se detiene al `pause-limit` y deja `pausePrompt`, y llamar `stop()` lo detiene entre tandas; `App.test.tsx`: renderiza sin errores con el ejemplo; `F5` ensambla; `F10` ejecuta un paso y la línea actual avanza; al cambiar el texto aparece "El código cambió"; con `matchMedia` < 900 px se muestra el aviso móvil; cerrar una pestaña con contenido pide confirmación en la página; `installUnloadGuard` está instalado.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar con la composición y el CSS de la maqueta como referencia (sin copiar textos de demo). **Step 4:** PASS; `npm run build -w @sim8085/web`; arrancar `npm run dev -w @sim8085/web`, abrir la app en el navegador y comprobar a mano el ejemplo completo en tema claro y oscuro (capturas en `design-system/mockup/screens/`). Commit `feat(web): pantalla del simulador completa`.

### Task 12: Revisión de diseño (Impeccable) y ajustes

**Files:**
- Modify: según los hallazgos (solo estilos y accesibilidad; sin cambiar la lógica).

- [ ] **Step 1:** Ejecutar la revisión de Impeccable (jerarquía, accesibilidad, contraste, responsive entre 1024 y 1440 px, foco por teclado, `prefers-reduced-motion`) sobre la app corriendo, en claro y oscuro.
- [ ] **Step 2:** Corregir los hallazgos por severidad **sin sustituir** la identidad aprobada en `MASTER.md`; cualquier rediseño sustancial se consulta con el usuario antes. Registrar en `MASTER.md` cualquier token nuevo y justificarlo.
- [ ] **Step 3:** `npm test -w @sim8085/web` y `npm run build -w @sim8085/web` en verde. Commit `style(web): ajustes de la revisión de diseño`.

---

## Self-review (hecho)

- **Cobertura del spec para la pantalla del simulador:** §6.1 editor (T5–T6; el contador de 80 en T6), §6.3 campo de dirección de inicio y aviso de superposición (el campo en T3/T11; **el aviso de superposición viene de `asm.messages` del núcleo** y se muestra en el editor/estado en T6), §6.4 ejecución y depuración (T3, T9, T11), §6.5 paneles (T7–T9), §6.6 puertos e interrupciones (T10), §6.7 métricas (T10), §6.12 web (T4, T11), tema y base (T1, T2, T9).
- **No cubierto aquí a propósito:** PDF y "Autocompletar observaciones" (plan 3), ejercicios y Toolbox (plan 4), documentación y páginas legales (plan 5), escritorio (plan 6).
- **Consistencia de tipos:** `Base`, `Session`, `Irq`, `StopReason`, `Metrics` y `AssembleResult` se usan con los mismos nombres en todas las tareas; las funciones de `lib/format.ts` se definen en T2 antes de usarse.
- **Proporción:** el plan da firmas, valores y pruebas; el CSS y la maquetación salen de `MASTER.md` y de la maqueta.
