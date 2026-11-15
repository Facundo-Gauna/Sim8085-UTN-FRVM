import type { Change } from '@sim8085/core';
import { useSession } from '../state/store';
import './Registers.css';

const FLAGS = ['S', 'Z', 'AC', 'P', 'CY'] as const;
const AC_TITLE = 'AC (acarreo auxiliar) no figura en la plantilla de la cátedra';

export function Flags() {
  const machine = useSession((s) => s.machine);
  const stale = useSession((s) => s.stale);
  useSession((s) => s.version);

  const live = machine && !stale ? machine : null;
  const changes = new Map<string, Change>();
  if (live) for (const c of live.lastChanges()) if (c.kind === 'flag') changes.set(c.name, c);

  return (
    <section className="panel" aria-label="Banderas">
      <header className="panel-h">
        <span className="caps"><b>02</b>Banderas</span>
      </header>
      <div className="flags">
        {FLAGS.map((f) => {
          const outside = f === 'AC';
          const c = changes.get(f);
          const v = live ? live.cpu.flags[f] : null;
          const label = v === null ? `${f}: sin datos` : c ? `${f}: ${v} (cambió desde ${c.before})` : `${f}: ${v}`;
          const title = [outside ? AC_TITLE : '', c ? `Antes: ${c.before}` : ''].filter(Boolean).join('\n');
          return (
            <div
              key={f}
              className={`flag ${outside ? 'dashed' : ''} ${c ? 'changed' : ''}`.trim()}
              role="group"
              aria-label={label}
              title={title || undefined}
              {...(outside ? { 'data-fuera-catedra': '' } : {})}
            >
              <span className="k">
                {f}
                {c && <span className="mark" aria-hidden="true">•</span>}
              </span>
              <span className="v">{v === null ? '—' : v}</span>
              {outside && <span className="caps outside">FUERA DE CÁTEDRA</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
