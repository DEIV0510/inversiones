import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Almacenamiento de imÃ¡genes con dos backends:
 * - Vercel Blob cuando existe BLOB_READ_WRITE_TOKEN (producciÃ³n en Vercel).
 * - Disco local en public/uploads como respaldo (desarrollo/VPS).
 */
function usaBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isBlobUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" &&
      hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

/** Guarda una imagen ya optimizada (webp) y devuelve su URL pÃºblica. */
export async function saveImage(buffer: Buffer): Promise<string> {
  const fileName = `up-${Date.now()}-${randomBytes(4).toString("hex")}.webp`;

  if (usaBlob()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${fileName}`, buffer, {
      access: "public",
      contentType: "image/webp",
    });
    return blob.url;
  }

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), buffer);
  return `/uploads/${fileName}`;
}

/** Elimina una imagen subida (Blob o disco). Nunca lanza: no es crÃ­tico. */
export async function deleteImage(url: string | null): Promise<void> {
  if (!url) return;
  try {
    if (isBlobUrl(url)) {
      if (!usaBlob()) return;
      const { del } = await import("@vercel/blob");
      await del(url);
      return;
    }
    if (url.startsWith("/uploads/")) {
      const filePath = path.join(
        process.cwd(),
        "public",
        "uploads",
        path.basename(url)
      );
      await unlink(filePath);
    }
  } catch {
    // La imagen puede no existir o el token no estar disponible; ignorar.
  }
}
