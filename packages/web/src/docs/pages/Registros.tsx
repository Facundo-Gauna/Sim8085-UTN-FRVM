export function Registros() {
  return (
    <>
      <h2>Registros de 8 bits</h2>
      <p>
        El 8085 tiene siete registros de 8 bits: <strong>A</strong>, <strong>B</strong>, <strong>C</strong>,{' '}
        <strong>D</strong>, <strong>E</strong>, <strong>H</strong> y <strong>L</strong>. El <strong>A</strong> es el
        acumulador: casi toda la aritmética y la lógica pasa por él, y su resultado queda ahí.
      </p>
      <h2>Pares de 16 bits</h2>
      <p>
        Los registros se agrupan de a dos para guardar direcciones o datos de 16 bits: <strong>BC</strong>,{' '}
        <strong>DE</strong> y <strong>HL</strong>. El par <strong>PSW</strong> es el acumulador junto con las
        banderas, y solo se usa con <code>PUSH</code> y <code>POP</code>.
      </p>
      <h2>El registro M</h2>
      <p>
        <strong>M</strong> no es un registro físico: es la posición de memoria cuya dirección está en <strong>HL</strong>
        . Así, <code>MOV A, M</code> copia a A el byte que hay en la dirección que indica HL.
      </p>
      <h2>PC y SP</h2>
      <p>
        El <strong>PC</strong> (contador de programa) guarda la dirección de la próxima instrucción. El{' '}
        <strong>SP</strong> (puntero de pila) guarda la dirección del tope de la pila. Los dos son de 16 bits.
      </p>
      <h2>En el simulador</h2>
      <p>
        El panel Registros muestra todos los valores. Lo que cambió en el último paso se resalta con color y un punto{' '}
        <code>•</code> junto al nombre, y el valor anterior aparece al pasar el mouse. Podés ver los valores en
        hexadecimal, decimal o binario con el selector de la barra de estado. La memoria se edita en su propio panel
        antes de ejecutar, para cargar los datos del ejercicio.
      </p>
    </>
  );
}
