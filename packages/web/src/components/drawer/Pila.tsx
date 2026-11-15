import { fmt16, fmt8 } from '../../lib/format';
import { useSession } from '../../state/store';

const BELOW = 2;
const COUNT = 8;

export function Pila() {
  const machine = useSession((s) => s.machine);
  const stale = useSession((s) => s.stale);
  const base = useSession((s) => s.base);
  useSession((s) => s.version);

  const live = machine && !stale ? machine : null;
  if (!live) return <p className="t">Ensamblá para ver la pila</p>;
  const sp = live.cpu.SP;
  if (sp === 0) {
    return (
      <p className="t">
        SP = {fmt16(0, 'hex')} · <span>La pila está vacía</span>. Se llena con CALL y PUSH.
      </p>
    );
  }
  const rows = Array.from({ length: COUNT }, (_, i) => (sp - BELOW + i) & 0xffff);
  return (
    <div className="pila">
      <table aria-label="Pila alrededor de SP">
        <thead>
          <tr>
            <th scope="col">Dirección</th>
            <th scope="col">Valor</th>
            <th scope="col">
              <span className="sr-only">Marca</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a} aria-current={a === sp ? 'true' : undefined} className={a === sp ? 'sp' : undefined}>
              <th scope="row">{fmt16(a, 'hex')}</th>
              <td>{fmt8(live.memory[a]!, base)}</td>
              <td>{a === sp ? '◄ SP' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="t cap">SP = {fmt16(sp, 'hex')} · la pila del 8085 crece hacia abajo (PUSH resta de SP).</p>
    </div>
  );
}
