# Plan 5 — Documentación, Términos, Privacidad y lectura en celular

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una sección "Documentación" dentro de la app, dividida en "Dentro de la cátedra" y "Fuera de la cátedra (complementario)", más las páginas de Términos y Privacidad, legible también en el celular (donde el simulador solo muestra su aviso).

**Architecture:** Cada página es un componente React en `packages/web/src/docs/pages/`; un registro (`docs/registry.ts`) las lista con `id`, título, ámbito (`catedra` | `fuera` | `legal`) y componente. `DocsPage` (índice lateral + contenido) usa el router por hash del plan 4 (`#/documentacion/<id>`). La referencia de instrucciones **se genera desde `ISA`** del núcleo (no se copia a mano), de modo que no puede desacordar con el simulador. En celular, `App` muestra el aviso y debajo la documentación en una sola columna.

**Tech Stack:** React 18, TypeScript, Vitest + Testing Library. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-11-15-simulador-8085-design.md` (§6.11, §6.12 Celular, §9.1 distinción dentro/fuera de la cátedra, §9.2 pantallas). Fuentes de contenido: el manual de la cátedra (`docs/referencia/Set de Instrucciones - Microprocesador 8085.pdf`), `docs/apunte_8085_ensamblador.md` y `docs/definicion-producto.md`. Núcleo: `ISA`, `InstrDef`. Navegación: plan 4 (`useSection`, `Rail`, `App`).

## Global Constraints

- Solo español, terminología del manual de la cátedra (registros, banderas, "Paso", "Ejecutar", "Reiniciar", "Dirección", "Mnemónico", "OP.CODE", "Observación").
- **Sin copiar el apunte**: se redacta con palabras propias, más breve y orientado a "qué hago en el simulador"; el apunte y el manual son la fuente de los hechos, no del texto.
- **Regla de ámbito:** todo lo que no figura en el Set de Instrucciones de la cátedra es "fuera de la cátedra" aunque funcione en el simulador: directivas (`ORG`, `EQU`, `DB`, `DW`, `DS`, `END`), macros (`MACRO`/`ENDM`), la tabla ASCII, el cambio de base, las métricas, la comparación de ejecuciones y la app de escritorio. Las páginas "Dentro de la cátedra" **no** mencionan directivas ni macros (salvo un enlace "ver Directivas y macros (fuera de la cátedra)").
- Cada página muestra su ámbito con **texto** ("Dentro de la cátedra" / "Fuera de la cátedra (complementario)") más el patrón visual de MASTER: las "fuera" llevan borde punteado y la etiqueta `FUERA DE CÁTEDRA` en versalitas; nunca solo color.
- Estructura accesible: un único `<h1>` por página, encabezados ordenados, tablas con `<caption>` o `aria-label`, el índice es `<nav aria-label="Documentación">` con `aria-current="page"`; todo se lee en una columna ≥ 320 px sin scroll horizontal de la página (las tablas largas se desplazan dentro de su contenedor).
- Los ejemplos de código usan la sintaxis real del ensamblador (formato `ETIQUETA: MNEMÓNICO OPERANDOS ; comentario`; números `2AH`, `0A1H`, `00101010B`, `42`) y **cada ejemplo se ensambla en un test** (`assemble(...).ok === true`), de modo que la documentación no puede mostrar código que el simulador rechaza.
- Atajos documentados = los reales: `F5` ensamblar, `F8` ejecutar/detener, `F10` paso, `Shift+F10` atrás, `F9` punto de corte (en el editor); se comprueban contra `useShortcuts`.
- Términos y Privacidad: sin recolección de datos, sin cuentas, el código no se envía a ningún servidor, sin analíticas, uso educativo sin garantía; solo se guarda en el navegador la preferencia de tema y el tamaño de letra.
- Celular (< 900 px): aviso "El simulador está pensado para computadora" y debajo la documentación completa; sin Rail.

## Review Focus

1. **Código de ejemplo que el simulador rechaza** (una documentación con un `MVI A, A1H` sin el `0` inicial): todos los ejemplos pasan por `assemble` en los tests. → Task 2–5.
2. **Instrucción que falta o sobra en la referencia** (se agrega una instrucción a `ISA` y la documentación no la lista): la referencia se genera de `ISA` y un test exige que cada mnemónico aparezca exactamente una vez. → Task 3.
3. **Enlace roto o página inexistente** (`#/documentacion/xyz`, índice sin página, enlace interno a un id que no existe): la ruta desconocida muestra la primera página; un test recorre todos los enlaces internos de todas las páginas. → Task 1 y 6.
4. **Algo de "fuera de la cátedra" presentado como de la cátedra** (anti-objetivo del spec): el registro marca el ámbito y un test verifica que las páginas "Dentro" no contienen `ORG`, `EQU`, `MACRO`, `ENDM` ni `DB`/`DW`/`DS` como directivas. → Task 2–5.
5. **Lectura en celular**: a 360 px de ancho la documentación se muestra, el índice no tapa el contenido y no hay controles del simulador. → Task 7.

---

## Estructura de archivos

```
packages/web/src/docs/registry.ts              DOCS, getDoc, DocScope               (T1)
packages/web/src/docs/DocsPage.tsx, docs.css   índice + contenido + etiquetas       (T1)
packages/web/src/docs/pages/*.tsx              una página por archivo               (T1–T6)
packages/web/src/docs/docs.test.tsx            pruebas de registro y de contenido
packages/web/src/components/Rail.tsx, App.tsx  habilitar Documentación y celular    (T1, T7)
```

---

### Task 1: Estructura de la documentación y primeras páginas

**Files:**
- Create: `packages/web/src/docs/registry.ts`, `docs.css`, `DocsPage.tsx`, `pages/QueEs.tsx`, `pages/Registros.tsx`
- Modify: `packages/web/src/App.tsx`, `packages/web/src/components/Rail.tsx` (habilitar `documentacion`)
- Test: `packages/web/src/docs/docs.test.tsx`

**Interfaces:**
- Consumes: `useSection` (plan 4), `Rail` `enabled`.
- Produces:
```ts
export type DocScope = 'catedra' | 'fuera' | 'legal';
export interface DocEntry { id: string; title: string; scope: DocScope; Component: () => JSX.Element }
export const DOCS: readonly DocEntry[];                 // en orden de aparición
export function getDoc(id: string | undefined): DocEntry; // id desconocido o undefined → la primera
export const SCOPE_LABEL: Record<DocScope, string>;      // 'Dentro de la cátedra' | 'Fuera de la cátedra (complementario)' | 'Legal'
export function DocsPage(props?: { compact?: boolean }): JSX.Element; // región aria-label="Documentación"
```
`DocsPage` muestra el índice agrupado en tres secciones (con `SCOPE_LABEL` como encabezado), la página actual (`#/documentacion/<id>`) con su `h1`, la etiqueta de ámbito y —si es `fuera`— el borde punteado y `FUERA DE CÁTEDRA`; enlaces internos entre páginas con `href="#/documentacion/<id>"`. `compact` (celular) apila índice y contenido en una columna.

Contenido de las dos páginas (ámbito `catedra`; ids `que-es`, `registros`):
- **Qué es assembler y el 8085** (`que-es`): qué es una instrucción de máquina, qué es un mnemónico y por qué el assembler traduce a OP.CODE; el 8085 es un microprocesador de 8 bits con direcciones de 16 bits (memoria de 64 KB, `0000h`–`FFFFh`); el PC apunta a la siguiente instrucción; los bytes de una dirección se guardan primero el menos significativo (`LDA 0040H` → `3A 40 00`); un ejemplo ensamblable (el del simulador: `LDA 0040H / CMA / STA 0041H / HLT`).
- **Registros y memoria** (`registros`): `A` (acumulador), `B C D E H L` de 8 bits; los pares `BC`, `DE`, `HL` de 16 bits (`PSW` = A + banderas solo en PUSH/POP); `M` no es un registro físico sino el byte de memoria apuntado por `HL`; `PC` y `SP` de 16 bits; cómo se ven en el simulador (cambios resaltados con color y un punto `•`, base HEX/DEC/BIN).

- [ ] **Step 1: Write the failing tests:** `DOCS` tiene ids únicos y todo `id` es kebab-case; `getDoc(undefined)` y `getDoc('xyz')` devuelven la primera; `DocsPage` en `#/documentacion/registros` muestra un único `h1` "Registros y memoria", el índice con tres grupos y `aria-current="page"` en el enlace activo; la página de `registros` menciona `A`, `B`, `C`, `D`, `E`, `H`, `L`, `M`, `PC` y `SP`; el ejemplo de `que-es` ensambla (`assemble(...).ok`) y produce `3A 40 00`; el Rail habilita "Documentación" y navega a `#/documentacion`; hash `#/documentacion/xyz` muestra la primera página.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- docs` — Expected: FAIL.
- [ ] **Step 3: Implement** registro, `DocsPage`, las dos páginas y el CSS (tokens de MASTER; el contenido con ancho de lectura ≤ 72ch).
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): estructura de la documentación`.

---

### Task 2: Banderas, programa y modos de direccionamiento (dentro de la cátedra)

**Files:**
- Create: `packages/web/src/docs/pages/Banderas.tsx`, `Programa.tsx`, `Direccionamiento.tsx`; **Modify:** `registry.ts`
- Test: `packages/web/src/docs/docs.test.tsx`

**Interfaces:** Produces páginas `banderas`, `programa`, `direccionamiento` (ámbito `catedra`).

Contenido: **Banderas** — `S` (signo = bit 7 del resultado), `Z` (resultado cero), `AC` (acarreo auxiliar, del bit 3 al 4), `P` (paridad: 1 si la cantidad de bits en 1 es par), `CY` (acarreo/préstamo); no todas las instrucciones las modifican (cada fila de la referencia dice cuáles); `INR`/`DCR` no tocan `CY`; en la app se ven las cinco, en la hoja PDF de Registros solo `Z P S CY`. **Cómo se escribe un programa** (`programa`) — formato de línea `ETIQUETA: MNEMÓNICO OPERANDOS ; comentario`, no distingue mayúsculas; etiquetas (para saltar); números en hexa con sufijo `H` y un `0` adelante si empiezan con letra (`0A1H`, no `A1H`), binario con `B`, decimal sin sufijo; tamaño de instrucción 1, 2 o 3 bytes; el comentario `;` es la Observación de la hoja Assembler (hasta 80 caracteres). **Modos de direccionamiento** (`direccionamiento`) — inmediato (`MVI A, 05H`), por registro (`MOV A, B`), indirecto por registro (`MOV A, M`, `LDAX B`), directo (`LDA 0040H`); no confundir valor con dirección (`MVI A, 40H` ≠ `LDA 0040H`), con un ejemplo de cada uno.

- [ ] **Step 1: Write the failing tests:** cada una de las tres páginas se ve por ruta con su `h1`; `banderas` nombra `S`, `Z`, `AC`, `P`, `CY` y aclara que el PDF omite `AC`; `programa` muestra `0A1H` y explica el cero inicial; **todo bloque `<pre data-asm>` de las tres páginas ensambla sin errores** (el test recorre `document.querySelectorAll('pre[data-asm]')` de cada página y llama `assemble`); ninguna de las páginas `catedra` contiene `ORG`, `EQU`, `MACRO`, `ENDM` (regex con límites de palabra).
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- docs` — Expected: FAIL.
- [ ] **Step 3: Implement** las páginas (los ejemplos en `<pre data-asm>`) y registrarlas.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): documentación de banderas, programas y direccionamiento`.

---

### Task 3: Referencia de instrucciones generada desde ISA

**Files:**
- Create: `packages/web/src/docs/pages/Instrucciones.tsx`, `packages/web/src/docs/instructionGroups.ts`; **Modify:** `registry.ts`
- Test: `packages/web/src/docs/docs.test.tsx`

**Interfaces:**
- Consumes: `ISA`, `InstrDef` (núcleo).
- Produces: `export const GROUPS: { id: string; title: string; mnemonics: readonly string[] }[]` con seis grupos: **Transferencia de datos** (`MOV MVI LXI LDA STA LHLD SHLD LDAX STAX XCHG`), **Aritméticas** (`ADD ADC ADI ACI SUB SBB SUI SBI INR DCR INX DCX DAD DAA`), **Lógicas** (`ANA ANI ORA ORI XRA XRI CMP CPI CMA CMC STC RLC RRC RAL RAR`), **Saltos y control** (`JMP`, los `J` condicionales `JNZ JZ JNC JC JPO JPE JP JM`, `PCHL NOP HLT`), **Pila y subrutinas** (`PUSH POP XTHL SPHL CALL`, los `C` condicionales `CNZ CZ CNC CC CPO CPE CP CM`, `RET`, los `R` condicionales `RNZ RZ RNC RC RPO RPE RP RM`, `RST`), **Entrada, salida e interrupciones** (`IN OUT EI DI RIM SIM`); `export function rowsFor(mnemonic: string)`: `{ mnemonic; forms: string[]; summary: string; bytes: string; tStates: string; flags: string }` — `forms` = operandos de cada `InstrDef` sin repetir (`A,B  A,C  …` se compactan: si hay más de 8 formas se muestra `r1,r2`/`r`/`rp` según la familia), `bytes` `1`, `1–3`, `tStates` `4`, `7/12` o rango (`4–7`), `flags` las de `def.flags` en orden S Z AC P CY o `—`.
La página `instrucciones` (ámbito `catedra`, `h1` "Referencia de instrucciones"): una tabla por grupo con `<caption>` = título del grupo y columnas Mnemónico, Formas, Qué hace (`summary` del manual), Bytes, Estados T, Banderas.

- [ ] **Step 1: Write the failing tests:** la unión de `GROUPS[*].mnemonics` cubre **exactamente** el conjunto de mnemónicos de `ISA` (sin faltantes, sin sobrantes, sin repetidos); `rowsFor('JNZ')` → `tStates '7/10'`, `bytes '3'`, `forms ['addr']`; `rowsFor('ADD')` → `bytes '1'`, `tStates '4–7'` y banderas `S Z AC P CY`; `rowsFor('INR')` no incluye `CY` en banderas; la página tiene 6 tablas con `caption`, una fila por mnemónico, y la fila de `HLT` dice `detiene` en su resumen (viene de `ISA`); agregar una instrucción falsa a una copia de `ISA` hace fallar la comprobación de cobertura (el test de cobertura es una función `missingFromGroups(isa)` exportada y probada con una entrada con un mnemónico extra).
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- docs` — Expected: FAIL.
- [ ] **Step 3: Implement** grupos, `rowsFor`, `missingFromGroups` y la página.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): referencia de instrucciones generada desde ISA`.

---

### Task 4: Cómo usar el simulador y ejercicios/entrega (dentro de la cátedra)

**Files:**
- Create: `packages/web/src/docs/pages/UsarSimulador.tsx`, `EjerciciosEntrega.tsx`; **Modify:** `registry.ts`
- Test: `packages/web/src/docs/docs.test.tsx`

**Interfaces:** Produces páginas `usar-simulador` y `ejercicios-entrega` (ámbito `catedra`).

Contenido: **Cómo usar el simulador** — escribir, **Ensamblar (F5)**, **Ejecutar (F8)**, **Paso (F10)**, **Atrás (Shift+F10)**, **Reiniciar**; punto de corte con clic en el margen o `F9`; el campo "Dirección de inicio" (sin él el programa empieza en `0000h`); memoria editable para cargar datos antes de ejecutar; qué se resalta en cada paso (cambios con color y `•`, valor anterior al pasar el mouse); panel "Ahora"; el cajón (Salida, Pila, Puertos E/S, Interrupciones, Métricas); varias pestañas y que **la web no guarda el trabajo** (descargá el `.asm`); `Ctrl+S` descarga el archivo activo, `Ctrl+O` abre. **Ejercicios y hojas de entrega** — el catálogo (básicos, GTP05, adicionales) y "Comprobar"; **Autocompletar observaciones**; **Exportar PDF**: las dos hojas (Plantilla Assembler: un byte por fila, Observación = comentario `;` de hasta 80 caracteres; Registros-Banderas-Memoria: una fila por instrucción ejecutada, hasta 500), el diálogo con Alumno/Ejercicio/Hoja Nº/Fecha y la vista previa; la aclaración del ej. 4 de GTP05 (nibble alto, `B7h → B0h`, a confirmar con la cátedra).

- [ ] **Step 1: Write the failing tests:** `usar-simulador` nombra `F5`, `F8`, `F10`, `Shift+F10`, `F9`, `Ctrl+S` y `Ctrl+O` y **todos esos atajos existen en `useShortcuts`** (el test importa la tabla de atajos del hook —exportarla como `SHORTCUTS` si hace falta— y verifica que cada tecla documentada figure ahí); dice "no guarda"; `ejercicios-entrega` menciona `80 caracteres`, `500`, `Autocompletar observaciones`, `Comprobar` y `nibble alto`; todos los `pre[data-asm]` ensamblan; ninguna de las dos contiene `ORG`/`EQU`/`MACRO`/`ENDM`.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- docs` — Expected: FAIL.
- [ ] **Step 3: Implement** las páginas y registrarlas.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): documentación del simulador y de la entrega`.

---

### Task 5: Páginas "Fuera de la cátedra"

**Files:**
- Create: `packages/web/src/docs/pages/DirectivasMacros.tsx`, `Instalacion.tsx`, `Complementarias.tsx`; **Modify:** `registry.ts`
- Test: `packages/web/src/docs/docs.test.tsx`

**Interfaces:** Produces páginas `directivas-macros`, `instalacion`, `complementarias` (ámbito `fuera`).

Contenido: **Directivas y macros** — `ORG` (dirección de la siguiente instrucción; tiene prioridad sobre el campo "Dirección de inicio"), `EQU` (constante con nombre), `DB` (bytes o cadenas), `DW` (palabras de 16 bits, byte bajo primero), `DS` (reserva N bytes), `END`; macros con `MACRO`/`ENDM`, parámetros y etiquetas locales, y que en el PDF cada llamada aparece **expandida** con la Observación en la primera instrucción; un ejemplo por directiva y uno de macro (todos con `pre[data-asm]` que ensambla). **App de escritorio** — qué agrega respecto de la web (abrir una carpeta con árbol de archivos `.asm`, guardar/guardar como/crear/renombrar/borrar, los PDF a la carpeta) y para qué sistemas existe (Linux y Windows); un párrafo que dice que el instalador se descarga desde la publicación del proyecto y que **la web funciona sin instalar nada** (la página se completa con las instrucciones de cada sistema al publicarse el instalador: ver plan 6). **Herramientas complementarias** — Toolbox (conversor de bases y BCD, complemento a 2, tabla de opcodes, tabla ASCII), cambio de base HEX/DEC/BIN, métricas y comparación contra la ejecución anterior, Puertos E/S e interrupciones del simulador.

- [ ] **Step 1: Write the failing tests:** las tres páginas tienen etiqueta visible `FUERA DE CÁTEDRA` y el texto `Fuera de la cátedra (complementario)`; `directivas-macros` nombra `ORG`, `EQU`, `DB`, `DW`, `DS`, `END`, `MACRO` y `ENDM`; sus ejemplos ensamblan y el de macro produce las instrucciones expandidas (comparar `rows.length` esperado); `instalacion` menciona `Linux` y `Windows` y dice que la web funciona sin instalar; las páginas `fuera` no se mezclan en el grupo "Dentro de la cátedra" del índice.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- docs` — Expected: FAIL.
- [ ] **Step 3: Implement** las tres páginas y registrarlas.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): documentación fuera de la cátedra`.

---

### Task 6: Términos y Privacidad

**Files:**
- Create: `packages/web/src/docs/pages/Terminos.tsx`, `Privacidad.tsx`; **Modify:** `registry.ts`, `DocsPage.tsx` (enlaces a Términos y Privacidad al pie del contenido)
- Test: `packages/web/src/docs/docs.test.tsx`

**Interfaces:** Produces páginas `terminos` y `privacidad` (ámbito `legal`).

Contenido: **Términos** — uso educativo para la materia Arquitectura de Computadoras (UTN Villa María), sin garantía de ningún tipo, el alumno es responsable de lo que entrega y de verificar las hojas contra la plantilla vigente de la cátedra; el simulador puede diferir de un 8085 real en lo que el manual no define; no es un producto oficial de la UTN. **Privacidad** — el código y los datos **no se envían a ningún servidor** (todo corre en el navegador o en la app de escritorio); sin cuentas, sin cookies de seguimiento, sin analíticas; en el navegador solo se guarda la preferencia de tema y el tamaño de letra del editor; el trabajo no se guarda (por eso el aviso al salir); la web se sirve como archivos estáticos.

- [ ] **Step 1: Write the failing tests:** `privacidad` contiene "no se envían", "sin cuentas" y "analíticas"; `terminos` contiene "sin garantía" y "UTN"; ambas con un único `h1`; los dos enlaces al pie de cualquier página llevan a `#/documentacion/terminos` y `#/documentacion/privacidad`; **recorrido de enlaces:** para todas las páginas de `DOCS`, cada `a[href^="#/documentacion/"]` apunta a un id existente en `DOCS`.
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- docs` — Expected: FAIL.
- [ ] **Step 3: Implement** las dos páginas y el pie.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): términos y privacidad`.

---

### Task 7: Lectura en celular

**Files:**
- Modify: `packages/web/src/App.tsx`, `packages/web/src/components/MobileNotice.tsx`, `packages/web/src/docs/docs.css`
- Test: `packages/web/src/App.test.tsx`

**Interfaces:** Consumes `DocsPage({ compact })` (T1), `MOBILE_QUERY`.

Comportamiento: con `matchMedia('(max-width: 899px)')` verdadero, `App` renderiza el aviso `MobileNotice` ("El simulador está pensado para computadora") y debajo `<DocsPage compact />` (sin Rail, sin Simulador, sin Toolbox ni Ejercicios en el DOM); en `compact` el índice pasa a un `<details>` "Índice" arriba del contenido para no tapar la lectura; los enlaces siguen funcionando con el hash.

- [ ] **Step 1: Write the failing tests:** con `mobile = true` se ven el aviso y la región "Documentación", **no** existe el botón "Ensamblar" ni el `nav` "Secciones"; el índice está dentro de un `<details>` con el resumen "Índice"; navegar a `#/documentacion/banderas` muestra su `h1`; a un ancho de 360 px el contenedor no declara `min-width` mayor que 320 px (comprobar la regla CSS `.docs.compact` sin `min-width` fijo).
- [ ] **Step 2: Run** `npm test -w @sim8085/web -- App` — Expected: FAIL.
- [ ] **Step 3: Implement** la rama móvil y los estilos.
- [ ] **Step 4: Run** `npm test -w @sim8085/web` — Expected: verde.
- [ ] **Step 5: Commit** `feat(web): documentación legible en celular`.

---

### Task 8: Revisión y cierre

- [ ] **Step 1:** Con el navegador disponible, revisar la documentación en claro y oscuro a 1280 px y a 360 px (índice, tablas con scroll interno, enlaces, foco visible); si la extensión de Chrome no está conectada, anotarlo en el ledger.
- [ ] **Step 2:** Revisar que ninguna página copie párrafos del apunte (lectura rápida contra `docs/apunte_8085_ensamblador.md`) y que la página de instalación quede anotada para completarse en el plan 6.
- [ ] **Step 3:** `npm test -w @sim8085/core`, `npm test -w @sim8085/web`, `npx tsc -p packages/web --noEmit` y `npm run build -w @sim8085/web` en verde. Commit `style(web): ajustes de la documentación`.

---

## Self-review (hecho)

- **Spec §6.11:** dividida en "Dentro" y "Fuera de la cátedra" (registro + T1, T2–T5); contenido: qué es assembler y el 8085 (T1), registros (T1), banderas (T2), etiquetas (T2), modos de direccionamiento (T2), referencia de instrucciones (T3), directivas y macros (T5), cómo usar el simulador (T4), cómo instalar la app de escritorio (T5, a completar en el plan 6), ejercicios (T4); Términos y Privacidad (T6). **§6.12 Celular:** aviso + documentación legible (T7). **§9.1:** distinción visual dentro/fuera con texto y borde (Global Constraints, T1, T5).
- **No cubierto aquí a propósito:** instrucciones de instalación definitivas (plan 6, cuando existan los instaladores); buscador de documentación (no pedido por el spec).
- **Consistencia:** `DocEntry`/`DocScope`/`getDoc` (T1) son los que usan T2–T7; `GROUPS`/`rowsFor` (T3) solo los consume T3; `DocsPage({compact})` (T1) lo consume T7.
- **Proporción:** el plan fija contenido requerido, firmas y pruebas; la redacción de las páginas la hace quien implementa, con palabras propias.
