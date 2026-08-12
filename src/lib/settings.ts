import { prisma } from "./db";

export type SiteSettings = {
  company_name: string;
  whatsapp_number: string;
  whatsapp_display: string;
  location: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
};

export const SETTING_KEYS: (keyof SiteSettings)[] = [
  "company_name",
  "whatsapp_number",
  "whatsapp_display",
  "location",
  "facebook_url",
  "instagram_url",
  "tiktok_url",
];

const FALLBACK: SiteSettings = {
  company_name: "INVERSIONES D Y S",
  whatsapp_number: "573106930187",
  whatsapp_display: "310 693 0187",
  location: "Sincelejo, Sucre, Colombia",
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
};

export async function getSettings(): Promise<SiteSettings> {
  const rows = await prisma.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const result = { ...FALLBACK };
  for (const key of SETTING_KEYS) {
    if (typeof map[key] === "string" && map[key].trim() !== "") {
      result[key] = map[key].trim();
    }
  }
  return result;
}
