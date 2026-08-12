import type { Metadata } from "next";
import LegalPageShell from "@/components/landing/LegalPageShell";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Política de tratamiento de datos personales de Inversiones D y S.",
};

export default function PrivacidadPage() {
  return (
    <LegalPageShell kicker="Legal" title="Política de privacidad">
      <p>
        En Inversiones D y S respetamos tus datos personales. Esta página
        describe, de forma general, cómo se tratan los datos de las personas
        que nos contactan.
      </p>
      <h2>1. Datos que recibimos</h2>
      <p>
        Cuando nos escribes por WhatsApp recibimos los datos que tú decidas
        compartir (nombre, número de contacto y la información necesaria para
        gestionar tu participación).
      </p>
      <h2>2. Uso de los datos</h2>
      <p>
        Usamos tus datos únicamente para gestionar tu participación en los
        sorteos, confirmar resultados y comunicarnos contigo.
      </p>
      <h2>3. Publicación de ganadores</h2>
      <p>
        La publicación del nombre o fotografía de una persona ganadora en esta
        página se realiza únicamente con su autorización.
      </p>
      <h2>4. Política completa</h2>
      <p className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 text-fg">
        [PENDIENTE DE CONFIGURAR] — Este espacio está reservado para la
        política de tratamiento de datos personales completa (Ley 1581 de 2012
        de Colombia) que Inversiones D y S defina con su asesor legal.
      </p>
      <h2>5. Contacto</h2>
      <p>
        Para consultas sobre tus datos personales, escríbenos por WhatsApp al
        número publicado en esta página.
      </p>
    </LegalPageShell>
  );
}
