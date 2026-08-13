import type { Metadata } from "next";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import BottomBar from "@/components/landing/BottomBar";
import LookupForm from "@/components/public/LookupForm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mis boletas",
  description: "Consulta tus boletas con tu teléfono y código de participación.",
};

export default async function BoletasPage() {
  const settings = await getSettings();
  return (
    <>
      <Header
        whatsappNumber={settings.whatsapp_number}
        companyName={settings.company_name}
      />
      <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-24 sm:px-6 lg:pt-32">
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">
            Consulta
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-black uppercase text-fg">
            Mis boletas
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-fg-soft">
            Ingresa tu WhatsApp y el código de participación que aparece en tu
            comprobante.
          </p>
        </div>
        <LookupForm whatsappNumber={settings.whatsapp_number} />
      </main>
      <Footer settings={settings} />
      <BottomBar whatsappNumber={settings.whatsapp_number} />
    </>
  );
}
