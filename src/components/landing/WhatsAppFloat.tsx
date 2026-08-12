import { waGeneral } from "@/lib/whatsapp";
import { IconWhatsApp } from "@/components/icons";

type Props = {
  whatsappNumber: string;
};

/**
 * Botón flotante de WhatsApp. En móvil la barra inferior ya incluye un
 * acceso a WhatsApp, por eso este botón solo se muestra en pantallas
 * grandes (lg+), evitando duplicar controles y tapar contenido.
 */
export default function WhatsAppFloat({ whatsappNumber }: Props) {
  return (
    <a
      href={waGeneral(whatsappNumber)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escríbenos por WhatsApp"
      className="wa-pulse fixed z-40 hidden h-14 w-14 items-center justify-center rounded-full bg-wa text-white transition-transform hover:scale-105 hover:bg-wa-dark lg:flex"
      style={{
        right: "max(1.25rem, env(safe-area-inset-right))",
        bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
      }}
    >
      <IconWhatsApp width={28} height={28} />
    </a>
  );
}
