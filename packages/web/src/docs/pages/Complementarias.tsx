import { DocLink } from '../blocks';

export function Complementarias() {
  return (
    <>
      <p>
        Herramientas del simulador que van más allá del Set de Instrucciones. Sirven para estudiar y comparar, pero no
        son parte de lo que evalúa la cátedra.
      </p>
      <h2>Toolbox</h2>
      <ul>
        <li>
          <strong>Conversor</strong> entre hexadecimal, decimal, binario y BCD, que se actualizan juntos.
        </li>
        <li>
          <strong>Complemento a 2</strong>: un valor se ve con y sin signo, en 8 o 16 bits, con su complemento a 1 y a
          2.
        </li>
        <li>
          <strong>Opcodes</strong>: la tabla de todas las instrucciones con un buscador (mnemónico, opcode, bytes,
          estados T y banderas), tomada del mismo set que usa el simulador.
        </li>
        <li>
          <strong>ASCII</strong>: la tabla de caracteres de 0 a 127.
        </li>
      </ul>
      <h2>Base numérica</h2>
      <p>
        El selector de la barra de estado cambia todos los valores entre hexadecimal (la base principal), decimal y
        binario. Es una ayuda para quien se confunde con el hexadecimal.
      </p>
      <h2>Métricas y comparación</h2>
      <p>
        La pestaña Métricas del cajón muestra el tamaño del programa, las instrucciones ejecutadas y los estados T, y
        los compara contra la ejecución anterior: sirve para decidir cuál de dos soluciones es más corta o más rápida.
      </p>
      <h2>Puertos E/S e interrupciones</h2>
      <p>
        En <strong>Puertos E/S</strong> cargás los valores que leerá <code>IN</code> y ves los <code>OUT</code>;{' '}
        <strong>Interrupciones</strong> permite disparar TRAP y RST 7.5, 6.5 y 5.5 para probar rutinas de servicio. Las
        instrucciones involucradas están en la <DocLink to="instrucciones">referencia de instrucciones</DocLink>.
      </p>
    </>
  );
}
