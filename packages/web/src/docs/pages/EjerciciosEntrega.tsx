import { Asm, DocLink } from '../blocks';

export function EjerciciosEntrega() {
  return (
    <>
      <h2>Ejercicios</h2>
      <p>
        La sección Ejercicios tiene cuatro grupos: básicos, los nueve de la cátedra (GTP05), intermedios y adicionales. Cada
        ejercicio trae el enunciado, los datos iniciales ya cargados en memoria y una pista que se muestra solo si la
        pedís. <strong>Resolver en el simulador</strong> abre un archivo nuevo con la dirección de inicio del ejercicio;
        el botón <strong>Comprobar</strong> ejecuta tu programa con varios casos de prueba y, si falla, te dice en cuál
        (por ejemplo: «Falla cuando 0040h = FFh»). Los ejercicios resueltos quedan marcados mientras la página siga
        abierta.
      </p>
      <p>
        En el ejercicio 4 de GTP05, «la parte más significativa» se interpreta como el <strong>nibble alto</strong>{' '}
        conservado en su lugar y el bajo en cero (<code>B7h</code> pasa a <code>B0h</code>). Es una interpretación
        pendiente de confirmar con la cátedra.
      </p>
      <p>
        En los ejercicios 8 y 9, la dirección apuntada ocupa <code>2000h</code>–<code>2001h</code> (byte bajo primero)
        y «la siguiente posición» es la que sigue al número. En el 9, «paridad par» es la bandera P. También están
        pendientes de confirmar.
      </p>
      <Asm>{`        LDA 0040H       ; A ← M[0040h]
        CMA             ; A = NOT A
        STA 0041H       ; M[0041h] ← A
        HLT
`}</Asm>
      <h2>Observaciones</h2>
      <p>
        El comentario de cada línea es la Observación de la hoja. Si querés ahorrarte escribirlas, el botón{' '}
        <strong>Autocompletar observaciones</strong> agrega una frase simple (por ejemplo <code>A ← 05h</code>) a las
        líneas de instrucción que todavía no tienen comentario; no toca las que ya escribiste. Cada observación admite
        hasta 80 caracteres: el editor avisa cuando te pasás y la vista previa del PDF marca las que se recortarían.
      </p>
      <h2>Exportar PDF</h2>
      <p>
        <strong>Exportar PDF</strong> abre un diálogo donde elegís la hoja y completás Alumno, Ejercicio, Hoja Nº
        inicial y Fecha. Antes de descargar ves una vista previa. Hay dos hojas, iguales a las plantillas de la
        cátedra:
      </p>
      <ul>
        <li>
          <strong>Plantilla Assembler:</strong> Dirección, Mnemónico, OP.CODE y Observación, con un byte por fila. Si
          no entra en una hoja, se pagina con el encabezado repetido y el número de hoja automático.
        </li>
        <li>
          <strong>Registros-Banderas-Memoria:</strong> una fila por cada instrucción ejecutada, con A, B, C, D, E, H,
          L, M, Z, P, S y CY después de cada una, y la posición y el valor de memoria que tocó. Llega hasta 500 filas;
          si el programa ejecuta más, el diálogo te avisa y la hoja muestra las primeras 500.
        </li>
      </ul>
      <p>
        Ambas necesitan el código ensamblado. Para entender los símbolos de las hojas, mirá{' '}
        <DocLink to="usar-simulador">Cómo usar el simulador</DocLink>.
      </p>
    </>
  );
}
