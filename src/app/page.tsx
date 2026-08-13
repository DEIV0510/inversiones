import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import RafflesSection from "@/components/landing/RafflesSection";
import PrizesSection from "@/components/landing/PrizesSection";
import AboutSection from "@/components/landing/AboutSection";
import HowItWorks from "@/components/landing/HowItWorks";
import WinnersSection from "@/components/landing/WinnersSection";
import FaqSection from "@/components/landing/FaqSection";
import LegalSection from "@/components/landing/LegalSection";
import FinalCta from "@/components/landing/FinalCta";
import Footer from "@/components/landing/Footer";
import WhatsAppFloat from "@/components/landing/WhatsAppFloat";
import BottomBar from "@/components/landing/BottomBar";
import { getPublicRaffles, getPublishedWinners } from "@/lib/raffles";
import { getSettings } from "@/lib/settings";
import { getFaqItems } from "@/lib/faq";
import type { RaffleView, WinnerView } from "@/lib/types";

// La landing se cachea y se revalida al publicar cambios desde el panel
// (revalidatePath) o, como respaldo, cada 5 minutos.
export const revalidate = 300;

export default async function HomePage() {
  const [raffles, winners, settings] = await Promise.all([
    getPublicRaffles(),
    getPublishedWinners(),
    getSettings(),
  ]);

  // Proyección pública: nunca exponer totalNumbers ni campos internos.
  const publicRaffles: RaffleView[] = raffles.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    prize: r.prize,
    imageUrl: r.imageUrl,
    priceCop: r.priceCop,
    drawDateText: r.drawDateText,
    progressPct: r.progressPct,
    status: r.status,
  }));

  const publicWinners: WinnerView[] = winners.map((w) => ({
    id: w.id,
    name: w.name,
    prize: w.prize,
    raffleTitle: w.raffleTitle,
    photoUrl: w.photoUrl,
    drawnAtText: w.drawnAtText,
    isDemo: w.isDemo,
  }));

  const featured =
    publicRaffles.find((r) => r.status === "active") ?? publicRaffles[0] ?? null;
  const faqItems = getFaqItems(settings);

  // La dirección del dato estructurado se deriva de la ubicación editable
  // desde el panel ("Ciudad, Departamento, País").
  const locationParts = settings.location.split(",").map((p) => p.trim());
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.company_name,
    description: `Sorteos de dinero en efectivo y motocicletas en ${settings.location}.`,
    address: {
      "@type": "PostalAddress",
      addressLocality: locationParts[0] || settings.location,
      addressRegion: locationParts[1] || "",
      addressCountry: "CO",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: `+${settings.whatsapp_number}`,
      url: `https://wa.me/${settings.whatsapp_number}`,
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <>
      <Header
        whatsappNumber={settings.whatsapp_number}
        companyName={settings.company_name}
      />
      <main>
        <Hero
          whatsappNumber={settings.whatsapp_number}
          location={settings.location}
          featured={featured}
        />
        <RafflesSection
          raffles={publicRaffles}
          whatsappNumber={settings.whatsapp_number}
        />
        <PrizesSection />
        <AboutSection
          whatsappNumber={settings.whatsapp_number}
          whatsappDisplay={settings.whatsapp_display}
          location={settings.location}
        />
        <HowItWorks />
        <WinnersSection winners={publicWinners} />
        <FaqSection items={faqItems} />
        <LegalSection />
        <FinalCta whatsappNumber={settings.whatsapp_number} />
      </main>
      <Footer settings={settings} />
      <WhatsAppFloat whatsappNumber={settings.whatsapp_number} />
      <BottomBar whatsappNumber={settings.whatsapp_number} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}
