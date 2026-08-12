import type { Metadata } from "next";
import LegalPageShell from "@/components/landing/LegalPageShell";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Condiciones generales de participación en los sorteos de Inversiones D y S.",
};

export default function TerminosPage() {
  return (
    <LegalPageShell kicker="Legal" title="Términos y condiciones">
      <p>
        Estas son las condiciones generales de participación en los sorteos
        organizados por Inversiones D y S (Sincelejo, Sucre, Colombia). El
        reglamento específico de cada sorteo se comparte directamente por
        WhatsApp antes de participar.
      </p>
      <h2>1. Participación</h2>
      <p>
        La participación se gestiona directamente por WhatsApp. Al escribirnos,
        recibirás las instrucciones del sorteo que te interesa: valor de la
        participación, forma de confirmación y fecha del sorteo.
      </p>
      <h2>2. Sorteos y resultados</h2>
      <p>
        Cada sorteo indica su premio, precio de participación, fecha y
        porcentaje de avance. Los resultados se anuncian por nuestros canales
        oficiales y se publican en la sección de ganadores de esta página.
      </p>
      <h2>3. Entrega de premios</h2>
      <p>
        Las condiciones de entrega del premio se informan directamente a la
        persona ganadora por WhatsApp.
      </p>
      <h2>4. Reglamento específico</h2>
      <p className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 text-fg">
        [PENDIENTE DE CONFIGURAR] — Este espacio está reservado para el
        reglamento detallado de los sorteos y la información legal que
        Inversiones D y S defina. Puede actualizarse sin modificar el resto del
        sitio.
      </p>
      <h2>5. Contacto</h2>
      <p>
        Para cualquier duda sobre estas condiciones, escríbenos por WhatsApp al
        número publicado en esta página.
      </p>
    </LegalPageShell>
  );
}
