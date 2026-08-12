import { z } from "zod";
import { RAFFLE_STATUSES } from "./raffle-status";

const imagePath = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === "" || v.startsWith("/uploads/") || v.startsWith("/img/"),
    "Ruta de imagen no válida"
  );

export const raffleSchema = z.object({
  title: z.string().trim().min(3, "El título es muy corto").max(120),
  description: z.string().trim().max(800).default(""),
  prize: z.string().trim().min(2, "Indica el premio").max(120),
  imageUrl: imagePath.nullable().default(null),
  priceCop: z.number().int().min(0).max(100_000_000).nullable().default(null),
  drawDateText: z.string().trim().max(120).default(""),
  progressPct: z.number().int().min(0).max(100).default(0),
  status: z.enum(RAFFLE_STATUSES),
  isPublished: z.boolean().default(true),
  displayOrder: z.number().int().min(0).max(9999).default(0),
  totalNumbers: z.number().int().min(0).max(10_000_000).nullable().default(null),
  notes: z.string().trim().max(800).default(""),
});

export const rafflePatchSchema = raffleSchema.partial();

export const winnerSchema = z.object({
  name: z.string().trim().min(2, "Indica el nombre").max(120),
  prize: z.string().trim().min(2, "Indica el premio").max(120),
  raffleTitle: z.string().trim().max(120).default(""),
  photoUrl: imagePath.nullable().default(null),
  drawnAtText: z.string().trim().max(120).default(""),
  isDemo: z.boolean().default(true),
  isPublished: z.boolean().default(false),
  displayOrder: z.number().int().min(0).max(9999).default(0),
});

export const winnerPatchSchema = winnerSchema.partial();

export const settingsSchema = z.object({
  company_name: z.string().trim().min(2).max(120).optional(),
  whatsapp_number: z.string().trim().min(7).max(20).optional(),
  whatsapp_display: z.string().trim().min(7).max(30).optional(),
  location: z.string().trim().min(2).max(160).optional(),
  facebook_url: z.union([z.literal(""), z.string().trim().url().max(300)]).optional(),
  instagram_url: z.union([z.literal(""), z.string().trim().url().max(300)]).optional(),
  tiktok_url: z.union([z.literal(""), z.string().trim().url().max(300)]).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Correo no válido").max(200),
  password: z.string().min(1, "Ingresa la contraseña").max(200),
});
