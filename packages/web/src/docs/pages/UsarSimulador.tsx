import { Asm, DocLink } from '../blocks';

export function UsarSimulador() {
  return (
    <>
      <h2>Escribir y ensamblar</h2>
      <p>
        Escribí el programa en el editor y pulsá <strong>Ensamblar</strong> (<kbd>F5</kbd>). Los errores se subrayan en
        su línea con un mensaje en español, y el editor te ayuda con el autocompletado de mnemónicos y registros y con
        una explicación al pasar el mouse sobre una instrucción. El campo <strong>Inicio</strong>, junto a Ensamblar,
        es la dirección donde se ubica el primer byte del programa.
      </p>
      <p>
        A la izquierda del código, junto al número de línea, el editor muestra la <strong>dirección de memoria</strong>{' '}
        donde empieza cada línea. Se actualiza mientras escribís. Si una instrucción está mal escrita, las direcciones
        de abajo pueden quedar corridas hasta que la corrijas. Para los saltos no hace falta calcularlas: podés usar
        etiquetas (<code>LAZO:</code> … <code>JNZ LAZO</code>).
      </p>
      <Asm>{`        MVI A, 05H      ; A ← 05h
        MOV B, A        ; B ← A
        ADD B           ; A ← A + B
        HLT
`}</Asm>
      <h2>Ejecutar y depurar</h2>
      <ul>
        <li>
          <strong>Ejecutar</strong> (<kbd>F8</kbd>) corre el programa hasta <code>HLT</code>; el mismo botón pasa a
          Detener mientras corre, y la velocidad se regula con el control de la barra.
        </li>
        <li>
          <strong>Paso</strong> (<kbd>F10</kbd>) ejecuta una instrucción, y <strong>Atrás</strong> (
          <kbd>Shift+F10</kbd>) la deshace.
        </li>
        <li>
          <strong>Reiniciar</strong> vuelve al principio del programa con la memoria cargada.
        </li>
        <li>
          Un <strong>punto de corte</strong> se pone con un clic en el margen del editor o con <kbd>F9</kbd> en la
          línea del cursor; la ejecución se detiene antes de esa instrucción.
        </li>
      </ul>
      <p>
        Si un programa lleva 100 000 instrucciones sin llegar a HLT, el simulador te pregunta en la página si querés
        continuar o detenerlo.
      </p>
      <h2>Qué mirar en cada paso</h2>
      <p>
        En el editor, la instrucción <strong>recién ejecutada</strong> se marca con <code>✓</code> y fondo resaltado, y
        la <strong>próxima</strong> (la que está en el PC) con <code>▶</code>. Al ensamblar todavía no se ejecutó
        nada: los registros muestran el estado inicial y el primer Paso ejecuta la primera instrucción. El panel{' '}
        <strong>Ahora</strong> muestra las dos: qué cambió con la recién ejecutada (por ejemplo{' '}
        <code>A: 00h → 3Ah</code>) y qué hará la próxima. En los paneles de registros, banderas y memoria, lo que cambió se resalta con color y un
        punto <code>•</code>; el valor anterior aparece al pasar el mouse. Con el selector de la barra de estado cambiás
        todos los valores entre hexadecimal, decimal y binario.
      </p>
      <p>
        Para escribir cómodo, los botones de la cabecera del editor cambian su tamaño: <strong>Equilibrado</strong>,{' '}
        <strong>Editor amplio</strong> o <strong>Solo editor</strong> (también con <kbd>Ctrl+Shift+F</kbd>).
      </p>
      <h2>Memoria y datos</h2>
      <p>
        Antes de ejecutar podés cargar datos: hacé doble clic en una celda del panel Memoria (o <kbd>F2</kbd>) y
        escribí el byte en hexadecimal. Editar la memoria después de ejecutar borra el historial del botón Atrás.
      </p>
      <h2>El cajón inferior</h2>
      <p>
        <strong>Salida</strong> reúne los <code>OUT</code> del programa y los mensajes del simulador;{' '}
        <strong>Pila</strong> muestra el tope de la pila y el SP; <strong>Puertos E/S</strong> sirve para cargar los
        valores que leerá <code>IN</code>; <strong>Interrupciones</strong> tiene los botones TRAP, RST 7.5, 6.5 y 5.5
        con las máscaras; <strong>Métricas</strong> muestra el tamaño, las instrucciones ejecutadas y los estados T, y
        la diferencia contra la ejecución anterior.
      </p>
      <h2>Archivos</h2>
      <p>
        Podés tener varios archivos abiertos en pestañas. <kbd>Ctrl+O</kbd> abre un archivo <code>.asm</code> y{' '}
        <kbd>Ctrl+S</kbd> descarga el archivo activo. <strong>La versión web no guarda tu trabajo</strong>: si cerrás
        la página lo perdés, por eso el navegador te avisa antes de salir y conviene descargar los archivos. Para
        entregar, mirá <DocLink to="ejercicios-entrega">Ejercicios y hojas de entrega</DocLink>.
      </p>
    </>
  );
}
