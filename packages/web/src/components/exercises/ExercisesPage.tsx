/** Catálogo de ejercicios: lista agrupada a la izquierda y detalle a la derecha (spec §6.9). */
import { useState } from 'react';
import { Check } from 'lucide-react';
import { EXERCISES, GROUP_TITLES, type Exercise } from '@sim8085/core';
import { useSection } from '../../lib/useSection';
import { useSession } from '../../state/store';
import './exercises.css';

const GROUPS: Exercise['group'][] = ['basico', 'catedra', 'intermedio', 'adicional'];
const h2 = (n: number) => n.toString(16).toUpperCase().padStart(2, '0') + 'h';
const h4 = (n: number) => n.toString(16).toUpperCase().padStart(4, '0') + 'h';

export function ExercisesPage() {
  const solved = useSession((s) => s.solved);
  const startExercise = useSession((s) => s.startExercise);
  const { go } = useSection();
  const [selected, setSelected] = useState<string>(EXERCISES[0]!.id);
  const ex = EXERCISES.find((e) => e.id === selected)!;

  return (
    <section className="page exercises" aria-label="Ejercicios">
      <div className="ex-list">
        <p className="ex-progress">
          <span className="mono">{EXERCISES.filter((e) => solved.has(e.id)).length}</span> de{' '}
          <span className="mono">{EXERCISES.length}</span> resueltos
          <span className="ex-bar" aria-hidden="true">
            <span style={{ width: `${(100 * EXERCISES.filter((e) => solved.has(e.id)).length) / EXERCISES.length}%` }} />
          </span>
        </p>
        {GROUPS.map((g) => {
          const items = EXERCISES.filter((e) => e.group === g);
          const done = items.filter((e) => solved.has(e.id)).length;
          return (
          <div key={g} className="ex-group">
            <h2 className="caps">
              {GROUP_TITLES[g]}
              <span className="ex-count mono" aria-hidden="true">
                {done}/{items.length}
              </span>
            </h2>
            <ul aria-label={GROUP_TITLES[g]}>
              {items.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="ex-item"
                    aria-current={e.id === selected ? 'true' : undefined}
                    onClick={() => setSelected(e.id)}
                  >
                    <span>{e.title}</span>
                    {solved.has(e.id) && (
                      <span className="ex-solved">
                        <Check size={14} strokeWidth={2} aria-hidden="true" /> Resuelto
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          );
        })}
      </div>
      <article className="ex-detail">
        <span className="caps ex-kicker">
          {GROUP_TITLES[ex.group]} · inicio {h4(ex.start)} · se comprueba con {ex.tests.length}{' '}
          {ex.tests.length === 1 ? 'caso' : 'casos'}
        </span>
        <h2>{ex.title}</h2>
        <p className="ex-statement">{ex.statement}</p>
        {ex.memory.length > 0 && (
          <table aria-label="Datos iniciales" className="ex-data">
            <thead>
              <tr>
                <th scope="col">Dirección</th>
                <th scope="col">Valor</th>
              </tr>
            </thead>
            <tbody>
              {ex.memory.map(([a, v]) => (
                <tr key={a}>
                  <td className="mono">{h4(a)}</td>
                  <td className="mono">{h2(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <details key={ex.id}>
          <summary>Pista</summary>
          <p>{ex.hint}</p>
        </details>
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            startExercise(ex.id);
            go('simulador');
          }}
        >
          Resolver en el simulador
        </button>
      </article>
    </section>
  );
}
