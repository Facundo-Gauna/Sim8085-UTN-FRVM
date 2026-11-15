# Sistema de diseño Sim8085: MASTER

- Estado: **aprobado** (2026-11-15), revisado con la maqueta `design-system/mockup/sim8085-mockup.html`
- Origen: UI/UX Pro Max (búsqueda de estilos, paletas y tipografías) + dirección elegida por el usuario
- Producto: `docs/superpowers/specs/2026-11-15-simulador-8085-design.md`

> **Fuente de verdad visual.** Frontend Design construye siguiendo este archivo e Impeccable lo refina sin reemplazarlo (ver `Design Skills Orchestration.md`). Las excepciones por pantalla van en `design-system/pages/<pantalla>.md` y prevalecen sobre este archivo solo en esa pantalla.

---

## 1. Dirección: "Datasheet"

La interfaz toma el lenguaje de las **hojas técnicas de Intel de los años 70** y del **chip físico del 8085**: papel cálido, tinta precisa, retículas finas, numeración tipo pin, un naranja de señal. No es una imitación retro ni un disfraz. Es una herramienta **contemporánea y refinada**, con esa identidad como acento.

**Principio rector: la identidad vive en el marco, los datos son sagrados.** Encabezados, bordes, numeración y estados vacíos llevan la personalidad. Registros, memoria y código son neutros, de alto contraste y sin decoración.

**Que no pierda lo estético** (pedido del usuario). La belleza viene de:
- jerarquía tipográfica rigurosa (una sola familia, IBM Plex, en varios pesos y tamaños);
- espacio negativo generoso alrededor de un núcleo de datos denso;
- líneas de 1 px precisas en lugar de sombras;
- **un solo** color de marca, usado con disciplina;
- detalles de oficio contados con los dedos: nada se decora "por las dudas".

### Qué es y qué no es
| Sí | No |
|---|---|
| Tabla técnica, retícula, precisión | Skeuomorfismo (texturas de papel, manchas, ruido) |
| Naranja como señal puntual | Naranja en fondos grandes |
| Detalles tipo pin o etiqueta de chip | Ilustraciones de circuitos en todos lados |
| Calidez en el claro, grafito en el oscuro | Neón, glow, glitch, scanlines |
| Movimiento breve que explica un cambio | Animaciones decorativas o de scroll |

---

## 2. Color

Todos los componentes usan **tokens semánticos**, nunca hex directo. Los contrastes están verificados contra WCAG 2.1 (texto ≥ 4.5:1; elementos de interfaz ≥ 3:1).

### 2.1 Base
| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--bg` | `#F4EFE4` (papel) | `#141417` (grafito) | Fondo de la app |
| `--surface` | `#FBF8F1` | `#1C1C21` | Paneles, editor |
| `--surface-2` | `#EDE6D8` | `#24242A` | Cabeceras de panel, filas alternas, hover |
| `--ink` | `#1C1A17` | `#EDE7DB` | Texto principal (15:1 / 15:1) |
| `--ink-muted` | `#5E574C` | `#A8A194` | Texto secundario (6.2:1 / 7.2:1) |
| `--line` | `#DDD4C3` | `#2E2E35` | Divisores decorativos (no portan significado) |
| `--line-strong` | `#8A8070` | `#6B6B75` | Bordes de controles (3.4:1 / 3.5:1) |

### 2.2 Marca
| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `--accent` | `#C2410C` | `#FB7A3C` | Acción primaria (Ensamblar/Ejecutar), foco, marca, pestaña activa |
| `--on-accent` | `#FFFFFF` (5.2:1) | `#141417` (7:1) | Texto sobre el acento |
| `--focus-ring` | `--accent`, 2 px + separación de 2 px | igual | Foco de teclado siempre visible |

**Regla del naranja:** como máximo **una** acción primaria naranja por zona. Nunca se usa para significar "cambió" ni "error".

### 2.3 Semántica de estado (idéntica en todas las pantallas)
| Significado | Token | Claro | Oscuro | Además del color |
|---|---|---|---|---|
| **Cambió en el último paso** | `--changed-bg` / `--ink` | `#FDE68A` | `#4A3B0A` | Efecto **resaltador** (fondo marcado) + punto `•` junto al nombre del registro y valor anterior al pasar el mouse |
| **Línea actual / PC** | `--current` | `#1D4ED8` | `#7AA2FF` | Barra lateral de 3 px + flecha `▶` en el margen |
| **Error / punto de corte** | `--danger` | `#B91C1C` | `#FF7A7A` | Subrayado ondulado (error) / círculo relleno en el margen (punto de corte) |
| **Correcto** ("Comprobar") | `--success` | `#166534` | `#4ADE80` | Ícono de check + texto |
| **Advertencia** (superposición, >80 caracteres) | `--warning` | `#92400E` | `#FBBF24` | Ícono de triángulo + texto |

Ningún significado depende solo del color. Cada estado tiene ícono, forma o texto.

### 2.4 Resaltado de sintaxis (editor)
Sobrio: tinta para lo general y color solo donde ayuda a leer.
| Elemento | Claro | Oscuro |
|---|---|---|
| Mnemónico | `--ink`, peso 600 | `--ink`, peso 600 |
| Registro (A, B, H, L, M, SP…) | `#1D4ED8` | `#7AA2FF` |
| Número (`2AH`, `0101B`, `42`) | `#7C2D12` | `#FDBA74` |
| Etiqueta | `#6D28D9` | `#C4B5FD` |
| Directiva / macro (fuera de la cátedra) | `--ink-muted`, *itálica* | `--ink-muted`, *itálica* |
| Comentario = Observación | `#3F6212` | `#A3C77A` |

El comentario tiene color propio porque **es la Observación del PDF**. Tiene que leerse como contenido, no desaparecer.

---

## 3. Tipografía

Una sola superfamilia: **IBM Plex**. Es técnica, cálida y legible, y su origen industrial encaja con la estética de datasheet. Licencia OFL. **Va incluida en la app** (por ejemplo, vía `@fontsource`), sin Google Fonts, para que el escritorio funcione sin conexión.

| Rol | Fuente | Tamaño / interlineado | Peso |
|---|---|---|---|
| Interfaz (botones, etiquetas, menús) | IBM Plex Sans | 14 / 20 px | 400–500 |
| Texto de documentación | IBM Plex Sans | 16 / 26 px, ancho máx. 68 caracteres | 400 |
| Títulos de documentación | IBM Plex Sans | 32 / 24 / 20 px | 600 |
| Cabecera de panel | IBM Plex Sans, **versalitas** (mayúsculas + `letter-spacing: .08em`) | 11 / 16 px | 600 |
| Código y editor | IBM Plex Mono | **16 / 26 px** (ajustable 14–20 px) | 400 (mnemónico 600) |
| Valores (registros, memoria) | IBM Plex Mono, `font-variant-numeric: tabular-nums` | 14–15 px; registros principales 20 px | 500 |

- Los valores **siempre** van en monoespaciada tabular, para que las columnas de hexa no "bailen".
- Tamaño mínimo absoluto: 11 px, y solo en cabeceras en versalitas.
- Hexa en mayúsculas con sufijo `h` en la interfaz (`3Ah`). Binario agrupado en nibbles (`0011 1010`).

---

## 4. Espaciado, forma y profundidad

- **Escala de 4 px:** 4 · 8 · 12 · 16 · 24 · 32 · 48. Paneles de datos densos (8–12) y documentación aireada (24–48).
- **Radios:** 4 px en controles y 6 px en paneles. Las celdas de memoria y registros van rectas (0 px), como una tabla técnica.
- **Profundidad:** líneas de 1 px, **sin sombras**. Hay una única sombra suave para elementos flotantes (menús, tooltips, diálogos).
- **Retícula:** la memoria y la vista previa del PDF muestran líneas de tabla finas (`--line`).

## 5. Detalles de identidad (la "firma")

Se usan pocos y siempre los mismos:
1. **Numeración tipo pin:** los números de línea del editor y los índices de tabla en IBM Plex Mono `--ink-muted`, con un pequeño "pin" (raya de 4 px) que los conecta al borde. Remite a las patas del chip.
2. **Etiqueta de chip:** el logotipo es un rectángulo grafito con muesca semicircular (como el DIP-40) y el texto `8085` en Plex Mono. Se usa en la cabecera y en la pantalla de inicio.
3. **Cabeceras de panel en versalitas** con un número de referencia: `01 REGISTROS`, `02 BANDERAS`, `03 MEMORIA`… como las secciones de un datasheet.
4. **Bordes punteados = fuera de la cátedra:** todo elemento complementario lleva un borde de 1 px punteado y la etiqueta `FUERA DE CÁTEDRA` en versalitas `--ink-muted`. Lo de la cátedra usa borde sólido. La regla es la misma en la documentación, los hints, el autocompletado y la toolbox.
5. **Estados vacíos** con un diagrama lineal mínimo del 8085 (una línea, sin relleno) y una frase guía.

## 6. Iconografía

- **Lucide** (SVG, trazo de 1.5 px, 16/20 px). Nada de emojis.
- Los botones con solo ícono llevan `aria-label` y un tooltip con el atajo de teclado.

## 7. Movimiento

Breve y con propósito: el movimiento **explica qué cambió**, no decora.
- Resaltado de cambio: el fondo `--changed-bg` aparece en 120 ms y **se queda** hasta el próximo paso (no se desvanece solo, para que el alumno pueda leerlo).
- Al cambiar de base, los valores hacen un fundido cruzado de 150 ms.
- Al mover el PC, la barra de línea actual se desliza en 150 ms (`ease-out`).
- Paneles y diálogos: 160–200 ms de entrada y más rápida la salida.
- En "Ejecutar todo" a velocidad máxima no hay animaciones: se actualiza por cuadro.
- `prefers-reduced-motion`: todo instantáneo, solo cambia el fondo.

## 8. Disposición del simulador (propuesta para Frontend Design)

Hay demasiados paneles para mostrarlos todos a la vez. Se priorizan según lo que el alumno mira **en cada paso**.

```
┌ 8085 ─ archivo1.asm ▾ archivo2.asm ──────────── [Inicio 2000h] [Ensamblar] [▶ Ejecutar] [⏭ Paso] [⏮ Atrás] [⟲] ─ velocidad ─┐
│ ┌ EDITOR ─────────────────────────────┐ ┌ 01 REGISTROS ──────────────────┐ │
│ │ 01┤ ▶ LDA 0040H  ; A ← M[0040h]     │ │ A  [3Ah]   B 00   C 00         │ │
│ │ 02┤   CMA        ; A = NOT A        │ │ D 00   E 00   H 20   L 00      │ │
│ │ 03┤ ● STA 0041H  ; M[0041h] ← A     │ │ PC 2003h  SP FFFFh   M 5Ah     │ │
│ │ 04┤   HLT                           │ ├ 02 BANDERAS ───────────────────┤ │
│ │                                     │ │ S 0  Z 0  AC 0  P 1  CY 0      │ │
│ ├ AHORA ──────────────────────────────┤ ├ 03 MEMORIA ─── ir a [0040h] ───┤ │
│ │ CMA: invierte cada bit de A.        │ │ 0040h │ 3A 00 00 00 …          │ │
│ │ No modifica banderas.               │ │ 0041h │ …                      │ │
│ └─────────────────────────────────────┘ └────────────────────────────────┘ │
│ [Salida] [Pila] [Puertos E/S] [Interrupciones] [Métricas]   ← cajón inferior plegable │
└ HEX ▾ │ 4 líneas · 7 bytes · 2003h │ ⚠ Web: los archivos no se guardan ─────────────────────────────┘
```

- **El código es el protagonista** (feedback del usuario sobre la maqueta): el editor ocupa la mayor parte del ancho (~60 %), con tipografía de 16 px, y es lo primero que se ve.
- **Siempre visibles:** editor, explicación "AHORA", registros, banderas y memoria (lo que se consulta en cada paso).
- **Sin encabezados ni textos de presentación** sobre la app: la pantalla del simulador empieza directo en la barra de herramientas. (El título y la explicación de la maqueta eran solo para la demo.)
- **Cajón inferior plegable con pestañas:** Salida, Pila, Puertos E/S, Interrupciones, Métricas. Se abre solo cuando hay algo nuevo (por ejemplo, un `OUT` o un error), con una marca en la pestaña.
- **Selector de base** global en la barra de estado. Al pasar el mouse sobre un valor se ven las otras bases.
- **Navegación principal** (barra lateral angosta de íconos con etiqueta): Simulador · Ejercicios · Documentación · Toolbox. En el escritorio se suma el árbol de archivos de la carpeta.
- Ancho mínimo de diseño: 1280 px. Entre 1024 y 1280 px, el panel derecho se angosta y la memoria muestra 8 columnas en lugar de 16.

## 9. Accesibilidad (obligatoria)

- Contraste verificado (§2). Foco visible en todo control. Toda la interfaz se puede usar con teclado, con atajos para Ensamblar, Ejecutar, Paso, Atrás y Punto de corte.
- Los cambios de estado se anuncian con `aria-live` discreto ("A cambió de 00h a 3Ah").
- Ningún significado depende solo del color (§2.3).
- Se respeta `prefers-reduced-motion` y `prefers-color-scheme` (tema por defecto = el del sistema, con selector manual).

## 10. Plataformas

- Se prueba en **WebKitGTK (Linux)**, **WebView2 (Windows)** y Chrome/Firefox (web). Nada de efectos dependientes de un solo motor (por ejemplo, `backdrop-filter` como requisito).
- Celular: solo la documentación (columna única de 16 px de margen), con un aviso amable de que el simulador está pensado para computadora.
- **Los PDF no usan esta identidad.** Replican en blanco y negro las plantillas oficiales de la cátedra.

## 11. Anti-patrones (prohibidos)

- Hex directo en componentes (siempre tokens).
- Naranja para estados, o más de una acción primaria por zona.
- Sombras decorativas, gradientes y glassmorphism.
- Texturas de papel, ruido o efectos "envejecidos".
- Emojis como íconos.
- Resaltados de cambio que desaparecen solos antes de que se puedan leer.
- Más de una familia tipográfica.
- Un modo claro "secundario": los dos temas son de primera clase.
