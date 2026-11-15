import { describe, expect, it } from 'vitest';
import { hasUnsavedContent, installUnloadGuard } from './unloadGuard';

let assigned: unknown[] = [];

function fire(): BeforeUnloadEvent {
  assigned = [];
  const e = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  Object.defineProperty(e, 'returnValue', {
    set: (v) => assigned.push(v),
    get: () => '',
    configurable: true,
  });
  window.dispatchEvent(e);
  return e;
}

describe('installUnloadGuard', () => {
  it('previene la salida cuando hay contenido', () => {
    const off = installUnloadGuard(() => true);
    const e = fire();
    expect(e.defaultPrevented).toBe(true);
    expect(assigned).toEqual(['']);
    off();
  });
  it('no previene sin contenido', () => {
    const off = installUnloadGuard(() => false);
    expect(fire().defaultPrevented).toBe(false);
    off();
  });
  it('el desinstalador quita el manejador', () => {
    const off = installUnloadGuard(() => true);
    off();
    expect(fire().defaultPrevented).toBe(false);
  });
});

describe('hasUnsavedContent', () => {
  it('detecta texto no vacío', () => {
    expect(hasUnsavedContent([{ text: '  \n' }, { text: 'MVI A,1' }])).toBe(true);
    expect(hasUnsavedContent([{ text: '  \n' }, { text: '' }])).toBe(false);
    expect(hasUnsavedContent([])).toBe(false);
  });
});
