/** Toolbox (spec §6.10): conversor, complemento a 2, tabla de opcodes y tabla ASCII, en pestañas accesibles. */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { AsciiTable } from './AsciiTable';
import { Converter } from './Converter';
import { OpcodeTable } from './OpcodeTable';
import { TwosPanel } from './TwosPanel';
import './toolbox.css';

const TABS = [
  { id: 'conversor', label: 'Conversor', Panel: Converter },
  { id: 'complemento', label: 'Complemento a 2', Panel: TwosPanel },
  { id: 'opcodes', label: 'Opcodes', Panel: OpcodeTable },
  { id: 'ascii', label: 'ASCII', Panel: AsciiTable },
] as const;

export function ToolboxPage() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = TABS.length - 1;
    let to = -1;
    if (e.key === 'ArrowRight') to = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowLeft') to = i === 0 ? last : i - 1;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = last;
    if (to < 0) return;
    e.preventDefault();
    setActive(to);
    refs.current[to]?.focus();
  };

  const { Panel } = TABS[active]!;
  return (
    <section className="page toolbox" aria-label="Toolbox">
      <div role="tablist" aria-label="Herramientas" className="tb-tabs">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => void (refs.current[i] = el)}
            type="button"
            role="tab"
            id={`${uid}-${t.id}`}
            aria-selected={i === active}
            aria-controls={`${uid}-panel`}
            tabIndex={i === active ? 0 : -1}
            className="tb-tab"
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${TABS[active]!.id}`} className="tb-panel">
        <Panel />
      </div>
    </section>
  );
}
