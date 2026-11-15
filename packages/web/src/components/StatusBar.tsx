import { CircleAlert, Info } from 'lucide-react';
import { fmt16, type Base } from '../lib/format';
import { useSession } from '../state/store';
import './StatusBar.css';

const BASES: { id: Base; label: string }[] = [
  { id: 'hex', label: 'HEX' },
  { id: 'dec', label: 'DEC' },
  { id: 'bin', label: 'BIN' },
];

export function StatusBar() {
  const base = useSession((s) => s.base);
  const setBase = useSession((s) => s.setBase);
  const machine = useSession((s) => s.machine);
  const asm = useSession((s) => s.asm);
  const stale = useSession((s) => s.stale);
  const status = useSession((s) => s.status);
  const text = useSession((s) => s.files.find((f) => f.id === s.activeId)?.text ?? '');
  useSession((s) => s.version);

  const lines = text === '' ? 0 : text.replace(/\n$/, '').split('\n').length;
  const live = machine && !stale ? machine : null;

  let state = 'Sin ensamblar';
  if (stale) state = 'Código desactualizado';
  else if (live) {
    const pc = fmt16(live.cpu.PC, 'hex');
    if (live.cpu.halted) state = 'Detenido (HLT)';
    else state = `${live.stepCount === 0 ? 'Listo' : 'En pausa'} · PC ${pc}`;
  }

  return (
    <footer className="status" aria-label="Barra de estado">
      <span className="seg" role="group" aria-label="Base numérica">
        {BASES.map((b) => (
          <button key={b.id} type="button" aria-pressed={base === b.id} onClick={() => setBase(b.id)}>
            {b.label}
          </button>
        ))}
      </span>
      <span>
        {lines} {lines === 1 ? 'línea' : 'líneas'}
        {asm?.ok ? ` · ${asm.sizeBytes} bytes` : ''}
      </span>
      <span>{state}</span>
      <span className="mono">{live ? live.tStates : 0} estados T</span>
      {status && (
        <span
          className={`msg ${status.kind}`}
          role={status.kind === 'error' ? 'alert' : 'status'}
          title={status.text}
        >
          {status.kind === 'error' ? <CircleAlert size={14} aria-hidden="true" /> : <Info size={14} aria-hidden="true" />}
          <span className="msg-t">{status.text}</span>
        </span>
      )}
    </footer>
  );
}
