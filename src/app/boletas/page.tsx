import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import BottomBar from "@/components/landing/BottomBar";
import LookupForm from "@/components/public/LookupForm";
import { getSettings } from "@/lib/settings";
import { hayRifasConWhatsApp } from "@/lib/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis boletas",
  description: "Consulta tus boletas con tu teléfono y código de participación.",
};

export default async function BoletasPage() {
  // "Mis boletas" no pertenece a una rifa concreta: se llega desde la cabecera
  // de cualquier sorteo. Por eso solo se ofrece WhatsApp si al menos una rifa
  // pública lo tiene activado; si ninguna lo usa, aquí no aparece ni el texto.
  const [settings, conWhatsApp] = await Promise.all([
    getSettings(),
    hayRifasConWhatsApp(),
  ]);
  const ocultarWhatsApp = !conWhatsApp;

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
              Consulta
            </p>
            <h1 className="title-gradient mt-2 font-display text-3xl font-black uppercase leading-[1.06] sm:text-4xl">
              Mis boletas
            </h1>
            <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-fg-soft">
              Ingresa tu teléfono y el código de participación que aparece en tu
              comprobante.
            </p>
          </div>
          <LookupForm
            /* El número solo viaja al cliente si esta pantalla puede ofrecerlo. */
            whatsappNumber={ocultarWhatsApp ? undefined : settings.whatsapp_number}
            hideWhatsApp={ocultarWhatsApp}
          />
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
