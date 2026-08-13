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
  isOrderExpired,
} from "@/lib/engine/orders";
import { formatNumbers } from "@/lib/numbers";
import { orderWhatsAppMessage } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import {
  checkoutUrl,
  findTransactionByReference,
  isWompiConfigured,
  paymentReference,
} from "@/lib/wompi";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false },
};

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  let order = await prisma.order.findUnique({
    where: { code },
    include: { raffle: true, participant: true },
  });
  if (!order) notFound();

  // Verificación de respaldo contra Wompi (caso redirect): consulta directa
  // a la pasarela, nunca parámetros del navegador.
  if (order.status === "PENDING" && isWompiConfigured()) {
    const tx = await findTransactionByReference(paymentReference(code));
    if (tx?.status === "APPROVED") {
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
  const numbers = formatNumbers(
    JSON.parse(order.numbersJson),
    order.raffle.digits
  );

  const whatsappUrl = orderWhatsAppMessage({
    businessPhone: settings.whatsapp_number,
    participantName: order.participant.name,
    raffleTitle: order.raffle.title,
    orderCode: order.code,
    numbers,
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
          }}
          whatsappUrl={whatsappUrl}
          wompiUrl={wompiUrl}
        />
      </main>
      <Footer settings={settings} />
      <BottomBar whatsappNumber={settings.whatsapp_number} />
    </>
  );
}
