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
import { jsonLdSeguro } from "@/lib/jsonld";
import { getPublicRaffles, getPublishedWinners } from "@/lib/public";
import { getSettings } from "@/lib/settings";
import { getFaqItems } from "@/lib/faq";

// La portada consulta el estado real de las rifas (porcentaje automático):
// se sirve dinámica para reflejar ventas al instante.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [raffles, winners, settings] = await Promise.all([
    getPublicRaffles(),
    getPublishedWinners(),
    getSettings(),
  ]);

  const featured =
    raffles.find((r) => r.status === "ACTIVE") ?? raffles[0] ?? null;
  const faqItems = getFaqItems(settings);

  const locationParts = settings.location.split(",").map((p) => p.trim());
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: settings.company_name,
    description: `Plataforma de sorteos de dinero en efectivo y motocicletas en ${settings.location}.`,
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
          raffles={raffles}
          whatsappNumber={settings.whatsapp_number}
        />
        <PrizesSection />
        <AboutSection
          whatsappNumber={settings.whatsapp_number}
          whatsappDisplay={settings.whatsapp_display}
          location={settings.location}
        />
        <HowItWorks />
        <WinnersSection winners={winners} />
        <FaqSection items={faqItems} />
        <LegalSection />
        <FinalCta whatsappNumber={settings.whatsapp_number} />
      </main>
      <Footer settings={settings} />
      <WhatsAppFloat whatsappNumber={settings.whatsapp_number} />
      <BottomBar whatsappNumber={settings.whatsapp_number} />
      {/* JSON-LD siempre con jsonLdSeguro: lleva datos de Configuración y un
          "</script>" ahí dentro rompería la etiqueta y ejecutaría código. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdSeguro(faqJsonLd) }}
      />
    </>
  );
}
