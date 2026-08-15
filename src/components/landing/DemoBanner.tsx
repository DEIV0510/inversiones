"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Aviso de sitio en demostración. Se activa desde el panel (Configuración →
 * Modo demostración) y solo aparece en las páginas públicas: así los
 * sorteos de ejemplo nunca se confunden con sorteos reales.
 *
 * Va fijo abajo, justo encima de la navegación del móvil, y anota su propio
 * alto en `--aviso-demo-h`. Gracias a eso la barra de compra del sorteo se
 * coloca por encima del aviso y su botón "Continuar" sigue siendo pulsable.
 */
export default function DemoBanner({ active }: { active: boolean }) {
  const pathname = usePathname();
  const franja = useRef<HTMLDivElement>(null);
  const visible = active && !pathname.startsWith("/admin");

  useEffect(() => {
    const raiz = document.documentElement;
    const limpiar = () => raiz.style.setProperty("--aviso-demo-h", "0px");

    if (!visible) {
      limpiar();
      return;
    }
    const nodo = franja.current;
    if (!nodo) return;

    const medir = () =>
      raiz.style.setProperty("--aviso-demo-h", `${nodo.offsetHeight}px`);

    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);

    return () => {
      observador.disconnect();
      limpiar();
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={franja}
      role="status"
      style={{ bottom: "var(--barra-inferior-h)" }}
      className="fixed inset-x-0 z-40 border-y border-brand/40 bg-brand/15 px-4 py-2 backdrop-blur lg:pr-24"
    >
      <p className="mx-auto max-w-4xl text-center text-[11px] font-bold uppercase leading-relaxed tracking-[0.12em] text-fg">
        Sitio en demostración · los sorteos mostrados son de ejemplo
      </p>
    </div>
  );
}
