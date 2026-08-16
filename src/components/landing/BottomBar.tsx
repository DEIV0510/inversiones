"use client";

import Link from "next/link";
import { waGeneral } from "@/lib/whatsapp";
import { IconHome, IconTicket, IconWhatsApp } from "@/components/icons";

/** Pestaña encendida. Sin valor no se enciende ninguna (pedido, legales). */
export type PestanaActiva = "inicio" | "sorteos" | "boletas";

type Props = {
  whatsappNumber: string;
  /** Rifas configuradas sin WhatsApp: no se le muestra al comprador. */
  hideWhatsApp?: boolean;
  /**
   * Qué pestaña va encendida. La decide la PÁGINA, no el navegador.
   *
   * Antes se sacaba de usePathname(), y eso se rompe en cuanto la página se
   * precocina: al generarla no hay petición, así que la ruta no se resuelve y
   * el servidor pintaba todas las pestañas apagadas; al llegar al navegador
   * usePathname() sí devolvía "/" y encendía Inicio. Ese desacuerdo entre el
   * HTML servido y el primer pintado del cliente es un error de hidratación
   * (React #418) y obliga a rehacer toda la barra en el móvil del visitante.
   *
   * Cada página sabe cuál es la suya, así que se pasa como propiedad: el
   * servidor y el navegador pintan exactamente lo mismo, y da igual que la
   * página sea dinámica o cacheada.
   */
  activa?: PestanaActiva;
};

/** Pestaña: la activa se enciende en fucsia con un resplandor suave. */
function tabClass(activa: boolean) {
  return `relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-bold transition-colors ${
    activa ? "text-brand" : "text-fg-soft hover:text-fg"
  }`;
}

/** Marca superior de la pestaña activa. */
function TabMark({ activa }: { activa: boolean }) {
  return activa ? (
    <span
      aria-hidden="true"
      className="glow-brand-sm absolute inset-x-6 top-0 h-0.5 rounded-full bg-brand"
    />
  ) : null;
}

/** Icono dentro de un disco que resplandece cuando la pestaña está activa. */
function tabIconClass(activa: boolean) {
  return `flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
    activa ? "glow-brand-sm bg-brand/15 text-brand" : ""
  }`;
}

/**
 * Barra de acción inferior fija en móvil (sensación de app):
 * Inicio | Sorteos | Mis boletas | WhatsApp.
 */
export default function BottomBar({
  whatsappNumber,
  hideWhatsApp,
  activa,
}: Props) {
  const enInicio = activa === "inicio";
  const enSorteos = activa === "sorteos";
  const enBoletas = activa === "boletas";

  return (
    <nav
      aria-label="Acciones rápidas"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={`mx-auto grid max-w-md ${hideWhatsApp ? "grid-cols-3" : "grid-cols-4"}`}
      >
        <Link
          href="/#inicio"
          aria-current={enInicio ? "page" : undefined}
          className={tabClass(enInicio)}
        >
          <TabMark activa={enInicio} />
          <span className={tabIconClass(enInicio)}>
            <IconHome width={20} height={20} />
          </span>
          Inicio
        </Link>
        <Link
          href="/#sorteos"
          aria-current={enSorteos ? "page" : undefined}
          className={tabClass(enSorteos)}
        >
          <TabMark activa={enSorteos} />
          <span className={tabIconClass(enSorteos)}>
            <IconTicket width={20} height={20} />
          </span>
          Sorteos
        </Link>
        <Link
          href="/boletas"
          aria-current={enBoletas ? "page" : undefined}
          className={tabClass(enBoletas)}
        >
          <TabMark activa={enBoletas} />
          <span className={tabIconClass(enBoletas)}>
            <IconTicket width={20} height={20} />
          </span>
          Mis boletas
        </Link>
        {hideWhatsApp ? null : (
          <a
            href={waGeneral(whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-[11px] font-bold text-wa transition-colors hover:text-white"
          >
            <span className="glow-wa flex h-8 w-8 items-center justify-center rounded-full bg-wa text-white">
              <IconWhatsApp width={17} height={17} />
            </span>
            WhatsApp
          </a>
        )}
      </div>
    </nav>
  );
}
