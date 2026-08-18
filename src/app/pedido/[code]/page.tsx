import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import BottomBar from "@/components/landing/BottomBar";
import OrderView from "@/components/public/OrderView";
import { prisma } from "@/lib/db";
import {
  confirmOrderPayment,
  expireOverdueOrders,
  getPrizesWon,
  isOrderExpired,
} from "@/lib/engine/orders";
import { formatNumber, formatNumbers } from "@/lib/numbers";
import { orderWhatsAppMessage } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import {
  checkoutUrl,
  findTransactionByReference,
  isWompiConfigured,
  paymentReference,
  transactionMatchesOrder,
} from "@/lib/wompi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false },
};

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ enviar?: string }>;
}) {
  const { code } = await params;
  const { enviar } = await searchParams;

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
  // números. El dueño los ve buscando ese código en el panel.
  const whatsappUrl = orderWhatsAppMessage({
    businessPhone: settings.whatsapp_number,
    participantName: order.participant.name,
    raffleTitle: order.raffle.title,
    orderCode: order.code,
    quantity: order.quantity,
    total: order.total,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5236";
  const wompiUrl =
    order.status === "PENDING" && isWompiConfigured()
      ? checkoutUrl({
          orderCode: order.code,
          totalCop: order.total,
          redirectUrl: `${siteUrl}/pedido/${order.code}`,
          customerName: order.participant.name,
          customerPhone: order.participant.phone,
        })
      : null;

  return (
    <>
      <Header
        whatsappNumber={settings.whatsapp_number}
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
          autoEnviarWhatsApp={enviar === "1" && order.raffle.whatsappCheckout}
        />
      </main>
      <Footer settings={settings} hideWhatsApp={!order.raffle.whatsappCheckout} />
      <BottomBar
        whatsappNumber={settings.whatsapp_number}
        hideWhatsApp={!order.raffle.whatsappCheckout}
      />
    </>
  );
}
