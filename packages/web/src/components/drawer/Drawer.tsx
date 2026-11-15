import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useSession } from '../../state/store';
import { Salida } from './Salida';
import { Pila } from './Pila';
import { Puertos } from './Puertos';
import { Interrupciones } from './Interrupciones';
import { Metricas } from './Metricas';
import './drawer.css';

type TabId = 'salida' | 'pila' | 'puertos' | 'interrupciones' | 'metricas';

const TABS: { id: TabId; label: string }[] = [
  { id: 'salida', label: 'Salida' },
  { id: 'pila', label: 'Pila' },
  { id: 'puertos', label: 'Puertos E/S' },
  { id: 'interrupciones', label: 'Interrupciones' },
  { id: 'metricas', label: 'Métricas' },
];

const BODY: Record<TabId, () => JSX.Element> = {
  salida: Salida,
  pila: Pila,
  puertos: Puertos,
  interrupciones: Interrupciones,
  metricas: Metricas,
};

/** Lo último que se vio, para detectar novedades sin avisar por lo que ya estaba. */
interface Seen {
  outs: number;
  halted: boolean;
  asm: unknown;
  status: unknown;
}

export function Drawer() {
  const [tab, setTab] = useState<TabId>('salida');
  const [collapsed, setCollapsed] = useState(false);
  const [dots, setDots] = useState<ReadonlySet<TabId>>(new Set());
  const refs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const seen = useRef<Seen | null>(null);

  const machine = useSession((s) => s.machine);
  const stale = useSession((s) => s.stale);
  const asm = useSession((s) => s.asm);
  const status = useSession((s) => s.status);
  const version = useSession((s) => s.version);

  const live = machine && !stale ? machine : null;
  const outs = live?.outputs.length ?? 0;
  const halted = live?.cpu.halted ?? false;

  // La Machine es mutable: `version` re-dispara el efecto en cada cambio.
  useEffect(() => {
    const prev = seen.current;
    seen.current = { outs, halted, asm, status };
    if (!prev) return;
    const hasAsmError = !!asm && asm !== prev.asm && asm.messages.some((m) => m.severity === 'error');
    const news =
      outs > prev.outs ||
      (halted && !prev.halted) ||
      hasAsmError ||
      (status !== prev.status && status?.kind === 'error');
    if (!news) return;
    setCollapsed(false);
    if (tab !== 'salida') setDots((d) => (d.has('salida') ? d : new Set(d).add('salida')));
  }, [version, outs, halted, asm, status, tab]);

  const select = (id: TabId) => {
    setTab(id);
    setDots((d) => {
      if (!d.has(id)) return d;
      const n = new Set(d);
      n.delete(id);
      return n;
    });
  };

  const onKey = (e: KeyboardEvent, i: number) => {
    const last = TABS.length - 1;
    let to: number;
    if (e.key === 'ArrowRight') to = i === last ? 0 : i + 1;
    else if (e.key === 'ArrowLeft') to = i === 0 ? last : i - 1;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = last;
    else return;
    e.preventDefault();
    const id = TABS[to]!.id;
    select(id);
    refs.current[id]?.focus();
  };

  const Body = BODY[tab];
  return (
    <section className={`drawer${collapsed ? ' collapsed' : ''}`} aria-label="Cajón inferior">
      <div className="drawer-bar">
        <div className="drawer-tabs" role="tablist" aria-label="Cajón inferior">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => {
                refs.current[t.id] = el;
              }}
              type="button"
              role="tab"
              className="dtab"
              id={`drawer-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls="drawer-panel"
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => select(t.id)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {t.label}
              {dots.has(t.id) && (
                <>
                  <span className="dot" aria-hidden="true" />
                  <span className="sr-only"> (novedades)</span>
                </>
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="drawer-toggle"
          aria-expanded={!collapsed}
          aria-controls="drawer-panel"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
          {collapsed ? 'Desplegar cajón' : 'Plegar cajón'}
        </button>
      </div>
      <div
        className="drawer-body"
        role="tabpanel"
        id="drawer-panel"
        aria-labelledby={`drawer-tab-${tab}`}
        hidden={collapsed}
      >
        <Body />
      </div>
    </section>
  );
}
