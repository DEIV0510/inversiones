import { prisma } from "./db";
import { formatCop } from "./format";

/**
 * Correo transaccional por HTTP contra la API de Resend. No usa SDK ni
 * dependencias nuevas: solo fetch.
 *
 * Variables de entorno (ver docs/CORREO.md):
 *   RESEND_API_KEY  clave del proveedor. SIN ELLA NO SE ENVÍA NADA.
 *   EMAIL_FROM      remitente por defecto (opcional; el panel tiene prioridad).
 *
 * Regla de oro de este módulo: NUNCA lanza. Un fallo del proveedor de correo
 * jamás puede tumbar la confirmación de un pago que ya se cobró; se registra
 * con console.error y se devuelve false.
 */

const API_URL = "https://api.resend.com/emails";
const MARCA = "INVERSIONES D Y S";
/** Remitente de pruebas de Resend: solo llega al correo dueño de la cuenta. */
const REMITENTE_PRUEBAS = "onboarding@resend.dev";
/** Techo de espera al proveedor: el comprador no puede quedarse colgado. */
const TIMEOUT_MS = 10_000;

function clave(): string {
  return (process.env.RESEND_API_KEY ?? "").trim();
}

function remitenteDeEntorno(): string {
  return (process.env.EMAIL_FROM ?? "").trim() || REMITENTE_PRUEBAS;
}

/**
 * ¿El entorno tiene lo mínimo para enviar (clave y remitente)? El panel lo
 * usa para decir la verdad al dueño: sin clave, no se envía ningún correo.
 */
export function correoConfigurado(): boolean {
  return clave() !== "" && remitenteDeEntorno() !== "";
}

/**
 * Ajustes guardados en Configuración. Manda lo que puso el dueño en el panel;
 * si dejó el remitente vacío, se cae al del entorno. El interruptor solo se
 * considera apagado con un "0" explícito.
 */
async function ajustesDeCorreo(): Promise<{
  activo: boolean;
  remitente: string;
}> {
  try {
    const filas = await prisma.setting.findMany({
      where: { key: { in: ["email_enabled", "email_from"] } },
    });
    const mapa = new Map(filas.map((f) => [f.key, f.value.trim()]));
    return {
      activo: mapa.get("email_enabled") !== "0",
      remitente: mapa.get("email_from") || remitenteDeEntorno(),
    };
  } catch (err) {
    console.error("[correo] no se pudieron leer los ajustes:", err);
    return { activo: true, remitente: remitenteDeEntorno() };
  }
}

/**
 * ¿A ESTE comprador le va a llegar de verdad el correo con sus números?
 *
 * Existe para que la pantalla de pago no prometa de más. La regla es la misma
 * que aplica el envío real (`enviarCorreoDeOrden`) y vive AQUÍ, en un solo
 * sitio: dirección del comprador + interruptor de Configuración encendido +
 * clave del proveedor en el servidor. Si alguna falta, la pantalla se limita
 * a decir que verá sus números en Mis boletas, que eso sí siempre funciona.
 */
export async function leCorreoAlConfirmar(
  correoDelComprador: string | null | undefined
): Promise<boolean> {
  if (!correoDelComprador || correoDelComprador.trim() === "") return false;
  if (!correoConfigurado()) return false;
  const { activo } = await ajustesDeCorreo();
  return activo;
}

/** Escapa texto del comprador antes de meterlo en el HTML del correo. */
function esc(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** El remitente puede venir como "correo@dominio" o "Nombre <correo@dominio>". */
function conNombreDeMarca(remitente: string): string {
  return remitente.includes("<") ? remitente : `${MARCA} <${remitente}>`;
}

export type BoletasCorreo = {
  /** Dirección del comprador. */
  para: string;
  nombre: string;
  /** Código de participación de la orden. */
  codigo: string;
  tituloRifa: string;
  /** Números ya formateados con las cifras de la rifa ("00042"). */
  numeros: string[];
  total: number;
};

function plantillaHtml(datos: BoletasCorreo): string {
  const chips = datos.numeros
    .map(
      (n) =>
        `<span style="display:inline-block;margin:0 6px 8px 0;padding:8px 14px;` +
        `border:1px solid #c026d3;border-radius:999px;background:#fdf4ff;` +
        `color:#86198f;font-family:'Courier New',monospace;font-size:16px;` +
        `font-weight:bold;letter-spacing:1px;">${esc(n)}</span>`
    )
    .join("");

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e4e4e7;">
        <tr>
          <td style="background:#0b0710;padding:22px 24px;text-align:center;">
            <div style="color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;letter-spacing:2px;">
              ${esc(MARCA)}
            </div>
            <div style="color:#c026d3;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:3px;margin-top:6px;text-transform:uppercase;">
              Pago confirmado
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:26px 24px 8px 24px;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
            <p style="margin:0 0 14px 0;font-size:16px;">Hola ${esc(datos.nombre)},</p>
            <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#3f3f46;">
              Recibimos tu pago del sorteo <strong>${esc(datos.tituloRifa)}</strong>.
              Estos son tus números; guárdalos, ya quedaron a tu nombre.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 8px 24px;">
            <div style="border:1px solid #e4e4e7;border-radius:14px;padding:18px;background:#fafafa;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#71717a;margin-bottom:12px;">
                Tus números
              </div>
              <div>${chips}</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px 8px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#18181b;">
              <tr>
                <td style="padding:8px 0;color:#71717a;">Código de participación</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;letter-spacing:2px;">${esc(datos.codigo)}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#71717a;border-top:1px solid #e4e4e7;">Total pagado</td>
                <td style="padding:8px 0;text-align:right;font-weight:bold;border-top:1px solid #e4e4e7;">${esc(formatCop(datos.total))}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 26px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#71717a;">
            Con tu código de participación puedes consultar tus números cuando
            quieras. Mucha suerte en el sorteo.
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;border-top:1px solid #e4e4e7;padding:16px 24px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#a1a1aa;">
            ${esc(MARCA)} · Este correo es automático, no respondas a esta dirección.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function plantillaTexto(datos: BoletasCorreo): string {
  return [
    `Hola ${datos.nombre},`,
    "",
    `Recibimos tu pago del sorteo ${datos.tituloRifa}.`,
    "",
    `Tus números: ${datos.numeros.join(", ")}`,
    `Código de participación: ${datos.codigo}`,
    `Total pagado: ${formatCop(datos.total)}`,
    "",
    "Guarda este correo. Mucha suerte.",
    MARCA,
  ].join("\n");
}

/**
 * Envía al comprador los números que acaba de pagar. Devuelve true solo si el
 * proveedor aceptó el correo. No lanza nunca: ante cualquier fallo registra
 * el motivo y devuelve false.
 */
export async function enviarBoletas(datos: BoletasCorreo): Promise<boolean> {
  try {
    const para = datos.para.trim();
    if (!para) return false;

    const apiKey = clave();
    if (!apiKey) {
      console.error(
        "[correo] falta RESEND_API_KEY: no se envió el correo de la orden " +
          datos.codigo
      );
      return false;
    }

    const ajustes = await ajustesDeCorreo();
    if (!ajustes.activo) return false; // el dueño lo apagó en Configuración

    const respuesta = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: conNombreDeMarca(ajustes.remitente),
        to: [para],
        subject: `Tus números del sorteo ${datos.tituloRifa} · ${datos.codigo}`,
        html: plantillaHtml(datos),
        text: plantillaTexto(datos),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => "");
      console.error(
        `[correo] Resend respondió ${respuesta.status} para la orden ${datos.codigo}: ${detalle}`
      );
      return false;
    }

    return true;
  } catch (err) {
    console.error(
      `[correo] no se pudo enviar el correo de la orden ${datos.codigo}:`,
      err
    );
    return false;
  }
}
