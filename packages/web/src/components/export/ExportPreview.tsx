/** Vista previa HTML de una hoja: usa la misma maqueta que el PDF y se dibuja en blanco y negro como el papel. */
import type { AsmPage, Header, TracePage } from '../../pdf/layout';

export function AsmSheet({ page, header }: { page: AsmPage; header: Header }) {
  const num = header.sheetStart + page.sheet - 1;
  return (
    <div className="sheet" role="group" aria-label={`Hoja ${page.sheet}, Plantilla Assembler`}>
      <div className="sheet-head">
        <span>ARQUITECTURA DE COMPUTADORAS</span>
        <span>Alumno: {header.student}</span>
        <span>
          Ejercicio: {header.exercise}
          <br />
          Hoja Nº: {num}
        </span>
      </div>
      <div className="sheet-bar" aria-hidden="true" />
      <table className="sheet-table asm">
        <thead>
          <tr>
            <th>Dirección</th>
            <th>Mnemónico</th>
            <th>OP.CODE</th>
            <th>Observación</th>
          </tr>
        </thead>
        <tbody>
          {page.lines.map((l, i) => (
            <tr key={i} className={l.tall ? 'tall' : undefined}>
              <td>{l.address}</td>
              <td>{l.mnemonic}</td>
              <td className="c">{l.opcode}</td>
              <td className="obs">{l.obs.join('\n')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const REGS = ['A', 'B', 'C', 'D', 'E', 'H', 'L', 'M'];
const FLAGS = ['Z', 'P', 'S', 'CY'];

export function TraceSheet({ page, header }: { page: TracePage; header: Header }) {
  const num = header.sheetStart + page.sheet - 1;
  return (
    <div className="sheet" role="group" aria-label={`Hoja ${page.sheet}, Registros-Banderas-Memoria`}>
      <div className="sheet-head">
        <span>ARQUITECTURA DE COMPUTADORAS</span>
        <span>Alumno: {header.student}</span>
        <span>
          Hoja N°: {num}
          <br />
          Fecha: {header.date}
        </span>
      </div>
      <table className="sheet-table trace">
        <thead>
          <tr>
            <th rowSpan={2}>Posición de Memoria</th>
            <th rowSpan={2}>Valor en Memoria</th>
            <th rowSpan={2}>Ins. N°</th>
            <th colSpan={8}>Registros</th>
            <th colSpan={4}>Banderas</th>
          </tr>
          <tr>
            {[...REGS, ...FLAGS].map((r) => (
              <th key={r}>{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {page.lines.map((l, i) => (
            <tr key={i}>
              <td className="r">{l.pos || 'h'}</td>
              <td className="c">{l.val}</td>
              <td className="c">{l.n}</td>
              {l.regs.map((v, k) => (
                <td key={k} className="c">{v}</td>
              ))}
              {l.flags.map((v, k) => (
                <td key={k} className="c">{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
