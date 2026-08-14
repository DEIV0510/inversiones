import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdminApi } from "@/lib/auth";
import { saveImage } from "@/lib/media";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi("raffles.manage");
  if (auth instanceof Response) return auth;

  // Rechazar antes de bufferizar el body: formData() carga todo en memoria.
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_SIZE + 1024 * 1024) {
    return NextResponse.json(
      { error: "La imagen es muy pesada (máximo 10 MB)" },
      { status: 413 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ninguna imagen" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "La imagen es muy pesada (máximo 10 MB)" },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let optimized: Buffer;
  try {
    // `failOn: "none"` permite procesar fotos de celular con metadatos raros
    // (muy común en iPhone/Android) que de otro modo harían fallar la subida.
    optimized = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch (err) {
    // Se registra el detalle real para diagnóstico; al usuario se le da una
    // salida clara. Se aceptan JPG, PNG, WebP y HEIC/HEIF de iPhone.
    console.error("Fallo procesando imagen:", err);
    return NextResponse.json(
      {
        error:
          "No pudimos procesar esa imagen. Intenta con otra foto o toma una nueva desde la cámara.",
      },
      { status: 422 }
    );
  }

  try {
    const url = await saveImage(optimized);
    return NextResponse.json({ url }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "No fue posible guardar la imagen. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
