import { byOpcode, type AssembleResult, type Change, type FlagName, type InstrDef, type Machine } from '@sim8085/core';
import { CheckCircle2, CircleAlert, Info } from 'lucide-react';
import { fmt16, fmt8, type Base } from '../lib/format';
import { useSession } from '../state/store';
import './Now.css';

const AC_TITLE = 'AC (acarreo auxiliar) no figura en la plantilla de la cátedra';

/** Forma genérica de la instrucción: mnemónico y operandos tal como los define la ISA. */
const formOf = (d: InstrDef) => (d.operands.length ? `${d.mnemonic} ${d.operands.join(',')}` : d.mnemonic);

const LABEL = /^[A-Za-z_@?.$][\w@?.$]*:\s*/;

/** Texto de la línea fuente sin etiqueta, comentario ni espacios sobrantes. */
const sourceOf = (text: string, line: number | undefined): string => {
  if (line === undefined) return '';
  const raw = text.split('\n')[line - 1] ?? '';
  const semi = raw.indexOf(';');
  const code = (semi < 0 ? raw : raw.slice(0, semi)).trim();
  return code.replace(LABEL, '').trim();
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

/** Efectos del último paso en palabras cortas: "A 00h → 3Ah", "leyó M[0040h] = 3Ah". */
function effectsOf(m: Machine, base: Base): string[] {
  const out: string[] = [];
  const last = m.lastStep();
  for (const c of m.lastChanges() as Change[]) {
    if (c.kind === 'reg') {
      if (c.name === 'PC') continue;
      const f = c.name === 'SP' ? fmt16 : fmt8;
      out.push(`${c.name}: ${f(c.before, base)} → ${f(c.after, base)}`);
    } else if (c.kind === 'flag') out.push(`${c.name}: ${c.before} → ${c.after}`);
    else out.push(`M[${fmt16(c.addr, 'hex')}]: ${fmt8(c.before, base)} → ${fmt8(c.after, base)}`);
  }
  if (last?.memRead !== undefined) out.push(`leyó M[${fmt16(last.memRead, 'hex')}] = ${fmt8(m.memory[last.memRead]!, base)}`);
  return out;
}

/** Bloque "Recién ejecutada": qué instrucción corrió el último paso y qué cambió. */
function LastStep({ machine, asm, text, base }: { machine: Machine; asm: AssembleResult; text: string; base: Base }) {
  const last = machine.lastStep();
  if (!last) {
    return (
      <div className="now-block now-last idle">
        <span className="now-tag">Recién ejecutada</span>
        <p className="muted">
          Ninguna todavía: los registros muestran el estado inicial. Paso (F10) ejecuta la primera instrucción.
        </p>
      </div>
    );
  }
  const src = last.instr ? sourceOf(text, asm.addressToLine.get(last.pc)) || formOf(last.instr) : (last.note ?? 'Interrupción');
  const effects = effectsOf(machine, base);
  return (
    <div className="now-block now-last">
      <span className="now-tag">✓ Recién ejecutada · {fmt16(last.pc, base)}</span>
      <span className="now-instr">{src}</span>
      {effects.length > 0 ? (
        <ul className="now-effects" aria-label="Efectos de la instrucción">
          {effects.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : (
        <span className="flagnote">No cambió registros, banderas ni memoria (solo avanzó el PC)</span>
      )}
    </div>
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
  if (asm && !asm.ok && !stale) {
    // El último ensamblado falló: no invitar a "empezar", señalar dónde están los errores.
    body = (
      <p className="err">
        <CircleAlert size={14} aria-hidden="true" /> El código tiene errores: corregilos y volvé a ensamblar (detalle en Salida)
      </p>
    );
  } else if (!machine || !asm) {
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
          <span className="now-tag next">▶ Próxima · se ejecuta con Paso</span>
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
      <div className={live ? 'now-body split' : 'now-body'}>
        {live && asm && <LastStep machine={live} asm={asm} text={text} base={base} />}
        <div className="now-block now-next">{body}</div>
      </div>
    </section>
  );
}
