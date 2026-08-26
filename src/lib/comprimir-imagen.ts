/**
 * Encoge una foto EN EL NAVEGADOR antes de subirla.
 *
 * POR QUÉ EXISTE. Vercel corta cualquier petición a una función serverless
 * por encima de ~4,5 MB, y lo hace en su borde: la función NUNCA se ejecuta y
 * la respuesta que devuelve es texto plano (`FUNCTION_PAYLOAD_TOO_LARGE`), no
 * el JSON que el formulario espera. Resultado: el dueño intentaba subir el
 * flyer de su sorteo —una foto de celular de 4 a 8 MB— y solo veía "No fue
 * posible subir la imagen", sin ninguna pista. Medido en producción:
 * 2,03 MB → 201; 4,46 MB → 413; 7,03 MB → 413.
 *
 * El servidor de todos modos reescala a 1400 px y guarda WebP, así que mandar
 * el original era desperdiciar megas. Encogiendo aquí, una foto de 8 MB viaja
 * como unos pocos cientos de KB y el problema desaparece de raíz.
 *
 * NO reemplaza la validación del servidor: es una comodidad del formulario.
 * Si algo falla (un HEIC que este navegador no sabe decodificar, un canvas
 * bloqueado) se devuelve el archivo original y que decida el servidor.
 */

/** Lado máximo del lado largo. Por encima de esto el servidor reescala igual. */
const LADO_MAX = 1600;
/** A partir de aquí no vale la pena tocar la imagen. */
const UMBRAL_BYTES = 1_000_000;
/**
 * Techo real de subida. Vercel corta en ~4,5 MB; se deja margen para el
 * sobre del multipart y las cabeceras.
 */
export const MAX_SUBIDA_BYTES = 4 * 1024 * 1024;

/** Megas con un decimal, para poder decírselo al usuario. */
export function enMegas(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

async function aBitmap(file: File): Promise<ImageBitmap | null> {
  try {
    // createImageBitmap respeta la orientación EXIF con esta opción, así que
    // una foto vertical de celular no acaba acostada.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
}

/**
 * Devuelve una versión más liviana del archivo, o el original si no se pudo
 * (o si no hacía falta). Nunca lanza.
 */
export async function comprimirImagen(file: File): Promise<File> {
  // Solo imágenes de mapa de bits. Un SVG o un PDF se dejan como están.
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }
  // Ya es pequeña: tocarla solo le quitaría calidad.
  if (file.size <= UMBRAL_BYTES) return file;

  const bitmap = await aBitmap(file);
  if (!bitmap) return file;

  try {
    const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.max(1, Math.round(bitmap.width * escala));
    const alto = Math.max(1, Math.round(bitmap.height * escala));

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);

    const blob = await new Promise<Blob | null>((resolve) => {
      lienzo.toBlob(resolve, "image/webp", 0.85);
    });
    if (!blob) return file;

    // Si el "encogido" pesara más que el original (pasa con imágenes ya muy
    // optimizadas), se queda el original.
    if (blob.size >= file.size) return file;

    const nombre = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([blob], `${nombre}.webp`, { type: "image/webp" });
  } catch {
    return file;
  } finally {
    bitmap.close();
  }
}
