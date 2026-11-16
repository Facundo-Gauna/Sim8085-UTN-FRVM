import { Asm } from '../blocks';

export function Programa() {
  return (
    <>
      <h2>Formato de una línea</h2>
      <p>Cada línea tiene hasta cuatro partes, todas opcionales salvo que haya una instrucción:</p>
      <p>
        <code>ETIQUETA: MNEMÓNICO OPERANDOS ; comentario</code>
      </p>
      <p>No distingue mayúsculas de minúsculas, y todo lo que sigue a un punto y coma es comentario.</p>
      <h2>Etiquetas</h2>
      <p>
        Una etiqueta es un nombre que termina en dos puntos y marca la dirección de la instrucción siguiente. Sirve
        para saltar sin calcular direcciones a mano.
      </p>
      <h2>Números</h2>
      <ul>
        <li>
          Hexadecimal: sufijo <code>H</code> (<code>2AH</code>). Si empieza con una letra, lleva un cero adelante:{' '}
          <code>0A1H</code>. Escrito como <code>A1H</code>, el ensamblador lo toma por un nombre y da error.
        </li>
        <li>
          Binario: sufijo <code>B</code> (<code>00101010B</code>).
        </li>
        <li>
          Decimal: sin sufijo (<code>42</code>).
        </li>
      </ul>
      <Asm>{`        MVI A, 0A1H      ; hexa que empieza con letra: cero adelante
        MVI B, 00101010B ; binario
        MVI C, 42        ; decimal
INICIO: DCR C            ; C ← C - 1
        JNZ INICIO       ; salta mientras C no llegue a 0
        HLT
`}</Asm>
      <h2>Tamaño de las instrucciones</h2>
      <p>
        Una instrucción ocupa 1, 2 o 3 bytes: el OP.CODE solo, con un dato de 8 bits, o con una dirección o dato de 16
        bits. El ensamblador va asignando direcciones consecutivas según el tamaño de cada una.
      </p>
      <h2>Observaciones para la entrega</h2>
      <p>
        El comentario de cada línea es la Observación de la hoja Assembler del PDF. Entran hasta 80 caracteres; el
        editor cuenta los caracteres y avisa cuando te pasás.
      </p>
    </>
  );
}
