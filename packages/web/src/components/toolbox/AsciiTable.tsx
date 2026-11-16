const CONTROL = [
  'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL', 'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
  'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB', 'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US',
];
const label = (n: number) => (n < 32 ? CONTROL[n]! : n === 32 ? 'SP' : n === 127 ? 'DEL' : String.fromCharCode(n));

export function AsciiTable() {
  return (
    <div className="ascii fuera">
      <span className="caps fuera-label">FUERA DE CÁTEDRA</span>
      <div className="tb-scroll" tabIndex={0} role="group" aria-label="Tabla ASCII (desplazable)">
        <table aria-label="Tabla ASCII" className="tb-table">
          <thead>
            <tr>
              <th scope="col">Dec</th>
              <th scope="col">Hex</th>
              <th scope="col">Carácter</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 128 }, (_, n) => (
              <tr key={n}>
                <td className="mono">{n}</td>
                <td className="mono">{`${n.toString(16).toUpperCase().padStart(2, '0')}h`}</td>
                <td className="mono">{label(n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
