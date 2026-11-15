/**
 * Panel 03 MEMORIA.
 *
 * Columnas: 8 por fila; 16 cuando el contenedor mide >= 560 px de ancho. El
 * ancho se mide con ResizeObserver (si no existe, p. ej. en jsdom, quedan 8):
 * así la ventana de 16 filas y su alineación usan siempre el mismo número.
 *
 * Teclado (un solo tab stop, tabIndex "roving"): Tab entra a la celda activa;
 * flechas mueven el foco entre celdas (arriba/abajo = una fila, la vista se
 * desplaza si hace falta); Enter o F2 abren la edición; doble clic también.
 * En el editor: Enter confirma, Escape o salir del campo cancelan.
 * El texto válido va a session.setMemoryByte; uno inválido muestra el error
 * (role="alert"), deja el valor viejo y el editor abierto.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { fmt16, fmt8, parseAddress, parseByte } from '../lib/format';
import { useSession } from '../state/store';
import './Memory.css';

const ROWS = 16;
const WIDE_PX = 560;
const MEM_SIZE = 0x10000;

export function Memory() {
  const machine = useSession((s) => s.machine);
  const asm = useSession((s) => s.asm);
  const stale = useSession((s) => s.stale);
  const base = useSession((s) => s.base);
  const userMemory = useSession((s) => s.userMemory);
  const setMemoryByte = useSession((s) => s.setMemoryByte);
  const clearUserMemory = useSession((s) => s.clearUserMemory);
  useSession((s) => s.version); // la Machine es mutable: re-dibujar en cada cambio

  const live = machine && !stale ? machine : null;

  const rootRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(8);
  const [view, setView] = useState(0);
  const [gotoText, setGotoText] = useState('');
  const [gotoError, setGotoError] = useState<string | null>(null);
  const [focusAddr, setFocusAddr] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const pendingFocus = useRef<number | null>(null);
  const gotoId = useId();
  const version = useSession((s) => s.version);

  // Un editor abierto es de la máquina y el estado que se veían al abrirlo: si la
  // máquina cambia (paso, reset, re-ensamblado), queda desactualizada o desaparece,
  // se cancela. Confirmar una edición también sube `version`, pero ya cerró el editor.
  useEffect(() => {
    setEditing(null);
    setEditError(null);
    setDraft('');
  }, [machine, stale, version]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setCols(e.contentRect.width >= WIDE_PX ? 16 : 8);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [live !== null]);

  // El foco se mueve después de dibujar, cuando la celda destino ya existe.
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    const sel = editing === null ? `[data-addr="${pendingFocus.current}"]` : 'input.cell-edit';
    const el = rootRef.current?.querySelector<HTMLElement>(sel);
    if (el) {
      el.focus();
      pendingFocus.current = null;
    }
  });

  const maxStart = MEM_SIZE - ROWS * cols;
  const start = Math.min(view - (view % cols), maxStart);
  const clampView = (addr: number) => Math.max(0, Math.min(addr - (addr % cols), maxStart));

  const applyGoto = () => {
    const p = parseAddress(gotoText);
    if (!p.ok) {
      setGotoError(p.error);
      return;
    }
    setGotoError(null);
    setView(clampView(p.value));
    setFocusAddr(p.value);
    pendingFocus.current = p.value;
  };

  const moveTo = (addr: number) => {
    const a = Math.max(0, Math.min(MEM_SIZE - 1, addr));
    setFocusAddr(a);
    pendingFocus.current = a;
    if (a < start) setView(clampView(a));
    else if (a >= start + ROWS * cols) setView(clampView(a - (ROWS - 1) * cols));
  };

  const shiftRows = (n: number) => setView(Math.max(0, Math.min(maxStart, start + n * cols)));

  const openEditor = (addr: number) => {
    if (!live) return;
    setEditing(addr);
    setDraft(fmt8(live.memory[addr]!, 'hex').slice(0, 2));
    setEditError(null);
    pendingFocus.current = addr;
  };

  const closeEditor = (refocus: boolean) => {
    if (editing !== null && refocus) pendingFocus.current = editing;
    setEditing(null);
    setEditError(null);
  };

  const confirm = () => {
    if (editing === null || !live) return;
    const p = parseByte(draft);
    if (!p.ok) {
      setEditError(p.error);
      return;
    }
    setMemoryByte(editing, draft);
    closeEditor(true);
  };

  const onCellKey = (e: KeyboardEvent, addr: number) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols };
    if (e.key in moves) {
      e.preventDefault();
      moveTo(addr + moves[e.key]!);
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      openEditor(addr);
    }
  };

  const gotoField = (
    <label className="field" htmlFor={gotoId}>
      <span className="caps">Ir a</span>
      <input
        id={gotoId}
        className="goto mono"
        value={gotoText}
        placeholder="0040h"
        spellCheck={false}
        autoComplete="off"
        aria-invalid={gotoError ? true : undefined}
        onChange={(e) => setGotoText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') applyGoto();
        }}
      />
    </label>
  );

  const header = (
    <header className="panel-h">
      <span className="caps"><b>03</b>Memoria</span>
      {gotoField}
    </header>
  );

  if (!live) {
    return (
      <section className="panel" aria-label="Memoria">
        {header}
        {gotoError && <div role="alert" className="mem-err">{gotoError}</div>}
        <div className="mem-empty">
          <span className="mono" aria-hidden="true">— — — —</span>
          <span>Ensamblá para ver la memoria</span>
        </div>
      </section>
    );
  }

  const progAddrs = new Set<number>(asm?.memory.keys());
  for (const r of asm?.rows ?? []) r.bytes.forEach((_, i) => progAddrs.add((r.address + i) & 0xffff));
  const before = new Map<number, number>();
  for (const c of live.lastChanges()) if (c.kind === 'mem' && c.before !== c.after) before.set(c.addr, c.before);
  const pc = live.cpu.PC;
  const roving = focusAddr >= start && focusAddr < start + ROWS * cols ? focusAddr : start;

  const rows = [];
  for (let r = 0; r < ROWS; r++) {
    const rowAddr = start + r * cols;
    const cells = [];
    for (let i = 0; i < cols; i++) {
      const addr = rowAddr + i;
      const v = live.memory[addr]!;
      const prev = before.get(addr);
      const user = userMemory.has(addr);
      const cls = ['cell'];
      if (progAddrs.has(addr)) cls.push('prog');
      else if (v === 0 && !user) cls.push('zero');
      if (prev !== undefined) cls.push('changed');
      if (addr === pc) cls.push('pc');
      if (user) cls.push('user');
      const label =
        `${fmt16(addr, base)}: ${fmt8(v, base)}` +
        (prev !== undefined ? ` (cambió desde ${fmt8(prev, base)})` : '') +
        (user ? ' (cargado por vos)' : '');
      cells.push(
        <td
          key={addr}
          role="gridcell"
          className={cls.join(' ')}
          data-addr={addr}
          aria-label={label}
          aria-current={addr === pc ? 'true' : undefined}
          title={user ? 'Dato cargado por vos' : undefined}
          tabIndex={editing === null && addr === roving ? 0 : -1}
          onFocus={() => setFocusAddr(addr)}
          onDoubleClick={(e) => {
            if (e.target instanceof HTMLInputElement) return;
            openEditor(addr);
          }}
          onKeyDown={(e) => onCellKey(e, addr)}
        >
          {editing === addr ? (
            <>
            <input
              className="cell-edit mono"
              aria-label={`Valor de ${fmt16(addr, 'hex')} en hexadecimal`}
              aria-invalid={editError ? true : undefined}
              value={draft}
              size={3}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => closeEditor(false)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') confirm();
                else if (e.key === 'Escape') closeEditor(true);
              }}
            />
            {base !== 'hex' && <span className="cell-hint" aria-hidden="true">h</span>}
            </>
          ) : (
            <>
              {fmt8(v, base)}
              {prev !== undefined && <span className="mark" aria-hidden="true">•</span>}
            </>
          )}
        </td>,
      );
    }
    rows.push(
      <tr key={rowAddr}>
        <th scope="row">{fmt16(rowAddr, base)}</th>
        {cells}
      </tr>,
    );
  }

  return (
    <section className="panel" aria-label="Memoria">
      {header}
      {gotoError && <div role="alert" className="mem-err">{gotoError}</div>}
      <div className="mem" ref={rootRef}>
        <table role="grid" aria-label="Memoria del 8085">
          <thead>
            <tr>
              <th scope="col" aria-label="Dirección" />
              {Array.from({ length: cols }, (_, i) => (
                <th key={i} scope="col">+{i.toString(16).toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
      {editError && <div role="alert" className="mem-err">{editError}</div>}
      <div className="mem-foot">
        <button type="button" onClick={() => shiftRows(-1)} disabled={start === 0}>Fila anterior</button>
        <button type="button" onClick={() => shiftRows(1)} disabled={start >= maxStart}>Fila siguiente</button>
        <button type="button" onClick={clearUserMemory}>Borrar datos cargados</button>
      </div>
    </section>
  );
}
