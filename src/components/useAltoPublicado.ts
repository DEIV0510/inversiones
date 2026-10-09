"use client";

import { useEffect, type RefObject } from "react";

/**
 * Publica el alto de una franja FIJA del borde inferior en una variable CSS
 * de <html>, mientras esté visible. Es el mismo mecanismo del aviso de
 * demostración (--aviso-demo-h): con ese número el pie de página deja al
 * final un hueco igual y nada queda escondido detrás de la franja.
 *
 * Pasaba con la barra de compra/reserva del sorteo: con números escogidos se
 * quedaba encima de las últimas líneas del pie (contacto, enlaces legales) y
 * no había forma de llegar a leerlas.
 */
export function useAltoPublicado(
  ref: RefObject<HTMLElement | null>,
  variable: string,
  activo: boolean
): void {
  useEffect(() => {
    const raiz = document.documentElement;
    const limpiar = () => raiz.style.setProperty(variable, "0px");

    if (!activo) {
      limpiar();
      return;
    }
    const nodo = ref.current;
    if (!nodo) return;

    // offsetHeight no cambia con el translate de la animación de entrada:
    // se mide el alto real de la franja, no lo que asoma en ese instante.
    const medir = () => raiz.style.setProperty(variable, `${nodo.offsetHeight}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);

    return () => {
      observador.disconnect();
      limpiar();
    };
  }, [ref, variable, activo]);
}
