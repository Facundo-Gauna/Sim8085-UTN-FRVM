import { Asm } from '../blocks';

export function Banderas() {
  return (
    <>
      <p>
        Las banderas (flags) son bits de 1 que el procesador actualiza después de ciertas instrucciones para dejar
        registrado cómo fue el resultado. Los saltos condicionales las leen para decidir si saltan.
      </p>
      <h2>Las cinco banderas</h2>
      <ul>
        <li>
          <strong>S</strong> (signo): copia el bit 7 del resultado; vale 1 si, leído con signo, es negativo.
        </li>
        <li>
          <strong>Z</strong> (cero): vale 1 si el resultado fue 00h.
        </li>
        <li>
          <strong>AC</strong> (acarreo auxiliar): vale 1 si hubo acarreo del bit 3 al bit 4. Lo usa el ajuste decimal.
        </li>
        <li>
          <strong>P</strong> (paridad): vale 1 si la cantidad de bits en 1 del resultado es par.
        </li>
        <li>
          <strong>CY</strong> (acarreo o préstamo): vale 1 si una suma se pasó de 8 bits o una resta pidió prestado.
        </li>
      </ul>
      <h2>No todas las instrucciones las modifican</h2>
      <p>
        Cada instrucción afecta un conjunto distinto: <code>MOV</code> y <code>MVI</code> no tocan ninguna, y{' '}
        <code>INR</code> y <code>DCR</code> actualizan todas menos CY. La referencia de instrucciones indica, fila por
        fila, cuáles puede cambiar cada una.
      </p>
      <h2>Un ejemplo</h2>
      <Asm>{`        MVI A, 0FFH     ; A = FFh
        ADI 01H         ; A = FFh + 01h
        HLT
`}</Asm>
      <p>
        El resultado es 00h con acarreo: queda Z = 1, CY = 1, AC = 1, P = 1 y S = 0 (cero bits en 1 es una cantidad
        par).
      </p>
      <h2>En el simulador</h2>
      <p>
        El panel Banderas muestra las cinco y resalta las que cambiaron en el último paso. En la hoja PDF de Registros,
        para respetar la plantilla de la cátedra, solo aparecen Z, P, S y CY.
      </p>
    </>
  );
}
