import { GROUPS, rowsFor } from '../instructionGroups';

/** Referencia generada desde ISA: no se escribe a mano, así no puede desacordar con el simulador. */
export function Instrucciones() {
  return (
    <>
      <p>
        Todas las instrucciones del Set de Instrucciones de la cátedra, agrupadas por función. Las formas usan{' '}
        <code>r</code> para un registro (A, B, C, D, E, H, L o M), <code>d8</code> y <code>d16</code> para datos de 8 y
        16 bits, <code>addr</code> para una dirección de 16 bits y <code>n</code> para el número de reinicio. En los
        saltos, llamadas y retornos condicionales, los estados T se muestran como «no se cumple / se cumple».
      </p>
      {GROUPS.map((g) => (
        <div key={g.id} className="doc-table-wrap" tabIndex={0} role="group" aria-label={`${g.title} (desplazable)`}>
          <table className="doc-table">
            <caption>{g.title}</caption>
            <thead>
              <tr>
                <th scope="col">Mnemónico</th>
                <th scope="col">Formas</th>
                <th scope="col">Qué hace</th>
                <th scope="col">Bytes</th>
                <th scope="col">Estados T</th>
                <th scope="col">Banderas</th>
              </tr>
            </thead>
            <tbody>
              {g.mnemonics.map((m) => {
                const r = rowsFor(m);
                return (
                  <tr key={m}>
                    <td>
                      <code>{r.mnemonic}</code>
                    </td>
                    <td>
                      <code>{r.forms.join('  ') || '—'}</code>
                    </td>
                    <td>{r.summary}</td>
                    <td>{r.bytes}</td>
                    <td>{r.tStates}</td>
                    <td>{r.flags}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
