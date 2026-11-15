import type { Change } from '@sim8085/core';
import { allBases8, fmt16, fmt8, type Base } from '../lib/format';
import { useSession } from '../state/store';
import './Registers.css';

const REGS_8 = ['B', 'C', 'D', 'E', 'H', 'L'] as const;

interface CellProps {
  name: string;
  value: string;
  label: string;
  title: string;
  changed: boolean;
  className?: string;
}

function Cell({ name, value, label, title, changed, className = '' }: CellProps) {
  return (
    <div
      className={`reg ${className} ${changed ? 'changed' : ''}`.trim()}
      role="group"
      aria-label={label}
      title={title}
    >
      <span className="k">
        {name}
        {changed && <span className="mark" aria-hidden="true">•</span>}
      </span>
      <span className="v">{value}</span>
    </div>
  );
}

const tooltip8 = (v: number, before: number | null, base: Base) => {
  const o = allBases8(v);
  const bases = `Hex ${o.hex} · Dec ${o.dec} · Bin ${o.bin} · Con signo ${o.signed}`;
  return before === null ? bases : `Antes: ${fmt8(before, base)}\n${bases}`;
};

const tooltip16 = (v: number, before: number | null, base: Base) => {
  const bases = `Hex ${fmt16(v, 'hex')} · Dec ${fmt16(v, 'dec')} · Bin ${fmt16(v, 'bin')}`;
  return before === null ? bases : `Antes: ${fmt16(before, base)}\n${bases}`;
};

export function Registers() {
  const machine = useSession((s) => s.machine);
  const base = useSession((s) => s.base);
  const stale = useSession((s) => s.stale);
  useSession((s) => s.version); // la Machine es mutable: re-dibujar en cada cambio

  const live = machine && !stale ? machine : null;
  const changes = new Map<string, Change>();
  if (live) {
    for (const c of live.lastChanges()) {
      // PC siempre se informa: solo cuenta si su valor difiere.
      if (c.kind === 'reg' && c.before !== c.after) changes.set(c.name, c);
    }
  }

  const cell8 = (name: 'A' | (typeof REGS_8)[number], className?: string) => {
    if (!live) return <Cell key={name} name={name} value="—" label={`${name}: sin datos`} title="" changed={false} className={className} />;
    const v = live.cpu[name];
    const c = changes.get(name);
    return (
      <Cell
        key={name}
        name={name}
        value={fmt8(v, base)}
        label={c ? `${name}: ${fmt8(v, base)} (cambió desde ${fmt8(c.before, base)})` : `${name}: ${fmt8(v, base)}`}
        title={tooltip8(v, c ? c.before : null, base)}
        changed={!!c}
        className={className}
      />
    );
  };

  const cell16 = (name: 'PC' | 'SP') => {
    if (!live) return <Cell key={name} name={name} value="—" label={`${name}: sin datos`} title="" changed={false} className="wide" />;
    const v = live.cpu[name];
    const c = changes.get(name);
    return (
      <Cell
        key={name}
        name={name}
        value={fmt16(v, base)}
        label={c ? `${name}: ${fmt16(v, base)} (cambió desde ${fmt16(c.before, base)})` : `${name}: ${fmt16(v, base)}`}
        title={tooltip16(v, c ? c.before : null, base)}
        changed={!!c}
        className="wide"
      />
    );
  };

  const hl = live ? ((live.cpu.H << 8) | live.cpu.L) & 0xffff : 0;
  const mVal = live ? live.memory[hl]! : 0;

  return (
    <section className="panel" aria-label="Registros">
      <header className="panel-h">
        <span className="caps"><b>01</b>Registros</span>
      </header>
      <div className="regs">
        {cell8('A', 'acc wide')}
        {REGS_8.map((r) => cell8(r))}
        {cell16('PC')}
        {cell16('SP')}
        {live ? (
          <Cell
            name="M"
            value={fmt8(mVal, base)}
            label={`M: ${fmt8(mVal, base)}`}
            title={`M = memoria apuntada por HL (dirección ${fmt16(hl, 'hex')})`}
            changed={false}
            className="wide"
          />
        ) : (
          <Cell name="M" value="—" label="M: sin datos" title="M = memoria apuntada por HL" changed={false} className="wide" />
        )}
      </div>
    </section>
  );
}
