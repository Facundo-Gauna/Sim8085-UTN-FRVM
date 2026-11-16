/** Barra del ejercicio activo, entre la barra de herramientas y el área de trabajo del Simulador. */
import { useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useSession } from '../../state/store';
import './exercises.css';

export function ExerciseBar() {
  const exercise = useSession((s) => s.exercise);
  const result = useSession((s) => s.exerciseResult);
  const check = useSession((s) => s.checkExerciseNow);
  const leave = useSession((s) => s.leaveExercise);
  const [showHint, setShowHint] = useState(false);
  if (!exercise) return null;

  const message = result
    ? result.ok
      ? result.total === 1
        ? '¡Correcto! Pasó el único caso'
        : `¡Correcto! Pasó los ${result.total} casos`
      : result.failure!.message
    : '';

  return (
    <section className="exbar" aria-label="Ejercicio activo">
      <div className="exbar-row">
        <span className="caps">Ejercicio</span>
        <strong>{exercise.title}</strong>
        <button type="button" className="btn primary" onClick={() => void check()}>
          Comprobar
        </button>
        <button type="button" className="btn" aria-expanded={showHint} onClick={() => setShowHint((v) => !v)}>
          Pista
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setShowHint(false);
            leave();
          }}
        >
          Salir del ejercicio
        </button>
        <details className="exbar-statement">
          <summary>Enunciado</summary>
          <p>{exercise.statement}</p>
        </details>
      </div>
      {showHint && <p className="exbar-hint">{exercise.hint}</p>}
      <div role="status" className={`exbar-result${result && !result.ok ? ' fail' : ''}`}>
        {result &&
          (result.ok ? (
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
          ))}
        {message}
      </div>
    </section>
  );
}
