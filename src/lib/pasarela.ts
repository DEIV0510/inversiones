import { isBoldConfigured } from "@/lib/bold";
import { isWompiConfigured } from "@/lib/wompi";

/**
 * Capa común de pasarelas de pago.
 *
 * El resto del proyecto NO debe preguntarle a cada proveedor por separado
 * ("¿está Wompi?", "¿está Bold?"): pregunta aquí. Así, el día que entre o
 * salga una pasarela, se cambia un archivo y no quince.
 *
 * Regla de preferencia: si están configuradas las dos, gana BOLD (es la
 * cuenta que el dueño tiene de verdad). Wompi queda como respaldo y sus
 * pagos ya cobrados se siguen confirmando igual, porque su webhook y su
 * verificación por referencia siguen vivos.
 */

export type Pasarela = "bold" | "wompi";

/** Nombre bonito para mostrar (panel, comprobantes). */
export function nombrePasarela(pasarela: Pasarela): string {
  return pasarela === "bold" ? "Bold" : "Wompi";
}

/**
 * Qué pasarela usa esta tienda para COBRAR, o null si no hay ninguna
 * configurada en el entorno.
 */
export function pasarelaActiva(): Pasarela | null {
  if (isBoldConfigured()) return "bold";
  if (isWompiConfigured()) return "wompi";
  return null;
}

/** ¿Hay alguna pasarela útil configurada en el entorno? */
export function hayPasarelaConfigurada(): boolean {
  return pasarelaActiva() !== null;
}

/** Mismo nombre en corto: las dos formas se usan en el proyecto. */
export const hayPasarela = hayPasarelaConfigurada;

/** Todas las pasarelas configuradas (para el panel: "tienes Bold y Wompi"). */
export function pasarelasConfiguradas(): Pasarela[] {
  const lista: Pasarela[] = [];
  if (isBoldConfigured()) lista.push("bold");
  if (isWompiConfigured()) lista.push("wompi");
  return lista;
}

/**
 * Qué pasarela se le ofrece al comprador en ESTA rifa.
 *
 * Dos condiciones, y hacen falta las dos: que la tienda tenga pasarela
 * configurada (llaves en el entorno) y que el dueño la haya dejado encendida
 * en la rifa (`gatewayCheckout`, el interruptor gemelo del de WhatsApp).
 * Apagada, esta rifa cobra solo por WhatsApp aunque las llaves existan.
 */
export function pasarelaDeRifa(rifa: { gatewayCheckout: boolean }): Pasarela | null {
  if (!rifa.gatewayCheckout) return null;
  return pasarelaActiva();
}

/**
 * ¿Esta rifa tiene ALGUNA forma de cobrarle al comprador?
 *
 * Si no, el comprador aparta sus números y llega a "Realiza el pago" sin un
 * solo botón. Ya pasó en producción. Por eso el panel bloquea publicar así y
 * el API responde 422. Ahora cuenta también `gatewayCheckout`: tener llaves
 * configuradas no basta si el dueño apagó la pasarela en esta rifa.
 */
export function rifaTieneFormaDeCobro(rifa: {
  whatsappCheckout: boolean;
  gatewayCheckout: boolean;
}): boolean {
  return rifa.whatsappCheckout || pasarelaDeRifa(rifa) !== null;
}

/**
 * Ojo con esto: `hayPasarelaConfigurada()` responde por la TIENDA (¿hay
 * llaves?) y `pasarelaDeRifa()` por UNA rifa (¿hay llaves Y está encendida
 * ahí?). Confundirlas es justo el error que dejaría a un comprador sin botón
 * de pago, así que la regla completa vive en `rifaTieneFormaDeCobro`.
 */
