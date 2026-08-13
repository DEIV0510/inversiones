import { readFileSync, existsSync } from "node:fs";
import { PrismaClient, type RaffleStatus } from "@prisma/client";

/**
 * Seed v2. Idempotente. Si existe _backup/prod-snapshot.json (datos de la
 * versión 1), los migra al nuevo modelo para no perder nada.
 */

const prisma = new PrismaClient();

const DEFAULT_SETTINGS: Record<string, string> = {
  company_name: "INVERSIONES D Y S",
  whatsapp_number: "573106930187",
  whatsapp_display: "310 693 0187",
  location: "Sincelejo, Sucre, Colombia",
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
};

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "sorteo"
  );
}

type OldRaffle = {
  title: string;
  description: string;
  prize: string;
  imageUrl: string | null;
  priceCop: number | null;
  drawDateText: string | null;
  progressPct: number;
  status: string;
  isPublished: boolean;
  displayOrder: number;
  totalNumbers: number | null;
};

function mapOldStatus(old: OldRaffle): RaffleStatus {
  if (!old.isPublished) return "DRAFT";
  switch (old.status) {
    case "active":
      return "ACTIVE";
    case "coming_soon":
      return "COMING_SOON";
    case "finished":
      return "FINISHED";
    case "sold_out":
      return "SOLD_OUT";
    default:
      return "DRAFT";
  }
}

async function main() {
  // 1. Settings (del snapshot v1 si existe; no pisa valores ya presentes).
  let snapshotSettings: Record<string, string> = {};
  let snapshotRaffles: OldRaffle[] = [];
  const snapshotPath = "_backup/prod-snapshot.json";
  if (existsSync(snapshotPath)) {
    const snap = JSON.parse(readFileSync(snapshotPath, "utf8"));
    snapshotSettings = Object.fromEntries(
      (snap.settings ?? []).map((s: { key: string; value: string }) => [
        s.key,
        s.value,
      ])
    );
    snapshotRaffles = snap.raffles ?? [];
  }

  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    const value = snapshotSettings[key] ?? fallback;
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

  // 2. Super admin desde variables de entorno.
  const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  const rawHash = (process.env.ADMIN_PASSWORD_HASH ?? "").trim();
  if (email && rawHash) {
    const passwordHash = rawHash.startsWith("$2")
      ? rawHash
      : Buffer.from(rawHash, "base64").toString("utf8");
    await prisma.adminUser.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: "Administrador",
        passwordHash,
        role: "SUPER_ADMIN",
      },
    });
    console.log(`Super admin: ${email}`);
  } else {
    console.warn("ADMIN_EMAIL / ADMIN_PASSWORD_HASH no configurados: sin super admin");
  }

  // 3. Rifas: migración del snapshot v1 (progreso pasa a modo MANUAL para
  //    conservar el porcentaje que ya se mostraba; con ventas reales el
  //    admin puede cambiar a AUTO).
  const raffleCount = await prisma.raffle.count();
  if (raffleCount === 0 && snapshotRaffles.length > 0) {
    for (const old of snapshotRaffles) {
      const totalNumbers = old.totalNumbers ?? 10000;
      const slug = slugify(old.title);
      await prisma.raffle.upsert({
        where: { slug },
        update: {},
        create: {
          slug,
          title: old.title,
          description: old.description ?? "",
          prize: old.prize,
          imageUrl: old.imageUrl,
          pricePerNumber: old.priceCop ?? 10000,
          totalNumbers,
          digits: Math.max(1, String(totalNumbers - 1).length),
          drawDateText: old.drawDateText,
          status: mapOldStatus(old),
          progressMode: "MANUAL",
          manualProgressPct: old.progressPct ?? 0,
          displayOrder: old.displayOrder ?? 0,
        },
      });
      console.log(`Rifa migrada: ${old.title} → /${slug}`);
    }
  }

  console.log("Seed v2 completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
