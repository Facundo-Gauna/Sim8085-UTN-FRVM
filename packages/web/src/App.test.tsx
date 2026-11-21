import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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
    saveBinary: vi.fn(() => Promise.resolve()),
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
  location.hash = '';
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

  it('Rail: Simulador es la página actual y las cuatro secciones están habilitadas', () => {
    render(<App />);
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    expect(within(nav).getByRole('button', { name: 'Simulador' }).getAttribute('aria-current')).toBe('page');
    for (const name of ['Ejercicios', 'Documentación', 'Toolbox']) {
      expect(within(nav).getByRole('button', { name }).getAttribute('aria-disabled')).toBeNull();
    }
  });

  it('Documentación abre la documentación', () => {
    render(<App />);
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Documentación' })));
    expect(screen.getByRole('region', { name: 'Documentación' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Qué es assembler y el 8085' })).toBeTruthy();
  });

  it('el Rail navega: el Simulador queda montado y oculto y conserva su texto', () => {
    render(<App />);
    const text = s().files[0]!.text;
    const nav = screen.getByRole('navigation', { name: 'Secciones' });
    act(() => void fireEvent.click(within(nav).getByRole('button', { name: 'Ejercicios' })));
    expect(screen.getByRole('region', { name: 'Ejercicios' })).toBeTruthy();
    expect(within(nav).getByRole('button', { name: 'Ejercicios' }).getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('.main')!.hasAttribute('hidden')).toBe(true);
    act(() => void fireEvent.click(within(nav).getByRole('button', { name: 'Simulador' })));
    expect(document.querySelector('.main')!.hasAttribute('hidden')).toBe(false);
    expect(s().files[0]!.text).toBe(text);
  });

  it('los atajos del simulador no actúan fuera del Simulador', () => {
    render(<App />);
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Toolbox' })));
    expect(screen.getByRole('region', { name: 'Toolbox' })).toBeTruthy();
    key('F5');
    expect(s().asm).toBeNull();
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

  it('dentro de un campo, Ctrl+S descarga con preventDefault y F5 ensambla', () => {
    const files = fakeFiles();
    render(<App fileService={files} />);
    const input = screen.getByLabelText('Inicio');
    const ev = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true });
    act(() => void input.dispatchEvent(ev));
    expect(ev.defaultPrevented).toBe(true);
    expect(files.saveFile).toHaveBeenCalledTimes(1);
    act(() => void fireEvent.keyDown(input, { key: 'F5' }));
    expect(s().machine).not.toBeNull();
  });

  it('una sola acción primaria: Ensamblar sin ensamblar, Ejecutar listo, Reiniciar en HLT', () => {
    render(<App />);
    const primaries = () => [...document.querySelectorAll('.toolbar .btn.primary')].map((b) => b.textContent || b.getAttribute('aria-label'));
    expect(primaries()).toEqual(['Ensamblar']);
    key('F5');
    expect(primaries()).toEqual(['Ejecutar']);
    for (let i = 0; i < 4; i++) key('F10');
    expect(s().machine!.cpu.halted).toBe(true);
    expect(primaries()).toEqual(['Reiniciar']);
    act(() => s().setText(s().activeId, 'NOP\n'));
    expect(primaries()).toEqual(['Ensamblar']);
  });

  it('el área de trabajo es el landmark main', () => {
    render(<App />);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('region', { name: 'Editor' })).toBeTruthy();
    expect(within(main).getByRole('region', { name: 'Memoria' })).toBeTruthy();
  });

  it('con el aviso de pausa: F8 lo cierra y vuelve a correr; F10 también lo cierra', () => {
    vi.useFakeTimers();
    render(<App />);
    act(() => s().setText(s().activeId, 'LP: JMP LP\n'));
    fireEvent.change(screen.getByLabelText('Velocidad'), { target: { value: '5' } });
    key('F5');
    key('F8');
    for (let i = 0; i < 40 && !s().pausePrompt; i++) act(() => void vi.advanceTimersByTime(16));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    key('F8');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('button', { name: /^Detener/ })).toBeTruthy();
    for (let i = 0; i < 40 && !s().pausePrompt; i++) act(() => void vi.advanceTimersByTime(16));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    key('F10');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('Detener en el aviso detiene de verdad la ejecución', () => {
    vi.useFakeTimers();
    render(<App />);
    act(() => s().setText(s().activeId, 'LP: JMP LP\n'));
    fireEvent.change(screen.getByLabelText('Velocidad'), { target: { value: '5' } });
    key('F5');
    key('F8');
    for (let i = 0; i < 40 && !s().pausePrompt; i++) act(() => void vi.advanceTimersByTime(16));
    // El aviso sigue a la vista mientras algo vuelve a poner la ejecución en marcha.
    act(() => fireEvent.click(screen.getByRole('button', { name: /^Ejecutar/ })));
    act(() => s().promptPause());
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Detener' }));
    const n = s().machine!.stepCount;
    act(() => void vi.advanceTimersByTime(500));
    expect(s().machine!.stepCount).toBe(n);
    expect(screen.getByRole('button', { name: /^Ejecutar/ })).toBeTruthy();
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
    fireEvent.click(screen.getByTitle('Cerrar ej1-complemento.asm'));
    const dlg = screen.getByRole('alertdialog');
    expect(dlg.textContent).toMatch(/¿Cerrar «ej1-complemento\.asm»\? Los cambios no se guardan\./);
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Cancelar' }));
    fireEvent.keyDown(dlg, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s().files).toHaveLength(1);
    expect(s().files[0]!.name).toBe('ej1-complemento.asm');

    fireEvent.click(screen.getByTitle('Cerrar ej1-complemento.asm'));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    // Cerrar el último deja un archivo vacío.
    expect(s().files).toHaveLength(1);
    expect(s().files[0]!.name).toBe('sin-titulo.asm');
    expect(s().files[0]!.text).toBe('');
  });

  it('marcado ARIA: el tablist solo expone pestañas; el modificado se lee como texto', () => {
    render(<App />);
    act(() => s().setText(s().activeId, 'MVI A,1\nHLT\n'));
    const list = screen.getByRole('tablist', { name: 'Archivos abiertos' });
    expect(within(list).queryAllByRole('button')).toHaveLength(0);
    const x = screen.getByTitle('Cerrar ej1-complemento.asm');
    expect(x.getAttribute('aria-hidden')).toBe('true');
    expect(x.tabIndex).toBe(-1);
    const tab = within(list).getByRole('tab');
    expect(tab.textContent).toBe('ej1-complemento.asm• (modificado)');
    expect(tab.querySelector('.sr-only')?.textContent).toBe(' (modificado)');
    expect(tab.querySelector('[aria-hidden="true"]')?.textContent).toBe('•');
    expect(tab.querySelector('[aria-label]')).toBeNull();
  });

  it('después de Descargar, cerrar no pregunta', async () => {
    const files = fakeFiles();
    render(<App fileService={files} />);
    act(() => s().setText(s().activeId, 'MVI A,1\nHLT\n'));
    fireEvent.click(screen.getByRole('button', { name: 'Descargar' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(fileTabs()[0]!.textContent).toBe('ej1-complemento.asm');
    fireEvent.click(screen.getByTitle('Cerrar ej1-complemento.asm'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s().files[0]!.name).toBe('sin-titulo.asm');
  });

  it('cerrar sin cambios no pregunta', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Archivo nuevo' }));
    fireEvent.click(screen.getByTitle('Cerrar sin-titulo-1.asm'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(s().files).toHaveLength(1);
  });
});

describe('App: Autocompletar observaciones', () => {
  it('está deshabilitado sin ensamblar y, tras F5, completa las líneas sin comentario', () => {
    render(<App />);
    act(() => s().setText(s().activeId, 'LDA 0040H\nCMA\nHLT\n'));
    const btn = () => screen.getByRole('button', { name: /Autocompletar observaciones/ }) as HTMLButtonElement;
    expect(btn().disabled).toBe(true);
    expect(btn().title).toMatch(/Ensamblá primero/);
    key('F5');
    expect(btn().disabled).toBe(false);
    act(() => void fireEvent.click(btn()));
    expect(s().files[0]!.text).toContain('; A ← M[0040h]');
    expect(screen.getByRole('contentinfo', { name: 'Barra de estado' }).textContent).toMatch(
      /Se completaron 3 observaciones/,
    );
  });
});

describe('App: Exportar PDF', () => {
  it('el botón está deshabilitado sin ensamblar; abre el diálogo y Escape devuelve el foco', () => {
    render(<App fileService={fakeFiles()} />);
    const btn = () => screen.getByRole('button', { name: /Exportar PDF/ }) as HTMLButtonElement;
    expect(btn().disabled).toBe(true);
    expect(btn().title).toMatch(/Ensamblá primero/);
    key('F5');
    expect(btn().disabled).toBe(false);
    act(() => void fireEvent.click(btn()));
    const dlg = screen.getByRole('dialog', { name: 'Exportar PDF' });
    expect(dlg).toBeTruthy();
    act(() => void fireEvent.keyDown(dlg, { key: 'Escape' }));
    expect(screen.queryByRole('dialog', { name: 'Exportar PDF' })).toBeNull();
    expect(document.activeElement).toBe(btn());
  });
});

describe('App: ejercicios', () => {
  it('Resolver en el simulador muestra la barra del ejercicio y Comprobar responde', () => {
    render(<App />);
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Ejercicios' })));
    act(() => void fireEvent.click(screen.getByRole('button', { name: /GTP05 · 1/ })));
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Resolver en el simulador' })));
    expect(screen.getByRole('region', { name: 'Ejercicio activo' })).toBeTruthy();
    expect(document.querySelector('.main')!.hasAttribute('hidden')).toBe(false);
    expect(s().files.at(-1)!.name).toBe('gtp05-1.asm');
    act(() => void fireEvent.click(screen.getByRole('button', { name: 'Comprobar' })));
    expect(within(screen.getByRole('region', { name: 'Ejercicio activo' })).getByRole('status').textContent).toMatch(
      /Falla cuando 0040h = 3Ah/,
    );
  });
});

describe('App: celular', () => {
  it('muestra el aviso y debajo la documentación, sin controles del simulador', () => {
    mobile = true;
    render(<App />);
    expect(screen.getByText(/El simulador está pensado para computadora/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Documentación' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ensamblar/ })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Secciones' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Editor' })).toBeNull();
  });

  it('el índice va dentro de un <details> "Índice" y navegar muestra la página y lo cierra', () => {
    mobile = true;
    render(<App />);
    const summary = screen.getByText('Índice', { selector: 'summary' });
    const details = summary.closest('details')!;
    details.open = true;
    const nav = within(details).getByRole('navigation', { name: 'Documentación' });
    act(() => void fireEvent.click(within(nav).getByRole('link', { name: 'Banderas' })));
    expect(screen.getByRole('heading', { level: 1, name: 'Banderas' })).toBeTruthy();
    expect(details.open).toBe(false);
  });

  it('la regla compacta no fija un ancho mínimo mayor que un celular', () => {
    // Vitest no procesa el CSS (?raw llega vacío): se lee el archivo del disco.
    const docsCss = readFileSync(join(__dirname, 'docs/docs.css'), 'utf8');
    const rule = /\.docs\.compact[^{]*\{([^}]*)\}/.exec(docsCss);
    expect(rule, 'falta la regla .docs.compact').not.toBeNull();
    expect(rule![1]).not.toMatch(/min-width/);
  });
});

describe('App: tamaño del editor', () => {
  it('"Solo editor" oculta registros, banderas y memoria; "Equilibrado" los vuelve a mostrar', () => {
    localStorage.removeItem('sim8085.layout');
    render(<App />);
    expect(screen.getByRole('region', { name: 'Registros' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: 'Solo editor' }));
    expect(screen.queryByRole('region', { name: 'Registros' })).toBeNull();
    expect(localStorage.getItem('sim8085.layout')).toBe('foco');
    fireEvent.click(screen.getByRole('radio', { name: 'Equilibrado' }));
    expect(screen.getByRole('region', { name: 'Registros' })).toBeTruthy();
  });
});

