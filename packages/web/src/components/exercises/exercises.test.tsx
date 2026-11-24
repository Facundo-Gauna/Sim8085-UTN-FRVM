import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { defaultSession } from '../../state/store';
import { ExerciseBar } from './ExerciseBar';
import { ExercisesPage } from './ExercisesPage';

const INITIAL = defaultSession.getState();
const s = () => defaultSession.getState();
const SOL = 'LDA 0040H\nCMA\nSTA 0041H\nHLT\n';

beforeEach(() => {
  defaultSession.setState(INITIAL, true);
  location.hash = '';
});
afterEach(cleanup);

describe('ExercisesPage', () => {
  it('lista los cuatro grupos con los 9 ejercicios de la cátedra', () => {
    render(<ExercisesPage />);
    const region = screen.getByRole('region', { name: 'Ejercicios' });
    for (const g of ['Básicos', 'De la cátedra (GTP05)', 'Intermedios (saltos y lazos)', 'Adicionales']) {
      expect(within(region).getByRole('heading', { name: g })).toBeTruthy();
    }
    const cat = within(region).getByRole('list', { name: 'De la cátedra (GTP05)' });
    expect(within(cat).getAllByRole('button')).toHaveLength(9);
  });

  it('elegir un ejercicio muestra enunciado y datos iniciales; la pista está oculta', () => {
    render(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: /GTP05 · 1/ }));
    expect(screen.getByText(/En el lugar de memoria 0040h existe un valor/)).toBeTruthy();
    const table = screen.getByRole('table', { name: 'Datos iniciales' });
    expect(within(table).getByText('0040h')).toBeTruthy();
    expect(within(table).getByText('3Ah')).toBeTruthy();
    const details = screen.getByText('Pista').closest('details')!;
    expect(details.open).toBe(false);
  });

  it('Resolver en el simulador carga el ejercicio y navega', () => {
    render(<ExercisesPage />);
    fireEvent.click(screen.getByRole('button', { name: /GTP05 · 1/ }));
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Resolver en el simulador' })));
    expect(location.hash).toBe('#/simulador');
    expect(s().exercise!.id).toBe('gtp05-1');
  });

  it('un ejercicio resuelto en la sesión dice "Resuelto" con texto', () => {
    act(() => {
      s().startExercise('gtp05-1');
      s().setText(s().activeId, SOL);
      s().checkExerciseNow();
    });
    render(<ExercisesPage />);
    expect(within(screen.getByRole('button', { name: /GTP05 · 1/ })).getByText('Resuelto')).toBeTruthy();
    expect(within(screen.getByRole('button', { name: /GTP05 · 2/ })).queryByText('Resuelto')).toBeNull();
  });
});

describe('ExerciseBar', () => {
  it('no se monta sin ejercicio activo', () => {
    render(<ExerciseBar />);
    expect(screen.queryByRole('region', { name: 'Ejercicio activo' })).toBeNull();
  });

  it('Comprobar con el starter muestra el caso que falla; con la solución, ¡Correcto!', () => {
    act(() => void s().startExercise('gtp05-1'));
    render(<ExerciseBar />);
    expect(screen.getByRole('region', { name: 'Ejercicio activo' })).toBeTruthy();
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Comprobar' })));
    expect(screen.getByRole('status').textContent).toMatch(/Falla cuando 0040h = 3Ah/);
    act(() => s().setText(s().activeId, SOL));
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Comprobar' })));
    expect(screen.getByRole('status').textContent).toMatch(/¡Correcto! Pasó los 4 casos/);
  });

  it('bucle infinito: avisa y la página sigue respondiendo', () => {
    act(() => {
      s().startExercise('gtp05-1');
      s().setText(s().activeId, 'LP: JMP LP');
    });
    render(<ExerciseBar />);
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Comprobar' })));
    expect(screen.getByRole('status').textContent).toMatch(/No llegó a HLT/);
    expect((screen.getByRole('button', { name: 'Comprobar' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('Pista alterna el texto y Salir del ejercicio quita la barra sin borrar el archivo', () => {
    act(() => void s().startExercise('gtp05-1'));
    render(<ExerciseBar />);
    const hint = screen.getByRole('button', { name: 'Pista' });
    expect(hint.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(hint);
    expect(hint.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/acumulador se complementa/)).toBeTruthy();
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Salir del ejercicio' })));
    expect(screen.queryByRole('region', { name: 'Ejercicio activo' })).toBeNull();
    expect(s().files.some((f) => f.name === 'gtp05-1.asm')).toBe(true);
  });
});
