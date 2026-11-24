# Columna de direcciones y ejercicios 6–9 de la cátedra

## Intención
Saber en qué dirección queda cada línea sin contar bytes (saltos y hojas de entrega),
y sumar los ejercicios nuevos de la cátedra.

## Enfoques
- **A (elegido):** columna de dirección junto al número de línea. Los errores siguen citando líneas.
- B: reemplazar el número de línea por la dirección. Cuesta ubicar los errores.
- C: botón para alternar. Suma un control y no muestra ambas a la vez.

## Columna de direcciones
- Se calcula del texto en vivo (sin ensamblar) con la dirección de inicio de la sesión.
- En hexa de 4 dígitos. En blanco: comentarios, líneas vacías, solo etiqueta, EQU, ORG, DS y líneas con error.
- Una llamada a macro muestra la dirección de su primera fila.
- Límite conocido: tras una instrucción mal escrita, las de abajo quedan corridas hasta corregirla.

## Ejercicios (grupo `catedra`, `gtp05-6` a `gtp05-9`, inicio 1000h)
- 6: suma de 2000h y 2001h contra 2002h; si coincide, se guarda en 2003h. Casos sin desborde.
- 7–9: puntero de 16 bits en 2000h–2001h, byte bajo primero.
- 8–9: «siguiente posición» = puntero + 1. En 8 los datos son ≤ 3Fh.
- 9: paridad = bandera P; los datos de prueba coinciden con la lectura «número par».
