import type { Metadata } from "next";
import LegalPageShell from "@/components/landing/LegalPageShell";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description:
    "Política de tratamiento de datos personales de Inversiones D y S.",
};

/**
 * Aviso de privacidad. La versión anterior decía que los datos llegaban
 * "cuando nos escribes por WhatsApp"; hoy la compra ocurre en esta página y el
 * sistema guarda nombre, celular, correo opcional y cédula opcional, además
 * del detalle del pedido. Callarlo era el problema, así que aquí se enumera
 * exactamente lo que se guarda, para qué, con quién se comparte y qué se
 * publica de un ganador (nombre abreviado y celular enmascarado; nunca correo
 * ni cédula).
 *
 * La política definitiva de la Ley 1581 de 2012 la aporta el propietario: ese
 * bloque sigue marcado como pendiente.
 */
export default function PrivacidadPage() {
  return (
    <LegalPageShell kicker="Legal" title="Política de privacidad">
      <p>
        En Inversiones D y S (Sincelejo, Sucre, Colombia) respetamos tus datos
        personales. Esta página describe qué datos recogemos cuando compras
        números en nuestros sorteos, para qué los usamos y qué derechos tienes
        sobre ellos.
      </p>

      <h2>1. Datos que recogemos</h2>
      <p>
        Al comprar te pedimos tu <strong>nombre</strong> y tu{" "}
        <strong>número de celular</strong>. El <strong>correo</strong> y la{" "}
        <strong>cédula</strong> son opcionales: sirven para enviarte tus
        números y para que puedas encontrar tus boletas si no recuerdas con qué
        celular compraste. Junto a eso guardamos el detalle de tu compra: los
        números, la cantidad, el valor, la fecha, el estado del pedido y tu
        código de participación.
      </p>
      <p>
        <strong>No guardamos datos de tarjetas ni claves bancarias.</strong> Si
        pagas en línea, esos datos se manejan íntegramente en la pasarela de
        pagos y nunca pasan por esta página.
      </p>

      <h2>2. Para qué usamos tus datos</h2>
      <p>
        Únicamente para gestionar tu participación: apartar tus números,
        confirmar tu pago, entregarte tu comprobante, atender tus consultas,
        avisarte si resultas ganador y cumplir las obligaciones legales y
        contables del sorteo. Si dejaste tu correo, te enviamos a esa dirección
        tus números y tu código cuando el pago queda confirmado. No vendemos ni
        cedemos tus datos con fines publicitarios de terceros.
      </p>

      <h2>3. Consulta de boletas</h2>
      <p>
        En &ldquo;Mis boletas&rdquo; puedes consultar tus participaciones con un
        solo dato: tu celular, tu correo, tu cédula o tu código de compra. Esa
        consulta muestra tu nombre y tus pedidos, pero nunca devuelve tu
        celular, tu correo ni tu cédula, y los números de un pedido solo
        aparecen cuando el pago está confirmado.
      </p>

      <h2>4. Consulta del número ganador</h2>
      <p>
        El día del sorteo cualquier persona puede escribir el número que salió
        y ver a quién le pertenece. Ahí solo se publica el{" "}
        <strong>nombre abreviado</strong> (por ejemplo &ldquo;Wilson A.
        T.&rdquo;) y el <strong>celular parcialmente oculto</strong> (por
        ejemplo &ldquo;310 *** 0187&rdquo;): lo justo para que el dueño se
        reconozca. Nunca se muestra el correo ni la cédula de nadie.
      </p>

      <h2>5. Publicación de ganadores</h2>
      <p>
        La publicación del nombre completo o de la fotografía de una persona
        ganadora en esta página o en nuestras redes se realiza únicamente con
        su autorización.
      </p>

      <h2>6. Con quién se comparten</h2>
      <p>
        Solo con los proveedores necesarios para que la plataforma funcione:
        alojamiento del sitio, base de datos, pasarela de pagos y proveedor de
        envío de correos. Cada uno trata los datos por cuenta nuestra y para
        estas finalidades. También podrán entregarse a las autoridades cuando
        la ley lo exija.
      </p>

      <h2>7. Conservación</h2>
      <p>
        Conservamos los datos de tu participación mientras el sorteo esté
        vigente y después durante el tiempo necesario para atender
        reclamaciones y cumplir las obligaciones legales aplicables.
      </p>

      <h2>8. Tus derechos</h2>
      <p>
        Conforme a la Ley 1581 de 2012, puedes conocer, actualizar y rectificar
        tus datos, solicitar prueba de la autorización, ser informado sobre su
        uso, presentar quejas ante la Superintendencia de Industria y Comercio
        y, cuando proceda, solicitar su supresión. Para ejercerlos, escríbenos
        por los datos de contacto publicados en esta página.
      </p>

      <h2>9. Política completa</h2>
      <p className="rounded-xl border border-dashed border-brand/40 bg-brand/5 p-4 text-fg">
        [PENDIENTE DE CONFIGURAR] — Este espacio está reservado para la
        política de tratamiento de datos personales completa (Ley 1581 de 2012
        de Colombia) que Inversiones D y S defina con su asesor legal,
        incluyendo el responsable, la dirección de notificaciones y el
        procedimiento para atender consultas y reclamos.
      </p>

      <h2>10. Contacto</h2>
      <p>
        Para consultas sobre tus datos personales, escríbenos por los datos de
        contacto publicados en esta página.
      </p>
    </LegalPageShell>
  );
}
