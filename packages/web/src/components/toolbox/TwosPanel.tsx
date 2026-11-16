import { useState } from 'react';
import { analyze, parseSigned } from '../../lib/twos';


export function TwosPanel() {
  const [bits, setBits] = useState<8 | 16>(8);
  const [text, setText] = useState('');
  const parsed = text.trim() === '' ? null : parseSigned(text, bits);
  const view = parsed && parsed.ok ? analyze(parsed.value, bits) : null;
  const hex = (v: number) => `${v.toString(16).toUpperCase().padStart(bits / 4, '0')}h`;

  return (
    <div className="twos">
      <label className="conv-field">
        Ancho
        <select value={bits} onChange={(e) => setBits(Number(e.target.value) as 8 | 16)}>
          <option value={8}>8 bits</option>
          <option value={16}>16 bits</option>
        </select>
      </label>
      <label className="conv-field">
        Valor
        <input
          className="mono"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={parsed && !parsed.ok ? true : undefined}
          placeholder="ej. -5, 0FBh o 11111011b"
        />
      </label>
      {parsed && !parsed.ok ? (
        <p role="alert" className="field-error">
          {parsed.error}
        </p>
      ) : (
        <p className="field-error" aria-hidden="true" />
      )}
      <dl className="twos-list" aria-label="Resultado">
        <dt>Sin signo</dt>
        <dd className="mono">{view ? view.unsigned : '—'}</dd>
        <dt>Con signo</dt>
        <dd className="mono">{view ? view.signed : '—'}</dd>
        <dt>Complemento a 1</dt>
        <dd className="mono">{view ? hex(view.ones) : '—'}</dd>
        <dt>Complemento a 2</dt>
        <dd className="mono">{view ? hex(view.twos) : '—'}</dd>
        <dt>Binario</dt>
        <dd className="mono">{view ? view.binary : '—'}</dd>
      </dl>
    </div>
  );
}
