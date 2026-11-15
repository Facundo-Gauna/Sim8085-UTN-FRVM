import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fmt8, parseByte, parsePort } from '../../lib/format';
import { useSession } from '../../state/store';

export function Puertos() {
  const inputs = useSession((s) => s.inputs);
  const base = useSession((s) => s.base);
  const setInput = useSession((s) => s.setInput);
  const removeInput = useSession((s) => s.removeInput);
  const [port, setPort] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const portRef = useRef<HTMLInputElement>(null);
  const removeBtns = useRef(new Map<number, HTMLButtonElement>());
  /** Puerto cuyo botón recibe el foco tras quitar una fila (null = el campo Puerto). */
  const focusAfter = useRef<{ port: number | null } | null>(null);

  useEffect(() => {
    const f = focusAfter.current;
    if (!f) return;
    focusAfter.current = null;
    (f.port === null ? portRef.current : removeBtns.current.get(f.port))?.focus();
  }, [inputs]);

  const remove = (p: number) => {
    const order = [...inputs.keys()].sort((a, b) => a - b);
    focusAfter.current = { port: order[order.indexOf(p) + 1] ?? null };
    removeInput(p);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = parsePort(port);
    if (!p.ok) return setError(`Puerto: ${p.error}`);
    const v = parseByte(value);
    if (!v.ok) return setError(`Valor: ${v.error}`);
    setInput(p.value, value);
    setError('');
    setPort('');
    setValue('');
  };

  const rows = [...inputs].sort((a, b) => a[0] - b[0]);
  return (
    <div className="puertos">
      <p className="t">Cargá aquí los valores que va a leer IN. Cada OUT aparece en Salida.</p>
      {rows.length === 0 ? (
        <p className="t">Sin puertos de entrada cargados</p>
      ) : (
        <table aria-label="Puertos de entrada">
          <thead>
            <tr>
              <th scope="col">Puerto</th>
              <th scope="col">Valor</th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([p, v]) => (
              <tr key={p}>
                <th scope="row">{fmt8(p, 'hex')}</th>
                <td>{fmt8(v, base)}</td>
                <td>
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) removeBtns.current.set(p, el);
                      else removeBtns.current.delete(p);
                    }}
                    aria-label={`Quitar puerto ${fmt8(p, 'hex')}`}
                    onClick={() => remove(p)}
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <form className="add" onSubmit={submit} noValidate>
        <label className="field">
          Puerto
          <input
            className="in"
            ref={portRef}
            aria-label="Puerto en hexadecimal"
            placeholder="05h"
            value={port} onChange={(e) => setPort(e.target.value)} spellCheck={false} />
        </label>
        <label className="field">
          Valor
          <input
            className="in"
            aria-label="Valor en hexadecimal"
            placeholder="7Fh"
            value={value} onChange={(e) => setValue(e.target.value)} spellCheck={false} />
        </label>
        <button type="submit">Agregar</button>
      </form>
      <p className="err" role="alert">
        {error}
      </p>
    </div>
  );
}
