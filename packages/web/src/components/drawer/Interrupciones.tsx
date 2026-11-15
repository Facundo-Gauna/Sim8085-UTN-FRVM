import { Check, EyeOff, Minus, Eye, BellRing, Power, PowerOff } from 'lucide-react';
import type { Irq } from '@sim8085/core';
import { useSession } from '../../state/store';

const IRQS: { irq: Irq; label: string; key: 'trap' | 'r75' | 'r65' | 'r55' }[] = [
  { irq: 'TRAP', label: 'TRAP', key: 'trap' },
  { irq: 'RST7.5', label: 'RST 7.5', key: 'r75' },
  { irq: 'RST6.5', label: 'RST 6.5', key: 'r65' },
  { irq: 'RST5.5', label: 'RST 5.5', key: 'r55' },
];
const MASKS = [
  { label: 'M7.5', key: 'm75' },
  { label: 'M6.5', key: 'm65' },
  { label: 'M5.5', key: 'm55' },
] as const;

export function Interrupciones() {
  const machine = useSession((s) => s.machine);
  const stale = useSession((s) => s.stale);
  const raise = useSession((s) => s.raise);
  useSession((s) => s.version);
  const live = machine && !stale ? machine : null;
  const cpu = live?.cpu;

  return (
    <div className="irq">
      <div className="btns" role="group" aria-label="Generar interrupción">
        {IRQS.map((i) => (
          <button
            key={i.irq}
            type="button"
            disabled={!live}
            aria-label={`Generar ${i.label}`}
            onClick={() => raise(i.irq)}
          >
            {i.label}
          </button>
        ))}
      </div>
      {!live && <p className="t">Ensamblá para generar interrupciones</p>}
      <div className="irq-cols">
        <div>
          <h3 className="caps">Máscaras</h3>
          <ul aria-label="Máscaras de interrupción">
            {MASKS.map((m) => {
              const masked = cpu ? cpu.masks[m.key] : true;
              return (
                <li key={m.key}>
                  <span className="mono">{m.label}</span>
                  {masked ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                  <span>{masked ? 'enmascarada' : 'habilitada'}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div>
          <h3 className="caps">Habilitación</h3>
          <ul aria-label="Habilitación de interrupciones">
            <li>
              <span className="mono">IE</span>
              {cpu?.ie ? <Power size={14} aria-hidden="true" /> : <PowerOff size={14} aria-hidden="true" />}
              <span>{cpu?.ie ? 'habilitadas (EI)' : 'deshabilitadas (DI)'}</span>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="caps">Pendientes</h3>
          <ul aria-label="Interrupciones pendientes">
            {IRQS.map((i) => {
              const pend = !!cpu?.pending[i.key];
              return (
                <li key={i.key} className={pend ? 'pend' : undefined}>
                  <span className="mono">{i.label}</span>
                  {pend ? <BellRing size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}
                  <span>{pend ? 'pendiente' : '—'}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <p className="t cap">
        <Check size={12} aria-hidden="true" /> RST 7.5 se retiene hasta atenderse; las demás se pierden si no se aceptan.
      </p>
    </div>
  );
}
