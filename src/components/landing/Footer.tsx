import Link from "next/link";
import type { SiteSettings } from "@/lib/settings";
import { waGeneral } from "@/lib/whatsapp";
import {
  IconFacebook,
  IconInstagram,
  IconMapPin,
  IconTikTok,
  IconWhatsApp,
} from "@/components/icons";

const NAV_LINKS = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#sorteos", label: "Sorteos" },
  { href: "/#premios", label: "Premios" },
  { href: "/#como-participar", label: "Cómo participar" },
  { href: "/#faq", label: "Preguntas frecuentes" },
  { href: "/#contacto", label: "Contacto" },
];

const LEGAL_LINKS = [
  { href: "/terminos", label: "Términos y condiciones" },
  { href: "/privacidad", label: "Política de privacidad" },
];

type Props = {
  settings: SiteSettings;
};

export default function Footer({ settings }: Props) {
  const socials = [
    { url: settings.facebook_url, label: "Facebook", icon: IconFacebook },
    { url: settings.instagram_url, label: "Instagram", icon: IconInstagram },
    { url: settings.tiktok_url, label: "TikTok", icon: IconTikTok },
  ].filter((s) => s.url.trim() !== "");

  return (
    <footer className="border-t border-line bg-bg2 pb-20 text-fg-soft lg:pb-0">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr] lg:px-8">
        <div>
          <p className="flex items-center gap-2.5 font-display">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/logo-mark.webp"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-line"
            />
            <span className="text-base font-extrabold uppercase tracking-wide text-fg">
              Inversiones <span className="text-brand">D y S</span>
            </span>
          </p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed">
            Sorteos de dinero en efectivo y motocicletas con atención directa
            por WhatsApp.
          </p>
          <p className="mt-4 flex items-center gap-2 text-sm">
            <IconMapPin width={16} height={16} className="shrink-0 text-brand" />
            {settings.location}
          </p>
          <a
            href={waGeneral(settings.whatsapp_number)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-fg transition-colors hover:text-wa"
          >
            <IconWhatsApp width={16} height={16} className="shrink-0 text-wa" />
            WhatsApp: {settings.whatsapp_display}
          </a>
          {socials.length > 0 ? (
            <div className="mt-5 flex gap-3">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-line text-fg-soft transition-colors hover:border-brand hover:text-fg"
                >
                  <social.icon width={19} height={19} />
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <nav aria-label="Enlaces del sitio">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-fg">
            Navegación
          </h3>
          <ul className="mt-4 grid gap-2.5">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm transition-colors hover:text-fg"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Enlaces legales">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-fg">
            Legal
          </h3>
          <ul className="mt-4 grid gap-2.5">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm transition-colors hover:text-fg"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs sm:flex-row sm:px-6 lg:px-8">
          <p>
            © {new Date().getFullYear()} {settings.company_name}. Todos los
            derechos reservados.
          </p>
          <Link
            href="/admin"
            className="text-fg-faint transition-colors hover:text-fg-soft"
          >
            Acceso administrativo
          </Link>
        </div>
      </div>
    </footer>
  );
}
