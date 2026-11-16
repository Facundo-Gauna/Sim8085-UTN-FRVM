import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { parseHash, useSection } from './useSection';

afterEach(() => {
  location.hash = '';
});

describe('parseHash', () => {
  it.each([
    ['', 'simulador', []],
    ['#/ejercicios', 'ejercicios', []],
    ['#/ejercicios/', 'ejercicios', []],
    ['#/documentacion/registros', 'documentacion', ['registros']],
    ['#/toolbox', 'toolbox', []],
    ['#/x', 'simulador', []],
  ])('%j → %s %j', (hash, section, rest) => {
    expect(parseHash(hash)).toEqual({ section, rest });
  });
});

describe('useSection', () => {
  it('lee el hash actual y reacciona a hashchange', () => {
    location.hash = '#/toolbox';
    const { result } = renderHook(() => useSection());
    expect(result.current.section).toBe('toolbox');
    act(() => {
      location.hash = '#/ejercicios';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current.section).toBe('ejercicios');
  });

  it('go cambia el hash y la sección al instante', () => {
    const { result } = renderHook(() => useSection());
    act(() => result.current.go('documentacion', 'banderas'));
    expect(location.hash).toBe('#/documentacion/banderas');
    expect(result.current).toMatchObject({ section: 'documentacion', rest: ['banderas'] });
  });
});
