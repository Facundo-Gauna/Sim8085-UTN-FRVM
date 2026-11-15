import { diffMetrics } from '@sim8085/core';
import { fmt16 } from '../../lib/format';
import { useSession } from '../../state/store';

function signed(n: number, one: string, many: string): string {
  if (n === 0) return `sin cambios en ${many}`;
  const abs = Math.abs(n);
  return `${n < 0 ? '−' : '+'}${abs} ${abs === 1 ? one : many}`;
}

/** Agrupa direcciones consecutivas: 0040h–0041h, 0050h. */
function ranges(addrs: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < addrs.length; ) {
    let j = i;
    while (j + 1 < addrs.length && addrs[j + 1] === addrs[j]! + 1) j++;
    out.push(j === i ? fmt16(addrs[i]!, 'hex') : `${fmt16(addrs[i]!, 'hex')}–${fmt16(addrs[j]!, 'hex')}`);
    i = j + 1;
  }
  return out.join(', ');
}

export function Metricas() {
  const metrics = useSession((s) => s.metrics);
  const prev = useSession((s) => s.prevMetrics);
  const stale = useSession((s) => s.stale);
  const machine = useSession((s) => s.machine);
  useSession((s) => s.version);

  if (!metrics) return <p className="t">Ensamblá para ver las métricas</p>;
  const d = prev ? diffMetrics(prev, metrics) : null;
  const vs = ' vs. versión anterior';
  // La comparación de ejecución solo vale si la anterior corrió y la actual terminó.
  const finished = !!machine && !stale && machine.cpu.halted;
  const execDiff = d && prev!.executed > 0 && finished ? d : null;
  const execNote = !d
    ? null
    : prev!.executed === 0
      ? 'sin ejecución previa'
      : finished
        ? null
        : metrics.executed === 0
          ? 'sin ejecutar todavía'
          : 'ejecutando… la comparación aparece al terminar';
  return (
    <>
      {stale && <p className="t">El código cambió: estas métricas son del último ensamblado.</p>}
      <div className="metrics">
        <div className="metric">
          <span className="caps">Tamaño</span>
          <b>{metrics.sizeBytes} {metrics.sizeBytes === 1 ? 'byte' : 'bytes'}</b>
          <small>{`${fmt16(metrics.range[0], 'hex')}–${fmt16(metrics.range[1], 'hex')}`}</small>
          {d && <small className="diff">{signed(d.sizeBytes, 'byte', 'bytes') + vs}</small>}
        </div>
        <div className="metric">
          <span className="caps">Instrucciones ejecutadas</span>
          <b>{metrics.executed}</b>
          {execDiff && <small className="diff">{signed(execDiff.executed, 'instrucción', 'instrucciones') + vs}</small>}
          {execNote && <small>{execNote}</small>}
        </div>
        <div className="metric">
          <span className="caps">Estados T</span>
          <b>{metrics.tStates}</b>
          {execDiff && <small className="diff">{signed(execDiff.tStates, 'estado T', 'estados T') + vs}</small>}
          {execNote && <small>{execNote}</small>}
        </div>
        <div className="metric">
          <span className="caps">Registros usados</span>
          <b>{metrics.registersUsed.length ? metrics.registersUsed.join(' ') : '—'}</b>
        </div>
        <div className="metric">
          <span className="caps">Memoria usada</span>
          <b>{metrics.memoryUsed.length ? ranges(metrics.memoryUsed) : '—'}</b>
        </div>
      </div>
    </>
  );
}
