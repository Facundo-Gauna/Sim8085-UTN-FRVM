import { byOpcode, type FlagName, type InstrDef } from '@sim8085/core';
import { CheckCircle2, CircleAlert, Info } from 'lucide-react';
import { fmt16 } from '../lib/format';
import { useSession } from '../state/store';
import './Now.css';

const AC_TITLE = 'AC (acarreo auxiliar) no figura en la plantilla de la cátedra';

/** Forma genérica de la instrucción: mnemónico y operandos tal como los define la ISA. */
const formOf = (d: InstrDef) => (d.operands.length ? `${d.mnemonic} ${d.operands.join(',')}` : d.mnemonic);

/** Texto de la línea fuente sin comentario ni espacios sobrantes. */
const sourceOf = (text: string, line: number | undefined): string => {
  if (line === undefined) return '';
  const raw = text.split('\n')[line - 1] ?? '';
  const semi = raw.indexOf(';');
  return (semi < 0 ? raw : raw.slice(0, semi)).trim();
};

const tStatesText = (t: InstrDef['tStates']) =>
  typeof t === 'number' ? `${t} estados T` : `${t[0]} / ${t[1]} estados T`;

function FlagsLine({ flags }: { flags: FlagName[] }) {
  if (flags.length === 0) return <span className="flagnote">No modifica banderas</span>;
  return (
    <span className="flagnote">
      Puede modificar:{' '}
      {flags.map((f, i) => (
        <span key={f}>
          {f === 'AC' ? (
            <span className="ac-out" data-fuera-catedra="" title={AC_TITLE} aria-label="AC, fuera de cátedra">
              AC
            </span>
          ) : (
            f
          )}
          {i < flags.length - 1 ? ', ' : ''}
        </span>
      ))}
    </span>
  );
}

export function Now() {
  const machine = useSession((s) => s.machine);
  const asm = useSession((s) => s.asm);
  const stale = useSession((s) => s.stale);
  const base = useSession((s) => s.base);
  const text = useSession((s) => s.files.find((f) => f.id === s.activeId)?.text ?? '');
  useSession((s) => s.version);

  const live = machine && asm && !stale ? machine : null;
  const pc = live ? live.cpu.PC : null;

  let body: JSX.Element;
  if (!machine || !asm) {
    body = (
      <p className="muted">
        <Info size={14} aria-hidden="true" /> Ensamblá el código (F5) para empezar
      </p>
    );
  } else if (stale || !live) {
    body = (
      <p className="warn">
        <CircleAlert size={14} aria-hidden="true" /> El código cambió: volvé a ensamblar
      </p>
    );
  } else if (live.cpu.halted) {
    body = (
      <>
        <p className="ok">
          <CheckCircle2 size={16} aria-hidden="true" /> <strong>Programa detenido en HLT</strong>
        </p>
        <p className="muted">Probá Atrás para revisar cada paso</p>
      </>
    );
  } else {
    const opcode = live.memory[live.cpu.PC]!;
    const def = byOpcode(opcode);
    if (!def) {
      body = (
        <p className="err">
          <CircleAlert size={14} aria-hidden="true" /> Opcode inválido {fmt16(opcode, 'hex').slice(2)} en{' '}
          {fmt16(live.cpu.PC, 'hex')}: no es una instrucción del 8085
        </p>
      );
    } else {
      const src = sourceOf(text, asm.addressToLine.get(live.cpu.PC));
      body = (
        <>
          <strong>{src || formOf(def)}</strong>
          <p>{def.summary}</p>
          <FlagsLine flags={def.flags} />
          <span className="flagnote">
            {def.size} {def.size === 1 ? 'byte' : 'bytes'} · {tStatesText(def.tStates)}
          </span>
        </>
      );
    }
  }

  return (
    <section className="panel now" aria-label="Ahora">
      <header className="panel-h">
        <span className="caps"><b aria-hidden="true">→</b>Ahora</span>
        {pc !== null && <span className="caps">PC {fmt16(pc, base)}</span>}
      </header>
      <div className="now-body">{body}</div>
    </section>
  );
}
