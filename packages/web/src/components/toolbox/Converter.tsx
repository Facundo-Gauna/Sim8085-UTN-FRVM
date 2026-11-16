import { useState } from 'react';
import { parseBcdText, parseBinText, parseDecText, parseHexText, toBcd, toBin, toDec, toHex, type Conv } from '../../lib/convert';

type Key = 'hex' | 'dec' | 'bin' | 'bcd';
const FIELDS: { key: Key; label: string; parse(t: string): Conv; show(v: number): string; hint: string }[] = [
  { key: 'hex', label: 'Hexadecimal', parse: parseHexText, show: toHex, hint: 'ej. 3A o 3Ah' },
  { key: 'dec', label: 'Decimal', parse: parseDecText, show: toDec, hint: '0 a 65535' },
  { key: 'bin', label: 'Binario', parse: parseBinText, show: toBin, hint: 'hasta 16 bits, con o sin espacios' },
  { key: 'bcd', label: 'BCD', parse: parseBcdText, show: toBcd, hint: 'un dígito decimal por grupo de 4 bits' },
];

export function Converter() {
  const [texts, setTexts] = useState<Record<Key, string>>({ hex: '', dec: '', bin: '', bcd: '' });
  const [error, setError] = useState<{ key: Key; message: string } | null>(null);

  const onChange = (key: Key, text: string) => {
    const field = FIELDS.find((f) => f.key === key)!;
    const r = field.parse(text);
    if (!r.ok) {
      // Se conserva lo escrito en este campo y el último valor válido en los demás.
      setTexts((t) => ({ ...t, [key]: text }));
      setError({ key, message: r.error });
      return;
    }
    const next = { ...texts } as Record<Key, string>;
    for (const f of FIELDS) next[f.key] = f.key === key ? text : f.show(r.value);
    setTexts(next);
    setError(null);
  };

  return (
    <div className="conv">
      {FIELDS.map((f) => (
        <label key={f.key} className="conv-field">
          {f.label}
          <input
            className="mono"
            value={texts[f.key]}
            onChange={(e) => onChange(f.key, e.target.value)}
            spellCheck={false}
            autoComplete="off"
            aria-invalid={error?.key === f.key ? true : undefined}
            placeholder={f.hint}
          />
        </label>
      ))}
      {error ? (
        <p role="alert" className="field-error">
          {error.message}
        </p>
      ) : (
        <p className="field-error" aria-hidden="true" />
      )}
    </div>
  );
}
