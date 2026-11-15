import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from './useTheme';

const KEY = 'sim8085.theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
afterEach(() => vi.restoreAllMocks());

describe('useTheme', () => {
  it('sin preferencia: choice system y <html> sin data-theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('setChoice("dark") escribe data-theme y guarda la preferencia', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setChoice('dark'));
    expect(result.current.choice).toBe('dark');
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(KEY)).toBe('dark');
  });

  it('volver a system quita data-theme', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setChoice('light'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    act(() => result.current.setChoice('system'));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('lee la preferencia guardada', () => {
    localStorage.setItem(KEY, 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('con localStorage que lanza no rompe y funciona en memoria', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const { result } = renderHook(() => useTheme());
    expect(result.current.choice).toBe('system');
    act(() => result.current.setChoice('dark'));
    expect(result.current.choice).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
