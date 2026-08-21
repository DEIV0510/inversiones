import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import BottomBar from "@/components/landing/BottomBar";
import OrderView from "@/components/public/OrderView";
import { boldAmountSupported, boldButtonConfig } from "@/lib/bold";
import { prisma } from "@/lib/db";
import { leCorreoAlConfirmar } from "@/lib/email";
import {
  confirmOrderPayment,
  expireOverdueOrders,
  getPrizesWon,
  isOrderExpired,
} from "@/lib/engine/orders";
import { formatNumber, formatNumbers } from "@/lib/numbers";
import { orderWhatsAppMessage } from "@/lib/notifications";
import { pasarelaDeRifa } from "@/lib/pasarela";
import { getSettings } from "@/lib/settings";
import {
  checkoutUrl,
  findTransactionByReference,
  isWompiConfigured,
  paymentReference,
  transactionMatchesOrder,
} from "@/lib/wompi";

export const dynamic = "force-dynamic";

/**
 * La descripción se escribe aquí a propósito. Sin ella esta página heredaba la
 * del sitio entero ("…participa directamente por WhatsApp…"), así que en una
 * rifa que cobra SOLO por pasarela WhatsApp seguía nombrado en el código de la
 * pantalla de pago aunque el comprador no viera ni un botón. Una página de
 * pedido es privada (noindex): no tiene por qué llevar el reclamo comercial de
 * la portada, y menos uno que nombra un canal de cobro que esta rifa puede
 * tener apagado.
 */
export const metadata: Metadata = {
  title: "Tu pedido",
  description: "Detalle de tu pedido y estado de tu pago.",
  openGraph: {
    title: "Tu pedido",
    description: "Detalle de tu pedido y estado de tu pago.",
  },
  robots: { index: false, follow: false },
};

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { code } = await params;
  const consulta = await searchParams;
  const enviar = typeof consulta.enviar === "string" ? consulta.enviar : undefined;
  // Bold devuelve al comprador con sus propios parámetros (bold-order-id,
  // bold-tx-status…). Solo se usan para saber que VIENE DE VOLVER y avisarle
  // de que estamos confirmando: el dinero lo decide el servidor con el
  // webhook, nunca lo que traiga la dirección.
  const volviendoDePasarela = Object.keys(consulta).some((clave) =>
    clave.startsWith("bold-")
  );

  let order = await prisma.order.findUnique({
    where: { code },
    include: { raffle: true, participant: true },
  });
  if (!order) notFound();

  // Verificación de respaldo contra Wompi (caso redirect): consulta directa
  // a la pasarela, nunca parámetros del navegador.
  if (order.status === "PENDING" && isWompiConfigured()) {
    const tx = await findTransactionByReference(paymentReference(code));
    if (tx?.status === "APPROVED" && transactionMatchesOrder(tx, order)) {
      await confirmOrderPayment({
        orderId: order.id,
        provider: "wompi",
        providerTxId: tx.id,
        reference: tx.reference,
        amount: Math.round(tx.amount_in_cents / 100),
        raw: tx,
      });
      order = await prisma.order.findUnique({
        where: { code },
        include: { raffle: true, participant: true },
      });
      if (!order) notFound();
    }
  }

  // Expiración oportunista: si esta orden ya venció, ejecutar el barrido.
  if (isOrderExpired(order)) {
    await expireOverdueOrders();
    order = await prisma.order.findUnique({
      where: { code },
      include: { raffle: true, participant: true },
    });
    if (!order) notFound();
  }

  const settings = await getSettings();
  // Los números SOLO se revelan con el pago confirmado. Mientras el pedido
  // no esté pagado ni siquiera se calculan: así no viajan al navegador y no
  // se pueden leer abriendo el código de la página. Los números siguen
  // apartados en la base de datos exactamente igual que antes.
  const pagada = order.status === "PAID";
  const numbers = pagada
    ? formatNumbers(JSON.parse(order.numbersJson), order.raffle.digits)
    : [];
  // Premios instantáneos ganados (ticket premiado). Solo cuenta lo que ganó
  // ESTE pedido y ya está pagado; además se cruza con los números de la
  // boleta para poder pintar en verde la ficha exacta que resultó premiada.
  const numerosDelPedido = new Set(numbers);
  const prizesWon = pagada
    ? (await getPrizesWon(order.id))
        .map((p) => ({
          number: formatNumber(p.number, order.raffle.digits),
          prize: p.prize,
        }))
        .filter((p) => numerosDelPedido.has(p.number))
    : [];

  // El mensaje de WhatsApp lleva el código, la cantidad y el total: nunca los
  // números… salvo los ya PREMIADOS de un pedido pagado, que el comprador ya
  // tiene delante y son justo lo que va a reclamar. Con el pago confirmado el
  // cierre del mensaje cambia: pedir el pago de algo ya pagado no tenía
  // sentido, y ese mismo botón es el que la página le señala al ganador.
  const whatsappUrl = orderWhatsAppMessage({
    businessPhone: settings.whatsapp_number,
    participantName: order.participant.name,
    raffleTitle: order.raffle.title,
    orderCode: order.code,
    quantity: order.quantity,
    total: order.total,
    pagada,
    premios: prizesWon,
  });

  // Datos del negocio para el respaldo de pago (cuando la rifa se queda sin
  // WhatsApp y sin pasarela). El WhatsApp NO viaja aquí a propósito: si el
  // dueño lo apagó en esta rifa, no puede reaparecer por el respaldo. Solo
  // van el nombre, la ubicación y las redes que él mismo publicó.
  const contacto = {
    companyName: settings.company_name,
    location: settings.location,
    redes: (
      [
        { tipo: "facebook", url: settings.facebook_url },
        { tipo: "instagram", url: settings.instagram_url },
        { tipo: "tiktok", url: settings.tiktok_url },
      ] as const
    )
      .filter((red) => red.url.trim() !== "")
      .map((red) => ({ tipo: red.tipo, url: red.url.trim() })),
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5236";
  const urlRetorno = `${siteUrl}/pedido/${order.code}`;

  // ── Pago en línea ────────────────────────────────────────────────────
  // Quién cobra lo decide la capa común de pasarelas: hacen falta las dos
  // cosas, llaves configuradas en el entorno Y el interruptor `gatewayCheckout`
  // encendido en esta rifa (el gemelo del de WhatsApp). Con las dos pasarelas
  // configuradas manda Bold, que es la cuenta que el dueño tiene de verdad;
  // nunca se pintan los dos botones a la vez.
  const pasarela =
    order.status === "PENDING" ? pasarelaDeRifa(order.raffle) : null;

  // El monto SIEMPRE sale de la orden guardada, jamás del navegador. La firma
  // de integridad la calcula el servidor en src/lib/bold.ts: al navegador solo
  // bajan la llave de IDENTIDAD y ese hash.
  const boldButton =
    pasarela === "bold" && boldAmountSupported(order.total)
      ? boldButtonConfig({
          orderCode: order.code,
          totalCop: order.total,
          redirectUrl: urlRetorno,
          // Es lo que el comprador lee en el checkout de Bold (2 a 100).
          description: `Pedido ${order.code} - ${order.raffle.title}`,
          customerName: order.participant.name,
          customerPhone: order.participant.phone,
          customerEmail: order.participant.email,
        })
      : null;

  const wompiUrl =
    pasarela === "wompi"
      ? checkoutUrl({
          orderCode: order.code,
          totalCop: order.total,
          redirectUrl: urlRetorno,
          customerName: order.participant.name,
          customerPhone: order.participant.phone,
        })
      : null;

  // Bold no cobra por debajo de $1.000 COP (ni por encima de sus topes). Sin
  // botón y sin explicación, el comprador se quedaría mirando la pantalla.
  const boldMontoNoSoportado = pasarela === "bold" && !boldButton;

  // ¿Le prometemos el correo en la pantalla de pago? La regla completa vive
  // en src/lib/email.ts, que es quien de verdad envía: así la pantalla no
  // puede prometer un correo que el envío luego no manda.
  const avisaPorCorreo = await leCorreoAlConfirmar(order.participant.email);

  return (
    <>
      <Header
        /* El número solo viaja al navegador si esta pantalla puede ofrecerlo
           (misma regla que LookupForm en /boletas): con el cobro por WhatsApp
           apagado no queda ni rastro suyo en el HTML de la página. */
        whatsappNumber={
          order.raffle.whatsappCheckout ? settings.whatsapp_number : ""
        }
        companyName={settings.company_name}
        hideWhatsApp={!order.raffle.whatsappCheckout}
      />
      <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-20 sm:px-6 lg:pt-28">
        <OrderView
          order={{
            code: order.code,
            status: order.status,
            raffleTitle: order.raffle.title,
            raffleSlug: order.raffle.slug,
            prize: order.raffle.prize,
            drawDateText: order.raffle.drawDateText,
            participantName: order.participant.name,
            numbers,
            // Cifras de la rifa: la boleta sin pagar dibuja un punto por
            // cifra. No revela nada (no dice qué números son, solo de qué
            // tamaño), y sin este dato la ficha pintaba siempre 5 puntos.
            digits: order.raffle.digits,
            quantity: order.quantity,
            unitPrice: order.unitPrice,
            total: order.total,
            reservedUntil: order.reservedUntil?.toISOString() ?? null,
            createdAt: order.createdAt.toISOString(),
            paidAt: order.paidAt?.toISOString() ?? null,
            companyName: settings.company_name,
            prizesWon,
          }}
          whatsappUrl={order.raffle.whatsappCheckout ? whatsappUrl : null}
          wompiUrl={wompiUrl}
          boldButton={boldButton}
          boldMontoNoSoportado={boldMontoNoSoportado}
          volviendoDePasarela={volviendoDePasarela}
          contacto={contacto}
          autoEnviarWhatsApp={enviar === "1" && order.raffle.whatsappCheckout}
          avisaPorCorreo={avisaPorCorreo}
        />
      </main>
      <Footer settings={settings} hideWhatsApp={!order.raffle.whatsappCheckout} />
      <BottomBar
        whatsappNumber={
          order.raffle.whatsappCheckout ? settings.whatsapp_number : ""
        }
        hideWhatsApp={!order.raffle.whatsappCheckout}
      />
    </>
  );
}
