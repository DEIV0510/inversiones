/**
 * Datos de DEMOSTRACIÓN para recorrer toda la interfaz.
 * Se ejecuta contra la base apuntada por .env — NUNCA contra producción.
 * Uso: npx tsx scripts/seed-demo.ts
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateOrderCode } from "../src/lib/engine/orders";

const prisma = new PrismaClient();

const NOMBRES = [
  "Carlos Andrés Martínez",
  "María Fernanda Pérez",
  "Jorge Luis Contreras",
  "Yeimy Paola Salgado",
  "Wilson Alberto Támara",
  "Luz Marina Vergara",
  "Deiver Alonso Mendoza",
  "Katherine Julieth Ospina",
  "Óscar Iván Buelvas",
  "Sandra Milena Arrieta",
  "Rafael Antonio Berrío",
  "Diana Carolina Meza",
];

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

function randomNumbers(total: number, count: number, used: Set<number>): number[] {
  const out: number[] = [];
  while (out.length < count) {
    const n = Math.floor(Math.random() * total);
    if (!used.has(n)) {
      used.add(n);
      out.push(n);
    }
  }
  return out.sort((a, b) => a - b);
}

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

async function main() {
  console.log("Limpiando datos previos de la demo…");
  await prisma.payment.deleteMany();
  await prisma.raffleNumber.deleteMany();
  await prisma.order.deleteMany();
  await prisma.winner.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.raffle.deleteMany();
  await prisma.auditLog.deleteMany();

  // ── Usuarios administrativos (uno por rol, para ver los permisos) ──
  const pass = await bcrypt.hash("Demo.2026.DyS", 12);
  const roles = [
    { email: "admin@inversionesdys.com", name: "Administrador", role: "SUPER_ADMIN" as const },
    { email: "operador@demo.com", name: "Operador Demo", role: "ADMIN" as const },
    { email: "soporte@demo.com", name: "Soporte Demo", role: "SOPORTE" as const },
    { email: "finanzas@demo.com", name: "Finanzas Demo", role: "FINANZAS" as const },
  ];
  for (const u of roles) {
    await prisma.adminUser.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash: pass, isActive: true },
      create: { ...u, passwordHash: pass },
    });
  }

  // ── Configuración ──
  const settings: Record<string, string> = {
    company_name: "INVERSIONES D Y S",
    whatsapp_number: "573106930187",
    whatsapp_display: "310 693 0187",
    location: "Sincelejo, Sucre, Colombia",
    facebook_url: "https://www.facebook.com/profile.php?id=100066477883821",
    instagram_url: "",
    tiktok_url: "",
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  // ── Rifas de demostración (una por estado) ──
  const moto = await prisma.raffle.create({
    data: {
      slug: "demo-gran-moto-mas-5-millones",
      title: "DEMO · Gran Moto 0 KM + $5.000.000",
      description:
        "Ejemplo de demostración: motocicleta 0 KM más cinco millones en efectivo. Juega con la Lotería de Medellín al completarse el 100%.",
      prize: "Motocicleta 0 KM + $5.000.000",
      imageUrl: "/img/premio-moto.svg",
      pricePerNumber: 10000,
      totalNumbers: 100000,
      digits: 5,
      drawDateText: "30 de septiembre",
      status: "ACTIVE",
      // Rifa grande en modo MANUAL: así opera el negocio mientras las ventas
      // se registran también por fuera de la plataforma.
      progressMode: "MANUAL",
      manualProgressPct: 68,
      reservationMinutes: 10,
      maxNumbersPerOrder: 20,
      terms: "Ejemplo de condiciones: el sorteo se realiza al vender el 100% de los números. El ganador se anuncia por los canales oficiales.",
      displayOrder: 1,
    },
  });

  const efectivo = await prisma.raffle.create({
    data: {
      slug: "demo-dos-millones-en-efectivo",
      title: "DEMO · $2.000.000 en Efectivo",
      description:
        "Ejemplo de demostración: dos millones de pesos en efectivo, entrega inmediata al ganador.",
      prize: "$2.000.000 en efectivo",
      imageUrl: "/img/premio-dinero.svg",
      pricePerNumber: 5000,
      // Rifa pequeña en modo AUTOMÁTICO: el porcentaje se calcula solo con
      // las ventas reales registradas en la plataforma.
      totalNumbers: 100,
      digits: 2,
      drawDateText: "15 de septiembre",
      status: "ACTIVE",
      progressMode: "AUTO",
      reservationMinutes: 15,
      maxNumbersPerOrder: 10,
      displayOrder: 2,
    },
  });

  const millon = await prisma.raffle.create({
    data: {
      slug: "demo-millon-de-numeros",
      title: "DEMO · Sorteo Millonario (1.000.000 de números)",
      description:
        "Ejemplo de demostración a máxima escala: un millón de números de seis cifras, para probar el buscador y el rendimiento.",
      prize: "Camioneta 0 KM",
      imageUrl: "/img/premio-proximo.svg",
      pricePerNumber: 2000,
      totalNumbers: 1000000,
      digits: 6,
      drawDateText: "Diciembre",
      status: "ACTIVE",
      progressMode: "MANUAL",
      manualProgressPct: 12,
      reservationMinutes: 20,
      maxNumbersPerOrder: 50,
      displayOrder: 3,
    },
  });

  const proximo = await prisma.raffle.create({
    data: {
      slug: "demo-proximo-sorteo",
      title: "DEMO · Próximo Gran Sorteo",
      description: "Ejemplo de demostración: sorteo por anunciar.",
      prize: "Premio por anunciar",
      imageUrl: "/img/premio-proximo.svg",
      pricePerNumber: 10000,
      totalNumbers: 10000,
      digits: 4,
      drawDateText: "Próximamente",
      status: "COMING_SOON",
      progressMode: "MANUAL",
      manualProgressPct: 0,
      displayOrder: 4,
    },
  });

  const finalizada = await prisma.raffle.create({
    data: {
      slug: "demo-sorteo-agosto-finalizado",
      title: "DEMO · Sorteo Agosto (finalizado)",
      description: "Ejemplo de demostración: sorteo ya realizado con ganador publicado.",
      prize: "Motocicleta 0 KM",
      imageUrl: "/img/premio-moto.svg",
      pricePerNumber: 8000,
      totalNumbers: 1000,
      digits: 3,
      drawDateText: "5 de agosto",
      status: "FINISHED",
      progressMode: "MANUAL",
      manualProgressPct: 100,
      displayOrder: 5,
    },
  });

  // ── Participantes ──
  const participantes = [];
  for (let i = 0; i < NOMBRES.length; i++) {
    participantes.push(
      await prisma.participant.create({
        data: {
          name: NOMBRES[i],
          phone: `5730${(11000000 + i * 137).toString().slice(0, 9)}`,
          email: i % 3 === 0 ? `demo${i}@correo.com` : null,
          createdAt: daysAgo(20 - i),
        },
      })
    );
  }

  // ── Pedidos con distintos estados ──
  const usados = new Map<string, Set<number>>();
  const usedFor = (id: string) => {
    if (!usados.has(id)) usados.set(id, new Set());
    return usados.get(id)!;
  };

  let paidMoto = 0;
  let paidEfectivo = 0;

  // Pedidos PAGADOS (los que alimentan ingresos y porcentaje)
  for (let i = 0; i < 14; i++) {
    const raffle = i % 3 === 0 ? efectivo : moto;
    const participante = participantes[i % participantes.length];
    const cantidad = [1, 2, 3, 5][i % 4];
    const numeros = randomNumbers(raffle.totalNumbers, cantidad, usedFor(raffle.id));
    const paidAt = daysAgo(13 - Math.floor(i * 0.9));
    const order = await prisma.order.create({
      data: {
        code: generateOrderCode(),
        raffleId: raffle.id,
        participantId: participante.id,
        numbersJson: JSON.stringify(numeros),
        quantity: cantidad,
        unitPrice: raffle.pricePerNumber,
        total: cantidad * raffle.pricePerNumber,
        status: "PAID",
        paymentMethod: i % 2 === 0 ? "manual" : "wompi",
        paidAt,
        createdAt: paidAt,
      },
    });
    await prisma.raffleNumber.createMany({
      data: numeros.map((number) => ({
        raffleId: raffle.id,
        number,
        status: "PAID" as const,
        orderId: order.id,
      })),
    });
    if (i % 2 !== 0) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          provider: "wompi",
          providerTxId: `demo-tx-${i}-${Date.now()}`,
          reference: `DYS-${order.code}`,
          amount: order.total,
          status: "APPROVED",
          createdAt: paidAt,
        },
      });
    }
    if (raffle.id === moto.id) paidMoto += cantidad;
    else paidEfectivo += cantidad;
  }

  // Pedidos PENDIENTES con reserva viva (aparecen en Reservas)
  for (let i = 0; i < 3; i++) {
    const participante = participantes[(i + 5) % participantes.length];
    const numeros = randomNumbers(moto.totalNumbers, 2, usedFor(moto.id));
    const reservedUntil = new Date(Date.now() + (7 + i * 3) * 60_000);
    const order = await prisma.order.create({
      data: {
        code: generateOrderCode(),
        raffleId: moto.id,
        participantId: participante.id,
        numbersJson: JSON.stringify(numeros),
        quantity: 2,
        unitPrice: moto.pricePerNumber,
        total: 2 * moto.pricePerNumber,
        status: "PENDING",
        reservedUntil,
      },
    });
    await prisma.raffleNumber.createMany({
      data: numeros.map((number) => ({
        raffleId: moto.id,
        number,
        status: "RESERVED" as const,
        orderId: order.id,
        reservedUntil,
      })),
    });
  }

  // Pedidos EXPIRADO y CANCELADO (números ya liberados)
  for (const estado of ["EXPIRED", "CANCELLED"] as const) {
    const participante = participantes[estado === "EXPIRED" ? 2 : 7];
    const numeros = randomNumbers(efectivo.totalNumbers, 3, usedFor(efectivo.id));
    await prisma.order.create({
      data: {
        code: generateOrderCode(),
        raffleId: efectivo.id,
        participantId: participante.id,
        numbersJson: JSON.stringify(numeros),
        quantity: 3,
        unitPrice: efectivo.pricePerNumber,
        total: 3 * efectivo.pricePerNumber,
        status: estado,
        createdAt: daysAgo(4),
      },
    });
  }

  // Números BLOQUEADOS por el administrador
  await prisma.raffleNumber.createMany({
    data: [0, 1, 2, 3, 4].map((number) => ({
      raffleId: efectivo.id,
      number,
      status: "BLOCKED" as const,
    })),
    skipDuplicates: true,
  });

  // Contadores denormalizados coherentes
  await prisma.raffle.update({ where: { id: moto.id }, data: { paidCount: paidMoto } });
  await prisma.raffle.update({ where: { id: efectivo.id }, data: { paidCount: paidEfectivo } });
  await prisma.raffle.update({
    where: { id: finalizada.id },
    data: { paidCount: finalizada.totalNumbers },
  });

  // ── Ganadores publicados ──
  await prisma.winner.create({
    data: {
      raffleId: finalizada.id,
      raffleTitle: finalizada.title,
      numberValue: 427,
      numberFormatted: "427",
      participantName: "Wilson Alberto Támara",
      prize: "Motocicleta 0 KM",
      drawnAtText: "5 de agosto de 2026",
      isDemo: true,
      isPublished: true,
      displayOrder: 1,
    },
  });
  await prisma.winner.create({
    data: {
      raffleTitle: "DEMO · Sorteo Julio",
      numberValue: 88,
      numberFormatted: "088",
      participantName: "Luz Marina Vergara",
      prize: "$1.500.000 en efectivo",
      drawnAtText: "10 de julio de 2026",
      isDemo: true,
      isPublished: true,
      displayOrder: 2,
    },
  });

  // ── Auditoría de ejemplo ──
  const acciones = [
    { action: "raffle.create", entity: "Raffle", entityId: moto.id, detail: { title: moto.title, totalNumbers: moto.totalNumbers } },
    { action: "raffle.update", entity: "Raffle", entityId: efectivo.id, detail: { precio: { antes: 4000, ahora: 5000 } } },
    { action: "number.block", entity: "Raffle", entityId: efectivo.id, detail: { desde: 0, hasta: 4, bloqueados: 5 } },
    { action: "order.confirm_manual", entity: "Order", detail: { ok: true } },
    { action: "settings.update", entity: "Setting", detail: ["facebook_url"] },
    { action: "auth.login", entity: "AdminUser", detail: {} },
  ];
  for (let i = 0; i < acciones.length; i++) {
    const a = acciones[i];
    await prisma.auditLog.create({
      data: {
        actorEmail: i % 2 === 0 ? "admin@inversionesdys.com" : "operador@demo.com",
        actorRole: i % 2 === 0 ? "SUPER_ADMIN" : "ADMIN",
        action: a.action,
        entity: a.entity,
        entityId: a.entityId,
        detailJson: JSON.stringify(a.detail),
        createdAt: daysAgo(i),
      },
    });
  }

  const totales = {
    rifas: await prisma.raffle.count(),
    participantes: await prisma.participant.count(),
    pedidos: await prisma.order.count(),
    numerosTomados: await prisma.raffleNumber.count(),
    ganadores: await prisma.winner.count(),
  };
  console.log("Demo lista:", totales);
  console.log("Sorteo activo principal: /sorteo/" + moto.slug);
  console.log("Rifa de 1.000.000 de números: /sorteo/" + millon.slug);
  console.log("Próximamente: /sorteo/" + proximo.slug);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
