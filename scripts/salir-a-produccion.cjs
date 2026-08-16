/**
 * Deja el sitio listo para vender de verdad, SIN BORRAR NADA.
 *
 * Todo lo que hace es reversible desde el panel:
 *  - apaga el aviso de "sitio en demostración";
 *  - manda las rifas de ejemplo a BORRADOR (dejan de verse, no se pierden);
 *  - despublica los ganadores de ejemplo;
 *  - desactiva las cuentas @demo.com (tienen contraseña conocida);
 *  - enciende el cobro por WhatsApp en las rifas reales que no tengan
 *    pasarela, porque si no el comprador se queda sin forma de pagar.
 *
 * Para borrar de verdad los datos de ejemplo existe `scripts/limpiar-demo.ts`.
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const ES_DEMO = (slug) => slug.startsWith("demo-");

(async () => {
  // 1) Aviso de demostración fuera.
  await p.setting.upsert({
    where: { key: "demo_mode" },
    update: { value: "0" },
    create: { key: "demo_mode", value: "0" },
  });
  console.log("aviso de demostración: APAGADO");

  // 2) Rifas de ejemplo a borrador (siguen existiendo y se pueden previsualizar).
  const rifas = await p.raffle.findMany({
    select: { id: true, slug: true, status: true, whatsappCheckout: true },
  });
  for (const r of rifas.filter((x) => ES_DEMO(x.slug))) {
    if (r.status === "DRAFT") continue;
    await p.raffle.update({ where: { id: r.id }, data: { status: "DRAFT" } });
    console.log(`rifa de ejemplo oculta: ${r.slug} (${r.status} → DRAFT)`);
  }

  // 3) Ganadores de ejemplo fuera de la página.
  const w = await p.winner.updateMany({
    where: { isDemo: true, isPublished: true },
    data: { isPublished: false },
  });
  console.log("ganadores de ejemplo despublicados:", w.count);

  // 4) Cuentas de demostración desactivadas (su contraseña es pública).
  const u = await p.adminUser.updateMany({
    where: { email: { endsWith: "@demo.com" }, isActive: true },
    data: { isActive: false },
  });
  console.log("cuentas @demo.com desactivadas:", u.count);

  // 5) Sin pasarela configurada, una rifa sin WhatsApp no se puede pagar.
  const hayPasarela = Boolean(
    process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_PRIVATE_KEY
  );
  if (!hayPasarela) {
    for (const r of rifas.filter((x) => !ES_DEMO(x.slug) && !x.whatsappCheckout)) {
      await p.raffle.update({
        where: { id: r.id },
        data: { whatsappCheckout: true },
      });
      console.log(`cobro por WhatsApp encendido: ${r.slug}`);
    }
  } else {
    console.log("hay pasarela configurada: no se toca el cobro por WhatsApp");
  }

  const visibles = await p.raffle.findMany({
    where: { status: { in: ["COMING_SOON", "ACTIVE", "SOLD_OUT", "FINISHED"] } },
    select: { slug: true, status: true, whatsappCheckout: true },
    orderBy: { displayOrder: "asc" },
  });
  console.log("\nLo que verá el público:");
  for (const v of visibles) {
    console.log(`  ${v.status.padEnd(12)} ${v.whatsappCheckout ? "wa" : "--"}  ${v.slug}`);
  }

  await p.$disconnect();
})();
