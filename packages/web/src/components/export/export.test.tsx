import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSession } from '../../state/store';
import type { FileService } from '../../services/fileService';
import { ExportDialog } from './ExportDialog';

const INITIAL = defaultSession.getState();
const s = () => defaultSession.getState();

function fake(): FileService & { binary: ReturnType<typeof vi.fn> } {
  const binary = vi.fn(() => Promise.resolve());
  return {
    canPickFolder: false,
    openFiles: vi.fn(() => Promise.resolve([])),
    saveFile: vi.fn(() => Promise.resolve()),
    saveBinary: binary,
    binary,
  };
}

function open(code?: string, fs = fake()) {
  if (code !== undefined) act(() => s().setText(s().activeId, code));
  act(() => s().assembleActive());
  const onClose = vi.fn();
  render(<ExportDialog open onClose={onClose} fileService={fs} />);
  return { fs, onClose };
}
const type = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const download = () => screen.getByRole('button', { name: 'Descargar PDF' }) as HTMLButtonElement;

beforeEach(() => defaultSession.setState(INITIAL, true));
afterEach(cleanup);

describe('ExportDialog', () => {
  it('abre como diálogo con el foco en Alumno y la vista previa de la hoja 1', async () => {
    open();
    const dlg = screen.getByRole('dialog', { name: 'Exportar PDF' });
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Alumno'));
    expect(await screen.findByText('Hoja 1 de 1')).toBeTruthy();
    expect(screen.getByText('LDA 0040H')).toBeTruthy();
  });

  it('Hoja Nº 0 o abc: campo inválido con mensaje y sin descarga', () => {
    const { fs } = open();
    for (const bad of ['0', 'abc', '']) {
      type(/Hoja Nº inicial/, bad);
      expect(screen.getByLabelText(/Hoja Nº inicial/).getAttribute('aria-invalid')).toBe('true');
      expect(screen.getByText(/número entero desde 1/)).toBeTruthy();
      expect(download().disabled).toBe(true);
    }
    expect(fs.binary).not.toHaveBeenCalled();
  });

  it('Descargar PDF guarda <ejercicio>-assembler.pdf y avisa en la barra de estado', async () => {
    const { fs } = open();
    type('Ejercicio', 'ej1');
    await act(async () => void fireEvent.click(download()));
    expect(fs.binary).toHaveBeenCalledTimes(1);
    const [name, bytes, mime] = fs.binary.mock.calls[0] as [string, Uint8Array, string];
    expect(name).toBe('ej1-assembler.pdf');
    expect(mime).toBe('application/pdf');
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(s().status).toEqual({ kind: 'info', text: 'PDF guardado: ej1-assembler.pdf' });
  });

  it('Registros-Banderas-Memoria: muestra la traza y guarda -registros.pdf', async () => {
    const { fs } = open();
    fireEvent.click(screen.getByRole('radio', { name: 'Registros-Banderas-Memoria' }));
    expect(await screen.findByText('C5h')).toBeTruthy();
    await act(async () => void fireEvent.click(download()));
    expect(fs.binary.mock.calls[0]![0]).toBe('programa-registros.pdf');
  });

  it('una observación de 81 caracteres avisa con la línea', async () => {
    open(`\nNOP ; ${'x'.repeat(81)}\nHLT\n`);
    expect(await screen.findByText(/1 observación pasa de 80 caracteres y se recorta: línea 2/)).toBeTruthy();
  });

  it('bucle infinito en Registros: avisa de las primeras 500 instrucciones', async () => {
    open('LP: JMP LP\n');
    fireEvent.click(screen.getByRole('radio', { name: 'Registros-Banderas-Memoria' }));
    expect(await screen.findByText(/Se muestran las primeras 500 instrucciones/)).toBeTruthy();
  });

  it('opcode inválido: avisa del error y sigue permitiendo descargar', async () => {
    open('NOP\nDB 08H\n');
    fireEvent.click(screen.getByRole('radio', { name: 'Registros-Banderas-Memoria' }));
    expect(await screen.findByText(/La ejecución terminó con un error/)).toBeTruthy();
    expect(download().disabled).toBe(false);
  });

  it('si el guardado falla muestra el error y el diálogo sigue abierto', async () => {
    const fs = fake();
    fs.binary.mockRejectedValueOnce(new Error('disco lleno'));
    const { onClose } = open(undefined, fs);
    await act(async () => void fireEvent.click(download()));
    expect(screen.getByRole('alert').textContent).toMatch(/No se pudo guardar el PDF/);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape y Cancelar cierran', () => {
    const { onClose } = open();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('si la sesión se limpia con el diálogo abierto no entra en bucle y no lanza', async () => {
    open();
    act(() => s().newFile());
    expect(s().asm).toBeNull();
    expect(await screen.findByText('Hoja 1 de 1')).toBeTruthy();
    expect(download().disabled).toBe(false);
  });

  it('con carpeta de trabajo abierta dice dónde quedó y usa el nombre final que devuelve el servicio', async () => {
    const fs = fake();
    fs.binary.mockResolvedValueOnce('ej1-assembler (2).pdf');
    act(() => defaultSession.setState({ workspace: { name: 'asm', tree: [] } }));
    open(undefined, fs);
    type('Ejercicio', 'ej1');
    await act(async () => void fireEvent.click(download()));
    expect(s().status).toEqual({ kind: 'info', text: 'PDF guardado en la carpeta: ej1-assembler (2).pdf' });
  });

  it('sin carpeta pero con nombre final devuelto usa ese nombre', async () => {
    const fs = fake();
    fs.binary.mockResolvedValueOnce('elegido.pdf');
    open(undefined, fs);
    await act(async () => void fireEvent.click(download()));
    expect(s().status).toEqual({ kind: 'info', text: 'PDF guardado: elegido.pdf' });
  });

  it('cancelar el cuadro "Guardar como" (nombre vacío) no muestra éxito ni error', async () => {
    const fs = fake();
    fs.binary.mockResolvedValueOnce('');
    const { onClose } = open(undefined, fs);
    act(() => defaultSession.setState({ status: null }));
    await act(async () => void fireEvent.click(download()));
    expect(s().status).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});
