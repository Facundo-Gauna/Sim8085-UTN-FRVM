import { Asm } from '../blocks';

export function Direccionamiento() {
  return (
    <>
      <p>El modo de direccionamiento dice de dónde sale el dato con el que trabaja una instrucción.</p>
      <ul>
        <li>
          <strong>Inmediato:</strong> el dato va escrito en la instrucción. <code>MVI A, 05H</code> carga 05h en A.
        </li>
        <li>
          <strong>Por registro:</strong> el dato está en un registro. <code>MOV A, B</code> copia B en A.
        </li>
        <li>
          <strong>Indirecto por registro:</strong> un par de registros contiene la dirección del dato.{' '}
          <code>MOV A, M</code> lee la posición que indica HL; <code>LDAX B</code> lee la que indica BC.
        </li>
        <li>
          <strong>Directo:</strong> la dirección va escrita en la instrucción. <code>LDA 0040H</code> trae a A lo que
          hay en la posición 0040h.
        </li>
      </ul>
      <Asm>{`        MVI A, 05H      ; inmediato
        MOV B, A        ; por registro
        LXI H, 0040H    ; HL ← 0040h
        MOV A, M        ; indirecto: A ← M[HL]
        LDAX B          ; indirecto: A ← M[BC]
        LDA 0040H       ; directo: A ← M[0040h]
        HLT
`}</Asm>
      <h2>No confundir valor con dirección</h2>
      <p>
        <code>MVI A, 40H</code> carga el número 40h en A. <code>LDA 0040H</code> carga en A el contenido de la posición
        de memoria 0040h. Una letra o un número con el mismo valor significan cosas distintas según la instrucción.
      </p>
    </>
  );
}
