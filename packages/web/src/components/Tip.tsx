import { useCallback, useState, type FocusEvent, type MouseEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Tip.css';

export interface TipContent {
  /** Nombre en negrita (p. ej. «A · Acumulador»). */
  title: string;
  /** Explicación en lenguaje simple. */
  body: string;
  /** Líneas con el valor actual, el valor anterior, etc. */
  detail?: string[];
}

interface TipPos {
  left: number;
  top: number;
}

/**
 * Cartel de ayuda al pasar el mouse (o enfocar con el teclado), con el mismo aspecto que el del editor.
 * Va en un portal con posición fija: los paneles tienen scroll y recortarían uno absoluto.
 * Devuelve las props del elemento que lo dispara y el cartel a renderizar.
 */
export function useTip(content: TipContent | null): { props: Record<string, unknown>; bubble: ReactNode } {
  const [pos, setPos] = useState<TipPos | null>(null);

  const show = useCallback((el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    // Centrado sobre el elemento; se acota a la ventana en el render.
    setPos({ left: r.left + r.width / 2, top: r.top });
  }, []);
  const hide = useCallback(() => setPos(null), []);

  if (!content) return { props: {}, bubble: null };

  const props = {
    tabIndex: 0,
    onMouseEnter: (e: MouseEvent<HTMLElement>) => show(e.currentTarget),
    onMouseLeave: hide,
    onFocus: (e: FocusEvent<HTMLElement>) => show(e.currentTarget),
    onBlur: hide,
    onKeyDown: (e: { key: string }) => {
      if (e.key === 'Escape') hide();
    },
  };

  const bubble =
    pos &&
    createPortal(
      <div
        className="tip"
        role="tooltip"
        style={{
          left: Math.min(Math.max(pos.left, 150), window.innerWidth - 150),
          top: pos.top,
        }}
      >
        <div className="tip-title">{content.title}</div>
        <div className="tip-body">{content.body}</div>
        {content.detail?.map((d) => (
          <div className="tip-detail" key={d}>
            {d}
          </div>
        ))}
      </div>,
      document.body,
    );

  return { props, bubble };
}
