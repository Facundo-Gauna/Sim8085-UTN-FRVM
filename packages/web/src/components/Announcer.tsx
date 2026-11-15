import { useRef } from 'react';
import type { Change } from '@sim8085/core';
import { fmt16, fmt8, type Base } from '../lib/format';
import { useSession } from '../state/store';

const CAP = 6;
const is16 = (name: string) => name === 'PC' || name === 'SP';

export function sentence(changes: Change[], base: Base): string {
  const real = changes.filter((c) => c.before !== c.after);
  const rank = (c: Change) => (c.kind === 'reg' && c.name === 'PC' ? 3 : c.kind === 'reg' ? 0 : c.kind === 'flag' ? 1 : 2);
  const sorted = [...real].sort((a, b) => rank(a) - rank(b));
  const parts = sorted.slice(0, CAP).map((c) => {
    if (c.kind === 'flag') return `${c.name} cambió de ${c.before} a ${c.after}`;
    if (c.kind === 'mem') return `M[${fmt16(c.addr, base)}] cambió de ${fmt8(c.before, base)} a ${fmt8(c.after, base)}`;
    const f = is16(c.name) ? fmt16 : fmt8;
    return `${c.name} cambió de ${f(c.before, base)} a ${f(c.after, base)}`;
  });
  if (parts.length === 0) return '';
  const extra = sorted.length - parts.length;
  return `${parts.join('. ')}.${extra > 0 ? ` Y ${extra} ${extra === 1 ? 'cambio más' : 'cambios más'}.` : ''}`;
}

/** Región en vivo, oculta a la vista: anuncia los cambios de cada paso a lectores de pantalla. */
export function Announcer() {
  const machine = useSession((s) => s.machine);
  const stale = useSession((s) => s.stale);
  const base = useSession((s) => s.base);
  const version = useSession((s) => s.version);
  // Solo se recalcula cuando cambia la máquina: cambiar la base no re-anuncia.
  const last = useRef<{ version: number; stale: boolean; text: string }>({ version: -1, stale: false, text: '' });
  if (last.current.version !== version || last.current.stale !== stale) {
    last.current = {
      version,
      stale,
      text: machine && !stale ? sentence(machine.lastChanges(), base) : '',
    };
  }
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="false">
      {last.current.text}
    </div>
  );
}
