import { NextRequest, NextResponse } from "next/server";
import { expireOverdueOrders } from "@/lib/engine/orders";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Mantenimiento programado (Vercel Cron): marca órdenes vencidas y libera
 * sus números. La corrección del sistema NO depende de este cron — la
 * liberación perezosa en el motor cubre cualquier intervalo — pero mantiene
 * los reportes limpios. Protegido con CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const expired = await expireOverdueOrders();
  return NextResponse.json({ ok: true, expiredOrders: expired });
}
