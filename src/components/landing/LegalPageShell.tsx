import Header from "./Header";
import Footer from "./Footer";
import WhatsAppFloat from "./WhatsAppFloat";
import BottomBar from "./BottomBar";
import { getSettings } from "@/lib/settings";

type Props = {
  kicker: string;
  title: string;
  children: React.ReactNode;
};

export default async function LegalPageShell({ kicker, title, children }: Props) {
  const settings = await getSettings();
  return (
    <>
      <Header
        whatsappNumber={settings.whatsapp_number}
        companyName={settings.company_name}
      />
      <main className="pb-20 pt-28 lg:pt-36">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
            {kicker}
          </p>
          <h1 className="mt-3 font-display text-3xl font-extrabold uppercase leading-tight text-fg sm:text-4xl">
            {title}
          </h1>
          <div className="mt-8 flex flex-col gap-6 text-sm leading-relaxed text-fg-soft sm:text-base [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-extrabold [&_h2]:uppercase [&_h2]:text-fg [&_h2]:mt-4">
            {children}
          </div>
        </div>
      </main>
      <Footer settings={settings} />
      <WhatsAppFloat whatsappNumber={settings.whatsapp_number} />
      <BottomBar whatsappNumber={settings.whatsapp_number} />
    </>
  );
}
