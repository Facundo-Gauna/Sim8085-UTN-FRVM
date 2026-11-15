# Simulador 8085: definición de producto (registro de la entrevista)

> **Cerrado.** La versión final y aprobada está en `docs/superpowers/specs/2026-11-15-simulador-8085-design.md`, que prevalece sobre este registro.

> Documento vivo. Registra las decisiones confirmadas en la entrevista y los puntos pendientes.
> Las decisiones de Claude que no fueron confirmadas se marcan como **[propuesta]**.

## 1. Contexto y propósito

- Herramienta **educativa** para alumnos de Arquitectura de Computadoras (UTN Villa María, Unidad 8: Ensamblador) que recién empiezan con assembler del Intel 8085.
- Fuente de verdad técnica: el manual de la cátedra *Set de Instrucciones - Microprocesador 8085* (instrucciones, registros, flags y terminología).
- Referencia funcional: **sim8085.com**. Se replica la mayor parte, simplificada para el nivel de la cátedra.

## 2. Decisiones confirmadas

### Plataformas
- Aplicación **web** desplegable de forma simple (por ejemplo, Vercel). No tiene usuarios, cuentas ni almacenamiento en el servidor.
- Versión de **escritorio** descargable para **Linux y Windows**, que funciona como un IDE simple con acceso a carpetas.
- En la web solo se **cargan y exportan** archivos assembler.
- **Web:** se pueden tener **varios archivos abiertos en pestañas**, pero **no persisten**: no hay autoguardado. Se muestra un **aviso antes de salir** si hay archivos abiertos, y se aclara en la interfaz que el trabajo no se conserva.
- **Celular:** el simulador está pensado **solo para computadora**. En el celular se muestra un aviso, y la **documentación sigue siendo legible**.
- **Escritorio:** abre una carpeta con un árbol de archivos `.asm`, pestañas, y permite guardar, guardar como, crear, renombrar y borrar archivos. Los PDF se exportan a esa carpeta.

### Exportación a PDF
- Se pueden generar **dos documentos distintos**, a elección del usuario:
  1. **Plantilla Assembler** (la principal y la más evaluada): Dirección / Mnemónico / OP.CODE / Observación, con encabezado Alumno / Ejercicio / Hoja Nº.
  2. **Plantilla Registros-Banderas-Memoria**: traza por instrucción con Posición de memoria, Valor, Ins. N°, registros A B C D E H L M y banderas Z P S CY. Encabezado: Alumno / Hoja N° / Fecha.
- **Observaciones:**
  - El alumno puede **escribirlas él mismo dentro del editor**, y el PDF sale con ellas.
  - De forma **opcional**, el sistema puede generarlas **automáticamente** en lenguaje simple (por ejemplo, `A ← M[2000h]`).
  - El sistema **no controla** si el alumno escribió sus propias observaciones o usó las automáticas. Eso queda fuera de alcance.
  - **Mecanismo (opción A):** el comentario de cada línea (`; ...`) es la Observación. Todo queda en un único `.asm` estándar.
  - El botón **"Autocompletar observaciones"** solo completa las líneas que no tienen comentario. **[propuesta]**
  - Antes de exportar se muestra una **vista previa** de la plantilla. **[propuesta]**

- **Plantilla Registros-Banderas-Memoria: reglas de generación** **[propuesta, aceptada por delegación]**
  - Una fila por cada **instrucción ejecutada** (traza real, los bucles se repiten), con un tope configurable de filas y un aviso si se supera.
  - Registros y banderas con su valor **después** de ejecutar la instrucción, todos completos. M = M[HL].
  - Posición y Valor en memoria: la dirección que esa instrucción **leyó o escribió**, con su valor posterior. Queda vacío si la instrucción no accede a memoria.
  - AC aparece en la app pero **no** en el PDF, para respetar la plantilla (Z P S CY).

### Ensamblador y documentación
- El ensamblador soporta el 8085 **completo y correcto**, incluyendo directivas que el manual no define (`ORG`, `EQU`, `DB`, etc.).
- La documentación se divide en **"Dentro de la cátedra"** y **"Fuera de la cátedra (complementario)"**, e indica con claridad qué corresponde a cada parte.
- La documentación toma como base el manual, el apunte y la planificación, **sin copiar el apunte**: qué es ASM, qué soporta la herramienta, instalación, ejercicios, directivas, macros, etc.

### Ejercicios
- Se incluyen ejercicios básicos, los de la cátedra (GTP05: 5 ejercicios) y ejercicios adicionales de práctica.

- Cada ejercicio incluye: enunciado, datos iniciales de memoria precargados, pista y **verificación automática** (botón "Comprobar").
  - La verificación ejecuta el programa con varios casos de prueba y revisa el resultado esperado. Si falla, indica el caso concreto ("falla cuando 0040h = FFh").
- GTP05, ejercicio 4: "parte más significativa" = **nibble alto**. Resultado esperado: el valor enmascarado, con el nibble alto conservado y el bajo en 0 (por ejemplo, `ANI F0H`). **[propuesta: confirmar si en clase se lo desplaza al nibble bajo]**

### Alcance
- Se intenta construir **todo en el MVP** y corregir sobre la marcha.

### Diseño visual
- **No hay una dirección visual definida.** Se va a definir más adelante con las tres skills de diseño (UI/UX Pro Max, luego Frontend Design, luego Impeccable), según `Design Skills Orchestration.md`, y se guardará en `design-system/MASTER.md`.
- Objetivo: una estética llamativa pero, sobre todo, **funcional**.

### Ayudas para principiantes
- Tema **claro y oscuro**.
- Se puede alternar la **base numérica** de los valores mostrados (hexa, decimal, binario).
- Los **cambios se resaltan con color** en cada paso (registros, banderas, memoria) para entender qué modificó cada instrucción.

### Ejecución y depuración
1. **Ensamblar**, con los errores marcados en su línea y un mensaje claro en español.
2. **Ejecutar todo / Paso a paso / Reiniciar.**
3. **Puntos de corte** con clic en el margen.
4. **Paso atrás** (deshace la última instrucción).
5. **Velocidad de ejecución** regulable.
6. **Línea actual resaltada** en el editor, sincronizada con el PC.
7. **Memoria editable** antes de ejecutar, para cargar los datos iniciales del ejercicio.
8. **Vista de la pila** (SP) para CALL, RET, PUSH y POP.
9. **Explicación de la instrucción actual** en lenguaje simple, con las banderas que puede afectar.

### Puertos, interrupciones y salida
- **Puertos E/S:** el alumno carga los valores que va a leer `IN`. Los `OUT` quedan registrados en una lista (`OUT 01h ← 3Ah`).
- **Salida del programa:** el registro de `OUT` más los mensajes del simulador (HLT, errores de ejecución).
- **Interrupciones:** botones para TRAP, RST 7.5, 6.5 y 5.5, con indicadores de máscaras y habilitación (EI/DI, SIM/RIM).
- **Sin** LEDs ni display de 7 segmentos, porque no están en la cátedra.
- Requisito: la UI/UX tiene que ser **clara**. Estos paneles no pueden saturar la pantalla. Se definirá en la etapa de diseño.

### Métricas del programa
- Tamaño en bytes y rango de direcciones, instrucciones ejecutadas, estados T totales (según el manual) y registros y memoria usados.
- Propósito: **comparar soluciones** del mismo ejercicio (cuál es más corta o más rápida).
- Comparar con la ejecución anterior (ver la diferencia contra la corrida previa). **[propuesta]**

### Sintaxis del ensamblador **[propuesta, sin objeciones]**
- Formato `ETIQUETA: MNEMÓNICO OPERANDOS ; comentario`. No distingue mayúsculas de minúsculas.
- Números: `2AH` (hexa, con un 0 adelante si empieza con letra), `00101010B` (binario) y `42` (decimal sin sufijo).
- Directivas: `ORG`, `EQU`, `DB`, `DW`, `DS` y `END`. Se documentan como "fuera de la cátedra".
- **Macros soportadas** (`MACRO` / `ENDM`), documentadas como "fuera de la cátedra".
  - En la plantilla PDF, cada llamada a una macro **se expande** en sus instrucciones reales, cada una con su dirección y opcode. La observación de la línea de llamada va en la primera instrucción expandida. **[propuesta]**
- **Regla general:** todo lo que **no esté en el *Set de Instrucciones* de la cátedra** se documenta como "fuera de la cátedra", aunque funcione en el simulador.

### Dirección de inicio
- La cátedra **no usa una dirección fija**.
- Sin `ORG`, el programa empieza en **0000h** por defecto. **[propuesta]**
- **Campo "dirección de inicio"** visible en la interfaz, para no tener que usar `ORG`. Si el código tiene `ORG`, el `ORG` tiene prioridad. **[propuesta]**
- **Aviso** si el código se superpone con datos cargados o usados por el programa. **[propuesta]**

### Toolbox
- Conversor hexa / decimal / binario / BCD, con actualización simultánea.
- Complemento a 2 y lectura con y sin signo.
- Tabla de opcodes con buscador (mnemónico, opcode, bytes, estados T, flags), según el manual.
- Tabla ASCII ("fuera de la cátedra").

### Ayuda de sintaxis
- Autocompletado de mnemónicos y registros.
- Información al pasar el mouse: qué hace la instrucción, bytes y flags.
- Errores en vivo subrayados, con mensajes en español.

### Idioma, términos y privacidad
- Solo **español**, con la terminología del manual.
- Páginas de términos y privacidad: sin recolección de datos, sin cuentas, el código no se envía a ningún servidor, uso educativo sin garantía.
- **Sin analíticas.**

## 3. Funcionalidades mencionadas (por detallar)

- Editor con ayuda de sintaxis (hints)
- Ensamblado, ejecución y depuración paso a paso
- Registros, banderas, PC, SP
- Memoria (vista y edición)
- Puertos de entrada y salida
- Interrupciones
- Salida del programa
- Vista numérica alternable: hexadecimal, decimal, binario, etc.
- Toolbox: conversores de base
- Métricas del programa
- Secciones de documentación, términos y privacidad

## 4. Pendientes / preguntas abiertas

- [x] Cómo escribe el alumno las observaciones: opción A, el comentario de la línea
- [x] Plantilla Registros-Banderas-Memoria: resuelta como propuesta
- [x] AC: en la app sí, en el PDF no
- [ ] Sintaxis exacta del ensamblador: comentarios, etiquetas, números decimales, directivas y macros
- [x] Funcionalidades de depuración, E/S, interrupciones, métricas, toolbox, hints e idioma: definidas
- [x] Persistencia en la web: no hay, solo un aviso antes de salir
- [x] Tecnología: React + Tauri, con el núcleo en TypeScript (ver la especificación)
