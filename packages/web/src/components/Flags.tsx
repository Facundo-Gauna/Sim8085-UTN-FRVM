import type { Change } from '@sim8085/core';
import { FLAG_HELP } from '../lib/cpuHelp';
import { useSession } from '../state/store';
import { useTip } from './Tip';
import './Registers.css';

const FLAGS = ['S', 'Z', 'AC', 'P', 'CY'] as const;
const AC_TITLE = 'AC (acarreo auxiliar) no figura en la plantilla de la cátedra';

interface FlagProps {
  name: (typeof FLAGS)[number];
  value: 0 | 1 | null;
  before: number | null;
}

function Flag({ name, value, before }: FlagProps) {
  const outside = name === 'AC';
  const changed = before !== null;
  const help = FLAG_HELP[name]!;
  const detail = [outside ? AC_TITLE : '', changed ? `Antes: ${before}` : ''].filter(Boolean);
  const tip = useTip({ title: help.title, body: help.body, ...(detail.length ? { detail } : {}) });
  const label = value === null ? `${name}: sin datos` : changed ? `${name}: ${value} (cambió desde ${before})` : `${name}: ${value}`;
  return (
    <div
      className={`flag ${outside ? 'dashed' : ''} ${changed ? 'changed' : ''}`.trim()}
      role="group"
      aria-label={label}
      {...tip.props}
      {...(outside ? { 'data-fuera-catedra': '' } : {})}
    >
      <span className="k">
        {name}
        {changed && <span className="mark" aria-hidden="true">•</span>}
      </span>
      <span className="v">{value === null ? '—' : value}</span>
      {outside && <span className="caps outside">FUERA DE CÁTEDRA</span>}
      {tip.bubble}
    </div>
  );
}

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
        {FLAGS.map((f) => (
          <Flag
            key={f}
            name={f}
            value={live ? (live.cpu.flags[f] as 0 | 1) : null}
            before={changes.has(f) ? Number(changes.get(f)!.before) : null}
          />
        ))}
      </div>
    </section>
  );
}
