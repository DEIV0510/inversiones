/**
 * Prueba de integración del motor de rifas contra la base de datos actual
 * (.env). Cubre el punto MÁS crítico: concurrencia — dos compradores del
 * mismo número → exactamente uno gana.
 *
 * Uso: npx tsx scripts/test-engine.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  cancelOrder,
  createOrder,
  confirmOrderPayment,
  expireOverdueOrders,
  OrderError,
} from "../src/lib/engine/orders";
import { getNumberStatus, pickRandomAvailable } from "../src/lib/engine/claims";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    console.error(`  ✘ ${name} ${detail}`);
  }
}

async function main() {
  // Rifa temporal de prueba (se elimina al final).
  const raffle = await prisma.raffle.create({
    data: {
      slug: `test-engine-${Date.now()}`,
      title: "TEST ENGINE (temporal)",
      prize: "Premio de prueba",
      pricePerNumber: 5000,
      totalNumbers: 10000,
      digits: 4,
      status: "ACTIVE",
      reservationMinutes: 10,
      maxNumbersPerOrder: 20,
    },
  });
  console.log(`Rifa de prueba: ${raffle.slug}`);

  try {
    // 1. Crear orden con números explícitos
    console.log("\n1. Orden con números explícitos");
    const o1 = await createOrder({
      raffleSlug: raffle.slug,
      name: "Comprador Uno",
      phone: "3001110001",
      numbers: [7, 42, 99],
    });
    check("orden creada", o1.order.status === "PENDING");
    check("total correcto", o1.order.total === 15000);
    check("número queda RESERVADO", (await getNumberStatus(raffle.id, 42)) === "RESERVADO");

    // 2. CONCURRENCIA: 6 compradores pelean por el número 500 a la vez
    console.log("\n2. Concurrencia: 6 órdenes simultáneas por el número 500");
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        createOrder({
          raffleSlug: raffle.slug,
          name: `Concurrente ${i}`,
          phone: `300222000${i}`,
          numbers: [500],
        })
      )
    );
    const wins = attempts.filter((a) => a.status === "fulfilled").length;
    const conflicts = attempts.filter(
      (a) =>
        a.status === "rejected" &&
        a.reason instanceof OrderError &&
        a.reason.status === 409
    ).length;
    check("exactamente 1 gana", wins === 1, `(ganaron ${wins})`);
    check("los demás reciben conflicto 409", conflicts === 5, `(conflictos ${conflicts})`);
    const rows500 = await prisma.raffleNumber.count({
      where: { raffleId: raffle.id, number: 500 },
    });
    check("solo existe UNA fila para el número 500", rows500 === 1);

    // 3. Aleatorios: solo disponibles, sin repetidos
    console.log("\n3. Números aleatorios");
    const o3 = await createOrder({
      raffleSlug: raffle.slug,
      name: "Comprador Azar",
      phone: "3003330003",
      randomCount: 10,
    });
    const nums3: number[] = JSON.parse(o3.order.numbersJson);
    check("entrega 10 números", nums3.length === 10);
    check("sin repetidos", new Set(nums3).size === 10);
    check("no incluye tomados", !nums3.includes(7) && !nums3.includes(42) && !nums3.includes(500));

    // 4. Confirmación de pago idempotente
    console.log("\n4. Confirmación de pago (manual, idempotente)");
    const c1 = await confirmOrderPayment({
      orderId: o1.order.id,
      provider: "manual",
    });
    check("confirmación ok", c1.ok);
    check("número pasa a VENDIDO", (await getNumberStatus(raffle.id, 42)) === "VENDIDO");
    const r1 = await prisma.raffle.findUnique({ where: { id: raffle.id } });
    check("paidCount = 3", r1?.paidCount === 3, `(=${r1?.paidCount})`);
    const c2 = await confirmOrderPayment({ orderId: o1.order.id, provider: "manual" });
    check("segunda confirmación es no-op", c2.ok && "alreadyPaid" in c2 && c2.alreadyPaid);
    const r2 = await prisma.raffle.findUnique({ where: { id: raffle.id } });
    check("paidCount sigue en 3", r2?.paidCount === 3, `(=${r2?.paidCount})`);

    // 5. Doble compra del mismo número YA VENDIDO
    console.log("\n5. Número vendido no se puede volver a comprar");
    try {
      await createOrder({
        raffleSlug: raffle.slug,
        name: "Tardío",
        phone: "3004440004",
        numbers: [42],
      });
      check("compra de vendido rechazada", false);
    } catch (e) {
      check(
        "compra de vendido rechazada",
        e instanceof OrderError && e.conflicting.includes(42)
      );
    }

    // 6. Expiración: reserva vencida se libera y el número vuelve a estar libre
    console.log("\n6. Expiración de reservas");
    const oExp = await createOrder({
      raffleSlug: raffle.slug,
      name: "Olvidadizo",
      phone: "3005550005",
      numbers: [1234],
    });
    await prisma.order.update({
      where: { id: oExp.order.id },
      data: { reservedUntil: new Date(Date.now() - 60_000) },
    });
    await prisma.raffleNumber.updateMany({
      where: { orderId: oExp.order.id },
      data: { reservedUntil: new Date(Date.now() - 60_000) },
    });
    check("estado público vuelve a DISPONIBLE", (await getNumberStatus(raffle.id, 1234)) === "DISPONIBLE");
    // Otro comprador toma el número expirado (liberación perezosa)
    const oSteal = await createOrder({
      raffleSlug: raffle.slug,
      name: "Nuevo Dueño",
      phone: "3006660006",
      numbers: [1234],
    });
    check("otro comprador lo reserva", oSteal.order.status === "PENDING");
    // El barrido marca la orden vencida como EXPIRED
    const swept = await expireOverdueOrders();
    check("barrido marca órdenes vencidas", swept >= 1, `(${swept})`);
    const expOrder = await prisma.order.findUnique({ where: { id: oExp.order.id } });
    check("orden vencida queda EXPIRED", expOrder?.status === "EXPIRED");
    // Pago tardío de la orden expirada sobre número revendido → rechazado
    const late = await confirmOrderPayment({ orderId: oExp.order.id, provider: "manual" });
    check("pago tardío sobre revendido NO confirma", !late.ok);

    // 7. pickRandomAvailable respeta ocupación alta (mini rifa 20 números)
    console.log("\n7. Aleatorios en rifa casi llena");
    const mini = await prisma.raffle.create({
      data: {
        slug: `test-mini-${Date.now()}`,
        title: "TEST MINI",
        prize: "x",
        pricePerNumber: 1000,
        totalNumbers: 20,
        digits: 2,
        status: "ACTIVE",
      },
    });
    await prisma.raffleNumber.createMany({
      data: Array.from({ length: 17 }, (_, n) => ({
        raffleId: mini.id,
        number: n,
        status: "PAID" as const,
      })),
    });
    const scarce = await pickRandomAvailable(mini, 3);
    check("encuentra los 3 únicos libres", scarce.length === 3 && scarce.every((n) => n >= 17), `(${scarce})`);
    await prisma.raffleNumber.deleteMany({ where: { raffleId: mini.id } });
    await prisma.raffle.delete({ where: { id: mini.id } });

    // 8. REGRESIÓN: confirmación CONCURRENTE de la misma orden (webhook
    //    reintentado + confirmación manual simultánea). Antes del bloqueo de
    //    fila, la segunda transacción rechazaba la orden y borraba sus
    //    números ya vendidos.
    console.log("\n8. Confirmación concurrente de la misma orden");
    const oRace = await createOrder({
      raffleSlug: raffle.slug,
      name: "Doble Confirmación",
      phone: "3007770007",
      numbers: [3001, 3002],
    });
    const pctBefore = (await prisma.raffle.findUnique({ where: { id: raffle.id } }))!.paidCount;
    const both = await Promise.all([
      confirmOrderPayment({ orderId: oRace.order.id, provider: "wompi", providerTxId: "tx-race-1" }),
      confirmOrderPayment({ orderId: oRace.order.id, provider: "manual" }),
    ]);
    const raceOrder = await prisma.order.findUnique({ where: { id: oRace.order.id } });
    check("ambas llamadas responden ok", both.every((r) => r.ok));
    check("la orden queda PAGADA (no rechazada)", raceOrder?.status === "PAID", `(=${raceOrder?.status})`);
    const raceNumbers = await prisma.raffleNumber.findMany({
      where: { orderId: oRace.order.id },
    });
    check(
      "los números siguen vendidos (no se borraron)",
      raceNumbers.length === 2 && raceNumbers.every((n) => n.status === "PAID"),
      `(${raceNumbers.length} filas)`
    );
    const pctAfter = (await prisma.raffle.findUnique({ where: { id: raffle.id } }))!.paidCount;
    check("paidCount incrementa UNA sola vez", pctAfter === pctBefore + 2, `(${pctBefore}→${pctAfter})`);

    // 9. REGRESIÓN: cancelación concurrente no descuenta dos veces.
    console.log("\n9. Cancelación concurrente de una orden pagada");
    const beforeCancel = (await prisma.raffle.findUnique({ where: { id: raffle.id } }))!.paidCount;
    await Promise.all([
      cancelOrder(oRace.order.id).catch(() => null),
      cancelOrder(oRace.order.id).catch(() => null),
    ]);
    const afterCancel = (await prisma.raffle.findUnique({ where: { id: raffle.id } }))!.paidCount;
    const cancelled = await prisma.order.findUnique({ where: { id: oRace.order.id } });
    check("la orden queda CANCELADA", cancelled?.status === "CANCELLED");
    check(
      "paidCount descuenta UNA sola vez",
      afterCancel === beforeCancel - 2,
      `(${beforeCancel}→${afterCancel})`
    );
  } finally {
    // Limpieza
    await prisma.payment.deleteMany({ where: { order: { raffleId: raffle.id } } });
    await prisma.raffleNumber.deleteMany({ where: { raffleId: raffle.id } });
    await prisma.order.deleteMany({ where: { raffleId: raffle.id } });
    await prisma.raffle.delete({ where: { id: raffle.id } });
    await prisma.participant.deleteMany({
      where: { phone: { in: ["573001110001","573002220000","573002220001","573002220002","573002220003","573002220004","573002220005","573003330003","573004440004","573005550005","573006660006","573007770007"] } },
    });
  }

  console.log(`\nResultado: ${passed} ✔ / ${failed} ✘`);
  if (failed > 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
