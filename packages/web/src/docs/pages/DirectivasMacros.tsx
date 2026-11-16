import { Asm } from '../blocks';

export function DirectivasMacros() {
  return (
    <>
      <p>
        Las directivas no son instrucciones del 8085: le dan indicaciones al ensamblador (dónde ubicar el código,
        cómo reservar datos). No figuran en el Set de Instrucciones de la cátedra, pero el simulador las acepta.
      </p>
      <h2>ORG: dirección de la siguiente instrucción</h2>
      <p>
        Fija la dirección a partir de la cual se ubica lo que sigue. Si el código tiene <code>ORG</code>, tiene
        prioridad sobre el campo Inicio de la barra.
      </p>
      <Asm>{`        ORG 2000H
        MVI A, 01H
        HLT
`}</Asm>
      <h2>EQU: una constante con nombre</h2>
      <Asm>{`LIMITE  EQU 10
        MVI B, LIMITE   ; igual que MVI B, 10
        HLT
`}</Asm>
      <h2>DB: bytes y cadenas</h2>
      <p>Guarda uno o más bytes; una cadena entre comillas guarda un byte por carácter.</p>
      <Asm>{`        ORG 2000H
        LXI H, TABLA
        HLT
        ORG 0040H
TABLA:  DB 1, 2, 3, 'AB'
`}</Asm>
      <h2>DW: palabras de 16 bits</h2>
      <p>Guarda cada valor en 2 bytes, primero el byte bajo, igual que las direcciones en las instrucciones.</p>
      <Asm>{`        ORG 2000H
        LXI H, DIRS
        HLT
        ORG 0050H
DIRS:   DW 1234H, 0ABCDH
`}</Asm>
      <h2>DS: reservar espacio</h2>
      <p>Reserva N bytes sin darles valor.</p>
      <Asm>{`        ORG 2000H
        LXI H, BUFER
        HLT
BUFER:  DS 4
`}</Asm>
      <h2>END: fin del programa</h2>
      <p>El ensamblador ignora todo lo que está después.</p>
      <Asm>{`        MVI A, 01H
        HLT
        END
        ; lo que sigue se ignora
`}</Asm>
      <h2>Macros</h2>
      <p>
        Una macro agrupa instrucciones con un nombre: se define entre <code>MACRO</code> y <code>ENDM</code> y cada
        llamada se <strong>expande</strong> en sus instrucciones reales. Puede tener parámetros, que se reemplazan por
        los valores de la llamada, y sus etiquetas son locales: podés llamarla varias veces sin que se pisen. No se
        pueden anidar ni llamarse a sí mismas.
      </p>
      <Asm>{`PAUSA   MACRO
        NOP
        NOP
        ENDM
        PAUSA           ; llamada a la macro
        HLT
`}</Asm>
      <p>
        En el PDF de la plantilla Assembler cada llamada aparece expandida, con la dirección y el OP.CODE de cada
        instrucción; la observación de la línea de llamada va en la primera instrucción expandida.
      </p>
    </>
  );
}
