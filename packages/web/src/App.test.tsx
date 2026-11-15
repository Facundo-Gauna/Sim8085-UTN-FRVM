import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { defaultSession } from './state/store';
import type { FileService } from './services/fileService';

// jsdom no mide texto: CodeMirror pide rectángulos de Range al medir la vista.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
}
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);

let mobile = false;
function mockMatchMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes('max-width: 899px') ? mobile : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

const INITIAL = defaultSession.getState();
const s = () => defaultSession.getState();
const fileTabs = () => within(screen.getByRole('tablist', { name: 'Archivos abiertos' })).getAllByRole('tab');
const pc = () => s().machine!.cpu.PC;
const key = (k: string, extra: KeyboardEventInit = {}) =>
  act(() => void fireEvent.keyDown(window, { key: k, ...extra }));

function fakeFiles(): FileService & { saved: [string, string][] } {
  const saved: [string, string][] = [];
  return {
    saved,
    canPickFolder: false,
    openFiles: vi.fn(() => Promise.resolve([{ name: 'otro.asm', text: 'NOP\nHLT\n' }])),
    saveFile: vi.fn((name: string, text: string) => {
      saved.push([name, text]);
      return Promise.resolve();
    }),
  };
}

beforeEach(() => {
  defaultSession.setState(INITIAL, true);
  mobile = false;
  mockMatchMedia();
  try {
    localStorage.clear();
  } catch {
    /* */
  }
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('App: composición', () => {
  it('renderiza el ejemplo con todos los paneles y sin textos de presentación', () => {
    render(<App />);
    for (const name of ['Registros', 'Banderas', 'Memoria', 'Ahora', 'Cajón inferior', 'Editor']) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    expect(screen.getByRole('contentinfo', { name: 'Barra de estado' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Secciones' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Sim8085' })).toBeTruthy();
    expect(screen.getByText(/los archivos abiertos no se guardan/)).toBeTruthy();
    expect(screen.getByText('Esc y luego Tab salen del editor')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/maqueta/i);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(s().machine).toBeNull();
    expect(screen.getByRole('tab', { name: /ej1-complemento\.asm/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('por debajo de 900 px solo muestra el aviso móvil', () => {
    mobile = true;
    render(<App />);
    expect(screen.getByText(/El simulador está pensado para computadora/)).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Registros' })).toBeNull();
    expect(screen.queryByRole('banner')).toBeNull();
  });

  it('Rail: Simulador es la página actual y las otras tres están deshabilitadas', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    expect(within(nav).getByRole('button', { name: 'Simulador' }).getAttribute('aria-current')).toBe('page');
    for (const name of ['Ejercicios', 'Documentación', 'Toolbox']) {
      const b = within(nav).getByRole('button', { name });
      expect(b.getAttribute('aria-disabled')).toBe('true');
      expect(b.getAttribute('title')).toMatch(/Próximamente/);
      expect(b.hasAttribute('disabled')).toBe(false);
    }
  });

  it('los botones de tema ponen data-theme', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Tema oscuro' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Tema oscuro' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Tema claro' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fireEvent.click(screen.getByRole('button', { name: 'Tema del sistema' }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('instala el aviso de beforeunload mientras hay contenido', () => {
    render(<App />);
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    act(() => s().setText(s().activeId, '   '));
    const ev2 = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(false);
  });

  it('el tamaño de letra del editor se ajusta entre 14 y 20 y se guarda', () => {
    render(<App />);
    const up = screen.getByRole('button', { name: 'Agrandar letra del editor' });
    for (let i = 0; i < 6; i++) fireEvent.click(up);
    expect(screen.getByText('20 px')).toBeTruthy();
    expect((up as HTMLButtonElement).disabled).toBe(true);
    expect(localStorage.getItem('sim8085.fontSize')).toBe('20');
  });
});

describe('App: barra de herramientas y atajos', () => {
  it('F5 ensambla', () => {
    render(<App />);
    key('F5');
    expect(s().machine).not.toBeNull();
    expect(screen.getAllByText(/Ensamblado correcto/).length).toBeGreaterThan(0);
  });

  it('F5 hace preventDefault', () => {
    render(<App />);
    const ev = new KeyboardEvent('keydown', { key: 'F5', cancelable: true, bubbles: true });
    act(() => void window.dispatchEvent(ev));
    expect(ev.defaultPrevented).toBe(true);
  });

  it('F10 da un paso y Shift+F10 vuelve atrás', () => {
    render(<App />);
    key('F5');
    expect(pc()).toBe(0x2000);
    key('F10');
    expect(pc()).toBe(0x2003);
    key('F10');
    expect(pc()).toBe(0x2004);
    key('F10', { shiftKey: true });
    expect(pc()).toBe(0x2003);
  });

  it('estados de los botones: Ejecutar deshabilitado sin ensamblar; Atrás sin historial', () => {
    render(<App />);
    const run = () => screen.getByRole('button', { name: /^Ejecutar/ }) as HTMLButtonElement;
    const step = () => screen.getByRole('button', { name: /^Paso/ }) as HTMLButtonElement;
    const back = () => screen.getByRole('button', { name: /^Atrás/ }) as HTMLButtonElement;
    expect(run().disabled).toBe(true);
    expect(step().disabled).toBe(true);
    expect((screen.getByRole('button', { name: /^Ensamblar/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^Ensamblar/ }));
    expect(run().disabled).toBe(false);
    expect(back().disabled).toBe(true);
    fireEvent.click(step());
    expect(back().disabled).toBe(false);
    expect(run().getAttribute('aria-keyshortcuts')).toBe('F8');
    expect(step().getAttribute('title')).toMatch(/F10/);
  });

  it('al cambiar el texto avisa "El código cambió" y deshabilita Ejecutar y Paso', () => {
    render(<App />);
    key('F5');
    act(() => s().setText(s().activeId, s().files[0]!.text + '\nNOP\n'));
    expect(screen.getAllByText(/El código cambió/).length).toBeGreaterThan(0);
    expect((screen.getByRole('button', { name: /^Ejecutar/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /^Paso/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('F8 ejecuta el ejemplo hasta HLT y el cajón lo muestra', () => {
    vi.useFakeTimers();
    render(<App />);
    key('F5');
    key('F8');
    expect(screen.getByRole('button', { name: /^Detener/ })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(5000));
    expect(s().machine!.cpu.halted).toBe(true);
    expect(within(screen.getByRole('region', { name: 'Cajón inferior' })).getAllByText(/Detenido \(HLT\)/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^Ejecutar/ })).toBeTruthy();
  });

  it('bucle infinito a velocidad máxima: aviso en la página con Continuar y Detener, sin confirm()', () => {
    vi.useFakeTimers();
    const confirm = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    render(<App />);
    act(() => s().setText(s().activeId, 'LP: JMP LP\n'));
    fireEvent.change(screen.getByLabelText('Velocidad'), { target: { value: '5' } });
    expect(screen.getByLabelText('Velocidad').getAttribute('aria-valuetext')).toBe('máxima');
    key('F5');
    key('F8');
    for (let i = 0; i < 40 && !s().pausePrompt; i++) act(() => void vi.advanceTimersByTime(16));
    const banner = screen.getByRole('alertdialog');
    expect(banner.textContent).toMatch(/100 000 instrucciones sin llegar a HLT/);
    const cont = within(banner).getByRole('button', { name: 'Continuar' });
    expect(document.activeElement).toBe(cont);
    expect(within(banner).getByRole('button', { name: 'Detener' })).toBeTruthy();
    fireEvent.click(cont);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: /^Detener/ })).toBeTruthy();
    for (let i = 0; i < 40 && !s().pausePrompt; i++) act(() => void vi.advanceTimersByTime(16));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Detener' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s().pausePrompt).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Ejecutar/ }));
    expect(confirm).not.toHaveBeenCalled();
  });

  it('campo Inicio: Enter aplica y xyz queda aria-invalid', () => {
    render(<App />);
    const input = screen.getByLabelText('Inicio') as HTMLInputElement;
    expect(input.value).toBe('2000h');
    fireEvent.change(input, { target: { value: '3000h' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(s().startAddress).toBe(0x3000);
    expect(input.getAttribute('aria-invalid')).toBe('false');
    fireEvent.change(input, { target: { value: 'xyz' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(s().startAddress).toBe(0x3000);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(s().status?.kind).toBe('error');
  });

  it('las teclas sueltas no se disparan dentro de un campo, F5 sí', () => {
    const files = fakeFiles();
    render(<App fileService={files} />);
    const input = screen.getByLabelText('Inicio');
    act(() => void fireEvent.keyDown(input, { key: 's', ctrlKey: true }));
    expect(files.saveFile).not.toHaveBeenCalled();
    act(() => void fireEvent.keyDown(input, { key: 'F5' }));
    expect(s().machine).not.toBeNull();
  });

  it('Ctrl+S descarga el archivo activo y Ctrl+O abre archivos', async () => {
    const files = fakeFiles();
    render(<App fileService={files} />);
    key('s', { ctrlKey: true });
    expect(files.saved[0]![0]).toBe('ej1-complemento.asm');
    key('o', { ctrlKey: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(files.openFiles).toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: /otro\.asm/ }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('App: pestañas de archivo', () => {
  it('nuevo archivo agrega una pestaña activa', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivo nuevo' }));
    expect(fileTabs()).toHaveLength(2);
    expect(screen.getByRole('tab', { name: /sin-titulo-1\.asm/ }).getAttribute('aria-selected')).toBe('true');
  });

  it('flechas mueven el foco entre pestañas y Enter activa', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivo nuevo' }));
    const [a, b] = fileTabs();
    expect(b!.tabIndex).toBe(0);
    expect(a!.tabIndex).toBe(-1);
    b!.focus();
    fireEvent.keyDown(b!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(a);
    fireEvent.click(a!);
    expect(a!.getAttribute('aria-selected')).toBe('true');
  });

  it('cerrar una pestaña modificada pide confirmación en la página; Escape cancela y Cerrar cierra', () => {
    render(<App />);
    act(() => s().setText(s().activeId, 'MVI A,1\nHLT\n'));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ej1-complemento.asm' }));
    const dlg = screen.getByRole('alertdialog');
    expect(dlg.textContent).toMatch(/¿Cerrar «ej1-complemento\.asm»\? Los cambios no se guardan\./);
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Cancelar' }));
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s().files).toHaveLength(1);
    expect(s().files[0]!.name).toBe('ej1-complemento.asm');

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar ej1-complemento.asm' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // Cerrar el último deja un archivo vacío.
    expect(s().files).toHaveLength(1);
    expect(s().files[0]!.name).toBe('sin-titulo.asm');
    expect(s().files[0]!.text).toBe('');
  });

  it('cerrar sin cambios no pregunta', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivo nuevo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sin-titulo-1.asm' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s().files).toHaveLength(1);
  });
});
