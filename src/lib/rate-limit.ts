/**
 * Limitador de intentos en memoria (por instancia serverless). Suficiente
 * como fricción anti-abuso en endpoints públicos. Para límites distribuidos
 * duros, ver docs/SEGURIDAD.md (Upstash/Redis).
 *
 * Diseño importante: el cupo GLOBAL nunca rechaza a un solicitante nuevo.
 * Si lo hiciera, cualquiera podría dejar fuera del panel (o de la compra) a
 * todo el mundo agotando el cupo. El cupo global solo endurece a quien YA
 * viene insistiendo desde su propia IP; contra ataques distribuidos la
 * defensa real es el costo de bcrypt más el retardo de `globalPressure`.
 */

type Bucket = { count: number; resetAt: number };

const stores = new Map<string, Map<string, Bucket>>();
const globals = new Map<string, Bucket>();

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const hops = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
  // Último salto: lo agrega el proxy propio, no es falsificable por el cliente.
  return hops[hops.length - 1] || "local";
}

function bumpGlobal(scope: string, windowMs: number): number {
  const now = Date.now();
  let g = globals.get(scope);
  if (!g || now > g.resetAt) {
    g = { count: 0, resetAt: now + windowMs };
    globals.set(scope, g);
  }
  g.count += 1;
  return g.count;
}

export function isRateLimited(
  scope: string,
  key: string,
  opts: { max: number; windowMs: number; globalMax?: number }
): boolean {
  const now = Date.now();

  let store = stores.get(scope);
  if (!store) {
    store = new Map();
    stores.set(scope, store);
  }
  // Poda para acotar memoria.
  if (store.size > 5000) {
    for (const [k, b] of store) if (now > b.resetAt) store.delete(k);
  }

  const bucket = store.get(key);
  let count: number;
  if (!bucket || now > bucket.resetAt) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    count = 1;
  } else {
    bucket.count += 1;
    count = bucket.count;
  }

  // Límite propio de la IP: la barrera principal.
  if (count > opts.max) return true;

  // Presión global: solo afecta a quien ya lleva varios intentos propios.
  if (opts.globalMax) {
    const globalCount = bumpGlobal(scope, opts.windowMs);
    const insistente = Math.max(3, Math.ceil(opts.max / 2));
    if (globalCount > opts.globalMax && count > insistente) return true;
  }

  return false;
}

/**
 * Mira el cupo de una IP SIN gastarlo.
 *
 * Sirve para endpoints donde no todo intento debe restar: primero se consulta
 * si esa IP ya está bloqueada (y se corta), y solo cuando el intento resulta
 * ser una petición de verdad se llama a `isRateLimited`, que sí cuenta. Así
 * escribir mal un correo no le quita cupo a nadie.
 *
 * Devuelve true cuando el siguiente intento contado quedaría por encima del
 * tope, que es exactamente lo que haría `isRateLimited`.
 */
export function peekRateLimited(
  scope: string,
  key: string,
  opts: { max: number }
): boolean {
  const bucket = stores.get(scope)?.get(key);
  if (!bucket || Date.now() > bucket.resetAt) return false;
  return bucket.count >= opts.max;
}

/**
 * Indica si el scope está bajo presión inusual. Los endpoints sensibles la
 * usan para aumentar el retardo (fricción) sin negar el servicio a nadie.
 */
export function isUnderPressure(scope: string, globalMax: number): boolean {
  const g = globals.get(scope);
  if (!g || Date.now() > g.resetAt) return false;
  return g.count > globalMax;
}
