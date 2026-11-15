# Simulador 8085: documento de diseño

- Fecha: 2026-11-15
- Estado: **aprobado** (2026-11-15). Siguiente etapa: identidad visual (§9)
- Registro de la entrevista: `docs/definicion-producto.md`

> Convención: **[decisión de Claude]** marca lo que propuso Claude y el usuario aceptó o delegó. El resto lo decidió el usuario.

---

## 1. Intención

Un simulador **educativo** del Intel 8085 para alumnos de Arquitectura de Computadoras (UTN Villa María, Unidad 8: Ensamblador) que están empezando con assembler. Los alumnos manejan hexadecimal; la vista en **otras bases** (decimal, binario) es una opción adicional porque el hexa puede confundir a algunas personas y otra base les da más claridad. El hexa sigue siendo la base principal.

Permite escribir, ensamblar, ejecutar y depurar programas, entender **qué cambió en cada paso**, practicar con ejercicios que se verifican automáticamente y **generar en PDF las hojas de entrega de la cátedra**. Es sobre todo la *Plantilla Assembler* (Dirección / Mnemónico / OP.CODE / Observación), que es la más evaluada.

Fuente de verdad técnica: el manual *Set de Instrucciones - Microprocesador 8085* de la cátedra. Referencia funcional: **sim8085.com**, simplificado y enfocado.

## 2. Objetivos

1. Simular el 8085 de forma **completa y correcta**: las 74 instrucciones oficiales, opcodes, flags y estados T según el manual.
2. Hacer visible y comprensible cada paso: cambios resaltados con color, base numérica alternable, explicación de la instrucción actual y paso atrás.
3. Generar las dos hojas de entrega de la cátedra en PDF, fieles a las plantillas.
4. Practicar con ejercicios (básicos, de la cátedra y adicionales) que se verifican automáticamente.
5. Documentar con claridad qué es de la cátedra y qué es complementario.
6. Funcionar en la web (Vercel) y como app de escritorio para Linux y Windows.

## 3. No-objetivos

- Usuarios, cuentas, almacenamiento en servidor o sincronización.
- Persistencia en la web (no hay autoguardado).
- Analíticas o telemetría.
- Uso del simulador desde el celular.
- Detectar si el alumno escribió sus propias observaciones o usó las automáticas.
- LEDs, display de 7 segmentos u otros periféricos que la cátedra no ve.
- Opcodes no documentados del 8085.
- Idiomas además del español.

## 4. Anti-objetivos (sería un fracaso aunque funcione)

- Una interfaz saturada que abrume a un principiante. Con tantos paneles, la claridad es un requisito.
- Usar una terminología distinta a la del manual de la cátedra.
- Un PDF que no se parezca a la plantilla oficial o que no se pueda entregar.
- Mostrar como "de la cátedra" algo que no está en el Set de Instrucciones.

## 5. Restricciones

- Web estática, sin backend, desplegable en Vercel.
- Escritorio para Linux y Windows.
- Todo en español.
- Uso desde computadora. En el celular solo se lee la documentación.
- La dirección visual **todavía no existe**. Se define en una etapa propia con las skills de diseño (ver §9).

---

## 6. Funcionalidad

### 6.1 Editor
- Varios archivos en **pestañas**.
- Resaltado de sintaxis, **autocompletado** de mnemónicos y registros, **información al pasar el mouse** (qué hace la instrucción, bytes y flags) y **errores en vivo** subrayados con mensajes en español.
- Margen con **puntos de corte** (clic) y **línea actual** resaltada, sincronizada con el PC.

### 6.2 Sintaxis del ensamblador **[decisión de Claude]**
- `ETIQUETA: MNEMÓNICO OPERANDOS ; comentario`. No distingue mayúsculas de minúsculas.
- Números: `2AH` (hexa, con un `0` adelante si empieza con letra: `0A1H`), `00101010B` (binario) y `42` (decimal sin sufijo).
- Directivas: `ORG`, `EQU`, `DB`, `DW`, `DS` y `END`.
- **Macros** `MACRO` / `ENDM` (decisión del usuario). Cada llamada se expande en sus instrucciones reales.
- **Regla:** todo lo que no figura en el Set de Instrucciones es "fuera de la cátedra" (en la documentación y en los hints).

### 6.3 Dirección de inicio
- La cátedra no usa una dirección fija.
- Sin `ORG`, el programa empieza en **0000h** **[decisión de Claude]**.
- Un **campo "Dirección de inicio"** junto a Ensamblar permite elegir otra sin escribir `ORG`. Si el código tiene `ORG`, el `ORG` tiene prioridad.
- **Aviso** si el código se superpone con memoria que el alumno cargó o que el programa usa como dato.

### 6.4 Ejecución y depuración
- Ensamblar, ejecutar todo, paso a paso, **paso atrás**, reiniciar, puntos de corte y **velocidad** regulable.
- **Explicación de la instrucción actual** en lenguaje simple, con las banderas que puede afectar.
- `HLT` detiene la ejecución. Un opcode inválido detiene la ejecución con un error claro.
- **Posibles bucles infinitos** **[decisión de Claude]**: "Ejecutar todo" **pausa** (sin abortar) cada **100.000 instrucciones** y pregunta "El programa lleva 100.000 instrucciones sin llegar a HLT. ¿Continuar o detener?". Así no se cortan bucles legítimos largos (por ejemplo, retardos), y uno infinito no cuelga la app. Al pausar, el alumno puede inspeccionar el estado.
- Al reiniciar, los registros, las banderas y el SP vuelven a 0. La memoria conserva lo que cargó el alumno y el programa ensamblado **[decisión de Claude]**.

### 6.5 Estado de la máquina (paneles)
- **Registros** A, B, C, D, E, H, L, los pares BC, DE y HL, **M** (= M[HL]), **PC** y **SP**.
- **Banderas** S, Z, AC, P y CY (AC solo en la app; el PDF usa Z, P, S y CY).
- **Memoria** de 64 KB: vista navegable (ir a una dirección), **editable** para cargar los datos iniciales.
- **Pila:** vista alrededor del SP.
- **Base alternable** (hexa, decimal, binario) en todos los valores.
- **Cambios resaltados con color** en cada paso.
- **Tema claro y oscuro.**

### 6.6 Puertos, interrupciones y salida
- **Puertos:** el alumno carga los valores que va a leer `IN`. Cada `OUT` queda en una lista (`OUT 01h ← 3Ah`).
- **Salida:** la lista de `OUT` más los mensajes del simulador.
- **Interrupciones:** botones para TRAP y RST 7.5, 6.5 y 5.5, con indicadores de máscaras, habilitación y pendientes (EI/DI, SIM/RIM).

### 6.7 Métricas
- Tamaño en bytes y rango de direcciones, instrucciones ejecutadas, estados T totales, y registros y memoria usados.
- **Diferencia contra la ejecución anterior**, para comparar soluciones.

### 6.8 Exportación a PDF (el usuario elige cuál)
Ambos PDF piden en un diálogo **Alumno** y **Ejercicio**, y **Hoja Nº** y **Fecha** cuando la plantilla los tiene. Hay una **vista previa** antes de exportar. Si no entra en una hoja, se pagina, con el encabezado repetido y el Nº de hoja automático.

**a) Plantilla Assembler (la principal)**
- Columnas: Dirección / Mnemónico / OP.CODE / Observación, con encabezado "ARQUITECTURA DE COMPUTADORAS / Alumno / Ejercicio / Hoja Nº", igual al PDF oficial.
- **Un byte por fila** (decisión del usuario, formato de la cátedra). Cada byte de una instrucción de 2 o 3 bytes ocupa su propia fila con su dirección. El mnemónico va solo en la fila del primer byte. Ejemplo: `2000 LDA 0040H 3A` / `2001 40` / `2002 00`.
- **Observación = el comentario `;` de la línea** (decisión del usuario). Si es larga, el texto se ajusta dentro de la celda (decisión del usuario).
  - **Tope: 80 caracteres por observación** **[decisión de Claude]**. Es la columna más ancha, con unos 40 caracteres por renglón a ~9 pt, así que entran 2 renglones. Si la instrucción ocupa varios bytes, el segundo renglón usa la fila vacía del byte siguiente, sin agrandar la hoja.
  - El editor muestra un **contador** al escribir el comentario y **avisa** (sin bloquear) cuando se pasa de 80. Al exportar, la vista previa marca las observaciones que se recortarían.
- **"Autocompletar observaciones"** (opcional): genera observaciones en lenguaje simple (`A ← M[2000h]`), **solo para las líneas que no tienen comentario**, y las escribe en el editor.
- Las macros aparecen expandidas: la observación de la línea de llamada va en la primera instrucción.

**b) Plantilla Registros-Banderas-Memoria** **[decisión de Claude, delegada]**
- Una fila por cada **instrucción ejecutada** (traza real). Tope de **500 filas** (~11 hojas), con un aviso si se supera **[decisión de Claude]**.
- A B C D E H L M y Z P S CY con su valor **después** de cada instrucción, todos completos.
- Posición y Valor en memoria: la dirección que esa instrucción leyó o escribió, con su valor posterior. Queda vacío si la instrucción no accede a memoria.

### 6.9 Ejercicios
- Catálogo con **básicos**, los **5 de la cátedra (GTP05)** y **adicionales**.
- Cada ejercicio tiene enunciado, datos iniciales precargados en memoria, pista y botón **"Comprobar"**. El botón ejecuta el programa con varios casos de prueba y, si falla, dice en qué caso.
- GTP05, ejercicio 4: "parte más significativa" = nibble alto, conservado en su lugar (`B7h → B0h`) **[decisión de Claude, a confirmar]**.

### 6.10 Toolbox
- Conversor hexa / decimal / binario / BCD, con actualización simultánea.
- Complemento a 2 y lectura con y sin signo.
- Tabla de opcodes con buscador (según el manual).
- Tabla ASCII ("fuera de la cátedra").

### 6.11 Documentación
- Dividida en **"Dentro de la cátedra"** y **"Fuera de la cátedra (complementario)"**.
- Contenido: qué es assembler y qué es el 8085, registros, flags, etiquetas, modos de direccionamiento, referencia de instrucciones, directivas y macros, cómo usar el simulador, cómo instalar la app de escritorio, y los ejercicios.
- Se basa en el manual, el apunte y la planificación, **sin copiar el apunte**.
- Además: páginas de **Términos** y **Privacidad** (sin datos, sin cuentas, sin servidor, uso educativo sin garantía).

### 6.12 Plataformas
- **Web:** pestañas con varios archivos, cargar y descargar `.asm`, sin persistencia, con un **aviso antes de salir** y la aclaración visible de que el trabajo no se conserva.
- **Escritorio (Linux y Windows):** abrir una carpeta, árbol de archivos `.asm`, pestañas, y guardar, guardar como, crear, renombrar y borrar. Los PDF se exportan a la carpeta.
- **Celular:** aviso de que la app está pensada para computadora. La documentación sigue siendo legible.

---

## 7. Enfoques considerados

| Enfoque | A favor | En contra |
|---|---|---|
| **A. React + Tauri** (elegido) | Instalador de ~5 a 10 MB, usa el WebView del sistema | WebKitGTK en Linux puede mostrar diferencias visuales menores; para compilar hace falta Rust |
| B. React + Electron | Renderizado idéntico en todas las plataformas, opción muy probada | Instalador de ~100 MB y más memoria |
| C. Solo PWA | Casi sin trabajo extra | Acceso a carpetas limitado y solo en Chrome/Edge: no cumple el "IDE con carpetas" |

El usuario eligió **A** porque un instalador liviano es mejor para alumnos que lo descargan en cualquier PC. Las diferencias visuales se controlan probando en los dos sistemas.

## 8. Arquitectura (decidido)

- **Núcleo en TypeScript, independiente de la interfaz**: ensamblador (con macros), CPU 8085, traza de ejecución (permite el paso atrás y el PDF de registros) y verificador de ejercicios. Probado a fondo contra el manual: opcodes, bytes, estados T y flags.
- **Interfaz en React.** La misma base de código sirve para web y escritorio.
- **Escritorio con Tauri.** El acceso a archivos va detrás de una capa que en la web usa carga y descarga, y en el escritorio usa el sistema de archivos.
- **PDF generado por la app** (sin el "imprimir" del navegador), para que sea idéntico en web y escritorio.

## 9. Diseño visual (etapa en curso, antes de construir la interfaz)

**Aprobada la dirección "Datasheet"**: ver `design-system/MASTER.md` (fuente de verdad visual) y la maqueta `design-system/mockup/sim8085-mockup.html`. Antes no había dirección visual previa. Se define siguiendo `Design Skills Orchestration.md`, **una skill por etapa**:
1. **UI/UX Pro Max**: define el sistema de diseño (estilo, paleta, tipografía, tokens, patrones UX) y lo guarda en `design-system/MASTER.md`. Este archivo pasa a ser la **fuente de verdad visual**.
2. **Frontend Design**: construye las pantallas siguiendo `MASTER.md`, sin introducir estilos nuevos sin justificarlo.
3. **Impeccable**: revisa y refina (jerarquía, accesibilidad), conservando la identidad aprobada.

### 9.1 Requisitos de producto que el diseño debe resolver
- **Claridad por sobre todo.** Hay muchos paneles (editor, registros, banderas, memoria, pila, puertos, interrupciones, salida, explicación, métricas). Hay que decidir cuáles se ven siempre y cuáles se abren a pedido.
- **Tema claro y oscuro**, los dos de primera clase.
- **Color con significado:** resaltar el valor que cambió en el último paso, la línea actual, los puntos de corte y los errores. El significado no puede depender solo del color (accesibilidad).
- **Legibilidad de valores:** tipografía monoespaciada clara para código, hexa y binario.
- **Distinción visual entre "Dentro de la cátedra" y "Fuera de la cátedra"** en la documentación, los hints y el autocompletado.
- **Estética llamativa pero funcional**, apropiada para estudiantes universitarios principiantes. No debe intimidar.
- Uso en computadora (escritorio y navegador). En el celular solo se lee la documentación.
- **Debe verse bien en WebKitGTK (Linux) y WebView2 (Windows)**, no solo en Chrome.
- Los **PDF de entrega no siguen la identidad visual**: replican las plantillas oficiales de la cátedra.

### 9.2 Pantallas a cubrir
Simulador (editor + paneles), Ejercicios (catálogo y resolución con "Comprobar"), Documentación, Toolbox, diálogo y vista previa de exportación PDF, Términos / Privacidad, aviso en celular. En el escritorio, además: árbol de archivos de la carpeta.

## 10. Lo que queda para quien construya

- Librerías concretas: editor (CodeMirror 6 o Monaco), generación de PDF y manejo de estado.
- Estructura del repositorio y herramientas de prueba.
- Límite del historial del paso atrás.
- Formato interno de los ejercicios (enunciado, memoria inicial, casos de prueba).
- Lista de ejercicios básicos y adicionales.

## 11. Pendientes

1. Confirmar la interpretación del ejercicio 4 del GTP05 (`B7h → B0h`). No bloquea el inicio.
