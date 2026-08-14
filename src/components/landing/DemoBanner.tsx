"use client";

import { usePathname } from "next/navigation";

/**
 * Aviso de sitio en demostración. Se activa desde el panel (Configuración →
 * Modo demostración) y solo aparece en las páginas públicas: así los
 * sorteos de ejemplo nunca se confunden con sorteos reales.
 */
export default function DemoBanner({ active }: { active: boolean }) {
  const pathname = usePathname();
  if (!active || pathname.startsWith("/admin")) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-16 z-40 border-y border-brand/40 bg-brand/15 px-4 py-2 backdrop-blur lg:bottom-0 lg:pr-24"
    >
      <p className="mx-auto max-w-4xl text-center text-[11px] font-bold uppercase leading-relaxed tracking-[0.12em] text-fg">
        Sitio en demostración · los sorteos mostrados son de ejemplo
      </p>
    </div>
  );
}
