# Apunte de estudio: lenguaje ensamblador del microprocesador 8085

> **Objetivo:** aprender a leer y escribir programas en assembler desde cero, entendiendo qué representa cada instrucción, qué modifica y por qué se utiliza. El apunte sigue el *Set de Instrucciones - Microprocesador 8085* proporcionado, que está rotulado como **8085 A**. Se conserva su nomenclatura y se explican los conceptos necesarios para comenzar a programar.
>
> **Alcance:** este documento explica el conjunto de instrucciones y los conceptos de programación que aparecen en el material. La sintaxis exacta de directivas, comentarios y formatos de números puede variar según el ensamblador o simulador que utilice la cátedra.

---

## Índice

1. [Qué es assembler y qué es una instrucción](#1-qué-es-assembler-y-qué-es-una-instrucción)
2. [Cómo piensa y trabaja el 8085](#2-cómo-piensa-y-trabaja-el-8085)
3. [Registros y memoria](#3-registros-y-memoria)
4. [Notación y símbolos del apunte](#4-notación-y-símbolos-del-apunte)
5. [Modos de direccionamiento](#5-modos-de-direccionamiento)
6. [Banderas o flags](#6-banderas-o-flags)
7. [Cómo se escribe un programa](#7-cómo-se-escribe-un-programa)
8. [Grupo de transferencia de datos](#8-grupo-de-transferencia-de-datos)
9. [Grupo aritmético](#9-grupo-aritmético)
10. [Grupo lógico](#10-grupo-lógico)
11. [Grupo de saltos y control del flujo](#11-grupo-de-saltos-y-control-del-flujo)
12. [Pila y subrutinas](#12-pila-y-subrutinas)
13. [Entrada, salida y control de interrupciones](#13-entrada-salida-y-control-de-interrupciones)
14. [Ejemplos completos](#14-ejemplos-completos)
15. [Errores frecuentes al empezar](#15-errores-frecuentes-al-empezar)
16. [Método para resolver ejercicios](#16-método-para-resolver-ejercicios)
17. [Resumen de consulta rápida](#17-resumen-de-consulta-rápida)
18. [Glosario](#18-glosario)

---

## 1. Qué es assembler y qué es una instrucción

Un **programa** es una secuencia ordenada de instrucciones. Cada instrucción le indica al procesador qué operación debe realizar: copiar un dato, sumar, comparar, acceder a memoria, saltar a otra parte del programa, etc.

El **8085** es un microprocesador. Su circuito reconoce un conjunto limitado de operaciones que están codificadas en bits. Ese conjunto se llama *instruction set* o **conjunto de instrucciones**.

El lenguaje ensamblador (*assembly language* o *assembler*, en el uso habitual) permite escribir esas operaciones usando palabras abreviadas llamadas **mnemónicos**:

| Mnemónico | Idea general |
|---|---|
| `MOV` | Mover o copiar datos |
| `ADD` | Sumar |
| `SUB` | Restar |
| `JMP` | Saltar a otra dirección |
| `HLT` | Detener la ejecución |

El procesador no interpreta directamente las palabras `MOV`, `ADD` o `HLT`. Cada instrucción tiene una codificación binaria llamada **código de operación** (*opcode*). Un **ensamblador** es el programa que traduce el texto escrito por el programador a esos códigos máquina.

### 1.1. Instrucción, mnemónico y operandos

Una instrucción puede tener un mnemónico y cero, uno o más **operandos**. Los operandos indican sobre qué dato, registro, dirección o puerto trabaja la instrucción.

```asm
MVI A, 05H
ADD B
HLT
```

Lectura conceptual:

1. `MVI A, 05H`: colocar el valor hexadecimal `05H` en el acumulador A.
2. `ADD B`: sumar a A el contenido del registro B.
3. `HLT`: detener el procesador.

En `MVI A, 05H`, `MVI` es el mnemónico y `A` y `05H` son los operandos.

### 1.2. No todo lo que aparece en un archivo assembler es una instrucción del CPU

Conviene distinguir:

- **Instrucción del 8085:** operación que ejecuta el procesador, por ejemplo `MOV`, `ADD`, `JNZ` o `HLT`.
- **Etiqueta:** nombre simbólico que identifica una posición del programa, por ejemplo `BUCLE:`.
- **Comentario:** texto para el lector, que el ensamblador ignora. En muchos ensambladores se introduce con `;`, pero hay que verificar la convención utilizada.
- **Directiva del ensamblador:** orden para el programa ensamblador, no para el microprocesador. Por ejemplo, algunos ensambladores usan directivas para indicar el origen del programa o el final del archivo. No forman parte del conjunto de instrucciones del 8085.

> **Importante:** el PDF describe las instrucciones del procesador, no las reglas particulares de un ensamblador o simulador. Por eso, los ejemplos usan una sintaxis habitual y simple. La forma de declarar el origen del programa, terminar el archivo o escribir comentarios puede cambiar según la herramienta de la cátedra.

---

## 2. Cómo piensa y trabaja el 8085

El 8085 ejecuta instrucciones almacenadas en memoria. De manera simplificada, el procesador:

1. Busca en memoria la instrucción indicada por el contador de programa.
2. Interpreta su código de operación y sus operandos.
3. Ejecuta la operación.
4. Continúa con la siguiente instrucción, salvo que una instrucción de salto, llamada, retorno o interrupción modifique el flujo.

### 2.1. El contador de programa (PC)

El **Program Counter (PC)** es un registro de 16 bits que contiene la dirección de memoria de la próxima instrucción que debe ejecutarse. Normalmente avanza a medida que se leen los bytes de una instrucción.

Un salto modifica el PC para que la ejecución continúe en otra dirección. Por eso, las instrucciones de salto permiten crear decisiones y repeticiones.

### 2.2. Datos de 8 bits y direcciones de 16 bits

El 8085 trabaja habitualmente con datos de **8 bits** (un byte), mientras que las direcciones de memoria son de **16 bits**.

Un byte tiene 8 bits:

$$
1\ \text{byte}=8\ \text{bits}
$$

Con 8 bits se representan 256 patrones distintos:

$$
2^8=256\quad\Rightarrow\quad 00H\text{ a }FFH
$$

Con 16 bits se representan 65.536 direcciones posibles:

$$
2^{16}=65.536\quad\Rightarrow\quad 0000H\text{ a }FFFFH
$$

Una operación aritmética de 8 bits guarda normalmente su resultado en 8 bits. Si el resultado necesita un noveno bit, ese bit adicional puede reflejarse en la bandera de transporte `CY`.

### 2.3. El orden de los bytes: primero el menos significativo

Cuando una instrucción contiene un valor de 16 bits, el 8085 coloca primero el byte de **menor peso** y después el byte de **mayor peso**.

Ejemplo: el valor `2050H` está compuesto por:

- Byte de menor peso: `50H`.
- Byte de mayor peso: `20H`.

Por lo tanto, en la codificación de una instrucción que lleva ese valor de 16 bits, se encuentra primero `50H` y luego `20H`.

> Esto no significa que debas escribir los operandos al revés en el código fuente. Se escribe `2050H`; el ensamblador se encarga de generar los bytes en el orden requerido.

---

## 3. Registros y memoria

Un **registro** es un pequeño espacio de almacenamiento dentro del procesador. Permite conservar temporalmente datos o direcciones para que las instrucciones puedan trabajar con ellos.

### 3.1. Registros de 8 bits

| Registro | Función general |
|---|---|
| `A` | Acumulador. Es el registro central de muchas operaciones aritméticas y lógicas. |
| `B`, `C` | Registros de uso general. |
| `D`, `E` | Registros de uso general. |
| `H`, `L` | Registros de uso general; juntos también pueden guardar una dirección de memoria. |

Los registros generales pueden guardar un byte cada uno.

### 3.2. Registros pares de 16 bits

Dos registros de 8 bits pueden combinarse para formar un par de 16 bits:

| Par | Byte alto | Byte bajo |
|---|---|---|
| `BC` | B | C |
| `DE` | D | E |
| `HL` | H | L |

Por ejemplo, si `H = 20H` y `L = 50H`, el par `HL` representa `2050H`.

$$
HL = H\cdot 256 + L
$$

El par `HL` es especialmente importante porque muchas instrucciones lo utilizan como **puntero a memoria**.

### 3.3. El registro M: no es un registro físico

En la notación del 8085, `M` representa el **contenido de la posición de memoria cuya dirección está guardada en HL**.

Si:

```asm
LXI H, 2050H
MVI M, 2AH
```

la primera instrucción coloca `2050H` en HL y la segunda guarda `2AH` en la posición de memoria `2050H`.

Conceptualmente:

$$
M\equiv [HL]\equiv \text{contenido de memoria en la dirección HL}
$$

Los corchetes significan "contenido de la posición de memoria indicada por". Por eso, `MOV A,M` no copia el valor de HL: copia a A el byte almacenado en la dirección a la que apunta HL.

### 3.4. PC y SP

| Registro | Nombre | Función |
|---|---|---|
| `PC` | Program Counter | Guarda la dirección de la próxima instrucción. |
| `SP` | Stack Pointer | Guarda la dirección del tope de la pila. |

Ambos son registros de 16 bits. El `SP` se utiliza en llamadas a subrutinas, retornos y operaciones de pila.

El material también utiliza:

- `PCH` y `PCL`: byte alto y byte bajo del PC.
- `SPH` y `SPL`: byte alto y byte bajo del SP.

---

## 4. Notación y símbolos del apunte

Esta sección reúne la simbología utilizada en las descripciones técnicas del PDF. No todos estos símbolos se escriben literalmente en un programa: muchos son una forma abreviada de explicar el efecto de una instrucción.

| Símbolo o abreviatura | Significado |
|---|---|
| `A` | Acumulador, registro A. |
| `r`, `r1`, `r2` | Uno de los registros A, B, C, D, E, H, L o M. |
| `rp` | Un registro par, normalmente BC, DE, HL o SP, según la instrucción. |
| `data`, `data 8` | Dato de 8 bits. |
| `data 16` | Dato de 16 bits. |
| `addr`, `dirección` | Dirección de memoria de 16 bits. |
| `byte 2` | Segundo byte de una instrucción; si hay un dato o dirección de 16 bits, contiene el byte de menor peso. |
| `byte 3` | Tercer byte de una instrucción; contiene el byte de mayor peso del dato o dirección de 16 bits. |
| `port` | Dirección de 8 bits de un puerto de entrada/salida. |
| `rh` | Byte alto de un registro par. |
| `rl` | Byte bajo de un registro par. |
| `PC`, `PCH`, `PCL` | Contador de programa completo, byte alto y byte bajo. |
| `SP`, `SPH`, `SPL` | Puntero de pila completo, byte alto y byte bajo. |
| `LABEL` | Dirección identificada mediante una etiqueta simbólica. |
| `Z`, `S`, `P`, `CY`, `AC` | Banderas de condición. |
| `M` | Posición de memoria apuntada por HL. |
| `(X)` o `[X]` | Contenido de X. Si X es una dirección, representa el contenido de esa posición de memoria. |
| `←` | Recibe o se carga con el valor de la derecha. |
| `↔` | Intercambio de contenidos. |
| `+`, `-` | Suma y resta. |
| `∧` | AND lógico, bit a bit. |
| `∨` | OR lógico, bit a bit. |
| `⊕` | OR exclusivo (XOR), bit a bit. |
| Una barra sobre un símbolo | Complemento lógico o inversión de bits. |
| `n` en `RST n` | Número de reinicio, de 0 a 7. |
| `NNN` | Representación binaria de ese número, de `000` a `111`. |
| `bm` | Número de un bit dentro de un registro. El bit menos significativo es el bit 0. |

### 4.1. Cómo leer una expresión de funcionamiento

Si una descripción dice:

$$
(A)\leftarrow(A)+(B)
$$

se lee: "el contenido de A recibe la suma del contenido de A más el contenido de B".

Si dice:

$$
(HL)\leftarrow(HL)+1
$$

significa que el valor de 16 bits formado por H y L se incrementa en una unidad.

**Regla práctica:** la flecha indica el destino; el lado derecho indica de dónde sale el dato o qué operación se calcula.

---

## 5. Modos de direccionamiento

El **modo de direccionamiento** indica cómo encuentra una instrucción el dato con el que va a trabajar. El material distingue cuatro modos principales.

### 5.1. Direccionamiento inmediato

El dato está escrito dentro de la propia instrucción. No hay que buscarlo en otra dirección de memoria indicada por un registro.

```asm
MVI A, 25H
ADI 03H
LXI H, 2050H
```

- `MVI A,25H`: el dato inmediato de 8 bits es `25H`.
- `ADI 03H`: el dato inmediato `03H` se suma al acumulador.
- `LXI H,2050H`: el valor inmediato de 16 bits `2050H` se carga en HL.

**Idea clave:** inmediato significa que el valor forma parte de los bytes de la instrucción.

### 5.2. Direccionamiento por registro

La instrucción indica directamente qué registro contiene el dato.

```asm
MOV A, B
ADD C
```

- `MOV A,B`: copia el contenido de B en A.
- `ADD C`: suma el contenido de C al acumulador A.

### 5.3. Direccionamiento indirecto por registro

La instrucción indica un registro par que contiene una **dirección de memoria**. El dato está guardado en esa dirección.

El caso más común es `M`, que utiliza HL:

```asm
LXI H, 2050H
MOV A, M
```

La secuencia es:

1. HL recibe la dirección `2050H`.
2. `MOV A,M` lee el byte almacenado en esa dirección y lo coloca en A.

Otras instrucciones, como `LDAX B` y `STAX B`, utilizan el par BC; las variantes con D utilizan DE. En estas instrucciones concretas no se utiliza HL.

### 5.4. Direccionamiento directo

La instrucción contiene la dirección de memoria donde está el dato.

```asm
LDA 2050H
STA 2051H
```

- `LDA 2050H`: A recibe el contenido de la dirección `2050H`.
- `STA 2051H`: el contenido de A se guarda en la dirección `2051H`.

### 5.5. No confundir valor con dirección

Supongamos que en la dirección `2050H` está almacenado el valor `3CH`.

- `MVI A, 3CH` carga el valor `3CH` directamente en A.
- `LDA 2050H` lee desde la dirección `2050H`.
- `LXI H, 2050H` coloca la dirección `2050H` en HL.
- `MOV A, M` lee desde la dirección que contiene HL.

Esas operaciones no son equivalentes. Una indica un **valor**; otra utiliza una **dirección**.

---

## 6. Banderas o flags

Las **banderas de condición** son bits internos que describen ciertas características del resultado de una operación. Algunas instrucciones las modifican; otras no.

El 8085 utiliza cinco banderas principales:

| Bandera | Nombre | Cuándo vale 1 |
|---|---|---|
| `Z` | Zero / Cero | El resultado es cero. |
| `S` | Sign / Signo | El bit más significativo del resultado vale 1. |
| `P` | Parity / Paridad | El resultado tiene una cantidad par de bits en 1. |
| `CY` | Carry / Transporte | Hay transporte en una suma o préstamo en una resta/comparación, según corresponda. |
| `AC` | Auxiliary Carry / Transporte auxiliar | Hay transporte del bit 3 al bit 4. Se utiliza especialmente en operaciones BCD y con `DAA`. |

### 6.1. Bandera Z: resultado cero

Si una operación produce cero, `Z=1`. Si produce un resultado distinto de cero, `Z=0`.

Ejemplo conceptual:

```asm
MVI A, 05H
SUI 05H
```

La resta deja A en cero, por lo que `Z` queda activada.

### 6.2. Bandera S: signo

`S` copia el valor del bit 7 del resultado. En una interpretación de números con signo en complemento a dos, suele utilizarse como indicador de signo:

- `S=0`: bit más significativo en 0.
- `S=1`: bit más significativo en 1.

La bandera describe el bit; por sí sola no determina qué interpretación numérica está usando el programa.

### 6.3. Bandera P: paridad

Se cuenta cuántos bits del resultado son `1`:

- Cantidad par de unos: `P=1`.
- Cantidad impar de unos: `P=0`.

Ejemplo: `00000011B` tiene dos bits en 1, por lo tanto tiene paridad par.

### 6.4. Bandera CY: transporte o préstamo

En una suma, `CY=1` cuando aparece un acarreo fuera del bit 7. En una resta o comparación, el material la describe como indicador de préstamo (*borrow*): `CY=1` cuando el minuendo es menor que el sustraendo.

Ejemplo de suma:

$$
FFH+01H=100H
$$

El acumulador conserva los ocho bits bajos (`00H`) y la bandera `CY` representa el noveno bit.

### 6.5. Bandera AC: transporte auxiliar

`AC` indica un transporte desde el bit 3 hacia el bit 4. Es relevante en operaciones con números decimales codificados en BCD y en la instrucción `DAA`.

### 6.6. Las banderas no siempre cambian

No hay que asumir que toda instrucción altera los flags.

| Instrucciones / grupo | Comportamiento general indicado por el material |
|---|---|
| Transferencia de datos (`MOV`, `MVI`, `LDA`, `STA`, etc.) | No modifica banderas. |
| Aritméticas (`ADD`, `SUB`, `ADC`, `SBB`, etc.) | Actualizan las banderas aritméticas correspondientes. |
| `INR` y `DCR` | Actualizan Z, S, P y AC, pero **no modifican CY**. |
| `INX` y `DCX` | No modifican banderas. |
| `DAD` | Solo modifica CY. |
| AND (`ANA`, `ANI`) | Actualiza Z, S, P; CY queda en 0 y AC en 1. |
| OR (`ORA`, `ORI`) y XOR (`XRA`, `XRI`) | Actualizan Z, S, P; CY y AC quedan en 0. |
| `CMP` y `CPI` | Actualizan las banderas como una resta, sin guardar el resultado. |
| Rotaciones (`RLC`, `RRC`, `RAL`, `RAR`) | Modifican CY. |
| `CMA` | No modifica banderas. |
| `CMC` y `STC` | Modifican CY. |
| Saltos y llamadas | No modifican banderas. |

> **Idea fundamental:** una instrucción condicional suele mirar una bandera que dejó una instrucción anterior. Por eso es importante revisar qué instrucción fue la última que modificó los flags.

---

## 7. Cómo se escribe un programa

Una instrucción suele escribirse con esta estructura:

```asm
ETIQUETA:  MNEMÓNICO  OPERANDO1, OPERANDO2  ; comentario
```

No todos los campos son obligatorios. Por ejemplo, `HLT` no necesita operandos.

### 7.1. Etiquetas

Una **etiqueta** es un nombre que representa una dirección del programa. Se utiliza para que los saltos y las llamadas sean más fáciles de leer.

```asm
INICIO:
    MVI A, 00H
    JMP INICIO
```

La etiqueta `INICIO` identifica la dirección de la primera instrucción de ese bloque. La forma exacta de escribir los dos puntos depende del ensamblador.

### 7.2. Constantes y bases numéricas

El material utiliza valores hexadecimales con el sufijo `H`:

```asm
MVI A, 2AH
```

En los ejemplos también puede aparecer la notación binaria con `B`:

```asm
MVI A, 00000101B
```

Las reglas para escribir valores decimales dependen del ensamblador. No conviene asumir un sufijo decimal universal.

### 7.3. Tamaño de instrucción

Las instrucciones del 8085 pueden ocupar uno, dos o tres bytes, según el mnemónico y sus operandos.

- Una instrucción sin dato o dirección adicional suele ocupar un byte.
- Una instrucción con un dato inmediato de 8 bits o un puerto suele ocupar dos bytes.
- Una instrucción que incluye un dato o dirección de 16 bits suele ocupar tres bytes.

El cuadro de códigos máquina de las páginas finales del PDF muestra los opcodes y permite consultar la codificación concreta.

---

## 8. Grupo de transferencia de datos

Estas instrucciones copian información entre registros, memoria y, en algunos casos, pares de registros. **Copiar no significa borrar el origen**: salvo que se indique un intercambio, el registro fuente conserva su valor.

### 8.1. `MOV`: mover o copiar un byte

| Forma | Efecto | Ejemplo |
|---|---|---|
| `MOV r1,r2` | Copia el contenido de `r2` en `r1`. | `MOV A,B` |
| `MOV r,M` | Lee desde la memoria apuntada por HL y copia en `r`. | `MOV C,M` |
| `MOV M,r` | Copia `r` en la memoria apuntada por HL. | `MOV M,A` |

Ejemplo:

```asm
MVI B, 2AH
MOV A, B
```

Al terminar, A contiene `2AH` y B también conserva `2AH`.

**Por qué se usa:** para pasar datos al registro donde una instrucción posterior los necesita.

**Atención:** `M` representa memoria apuntada por HL, no un registro común. Una instrucción `MOV` no puede leer una posición de memoria y escribir en otra directamente; para eso se usa un registro intermedio.

### 8.2. `MVI`: cargar un dato inmediato de 8 bits

```asm
MVI r, dato
MVI M, dato
```

Carga un valor de 8 bits en un registro o en la memoria apuntada por HL.

```asm
MVI A, 35H
MVI M, 7AH
```

La primera carga `35H` en A. La segunda escribe `7AH` en la posición de memoria indicada por HL.

### 8.3. `LXI`: cargar un par de registros con 16 bits

```asm
LXI rp, dato16
```

Carga un valor de 16 bits en BC, DE, HL o SP.

```asm
LXI H, 2050H
```

Después de esa instrucción, H contiene `20H` y L contiene `50H`. Se utiliza especialmente para inicializar un puntero de memoria o el puntero de pila.

### 8.4. `LDA` y `STA`: acceso directo al acumulador

| Instrucción | Efecto | Ejemplo |
|---|---|---|
| `LDA dirección` | A recibe el byte almacenado en la dirección indicada. | `LDA 2050H` |
| `STA dirección` | El contenido de A se guarda en la dirección indicada. | `STA 2051H` |

Se utilizan cuando se conoce explícitamente la dirección de memoria.

### 8.5. `LHLD` y `SHLD`: acceso directo al par HL

| Instrucción | Efecto |
|---|---|
| `LHLD dirección` | Carga L desde la dirección indicada y H desde la dirección siguiente. |
| `SHLD dirección` | Guarda L en la dirección indicada y H en la dirección siguiente. |

Ejemplo:

```asm
LHLD 2050H
```

Si `[2050H]=34H` y `[2051H]=12H`, después de la instrucción:

- L = `34H`.
- H = `12H`.
- HL = `1234H`.

### 8.6. `LDAX` y `STAX`: acceso indirecto mediante BC o DE

| Instrucción | Efecto |
|---|---|
| `LDAX B` / `LDAX D` | Carga A desde la dirección guardada en BC o DE. |
| `STAX B` / `STAX D` | Guarda A en la dirección guardada en BC o DE. |

Ejemplo:

```asm
LXI B, 2050H
LDAX B
```

A recibe el byte almacenado en `2050H`.

**Importante:** aunque el apunte utiliza la notación general `rp`, las variantes `LDAX` y `STAX` del 8085 usan BC o DE; no se debe asumir que aceptan cualquier par.

### 8.7. `XCHG`: intercambiar HL y DE

Intercambia los contenidos de los dos pares:

$$
H\leftrightarrow D\qquad L\leftrightarrow E
$$

Ejemplo: si HL=`1234H` y DE=`ABCDH`, después de `XCHG`, HL=`ABCDH` y DE=`1234H`.

**Diferencia con `MOV`:** `MOV` copia; `XCHG` intercambia.

---

## 9. Grupo aritmético

Las operaciones aritméticas trabajan principalmente con el acumulador A. El resultado de las operaciones de 8 bits se guarda normalmente en A, mientras que las instrucciones sobre pares pueden trabajar con 16 bits.

### 9.1. Sumas: `ADD`, `ADI`, `ADC` y `ACI`

| Instrucción | Operación conceptual | Tipo de operando |
|---|---|---|
| `ADD r` | A recibe A + registro. | Registro de 8 bits. |
| `ADD M` | A recibe A + byte en `[HL]`. | Memoria indirecta. |
| `ADI dato` | A recibe A + dato inmediato. | Dato de 8 bits. |
| `ADC r` / `ADC M` | A recibe A + operando + CY anterior. | Registro o memoria. |
| `ACI dato` | A recibe A + dato inmediato + CY anterior. | Dato inmediato. |

Ecuaciones conceptuales:

$$
ADD:\quad A\leftarrow A+operando
$$

$$
ADC:\quad A\leftarrow A+operando+CY
$$

Ejemplo:

```asm
MVI A, 05H
MVI B, 03H
ADD B
```

A termina en `08H`. B sigue valiendo `03H`.

**¿Para qué sirve ADC?** Para sumar números que ocupan más de un byte. El acarreo generado al sumar el byte bajo se incorpora cuando se suma el byte alto.

### 9.2. Restas: `SUB`, `SUI`, `SBB` y `SBI`

| Instrucción | Operación conceptual | Tipo de operando |
|---|---|---|
| `SUB r` / `SUB M` | A recibe A - operando. | Registro o memoria. |
| `SUI dato` | A recibe A - dato inmediato. | Dato de 8 bits. |
| `SBB r` / `SBB M` | A recibe A - operando - CY. | Registro o memoria. |
| `SBI dato` | A recibe A - dato inmediato - CY. | Dato inmediato. |

$$
SUB:\quad A\leftarrow A-operando
$$

$$
SBB:\quad A\leftarrow A-operando-CY
$$

Ejemplo:

```asm
MVI A, 0AH
SUI 03H
```

A termina en `07H`.

**¿Para qué sirve SBB/SBI?** Para restar números de varios bytes, incorporando el préstamo que vino de la resta del byte anterior.

### 9.3. Incremento y decremento: `INR` y `DCR`

| Instrucción | Efecto |
|---|---|
| `INR r` | Incrementa en uno el registro indicado. |
| `INR M` | Incrementa en uno el byte de memoria apuntado por HL. |
| `DCR r` | Decrementa en uno el registro indicado. |
| `DCR M` | Decrementa en uno el byte de memoria apuntado por HL. |

$$
INR:\quad operando\leftarrow operando+1
$$

$$
DCR:\quad operando\leftarrow operando-1
$$

Ejemplo:

```asm
MVI C, 04H
INR C
DCR C
```

C queda finalmente en `04H`.

**Detalle importante del 8085:** `INR` y `DCR` no modifican CY. Sí modifican las banderas Z, S, P y AC. Esto importa mucho al escribir bucles: `DCR B` puede cambiar Z sin borrar el CY que existía previamente.

### 9.4. Incremento y decremento de pares: `INX` y `DCX`

| Instrucción | Efecto |
|---|---|
| `INX rp` | Incrementa un par de registros o SP en uno. |
| `DCX rp` | Decrementa un par de registros o SP en uno. |

Ejemplo:

```asm
LXI H, 2050H
INX H
```

HL pasa a contener `2051H`.

**Diferencia importante:** `INR H` modifica solamente el registro H; `INX H` incrementa el par HL completo. `INX` y `DCX` no modifican las banderas.

### 9.5. `DAD`: suma de 16 bits en HL

```asm
DAD rp
```

Suma el contenido del par seleccionado al valor de HL. El resultado queda en HL.

$$
HL\leftarrow HL+rp
$$

Ejemplo:

```asm
LXI H, 1000H
LXI D, 0020H
DAD D
```

HL queda en `1020H`.

Esta instrucción solo modifica la bandera CY; las demás banderas no cambian.

### 9.6. `DAA`: ajuste decimal del acumulador

`DAA` significa *Decimal Adjust Accumulator*. Se utiliza después de una operación aritmética cuando los números están representados en **BCD** (*Binary Coded Decimal*).

En BCD, cada dígito decimal se representa con cuatro bits. Por ejemplo, el número decimal 45 se representa como dos dígitos BCD: `0100 0101`.

Una suma binaria puede producir un nibble que no sea un dígito BCD válido (mayor que 9). `DAA` corrige el acumulador teniendo en cuenta los nibbles y las banderas auxiliares.

Según el procedimiento resumido en el material:

1. Si los cuatro bits menos significativos son mayores que 9, o `AC=1`, se suma `06H`.
2. Si los cuatro bits más significativos son mayores que 9, o `CY=1`, se suma `60H`.

Ejemplo de uso:

```asm
; Se supone que A contiene el resultado de una suma BCD.
DAA
```

`DAA` **no es una instrucción para convertir cualquier número binario a decimal**. Su uso corresponde al ajuste de resultados BCD, normalmente inmediatamente después de una operación aritmética adecuada.

---

## 10. Grupo lógico

Las instrucciones lógicas realizan operaciones **bit a bit**. Se aplican al acumulador y a un registro, a la memoria apuntada por HL o a un dato inmediato.

### 10.1. AND: `ANA` y `ANI`

| Instrucción | Operación |
|---|---|
| `ANA r` / `ANA M` | A AND registro o memoria. |
| `ANI dato` | A AND dato inmediato. |

La operación AND produce 1 solamente cuando ambos bits son 1.

| A | B | A AND B |
|---:|---:|---:|
| 0 | 0 | 0 |
| 0 | 1 | 0 |
| 1 | 0 | 0 |
| 1 | 1 | 1 |

Ejemplo:

```asm
MVI A, 0FH
ANI 03H
```

Conceptualmente:

$$
00001111B\ \text{AND}\ 00000011B=00000011B
$$

El resultado queda en A. Una aplicación habitual de AND es **enmascarar bits**, es decir, conservar algunos y poner otros en cero.

### 10.2. OR: `ORA` y `ORI`

| Instrucción | Operación |
|---|---|
| `ORA r` / `ORA M` | A OR registro o memoria. |
| `ORI dato` | A OR dato inmediato. |

La operación OR produce 1 cuando al menos uno de los dos bits es 1.

| A | B | A OR B |
|---:|---:|---:|
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 1 |

Ejemplo:

```asm
MVI A, 30H
ORI 05H
```

$$
00110000B\ \text{OR}\ 00000101B=00110101B
$$

Una aplicación habitual de OR es activar determinados bits sin modificar los que ya están en 1.

### 10.3. XOR: `XRA` y `XRI`

| Instrucción | Operación |
|---|---|
| `XRA r` / `XRA M` | A XOR registro o memoria. |
| `XRI dato` | A XOR dato inmediato. |

XOR (OR exclusivo) produce 1 cuando los bits son diferentes.

| A | B | A XOR B |
|---:|---:|---:|
| 0 | 0 | 0 |
| 0 | 1 | 1 |
| 1 | 0 | 1 |
| 1 | 1 | 0 |

Ejemplo frecuente para limpiar el acumulador:

```asm
XRA A
```

Cada bit de A se compara consigo mismo mediante XOR, por lo que todos quedan en cero.

### 10.4. Comparación: `CMP` y `CPI`

| Instrucción | Qué compara |
|---|---|
| `CMP r` / `CMP M` | Compara A con un registro o con memoria. |
| `CPI dato` | Compara A con un dato inmediato. |

La comparación se comporta como una resta a efectos de las banderas, pero **no guarda el resultado en A ni modifica el operando**.

$$
CMP:\quad \text{actualiza flags como si calculara }A-operando
$$

Reglas útiles:

- Si A es igual al operando, `Z=1`.
- Si A es menor que el operando, `CY=1`.
- Si A es mayor que el operando, `Z=0` y `CY=0`.

Ejemplo:

```asm
MVI A, 05H
CPI 05H
JZ SON_IGUALES
```

La comparación activa Z y el salto condicional puede utilizar esa bandera.

### 10.5. Rotaciones del acumulador

Las rotaciones desplazan los bits de A y hacen circular un bit hacia otra posición o hacia la bandera CY.

| Instrucción | Qué hace |
|---|---|
| `RLC` | Rota A a la izquierda. El bit 7 pasa a CY y también al bit 0. |
| `RRC` | Rota A a la derecha. El bit 0 pasa a CY y también al bit 7. |
| `RAL` | Rota A a la izquierda a través de CY. El CY anterior entra por el bit 0 y el bit 7 pasa a CY. |
| `RAR` | Rota A a la derecha a través de CY. El CY anterior entra por el bit 7 y el bit 0 pasa a CY. |

Diferencia principal:

- `RLC` y `RRC` giran los ocho bits de A entre sí; CY recibe una copia del bit que sale.
- `RAL` y `RAR` incluyen a CY en el recorrido, como si fuera un noveno bit.

Estas instrucciones modifican CY; no se deben confundir con una suma o multiplicación.

### 10.6. Complementos y control de CY

| Instrucción | Efecto |
|---|---|
| `CMA` | Invierte todos los bits del acumulador A. No cambia banderas. |
| `CMC` | Complementa CY: si era 0 pasa a 1 y viceversa. |
| `STC` | Pone CY en 1, independientemente de su estado anterior. |

Complementar A no es lo mismo que negar un número en complemento a dos. `CMA` invierte bits, pero no suma uno.

---

## 11. Grupo de saltos y control del flujo

Por defecto, el procesador continúa ejecutando instrucciones en direcciones sucesivas. Un **salto** modifica esa secuencia.

### 11.1. `JMP`: salto incondicional

```asm
JMP dirección
```

Carga en PC la dirección indicada. El programa continúa ejecutándose desde allí, sin comprobar una bandera.

```asm
JMP INICIO
```

Se utiliza para crear repeticiones o para trasladar la ejecución a otro bloque.

### 11.2. Saltos condicionales

Un salto condicional modifica PC solamente cuando se cumple la condición indicada por una bandera.

| Instrucción | Condición | Significado |
|---|---|---|
| `JNZ addr` | Z = 0 | Saltar si el resultado no fue cero. |
| `JZ addr` | Z = 1 | Saltar si el resultado fue cero. |
| `JNC addr` | CY = 0 | Saltar si no hay transporte/préstamo. |
| `JC addr` | CY = 1 | Saltar si hay transporte/préstamo. |
| `JPO addr` | P = 0 | Saltar si la paridad es impar. |
| `JPE addr` | P = 1 | Saltar si la paridad es par. |
| `JP addr` | S = 0 | Saltar si el bit de signo es 0 (positivo). |
| `JM addr` | S = 1 | Saltar si el bit de signo es 1 (negativo). |

**Atención con la letra P:** la bandera `P` representa paridad. Sin embargo, en la condición `JP`, la letra P significa *plus* (signo positivo). Para paridad se utilizan `JPO` y `JPE`.

### 11.3. El patrón comparar y decidir

Una decisión habitual tiene tres pasos:

1. Cargar o calcular un valor.
2. Compararlo con otro valor usando `CMP` o `CPI`.
3. Ejecutar un salto condicional según las banderas.

```asm
MVI A, 05H
CPI 05H
JZ IGUALES
JMP DISTINTOS

IGUALES:
    ; bloque para el caso igual
    HLT

DISTINTOS:
    ; bloque para el caso distinto
    HLT
```

El ejemplo muestra el patrón de control; la sintaxis de comentarios y etiquetas debe adaptarse al ensamblador.

### 11.4. `CALL`: llamada a una subrutina

```asm
CALL dirección
```

Llama a una subrutina:

1. Guarda en la pila la dirección de la instrucción que debe ejecutarse al terminar la subrutina.
2. Modifica PC para comenzar a ejecutar desde la dirección llamada.

La dirección de retorno es necesaria para que `RET` pueda volver al programa que hizo la llamada.

### 11.5. Llamadas condicionales

El material también contempla llamadas que se ejecutan solo si una condición es verdadera:

| Instrucción | Condición |
|---|---|
| `CNZ addr` | Z = 0 |
| `CZ addr` | Z = 1 |
| `CNC addr` | CY = 0 |
| `CC addr` | CY = 1 |
| `CPO addr` | P = 0 |
| `CPE addr` | P = 1 |
| `CP addr` | S = 0 |
| `CM addr` | S = 1 |

Si la condición no se cumple, el programa continúa normalmente.

### 11.6. `RET` y retornos condicionales

`RET` recupera de la pila la dirección de retorno y la coloca en PC.

El material incluye retornos condicionales:

| Instrucción | Condición |
|---|---|
| `RNZ` | Z = 0 |
| `RZ` | Z = 1 |
| `RNC` | CY = 0 |
| `RC` | CY = 1 |
| `RPO` | P = 0 |
| `RPE` | P = 1 |
| `RP` | S = 0 |
| `RM` | S = 1 |

### 11.7. `RST n`: reinicio en una dirección fija

`RST` es una llamada especial a una dirección fija. El número `n` va de 0 a 7 y el destino se calcula así:

$$
Destino=8\times n
$$

| Instrucción | Dirección de destino |
|---|---:|
| `RST 0` | `0000H` |
| `RST 1` | `0008H` |
| `RST 2` | `0010H` |
| `RST 3` | `0018H` |
| `RST 4` | `0020H` |
| `RST 5` | `0028H` |
| `RST 6` | `0030H` |
| `RST 7` | `0038H` |

Como una llamada, guarda la dirección de retorno en la pila.

### 11.8. `PCHL`: salto indirecto mediante HL

Carga PC con el contenido del par HL:

$$
PC\leftarrow HL
$$

No contiene la dirección de destino como operando; utiliza el valor que ya está almacenado en HL.

---

## 12. Pila y subrutinas

La **pila** (*stack*) es una zona de memoria utilizada para guardar temporalmente información. El registro `SP` señala su tope.

En el 8085, al apilar un dato, SP se decrementa. Al recuperar un dato, SP se incrementa. Por eso suele decirse que la pila crece hacia direcciones menores.

### 12.1. `PUSH`: guardar un par en la pila

```asm
PUSH B
PUSH D
PUSH H
PUSH PSW
```

`PUSH` guarda dos bytes en la pila y decrementa SP en dos unidades. Se puede usar con BC, DE, HL o PSW. **No se usa `PUSH SP`.**

### 12.2. `POP`: recuperar un par de la pila

```asm
POP B
POP D
POP H
POP PSW
```

Recupera dos bytes desde el tope de la pila y aumenta SP en dos unidades. El registro par debe coincidir con el formato de los datos que se habían guardado.

`PUSH` y `POP` deben utilizarse en orden compatible: si se apilan varios pares, se recupera primero el último que se guardó. Es el principio **LIFO** (*Last In, First Out*: último en entrar, primero en salir).

### 12.3. `PSW`: acumulador y banderas

`PSW` (*Program Status Word*) representa el acumulador A junto con el registro de banderas. Permite guardar o recuperar ambos mediante `PUSH PSW` y `POP PSW`.

Esto es útil cuando una subrutina necesita utilizar A o modificar banderas, pero el programa principal debe recuperar sus valores anteriores.

### 12.4. `CALL` y `RET` trabajan con la pila

`CALL` guarda la dirección de retorno y `RET` la recupera. Por eso, el funcionamiento correcto de las subrutinas depende de que SP esté inicializado y de no alterar accidentalmente la información guardada en la pila.

Ejemplo conceptual:

```asm
INICIO:
    CALL SUMAR
    HLT

SUMAR:
    MVI A, 05H
    INR A
    RET
```

La ejecución salta a `SUMAR`; al llegar a `RET`, vuelve a la instrucción posterior a `CALL`.

### 12.5. `XTHL`: intercambiar HL con el tope de la pila

Intercambia:

- L con el byte ubicado en la dirección indicada por SP.
- H con el byte ubicado en la dirección siguiente (`SP+1`).

**El contenido de SP no cambia.** El apunte escaneado tiene una notación junto a esta instrucción que puede confundirse con un incremento de SP; la descripción técnica de Intel aclara que XTHL deja SP sin modificar. [Referencia: manual de programación Intel 8080/8085, instrucción XTHL](https://www.bitsavers.org/components/intel/MCS80/9800301D_8080_8085_Assembly_Language_Programming_Manual_May81.pdf).

### 12.6. `SPHL`: copiar HL en SP

```asm
SPHL
```

Carga el puntero de pila con el valor de HL:

$$
SP\leftarrow HL
$$

Los registros H y L no se modifican. Se utiliza, por ejemplo, para inicializar SP a partir de una dirección que se haya preparado en HL.

---

## 13. Entrada, salida y control de interrupciones

### 13.1. `IN` y `OUT`: comunicación con puertos

El 8085 puede comunicarse con dispositivos externos mediante puertos de entrada/salida.

| Instrucción | Acción |
|---|---|
| `IN port` | Lee un byte del puerto indicado y lo coloca en A. |
| `OUT port` | Envía el contenido de A al puerto indicado. |

Ejemplo:

```asm
IN  10H
OUT 20H
```

La primera instrucción lee el puerto `10H` y deja el byte en A. La segunda envía ese byte al puerto `20H`, siempre que A no haya sido modificado entre ambas instrucciones.

Los puertos se identifican mediante una dirección de 8 bits, de `00H` a `FFH`.

### 13.2. `EI` y `DI`: habilitar y deshabilitar interrupciones

Una **interrupción** es un evento que puede hacer que el procesador suspenda momentáneamente el flujo normal para atender una rutina especial.

| Instrucción | Significado |
|---|---|
| `EI` | Habilita el reconocimiento de interrupciones enmascarables. |
| `DI` | Deshabilita el reconocimiento de interrupciones enmascarables. |

Estas instrucciones no modifican las cinco banderas aritméticas. El efecto de habilitación o deshabilitación se aplica a partir de la instrucción siguiente, de acuerdo con la descripción del material.

### 13.3. Interrupciones RST 5.5, RST 6.5 y RST 7.5

El material dedica las instrucciones `RIM` y `SIM` al control y lectura de información relacionada con interrupciones. Las tres líneas mencionadas tienen máscaras individuales:

- RST 5.5
- RST 6.5
- RST 7.5

Una **máscara** permite impedir que una interrupción sea atendida. En la codificación explicada por el PDF, para las máscaras RST 5.5, 6.5 y 7.5, el valor 1 significa enmascarada (bloqueada) y 0 significa habilitada a nivel de máscara.

### 13.4. `RIM`: leer máscara y estado de interrupciones

`RIM` (*Read Interrupt Mask*) carga en A información del sistema de interrupciones y de la entrada serial.

Distribución de bits de A después de `RIM`:

| Bit | Información |
|---:|---|
| 7 | SID: dato de entrada serial. |
| 6 | Estado pendiente de RST 7.5. |
| 5 | Estado pendiente de RST 6.5. |
| 4 | Estado pendiente de RST 5.5. |
| 3 | IE: estado de habilitación global de interrupciones. |
| 2 | Máscara de RST 7.5. |
| 1 | Máscara de RST 6.5. |
| 0 | Máscara de RST 5.5. |

`RIM` sirve para consultar el estado actual. No debe confundirse con `SIM`, que permite configurar máscaras y salida serial.

### 13.5. `SIM`: configurar máscaras y salida serial

`SIM` (*Set Interrupt Mask*) utiliza el contenido de A para configurar distintas funciones.

Distribución de bits de A antes de ejecutar `SIM`:

| Bit | Función |
|---:|---|
| 7 | SOD: dato de salida serial. |
| 6 | SOE: habilitación de salida serial. |
| 5 | No utilizado / ignorado. |
| 4 | R7.5: reinicia el flip-flop de la interrupción RST 7.5 cuando corresponde. |
| 3 | MSE: habilita la actualización de las máscaras. |
| 2 | M7.5: máscara de RST 7.5. |
| 1 | M6.5: máscara de RST 6.5. |
| 0 | M5.5: máscara de RST 5.5. |

Para modificar las máscaras, `MSE` debe estar en 1. Con MSE en 0, los bits de máscara no se actualizan. En este grupo también se controla el latch de salida serial SOD mediante SOE y el bit de dato SOD.

> **Para empezar:** alcanza con reconocer que `RIM` consulta y `SIM` configura. El detalle de interrupciones y comunicación serial es un tema más avanzado y conviene practicarlo después de dominar registros, memoria, flags y saltos.

### 13.6. `HLT`: detener la ejecución

`HLT` detiene el procesador. No modifica los registros ni las banderas. El PC queda apuntando a la instrucción siguiente. La reanudación depende de las condiciones del sistema, por ejemplo un evento externo o un mecanismo de reinicio.

En ejercicios iniciales suele utilizarse para indicar el final del programa.

### 13.7. `NOP`: no realizar una operación

`NOP` no modifica registros ni banderas. El procesador consume tiempo de ejecución y continúa con la siguiente instrucción.

Puede utilizarse como espacio reservado, para ajustar tiempos o para dejar un lugar donde más adelante se insertará una instrucción.

---

## 14. Ejemplos completos

Los siguientes ejemplos muestran cómo combinar instrucciones. Se busca comprender el razonamiento, no memorizar programas.

### 14.1. Cargar, sumar y guardar

**Consigna:** cargar `05H` en A, cargar `03H` en B, sumar B a A y guardar el resultado en `2050H`.

```asm
INICIO:
    MVI A, 05H      ; A = 05H
    MVI B, 03H      ; B = 03H
    ADD B           ; A = A + B
    STA 2050H       ; Memoria[2050H] = A
    HLT
```

Resultado esperado: A contiene `08H` y la dirección `2050H` contiene `08H`.

### 14.2. Leer un valor mediante HL y modificarlo

**Consigna:** leer el byte de `2050H`, incrementarlo y guardarlo en `2051H`.

```asm
INICIO:
    LDA 2050H       ; A = Memoria[2050H]
    INR A           ; A = A + 1
    STA 2051H       ; Memoria[2051H] = A
    HLT
```

Este ejemplo utiliza direccionamiento directo. Una variante podría cargar `2050H` en HL y operar mediante M.

```asm
INICIO:
    LXI H, 2050H    ; HL apunta a 2050H
    MOV A, M        ; A = Memoria[HL]
    INR A           ; A = A + 1
    INX H           ; HL apunta a 2051H
    MOV M, A        ; Memoria[HL] = A
    HLT
```

Ambos ejemplos resuelven la misma tarea, pero muestran dos maneras distintas de acceder a memoria.

### 14.3. Repetir una operación con un contador

**Consigna:** sumar en A los valores que va tomando B desde `05H` hasta `01H`.

```asm
INICIO:
    MVI A, 00H      ; Acumulador inicial en cero
    MVI B, 05H      ; Contador / valor inicial

BUCLE:
    ADD B           ; Acumular el valor actual de B
    DCR B           ; B = B - 1
    JNZ BUCLE       ; Si B no es cero, repetir

    HLT
```

La clave está en el orden:

1. Se utiliza el valor actual de B.
2. Se decrementa B.
3. `JNZ` consulta la Z que acaba de modificar `DCR B`.

Al terminar, A contiene `0FH` (5 + 4 + 3 + 2 + 1).

### 14.4. Decidir según una comparación

**Consigna:** comparar A con `0AH` y separar el flujo si son iguales.

```asm
INICIO:
    MVI A, 0AH
    CPI 0AH
    JZ IGUAL

DISTINTO:
    MVI B, 00H
    JMP FIN

IGUAL:
    MVI B, 01H

FIN:
    HLT
```

`CPI` no cambia A; solo actualiza las banderas. `JZ` utiliza la bandera Z para decidir qué bloque ejecutar.

### 14.5. Usar una subrutina

```asm
INICIO:
    MVI A, 04H
    CALL INCREMENTAR
    STA 2050H
    HLT

INCREMENTAR:
    INR A
    RET
```

El programa principal carga A y llama a `INCREMENTAR`. `CALL` guarda la dirección de retorno en la pila. La subrutina incrementa A y `RET` vuelve al punto posterior a la llamada.

**Condición importante:** antes de utilizar `CALL`, `RET`, `PUSH` o `POP`, el programa debe contar con un SP correctamente inicializado para la memoria que se utilizará como pila. La forma de inicializarlo depende del entorno y de las convenciones del ejercicio.

---

## 15. Errores frecuentes al empezar

| Error | Por qué está mal / cómo pensarlo |
|---|---|
| Confundir `M` con un registro normal. | `M` representa memoria apuntada por HL. Primero hay que preparar HL. |
| Confundir `MVI A,25H` con `LDA 25H`. | La primera carga el valor inmediato `25H`; la segunda usa `25H` como dirección de memoria. |
| Creer que `MOV` intercambia datos. | `MOV` copia. Para intercambiar HL y DE se usa `XCHG`. |
| Creer que `ADD B` guarda el resultado en B. | Las instrucciones ADD del grupo indicado suman al acumulador A y guardan el resultado en A. |
| Pensar que `INR` modifica CY. | `INR` y `DCR` no modifican CY en el 8085. |
| Usar `JNZ` sin saber de qué operación viene Z. | El salto consulta la bandera Z que dejó una instrucción anterior. |
| Pensar que `CMP` cambia A. | `CMP` compara; no almacena el resultado de la resta. |
| Confundir `INX H` con `INR H`. | `INX H` incrementa el par HL; `INR H` incrementa solo H. |
| Usar `CALL` sin prever la pila. | CALL almacena la dirección de retorno utilizando SP. |
| Usar `RET` sin una llamada válida o sin pila preparada. | RET toma una dirección desde la pila; si allí no hay una dirección de retorno válida, el flujo será incorrecto. |
| Confundir `HLT` con `NOP`. | HLT detiene; NOP no realiza una operación y continúa. |
| Suponer que todos los mnemónicos aceptan cualquier registro. | Algunas instrucciones tienen restricciones: por ejemplo LDAX/STAX usan BC o DE; PUSH/POP no usan SP. |

---

## 16. Método para resolver ejercicios

Antes de escribir código, conviene traducir la consigna a operaciones pequeñas.

### Paso 1: identificar datos y destinos

Preguntarse:

- ¿Qué valores iniciales tengo?
- ¿Dónde están: en registros, en memoria o como constantes?
- ¿Dónde debe quedar el resultado?

### Paso 2: elegir dónde guardar cada dato

Por ejemplo:

- A para operaciones aritméticas y lógicas.
- B o C como contador u operandos auxiliares.
- HL para apuntar a una dirección de memoria.
- SP para la pila.

### Paso 3: convertir cada acción en una instrucción

| Acción expresada en la consigna | Posible instrucción |
|---|---|
| Cargar una constante de 8 bits en un registro | `MVI` |
| Copiar entre registros | `MOV` |
| Cargar una dirección en HL | `LXI H, dirección` |
| Leer desde la memoria apuntada por HL | `MOV A,M` |
| Sumar un registro a A | `ADD` |
| Incrementar un contador | `INR` o `INX`, según el tamaño |
| Comparar A con una constante | `CPI` |
| Repetir mientras el resultado no sea cero | `JNZ` |
| Guardar A en una dirección conocida | `STA` |
| Finalizar el ejercicio | `HLT` |

### Paso 4: seguir los valores a mano

Una tabla de seguimiento permite detectar errores:

| Instrucción ejecutada | A | B | HL | Observación |
|---|---:|---:|---:|---|
| `MVI A,05H` | 05H | -- | -- | A recibe 5. |
| `MVI B,03H` | 05H | 03H | -- | B recibe 3. |
| `ADD B` | 08H | 03H | -- | A recibe 5 + 3. |

No hace falta completar una tabla para cada programa pequeño, pero es una excelente herramienta cuando aparecen saltos, memoria o banderas.

### Paso 5: revisar las banderas y el flujo

Cuando aparezca un salto condicional, identificar exactamente qué instrucción generó el valor de Z, CY, P o S que se está consultando.

### Lista de control antes de dar un programa por terminado

- [ ] ¿Cada instrucción tiene los operandos correctos?
- [ ] ¿Distinguí valores inmediatos de direcciones de memoria?
- [ ] ¿Preparé HL antes de usar M?
- [ ] ¿El resultado queda en el registro o dirección que pide la consigna?
- [ ] ¿El salto consulta las banderas correctas?
- [ ] ¿Los bucles tienen una condición de salida?
- [ ] ¿La pila está preparada si uso CALL, RET, PUSH o POP?
- [ ] ¿El programa tiene un punto de finalización apropiado?

---

## 17. Resumen de consulta rápida

### 17.1. Transferencia de datos

| Instrucción | Recordatorio |
|---|---|
| `MOV` | Copiar entre registros o entre registro y memoria M. |
| `MVI` | Cargar un byte inmediato. |
| `LXI` | Cargar 16 bits en un par. |
| `LDA` / `STA` | Leer / escribir A usando dirección directa. |
| `LHLD` / `SHLD` | Leer / escribir HL usando dos direcciones consecutivas. |
| `LDAX` / `STAX` | Leer / escribir A mediante BC o DE. |
| `XCHG` | Intercambiar HL y DE. |

### 17.2. Aritmética

| Instrucción | Recordatorio |
|---|---|
| `ADD` / `ADI` | Sumar operando a A. |
| `ADC` / `ACI` | Sumar operando y CY a A. |
| `SUB` / `SUI` | Restar operando de A. |
| `SBB` / `SBI` | Restar operando y CY de A. |
| `INR` / `DCR` | Incrementar / decrementar un byte; no cambian CY. |
| `INX` / `DCX` | Incrementar / decrementar un par de 16 bits; no cambian flags. |
| `DAD` | Sumar un par a HL; solo modifica CY. |
| `DAA` | Ajustar A luego de aritmética BCD. |

### 17.3. Lógica

| Instrucción | Recordatorio |
|---|---|
| `ANA` / `ANI` | AND con registro/memoria o dato inmediato. |
| `ORA` / `ORI` | OR con registro/memoria o dato inmediato. |
| `XRA` / `XRI` | XOR con registro/memoria o dato inmediato. |
| `CMP` / `CPI` | Comparar A; no guardar resultado. |
| `RLC` / `RRC` | Rotar A a izquierda / derecha. |
| `RAL` / `RAR` | Rotar A a través de CY. |
| `CMA` | Complementar bits de A. |
| `CMC` / `STC` | Complementar / poner en 1 CY. |

### 17.4. Control del programa

| Instrucción | Recordatorio |
|---|---|
| `JMP` | Salto incondicional. |
| `JZ` / `JNZ` | Saltar según Z. |
| `JC` / `JNC` | Saltar según CY. |
| `JPE` / `JPO` | Saltar según paridad. |
| `JP` / `JM` | Saltar según bit de signo. |
| `CALL` | Llamar subrutina y guardar retorno en pila. |
| `RET` | Volver desde subrutina. |
| `RST 0` a `RST 7` | Llamada a vector fijo, múltiplo de 8. |
| `PCHL` | Copiar HL en PC. |

### 17.5. Pila, máquina y E/S

| Instrucción | Recordatorio |
|---|---|
| `PUSH` / `POP` | Guardar / recuperar pares o PSW en la pila. |
| `XTHL` | Intercambiar HL con los dos bytes del tope de pila; SP no cambia. |
| `SPHL` | Copiar HL en SP. |
| `IN` / `OUT` | Leer / escribir un puerto usando A. |
| `EI` / `DI` | Habilitar / deshabilitar interrupciones enmascarables. |
| `RIM` / `SIM` | Leer / configurar información de interrupciones y serie. |
| `NOP` | No operación. |
| `HLT` | Detener procesador. |

---

## 18. Glosario

| Término | Definición simple |
|---|---|
| **Acumulador** | Registro A, utilizado como destino o fuente de muchas operaciones aritméticas y lógicas. |
| **Assembler / Assembly** | Lenguaje simbólico de bajo nivel que representa instrucciones del procesador. |
| **Byte** | Grupo de 8 bits. |
| **Código máquina** | Representación binaria de las instrucciones que ejecuta el procesador. |
| **Código de operación / Opcode** | Parte de la codificación que identifica qué instrucción se ejecuta. |
| **Contador de programa (PC)** | Registro que indica la dirección de la próxima instrucción. |
| **Dato inmediato** | Valor que está incluido en los bytes de la propia instrucción. |
| **Direccionamiento** | Forma en la que una instrucción localiza su dato. |
| **Ensamblador** | Programa que traduce el código assembler a código máquina. |
| **Etiqueta** | Nombre simbólico asociado a una dirección del programa. |
| **Flag / Bandera** | Bit que informa una condición del resultado o del estado del procesador. |
| **Memoria indirecta** | Acceso a memoria a través de una dirección guardada en un registro o par de registros. |
| **Mnemónico** | Abreviatura textual de una instrucción, como `MOV` o `ADD`. |
| **Operando** | Registro, dato, dirección o puerto sobre el que trabaja una instrucción. |
| **Pila / Stack** | Estructura de memoria LIFO utilizada para guardar datos y direcciones temporalmente. |
| **Puntero** | Registro o valor que contiene una dirección de memoria. |
| **Subrutina** | Bloque de instrucciones que puede llamarse desde otro lugar y luego retornar. |

---

## Cierre: qué conviene dominar primero

Para empezar a escribir programas sin sentirse abrumado, el orden recomendado es:

1. Identificar A, B, C, D, E, H, L y comprender qué significa M.
2. Dominar `MOV`, `MVI`, `LXI`, `LDA` y `STA`.
3. Practicar `ADD`, `ADI`, `SUB`, `SUI`, `INR` y `DCR`.
4. Entender las banderas Z y CY antes de escribir saltos.
5. Practicar `CMP`, `CPI`, `JZ`, `JNZ` y `JMP`.
6. Incorporar memoria indirecta, pares de registros, pila y subrutinas.
7. Dejar el detalle de interrupciones, puertos y temporización para una etapa posterior.

No hace falta memorizar todo el conjunto de instrucciones de una vez. Lo importante es reconocer **qué dato utiliza cada instrucción, dónde deja el resultado y qué banderas modifica**. Con esas tres preguntas se puede comprender gran parte del comportamiento de un programa 8085.

---

## Fuente principal

- *Set de Instrucciones - Microprocesador 8085* (documento proporcionado, 20 páginas). Contiene la simbología, los modos de direccionamiento, las banderas, la descripción agrupada de instrucciones, ejemplos de `DAA` y tablas de códigos de operación.
- Para la aclaración puntual de `XTHL` (SP no cambia), se consultó el manual de Intel: [8080/8085 Assembly Language Programming Manual](https://www.bitsavers.org/components/intel/MCS80/9800301D_8080_8085_Assembly_Language_Programming_Manual_May81.pdf).
