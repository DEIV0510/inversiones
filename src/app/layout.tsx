import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import DemoBanner from "@/components/landing/DemoBanner";
import { getSettings } from "@/lib/settings";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5236";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Inversiones D y S | Sorteos de Dinero y Motocicletas en Sincelejo",
    template: "%s | Inversiones D y S",
  },
  description:
    "Sorteos de dinero en efectivo y motocicletas en Sincelejo, Sucre. Conoce los sorteos activos, su porcentaje de avance y participa directamente por WhatsApp con Inversiones D y S.",
  keywords: [
    "sorteos",
    "rifas",
    "Sincelejo",
    "Sucre",
    "Colombia",
    "motocicletas",
    "dinero en efectivo",
    "Inversiones D y S",
  ],
  openGraph: {
    type: "website",
    locale: "es_CO",
    siteName: "Inversiones D y S",
    title: "Inversiones D y S | Sorteos de Dinero y Motocicletas",
    description:
      "Conoce nuestros sorteos, descubre los próximos premios y participa directamente por WhatsApp.",
    images: [{ url: "/img/og.png", width: 1200, height: 630 }],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07060f",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings();
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${archivo.variable} ${inter.variable}`}
    >
      <body>
        <script
          // Activa las animaciones de aparición solo cuando hay JavaScript,
          // antes del primer render para evitar parpadeos.
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add("js");`,
          }}
        />
        {children}
        <DemoBanner active={settings.demo_mode === "1"} />
      </body>
    </html>
  );
}
