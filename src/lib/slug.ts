/** Convierte un título en slug de URL: "Gran Sorteo Moto 0KM" → "gran-sorteo-moto-0km". */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "sorteo";
}
