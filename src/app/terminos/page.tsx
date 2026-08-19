import type { Metadata } from "next";
import LegalPageShell from "@/components/landing/LegalPageShell";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description:
    "Condiciones generales de participación en los sorteos de Inversiones D y S.",
};

/**
 * Condiciones generales. Describen lo que el sistema hace HOY: la compra se
 * cierra en esta página (números guardados un rato, código de participación,
 * números tapados hasta confirmar el pago), no "por WhatsApp" como decía la
 * versión anterior, que era de cuando el sitio era solo una vitrina.
 *
 * Ningún medio de pago se nombra: cada sorteo decide si cobra por WhatsApp o
 * en línea, y esta página es común a todos. Se remite siempre a "la página de
 * tu pedido", que es la única que sabe la verdad de esa rifa.
 *
 * El reglamento definitivo lo tiene que aportar el propietario: ese bloque
 * sigue marcado como pendiente y no se afirma ninguna autorización que no
 * exista.
 */
export default function TerminosPage() {
  return (
    <LegalPageShell kicker="Legal" title="Términos y condiciones">
      <p>
        Estas son las condiciones generales de participación en los sorteos
        organizados por Inversiones D y S (Sincelejo, Sucre, Colombia). Cada
        sorteo publica además sus propias condiciones en su página; si algo no
        coincide, mandan las condiciones de ese sorteo.
      </p>

      <h2>1. Cómo se participa</h2>
      <p>
        La participación se compra en esta página. Eliges el sorteo, escoges
        cuántos números quieres (o buscas el tuyo), dejas tus datos de contacto
        y completas el pago. Cada sorteo indica en su página el precio por
        número, la cantidad mínima y máxima por pedido y los paquetes
        disponibles; los descuentos por paquete los calcula siempre nuestro
        sistema a partir de lo publicado en ese sorteo.
      </p>

      <h2>2. Números guardados mientras pagas</h2>
      <p>
        Al confirmar tu pedido, los números quedan apartados a tu nombre
        durante el tiempo que indica ese sorteo. Si el pago no se confirma
        dentro de ese plazo, el pedido caduca y los números vuelven a estar
        disponibles para otras personas. Un mismo número no puede venderse dos
        veces: el sistema lo garantiza en el momento de apartarlo.
      </p>

      <h2>3. Pago y confirmación</h2>
      <p>
        La página de tu pedido te muestra los medios de pago habilitados para
        ese sorteo. La participación solo queda en firme cuando verificamos el
        pago. Si el pago llega después de que el pedido caducó y los números ya
        se vendieron a otra persona, el pedido queda registrado como no
        confirmado y nos comunicamos contigo para resolverlo; en ningún caso se
        entrega un número que ya es de alguien más.
      </p>

      <h2>4. Tus números y tu código de participación</h2>
      <p>
        Tus números se muestran cuando el pago está confirmado. Antes de eso
        ves cuántos números tienes apartados, el total y tu código de
        participación, pero los números permanecen ocultos: es la forma de
        evitar que alguien se quede con ellos sin pagar. Guarda tu código: con
        él (o con tu celular, tu correo o tu cédula) puedes consultar tus
        boletas en la sección &ldquo;Mis boletas&rdquo;, y es el dato con el que
        te identificamos ante cualquier reclamación.
      </p>

      <h2>5. Números premiados</h2>
      <p>
        Algunos sorteos publican números con premio instantáneo en su propia
        página. Si uno de esos números queda entre los que compraste y tu pago
        está confirmado, ganas ese premio; te lo indicamos en tu comprobante.
      </p>

      <h2>6. Sorteo y resultados</h2>
      <p>
        Cada sorteo indica su premio, su precio por número, su fecha y su
        porcentaje de avance. Los resultados se anuncian por nuestros canales
        oficiales y se publican en la sección de ganadores de esta página; el
        día del sorteo también puedes escribir el número que salió en
        &ldquo;Consultar número ganador&rdquo;. Ahí solo se muestra el nombre
        abreviado y el celular parcialmente oculto de quien compró ese número.
      </p>

      <h2>7. Entrega de premios</h2>
      <p>
        Nos comunicamos con la persona ganadora por los datos de contacto que
        dejó al comprar, y ahí se acuerdan las condiciones de entrega del
        premio.
      </p>

      <h2>8. Cambios y cancelaciones</h2>
      <p>
        Si un sorteo se aplaza o se cancela, lo anunciamos por nuestros canales
        oficiales y en la página del sorteo. Puedes escribirnos por los datos
        de contacto publicados en esta página para cualquier gestión sobre un
        pedido.
      </p>

      <h2>9. Reglamento específico</h2>
      <p className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 text-fg">
        [PENDIENTE DE CONFIGURAR] — Este espacio está reservado para el
        reglamento detallado de los sorteos y la información legal que
        Inversiones D y S defina con su asesor legal. Puede actualizarse sin
        modificar el resto del sitio.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Para cualquier duda sobre estas condiciones, escríbenos por los datos
        de contacto publicados en esta página.
      </p>
    </LegalPageShell>
  );
}
