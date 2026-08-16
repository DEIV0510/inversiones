import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import BottomBar from "@/components/landing/BottomBar";
import WinnerLookup, {
  type RifaConsultable,
} from "@/components/public/WinnerLookup";
import { getPublicRaffles, hayRifasConWhatsApp } from "@/lib/public";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consultar número ganador",
  description:
    "Escribe el número que salió en el sorteo y mira a quién le pertenece.",
};

export default async function GanadorPage() {
  // Igual que "Mis boletas": esta pantalla no pertenece a una rifa concreta,
  // así que solo puede ofrecer WhatsApp si alguna rifa pública lo usa.
  const [settings, conWhatsApp, rifas] = await Promise.all([
    getSettings(),
    hayRifasConWhatsApp(),
    getPublicRaffles(),
  ]);
  const ocultarWhatsApp = !conWhatsApp;

  // Al cliente solo viaja lo indispensable para escribir el número: título,
  // cifras y rango. Ni un dato de inventario.
  const consultables: RifaConsultable[] = rifas.map((r) => ({
    slug: r.slug,
    title: r.title,
    digits: r.digits,
    totalNumbers: r.totalNumbers,
  }));

  return (
    <>
      <Header
        whatsappNumber={settings.whatsapp_number}
        companyName={settings.company_name}
        hideWhatsApp={ocultarWhatsApp}
      />
      <main className="relative mx-auto w-full max-w-2xl px-4 pb-28 pt-24 sm:px-6 lg:pt-32">
        {/* Trama de puntos + halo fucsia: profundidad como en el sorteo. */}
        <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[520px] max-w-full -translate-x-1/2 rounded-full bg-brand/20 blur-[120px]"
        />
        <div className="relative">
          <div className="text-center">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-brand">
              <span
                aria-hidden="true"
                className="glow-brand-sm h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
              />
              Resultados
            </p>
            <h1 className="title-gradient mt-2 font-display text-3xl font-black uppercase leading-[1.06] sm:text-4xl">
              ¿Quién ganó?
            </h1>
            <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-fg-soft">
              Escribe el número que salió en el sorteo y te decimos a quién le
              pertenece.
            </p>
          </div>
          <WinnerLookup rifas={consultables} />
        </div>
      </main>
      <Footer settings={settings} hideWhatsApp={ocultarWhatsApp} />
      <BottomBar
        whatsappNumber={settings.whatsapp_number}
        hideWhatsApp={ocultarWhatsApp}
      />
    </>
  );
}
