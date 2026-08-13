// Exporta todos los datos actuales de producción a JSON antes de la
// reconstrucción v2. No se pierde nada en el cambio de schema.
const { PrismaClient } = require("@prisma/client");
const fs = require("fs");

const prisma = new PrismaClient();

async function main() {
  const [raffles, winners, settings] = await Promise.all([
    prisma.raffle.findMany(),
    prisma.winner.findMany(),
    prisma.setting.findMany(),
  ]);
  const snapshot = {
    exportedAt: new Date().toISOString(),
    raffles,
    winners,
    settings,
  };
  fs.mkdirSync("_backup", { recursive: true });
  const file = `_backup/prod-snapshot.json`;
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  console.log(
    `Snapshot: ${raffles.length} rifas, ${winners.length} ganadores, ${settings.length} settings → ${file}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
