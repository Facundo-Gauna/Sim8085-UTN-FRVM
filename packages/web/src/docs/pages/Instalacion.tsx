import { Downloads } from '../../downloads/Downloads';

export function Instalacion() {
  return (
    <>
      <p>
        El simulador funciona en el navegador <strong>sin instalar nada</strong>: alcanza con abrir la página. La app de
        escritorio es una alternativa para quien prefiera trabajar con archivos del disco.
      </p>
      <h2>Qué agrega la app de escritorio</h2>
      <ul>
        <li>
          Abrir una carpeta (<code>Ctrl+O</code>) y ver el árbol de archivos <code>.asm</code>, con pestañas.
        </li>
        <li>
          Guardar (<code>Ctrl+S</code>), guardar como (<code>Ctrl+Shift+S</code>), crear, renombrar y borrar archivos
          directamente en la carpeta.
        </li>
        <li>Exportar los PDF a la carpeta elegida.</li>
        <li>Todo lo demás es igual a la versión web: mismo editor, mismos paneles y mismo simulador.</li>
      </ul>
      <h2>Descargas</h2>
      <p>
        Hay versión para <strong>Linux</strong> y para <strong>Windows</strong>. Cada descarga muestra su SHA-256, por si
        querés comprobar que el archivo llegó completo.
      </p>
      <Downloads />
      <h2>Cómo instalarla</h2>
      <ul>
        <li>
          <strong>Linux, AppImage:</strong> no se instala. Marcá el archivo como ejecutable (clic derecho, Propiedades,
          Permisos, o <code>chmod +x</code> en la terminal) y abrilo.
        </li>
        <li>
          <strong>Linux, .deb o .rpm:</strong> se instalan con el gestor de paquetes de tu distribución (Debian y Ubuntu
          usan .deb; Fedora y openSUSE, .rpm).
        </li>
        <li>
          <strong>Windows, instalador (.exe):</strong> ejecutalo y seguí los pasos. Como no está firmado, es posible que
          SmartScreen muestre un aviso: elegí «Más información» y después «Ejecutar de todos modos».
        </li>
        <li>
          <strong>Windows, portable (.zip):</strong> no se instala. Descomprimí la carpeta completa donde quieras (por
          ejemplo en un pendrive) y abrí <code>Sim8085.exe</code>. Necesita Microsoft Edge WebView2, que ya viene con
          Windows 11 y con Windows 10 actualizado.
        </li>
      </ul>
      <h2>Privacidad</h2>
      <p>La app de escritorio tampoco envía tu código a ningún servidor: todo se ejecuta en tu computadora.</p>
    </>
  );
}
