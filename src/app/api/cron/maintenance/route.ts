import { NextRequest, NextResponse } from "next/server";
import { barrerPagosBoldPendientes } from "@/lib/engine/barrido-bold";
import { expireOverdueOrders } from "@/lib/engine/orders";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Mantenimiento programado (Vercel Cron). Hace dos cosas:
 *
 * 1. RESCATA pagos de Bold que se quedaron pendientes. Va PRIMERO a
 *    propósito: si un pedido se pagó de verdad pero el webhook no llegó,
 *    tiene que confirmarse ANTES de que el paso siguiente lo dé por vencido
 *    y le suelte los números a otro comprador.
 * 2. Marca órdenes vencidas y libera sus números. La corrección del sistema
 *    NO depende de este paso — la liberación perezosa del motor cubre
 *    cualquier intervalo — pero mantiene los reportes limpios.
 *
 * Protegido con CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const bold = await barrerPagosBoldPendientes();
  const expired = await expireOverdueOrders();
  return NextResponse.json({
    ok: true,
    boldRescatados: bold.confirmados,
    boldRevisados: bold.revisados,
    // Si esto no es 0, el techo del barrido se quedó corto y hay pedidos sin
    // revisar: se dice, no se calla.
    boldSinRevisar: bold.sinRevisar,
    // Pedidos vencidos que SÍ tienen pago aprobado: dinero cobrado sin
    // entregar números. No se confirman solos (sus números pueden estar ya
    // vendidos); van aquí para revisarlos a mano.
    boldVencidosConPago: bold.vencidosConPago,
    expiredOrders: expired,
  });
}
