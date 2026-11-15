/**
 * Barra lateral angosta: logotipo de chip (DIP-40, MASTER §5.2), navegación
 * principal y selector de tema. Solo "Simulador" existe por ahora; las otras
 * secciones siguen enfocables (aria-disabled, no disabled) y dicen "Próximamente".
 */
import { useId } from 'react';
import { BookOpen, Cpu, ListChecks, Monitor, Moon, Sun, Wrench, type LucideIcon } from 'lucide-react';
import { useTheme, type ThemeChoice } from '../theme/useTheme';
import './Rail.css';

const SECTIONS: { name: string; Icon: LucideIcon; current?: boolean }[] = [
  { name: 'Simulador', Icon: Cpu, current: true },
  { name: 'Ejercicios', Icon: ListChecks },
  { name: 'Documentación', Icon: BookOpen },
  { name: 'Toolbox', Icon: Wrench },
];

const THEMES: { id: ThemeChoice; label: string; Icon: LucideIcon }[] = [
  { id: 'system', label: 'Tema del sistema', Icon: Monitor },
  { id: 'light', label: 'Tema claro', Icon: Sun },
  { id: 'dark', label: 'Tema oscuro', Icon: Moon },
];

/** Logotipo: rectángulo grafito con muesca semicircular, patas y "8085" en Plex Mono. */
function ChipLogo() {
  const pins = [5, 11, 17, 23, 29];
  return (
    <svg className="chip" role="img" aria-label="Sim8085" viewBox="0 0 40 28" width="40" height="28">
      {pins.map((x) => (
        <g key={x} className="chip-pin">
          <rect x={x} y="0" width="2" height="4" />
          <rect x={x} y="24" width="2" height="4" />
        </g>
      ))}
      <rect className="chip-body" x="1" y="3" width="38" height="22" rx="2" />
      <path className="chip-notch" d="M1 10 a4 4 0 0 1 0 8 z" />
      <text className="chip-text" x="21" y="17.5" textAnchor="middle">
        8085
      </text>
    </svg>
  );
}

export function Rail() {
  const { choice, setChoice } = useTheme();
  const soonId = useId();
  return (
    <nav className="rail" aria-label="Secciones">
      <ChipLogo />
      <span id={soonId} hidden>
        Próximamente
      </span>
      <ul className="rail-nav">
        {SECTIONS.map(({ name, Icon, current }) => (
          <li key={name}>
            {current ? (
              <button type="button" className="rail-btn" aria-label={name} title={name} aria-current="page">
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                className="rail-btn"
                aria-label={name}
                title={`${name}. Próximamente`}
                aria-disabled="true"
                aria-describedby={soonId}
                onClick={(e) => e.preventDefault()}
              >
                <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="rail-theme" role="group" aria-label="Tema">
        {THEMES.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="rail-btn small"
            aria-label={label}
            title={label}
            aria-pressed={choice === id}
            onClick={() => setChoice(id)}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
          </button>
        ))}
      </div>
    </nav>
  );
}
