import { useMemo, useState } from 'react';
import { ISA, type InstrDef } from '@sim8085/core';

const hex2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
const form = (d: InstrDef) => `${d.mnemonic}${d.operands.length ? ' ' + d.operands.join(',') : ''}`;
const tStates = (d: InstrDef) => (Array.isArray(d.tStates) ? `${d.tStates[0]}/${d.tStates[1]}` : String(d.tStates));

export function OpcodeTable() {
  const [query, setQuery] = useState('');
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return ISA;
    return ISA.filter(
      (d) => hex2(d.opcode).toLowerCase() === q.replace(/h$/, '') || form(d).toLowerCase().includes(q) || d.summary.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="opcodes">
      <label className="conv-field">
        Buscar instrucción
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          placeholder="mnemónico, opcode o texto"
        />
      </label>
      <p aria-live="polite" className="count">
        {rows.length} de {ISA.length}
      </p>
      {rows.length === 0 && <p className="count">Sin resultados</p>}
      <div className="tb-scroll" tabIndex={0} role="group" aria-label="Opcodes (desplazable)">
        <table aria-label="Tabla de opcodes" className="tb-table">
          <thead>
            <tr>
              <th scope="col">Opcode</th>
              <th scope="col">Mnemónico</th>
              <th scope="col">Bytes</th>
              <th scope="col">Estados T</th>
              <th scope="col">Banderas</th>
              <th scope="col">Resumen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.opcode}>
                <td className="mono">{hex2(d.opcode)}</td>
                <td className="mono">{form(d)}</td>
                <td className="mono">{d.size}</td>
                <td className="mono">{tStates(d)}</td>
                <td className="mono">{d.flags.length ? d.flags.join(' ') : '—'}</td>
                <td>{d.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
