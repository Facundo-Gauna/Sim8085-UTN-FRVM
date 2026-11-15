import { useEffect, useRef } from 'react';
import { CircleX, Info, TriangleAlert } from 'lucide-react';
import { fmt8 } from '../../lib/format';
import { useSession } from '../../state/store';

export function Salida() {
  const asm = useSession((s) => s.asm);
  const machine = useSession((s) => s.machine);
  const stale = useSession((s) => s.stale);
  const status = useSession((s) => s.status);
  const base = useSession((s) => s.base);
  const pausePrompt = useSession((s) => s.pausePrompt);
  useSession((s) => s.version);
  const outRef = useRef<HTMLOListElement>(null);

  const live = machine && !stale ? machine : null;
  const outputs = live?.outputs ?? [];
  const messages = asm?.messages ?? [];
  const halted = !!live?.cpu.halted;

  useEffect(() => {
    const el = outRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [outputs.length]);

  const sim: { kind: 'info' | 'error'; text: string }[] = [];
  if (status) sim.push(status);
  if (halted && status?.text !== 'Detenido (HLT)') sim.push({ kind: 'info', text: 'Detenido (HLT)' });
  if (pausePrompt) {
    sim.push({ kind: 'info', text: 'Se alcanzó el límite de instrucciones sin detenerse: puede ser un bucle infinito' });
  }

  return (
    <div className="salida">
      <section aria-label="Mensajes del ensamblador">
        <h3 className="caps">Ensamblador</h3>
        {messages.length === 0 ? (
          <p className="t">Sin mensajes del ensamblador</p>
        ) : (
          <ul className="msgs" aria-label="Mensajes del ensamblador">
            {messages.map((m, i) => (
              <li key={i} className={m.severity}>
                {m.severity === 'error' ? (
                  <CircleX size={14} aria-hidden="true" />
                ) : (
                  <TriangleAlert size={14} aria-hidden="true" />
                )}
                <span>
                  Línea {m.line}: {m.severity === 'error' ? 'error' : 'advertencia'}: {m.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Mensajes del simulador">
        <h3 className="caps">Simulador</h3>
        {sim.length === 0 ? (
          <p className="t">Sin mensajes del simulador</p>
        ) : (
          <ul className="msgs">
            {sim.map((m, i) => (
              <li key={i} className={m.kind}>
                {m.kind === 'error' ? <CircleX size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}
                <span>{m.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-label="Salida de OUT">
        <h3 className="caps">E/S</h3>
        {outputs.length === 0 ? (
          <p className="t">Sin salida todavía</p>
        ) : (
          <ol className="outs" ref={outRef} aria-label="Salida de OUT">
            {outputs.map((o, i) => (
              <li key={i}>
                <span className="t">paso {o.step}</span>
                <span className="mono">{`OUT ${fmt8(o.port, 'hex')} ← ${fmt8(o.value, base)}`}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
