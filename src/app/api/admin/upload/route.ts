import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { saveImage } from "@/lib/media";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin();
  if (unauthorized) return unauthorized;

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
    // sharp valida que el archivo sea una imagen real y la optimiza para web.
    optimized = await sharp(buffer)
      .rotate()
      .resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "Formato de imagen no soportado. Usa JPG, PNG o WebP." },
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
