import { Asm, DocLink } from '../blocks';

export function QueEs() {
  return (
    <>
      <p>
        Un microprocesador solo entiende números. Cada operación que sabe hacer (copiar un dato, sumar, saltar a otro
        lugar del programa) tiene su propio código numérico: el <strong>OP.CODE</strong>. Escribirlos a mano es lento y
        se presta a errores, así que el lenguaje <strong>ensamblador</strong> (assembler) le da un nombre corto a cada
        operación, el <strong>mnemónico</strong> (<code>MVI</code>, <code>ADD</code>, <code>HLT</code>), y un programa
        llamado ensamblador traduce esos nombres a los códigos.
      </p>
      <h2>Una instrucción</h2>
      <p>
        Una instrucción es un mnemónico seguido de sus operandos. Por ejemplo, <code>MVI A, 05H</code> carga el dato
        05h en el registro A: se guarda en 2 bytes, el OP.CODE <code>3E</code> y el dato <code>05</code>. Hay
        instrucciones de 1, 2 y 3 bytes.
      </p>
      <h2>El 8085</h2>
      <p>
        El 8085 es un microprocesador de <strong>8 bits</strong>: trabaja con datos de 00h a FFh. Sus direcciones son de{' '}
        <strong>16 bits</strong>, así que puede acceder a 65 536 posiciones de memoria, de 0000h a FFFFh (64 KB). El{' '}
        <strong>PC</strong> (contador de programa) guarda la dirección de la próxima instrucción: el procesador la lee,
        la ejecuta y avanza. Los registros se explican en <DocLink to="registros">Registros y memoria</DocLink>.
      </p>
      <h2>Las direcciones se guardan al revés</h2>
      <p>
        Una dirección de 16 bits ocupa dos bytes y se guarda primero el menos significativo. Por eso{' '}
        <code>LDA 0040H</code> queda como <code>3A 40 00</code>: el OP.CODE, el byte bajo (40h) y el byte alto (00h).
      </p>
      <h2>Un programa completo</h2>
      <p>Complementa el dato de la posición 0040h y guarda el resultado en 0041h:</p>
      <Asm>{`        LDA 0040H       ; A ← M[0040h], traigo el dato
        CMA             ; A = NOT A, complemento
        STA 0041H       ; M[0041h] ← A, guardo el resultado
        HLT             ; fin del programa
`}</Asm>
    </>
  );
}
